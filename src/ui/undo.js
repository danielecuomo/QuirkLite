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

/**
 * @param {!Revision} revision
 * @param {!Observable.<boolean>} obsIsAnyOverlayShowing
 */
function initUndoRedo(revision, obsIsAnyOverlayShowing) {
    // Some legacy overlays (Forge/Export) are no longer present in QuirkLite.
    // Ignore missing elements instead of dereferencing null on every keydown.
    const overlay_divs = [
        document.getElementById('gate-forge-div'),
        document.getElementById('export-div')
    ].filter(div => div !== null);

    const undoButton = /** @type {!HTMLButtonElement} */ document.getElementById('undo-button');
    const redoButton = /** @type {!HTMLButtonElement} */ document.getElementById('redo-button');
    revision.latestActiveCommit().zipLatest(obsIsAnyOverlayShowing, (_, b) => b).subscribe(anyShowing => {
        undoButton.disabled = revision.isAtBeginningOfHistory() || anyShowing;
        redoButton.disabled = revision.isAtEndOfHistory() || anyShowing;
    });

    undoButton.addEventListener('click', () => revision.undo());
    redoButton.addEventListener('click', () => revision.redo());

    document.addEventListener("keydown", e => {
        const Y_KEY = 89;
        const Z_KEY = 90;
        const commandOrControl = e.ctrlKey || e.metaKey;

        // Ignore every key that is not one of the shortcuts owned by this
        // handler. This is important because QuirkLite no longer has some
        // of Quirk's old keyboard-bound features.
        const isUndo = e.keyCode === Z_KEY && commandOrControl && !e.shiftKey && !e.altKey;
        const isRedo1 = e.keyCode === Z_KEY && commandOrControl && e.shiftKey && !e.altKey;
        const isRedo2 = e.keyCode === Y_KEY && commandOrControl && !e.shiftKey && !e.altKey;
        if (!isUndo && !isRedo1 && !isRedo2) {
            return;
        }

        // Don't capture shortcuts while menus are showing.
        for (let div of overlay_divs) {
            if (div.style.display !== 'NONE' && div.style.display !== 'none') {
                return;
            }
        }
        if (isUndo) {
            revision.undo();
            e.preventDefault();
        }
        if (isRedo1 || isRedo2) {
            revision.redo();
            e.preventDefault();
        }
    });
}

export {initUndoRedo}
