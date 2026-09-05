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

import {WglConfiguredShader} from "../webgl/WglConfiguredShader.js"
import "./WireCutSupport.js"
import "./WireCutDisplaySupport.js"

/**
 * Values used by the various gate effects.
 *
 * The current state is stored *and updated* via the stateTrader field.
 */
class CircuitEvalContext {
    /**
     * @param {!number} time
     * @param {undefined|!int} qubitRow
     * @param {!int} wireCount
     * @param {!Controls} controls
     * @param {!WglTexture} controlsTexture
     * @param {!Controls} rawControls
     * @param {!WglTextureTrader} stateTrader
     * @param {!Map.<!string, *>} customContextFromGates
     * @param {undefined|!CircuitDefinition} circuitDefinition
     * @param {undefined|!int} col
     * @param {undefined|!Array.<!int>} qubitRows
     */
    constructor(time,
                qubitRow,
                wireCount,
                controls,
                controlsTexture,
                rawControls,
                stateTrader,
                customContextFromGates,
                circuitDefinition=undefined,
                col=undefined,
                qubitRows=undefined) {
        this.time = time;
        this.row = qubitRow;
        this.wireCount = wireCount;
        this.controls = controls;
        this.rawControls = rawControls;
        this.controlsTexture = controlsTexture;
        this.stateTrader = stateTrader;
        this.customContextFromGates = customContextFromGates;
        this.circuitDefinition = circuitDefinition;
        this.col = col;
        if (qubitRows === undefined && circuitDefinition !== undefined && col !== undefined &&
                circuitDefinition.gateQubitRowsAtColumn !== undefined) {
            let gate = circuitDefinition.gateInSlot(col, qubitRow);
            qubitRows = circuitDefinition.gateQubitRowsAtColumn(col, qubitRow, gate);
        }
        this.qubitRows = qubitRows;
    }

    /**
     * @param {!WglConfiguredShader|!function(!CircuitEvalContext) : !WglConfiguredShader} operation
     * @return {void}
     */
    applyOperation(operation) {
        let configuredShader = operation instanceof WglConfiguredShader ? operation : operation(this);
        this.stateTrader.shadeAndTrade(configuredShader);
    }

    _clone() {
        return new CircuitEvalContext(
            this.time,
            this.row,
            this.wireCount,
            this.controls,
            this.controlsTexture,
            this.rawControls,
            this.stateTrader,
            this.customContextFromGates,
            this.circuitDefinition,
            this.col,
            this.qubitRows);
    }

    withRow(row) {
        let r = this._clone();
        r.row = row;
        return r;
    }

    withQubitRows(qubitRows) {
        let r = this._clone();
        r.qubitRows = qubitRows;
        return r;
    }

    withInputSetToRange(letter, offset, length) {
        let r = this._clone();
        r.customContextFromGates = new Map(r.customContextFromGates);
        r.customContextFromGates.set(`Input Range ${letter}`, {offset, length});
        return r;
    }

    withInputSetToConstant(letter, value) {
        let r = this._clone();
        r.customContextFromGates = new Map(r.customContextFromGates);
        r.customContextFromGates.delete(`Input Range ${letter}`);
        r.customContextFromGates.set(`Input Default ${letter}`, value);
        return r;
    }

    withInputSetToOtherInput(letter, other) {
        let r = this._clone();
        r.customContextFromGates = new Map(r.customContextFromGates);
        for (let key of ['Range', 'Default']) {
            let otherVal = r.customContextFromGates.get(`Input ${key} ${other}`);
            if (otherVal !== undefined) {
                r.customContextFromGates.set(`Input ${key} ${letter}`, otherVal);
            } else {
                r.customContextFromGates.delete(`Input ${key} ${letter}`);
            }
        }
        return r;
    }
}

export {CircuitEvalContext}
