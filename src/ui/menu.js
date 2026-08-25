import {ObservableValue} from "../base/Obs.js"

const menuIsVisible = new ObservableValue(true);
const obsMenuIsShowing = menuIsVisible.observable().whenDifferent();
let closeMenu = () => menuIsVisible.set(false);

function initMenu(revision, obsIsAnyOverlayShowing) {
    const menuButton = /** @type {!HTMLButtonElement} */ document.getElementById('menu-button');
    const closeMenuButton = /** @type {!HTMLButtonElement} */ document.getElementById('close-menu-button');
    const menuOverlay = /** @type {!HTMLDivElement} */ document.getElementById('menu-overlay');
    const menuDiv = /** @type {!HTMLDivElement} */ document.getElementById('menu-div');
    menuButton.addEventListener('click', () => menuIsVisible.set(true));
    obsIsAnyOverlayShowing.subscribe(e => { menuButton.disabled = e; });
    menuOverlay.addEventListener('click', () => menuIsVisible.set(false));
    closeMenuButton.addEventListener('click', () => menuIsVisible.set(false));
    document.addEventListener('keydown', e => { if (e.keyCode === 27) menuIsVisible.set(false); });
    obsMenuIsShowing.subscribe(showing => {
        menuDiv.style.display = showing ? 'block' : 'none';
        if (showing) closeMenuButton.focus();
    });
    const teleportAnchor = /** @type {!HTMLAnchorElement} */ document.getElementById('example-anchor-teleport');
    teleportAnchor.href = 'quirk.html#circuit={%22cols%22:[[1,%22•%22,%22X%22],[1,%22Chance2%22],[{%22id%22:%22Ryft%22,%22arg%22:%22pi%20t%22}],[%22Bloch%22],[%22•%22,%22X%22],[%22H%22],[%22Measure%22,%22Measure%22],[%22|0⟩⟨0|%22,%22|0⟩⟨0|%22],[1,1,%22Bloch%22]],%22init%22:[0,%22+%22]}';
}

export {initMenu, obsMenuIsShowing, closeMenu}
