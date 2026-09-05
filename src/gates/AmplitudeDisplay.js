/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Config} from "../Config.js"
import {CircuitShaders} from "../circuit/CircuitShaders.js"
import {Gate} from "../circuit/Gate.js"
import {GatePainting} from "../draw/GatePainting.js"
import {GateShaders} from "../circuit/GateShaders.js"
import {Format} from "../base/Format.js"
import {MathPainter} from "../draw/MathPainter.js"
import {Matrix, complexVectorToReadableJson, realVectorToReadableJson} from "../math/Matrix.js"
import {probabilityStatTexture} from "./ProbabilityDisplay.js"
import {Util} from "../base/Util.js"
import {Shaders} from "../webgl/Shaders.js"
import {WglConfiguredShader} from "../webgl/WglConfiguredShader.js"
import {
    Inputs,
    Outputs,
    currentShaderCoder,
    makePseudoShaderWithInputsAndOutputAndCode
} from "../webgl/ShaderCoders.js"
import {WglTexturePool} from "../webgl/WglTexturePool.js"
import {WglTextureTrader} from "../webgl/WglTextureTrader.js"

function amplitudeDisplayStatTextures(stateKet, controls, controlsTexture, rangeOffset, rangeLength) {
    let incoherentKet = probabilityStatTexture(stateKet, controlsTexture, rangeOffset, rangeLength);

    let trader = new WglTextureTrader(stateKet);
    trader.dontDeallocCurrentTexture();

    let startingQubits = currentShaderCoder().vec2.arrayPowerSizeOfTexture(stateKet);
    let lostQubits = Util.numberOfSetBits(controls.inclusionMask);
    let lostHeadQubits = Util.numberOfSetBits(controls.inclusionMask & ((1<<rangeOffset)-1));
    let involvedQubits = startingQubits - lostQubits;
    let broadcastQubits = involvedQubits - rangeLength;

    trader.shadeAndTrade(
        tex => CircuitShaders.controlSelect(controls, tex),
        WglTexturePool.takeVec2Tex(involvedQubits));
    trader.shadeAndTrade(tex => GateShaders.cycleAllBits(tex, lostHeadQubits-rangeOffset));
    let ketJustAfterCycle = trader.dontDeallocCurrentTexture();

    trader.shadeAndTrade(AMPS_TO_SQUARED_MAGS_SHADER, WglTexturePool.takeVecFloatTex(involvedQubits));
    for (let k = 0; k < rangeLength; k++) {
        trader.shadeHalveAndTrade(Shaders.sumFoldFloatAdjacents);
    }

    trader.shadeAndTrade(MAGS_TO_INDEXED_MAGS_SHADER, WglTexturePool.takeVec2Tex(broadcastQubits));
    for (let k = 0; k < broadcastQubits; k++) {
        trader.shadeHalveAndTrade(FOLD_MAX_INDEXED_MAG_SHADER);
    }

    trader.shadeAndTrade(
        indexed_mag => LOOKUP_KET_AT_INDEXED_MAG_SHADER(ketJustAfterCycle, indexed_mag),
        WglTexturePool.takeVec2Tex(rangeLength));
    let rawKet = trader.dontDeallocCurrentTexture();

    trader.shadeAndTrade(
        small_input => POINTWISE_CMUL_CONJ_SHADER(small_input, ketJustAfterCycle),
        WglTexturePool.takeVec2Tex(involvedQubits));
    ketJustAfterCycle.deallocByDepositingInPool("ketJustAfterCycle in makeAmplitudeSpanPipeline");
    for (let k = 0; k < rangeLength; k++) {
        trader.shadeHalveAndTrade(Shaders.sumFoldVec2Adjacents);
    }

    trader.shadeAndTrade(AMPS_TO_SQUARED_MAGS_SHADER, WglTexturePool.takeVecFloatTex(broadcastQubits));
    for (let k = 0; k < broadcastQubits; k++) {
        trader.shadeHalveAndTrade(Shaders.sumFoldFloat);
    }

    if (currentShaderCoder().float.needRearrangingToBeInVec4Format) {
        trader.shadeHalveAndTrade(Shaders.packFloatIntoVec4);
    }
    let denormalizedQuality = trader.currentTexture;

    trader.currentTexture = rawKet;
    if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
        trader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
    }
    let ket = trader.currentTexture;

    return [ket, denormalizedQuality, incoherentKet];
}

function _partialTraceCutQubits(ketPixels, span, cutMask) {
    let tracedCount = Util.numberOfSetBits(cutMask);
    let keptSpan = span - tracedCount;
    let keptCount = 1 << keptSpan;
    let traceCount = 1 << tracedCount;

    let physicalIndex = (kept, traced) => {
        let result = 0;
        let keptBit = 0;
        let traceBit = 0;
        for (let bit = 0; bit < span; bit++) {
            if ((cutMask & (1 << bit)) !== 0) {
                result |= ((traced >>> traceBit) & 1) << bit;
                traceBit++;
            } else {
                result |= ((kept >>> keptBit) & 1) << bit;
                keptBit++;
            }
        }
        return result;
    };

    let total = 0;
    let probabilities = new Float64Array(keptCount);
    let pivotKept = 0;
    let pivotTrace = 0;
    let pivotMag2 = -1;
    for (let kept = 0; kept < keptCount; kept++) {
        for (let traced = 0; traced < traceCount; traced++) {
            let i = physicalIndex(kept, traced) * 2;
            let mag2 = ketPixels[i] * ketPixels[i] + ketPixels[i + 1] * ketPixels[i + 1];
            probabilities[kept] += mag2;
            total += mag2;
            if (mag2 > pivotMag2) {
                pivotMag2 = mag2;
                pivotKept = kept;
                pivotTrace = traced;
            }
        }
    }

    if (!Number.isFinite(total) || total < 1e-12 || pivotMag2 < 1e-12) {
        return {
            ketPixels: new Float32Array(keptCount * 2).fill(NaN),
            incoherentKetPixels: new Float32Array(keptCount).fill(NaN),
            isMixed: true,
        };
    }

    let pivotIndex = physicalIndex(pivotKept, pivotTrace) * 2;
    let pr = ketPixels[pivotIndex];
    let pi = ketPixels[pivotIndex + 1];
    let pivotInvR = pr / pivotMag2;
    let pivotInvI = -pi / pivotMag2;
    let residual = 0;
    for (let kept = 0; kept < keptCount; kept++) {
        let baseIndex = physicalIndex(kept, pivotTrace) * 2;
        let baseR = ketPixels[baseIndex];
        let baseI = ketPixels[baseIndex + 1];
        for (let traced = 0; traced < traceCount; traced++) {
            let i = physicalIndex(kept, traced) * 2;
            let cr = ketPixels[i];
            let ci = ketPixels[i + 1];
            let colIndex = physicalIndex(pivotKept, traced) * 2;
            let qr = ketPixels[colIndex];
            let qi = ketPixels[colIndex + 1];
            let sr = baseR * pivotInvR - baseI * pivotInvI;
            let si = baseR * pivotInvI + baseI * pivotInvR;
            let rr = cr - (sr * qr - si * qi);
            let ri = ci - (sr * qi + si * qr);
            residual += rr * rr + ri * ri;
        }
    }
    let isMixed = residual / total > 1e-7;

    let incoherent = new Float32Array(keptCount);
    for (let kept = 0; kept < keptCount; kept++) {
        incoherent[kept] = Math.sqrt(Math.max(0, probabilities[kept] / total));
    }

    if (isMixed) {
        return {
            ketPixels: new Float32Array(keptCount * 2).fill(NaN),
            incoherentKetPixels: incoherent,
            isMixed: true,
        };
    }

    let norm = Math.sqrt(probabilities[pivotKept] || 0);
    let compactKet = new Float32Array(keptCount * 2);
    for (let kept = 0; kept < keptCount; kept++) {
        let i = physicalIndex(kept, pivotTrace) * 2;
        compactKet[kept * 2] = ketPixels[i] / norm;
        compactKet[kept * 2 + 1] = ketPixels[i + 1] / norm;
    }

    return {
        ketPixels: compactKet,
        incoherentKetPixels: incoherent,
        isMixed: false,
    };
}

function processOutputs(span, pixelGroups, circuitDefinition, col, row) {
    let [ketPixels, qualityPixels, rawIncoherentKetPixels] = pixelGroups;
    let denormalizedQuality = qualityPixels[0];

    let cutMask = circuitDefinition.colIsWireCutMask(col);
    let localCutMask = (cutMask >>> row) & ((1 << span) - 1);
    if (localCutMask !== 0) {
        let traced = _partialTraceCutQubits(ketPixels, span, localCutMask);
        ketPixels = traced.ketPixels;
        rawIncoherentKetPixels = traced.incoherentKetPixels;
        if (traced.isMixed) {
            denormalizedQuality = 0;
        }
    }

    let n = ketPixels.length >> 1;
    let displaySpan = Math.round(Math.log2(n));
    let w = n === 2 ? 2 : 1 << Math.floor(Math.round(Math.log2(n))/2);
    let h = n/w;

    let unity = 0;
    for (let e of ketPixels) {
        unity += e*e;
    }
    let incoherentKetPixels = new Float32Array(w * h * 2);
    let incoherentUnity = 0;
    for (let i = 0; i < n; i++) {
        incoherentUnity += rawIncoherentKetPixels[i];
    }
    for (let i = 0; i < n; i++) {
        incoherentKetPixels[i << 1] = Math.sqrt(rawIncoherentKetPixels[i] / incoherentUnity);
    }
    if (isNaN(incoherentUnity) || incoherentUnity < 0.000001) {
        return {
            quality: 0.0,
            ket: Matrix.zero(w, h).times(NaN),
            phaseLockIndex: 0,
            incoherentKet: Matrix.zero(w, h).times(NaN),
        };
    }
    let quality = denormalizedQuality / unity / incoherentUnity;

    let phaseIndex = displaySpan === circuitDefinition.numWires ? undefined : _processOutputs_pickPhaseLockIndex(ketPixels);
    let phase = phaseIndex === undefined ? 0 : Math.atan2(ketPixels[phaseIndex*2+1], ketPixels[phaseIndex*2]);
    let c = Math.cos(phase);
    let s = -Math.sin(phase);

    let buf = new Float32Array(n*2);
    let sqrtUnity = Math.sqrt(unity);
    for (let i = 0; i < n; i++) {
        let real = ketPixels[i*2]/sqrtUnity;
        let imag = ketPixels[i*2+1]/sqrtUnity;
        buf[i*2] = real*c + imag*-s;
        buf[i*2+1] = real*s + imag*c;
    }
    return {
        quality,
        ket: new Matrix(w, h, buf),
        phaseLockIndex: phaseIndex,
        incoherentKet: new Matrix(w, h, incoherentKetPixels),
    };
}

function _processOutputs_pickPhaseLockIndex(ketPixels) {
    let result = 0;
    let best = 0;
    for (let k = 0; k < ketPixels.length; k += 2) {
        let r = ketPixels[k];
        let i = ketPixels[k+1];
        let m = r*r + i*i;
        if (m > best*10000) {
            best = m;
            result = k >> 1;
        }
    }
    return result;
}

const AMPS_TO_SQUARED_MAGS_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.float(),
    `float outputFor(float k) {
        vec2 ri = read_input(k);
        return dot(ri, ri);
    }`);

const MAGS_TO_INDEXED_MAGS_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.float('input')],
    Outputs.vec2(),
    `vec2 outputFor(float k) {
        return vec2(float(k), read_input(k));
    }`);

const FOLD_MAX_INDEXED_MAG_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.vec2(),
    `vec2 outputFor(float k) {
        vec2 a = read_input(k);
        vec2 b = read_input(k + len_output());
        return a.y >= b.y ? a : b;
    }`);

const LOOKUP_KET_AT_INDEXED_MAG_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input'), Inputs.vec2('indexed_mag')],
    Outputs.vec2(),
    `vec2 outputFor(float k) {
        return read_input(k + read_indexed_mag(0.0).x * len_output());
    }`);

const POINTWISE_CMUL_CONJ_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('small_input'), Inputs.vec2('large_input')],
    Outputs.vec2(),
    `
    vec2 cmul_conj(vec2 c1, vec2 c2) {
        return mat2(c1.x, -c1.y, c1.y, c1.x) * c2;
    }
    vec2 outputFor(float k) {
        vec2 in1 = read_small_input(floor(mod(k + 0.5, len_small_input())));
        vec2 in2 = read_large_input(k);
        return cmul_conj(in1, in2);
    }
    `);

const AMPLITUDE_DRAWER_FROM_CUSTOM_STATS = GatePainting.makeDisplayDrawer(args => {
    let n = args.gate.height;
    let {quality, ket, phaseLockIndex, incoherentKet} = args.customStats || {
        ket: (n === 1 ? Matrix.zero(2, 1) : Matrix.zero(1 << Math.floor(n / 2), 1 << Math.ceil(n / 2))).times(NaN),
        quality: 1,
        phaseLockIndex: 0,
        incoherentKet: undefined
    };

    let isIncoherent = quality < 0.99;
    let matrix = isIncoherent ? incoherentKet : ket;
    let matrixAspect = matrix.width() / matrix.height();
    let maxWidthForHeight = args.rect.h * matrixAspect;
    let drawWidth = Math.min(args.rect.w, maxWidthForHeight);
    let drawHeight = drawWidth / matrixAspect;
    let drawRect = new Rect(
        args.rect.center().x - drawWidth / 2,
        args.rect.center().y - drawHeight / 2,
        drawWidth,
        drawHeight);
    let indicatorAlpha = Math.min(1, Math.max(0, (quality - 0.9999) / 0.0001));
    MathPainter.paintMatrix(
        args.painter,
        matrix,
        drawRect,
        Config.SUPERPOSITION_MID_COLOR,
        'black',
        Config.SUPERPOSITION_FORE_COLOR,
        Config.SUPERPOSITION_BACK_COLOR,
        `rgba(0, 0, 0, ${indicatorAlpha})`);

    let forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    if (isIncoherent) {
        MathPainter.paintMatrixTooltip(args.painter, matrix, drawRect, args.focusPoints,
            (c, r) => `Chance of |${Util.bin(r*matrix.width() + c, Math.round(Math.log2(matrix.width()*matrix.height())))}⟩ (decimal ${r*matrix.width() + c}) [amplitude not defined]`,
            (c, r, v) => `raw: ${(v.norm2()*100).toFixed(4)}%, log: ${(Math.log10(v.norm2())*10).toFixed(1)} dB`,
            (c, r, v) => '[entangled with other qubits]');
    } else {
        MathPainter.paintMatrixTooltip(args.painter, matrix, drawRect, args.focusPoints,
            (c, r) => `Amplitude of |${Util.bin(r*matrix.width() + c, Math.round(Math.log2(matrix.width()*matrix.height())))}⟩ (decimal ${r*matrix.width() + c})`,
            (c, r, v) => 'val:' + v.toString(new Format(false, 0, 5, ", ")),
            (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);
    }

    paintErrorIfPresent(args, indicatorAlpha);
});

function paintErrorIfPresent(args, indicatorAlpha) {
    let err = undefined;
    let {col, row} = args.positionInCircuit;
    let measured = ((args.stats.circuitDefinition.colIsMeasuredMask(col) >> row) & ((1 << args.gate.height) - 1)) !== 0;
    if (measured) {
        indicatorAlpha = 0;
        err = args.gate.width <= 2 ? '(w/ measure defer)' : '(assuming measurement deferred)';
    } else if (indicatorAlpha < 0.999) {
        err = 'incoherent';
    }
    if (err !== undefined) {
        args.painter.print(
            err,
            args.rect.x+args.rect.w/2,
            args.rect.y+args.rect.h,
            'center',
            'hanging',
            `rgba(255,0,0,${1-indicatorAlpha})`,
            '12px sans-serif',
            args.rect.w,
            args.rect.h,
            undefined);
    }
}

function customStatsToJsonData(customStats) {
    let {quality, ket, phaseLockIndex, incoherentKet} = customStats;
    let n = ket.width() * ket.height();
    return {
        coherence_measure: quality,
        superposition_phase_locked_state_index: phaseLockIndex === undefined ? null : phaseLockIndex,
        ket: complexVectorToReadableJson(new Matrix(1, n, ket.rawBuffer()).getColumn(0)),
        incoherentKet: realVectorToReadableJson(new Matrix(1, n, incoherentKet.rawBuffer()).getColumn(0))
    };
}

let AmplitudeDisplayFamily = Gate.buildFamily(1, 16, (span, builder) => builder.
    setSerializedId("Amps" + span).
    setSymbol("Amps").
    setTitle("Amplitude Display").
    setBlurb("Shows the amplitudes of some wires, if separable.\nUse controls to see conditional amplitudes.").
    setWidth(span === 1 ? 2 : span % 2 === 0 ? span : Math.ceil(span/2)).
    promiseHasNoNetEffectOnStateVector().
    setExtraDisableReasonFinder(args => args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined).
    setStatTexturesMaker(ctx =>
        amplitudeDisplayStatTextures(
            ctx.stateTrader.currentTexture,
            ctx.controls,
            ctx.controlsTexture,
            ctx.row,
            span)).
    setStatPixelDataPostProcessor((val, def, col, row) => processOutputs(span, val, def, col, row)).
    setProcessedStatsToJsonFunc(customStatsToJsonData).
    setDrawer(AMPLITUDE_DRAWER_FROM_CUSTOM_STATS));

export {
    amplitudeDisplayStatTextures,
    AmplitudeDisplayFamily,
    AMPS_TO_SQUARED_MAGS_SHADER,
    MAGS_TO_INDEXED_MAGS_SHADER,
    FOLD_MAX_INDEXED_MAG_SHADER,
    LOOKUP_KET_AT_INDEXED_MAG_SHADER,
    POINTWISE_CMUL_CONJ_SHADER,
};
