/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {CircuitDefinition} from "./CircuitDefinition.js"
import {GateColumn} from "./GateColumn.js"
import {Gates} from "../gates/AllGates.js"

const originalActiveWireRowsAtColumn = CircuitDefinition.prototype.activeWireRowsAtColumn;
CircuitDefinition.prototype.activeWireRowsAtColumn = function(col) {
    let result = originalActiveWireRowsAtColumn.call(this, col);

    // Once all existing wires below a cut have ended, a subsequent multi-wire
    // gate can continue on newly created wires at the bottom of the circuit.
    // Treat those implicit wires as the next logical live rows. This keeps the
    // simulator and the gate geometry on the same row mapping.
    let physicalRow = this.numWires;
    while (result.length < this.numWires) {
        result.push(physicalRow++);
    }
    return result;
};

CircuitDefinition.prototype.gateQubitRowsAtColumn = function(col, row, gate) {
    if (gate === undefined || col < 0 || col >= this.columns.length || row < 0 || row >= this.numWires) {
        return [];
    }
    if ((this.colIsWireCutMask(col) & (1 << row)) !== 0) {
        return [];
    }
    let activeRows = this.activeWireRowsAtColumn(col);
    let result = [];
    for (let physicalRow of activeRows) {
        if (physicalRow < row) {
            continue;
        }
        result.push(physicalRow);
        if (result.length === gate.height) {
            break;
        }
    }

    return result;
};

const originalMinimumRequiredWireCount = CircuitDefinition.prototype.minimumRequiredWireCount;
CircuitDefinition.prototype.minimumRequiredWireCount = function() {
    let result = originalMinimumRequiredWireCount.call(this);
    for (let col = 0; col < this.columns.length; col++) {
        for (let row = 0; row < this.numWires; row++) {
            let gate = this.columns[col].gates[row];
            if (gate === undefined || gate.height <= 1) {
                continue;
            }
            let rows = this.gateQubitRowsAtColumn(col, row, gate);
            for (let physicalRow of rows) {
                result = Math.max(result, physicalRow + 1);
            }
        }
    }
    return result;
};

function gateCrossesLaterWireCut(circuit, col, row, gate) {
    let maxCol = Math.min(circuit.columns.length, col + gate.width);
    let maxRow = Math.min(circuit.numWires, row + gate.height);
    for (let c = col + 1; c < maxCol; c++) {
        for (let r = row; r < maxRow; r++) {
            let cutGate = circuit.columns[c].gates[r];
            if (cutGate !== undefined && cutGate.isWireCut &&
                    circuit._colRowDisabledReason[c][r] === undefined) {
                return true;
            }
        }
    }
    return false;
}

const originalGateAtLocIsDisabledReason = CircuitDefinition.prototype.gateAtLocIsDisabledReason;
CircuitDefinition.prototype.gateAtLocIsDisabledReason = function(col, row) {
    let reason = originalGateAtLocIsDisabledReason.call(this, col, row);
    let gate = this.gateInSlot(col, row);
    if (gate === undefined) {
        return reason;
    }

    let activeRows = gate.height > 1 ? this.gateQubitRowsAtColumn(col, row, gate) : [];
    if (activeRows.length === gate.height) {
        // A multi-qubit gate may skip qubits that were cut before this column.
        // It must still be rejected if a cut occurs in a later column covered
        // by the gate, because that would make the operation span a dead wire.
        if (reason === "wire ended" && gate.height > 1 &&
                !gateCrossesLaterWireCut(this, col, row, gate)) {
            return undefined;
        }

        if (reason === "no\nremix\n(sorry)" && gate.width === 1) {
            let activeMask = 0;
            for (let r of activeRows) {
                if (r < this.numWires) {
                    activeMask |= 1 << r;
                }
            }
            let recomputed = new GateColumn(this.columns[col].gates).
                _disabledReason_remixing(row, this.colIsMeasuredMask(col) & activeMask);
            if (recomputed === undefined) {
                return undefined;
            }
        }

        if (reason === "control\ninside" && gate.width === 1) {
            for (let i = 1; i < activeRows.length; i++) {
                let otherGate = activeRows[i] < this.numWires ? this.columns[col].gates[activeRows[i]] : undefined;
                if (otherGate !== undefined && otherGate.isControl()) {
                    return reason;
                }
            }
            return undefined;
        }

        if (reason === "already\nmeasured" && gate === Gates.Special.BellMeasurement) {
            let measured = 0;
            for (let r of activeRows) {
                if (r < this.numWires) {
                    measured |= this.colIsMeasuredMask(col) & (1 << r);
                }
            }
            if (measured === 0) {
                return undefined;
            }
        }
    }

    return reason;
};

CircuitDefinition.prototype._applyOpsInCol = function(colIndex, ctx, opGetter) {
    if (colIndex < 0 || colIndex >= this.columns.length) {
        return;
    }
    let col = this.columns[colIndex];

    for (let row = 0; row < this.numWires; row++) {
        let gate = col.gates[row];
        if (gate === undefined || this.gateAtLocIsDisabledReason(colIndex, row) !== undefined) {
            continue;
        }

        let op = opGetter(gate);
        if (op !== undefined) {
            let qubitRows = this.gateQubitRowsAtColumn(colIndex, row, gate);
            if (qubitRows.length !== gate.height) {
                continue;
            }
            op(ctx.withRow(ctx.row + row).withQubitRows(qubitRows.map(r => ctx.row + r)));
        }
    }
};
