import { fxHighCutHz, fxLowCutHz, reverbSeconds, syncHz, syncSeconds, tapeSeconds, type FxSettings, type InsertId } from '../model/project.ts'

export type FxChain = {
  input: GainNode
  output: GainNode
  delayTime: AudioParam
  delayFeedback: AudioParam
  delayWet: AudioParam
  delayDry: AudioParam
  echoTime: AudioParam
  echoFeedback: AudioParam
  echoWet: AudioParam
  echoDry: AudioParam
  chorusRate: AudioParam
  chorusDepth: AudioParam
  chorusWet: AudioParam
  chorusDry: AudioParam
  flangerRate: AudioParam
  flangerDepth: AudioParam
  flangerFeedback: AudioParam
  flangerWet: AudioParam
  flangerDry: AudioParam
  tremRate: AudioParam
  tremDepth: AudioParam
  tremLevel: AudioParam
  drive: WaveShaperNode
  driveTone: AudioParam
  driveWet: AudioParam
  driveDry: AudioParam
  shiftRate: AudioParam
  shiftDepth: AudioParam
  shiftRateB: AudioParam
  shiftDepthB: AudioParam
  shiftWin: AudioParam
  shiftWinB: AudioParam
  shiftWet: AudioParam
  shiftDry: AudioParam
  lowCut: AudioParam
  highCut: AudioParam
  reverb: Reverb
  tape: TapeStop
  stutter: Stutter
}

type Reverb = {
  ctx: BaseAudioContext
  input: GainNode
  convolver: ConvolverNode
  wet: GainNode
  dry: GainNode
  live: boolean
  seconds: number
}

type TapeStop = {
  delay: DelayNode
  gain: GainNode
  engaged: boolean
}

type Stutter = {
  delay: DelayNode
  capture: GainNode
  loop: GainNode
  wet: GainNode
  dry: GainNode
  length: number
  freshFrom: number
}

export type FxGrid = { origin: number } | null

type DelayLoop = {
  input: GainNode
  output: GainNode
  time: AudioParam
  feedback: AudioParam
  wet: AudioParam
  dry: AudioParam
}

function createDelayLoop(ctx: AudioContext, maxSeconds: number): DelayLoop {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const delay = ctx.createDelay(maxSeconds)
  const feedback = ctx.createGain()
  input.connect(dry)
  input.connect(delay)
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  dry.connect(output)
  wet.connect(output)
  dry.gain.value = 1
  wet.gain.value = 0
  feedback.gain.value = 0
  delay.delayTime.value = Math.min(0.2, maxSeconds * 0.5)
  return { input, output, time: delay.delayTime, feedback: feedback.gain, wet: wet.gain, dry: dry.gain }
}

function createModulatedDelay(ctx: AudioContext, center: number, maxSeconds: number) {
  const loop = createDelayLoop(ctx, maxSeconds)
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = 0.4
  depth.gain.value = 0
  lfo.connect(depth)
  depth.connect(loop.time)
  loop.time.value = center
  lfo.start()
  return { ...loop, rate: lfo.frequency, depth: depth.gain }
}

function createTremolo(ctx: AudioContext) {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const amp = ctx.createGain()
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  amp.gain.value = 1
  lfo.frequency.value = 4
  depth.gain.value = 0
  lfo.connect(depth)
  depth.connect(amp.gain)
  input.connect(amp)
  amp.connect(output)
  lfo.start()
  return { input, output, rate: lfo.frequency, depth: depth.gain, level: amp.gain }
}

function createDrive(ctx: AudioContext) {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const shaper = ctx.createWaveShaper()
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 8000
  shaper.curve = driveCurve(0.4)
  shaper.oversample = '2x'
  dry.gain.value = 1
  wet.gain.value = 0
  input.connect(dry)
  dry.connect(output)
  input.connect(shaper)
  shaper.connect(tone)
  tone.connect(wet)
  wet.connect(output)
  return { input, output, shaper, tone: tone.frequency, dry: dry.gain, wet: wet.gain }
}

function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 256
  const curve = new Float32Array(samples)
  const drive = Math.max(0, amount)
  if (drive < 0.001) {
    for (let index = 0; index < samples; index += 1) curve[index] = (index / (samples - 1)) * 2 - 1
    return curve
  }
  const k = 1 + drive * 36
  for (let index = 0; index < samples; index += 1) {
    const x = (index / (samples - 1)) * 2 - 1
    curve[index] = Math.tanh(k * x)
  }
  const matched = matchLevel(curve, 0.4) * 0.92
  for (let index = 0; index < samples; index += 1) curve[index] *= matched
  return curve
}

function matchLevel(curve: Float32Array<ArrayBuffer>, amplitude: number): number {
  const steps = 48
  let dry = 0
  let wet = 0
  for (let index = 0; index < steps; index += 1) {
    const x = amplitude * Math.sin((index / steps) * Math.PI * 2)
    dry += x * x
    const position = ((x + 1) / 2) * (curve.length - 1)
    const left = Math.max(0, Math.min(curve.length - 1, Math.floor(position)))
    const right = Math.min(curve.length - 1, left + 1)
    const y = curve[left] * (1 - (position - left)) + curve[right] * (position - left)
    wet += y * y
  }
  return Math.sqrt(dry / Math.max(wet, 1e-8))
}

function createShifter(ctx: AudioContext) {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  dry.gain.value = 1
  wet.gain.value = 0
  input.connect(dry)
  dry.connect(output)
  wet.connect(output)
  const grain = 0.06
  const make = (invert: boolean) => {
    const delay = ctx.createDelay(0.2)
    const amp = ctx.createGain()
    const saw = ctx.createOscillator()
    const sawGain = ctx.createGain()
    const win = ctx.createOscillator()
    const winGain = ctx.createGain()
    const bias = ctx.createConstantSource()
    saw.type = 'sawtooth'
    win.type = 'sine'
    delay.delayTime.value = grain * 0.5
    sawGain.gain.value = 0
    winGain.gain.value = invert ? -0.5 : 0.5
    bias.offset.value = 0.5
    saw.connect(sawGain)
    sawGain.connect(delay.delayTime)
    win.connect(winGain)
    winGain.connect(amp.gain)
    bias.connect(amp.gain)
    input.connect(delay)
    delay.connect(amp)
    amp.connect(wet)
    saw.start()
    win.start()
    bias.start()
    return { rate: saw.frequency, win: win.frequency, depth: sawGain.gain }
  }
  const grainA = make(false)
  const grainB = make(true)
  return { input, output, dry: dry.gain, wet: wet.gain, grainA, grainB }
}

const impulses = new Map<string, AudioBuffer>()

function impulseFor(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const key = `${ctx.sampleRate}:${seconds.toFixed(2)}`
  const cached = impulses.get(key)
  if (cached) return cached
  const length = Math.max(1, Math.round(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let seed = channel === 0 ? 0x2f6b1d : 0x51c3a7
    for (let index = 0; index < length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const noise = seed / 0x7fffffff - 1
      const fade = (1 - index / length) ** 3
      data[index] = noise * fade * 0.5
    }
  }
  impulses.set(key, buffer)
  return buffer
}

function createReverb(ctx: AudioContext) {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const convolver = ctx.createConvolver()
  dry.gain.value = 1
  wet.gain.value = 0
  input.connect(dry)
  dry.connect(output)
  convolver.connect(wet)
  wet.connect(output)
  const reverb: Reverb = { ctx, input, convolver, wet, dry, live: false, seconds: 0 }
  return { reverb, output }
}

function createTape(ctx: AudioContext) {
  const delay = ctx.createDelay(1.2)
  const gain = ctx.createGain()
  delay.delayTime.value = 0
  delay.connect(gain)
  const tape: TapeStop = { delay, gain, engaged: false }
  return tape
}

function createStutter(ctx: AudioContext) {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const capture = ctx.createGain()
  const loop = ctx.createGain()
  const delay = ctx.createDelay(2)
  dry.gain.value = 1
  wet.gain.value = 0
  capture.gain.value = 1
  loop.gain.value = 0
  input.connect(dry)
  dry.connect(output)
  input.connect(capture)
  capture.connect(delay)
  delay.connect(loop)
  loop.connect(delay)
  delay.connect(wet)
  wet.connect(output)
  const stutter: Stutter = { delay, capture, loop, wet, dry, length: 0, freshFrom: 0 }
  return { input, output, stutter }
}

export function createFx(ctx: AudioContext): FxChain {
  const input = ctx.createGain()
  const delay = createDelayLoop(ctx, 1.2)
  const echo = createDelayLoop(ctx, 0.6)
  const chorus = createModulatedDelay(ctx, 0.012, 0.05)
  const flanger = createModulatedDelay(ctx, 0.003, 0.02)
  const tremolo = createTremolo(ctx)
  const drive = createDrive(ctx)
  const shifter = createShifter(ctx)
  const lowCut = ctx.createBiquadFilter()
  const highCut = ctx.createBiquadFilter()
  lowCut.type = 'highpass'
  highCut.type = 'lowpass'
  lowCut.frequency.value = 20
  highCut.frequency.value = 18000
  const output = ctx.createGain()
  const reverb = createReverb(ctx)
  const tape = createTape(ctx)
  const stutter = createStutter(ctx)
  input.connect(delay.input)
  delay.output.connect(echo.input)
  echo.output.connect(chorus.input)
  chorus.output.connect(flanger.input)
  flanger.output.connect(tremolo.input)
  tremolo.output.connect(drive.input)
  drive.output.connect(shifter.input)
  shifter.output.connect(reverb.reverb.input)
  reverb.output.connect(tape.delay)
  tape.gain.connect(stutter.input)
  stutter.output.connect(lowCut)
  lowCut.connect(highCut)
  highCut.connect(output)
  return {
    input,
    output,
    delayTime: delay.time,
    delayFeedback: delay.feedback,
    delayWet: delay.wet,
    delayDry: delay.dry,
    echoTime: echo.time,
    echoFeedback: echo.feedback,
    echoWet: echo.wet,
    echoDry: echo.dry,
    chorusRate: chorus.rate,
    chorusDepth: chorus.depth,
    chorusWet: chorus.wet,
    chorusDry: chorus.dry,
    flangerRate: flanger.rate,
    flangerDepth: flanger.depth,
    flangerFeedback: flanger.feedback,
    flangerWet: flanger.wet,
    flangerDry: flanger.dry,
    tremRate: tremolo.rate,
    tremDepth: tremolo.depth,
    tremLevel: tremolo.level,
    drive: drive.shaper,
    driveTone: drive.tone,
    driveWet: drive.wet,
    driveDry: drive.dry,
    shiftRate: shifter.grainA.rate,
    shiftDepth: shifter.grainA.depth,
    shiftRateB: shifter.grainB.rate,
    shiftDepthB: shifter.grainB.depth,
    shiftWin: shifter.grainA.win,
    shiftWinB: shifter.grainB.win,
    shiftWet: shifter.wet,
    shiftDry: shifter.dry,
    lowCut: lowCut.frequency,
    highCut: highCut.frequency,
    reverb: reverb.reverb,
    tape,
    stutter: stutter.stutter,
  }
}

function holdAt(param: AudioParam, value: number, time: number): void {
  try {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(time)
    else param.cancelScheduledValues(time)
    param.setValueAtTime(value, time)
  } catch {
    param.cancelScheduledValues(0)
    param.setValueAtTime(value, time)
  }
}

function applyReverb(reverb: Reverb, on: boolean, size: number, amount: number, time: number, snap: boolean): void {
  const wanted = on && amount > 0.001
  if (wanted) {
    const seconds = Math.round(reverbSeconds(size) * 10) / 10
    if (seconds !== reverb.seconds) {
      reverb.convolver.buffer = impulseFor(reverb.ctx, seconds)
      reverb.seconds = seconds
    }
    if (!reverb.live) {
      reverb.input.connect(reverb.convolver)
      reverb.live = true
    }
  }
  mix(reverb.dry.gain, reverb.wet.gain, wanted ? amount : 0, time, snap)
  if (!wanted && reverb.live) {
    const { input, convolver } = reverb
    reverb.live = false
    window.setTimeout(() => {
      if (reverb.live) return
      try {
        input.disconnect(convolver)
      } catch {
        /* already disconnected */
      }
    }, 4500)
  }
}

function applyTape(tape: TapeStop, on: boolean, length: number, time: number): void {
  if (on && !tape.engaged) {
    tape.engaged = true
    const points = 48
    const curve = new Float32Array(points)
    for (let index = 0; index < points; index += 1) {
      const t = (index / (points - 1)) * length
      curve[index] = (t * t) / (2 * length)
    }
    holdAt(tape.delay.delayTime, 0, time)
    tape.delay.delayTime.setValueCurveAtTime(curve, time + 0.001, length)
    holdAt(tape.gain.gain, 1, time)
    tape.gain.gain.linearRampToValueAtTime(0.7, time + length * 0.6)
    tape.gain.gain.linearRampToValueAtTime(0, time + length)
  } else if (!on && tape.engaged) {
    tape.engaged = false
    holdAt(tape.delay.delayTime, 0, time)
    holdAt(tape.gain.gain, 0, time)
    tape.gain.gain.linearRampToValueAtTime(1, time + 0.01)
  }
}

function applyStutter(stutter: Stutter, length: number, time: number, grid: FxGrid): void {
  const wanted = grid ? length : 0
  if (Math.abs(wanted - stutter.length) < 1e-6) return
  if (stutter.length > 0) {
    holdAt(stutter.capture.gain, 1, time)
    holdAt(stutter.loop.gain, 0, time)
    holdAt(stutter.wet.gain, 0, time)
    holdAt(stutter.dry.gain, 1, time)
    stutter.freshFrom = time
  }
  stutter.length = wanted
  if (!grid || wanted <= 0) return
  holdAt(stutter.delay.delayTime, wanted, time)
  const earliest = Math.max(time + 0.005, grid.origin + wanted, stutter.freshFrom + wanted)
  const at = grid.origin + Math.ceil((earliest - grid.origin) / wanted - 1e-6) * wanted
  holdAt(stutter.capture.gain, 0, at)
  holdAt(stutter.loop.gain, 1, at)
  holdAt(stutter.dry.gain, 0, at)
  holdAt(stutter.wet.gain, 1, at)
}

export function rampParam(param: AudioParam, from: number, to: number, time: number, duration: number): void {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return
  const at = Math.max(time, 0)
  const end = at + Math.max(0.001, duration)
  try {
    param.cancelScheduledValues(at)
    param.setValueAtTime(from, at)
    if (Math.abs(to - from) < 1e-6) return
    param.linearRampToValueAtTime(to, end)
  } catch {
    param.setValueAtTime(to, at)
  }
}

export function scheduleParam(param: AudioParam, value: number, time: number, snap: boolean, seconds = 0.02): void {
  if (!Number.isFinite(value)) return
  const at = Math.max(time, 0)
  if (snap) {
    param.cancelScheduledValues(at)
    param.setValueAtTime(value, at)
    return
  }
  try {
    param.setTargetAtTime(value, at, seconds)
  } catch {
    param.cancelScheduledValues(at)
    param.setValueAtTime(value, at)
  }
}

function mix(paramDry: AudioParam, paramWet: AudioParam, amount: number, time: number, snap: boolean) {
  const wet = Math.min(1, Math.max(0, amount))
  const angle = wet * (Math.PI / 2)
  scheduleParam(paramDry, Math.cos(angle), time, snap, 0.02)
  scheduleParam(paramWet, Math.sin(angle), time, snap, 0.02)
}

export function applyFx(
  fx: FxChain,
  settings: FxSettings,
  inserts: InsertId[],
  time: number,
  bpm = 120,
  snap = false,
  grid: FxGrid = null,
): void {
  applyReverb(fx.reverb, inserts.includes('reverb'), settings.reverb.size, settings.reverb.mix, time, snap)
  applyTape(fx.tape, inserts.includes('tape') && grid !== null, tapeSeconds(settings.tape.time, bpm), time)
  applyStutter(fx.stutter, 0, time, grid)
  const delayOn = inserts.includes('delay')
  const echoOn = inserts.includes('echo')
  const chorusOn = inserts.includes('chorus')
  const flangerOn = inserts.includes('flanger')
  const delayMix = delayOn ? settings.delay.mix : 0
  scheduleParam(fx.delayTime, Math.min(1.2, syncSeconds(settings.delay.time, bpm)), time, snap, 0.03)
  scheduleParam(fx.delayFeedback, delayMix > 0.001 ? settings.delay.feedback * 0.72 : 0, time, snap, 0.03)
  mix(fx.delayDry, fx.delayWet, delayMix, time, snap)
  const echoMix = echoOn ? settings.echo.mix : 0
  scheduleParam(fx.echoTime, Math.min(0.6, syncSeconds(settings.echo.time, bpm)), time, snap, 0.03)
  scheduleParam(fx.echoFeedback, echoMix > 0.001 ? settings.echo.feedback * 0.65 : 0, time, snap, 0.03)
  mix(fx.echoDry, fx.echoWet, echoMix, time, snap)
  const chorusMix = chorusOn ? settings.chorus.mix : 0
  scheduleParam(fx.chorusRate, syncHz(settings.chorus.rate, bpm), time, snap, 0.05)
  scheduleParam(fx.chorusDepth, chorusMix > 0.001 ? settings.chorus.depth * 0.007 : 0, time, snap, 0.05)
  mix(fx.chorusDry, fx.chorusWet, chorusMix, time, snap)
  const flangerMix = flangerOn ? settings.flanger.mix : 0
  scheduleParam(fx.flangerRate, syncHz(settings.flanger.rate, bpm), time, snap, 0.05)
  scheduleParam(fx.flangerDepth, flangerMix > 0.001 ? settings.flanger.depth * 0.0024 : 0, time, snap, 0.05)
  scheduleParam(fx.flangerFeedback, flangerMix > 0.001 ? settings.flanger.feedback * 0.7 : 0, time, snap, 0.03)
  mix(fx.flangerDry, fx.flangerWet, flangerMix, time, snap)
  const tremOn = inserts.includes('tremolo')
  const tremDepth = tremOn ? settings.tremolo.depth : 0
  scheduleParam(fx.tremRate, syncHz(settings.tremolo.rate, bpm), time, snap, 0.05)
  scheduleParam(fx.tremDepth, tremDepth * 0.5, time, snap, 0.03)
  scheduleParam(fx.tremLevel, 1 - tremDepth * 0.5, time, snap, 0.03)
  const driveOn = inserts.includes('distortion')
  const driveAmount = driveOn ? settings.distortion.drive : 0
  fx.drive.curve = driveCurve(driveAmount)
  scheduleParam(fx.driveTone, 400 + settings.distortion.tone * 10000, time, snap, 0.03)
  mix(fx.driveDry, fx.driveWet, driveAmount > 0.001 ? settings.distortion.mix : 0, time, snap)
  scheduleParam(fx.shiftRate, 0, time, snap, 0.05)
  scheduleParam(fx.shiftRateB, 0, time, snap, 0.05)
  scheduleParam(fx.shiftWin, 0, time, snap, 0.05)
  scheduleParam(fx.shiftWinB, 0, time, snap, 0.05)
  scheduleParam(fx.shiftDepth, 0, time, snap, 0.05)
  scheduleParam(fx.shiftDepthB, 0, time, snap, 0.05)
  mix(fx.shiftDry, fx.shiftWet, 0, time, snap)
  const cutOn = inserts.includes('cutoff')
  const low = cutOn ? fxLowCutHz(settings.cutoff.low) : 20
  const high = cutOn ? fxHighCutHz(settings.cutoff.high) : 18000
  scheduleParam(fx.lowCut, low, time, snap, 0.03)
  scheduleParam(fx.highCut, Math.max(low + 80, high), time, snap, 0.03)
}
