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

import {Point} from "../math/Point.js"

const ALLOW_REGRAB_WATCHDOG_TIME_MS = 5000;
const MOUSE_ID = "mouse!";

/**
 * @param {!TouchEvent|!MouseEvent} ev
 * @returns {!boolean}
 */
let isLeftClicking = ev => (window.TouchEvent !== undefined && ev instanceof TouchEvent) || ev.which === 1;

/**
 * @param {!MouseEvent} ev
 * @returns {!boolean}
 */
let isMiddleClicking = ev => ev.which === 2;

/**
 * @param {!MouseEvent|!Touch} ev
 * @param {!HTMLElement} element
 * @returns {!Point}
 */
function eventPosRelativeTo(ev, element) {
    let b = element.getBoundingClientRect();

    // Mobile Safari has a separate visual viewport when the page is zoomed or
    // panned. Compensate for the visual viewport offset when it is available.
    let viewport = window.visualViewport;
    let offsetX = viewport === undefined ? 0 : viewport.offsetLeft;
    let offsetY = viewport === undefined ? 0 : viewport.offsetTop;

    // The whole document is visually scaled by QuirkLite's default 150% zoom.
    // Convert viewport coordinates back into the circuit's logical coordinates.
    let zoom = window.quirkLiteZoom === undefined ? 1 : window.quirkLiteZoom;
    return new Point(
        (ev.clientX + offsetX - b.left) / zoom,
        (ev.clientY + offsetY - b.top) / zoom);
}

/**
 * @param {!HTMLElement} element
 * @param {!function(!Point, !MouseEvent|!TouchEvent) : void} grabHandler
 * @param {!function(!MouseEvent|!TouchEvent) : void} cancelHandler
 * @param {!function(undefined|!Point, !MouseEvent|!TouchEvent) : void} dragHandler
 * @param {!function(undefined|!Point, !MouseEvent|!TouchEvent) : void} dropHandler
 * @returns {!function() : void} Call this to dispose the watcher (removing any global callbacks it added).
 */
function watchDrags(element, grabHandler, cancelHandler, dragHandler, dropHandler) {
    return new DragWatcher(element, grabHandler, cancelHandler, dragHandler, dropHandler)
        .addListenersUntilResultInvoked();
}

/**
 * @param {!EventTarget} target
 * @param {!string} type
 * @param {!EventListener|!Function} listener
 * @returns {!function() : void}
 */
let addListenerUntilResultInvoked = (target, type, listener) => {
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
};

class DragWatcher {
    constructor(element, grabHandler, cancelHandler, dragHandler, dropHandler) {
        this._element = element;
        this._grabHandler = grabHandler;
        this._cancelHandler = cancelHandler;
        this._dragHandler = dragHandler;
        this._dropHandler = dropHandler;
        this._grabPointerId = undefined;
        this._grabActivityTime = window.performance.now();
        this._lastPos = undefined;
        this._lastEv = undefined;

        // The circuit is an application-managed drag surface. Prevent Safari
        // from turning a one-finger drag into page scrolling or pinch-zooming.
        // This is especially important on iPad/iPhone where the browser can
        // otherwise take over the gesture before the application receives the
        // complete drag sequence.
        this._element.style.touchAction = 'none';
        this._element.style.webkitUserSelect = 'none';
        this._element.style.userSelect = 'none';
    }

    addListenersUntilResultInvoked() {
        let e = this._element;
        let unregCalls = [
            addListenerUntilResultInvoked(e, 'mousedown', ev => this.handleMouseEventWith(ev, this.onDown)),
            addListenerUntilResultInvoked(document, 'mousemove', ev => this.handleMouseEventWith(ev, this.onMove)),
            addListenerUntilResultInvoked(document, 'mouseup', ev => this.handleMouseEventWith(ev, this.onUp)),
            addListenerUntilResultInvoked(document, 'mouseleave', ev => this.handleMouseEventWith(ev, this.onLeave)),
            addListenerUntilResultInvoked(document, 'mouseenter', ev => this.handleMouseEventWith(ev, this.onEnter)),
            addListenerUntilResultInvoked(e, 'touchstart', ev => this.handleTouchEventWith(ev, this.onDown)),
            addListenerUntilResultInvoked(e, 'touchmove', ev => this.handleTouchEventWith(ev, this.onMove)),
            addListenerUntilResultInvoked(e, 'touchend', ev => this.handleTouchEventWith(ev, this.onUp)),
            addListenerUntilResultInvoked(e, 'touchcancel', ev => this.handleTouchEventWith(ev, this.onCancel))
        ];
        return () => {
            for (let unregCall of unregCalls) unregCall();
        }
    }

    canRegrab() {
        return window.performance.now() >= this._grabActivityTime + ALLOW_REGRAB_WATCHDOG_TIME_MS;
    }

    onDown(pt, id, ev) {
        if (!isLeftClicking(ev)) return;
        if (this._grabPointerId !== undefined) {
            if (!this.canRegrab()) return;
            this._dropHandler(this._lastPos, this._lastEv);
        }
        this._grabPointerId = id;
        this._grabActivityTime = window.performance.now();
        this._lastPos = pt;
        this._lastEv = ev;
        this._grabHandler(pt, ev);
    }

    onMove(pt, id, ev) {
        if (this._grabPointerId !== id) return;
        if (!isLeftClicking(ev)) {
            this._lastPos = undefined;
            this._lastEv = undefined;
            this._grabPointerId = undefined;
            this._dropHandler(undefined, ev);
            return;
        }
        this._grabActivityTime = window.performance.now();
        this._lastPos = pt;
        this._lastEv = ev;
        this._dragHandler(pt, ev);
    }

    onCancel(pt, id, ev) {
        if (this._grabPointerId !== id) return;
        this._lastPos = undefined;
        this._lastEv = undefined;
        this._grabPointerId = undefined;
        this._cancelHandler(ev);
    }

    onUp(pt, id, ev) {
        if (!isLeftClicking(ev) || this._grabPointerId !== id) return;
        this._lastPos = undefined;
        this._lastEv = undefined;
        this._grabPointerId = undefined;
        this._dropHandler(pt, ev);
    }

    onLeave(pt, id, ev) {
        if (!isLeftClicking(ev) || this._grabPointerId !== id) return;
        this._grabActivityTime = window.performance.now();
        this._lastPos = undefined;
        this._lastEv = ev;
        this._dragHandler(undefined, ev);
    }

    onEnter(pt, id, ev) {
        if (isLeftClicking(ev) || this._grabPointerId !== id) return;
        this._lastPos = undefined;
        this._lastEv = undefined;
        this._grabPointerId = undefined;
        this._dropHandler(undefined, ev);
    }

    relativeEventPos(ev) {
        return eventPosRelativeTo(ev, this._element);
    }

    handleTouchEventWith(ev, handler) {
        for (let i = 0; i < ev.changedTouches.length; i++) {
            let touch = ev.changedTouches[i];
            handler.call(this, this.relativeEventPos(touch), touch.identifier, ev);
        }
    }

    handleMouseEventWith(ev, handler) {
        handler.call(this, this.relativeEventPos(ev), MOUSE_ID, ev);
    }
}

export {watchDrags, isLeftClicking, isMiddleClicking, eventPosRelativeTo};
