/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {CircuitDefinition} from "./CircuitDefinition.js"

/**
 * Returns the physical rows occupied by a logical multi-qubit gate after
 * skipping wires which were cut before the gate's column.
 */
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
    if (reason !== "wire ended") {
        return reason;
    }

    let gate = this.gateInSlot(col, row);
    if (gate === undefined || gate.height <= 1 || gate.width !== 1) {
        return reason;
    }

    // A single-column multi-qubit operation may skip terminated physical rows.
    // A gate spanning columns cannot do so because the cut changes the topology
    // while the operation is still in progress.
    return this.gateQubitRowsAtColumn(col, row, gate).length === gate.height ? undefined : reason;
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
