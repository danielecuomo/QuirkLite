/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {Suite, assertThat} from "../TestUtil.js"
import {GateBuilder} from "../../src/circuit/Gate.js"
import {CircuitDefinition} from "../../src/circuit/CircuitDefinition.js"
import {Gates} from "../../src/gates/AllGates.js"
import {Matrix} from "../../src/math/Matrix.js"
import {Util} from "../../src/base/Util.js"

let suite = new Suite("WireCut");

const TEST_GATES = new Map([
    ['-', undefined],
    ['/', null],
    ['w', Gates.WireCutGate],
    ['s', Gates.Special.SwapHalf],
    ['#', new GateBuilder().setKnownEffectToMatrix(Matrix.zero(4, 4)).setHeight(2).gate],
]);

const circuit = diagram => CircuitDefinition.fromTextDiagram(TEST_GATES, diagram);

suite.test("cut terminates only the cut wire", () => {
    let c = circuit(`-w--
                     ----
                     ----`);

    assertThat(c.colIsWireCutMask(0)).isEqualTo(0);
    assertThat(c.colIsWireCutMask(1)).isEqualTo(0);
    assertThat(c.colIsWireCutMask(2)).isEqualTo(1);
    assertThat(c.gateAtLocIsDisabledReason(2, 0)).isEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(2, 1)).isEqualTo(undefined);
});

suite.test("multi-wire gates cannot bridge a cut", () => {
    let c = circuit(`-w#-
                     --/-
                     ----
                     ----`);

    assertThat(c.gateAtLocIsDisabledReason(2, 0)).isEqualTo("wire ended");
    assertThat(c.findGateCoveringSlot(2, 0)).isEqualTo(undefined);
    assertThat(c.findGateCoveringSlot(2, 1)).isEqualTo(undefined);
});

suite.test("multi-wire gates can use surviving physical rows", () => {
    let valid = circuit(`-w--
                          --#-
                          --/-
                          ----`);

    assertThat(valid.gateAtLocIsDisabledReason(2, 1)).isEqualTo(undefined);
    assertThat(valid.findGateCoveringSlot(2, 1)).isEqualTo({
        col: 2,
        row: 1,
        gate: valid.gateInSlot(2, 1)
    });
    assertThat(valid.findGateCoveringSlot(2, 2)).isEqualTo({
        col: 2,
        row: 1,
        gate: valid.gateInSlot(2, 1)
    });
});

suite.test("cuts disable swaps that touch an ended wire", () => {
    let c = circuit(`-w-s
                     ---s
                     ----
                     ----`);
    let valid = circuit(`-w--
                          ----
                          --s-
                          --s-`);

    assertThat(c.gateAtLocIsDisabledReason(2, 0)).isEqualTo("wire ended");
    assertThat(c.colGetEnabledSwapGate(2)).isEqualTo(undefined);
    assertThat(valid.colGetEnabledSwapGate(2)).isEqualTo([2, 3]);
});

suite.test("a cut crossed by a multi-column gate invalidates the gate", () => {
    let wide = new GateBuilder().
        setKnownEffectToMatrix(Matrix.zero(4, 4)).
        setWidth(3).
        setHeight(2).
        gate;
    let gateMap = Util.mergeMaps(TEST_GATES, new Map([['@', wide]]));
    let c = CircuitDefinition.fromTextDiagram(gateMap, `@---
                                         /--w-
                                         ----
                                         ----`);

    assertThat(c.gateAtLocIsDisabledReason(0, 0)).isEqualTo("wire ended");
    assertThat(c.gateOverlapsWireCut(0, 0, wide)).isTrue();
    assertThat(c.findGateCoveringSlot(0, 0)).isEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(2, 1)).isEqualTo(undefined);
});
