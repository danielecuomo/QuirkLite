/* Copyright 2017 Google Inc. Licensed under the Apache License, Version 2.0. */
// It's important that the polyfills and error fallback get loaded first!
import {} from "./browser/Polyfills.js"
import {hookErrorHandler} from "./fallback.js"
hookErrorHandler();
import {doDetectIssues} from "./issues.js"
doDetectIssues();

import {CircuitStats} from "./circuit/CircuitStats.js"
import {CooldownThrottle} from "./base/CooldownThrottle.js"
import {Config} from "./Config.js"
import {DisplayedInspector} from "./ui/DisplayedInspector.js"
import {Painter} from "./draw/Painter.js"
import {Rect} from "./math/Rect.js"
import {RestartableRng} from "./base/RestartableRng.js"
import {Revision} from "./base/Revision.js"
import {initSerializer, fromJsonText_CircuitDefinition} from "./circuit/Serializer.js"
import {TouchScrollBlocker} from "./browser/TouchScrollBlocker.js"
import {Util} from "./base/Util.js"
import {initializedWglContext} from "./webgl/WglContext.js"
import {watchDrags, isMiddleClicking, eventPosRelativeTo} from "./browser/MouseWatcher.js"
import {ObservableValue, ObservableSource} from "./base/Obs.js"
import {initExports, obsExportsIsShowing} from "./ui/exports.js"
import {initMenu, obsMenuIsShowing, closeMenu} from "./ui/menu.js"
import {initUndoRedo} from "./ui/undo.js"
import {initClear} from "./ui/clear.js"
import {initUrlCircuitSync} from "./ui/url.js"
import {initTitleSync} from "./ui/title.js"
import {simulate} from "./ui/sim.js"
import {GatePainting} from "./draw/GatePainting.js"
import {GATE_CIRCUIT_DRAWER} from "./ui/DisplayedCircuit.js"
import {GateColumn} from "./circuit/GateColumn.js";
import {Point} from "./math/Point.js";
initSerializer(
    GatePainting.LABEL_DRAWER,
    GatePainting.MATRIX_DRAWER,
    GATE_CIRCUIT_DRAWER,
    GatePainting.LOCATION_INDEPENDENT_GATE_DRAWER);

// Quirk was originally desktop-first and its HTML does not declare a mobile
// viewport. Without this declaration, iOS Safari can use a virtual layout
// viewport (commonly around 980 CSS px) and visually scale the whole page down.
// The circuit then draws in the larger layout coordinate system while touch
// events are delivered in the visible viewport coordinate system, producing a
// pointer-to-gate offset. Install the standard mobile viewport before measuring
// the canvas so all subsequent geometry uses the same CSS coordinate system.
if (!document.querySelector('meta[name="viewport"]')) {
    let viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(viewportMeta);
}

// QuirkLite is intended to be viewed at approximately 150% by default.
// Use a visual transform instead of CSS zoom because Safari/WebKit has had
// coordinate inconsistencies with getBoundingClientRect() under CSS zoom.
const QUIRKLITE_DEFAULT_ZOOM = 1.5;
document.documentElement.style.transformOrigin = "0 0";
document.documentElement.style.transform = "scale(" + QUIRKLITE_DEFAULT_ZOOM + ")";
window.quirkLiteZoom = QUIRKLITE_DEFAULT_ZOOM;

const canvasDiv = document.getElementById("canvasDiv");
/** @type {!HTMLCanvasElement} */
const canvas = document.getElementById("drawCanvas");
if (!canvas) throw new Error("Couldn't find 'drawCanvas'");
canvas.width = canvasDiv.clientWidth;
canvas.height = window.innerHeight*0.9;
let haveLoaded = false;
const semiStableRng = (() => {
    const target = {cur: new RestartableRng()};
    let cycleRng;
    cycleRng = () => {
        target.cur = new RestartableRng();
        setTimeout(cycleRng, Config.SEMI_STABLE_RANDOM_VALUE_LIFETIME_MILLIS*0.99);
    };
    cycleRng();
    return target;
})();
const inspectorDiv = document.getElementById("inspectorDiv");
const displayed = new ObservableValue(
    DisplayedInspector.empty(new Rect(0, 0, canvas.clientWidth, canvas.clientHeight)));
const mostRecentStats = new ObservableValue(CircuitStats.EMPTY);
let revision = Revision.startingAt(displayed.get().snapshot());
revision.latestActiveCommit().subscribe(jsonText => {
    let circuitDef = fromJsonText_CircuitDefinition(jsonText).withMinimumWireCount();
    let newInspector = displayed.get().withCircuitDefinition(circuitDef);
    displayed.set(newInspector);
});
let desiredCanvasSizeFor = curInspector => ({
    w: Math.max(canvasDiv.clientWidth, curInspector.desiredWidth()),
    h: curInspector.desiredHeight()
});
const syncArea = ins => {
    let size = desiredCanvasSizeFor(ins);
    ins.updateArea(new Rect(0, 0, size.w, size.h));
    return ins;
};
displayed.observable().
    map(e => e.displayedCircuit.circuitDefinition).
    whenDifferent(Util.CUSTOM_IS_EQUAL_TO_EQUALITY).
    subscribe(() => {
        let errDivStyle = document.getElementById('error-div').style;
        errDivStyle.opacity *= 0.9;
        if (errDivStyle.opacity < 0.06) errDivStyle.display = 'None'
    });
let redrawThrottle;
const scrollBlocker = new TouchScrollBlocker(canvasDiv);
const redrawNow = () => {
    if (!haveLoaded) return;
    let shown = syncArea(displayed.get()).previewDrop();
    if (displayed.get().hand.isHoldingSomething() && !shown.hand.isHoldingSomething()) {
        shown = shown.withHand(shown.hand.withHeldGateColumn(new GateColumn([]), new Point(0, 0)))
    }
    let stats = simulate(shown.displayedCircuit.circuitDefinition);
    mostRecentStats.set(stats);
    let size = desiredCanvasSizeFor(shown);
    canvas.logicalWidth = size.w;
    canvas.logicalHeight = size.h;
    let painter = new Painter(canvas, semiStableRng.cur.restarted());
    shown.updateArea(painter.paintableArea());
    shown.paint(painter, stats);
    painter.paintDeferred();
    displayed.get().hand.paintCursor(painter);
    scrollBlocker.setBlockers(painter.touchBlockers, painter.desiredCursorStyle);
    canvas.style.cursor = painter.desiredCursorStyle || 'auto';
    let dt = displayed.get().stableDuration();
    if (dt < Infinity) window.requestAnimationFrame(() => redrawThrottle.trigger());
};
redrawThrottle = new CooldownThrottle(redrawNow, Config.REDRAW_COOLDOWN_MILLIS, 0.1, true);
window.addEventListener('resize', () => redrawThrottle.trigger(), false);
displayed.observable().subscribe(() => redrawThrottle.trigger());
let clickDownGateButtonKey = undefined;
canvasDiv.addEventListener('click', ev => {
    let pt = eventPosRelativeTo(ev, canvasDiv);
    let curInspector = displayed.get();
    if (curInspector.tryGetHandOverButtonKey() !== clickDownGateButtonKey) return;
    let clicked = syncArea(curInspector.withHand(curInspector.hand.withPos(pt))).tryClick();
    if (clicked !== undefined) revision.commit(clicked.afterTidyingUp().snapshot());
});
watchDrags(canvasDiv,
    (pt, ev) => {
        let oldInspector = displayed.get();
        let newHand = oldInspector.hand.withPos(pt);
        let newInspector = syncArea(oldInspector.withHand(newHand));
        clickDownGateButtonKey = (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey ? undefined : newInspector.tryGetHandOverButtonKey());
        if (clickDownGateButtonKey !== undefined) { displayed.set(newInspector); return; }
        newInspector = newInspector.afterGrabbing(ev.shiftKey, ev.ctrlKey || ev.metaKey);
        if (displayed.get().isEqualTo(newInspector) || !newInspector.hand.isBusy()) return;
        revision.startedWorkingOnCommit();
        displayed.set(syncArea(oldInspector.withHand(newHand).withJustEnoughWires(newInspector.hand, 1)).afterGrabbing(ev.shiftKey, ev.ctrlKey || ev.metaKey, false, ev.altKey));
        ev.preventDefault();
    },
    ev => { revision.cancelCommitBeingWorkedOn(); ev.preventDefault(); },
    (pt, ev) => {
        if (!displayed.get().hand.isBusy()) return;
        let newHand = displayed.get().hand.withPos(pt);
        displayed.set(displayed.get().withHand(newHand));
        ev.preventDefault();
    },
    (pt, ev) => {
        if (!displayed.get().hand.isBusy()) return;
        let newHand = displayed.get().hand.withPos(pt);
        let newInspector = syncArea(displayed.get()).withHand(newHand).afterDropping().afterTidyingUp();
        let clearHand = newInspector.hand.withPos(undefined);
        let clearInspector = newInspector.withJustEnoughWires(clearHand, 0);
        revision.commit(clearInspector.snapshot());
        ev.preventDefault();
    });
canvasDiv.addEventListener('mousedown', ev => {
    if (!isMiddleClicking(ev)) return;
    let cur = syncArea(displayed.get());
    let initOver = cur.tryGetHandOverButtonKey();
    let newHand = cur.withHand(cur.hand.withPos(eventPosRelativeTo(ev, canvas))).hand;
    let newInspector;
    if (initOver !== undefined && initOver.startsWith('wire-init-')) {
        let newCircuit = cur.displayedCircuit.circuitDefinition.withSwitchedInitialStateOn(parseInt(initOver.substr(10)), 0);
        newInspector = cur.withCircuitDefinition(newCircuit).withHand(newHand).afterTidyingUp();
    } else {
        newInspector = cur.withHand(newHand).afterGrabbing(false, false, true, false).withHand(newHand).afterTidyingUp().withJustEnoughWires(newHand, 0);
    }
    if (!displayed.get().isEqualTo(newInspector)) { revision.commit(newInspector.snapshot()); ev.preventDefault(); }
});
canvasDiv.addEventListener('mousemove', ev => {
    if (!displayed.get().hand.isBusy()) {
        let newHand = displayed.get().hand.withPos(eventPosRelativeTo(ev, canvas));
        displayed.set(displayed.get().withHand(newHand));
    }
});
canvasDiv.addEventListener('mouseleave', () => {
    if (!displayed.get().hand.isBusy()) {
        let newHand = displayed.get().hand.withPos(undefined);
        displayed.set(displayed.get().withHand(newHand));
    }
});
let obsIsAnyOverlayShowing = new ObservableSource();
initUrlCircuitSync(revision);
initExports(revision, mostRecentStats, obsIsAnyOverlayShowing.observable());
initUndoRedo(revision, obsIsAnyOverlayShowing.observable());
initClear(revision, obsIsAnyOverlayShowing.observable());
initMenu(revision, obsIsAnyOverlayShowing.observable());
initTitleSync(revision);
obsExportsIsShowing.
    zipLatest(obsMenuIsShowing, (e1, e2) => e1 || e2).
    whenDifferent().
    subscribe(e => {
        obsIsAnyOverlayShowing.send(e);
        canvasDiv.tabIndex = e ? -1 : 0;
    });
haveLoaded = true;
setTimeout(() => {
    inspectorDiv.style.display = 'block';
    redrawNow();
    document.getElementById("loading-div").style.display = 'none';
    document.getElementById("close-menu-button").style.display = 'block';
    if (!displayed.get().displayedCircuit.circuitDefinition.isEmpty()) closeMenu();
    try {
        initializedWglContext().onContextRestored = () => redrawThrottle.trigger();
    } catch (ex) { console.error(ex); }
}, 0);