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
import {MathPainter} from "../draw/MathPainter.js"
import {Point} from "../math/Point.js"
import {Matrix} from "../math/Matrix.js"

function _paintBlochSphereDisplay_tooltips(
        painter,
        drawArea,
        x,
        y,
        z,
        focusPoints) {
    let c = drawArea.center();
    let u = Math.min(drawArea.w, drawArea.h) / 2;
    if (focusPoints.every(pt => pt.distanceTo(c) >= u)) {
        return;
    }

    const τ = Math.PI * 2;
    let deg = v => (v >= 0 ? '+' : '') + (v*360/τ).toFixed(2) + '°';
    let forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(4);
    let d = Math.sqrt(x*x + y*y + z*z);
    let ϕ = Math.atan2(y, -x);
    let θ = Math.max(0, Math.PI/2 - Math.atan2(-z, Math.sqrt(y*y + x*x)));
    painter.strokeCircle(c, u, 'orange', 2);
    MathPainter.paintDeferredValueTooltip(
        painter,
        c.x+u*Math.sqrt(0.5),
        c.y-u*Math.sqrt(0.5),
        'Bloch sphere representation of local state',
        `r:${forceSign(d)}, ϕ:${deg(ϕ)}, θ:${deg(θ)}`,
        `x:${forceSign(-x)}, y:${forceSign(y)}, z:${forceSign(-z)}`);
}

function _paintBlochSphereDisplay_indicator(
        painter,
        x,
        y,
        z,
        drawArea,
        fillColor) {
    let c = drawArea.center();
    let u = Math.min(drawArea.w, drawArea.h) / 2;
    let {dx, dy, dz} = MathPainter.coordinateSystem(u);

    let p = c.plus(dx.times(x)).plus(dy.times(y)).plus(dz.times(z));
    let r = 3.8 / (1 + x / 6);

    painter.strokeLine(c, p, 'black', 1.5);
    painter.fillCircle(p, r, fillColor);

    painter.ctx.save();
    painter.ctx.globalAlpha *= Math.min(1, Math.max(0, 1-x*x-y*y-z*z));
    painter.fillCircle(p, r, 'yellow');
    painter.ctx.restore();

    painter.strokeCircle(p, r, 'black');

    painter.ctx.save();
    painter.ctx.globalAlpha *= Math.min(1, Math.max(0, 0.5+x*5));
    painter.strokeLine(c, p, 'black', 2);
    painter.ctx.restore();
}

function paintBlochSphereDisplay(
        painter,
        qubitDensityMatrix,
        drawArea,
        focusPoints = [],
        backgroundColor = Config.DISPLAY_GATE_BACK_COLOR,
        fillColor = Config.DISPLAY_GATE_FORE_COLOR) {
    let c = drawArea.center();
    let u = Math.min(drawArea.w, drawArea.h) / 2;
    let {dx, dy, dz} = MathPainter.coordinateSystem(u);

    painter.fillCircle(c, u, backgroundColor);
    painter.trace(trace => {
        trace.circle(c.x, c.y, u);
        trace.ellipse(c.x, c.y, dy.x, dx.y);
        trace.ellipse(c.x, c.y, dx.x, dz.y);
        for (let d of [dx, dy, dz]) {
            trace.line(c.x - d.x, c.y - d.y, c.x + d.x, c.y + d.y);
        }
    }).thenStroke('#BBB');

    let [x, y, z] = [NaN, NaN, NaN];
    if (qubitDensityMatrix.hasNaN()) {
        painter.printParagraph("NaN", drawArea, new Point(0.5, 0.5), 'red');
    } else {
        [x, y, z] = qubitDensityMatrix.qubitDensityMatrixToBlochVector();
        _paintBlochSphereDisplay_indicator(painter, x, y, z, drawArea, fillColor);
    }

    _paintBlochSphereDisplay_tooltips(painter, drawArea, x, y, z, focusPoints);
}

// A fixed |+> state used only for the toolbox preview.
const TOOLBOX_BLOCH_STATE = new Matrix(2, 2, new Float64Array([
    0.5, 0, 0.5, 0,
    0.5, 0, 0.5, 0
]));

let BlochSphereDisplay = new GateBuilder().
    setSerializedIdAndSymbol("Bloch").
    setTitle("Bloch Sphere Display").
    setBlurb("Shows a wire's local state as a point on the Bloch Sphere.\nUse controls to see conditional states.").
    markAsDrawerNeedsSingleQubitDensityStats().
    setDrawer(args => {
        if (args.positionInCircuit === undefined) {
            GatePainting.paintBackground(args);
            GatePainting.paintOutline(args);
            paintBlochSphereDisplay(args.painter, TOOLBOX_BLOCH_STATE, args.rect);
            return;
        }
        let {row, col} = args.positionInCircuit;
        let ρ = args.stats.qubitDensityMatrix(col, row);
        paintBlochSphereDisplay(args.painter, ρ, args.rect, args.focusPoints);
    }).
    promiseHasNoNetEffectOnStateVector().
    setExtraDisableReasonFinder(args => args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined).
    gate;

export {paintBlochSphereDisplay, BlochSphereDisplay};
