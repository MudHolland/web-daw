import type { BassSound, ChordSound, Envelope, SoundParams } from '../model/project.ts'

export type TriggerSound = SoundParams | BassSound | ChordSound

export interface Voice {
  trigger(
    time: number,
    note: number,
    velocity: number,
    sound: TriggerSound,
    envelope?: Envelope | null,
    gate?: number | null,
  ): void
  connect(destination: AudioNode): void
  silence(time: number): void
  rearticulate?(): void
}
