import type { DrumId, Instrument } from '../model/project.ts'

export const DRUM_COLOR: Record<DrumId, string> = {
  kick: '#ffb000',
  snare: '#ff4d3a',
  clap: '#f2c9a0',
  hatClosed: '#3ddc97',
  hatOpen: '#3ec6ff',
  tom: '#c49bff',
  lowTom: '#8d6ad4',
  conga: '#e07a3d',
  rim: '#ffe14a',
  cowbell: '#ff8a6a',
  clave: '#f4f0c8',
  shaker: '#8fd18a',
  cymbal: '#d7e2ea',
}

export function instrumentColor(instrument: Instrument): string {
  if (instrument.voice.type === '808') return DRUM_COLOR[instrument.voice.drum]
  if (instrument.voice.type === 'bass') return '#5b8cff'
  if (instrument.voice.type === 'lead') return '#ff7a18'
  return '#e56bff'
}
