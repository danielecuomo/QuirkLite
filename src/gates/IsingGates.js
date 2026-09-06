/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {GateBuilder} from "../circuit/Gate.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Complex, PARSE_COMPLEX_TOKEN_MAP_RAD} from "../math/Complex.js"
import {Matrix} from "../math/Matrix.js"
import {parseFormula} from "../math/FormulaParser.js"
import {Config} from "../Config.js"

let IsingGates = {};

/**
 * @param {!string} formula
 * @param {undefined|!number} time
 * @param {!boolean} warn
 * @returns {undefined|!number}
 */
function parseTimeFormula(formula, time, warn) {
    let tokenMap = new Map([...PARSE_COMPLEX_TOKEN_MAP_RAD.entries()]);
    if (time !== undefined) {
        tokenMap.set('t', time);
    }
    try {
        let angle = Complex.from(parseFormula(formula, tokenMap));
        if (Math.abs(angle.imag) > 0.0001) {
            throw new Error(`Non-real angle: ${formula} = ${angle}`);
        }
        return angle.real;
    } catch (ex) {
        if (warn) {
            console.warn(ex);
        }
        return undefined;
    }
}

/**
 * @param {!GateCheckArgs} args
 * @returns {undefined|!string}
 */
function badFormulaDetector(args) {
    if (typeof args.gate.param === 'number') {
        return args.gate.param;
    } else if (typeof args.gate.param === 'string') {
        for (let t of [0.01, 0.63, 0.98]) {
            if (parseTimeFormula(args.gate.param, t, false) === undefined) {
                return 'bad\nformula';
            }
        }
        return undefined;
    } else {
        return 'bad\nvalue';
    }
}

/**
 * @param {!string} quantityName
 * @returns {!function(gate: !Gate): !Gate}
 */
function angleClicker(quantityName) {
    return oldGate => {
        let txt = prompt(
            `Enter a formula to use for the ${quantityName}.\n` +
            "\n" +
            "The formula can depend on the time variable t.\n" +
            "Time t starts at -1, grows to +1 over time, then jumps back to -1.\n" +
            "Invalid results will default to 0.\n" +
            "\n" +
            "Available constants: e, pi\n" +
            "Available functions: cos, sin, acos, asin, tan, atan, ln, sqrt, exp\n" +
            "Available operators: + * / - ^",
            '' + oldGate.param);
        if (txt === null || txt.trim() === '') {
            return oldGate;
        }
        return oldGate.withParam(txt);
    };
}

/**
 * @param {!string} pattern
 * @returns {!function(args: !GateDrawParams)}
 */
function formulaicIsingDrawer(pattern) {
    return args => {
        GatePainting.paintBackground(args, Config.TIME_DEPENDENT_HIGHLIGHT_COLOR);
        GatePainting.paintOutline(args);
        let text = pattern;
        if (!args.isInToolbox) {
            text = text.split('f(t)').join(args.gate.param);
        }
        GatePainting.paintGateSymbol(args, text);
        GatePainting.paintGateButton(args);
    };
}

/**
 * @param {!string} axis
 * @param {!Matrix} pauli
 * @returns {!Gate}
 */
const makeIsingGate = (axis, pauli) => {
    let pp = pauli.tensorProduct(pauli);
    let matrixForAngle = angle => {
        let c = Math.cos(angle);
        let s = Math.sin(angle);
        return Matrix.identity(4).times(c).minus(pp.times(new Complex(0, s)));
    };

    let gate = new GateBuilder().
        setHeight(2).
        setSerializedIdAndSymbol(`Ising${axis}${axis}ft`, `${axis}${axis}_f(t)`).
        setTitle(`Formula Ising ${axis}${axis} Gate`).
        setBlurb(`Applies exp(-i f(t) ${axis}⊗${axis}).`).
        setDrawer(formulaicIsingDrawer(`${axis}${axis}_f(t)`)).
        setWidth(2).
        setExtraDisableReasonFinder(badFormulaDetector).
        setOnClickGateFunc(angleClicker(`Ising ${axis}${axis} gate's angle in radians`)).
        setEffectToTimeVaryingMatrix((t, formula) => matrixForAngle(
            parseTimeFormula(formula, t*2-1, true) || 0)).
        setWithParamPropertyRecomputeFunc(gate => {
            if (typeof gate.param === 'string') {
                gate.width = Math.ceil((gate.param.length + 1) / 5);
                gate.alternate = gate._copy();
                gate.alternate.alternate = gate;
                if (gate.param.startsWith('-(') && gate.param.endsWith(')')) {
                    gate.alternate.param = gate.param.substring(2, gate.param.length - 1);
                } else {
                    gate.alternate.param = '-(' + gate.param + ')';
                }
            } else {
                gate.width = 1;
                gate.alternate = gate;
            }
        }).
        promiseEffectIsUnitary().
        gate;

    gate.withParam('pi t^2');
    return gate;
};

IsingGates.XX = makeIsingGate('X', Matrix.PAULI_X);
IsingGates.YY = makeIsingGate('Y', Matrix.PAULI_Y);
IsingGates.ZZ = makeIsingGate('Z', Matrix.PAULI_Z);

IsingGates.all = [IsingGates.XX, IsingGates.YY, IsingGates.ZZ];

export {IsingGates}
