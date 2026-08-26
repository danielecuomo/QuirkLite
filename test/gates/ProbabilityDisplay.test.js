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

import {Suite, assertThat} from "../TestUtil.js"
import {amplitudesToProbabilities, probabilityPixelsToColumnVector, probabilityStatTexture} from "../../src/gates/ProbabilityDisplay.js"

import {CircuitShaders} from "../../src/circuit/CircuitShaders.js"
import {Controls} from "../../src/circuit/Controls.js"
import {Shaders} from "../../src/webgl/Shaders.js"
import {CircuitDefinition} from "../../src/circuit/CircuitDefinition.js"
import {CircuitStats} from "../../src/circuit/CircuitStats.js"
import {Serializer} from "../../src/base/Serializer.js"

let suite = new Suite("ProbabilityDisplay");


suite.test("probabilityPixelsToColumnVector normalizes displayed probabilities", () => {
    let data = probabilityPixelsToColumnVector(
        new Float32Array([1, 2, 3, 4]),
        2);

    assertThat(data.rawBuffer()).isApproximatelyEqualTo(new Float32Array([
        1/10, 0,
        2/10, 0,
        3/10, 0,
        4/10, 0,
    ]));
});

suite.testUsingWebGL("probabilityStatTexture traces out wire-cut qubits before selecting range", () => {
    let probabilities = [1, 2, 3, 4, 5, 6, 7, 8];
    let amplitudes = new Float32Array(16);
    for (let i = 0; i < probabilities.length; i++) {
        amplitudes[i*2] = Math.sqrt(probabilities[i]);
    }
    let ket = Shaders.vec2Data(amplitudes).toVec2Texture(3);
    let con = CircuitShaders.controlMask(Controls.NONE).toBoolTexture(3);
    let out = probabilityStatTexture(ket, con, 0, 2, 1 << 1);

    assertThat(out.readVecFloatOutputs(2)).isApproximatelyEqualTo(new Float32Array([
        4, 6, 12, 14,
    ]));

    out.deallocByDepositingInPool();
    ket.deallocByDepositingInPool();
    con.deallocByDepositingInPool();
});

suite.testUsingWebGL("CHANCE removes wire-cut qubits from its displayed subsystem", () => {
    let stats = CircuitStats.fromCircuitAtTime(
        Serializer.fromJson(CircuitDefinition, {
            cols:[
                ["H", undefined, undefined],
                ["•", "X", undefined],
                [undefined, "WireCut", undefined],
                ["Chance2", undefined, undefined]
            ],
            init:[0, 0, 0]
        }),
        0);
    let out = stats.toReadableJson();
    assertThat(out.displays[0].data.probabilities.length).isEqualTo(2);
    assertThat(out.displays[0].data.probabilities).isApproximatelyEqualTo([
        0.5,
        0.5,
    ]);
});

suite.testUsingWebGL("amplitudesToProbabilities", () => {
    let inp = Shaders.vec2Data(new Float32Array([
        2, 3,
        4, 5,
        6, 7,
        8, 9,
        1/2, 0,
        0, 1/4,
        0, 1/8,
        1/16, 0
    ])).toVec2Texture(3);

    let con = CircuitShaders.controlMask(Controls.NONE).toBoolTexture(3);
    assertThat(amplitudesToProbabilities(inp, con).readVecFloatOutputs(3)).isApproximatelyEqualTo(new Float32Array([
        4+9,
        16+25,
        36+49,
        64+81,
        1/4,
        1/16,
        1/64,
        1/256
    ]));

    inp.deallocByDepositingInPool();
    con.deallocByDepositingInPool();
});
