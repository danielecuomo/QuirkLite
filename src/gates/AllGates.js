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

import {ArithmeticGates} from "./ArithmeticGates.js"
import {AmplitudeDisplayFamily} from "./AmplitudeDisplay.js"
import {BitCountGates} from "./BitCountGates.js"
import {BlochSphereDisplay} from "./BlochSphereDisplay.js"
import {ComparisonGates} from "./ComparisonGates.js"
import {Controls} from "./Controls.js"
import {CountingGates} from "./CountingGates.js"
import {CycleBitsGates} from "./CycleBitsGates.js"
import {DensityMatrixDisplayFamily} from "./DensityMatrixDisplay.js"
import {ErrorInjectionGate} from "./Debug_ErrorInjectionGate.js"
import {ExponentiatingGates} from "./ExponentiatingGates.js"
import {FourierTransformGates} from "./FourierTransformGates.js"
import {HalfTurnGates} from "./HalfTurnGates.js"
import {ImaginaryGate, AntiImaginaryGate, SqrtImaginaryGate, AntiSqrtImaginaryGate} from "./Joke_ImaginaryGate.js"
import {IncrementGates} from "./IncrementGates.js"
import {InputGates} from "./InputGates.js"
import {InterleaveBitsGates} from "./InterleaveBitsGates.js"
import {MeasurementGate, XMeasurementGate, BellMeasurementGate} from "./MeasurementGate.js"
import {ModularIncrementGates} from "./ModularIncrementGates.js"
import {ModularAdditionGates} from "./ModularAdditionGates.js"
import {ModularMultiplicationGates} from "./ModularMultiplicationGates.js"
import {ModularMultiplyAccumulateGates} from "./ModularMultiplyAccumulateGates.js"
import {MultiplicationGates} from "./MultiplicationGates.js"
import {MultiplyAccumulateGates} from "./MultiplyAccumulateGates.js"
import {NeGate} from "./Joke_NeGate.js"
import {ParametrizedRotationGates} from "./ParametrizedRotationGates.js"
import {PhaseGradientGates} from "./PhaseGradientGates.js"
import {PivotFlipGates} from "./PivotFlipGates.js"
import {PostSelectionGates} from "./PostSelectionGates.js"
import {IsingGates} from "./IsingGates.js"
import {PoweringGates} from "./PoweringGates.js"
import {ProbabilityDisplayFamily} from "./ProbabilityDisplay.js"
import {QuarterTurnGates} from "./QuarterTurnGates.js"
import {ReverseBitsGateFamily} from "./ReverseBitsGate.js"
import {ResetGates} from "./ResetGates.js"
import {SampleDisplayFamily} from "./SampleDisplay.js"
import {Detectors} from "./Detector.js"
import {SpacerGate} from "./SpacerGate.js"
import {SwapGateHalf} from "./SwapGateHalf.js"
import {UniversalNotGate} from "./Impossible_UniversalNotGate.js"
import {VariousXGates} from "./VariousXGates.js"
import {VariousYGates} from "./VariousYGates.js"
import {VariousZGates} from "./VariousZGates.js"
import {WireCutGate} from "./WireCutGate.js"
import {XorGates} from "./XorGates.js"
import {ZeroGate} from "./Joke_ZeroGate.js"
import {Config} from "../Config.js"
import {MathPainter} from "../draw/MathPainter.js"
import {Matrix} from "../math/Matrix.js"
import {seq} from "../base/Seq.js"

let Gates = {};
Gates.Special = {Measurement: MeasurementGate, XMeasurement: XMeasurementGate, BellMeasurement: BellMeasurementGate, WireCut: WireCutGate, SwapHalf: SwapGateHalf};
Gates.Displays = {AmplitudeDisplayFamily, ProbabilityDisplayFamily, SampleDisplayFamily, DensityMatrixDisplayFamily, BlochSphereDisplay};
Gates.Arithmetic = ArithmeticGates; Gates.BitCountGates = BitCountGates; Gates.ComparisonGates = ComparisonGates; Gates.Controls = Controls; Gates.CountingGates = CountingGates; Gates.CycleBitsGates = CycleBitsGates;
Gates.Displays.DensityMatrixDisplay = DensityMatrixDisplayFamily.ofSize(1); Gates.Displays.DensityMatrixDisplay2 = DensityMatrixDisplayFamily.ofSize(2); Gates.Displays.ChanceDisplay = Gates.Displays.ProbabilityDisplayFamily.ofSize(1);
Gates.ErrorInjection = ErrorInjectionGate; Gates.Exponentiating = ExponentiatingGates; Gates.FourierTransformGates = FourierTransformGates; Gates.HalfTurns = HalfTurnGates;
Gates.ImaginaryGate = ImaginaryGate; Gates.AntiImaginaryGate = AntiImaginaryGate; Gates.SqrtImaginaryGate = SqrtImaginaryGate; Gates.AntiSqrtImaginaryGate = AntiSqrtImaginaryGate;
Gates.IncrementGates = IncrementGates; Gates.InputGates = InputGates; Gates.InterleaveBitsGates = InterleaveBitsGates; Gates.ModularIncrementGates = ModularIncrementGates; Gates.ModularAdditionGates = ModularAdditionGates; Gates.ModularMultiplicationGates = ModularMultiplicationGates; Gates.ModularMultiplyAccumulateGates = ModularMultiplyAccumulateGates;
Gates.MultiplicationGates = MultiplicationGates; Gates.MultiplyAccumulateGates = MultiplyAccumulateGates; Gates.NeGate = NeGate; Gates.OtherX = VariousXGates; Gates.OtherY = VariousYGates; Gates.ParametrizedRotationGates = ParametrizedRotationGates; Gates.PhaseGradientGates = PhaseGradientGates; Gates.PivotFlipGates = PivotFlipGates; Gates.PostSelectionGates = PostSelectionGates; Gates.Powering = PoweringGates; Gates.QuarterTurns = QuarterTurnGates; Gates.ReverseBitsGateFamily = ReverseBitsGateFamily; Gates.ResetGates = ResetGates; Gates.Detectors = Detectors; Gates.SpacerGate = SpacerGate; Gates.WireCutGate = WireCutGate; Gates.UniversalNot = UniversalNotGate; Gates.XorGates = XorGates; Gates.ZeroGate = ZeroGate;

Gates.KnownToSerializer = [
    ...Controls.all, ...InputGates.all, MeasurementGate, XMeasurementGate, BellMeasurementGate, SwapGateHalf, SpacerGate, WireCutGate, UniversalNotGate, ErrorInjectionGate, ZeroGate, NeGate, ImaginaryGate, AntiImaginaryGate, SqrtImaginaryGate, AntiSqrtImaginaryGate,
    ...AmplitudeDisplayFamily.all, ...ProbabilityDisplayFamily.all, ...SampleDisplayFamily.all, ...DensityMatrixDisplayFamily.all, BlochSphereDisplay, ...ArithmeticGates.all, ...BitCountGates.all, ...ComparisonGates.all, ...CountingGates.all, ...CycleBitsGates.all, ...Detectors.all, ...ExponentiatingGates.all, ...FourierTransformGates.all, ...HalfTurnGates.all, ...IncrementGates.all, ...InterleaveBitsGates.all, ...ModularAdditionGates.all, ...ModularIncrementGates.all, ...ModularMultiplicationGates.all, ...ModularMultiplyAccumulateGates.all, ...MultiplicationGates.all, ...MultiplyAccumulateGates.all, ...QuarterTurnGates.all, ...ParametrizedRotationGates.all, ...PhaseGradientGates.all, ...PivotFlipGates.all, ...PostSelectionGates.all, ...IsingGates.all, ...PoweringGates.all, ...ReverseBitsGateFamily.all, ...ResetGates.all, ...VariousXGates.all, ...VariousYGates.all, ...VariousZGates.all, ...XorGates.all
];
let gatesById = seq(Gates.KnownToSerializer).keyedBy(g => g.serializedId);
Gates.findKnownGateById = (id, customGateSet) => gatesById.has(id) ? gatesById.get(id) : customGateSet.findGateWithSerializedId(id);

// The toolbox preview for Amps is a single amplitude cell, matching Quirk's
// amplitude visualization: magnitude as the light-blue circle, probability
// as the dark fill, and phase as the black radius line.
let Amps2 = AmplitudeDisplayFamily.ofSize(2);
let amps2CircuitDrawer = Amps2.customDrawer;
Amps2.customDrawer = args => {
    if (!args.isInToolbox) {
        amps2CircuitDrawer(args);
        return;
    }
    let amp = 1 / Math.sqrt(2);
    let previewState = new Matrix(1, 1, new Float64Array([amp, 0]));
    MathPainter.paintMatrix(
        args.painter,
        previewState,
        args.rect,
        Config.SUPERPOSITION_MID_COLOR,
        'black',
        Config.SUPERPOSITION_FORE_COLOR,
        Config.SUPERPOSITION_BACK_COLOR,
        'black');
};

Gates.TopToolboxGroups = [
    {hint: "Probes", gates: [MeasurementGate, XMeasurementGate, BellMeasurementGate]},
    {hint: "Post-selection", gates: [PostSelectionGates.PostSelectOff, PostSelectionGates.PostSelectOn]},
    {hint: "Displays", gates: [BlochSphereDisplay, ProbabilityDisplayFamily.ofSize(1), Amps2]},
    {hint: "Formulaic", gates: [
        ParametrizedRotationGates.FormulaicRotationRx,
        ParametrizedRotationGates.FormulaicRotationRy,
        ParametrizedRotationGates.FormulaicRotationRz
    ]},
    {hint: "Ising", gates: [IsingGates.XX, IsingGates.YY, IsingGates.ZZ]},
    {hint: "3-qubit Ising", gates: [IsingGates.XXX, IsingGates.YYY, IsingGates.ZZZ]},
    {hint: "Gadgets", gates: [WireCutGate, CycleBitsGates.CycleBitsFamily.ofSize(2), CycleBitsGates.ReverseCycleBitsFamily.ofSize(2)]},
];
Gates.BottomToolboxGroups = [];

const INITIAL_STATES_TO_GATES = new Map([[undefined, []], ['1', [Gates.HalfTurns.X]], ['+', [Gates.HalfTurns.H]], ['-', [Gates.HalfTurns.H, Gates.HalfTurns.Z]], ['i', [Gates.HalfTurns.H, Gates.QuarterTurns.SqrtZForward]], ['-i', [Gates.HalfTurns.H, Gates.QuarterTurns.SqrtZBackward]]]);
export {Gates, INITIAL_STATES_TO_GATES}
