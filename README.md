# Beat Forge

> A hardware-inspired in-browser groovebox, pattern sequencer, and multi-track audio workstation powered by the Web Audio API.

---

### 🌐 Live Demo

You can try Beat Forge directly in your browser at the temporary hosted address:

👉 **[https://mediumaquamarine-jaguar-971401.hostingersite.com/](https://mediumaquamarine-jaguar-971401.hostingersite.com/)**

---

## ✨ Features

- **Synthesized 808 Drum Machine & Voices:**
  - Fully synthesized analog-style drum voices (Kick, Snare, Toms, Congas, Rimshot, Claves, Hand Clap, Cowbell, Maracas, Closed/Open Hi-Hats, Cymbal).
  - Dedicated sub/acid Bass Synthesizer with shape, cutoff, resonance, envelope, and glide controls.
  - Polyphonic Chord Synthesizer with harmonic voicings and spread.

- **Pattern Sequencing & Composition:**
  - 16-step classic drum sequencer with per-step accents, velocity, and global swing/shuffle.
  - Interactive **Piano Roll** editor for basslines and melodic hooks.
  - **Chord Board** for auditioning and sequencing chord progressions across scales and keys.

- **Song Architecture & Arrangement:**
  - Multi-part song structure (Intro, Verse, Chorus, Bridge, Outro, etc.).
  - Global BPM, Key, and Meter with optional per-part overrides and instant "Adhere to Song" toggling.
  - Song timeline arrangement with pattern selection per part.

- **Effects Racks & Processing:**
  - Modular insert racks per track, group, and master bus.
  - Effects include Parametric EQ, Saturation/Distortion, Chorus, Delay, Reverb, Compressor, and Limiter.
  - Quick-sync effect parameters across all song parts with one click, or toggle "All parts" when adding new effects.

- **Studio Mixer Console:**
  - Multi-track channel strips with channel indicators, voice tags, and volume faders.
  - Pan controls, quick Mute (`M`) and Solo (`S`) toggles.
  - Live 14-segment vertical LED VU meters.
  - Master bus strip with stereo peak metering, master gain, global shuffle, and accent controls.

- **Zero Heavy Audio Dependencies:**
  - Built on raw, high-performance Web Audio API with a custom look-ahead scheduler for sample-accurate timing.
  - Automatic local storage persistence and JSON project file import/export.

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` or compatible package manager

### Installation

1. Clone or navigate to the repository:
   ```bash
   cd web-daw
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173/` in your browser.

---

## 🛠️ Scripts

- `npm run dev` - Launch the Vite development server with HMR.
- `npm run build` - Type-check with TypeScript and build production assets into `dist/`.
- `npm run preview` - Locally preview the production build.

---

## 🎧 Usage Note

For optimal audio performance and low latency:
- Use a modern Chromium-based browser (Chrome, Edge, Brave) or Firefox / Safari.
- Click anywhere on the interface or press the Play button to initialize the browser's `AudioContext`.
