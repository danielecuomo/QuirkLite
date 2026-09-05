/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import {Suite, assertThat} from "../TestUtil.js"
import {CircuitDefinition} from "../../src/circuit/CircuitDefinition.js"
import {GateColumn} from "../../src/circuit/GateColumn.js"
import {Gates} from "../../src/gates/AllGates.js"

let suite = new Suite("WireCut logical rows");
const _ = undefined;

suite.test("multiQubitGateSkipsCutRow", () => {
    let circuit = new CircuitDefinition(3, [
        new GateColumn([_, Gates.Special.WireCut, _]),
        new GateColumn([Gates.IsingGates.XX, _, _])
    ]);

    assertThat(circuit.activeWireRowsAtColumn(1)).isEqualTo([0, 2]);
    assertThat(circuit.gateQubitRowsAtColumn(1, 0, Gates.IsingGates.XX)).isEqualTo([0, 2]);
    assertThat(circuit.gateAtLocIsDisabledReason(1, 0)).isEqualTo(undefined);
});

suite.test("multiQubitGateStillNeedsEnoughLiveRows", () => {
    let circuit = new CircuitDefinition(3, [
        new GateColumn([_, Gates.Special.WireCut, _]),
        new GateColumn([_, Gates.IsingGates.XX, _])
    ]);

    assertThat(circuit.gateQubitRowsAtColumn(1, 1, Gates.IsingGates.XX)).isEqualTo([2]);
    assertThat(circuit.gateAtLocIsDisabledReason(1, 1)).isNotEqualTo(undefined);
});
