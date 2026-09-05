/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {CircuitDefinition} from "./CircuitDefinition.js"
import {GateColumn} from "./GateColumn.js"
import {Gates} from "../gates/AllGates.js"
import {Config} from "../Config.js"

const originalActiveWireRowsAtColumn = CircuitDefinition.prototype.activeWireRowsAtColumn;
CircuitDefinition.prototype.activeWireRowsAtColumn = function(col) {
    let result = originalActiveWireRowsAtColumn.call(this, col);
    let physicalRow = this.numWires;
    while (result.length < this.numWires && physicalRow < Config.MAX_WIRE_COUNT) {
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

const originalFindGateCoveringSlot = CircuitDefinition.prototype.findGateCoveringSlot;
CircuitDefinition.prototype.findGateCoveringSlot = function(col, row) {
    if (col < 0 || row < 0 || col >= this.columns.length || row >= this.numWires) {
        return undefined;
    }
    for (let startRow = 0; startRow < this.numWires; startRow++) {
        let gate = this.columns[col].gates[startRow];
        if (gate === undefined || this.gateAtLocIsDisabledReason(col, startRow) !== undefined) {
            continue;
        }
        if (this.gateQubitRowsAtColumn(col, startRow, gate).indexOf(row) >= 0) {
            return {col, row: startRow, gate};
        }
    }
    return originalFindGateCoveringSlot.call(this, col, row);
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
    return Math.min(Config.MAX_WIRE_COUNT, result);
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

function gateHasLogicalRowOverlap(circuit, col, row, gate) {
    if (gate === undefined || gate.isWireCut || gate.isControl()) {
        return false;
    }
    let rows = circuit.gateQubitRowsAtColumn(col, row, gate);
    if (rows.length !== gate.height) {
        return false;
    }
    for (let otherRow = 0; otherRow < row; otherRow++) {
        let otherGate = circuit.columns[col].gates[otherRow];
        if (otherGate === undefined || otherGate.isWireCut || otherGate.isControl()) {
            continue;
        }
        let otherRows = circuit.gateQubitRowsAtColumn(col, otherRow, otherGate);
        for (let otherPhysicalRow of otherRows) {
            if (rows.indexOf(otherPhysicalRow) >= 0) {
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
        if (reason === "wire ended" && gate.height > 1 &&
                !gateCrossesLaterWireCut(this, col, row, gate)) {
            reason = undefined;
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
                reason = undefined;
            }
        }

        if (reason === "control\ninside" && gate.width === 1) {
            let hasControlInside = false;
            for (let i = 1; i < activeRows.length; i++) {
                let otherGate = activeRows[i] < this.numWires ? this.columns[col].gates[activeRows[i]] : undefined;
                if (otherGate !== undefined && otherGate.isControl()) {
                    hasControlInside = true;
                    break;
                }
            }
            if (!hasControlInside) {
                reason = undefined;
            }
        }

        if (reason === "already\nmeasured" && gate === Gates.Special.BellMeasurement) {
            let measured = 0;
            for (let r of activeRows) {
                if (r < this.numWires) {
                    measured |= this.colIsMeasuredMask(col) & (1 << r);
                }
            }
            if (measured === 0) {
                reason = undefined;
            }
        }
    }

    if (reason === undefined && gateHasLogicalRowOverlap(this, col, row, gate)) {
        return "overlapping";
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
