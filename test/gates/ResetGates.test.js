/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {assertThat, Suite} from "../TestUtil.js"
import {CircuitDefinition} from "../../src/circuit/CircuitDefinition.js"
import {CircuitStats} from "../../src/circuit/CircuitStats.js"
import {GateColumn} from "../../src/circuit/GateColumn.js"
import {Gates} from "../../src/gates/AllGates.js"

let suite = new Suite("Gates.ResetGates");

suite.testUsingWebGL('|0> maps exact |1> to |0> without NaN', () => {
    let circuit = new CircuitDefinition(
        1,
        [new GateColumn([Gates.ResetGates.Reset])],
        0,
        new Map(),
        undefined,
        false,
        new Map([[0, '1']]));
    let stats = CircuitStats.fromCircuitAtTime(circuit, 0);

    assertThat(stats.finalState.hasNaN()).isEqualTo(false);
    assertThat(stats.finalState.cell(0, 0).real).isEqualTo(1);
    assertThat(stats.finalState.cell(0, 1).abs()).isEqualTo(0);
});

suite.testUsingWebGL('|0> keeps the projection matrix for |0>', () => {
    let circuit = new CircuitDefinition(
        1,
        [new GateColumn([Gates.ResetGates.Reset])]);
    let stats = CircuitStats.fromCircuitAtTime(circuit, 0);

    assertThat(stats.finalState.hasNaN()).isEqualTo(false);
    assertThat(stats.finalState.cell(0, 0).real).isEqualTo(1);
    assertThat(stats.finalState.cell(0, 1).abs()).isEqualTo(0);
});


suite.testUsingWebGL('|1> maps exact |0> to |1> without NaN', () => {
    let circuit = new CircuitDefinition(
        1,
        [new GateColumn([Gates.ResetGates.ResetOne])]);
    let stats = CircuitStats.fromCircuitAtTime(circuit, 0);

    // Default input is exactly |0>.
    assertThat(stats.finalState.hasNaN()).isEqualTo(false);
    assertThat(stats.finalState.cell(0, 0).abs()).isEqualTo(0);
    assertThat(stats.finalState.cell(0, 1).real).isEqualTo(1);
});

suite.testUsingWebGL('|1> keeps the projection matrix for |1>', () => {
    let circuit = new CircuitDefinition(
        1,
        [new GateColumn([Gates.ResetGates.ResetOne])],
        0,
        new Map(),
        undefined,
        false,
        new Map([[0, '1']]));
    let stats = CircuitStats.fromCircuitAtTime(circuit, 0);

    assertThat(stats.finalState.hasNaN()).isEqualTo(false);
    assertThat(stats.finalState.cell(0, 0).abs()).isEqualTo(0);
    assertThat(stats.finalState.cell(0, 1).real).isEqualTo(1);
});
