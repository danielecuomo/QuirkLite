/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {CircuitDefinition} from "./CircuitDefinition.js"
import {GateColumn} from "./GateColumn.js"
import {Gates} from "../gates/AllGates.js"

CircuitDefinition.prototype.gateQubitRowsAtColumn = function(col, row, gate) {
    if (gate === undefined || col < 0 || col >= this.columns.length || row < 0 || row >= this.numWires) {
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

const originalGateAtLocIsDisabledReason = CircuitDefinition.prototype.gateAtLocIsDisabledReason;
CircuitDefinition.prototype.gateAtLocIsDisabledReason = function(col, row) {
    let reason = originalGateAtLocIsDisabledReason.call(this, col, row);
    let gate = this.gateInSlot(col, row);
    if (gate === undefined) {
        return reason;
    }

    if (reason === "wire ended" && gate.height > 1 && gate.width === 1) {
        // A single-column multi-qubit operation skips terminated physical rows.
        // A gate spanning columns cannot do so because the cut changes the topology
        // while the operation is still in progress.
        if (this.gateQubitRowsAtColumn(col, row, gate).length === gate.height) {
            return undefined;
        }
    }

    if (reason === "no\nremix\n(sorry)" && gate.height > 1 && gate.width === 1) {
        // Re-run the measurement/coherence check using only the surviving rows.
        // This prevents a measured wire which was subsequently cut from disabling
        // an operation on the surviving qubits.
        let activeRows = this.gateQubitRowsAtColumn(col, row, gate);
        if (activeRows.length === gate.height) {
            let activeMask = 0;
            for (let r of activeRows) {
                activeMask |= 1 << r;
            }
            let recomputed = new GateColumn(this.columns[col].gates).
                _disabledReason_remixing(row, this.colIsMeasuredMask(col) & activeMask);
            if (recomputed === undefined) {
                return undefined;
            }
        }
    }

    if (reason === "already\nmeasured" && gate === Gates.Special.BellMeasurement) {
        // Bell measurement checks two physically adjacent rows internally. Recheck
        // it against the logical rows so a previously cut row is ignored.
        let activeRows = this.gateQubitRowsAtColumn(col, row, gate);
        if (activeRows.length === gate.height) {
            let measured = 0;
            for (let r of activeRows) {
                measured |= this.colIsMeasuredMask(col) & (1 << r);
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
