/**
 * Copyright 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import {GateBuilder} from "../circuit/Gate.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Complex, PARSE_COMPLEX_TOKEN_MAP_RAD} from "../math/Complex.js"
import {Matrix} from "../math/Matrix.js"
import {parseFormula} from "../math/FormulaParser.js"
import {Config} from "../Config.js"

let FormulaicIsingGates = {};

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

function formulaicIsingDrawer(symbol) {
    return args => {
        GatePainting.paintBackground(args, Config.TIME_DEPENDENT_HIGHLIGHT_COLOR);
        GatePainting.paintOutline(args);
        GatePainting.paintGateSymbol(args, symbol);
        GatePainting.paintGateButton(args);
    };
}

function updateUsingFormula(gate) {
    let stable = parseTimeFormula(gate.param, undefined, false) !== undefined;
    gate._stableDuration = stable ? Infinity : 0;
    gate.width = 1;
    gate.alternate = gate._copy();
    gate.alternate.alternate = gate;
    if (typeof gate.param === 'string' && gate.param.startsWith('-(') && gate.param.endsWith(')')) {
        gate.alternate.param = gate.param.substring(2, gate.param.length - 1);
    } else if (typeof gate.param === 'string') {
        gate.alternate.param = '-(' + gate.param + ')';
    }
}

const makeFormulaicIsingGate = (axis, pauli) => {
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
        setWidth(1).
        setExtraDisableReasonFinder(badFormulaDetector).
        setOnClickGateFunc(angleClicker(`Ising ${axis}${axis} gate's angle in radians`)).
        setEffectToTimeVaryingMatrix((t, formula) => matrixForAngle(
            parseTimeFormula(formula, t*2-1, true) / Math.PI / 4 || 0)).
        setWithParamPropertyRecomputeFunc(updateUsingFormula).
        promiseEffectIsUnitary().
        gate;

    gate.withParam('pi t^2');
    return gate;
};

FormulaicIsingGates.XX = makeFormulaicIsingGate('X', Matrix.PAULI_X);
FormulaicIsingGates.YY = makeFormulaicIsingGate('Y', Matrix.PAULI_Y);
FormulaicIsingGates.ZZ = makeFormulaicIsingGate('Z', Matrix.PAULI_Z);

FormulaicIsingGates.all = [
    FormulaicIsingGates.XX,
    FormulaicIsingGates.YY,
    FormulaicIsingGates.ZZ
];

export {FormulaicIsingGates}
