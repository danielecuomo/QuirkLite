/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0.
 */

import {Config} from "../Config.js"
import {GateBuilder} from "../circuit/Gate.js"
import {GatePainting} from "../draw/GatePainting.js"

/**
 * Draws a ground-style wire terminator.
 * @param {!GateDrawParams} args
 */
function drawWireCutGate(args) {
    if (args.isInToolbox || args.isHighlighted) {
        GatePainting.paintBackground(args);
        GatePainting.paintOutline(args);
    }

    let {x, y} = args.rect.center();
    let half = Math.min(args.rect.w, args.rect.h) * 0.32;
    // Mirror the original ground symbol horizontally (90 degrees clockwise),
    // with its horizontal stem aligned to the wire center.
    let p = (dx, dy) => [x + dy, y - dx];
    let a = p(0, -half * 0.8);
    let b = p(0, half * 0.05);
    let c = p(-half, half * 0.05);
    let d = p(half, half * 0.05);
    let e = p(-half * 0.68, half * 0.33);
    let f = p(half * 0.68, half * 0.33);
    let g = p(-half * 0.35, half * 0.61);
    let h = p(half * 0.35, half * 0.61);

    args.painter.trace(trace => {
        trace.line(...a, ...b);
        trace.line(...c, ...d);
        trace.line(...e, ...f);
        trace.line(...g, ...h);
    }).thenStroke('black', 2);
}

let WireCutGate = new GateBuilder().
    setSerializedIdAndSymbol("WireCut").
    setTitle("Wire Cut").
    setBlurb("Interrupts the wire. The wire does not continue after this point.").
    promiseHasNoNetEffectOnStateVector().
    markAsNotInterestedInControls().
    setDrawer(drawWireCutGate).
    gate;

// Display-only metadata used by CircuitDefinition/DisplayedCircuit to make the cut sticky.
WireCutGate.isWireCut = true;

export {WireCutGate}
