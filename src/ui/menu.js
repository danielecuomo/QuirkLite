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

import {ObservableValue} from "../base/Obs.js"

const menuIsVisible = new ObservableValue(true);
const obsMenuIsShowing = menuIsVisible.observable().whenDifferent();
let closeMenu = () => menuIsVisible.set(false);

const teleportLink = {
    "cols":[
        [1,"H"],
        [1,"•",1,1,"X"],
        ["…","…",1,1,"…"],
        ["…","…",1,1,"…"],
        ["~87lj"],
        ["Bloch"],
        ["•","X"],
        ["H"],
        ["Measure","Measure"],
        [1,"•",1,1,"X"],
        ["•",1,1,1,"Z"],
        [1,1,1,1,"Bloch"],
        [1,1,1,1,"~f7c0"]
    ],
    "gates":[
        {"id":"~87lj","name":"message","circuit":{"cols":[["e^-iYt"],["X^t"]]}},
        {"id":"~f7c0","name":"received","matrix":"{{1,0},{0,1}}"}
    ]
};
/**
 * @param {!Revision} revision
 * @param {!Observable.<!boolean>} obsIsAnyOverlayShowing
 */
function initMenu(revision, obsIsAnyOverlayShowing) {
    // Show/hide menu overlay.
    (() => {
        const menuButton = /** @type {!HTMLButtonElement} */ document.getElementById('menu-button');
        const closeMenuButton = /** @type {!HTMLButtonElement} */ document.getElementById('close-menu-button');
        const menuOverlay = /** @type {!HTMLDivElement} */ document.getElementById('menu-overlay');
        const menutDiv = /** @type {HTMLDivElement} */ document.getElementById('menu-div');
        menuButton.addEventListener('click', () => menuIsVisible.set(true));
        obsIsAnyOverlayShowing.subscribe(e => { menuButton.disabled = e; });
        menuOverlay.addEventListener('click', () => menuIsVisible.set(false));
        closeMenuButton.addEventListener('click', () => menuIsVisible.set(false));
        document.addEventListener('keydown', e => {
            const ESC_KEY = 27;
            if (e.keyCode === ESC_KEY) {
                menuIsVisible.set(false)
            }
        });
        obsMenuIsShowing.subscribe(showing => {
            menutDiv.style.display = showing ? 'block' : 'none';
            if (showing) {
                document.getElementById('export-link-copy-button').focus();
            }
        });
    })();

    const teleportAnchor = /** @type {!HTMLAnchorElement} */ document.getElementById('example-anchor-teleport');
    teleportAnchor.href = 'quirk.html#circuit={%22cols%22:[[1,%22•%22,%22X%22],[1,%22Chance2%22],[{%22id%22:%22Ryft%22,%22arg%22:%22pi%20t%22}],[%22Bloch%22],[%22•%22,%22X%22],[%22H%22],[%22Measure%22,%22Measure%22],[%22|0⟩⟨0|%22,%22|0⟩⟨0|%22],[1,1,%22Bloch%22]],%22init%22:[0,%22+%22]}';
    teleportAnchor.onclick = ev => {
        if (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.which !== 1) {
            return undefined;
        }
        return true;
    };

}

export {initMenu, obsMenuIsShowing, closeMenu}
