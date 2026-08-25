import {ObservableValue} from "../base/Obs.js"
import {fromJsonText_CircuitDefinition} from "../circuit/Serializer.js"
import {saveFile} from "../browser/SaveFile.js"

const exportsIsVisible = new ObservableValue(false);
const obsExportsIsShowing = exportsIsVisible.observable().whenDifferent();

function initExports(revision, mostRecentStats, obsIsAnyOverlayShowing) {
    const downloadButton = /** @type {!HTMLButtonElement} */ document.getElementById('download-button');
    if (!downloadButton) return;
    let latest = '{"cols":[]}';
    const fileNameForState = jsonText => {
        try {
            const circuitDef = fromJsonText_CircuitDefinition(jsonText);
            if (!circuitDef.isEmpty()) {
                return `QuirkLite with Circuit - ${circuitDef.readableHash()}.html`;
            }
        } catch (_) {}
        return 'QuirkLite.html';
    };
    revision.latestActiveCommit().subscribe(jsonText => {
        if (typeof jsonText === 'string') latest = jsonText;
    });
    downloadButton.addEventListener('click', () => {
        downloadButton.disabled = true;
        try {
            const originalHtml = document.QUIRK_QUINE_ALL_HTML_ORIGINAL || document.documentElement.outerHTML;
            const startTag = '//DEFAULT_CIRCUIT_START\n';
            const endTag = '//DEFAULT_CIRCUIT_END\n';
            const start = originalHtml.indexOf(startTag);
            const stop = originalHtml.indexOf(endTag, start);
            if (start < 0 || stop < 0) {
                saveFile('QuirkLite.html', originalHtml);
                return;
            }
            const html = originalHtml.substring(0, start) +
                startTag +
                'document.DEFAULT_CIRCUIT = ' + JSON.stringify(latest) + ';\n' +
                originalHtml.substring(stop);
            saveFile(fileNameForState(latest), html);
        } finally {
            setTimeout(() => { downloadButton.disabled = false; }, 500);
        }
    });
}

export {initExports, obsExportsIsShowing}
