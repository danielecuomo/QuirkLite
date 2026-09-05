/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {Config} from "../Config.js"
import {WglArg} from "../webgl/WglArg.js"
import {Inputs, Outputs, currentShaderCoder, makePseudoShaderWithInputsAndOutputAndCode} from "../webgl/ShaderCoders.js"

/**
 * Reorders the bits of a state vector so the selected physical rows become
 * the low logical bits, while the other bits retain their relative order.
 * A final cyclic bit shift can place the selected block at another position.
 *
 * @param {!WglTexture} inputTexture
 * @param {!int} selectedMask
 * @param {!int} shift
 * @returns {!WglConfiguredShader}
 */
function rearrangeBits(inputTexture, selectedMask, shift=0) {
    return REARRANGE_BITS_SHADER.withArgs(
        inputTexture,
        WglArg.float("selectedMask", selectedMask),
        WglArg.float("shift", shift),
        WglArg.float("wireCount", 1 << currentShaderCoder().vec2.arrayPowerSizeOfTexture(inputTexture)));
}

const REARRANGE_BITS_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.vec2(),
    `
    uniform float selectedMask;
    uniform float shift;
    uniform float wireCount;

    vec2 outputFor(float k) {
        float result = 0.0;
        float physicalBit = 1.0;
        float selectedRank = 0.0;
        float otherRank = 0.0;
        float selectedCount = 0.0;
        float n = wireCount;

        for (int i = 0; i < ${Config.MAX_WIRE_COUNT}; i++) {
            float selected = mod(floor(selectedMask / physicalBit), 2.0);
            selectedCount += selected;
            physicalBit *= 2.0;
        }

        physicalBit = 1.0;
        for (int i = 0; i < ${Config.MAX_WIRE_COUNT}; i++) {
            float selected = mod(floor(selectedMask / physicalBit), 2.0);
            float packedPos = selected * selectedRank +
                              (1.0 - selected) * (selectedCount + otherRank);
            float destination = mod(packedPos + shift + n, n);
            float destinationBit = exp2(destination);
            float value = mod(floor(k / destinationBit), 2.0);
            result += value * physicalBit;
            selectedRank += selected;
            otherRank += 1.0 - selected;
            physicalBit *= 2.0;
        }

        return read_input(result);
    }`);

export {rearrangeBits};
