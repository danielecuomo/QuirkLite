/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {GateBuilder} from "../circuit/Gate.js"
import {Matrix} from "../math/Matrix.js"
import {Complex} from "../math/Complex.js"

let IsingGates = {};

// Maximally-entangling Ising interaction:
//   exp(-i*pi/4 * P⊗P) = (I - i P⊗P) / sqrt(2)
// for P in {X, Y, Z}.
const makeIsingMatrix = pauli => {
    let pp = pauli.tensorProduct(pauli);
    let c = Math.cos(Math.PI / 4);
    let s = Math.sin(Math.PI / 4);
    return Matrix.identity(4).times(c).minus(pp.times(new Complex(0, s)));
};

const makeIsingGate = (axis, pauli) => new GateBuilder().
    setHeight(2).
    setSerializedIdAndSymbol(`Ising${axis}${axis}`, `${axis}${axis}`).
    setSymbol(`${axis}${axis}_π/4`).
    setTitle(`Ising ${axis}${axis} Gate`).
    setBlurb(`Applies exp(-iπ/4 ${axis}⊗${axis}).`).
    setKnownEffectToMatrix(makeIsingMatrix(pauli)).
    promiseEffectIsUnitary().
    gate;

IsingGates.XX = makeIsingGate('X', Matrix.PAULI_X);
IsingGates.YY = makeIsingGate('Y', Matrix.PAULI_Y);
IsingGates.ZZ = makeIsingGate('Z', Matrix.PAULI_Z);

IsingGates.all = [IsingGates.XX, IsingGates.YY, IsingGates.ZZ];

export {IsingGates}
