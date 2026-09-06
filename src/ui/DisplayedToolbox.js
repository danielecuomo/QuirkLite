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
        let maxRows = 1;
        for (let group of this.toolboxGroups) {
            let rows = DisplayedToolbox.isSingleColumnGroup(group) ? group.gates.length : Math.ceil(group.gates.length / 2);
            maxRows = Math.max(maxRows, rows);
        }
        return Config.TOOLBOX_MARGIN_Y*2 + maxRows*Config.TOOLBOX_GATE_SPAN + 20;
    }

    _paintStandardContents(painter) {
        for (let groupIndex = 0; groupIndex < this.toolboxGroups.length; groupIndex++) {
            this._paintGatesInGroup(painter, Hand.EMPTY, groupIndex);
        }

        let r = this.curArea(Config.TOOLBOX_MARGIN_X);
        let {x, y} = r.center();
        painter.ctx.save();
        painter.ctx.translate(x, y);
        painter.ctx.rotate(-Math.PI/2);
        painter.printLine(this.name, new Rect(-r.h / 2, -r.w / 2, r.h, r.w), 0.5, 'black', 24);
        painter.ctx.restore();
    }

    _paintGatesInGroup(painter, hand, groupIndex) {
        let group = this.toolboxGroups[groupIndex];
        let r = this.groupLabelRect(groupIndex);
        painter.print(
            group.hint,
            r.x + r.w/2,
            r.y + r.h/2,
            'center',
            'middle',
            'black',
            '16px sans-serif',
            r.w,
            r.h);

        let color = DisplayedToolbox.toolboxColorForGroup(group);
        for (let gateIndex = 0; gateIndex < group.gates.length; gateIndex++) {
            let gate = group.gates[gateIndex];
            if (gate === undefined) {
                continue;
            }
            let rect = this.gateDrawRect(groupIndex, gateIndex);
            DisplayedToolbox._paintGate(painter, hand, gate, rect, false, CircuitStats.EMPTY, color);
        }
    }

    static _paintGate(painter, hand, gate, rect, isHighlighted, stats, toolboxFillColor=undefined) {
        let drawer = gate.customDrawer || GatePainting.DEFAULT_DRAWER;
        painter.startIgnoringIncomingTouchBlockers();
        drawer(new GateDrawParams(
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
            toolboxFillColor));
        painter.stopIgnoringIncomingTouchBlockers();
    }

    paint(painter, stats, hand) {
        painter.fillRect(this.curArea(painter.canvas.width), Config.BACKGROUND_COLOR_TOOLBOX);
        this._standardApperance.paint(0, this.top, painter);
        this._paintDeviations(painter, stats, hand);
    }

    _paintDeviations(painter, stats, hand) {
        for (let groupIndex = 0; groupIndex < this.toolboxGroups.length; groupIndex++) {
            if (groupIndex >= this._originalGroups.length) {
                this._paintGatesInGroup(painter, hand, groupIndex);
            }

            let group = this.toolboxGroups[groupIndex];
            for (let gateIndex = 0; gateIndex < group.gates.length; gateIndex++) {
                if (group.gates[gateIndex] !== undefined) {
                    painter.noteTouchBlocker({
                        rect: this.gateDrawRect(groupIndex, gateIndex),
                        cursor: 'pointer'}
                    );
                }
            }
        }

        this._paintFocus(painter, stats, hand);
    }

    _paintFocus(painter, stats, hand) {
        let f = this.findGateAt(hand.pos);
        if (f === undefined || (hand.heldGate !== undefined && f.gate.symbol !== hand.heldGate.symbol)) {
            return;
        }

        DisplayedToolbox._paintGate(painter, hand, f.gate, f.rect, true, stats, Config.GATE_FILL_COLOR);

        painter.ctx.save();
        painter.ctx.globalAlpha = 0;
        painter.ctx.translate(-10000, -10000);
        let {maxW, maxH} = WidgetPainter.paintGateTooltip(
            painter, new Rect(0, 0, 500, 300), f.gate, stats.time, true);
        let mayNeedToScale = maxW >= 500 || maxH >= 300;
        painter.ctx.restore();

        let cx = f.rect.right() + 1;
        let hintRect = new Rect(cx, f.rect.center().y, maxW, maxH).
            snapInside(painter.paintableArea().skipRight(10).skipBottom(20));
        painter.defer(() => WidgetPainter.paintGateTooltip(painter, hintRect, f.gate, stats.time, mayNeedToScale));
    }

    stableDuration(hand) {
        return seq(hand.hoverPoints()).
            map(p => this.findGateAt(p)).
            filter(e => e !== undefined).
            map(e => e.gate.stableDuration()).
            min(Infinity);
    }

    tryGrab(hand) {
        if (hand.pos === undefined || hand.isBusy()) {
            return hand;
        }

        let f = this.findGateAt(hand.pos);
        if (f === undefined) {
            return hand;
        }

        if (f.gate.symbol === MysteryGateSymbol) {
            setTimeout(() => { this.toolboxGroups[f.groupIndex].gates[f.gateIndex] = MysteryGateMaker(); }, 0.1);
        }
        return hand.withHeldGate(f.gate, new Point(Config.GATE_RADIUS, Config.GATE_RADIUS));
    }
}

export {DisplayedToolbox}
