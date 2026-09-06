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

import {CachablePainting} from "../draw/CachablePainting.js"
import {CircuitStats} from "../circuit/CircuitStats.js"
import {Config} from "../Config.js"
import {GateDrawParams} from "../draw/GateDrawParams.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Hand} from "../ui/Hand.js"
import {MysteryGateSymbol, MysteryGateMaker} from "../gates/Joke_MysteryGate.js"
import {Rect} from "../math/Rect.js"
import {Point} from "../math/Point.js"
import {seq} from "../base/Seq.js"
import {WidgetPainter} from "../draw/WidgetPainter.js"

class DisplayedToolbox {
    static toolboxColorForGroup(group) {
        switch (group.hint) {
            case 'Probes': return '#F4D9D6';
            case 'Post-selection': return '#F4D9D6';
            case 'Displays': return '#DCEFE2';
            case 'Half Turns': return '#E5DDF3';
            case 'Quarter Turns': return '#DCEAF5';
            case 'Eighth Turns': return '#F3E1C9';
            case 'Formulaic': return '#F1EBCF';
            case 'Ising': return '#D9E8E8';
            case '3-qubit Ising': return '#F3E1C9';
            case 'Gadgets': return '#E3E3E3';
            default: return '#E3E3E3';
        }
    }

    static isSingleColumnGroup(group) {
        return group.hint === 'Probes' ||
            group.hint === 'Post-selection' ||
            group.hint === 'Displays' ||
            group.hint === 'Formulaic' ||
            group.hint === 'Ising' ||
            group.hint === '3-qubit Ising' ||
            group.hint === 'Gadgets';
    }

    constructor(
            name,
            top,
            toolboxGroups,
            labelsOnTop,
            originalGroups=undefined,
            standardAppearance=undefined) {
        this.name = name;
        this.top = top;
        this.toolboxGroups = toolboxGroups;
        this.labelsOnTop = labelsOnTop;
        this._originalGroups = originalGroups || this.toolboxGroups;
        this._standardApperance = standardAppearance || new CachablePainting(
            () => ({width: this.desiredWidth(), height: this.desiredHeight()}),
            painter => {
                painter.ctx.save();
                painter.ctx.translate(0, -this.top);
                this._paintStandardContents(painter);
                painter.ctx.restore();
            });

        this.groupHeight = 1;
        for (let group of toolboxGroups) {
            let h = Math.ceil(group.gates.length / 2);
            this.groupHeight = Math.max(this.groupHeight, h);
        }
    }

    withCustomGatesInserted(customGateSet) {
        if (this._originalGroups.length === 0) {
            return this;
        }
        let groups = [...this._originalGroups];
        for (let i = 0; i < Math.max(1, customGateSet.gates.length); i += this.groupHeight*2) {
            let group = {
                hint: 'Custom Gates',
                gates: [undefined, undefined, undefined, undefined, undefined, undefined]
            };
            for (let j = 0; j < this.groupHeight*2 && i + j < customGateSet.gates.length; j++) {
                group.gates[j] = customGateSet.gates[i + j];
            }
            groups.push(group);
        }
        return new DisplayedToolbox(
            this.name,
            this.top,
            groups,
            this.labelsOnTop,
            this._originalGroups,
            this._standardApperance);
    }

    gateDrawRect(groupIndex, gateIndex) {
        let group = this.toolboxGroups[groupIndex];
        let singleColumn = DisplayedToolbox.isSingleColumnGroup(group);
        let dx = singleColumn ? 0 : gateIndex % 2;
        let dy = singleColumn ? gateIndex : Math.floor(gateIndex / 2);

        let x = Config.TOOLBOX_MARGIN_X +
            dx * Config.TOOLBOX_GATE_SPAN +
            groupIndex * Config.TOOLBOX_GROUP_SPAN;
        let y = this.top +
            (this.labelsOnTop ? Config.TOOLBOX_MARGIN_Y : 3) +
            dy * Config.TOOLBOX_GATE_SPAN;

        return new Rect(
            Math.round(x - 0.5) + 0.5,
            Math.round(y - 0.5) + 0.5,
            Config.GATE_RADIUS * 2,
            Config.GATE_RADIUS * 2);
    }

    groupLabelRect(groupIndex) {
        if (this.labelsOnTop) {
            let r = this.gateDrawRect(groupIndex, 0);
            let c = new Point(r.x + Config.TOOLBOX_GATE_SPAN - Config.TOOLBOX_GATE_SPACING / 2, r.y - 18);
            return new Rect(c.x - Config.TOOLBOX_GATE_SPAN, c.y, Config.TOOLBOX_GATE_SPAN * 2, 20);
        }

        let group = this.toolboxGroups[groupIndex];
        let lastGateIndex = DisplayedToolbox.isSingleColumnGroup(group) ? group.gates.length - 1 : this.groupHeight*2 - 2;
        let r = this.gateDrawRect(groupIndex, lastGateIndex);
        let c = new Point(r.x + Config.TOOLBOX_GATE_SPAN - Config.TOOLBOX_GATE_SPACING / 2, r.bottom());
        return new Rect(c.x - Config.TOOLBOX_GATE_SPAN, c.y+2, Config.TOOLBOX_GATE_SPAN * 2, 20);
    }

    curArea(maxWidth) {
        return new Rect(0, this.top, maxWidth, this.desiredHeight());
    }

    findGateAt(pt) {
        if (pt === undefined) {
            return undefined;
        }
        for (let groupIndex = 0; groupIndex < this.toolboxGroups.length; groupIndex++) {
            let group = this.toolboxGroups[groupIndex];
            for (let gateIndex = 0; gateIndex < group.gates.length; gateIndex++) {
                let gate = group.gates[gateIndex];
                let rect = this.gateDrawRect(groupIndex, gateIndex);
                if (gate !== undefined && rect.containsPoint(pt)) {
                    return {groupIndex, gateIndex, gate, rect};
                }
            }
        }
        return undefined;
    }

    isEqualTo(other) {
        return other instanceof DisplayedToolbox &&
            this.name === other.name &&
            this.top === other.top &&
            this.toolboxGroups === other.toolboxGroups &&
            this.labelsOnTop === other.labelsOnTop;
    }

    withTop(newTop) {
        return new DisplayedToolbox(
            this.name,
            newTop,
            this.toolboxGroups,
            this.labelsOnTop,
            this._originalGroups,
            this._standardApperance);
    }

    desiredWidth() {
        return this.gateDrawRect(this.toolboxGroups.length - 1, 5).right() + 5;
    }

    desiredHeight() {
        let maxGates = this.toolboxGroups.map(g => g.gates.length).max();
        return Config.TOOLBOX_MARGIN_Y*2 + Math.max(this.groupHeight, maxGates)*Config.TOOLBOX_GATE_SPAN + 20;
    }

    paint(painter, stats, hand) {
        this._standardApperance.paint(painter);
        if (hand !== undefined) {
            this._paintFocus(painter, stats, hand);
        }
    }

    _paintStandardContents(painter) {
        let stats = new CircuitStats();
        let hand = new Hand();
        this._paintGatesInGroups(painter, stats, hand);
        this._paintTitle(painter);
    }

    _paintGatesInGroups(painter, stats, hand) {
        for (let groupIndex = 0; groupIndex < this.toolboxGroups.length; groupIndex++) {
            let group = this.toolboxGroups[groupIndex];
            for (let gateIndex = 0; gateIndex < group.gates.length; gateIndex++) {
                let gate = group.gates[gateIndex];
                if (gate !== undefined) {
                    this._paintGate(painter, stats, hand, gate, groupIndex, gateIndex);
                }
            }
        }
    }

    _paintGate(painter, stats, hand, gate, groupIndex, gateIndex) {
        let rect = this.gateDrawRect(groupIndex, gateIndex);
        let group = this.toolboxGroups[groupIndex];
        let toolboxFillColor = DisplayedToolbox.toolboxColorForGroup(group);
        let isHighlighted = hand.heldGate === gate;
        let args = new GateDrawParams(
            painter,
            hand,
            true,
            isHighlighted,
            false,
            false,
            rect,
            gate,
            stats,
            undefined,
            [],
            undefined,
            toolboxFillColor);
        GatePainting.paintGate(args);
    }

    _paintTitle(painter) {
        let x = this.curArea(painter.width()).center().x;
        let y = this.top + 8;
        painter.print(this.name, x, y, 'center', 'middle', 'black', 'bold 13px sans-serif');
    }

    _paintFocus(painter, stats, hand) {
        if (hand.heldGate !== undefined) {
            let g = this.findGateAt(hand.pos);
            if (g !== undefined) {
                let rect = g.rect;
                let group = this.toolboxGroups[g.groupIndex];
                let isHighlighted = hand.heldGate === g.gate;
                let args = new GateDrawParams(
                    painter,
                    hand,
                    true,
                    isHighlighted,
                    false,
                    false,
                    rect,
                    g.gate,
                    stats,
                    undefined,
                    [],
                    undefined,
                    DisplayedToolbox.toolboxColorForGroup(group));
                GatePainting.paintGate(args);
            }
        }
    }

    stableDuration(hand) {
        return hand.heldGate === undefined ? 0 : 0.2;
    }

    tryGrab(hand) {
        let hit = this.findGateAt(hand.pos);
        if (hit === undefined) {
            return false;
        }
        hand.heldGate = hit.gate;
        hand.holdOffset = new Point(hand.pos.x - hit.rect.x, hand.pos.y - hit.rect.y);
        hand.heldColumn = hit.groupIndex;
        hand.heldRow = hit.gateIndex;
        return true;
    }
}

export {DisplayedToolbox}
