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

import {Config} from "../Config.js"
import {GateBuilder} from "../circuit/Gate.js"
import {GatePainting} from "../draw/GatePainting.js"
import {GateShaders} from "../circuit/GateShaders.js"
import {Matrix} from "../math/Matrix.js"

/**
 * @param {!GateDrawParams} args
 */
function drawMeasurementGate(args, axis) {
    let backColor = args.toolboxFillColor || '#F4D9D6';
    if (args.isHighlighted) {
        backColor = Config.HIGHLIGHTED_GATE_FILL_COLOR;
    }
    args.painter.fillRect(args.rect, backColor);
    GatePainting.paintOutline(args);

    const τ = Math.PI * 2;
    let r = args.rect.w*0.4;
    let {x, y} = args.rect.center();
    y += r*0.6;
    let a = -τ/6;
    let [c, s] = [Math.cos(a)*r*1.5, Math.sin(a)*r*1.5];
    let [p, q] = [x + c, y + s];

    // Draw the dial and shaft.
    args.painter.trace(trace => {
        trace.ctx.arc(x, y, r, τ/2, τ);
        trace.line(x, y, p, q);
    }).thenStroke('black');
    // Draw the indicator head.
    args.painter.trace(trace => trace.arrowHead(p, q, r*0.3, a, τ/4)).thenFill('black');
    let marker = axis === 'X' ? 'x' : 'z';
    args.painter.print(
        marker,
        args.rect.x + args.rect.w*0.16,
        args.rect.y + args.rect.h*0.16,
        'center', 'middle',
        'black',
        'bold 11px sans-serif',
        args.rect.w*0.35,
        args.rect.h*0.35);
}

let MeasurementGate = new GateBuilder().
    setSerializedIdAndSymbol("Measure").
    setTitle("Measurement Gate").
    setBlurb("Measures whether a qubit is ON or OFF, without conditioning on the result.").
    promiseHasNoNetEffectOnStateVector().  // Because in the simulation we defer measurement by preventing operations.
    setDrawer(args => drawMeasurementGate(args, "Z")).
    setExtraDisableReasonFinder(args => {
        if (args.isNested) {
            return "can't\nnest\nmeasure\n(sorry)";
        }
        let isMeasured = (args.measuredMask & (1<<args.outerRow)) !== 0;
        if (args.innerColumn.hasControl() && !isMeasured) {
            return "can't\ncontrol\n(sorry)";
        }
        return undefined;
    }).
    gate;

let XMeasurementGate = new GateBuilder().
    setSerializedIdAndSymbol("MeasureX").
    setSymbol("Measure^x").
    setTitle("X-Basis Measurement Gate").
    setBlurb("Applies a Hadamard, then measures the qubit in the Z basis (equivalent to measuring in the X basis).").
    setActualEffectToUpdateFunc(ctx => GateShaders.applyMatrixOperation(ctx, Matrix.HADAMARD)).
    setKnownEffectToMatrix(Matrix.HADAMARD).
    setDrawer(args => drawMeasurementGate(args, "X")).
    setExtraDisableReasonFinder(args => {
        if (args.isNested) {
            return "can't
nest
measure
(sorry)";
        }
        let isMeasured = (args.measuredMask & (1<<args.outerRow)) !== 0;
        if (args.innerColumn.hasControl() && !isMeasured) {
            return "can't
control
(sorry)";
        }
        return undefined;
    }).
    gate;

export {MeasurementGate, XMeasurementGate}
