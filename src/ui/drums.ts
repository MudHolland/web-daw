import { catalogVoice, type CatalogId, type DrumId, type Instrument } from '../model/project.ts'

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

export function voiceColor(voice: Instrument['voice']): string {
  if (voice.type === '808') return DRUM_COLOR[voice.drum]
  if (voice.type === 'bass') return '#5b8cff'
  if (voice.type === 'lead') return '#ff7a18'
  return '#e56bff'
}

export const TRACK_COLORS = [
  '#ffb000',
  '#ffe14a',
  '#ff7a18',
  '#ff4d3a',
  '#ff5aa5',
  '#e07a3d',
  '#ff8a6a',
  '#f2c9a0',
  '#f4f0c8',
  '#3ddc97',
  '#8fd18a',
  '#2ee6c7',
  '#3ec6ff',
  '#5b8cff',
  '#c49bff',
  '#8d6ad4',
  '#e56bff',
  '#d7e2ea',
] as const

export function instrumentColor(instrument: Instrument): string {
  return instrument.color ?? voiceColor(instrument.voice)
}

export function catalogColor(catalog: CatalogId): string {
  return voiceColor(catalogVoice(catalog))
}
