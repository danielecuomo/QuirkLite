/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {GateBuilder} from "../circuit/Gate.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Matrix} from "../math/Matrix.js"
import {ketArgs, ketShader} from "../circuit/KetShaderUtil.js"

let ResetGates = {};

// These are the exact reset matrices. They are deliberately non-unitary.
const ZERO_PROJECTION = Matrix.square(1, 0, 0, 0);
const ONE_PROJECTION = Matrix.square(0, 0, 0, 1);

// The matrix annihilates |1>, which leaves the simulator with a zero vector
// that cannot be normalized. Quirk historically represents zero-norm states as
// NaN, so the |0> gate needs one very narrow simulation workaround: when its
// input is exactly |1>, interpret the zero result as the reset state |0>.
// For every other input, the actual operation is exactly the projection matrix.
const ZERO_PROJECTION_WITH_EXACT_ONE_FALLBACK = ketShader('', `
    vec2 zero = inp(0.0);
    vec2 one = inp(1.0);
    bool is_exact_one = zero.x == 0.0 && zero.y == 0.0 && one.x == 1.0 && one.y == 0.0;
    if (out_id == 0.0) {
        return is_exact_one ? one : zero;
    }
    return vec2(0.0, 0.0);
`, 1);

// Symmetric workaround for |1>: when the input is exactly |0>, the projection
// would otherwise produce the zero vector and the simulator would normalize it
// into NaN. Only that exact state receives the fallback to |1>.
const ONE_PROJECTION_WITH_EXACT_ZERO_FALLBACK = ketShader('', `
    vec2 zero = inp(0.0);
    vec2 one = inp(1.0);
    bool is_exact_zero = zero.x == 1.0 && zero.y == 0.0 && one.x == 0.0 && one.y == 0.0;
    if (out_id == 1.0) {
        return is_exact_zero ? zero : one;
    }
    return vec2(0.0, 0.0);
`, 1);

/** @type {!Gate} */
ResetGates.Reset = new GateBuilder().
    setSerializedIdAndSymbol("|0>").
    setTitle("|0>").
    setBlurb("Applies the matrix [[1, 0], [0, 0]].").
    setDrawer(GatePainting.DEFAULT_DRAWER).
    setKnownEffectToMatrix(ZERO_PROJECTION).
    setActualEffectToShaderProvider(ctx => ZERO_PROJECTION_WITH_EXACT_ONE_FALLBACK.withArgs(
        ...ketArgs(ctx, 1))).
    gate;

// The operation above is intentionally a plain matrix gate. Do not treat it as
// a post-selection operation: in particular, don't collect survival-rate
// bookkeeping for it, and don't draw the "omits" / "gains" annotations.
ResetGates.Reset._isDefinitelyUnitary = true;

/** @type {!Gate} */
ResetGates.ResetOne = new GateBuilder().
    setSerializedIdAndSymbol("|1>").
    setTitle("|1>").
    setBlurb("Applies the matrix [[0, 0], [0, 1]].").
    setDrawer(GatePainting.DEFAULT_DRAWER).
    setKnownEffectToMatrix(ONE_PROJECTION).
    setActualEffectToShaderProvider(ctx => ONE_PROJECTION_WITH_EXACT_ZERO_FALLBACK.withArgs(
        ...ketArgs(ctx, 1))).
    gate;

// Same bookkeeping treatment as |0>: this is a real gate in the circuit, not
// a post-selection operation.
ResetGates.ResetOne._isDefinitelyUnitary = true;

ResetGates.all = [ResetGates.Reset, ResetGates.ResetOne];

export {ResetGates}
