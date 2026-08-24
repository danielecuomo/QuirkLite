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

import {CircuitDefinition} from "../circuit/CircuitDefinition.js"
import {CircuitStats} from "../circuit/CircuitStats.js"
import {Config} from "../Config.js"
import {DisplayedCircuit} from "../ui/DisplayedCircuit.js"
import {DisplayedToolbox} from "../ui/DisplayedToolbox.js"
import {GateDrawParams} from "../draw/GateDrawParams.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Gates} from "../gates/AllGates.js"
import {Hand} from "../ui/Hand.js"
import {Painter} from "../draw/Painter.js"
import {Rect} from "../math/Rect.js"
import {Serializer} from "../circuit/Serializer.js"

class DisplayedInspector {
    /**
     * @param {!Rect} drawArea
     * @param {!DisplayedCircuit} circuitWidget
     * @param {!DisplayedToolbox} displayedToolboxTop
     * @param {!Hand} hand
     */
    constructor(drawArea, circuitWidget, displayedToolboxTop, hand) {
        /** @type {!DisplayedCircuit} */
        this.displayedCircuit = circuitWidget;
        /** @type {!DisplayedToolbox} */
        this.displayedToolboxTop = displayedToolboxTop;
        /** @type {!Hand} */
        this.hand = hand;
        /** @type {!Rect} */
        this.drawArea = new Rect(0, 0, 0, 0);

        this.updateArea(drawArea);
    }

    desiredWidth() {
        return Math.max(
            this.displayedToolboxTop.desiredWidth(),
            this.displayedCircuit.desiredWidth());
    }

    /**
     * @param {!Rect} drawArea
     */
    updateArea(drawArea) {
        this.drawArea = drawArea;

        this.displayedToolboxTop = this.displayedToolboxTop.withTop(0);
    }

    /**
     * @param {!Rect} drawArea
     * @returns {!DisplayedInspector}
     */
    static empty(drawArea) {
        let topToolbox = new DisplayedToolbox('Toolbox', 0, Gates.TopToolboxGroups, true);
        let displayedCircuit = DisplayedCircuit.empty(topToolbox.desiredHeight());
        return new DisplayedInspector(
            drawArea,
            displayedCircuit,
            topToolbox,
            Hand.EMPTY);
    }

    /**
     * @param {!Painter} painter
     * @param {!CircuitStats} stats
     */
    paint(painter, stats) {
        painter.fillRect(this.drawArea, Config.BACKGROUND_COLOR);

        this.displayedToolboxTop.paint(painter, stats, this.hand);
        this.displayedCircuit.paint(painter, this.hand, stats);
        this._paintHand(painter, stats);
    }

    /**
     * @param {!Painter} painter
     * @param {!CircuitStats} stats
     * @private
     */
    _paintHand(painter, stats) {
        if (this.hand.pos === undefined || this.hand.heldGate === undefined) {
            return;
        }

        let gate = this.hand.heldGate;
        let pos = this.hand.pos.minus(this.hand.holdOffset);
        let rect = new Rect(
            Math.round(pos.x - 0.5) + 0.5,
            Math.round(pos.y - 0.5) + 0.5,
            Config.GATE_RADIUS*2 + Config.WIRE_SPACING*(gate.width-1),
            Config.GATE_RADIUS*2 + Config.WIRE_SPACING*(gate.height-1));
        let drawer = gate.customDrawer || GatePainting.DEFAULT_DRAWER;
        drawer(new GateDrawParams(
            painter,
            this.hand,
            false,
            true,
            true,
            false,
            rect,
            gate,
            stats,
            undefined,
            [],
            undefined));
    }

    /**
     * @returns {undefined|!string}
     */
    tryGetHandOverButtonKey() {
        if (this.hand.pos === undefined) {
            return undefined;
        }
        let butBos = this.displayedCircuit.findGateWithButtonContaining(this.hand.pos);
        if (butBos !== undefined) {
            return `gate-button-${butBos.col}:${butBos.row}`;
        }
        let initPos = this.displayedCircuit.findWireWithInitialStateAreaContaining(this.hand.pos);
        if (initPos !== undefined) {
            return `wire-init-${initPos}`;
        }
        return undefined;
    }

    /**
     * @returns {undefined|!DisplayedInspector}
     */
    tryClick() {
        let newDisplayedCircuit = this.displayedCircuit.tryClick(this.hand);
        return newDisplayedCircuit === undefined ? undefined : this.withDisplayedCircuit(newDisplayedCircuit);
    }

    /**
     * @param {!boolean=false} duplicate
     * @param {!boolean=false} wholeCol
     * @param {!boolean=false} ignoreResizeTabs
     * @param {!boolean=false} alt
     * @returns {!DisplayedInspector}
     */
    afterGrabbing(duplicate=false, wholeCol=false, ignoreResizeTabs=false, alt=false) {
        let hand = this.hand;
        let circuit = this.displayedCircuit;

        hand = this.displayedToolboxTop.tryGrab(hand);
        let obj = circuit.tryGrab(hand, duplicate, wholeCol, ignoreResizeTabs, alt);
        hand = obj.newHand;
        circuit = obj.newCircuit;

        return new DisplayedInspector(
            this.drawArea,
            circuit,
            this.displayedToolboxTop,
            hand);
    }

    /**
     * @param {!DisplayedInspector|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (this === other) {
            return true;
        }
        //noinspection JSUnresolvedVariable
        return other instanceof DisplayedInspector &&
            this.drawArea.isEqualTo(other.drawArea) &&
            this.displayedCircuit.isEqualTo(other.displayedCircuit) &&
            this.displayedToolboxTop.isEqualTo(other.displayedToolboxTop) &&
            this.hand.isEqualTo(other.hand);
    }

    /**
     * @param {!DisplayedCircuit} displayedCircuit
     * @returns {!DisplayedInspector}
     */
    withDisplayedCircuit(displayedCircuit) {
        if (displayedCircuit === this.displayedCircuit) {
            return this;
        }
        return new DisplayedInspector(
            this.drawArea,
            displayedCircuit,
            this.displayedToolboxTop,
            this.hand);
    }

    /**
     * @param {!Hand} hand
     * @param {!int} extraWires
     * @returns {!DisplayedInspector}
     */
    withJustEnoughWires(hand, extraWires) {
        return this.withDisplayedCircuit(this.displayedCircuit.withJustEnoughWires(hand, extraWires));
    }

    /**
    * @returns {!DisplayedInspector}
    */
    afterTidyingUp() {
        return this.withDisplayedCircuit(this.displayedCircuit.afterTidyingUp());
    }

    /**
     * @returns {!DisplayedInspector}
     */
    previewDrop() {
        if (!this.hand.isBusy()) {
            return this;
        }

        let hand = this.hand;
        let circuitWidget = this.displayedCircuit;
        let previewCircuit = circuitWidget.previewDrop(hand);
        let previewHand = previewCircuit === circuitWidget ? hand : hand.withDrop();
        return this.withHand(previewHand).withDisplayedCircuit(previewCircuit);
    }

    /**
     * @returns {!DisplayedInspector}
     */
    afterDropping() {
        return this.
            withDisplayedCircuit(this.displayedCircuit.afterDropping(this.hand)).
            withHand(this.hand.withDrop());
    }

    /**
     * @returns {Infinity|!number}
     */
    stableDuration() {
        return Math.min(
            this.displayedToolboxTop.stableDuration(this.hand),
            this.hand.stableDuration(),
            this.displayedCircuit.stableDuration());
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedInspector}
     */
    withHand(hand) {
        return new DisplayedInspector(
            this.drawArea,
            this.displayedCircuit,
            this.displayedToolboxTop,
            hand);
    }

    /**
     * @param {!CircuitDefinition} newCircuitDefinition
     * @returns {!DisplayedInspector}
     */
    withCircuitDefinition(newCircuitDefinition) {
        return new DisplayedInspector(
            this.drawArea,
            DisplayedCircuit.empty(this.displayedToolboxTop.desiredHeight()).withCircuit(newCircuitDefinition),
            this.displayedToolboxTop,
            this.hand.withDrop());
    }

    /**
     * @returns {!number}
     */
    desiredHeight() {
        let minimumDesired =
            this.displayedToolboxTop.desiredHeight() +
            this.displayedCircuit.desiredHeight();
        return Math.max(Config.MINIMUM_CANVAS_HEIGHT, minimumDesired);
    }

    /**
     * @returns {!string}
     */
    snapshot() {
        return JSON.stringify(Serializer.toJson(this.displayedCircuit.circuitDefinition), null, 0);
    }
}

export {DisplayedInspector}
