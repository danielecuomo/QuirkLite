/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {Controls} from "./Controls.js"
import {CircuitShaders} from "./CircuitShaders.js"
import {rearrangeBits, rearrangeFloatBits} from "./WireCutShaders.js"
import {AmplitudeDisplayFamily} from "../gates/AmplitudeDisplay.js"
import {ProbabilityDisplayFamily, amplitudesToProbabilities} from "../gates/ProbabilityDisplay.js"
import {Shaders} from "../webgl/Shaders.js"
import {currentShaderCoder} from "../webgl/ShaderCoders.js"
import {WglTexturePool} from "../webgl/WglTexturePool.js"
import {WglTextureTrader} from "../webgl/WglTextureTrader.js"

function logicalQubitRows(ctx, gate) {
    if (ctx.qubitRows !== undefined) {
        return ctx.qubitRows;
    }
    if (ctx.circuitDefinition !== undefined && ctx.col !== undefined &&
            ctx.circuitDefinition.gateQubitRowsAtColumn !== undefined) {
        return ctx.circuitDefinition.gateQubitRowsAtColumn(ctx.col, ctx.row, gate);
    }
    let result = [];
    for (let i = 0; i < gate.height; i++) {
        result.push(ctx.row + i);
    }
    return result;
}

function rowsNeedRemapping(rows, start) {
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] !== start + i) {
            return true;
        }
    }
    return false;
}

function remapControls(controls, selectedRows, shift, bitCount) {
    let selected = new Set(selectedRows);
    let selectedCount = selectedRows.length;
    let selectedRank = 0;
    let otherRank = 0;
    let resultInclusion = 0;
    let resultDesired = 0;
    let resultParity = 0;
    for (let sourceRow = 0; sourceRow < bitCount; sourceRow++) {
        let packedPos;
        if (selected.has(sourceRow)) {
            packedPos = selectedRank++;
        } else {
            packedPos = selectedCount + otherRank++;
        }
        let destination = (packedPos + shift) % bitCount;
        let sourceBit = 1 << sourceRow;
        let destinationBit = 1 << destination;
        if ((controls.inclusionMask & sourceBit) !== 0) {
            resultInclusion |= destinationBit;
            if ((controls.desiredValueMask & sourceBit) !== 0) {
                resultDesired |= destinationBit;
            }
        }
        if ((controls.parityMask & sourceBit) !== 0) {
            resultParity |= destinationBit;
        }
    }
    return new Controls(resultInclusion, resultDesired, resultParity);
}

function noCutCircuitDefinition(circuitDefinition) {
    let result = Object.create(circuitDefinition);
    result.colIsWireCutMask = () => 0;
    return result;
}

function wrapAmplitudeGate(gate) {
    if (gate === undefined || gate.customStatTexturesMaker === undefined || gate.__wireCutDisplayPatched) {
        return;
    }
    let originalMaker = gate.customStatTexturesMaker;
    let originalPost = gate.customStatPostProcesser;
    gate.customStatTexturesMaker = ctx => {
        let rows = logicalQubitRows(ctx, gate);
        if (rows.length !== gate.height || ctx.circuitDefinition === undefined ||
                !rowsNeedRemapping(rows, ctx.row)) {
            return originalMaker(ctx);
        }
        let sizePower = currentShaderCoder().vec2.arrayPowerSizeOfTexture(ctx.stateTrader.currentTexture);
        let selectedMask = 0;
        for (let row of rows) {
            selectedMask |= 1 << row;
        }
        let remappedState = rearrangeBits(
            ctx.stateTrader.currentTexture,
            selectedMask,
            ctx.row).toVec2Texture(sizePower);
        let remappedControls = remapControls(
            ctx.controls,
            rows,
            ctx.row,
            sizePower);
        let remappedControlTexture = CircuitShaders.controlMask(remappedControls).toBoolTexture(sizePower);
        let remappedCtx = ctx._clone();
        remappedCtx.stateTrader = {currentTexture: remappedState};
        remappedCtx.controls = remappedControls;
        remappedCtx.controlsTexture = remappedControlTexture;
        remappedCtx.qubitRows = undefined;
        try {
            return originalMaker(remappedCtx);
        } finally {
            remappedState.deallocByDepositingInPool("wire cut amplitude display remap");
            remappedControlTexture.deallocByDepositingInPool("wire cut amplitude control remap");
        }
    };
    if (originalPost !== undefined) {
        gate.customStatPostProcesser = (pixels, circuit, col, row) =>
            originalPost(pixels, noCutCircuitDefinition(circuit), col, row);
    }
    gate.__wireCutDisplayPatched = true;
}

function wireCutProbabilityStatTexture(ctx, gate, selectedMask) {
    let sizePower = currentShaderCoder().vec2.arrayPowerSizeOfTexture(ctx.stateTrader.currentTexture);
    let trader = new WglTextureTrader(ctx.stateTrader.currentTexture);
    trader.dontDeallocCurrentTexture();
    trader.shadeAndTrade(
        tex => amplitudesToProbabilities(tex, ctx.controlsTexture),
        WglTexturePool.takeVecFloatTex(sizePower));
    trader.shadeAndTrade(
        tex => rearrangeFloatBits(tex, selectedMask, 0),
        WglTexturePool.takeVecFloatTex(sizePower));
    for (let k = gate.height; k < sizePower; k++) {
        trader.shadeHalveAndTrade(Shaders.sumFoldFloat);
    }
    if (currentShaderCoder().float.needRearrangingToBeInVec4Format) {
        trader.shadeQuarterAndTrade(Shaders.packFloatIntoVec4);
    }
    return trader.currentTexture;
}

function wrapProbabilityGate(gate) {
    if (gate === undefined || gate.customStatTexturesMaker === undefined || gate.__wireCutDisplayPatched) {
        return;
    }
    let originalMaker = gate.customStatTexturesMaker;
    let originalPost = gate.customStatPostProcesser;
    gate.customStatTexturesMaker = ctx => {
        let rows = logicalQubitRows(ctx, gate);
        if (rows.length !== gate.height || ctx.circuitDefinition === undefined) {
            return originalMaker(ctx);
        }
        if (!rowsNeedRemapping(rows, ctx.row)) {
            return originalMaker(ctx);
        }
        let selectedMask = 0;
        for (let row of rows) {
            selectedMask |= 1 << row;
        }
        return wireCutProbabilityStatTexture(ctx, gate, selectedMask);
    };
    if (originalPost !== undefined) {
        gate.customStatPostProcesser = (pixels, circuit, col, row) =>
            originalPost(pixels, noCutCircuitDefinition(circuit), col, row);
    }
    gate.__wireCutDisplayPatched = true;
}

for (let gate of AmplitudeDisplayFamily.gateFamily) {
    if (gate.height > 1) {
        wrapAmplitudeGate(gate);
    }
}
for (let gate of ProbabilityDisplayFamily.gateFamily) {
    if (gate.height > 1) {
        wrapProbabilityGate(gate);
    }
}
