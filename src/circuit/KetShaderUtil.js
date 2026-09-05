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
import {WglArg} from "../webgl/WglArg.js"
import {makePseudoShaderWithInputsAndOutputAndCode, Inputs, Outputs} from "../webgl/ShaderCoders.js"

/**
 * Creates a shader for a quantum gate based on a minimalist input like `return cmul(inp(0.0), vec2(0.0, 1.0));`.
 *
 * @param {!String} head Code that goes outside the output-computing function, for declaring uniforms and helper funcs.
 * @param {!String} body Code that goes inside the output-computing function.
 * @param {null|!int=null} span The height of the gate; the number of qubits it spans.
 * @param {!Array.<!ShaderPartDescription>} inputs
 * @return {!{withArgs: !function(args: ...!WglArg|!WglTexture) : !WglConfiguredShader}}
 */
const ketShader = (head, body, span=null, inputs=[]) => ({withArgs: makePseudoShaderWithInputsAndOutputAndCode(
    [
        ...inputs,
        Inputs.vec2('ketgen_ket'),
        Inputs.bool('ketgen_control')
    ],
    Outputs.vec2(),
    `
    uniform float _ketgen_bits;
    ${span === null ? 'uniform float span;' : ''}
    float _ketgen_off;
    float full_out_id;

    float _ketgen_relevant_out_id(float state) {
        float result = 0.0;
        float physicalBit = 1.0;
        float logicalBit = 1.0;
        for (int i = 0; i < ${Config.MAX_WIRE_COUNT}; i++) {
            float selected = mod(floor(_ketgen_bits / physicalBit), 2.0);
            result += selected * mod(floor(state / physicalBit), 2.0) * logicalBit;
            logicalBit *= 1.0 + selected;
            physicalBit *= 2.0;
        }
        return result;
    }

    float _ketgen_clear_selected_bits(float state) {
        float result = state;
        float physicalBit = 1.0;
        for (int i = 0; i < ${Config.MAX_WIRE_COUNT}; i++) {
            float selected = mod(floor(_ketgen_bits / physicalBit), 2.0);
            result -= selected * mod(floor(result / physicalBit), 2.0) * physicalBit;
            physicalBit *= 2.0;
        }
        return result;
    }

    float _ketgen_scatter_selected_bits(float k, float base) {
        float result = base;
        float physicalBit = 1.0;
        float logicalBit = 1.0;
        for (int i = 0; i < ${Config.MAX_WIRE_COUNT}; i++) {
            float selected = mod(floor(_ketgen_bits / physicalBit), 2.0);
            result += selected * mod(floor(k / logicalBit), 2.0) * physicalBit;
            logicalBit *= 1.0 + selected;
            physicalBit *= 2.0;
        }
        return result;
    }

    vec2 inp(float k) {
        return read_ketgen_ket(_ketgen_scatter_selected_bits(k, _ketgen_off));
    }

    ${body.match(/\bcmul\b/) ? 'vec2 cmul(vec2 c1, vec2 c2) { return mat2(c1.x, c1.y, -c1.y, c1.x) * c2; }' : ''}

    ${head}

    vec2 _ketgen_output_for(float out_id, vec2 amp) {
        ${body}
    }

    vec2 outputFor(float k) {
        full_out_id = k;

        float relevant_out_id = _ketgen_relevant_out_id(full_out_id);
        _ketgen_off = _ketgen_clear_selected_bits(full_out_id);

        float c = read_ketgen_control(full_out_id);
        vec2 vc = read_ketgen_ket(full_out_id);
        vec2 vt = _ketgen_output_for(relevant_out_id, vc);
        return (1.0-c)*vc + c*vt;
    }`)});

const ketShaderPermute = (head, body, span=null) => ketShader(
    head + `float _ketgen_input_for(float out_id) { ${body} }`,
    'return inp(_ketgen_input_for(out_id));',
    span);

const ketShaderPhase = (head, body, span=null) => ketShader(
    `${head}
        float _ketgen_phase_for(float out_id) {
            ${body}
        }
    `,
    `
        float angle = _ketgen_phase_for(out_id);
        return cmul(amp, vec2(cos(angle), sin(angle)));
    `,
    span);

function ketArgs(ctx, span=undefined, input_letters=[]) {
    let qubitRows = ctx.qubitRows;
    if (qubitRows === undefined) {
        let count = span === undefined ? 1 : span;
        qubitRows = [];
        for (let i = 0; i < count; i++) {
            qubitRows.push(ctx.row + i);
        }
    }

    let bits = 0;
    for (let row of qubitRows) {
        if (row >= 0 && row < Config.MAX_WIRE_COUNT) {
            bits |= 1 << row;
        }
    }

    let result = [
        ctx.stateTrader.currentTexture,
        ctx.controlsTexture,
        WglArg.float("_ketgen_bits", bits)
    ];
    if (span !== undefined) {
        result.push(WglArg.float('span', 1 << span));
    }
    for (let letter of input_letters) {
        result.push(...ketInputGateArgs(ctx, letter));
    }
    return result;
}

function ketInputGateShaderCode(letter) {
    return `
        //////// INPUT GATE ${letter} ////////
        uniform float _gen_input_default_${letter};
        uniform float _gen_input_offset_${letter};
        uniform float _gen_input_span_${letter};
        
        float read_input_${letter}() {
            return _gen_input_span_${letter} == 0.0
                ? _gen_input_default_${letter}
                : mod(floor(full_out_id / _gen_input_offset_${letter}), _gen_input_span_${letter});
        }`;
}

function ketInputGateArgs(ctx, letter) {
    let offset = 0;
    let length = -1;
    let defaultVal = ctx.customContextFromGates.get(`Input Default ${letter}`) || 0;
    let inputCtx = ctx.customContextFromGates.get(`Input Range ${letter}`);
    if (inputCtx !== undefined) {
        offset = inputCtx.offset;
        length = inputCtx.length;
    }

    return [
        WglArg.float(`_gen_input_default_${letter}`, defaultVal),
        WglArg.float(`_gen_input_offset_${letter}`, 1<<offset),
        WglArg.float(`_gen_input_span_${letter}`, length === -1 ? 0 : 1<<length),
    ];
}

export {
    ketArgs,
    ketShader,
    ketShaderPermute,
    ketShaderPhase,
    ketInputGateShaderCode,
    ketInputGateArgs
}