import { useEffect, useRef } from 'react'

export type DocsPage = 'help' | 'log' | 'keys'

const DOCS_TITLE: Record<DocsPage, string> = {
  help: 'User Guide',
  log: 'Change log',
  keys: 'Shortcuts',
}

const DOCS_TESTID: Record<DocsPage, string> = {
  help: 'help-overlay',
  log: 'changelog-overlay',
  keys: 'shortcuts-overlay',
}

type DocsOverlayProps = {
  page: DocsPage
  onClose: () => void
}

export function DocsOverlay({ page, onClose }: DocsOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="docs-veil"
      data-testid={DOCS_TESTID[page]}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="docs-sheet" role="dialog" aria-modal="true" aria-labelledby="docs-title">
        <header className="docs-head">
          <div className="docs-brand">
            <span className="wordmark-kicker">LoopAnvil</span>
            <strong id="docs-title">{DOCS_TITLE[page]}</strong>
            <span className="wordmark-version">VERSION 1.8.1</span>
          </div>
          <button ref={closeRef} type="button" className="docs-close" aria-label="Close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="docs-body">
          {page === 'help' ? <HelpCopy /> : page === 'log' ? <ChangeLogCopy /> : <ShortcutsCopy />}
        </div>
      </section>
    </div>
  )
}

function HelpCopy() {
  return (
    <>
      <p className="docs-lead">LoopAnvil Studio LIVE is a browser studio for making songs and live sets that can be saved, shared, and changed in front of an audience. Songs are built from sections. Each section holds instruments with sequencer and/or piano-roll patterns, effects, and automation. Mixer is the fader overview, where tracks and groups can be muted, soloed, or automated, and where the master can be adjusted.</p>

      <h3>How to use</h3>
      <p>The interface consists of multiple parts:</p>
      <ul>
        <li>The <b>top bar</b> contains the transport controls, the master audio output view, and buttons to open/close the sidebars.</li>
        <li>The <b>left sidebar</b> of the screen contains the song structure.</li>
        <li>The <b>right sidebar</b> of the screen contains the instrument tracks.</li>
        <li>The <b>center Stage</b> contains the tools to adjust the selected track, its effects and automation of track properties, as well as the Mixer overview.</li>
      </ul>

      <h3>Top Bar: Transport and Master Output</h3>
      <p>The top bar contains the options for basic transport and changes the view of the interface:</p>
      <ul>
        <li>Song structure sidebar open/close: open or close the left sidebar to see the song structure.</li>
        <li>Song name: click the song name to change it.</li>
        <li>Song options: click the triangle to the right of the name for undo (Ctrl+Z), redo (Ctrl+Y or Ctrl+Shift+Z), duplicate of the selected section, instrument, or group (Ctrl+D), Copy content to (the selected track or group&apos;s steps and piano roll onto another section), Open/Save songs, MIDI-input (Device, Learn CC, Forget this fader), Reset to start over, User Guide, Shortcuts, and Change log.</li>
        <li>LoopAnvil Studio LIVE: the name of the product.</li>
        <li>Play/Stop: play or stop the song (Spacebar).</li>
        <li>Song settings: click the BPM, key, and meter next to Play to set song tempo, key, and meter, or to arm Record. Changing key transposes sections that still follow the song. Sections follow these unless customized. Arm record, then tap a track name or hold A–L and Z–M to write notes onto the sequencer.</li>
        <li>Master Output: a visualization of the master audio output. This is a visual representation of the audio output of the master track, showing the volume and pan of the track.</li>
        <li>Instrument tracks sidebar open/close: open or close the right sidebar to see the instrument tracks and groups.</li>
      </ul>

      <h3>Left Sidebar: Song structure</h3>
      <p>Each block on the left is a song section (Section A, Verse, Drop, Chorus, etc.). Click the section name to change it. The light in the top left shows the section&apos;s state:</p>
      <ul>
        <li>Unlit: not playing.</li>
        <li>Lit: currently playing.</li>
        <li>Blinking: the section is cued. Click once to play after the current section&apos;s repeat. Click again to play after the currently playing bar.</li>
      </ul>
      <p>Select a section to edit its settings:</p>
      <ul>
        <li>Bars: how many bars the section spans.</li>
        <li>Repeat: how many times the section repeats.</li>
        <li>Next: what plays next — the same section, another section, or stop.</li>
      </ul>
      <p>Open the chevron on a selected section to override the song BPM, key, and meter. A Custom tag appears next to any setting that differs from the song. Hover it until it glows red, then click to reset that setting. Adhere to song at the bottom resets BPM, key, and meter together:</p>
      <ul>
        <li>BPM: the tempo of the song section.</li>
        <li>Key: the musical key of the section, shown as an interval from the song (-12 to +12). Changing it chromatically transposes sequencer and piano-roll notes.</li>
        <li>Meter: the time signature of the section. This determines how many beats and steps are in a bar.</li>
      </ul>
      <p>Add section: the button at the bottom duplicates the selected section, adds it to the song structure, and links the selected section to the new one.</p>

      <h3>Tracks</h3>
      <p>The right sidebar contains the instrument tracks. Each track is a different instrument, and each track can have a different instrument, effects, and automation.</p>
      <p>Mixer: the top button opens the mixer for all tracks and groups in the center screen. The mixer shows the volume and pan of the tracks and groups, as well as the mute and solo status of the tracks and groups. Empty groups stay in the track list so you can add into them, but they do not take a bay in the mixer.</p>
      <p>Groups: the groups are a way to group tracks together. Every clean project is prepared with a group for the drums, a group for the bass, and a group for the melodic Instruments. Click the group name to view the sequencers of all instruments in a group. </p>
      <ul>
        <li>Color bar: a drag handle. Drag a group the change the order of groups or all the way to the bottom to delete the group. Click to open a color picker.</li>
        <li>Group name: click the name to edit the group name.</li>
        <li>M and S button: Hover over the group row to see the M and S buttons. This way you can mute or solo the entire group at once. </li>
        <li>Click the chevron to the right of a group name to open or close the group to show/hide the tracks inside the group.</li>
      </ul>
      <p>Tracks: click anywhere on a track row (except Mute, Solo, or the fire pad) to select it. Duplicate in the song menu (or Ctrl+D) applies to the selected section, instrument, or group. Copy content to writes the selected track or group&apos;s steps and piano-roll notes onto a section you pick, from the song menu or the section name in the stage header. Delete or Backspace removes the last clicked section, instrument, group, or effect.</p>
      <ul>
      <li>Color bar: a drag handle. Drag an instrument track to the change the order of tracks or all the way to the bottom to delete the track. Click to open a color picker.</li>
        <li>Track name: click the name to edit the track name.</li>
        <li>M and S button: Hover over the track row to see the M and S buttons to mute or solo the track.</li>
        <li>Fire light: drums play through to the end. Bass, lead, and chords use the channel (including effects); hold to keep the note ringing. On a group, the light fires every instrument in the group.</li>
      </ul>
      <p>Add track: each group has an Add track button, and the footer of the track list opens the same picker (plus Add group). An empty group in the center stage has Add track too; it opens the track list and that picker.</p>

      <h3>Center Stage</h3>
      <p>The center of the screen is where the magic happens. This is the main area where you can adjust the selected track, its effects and automation of track properties, as well as the Mixer overview.</p>
      <h4>Tracks and Groups view</h4>
      <p>When in Tracks and Groups view, the center stage is divided into multiple parts:</p>
      <ul>
        <li>The top part contains the sequencer and piano roll of the selected track. Press a piano-roll pitch (C4, and so on) to hear that note on the channel, even while the song is playing.</li>
        <li>Bars (in the dock): pick which bar you are editing, copy that bar to others, or press Follow to jump to the playing section and stay on the sounding bar.</li>
        <li>The middle part contains the effects and automation of the selected track.</li>
        <li>The bottom part contains the mixer of the selected track and group.</li>
      </ul>
      <h4>Mixer view</h4>
      <p>When Mixer is selected, the center stage is the mixer for all tracks and groups that have members. Adjust volume and pan of those tracks and groups at once.</p>
      <h4>Effects</h4>
      <p>The effects are the different effects that can be applied to the selected track, group or all tracks. Each effect has a different set of parameters that can be adjusted to change the sound.</p>
      <h4>Automation</h4>
      <p>The automation lane allows for a granular, pre-set change over time to effect sliders, and can be applied to instrument tracks, groups and all tracks. Automation cues set in the automation sequencer are linearly interpolated between set slider settings.</p>
      <h4>Chord builder</h4>
      <p>Bass and lead start with the root only; chord instruments start on the I triad (1–3–5). Pick the octave (C1–C5) so a bass can sit on C2 while a lead sits on C3. You can still add extra tones on a lead or bass, or strip a chord instrument down to a single note, then stamp that voicing onto the roll.</p>
      <p>Pedal, in the bass and melodic lists, holds while a step is filled. An empty step stops it. The same pitch keeps ringing, and a different pitch slides to the new note. A single step and a longer block, including a full bar, both sound. Mute stops it too. Glide sets the slide from a 1/16 note up to 8 beats, and whether that slide lands before the beat, on it, or after it. The bump at the start of a pedal note is an amplitude envelope: add ADSR on the instrument to shape attack, decay, sustain, and release.</p>
    </>
  )
}

function ShortcutsCopy() {
  return (
    <>
      <p className="docs-lead">Shortcuts are ignored while a name field is focused, and while User Guide, Shortcuts, or the change log is open. On Mac, use Cmd in place of Ctrl.</p>

      <h3>Global</h3>
      <div className="docs-keys">
        <div>
          <kbd>Space</kbd>
          <span>Play / Stop</span>
        </div>
        <div>
          <kbd>R</kbd>
          <span>Arm or disarm record</span>
        </div>
        <div>
          <kbd>Esc</kbd>
          <span>Close a menu or overlay</span>
        </div>
        <div>
          <kbd>Ctrl+Z</kbd>
          <span>Undo</span>
        </div>
        <div>
          <kbd>Ctrl+Y or Ctrl+Shift+Z</kbd>
          <span>Redo</span>
        </div>
        <div>
          <kbd>Ctrl+D</kbd>
          <span>Duplicate the selected section, instrument, or group</span>
        </div>
        <div>
          <kbd>Delete</kbd>
          <span>Delete the last clicked section, instrument, group, or effect (or a selected piano-roll note)</span>
        </div>
      </div>

      <h3>Mute and solo</h3>
      <p>Numbers follow track and group order from the top of the right sidebar. 1–9 is the first nine; 0 is the tenth. Numpad keys work the same way.</p>
      <div className="docs-keys">
        <div>
          <kbd>1–9 / 0</kbd>
          <span>Mute a track</span>
        </div>
        <div>
          <kbd>Ctrl+1–9 / 0</kbd>
          <span>Solo a track</span>
        </div>
        <div>
          <kbd>Shift+1–9 / 0</kbd>
          <span>Mute a group</span>
        </div>
        <div>
          <kbd>Ctrl+Shift+1–9 / 0</kbd>
          <span>Solo a group</span>
        </div>
      </div>

      <h3>Record</h3>
      <p>Open song settings (the BPM readout next to Play) and arm Record, then play. Click a track name to write the current step, or hold a pad for the next step. Pads follow the selected track, group, or Mixer order.</p>
      <div className="docs-keys">
        <div>
          <kbd>R</kbd>
          <span>Arm or disarm record</span>
        </div>
        <div>
          <kbd>A–L</kbd>
          <span>Pads 1–9</span>
        </div>
        <div>
          <kbd>Z–M</kbd>
          <span>Pads 10–16</span>
        </div>
      </div>
    </>
  )
}

function ChangeLogCopy() {
  return (
    <>
    <article className="docs-version">
        <h4>
          1.8.1<span></span>
        </h4>
        <ul>
          <li>Muted tracks keep M, S, and an unlit fire pad in place so hover no longer shifts the buttons.</li>
          <li>Piano roll fills leftover center-stage height and shrinks when other panels open.</li>
          <li>The bar pager is its own panel, the follow button is in the bar pager now, and the bar pager can be folded to save space.</li>
          <li>Reworked the top bar to be more compact and easier to use on very narrow screens.</li>
        </ul>
        <h3>
          1.8 <span>Console</span>
        </h3>
        <ul>
          <li>Mixer groups envelope nested tracks, with TR labels, group mute dimming those tracks, and the master color line on the right.</li>
          <li>Add track is on each group, empty Mixer, and the track-list footer. Song list uses Add section. Parts are labeled Sections in the UI.</li>
          <li>Top bar: song on the left, logo and LIVE in the center, play, BPM/key/meter, VU, and tracks on the right. Play, VU, and sidebar toggles share the same height.</li>
          <li>On short and phone layouts, expanded effects use their full height and the center stage scrolls. Mixer strips keep names, badges, and pan labels inside the channel.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.7 <span>Influence</span>
        </h3>
        <ul>
          <li>Sidebars on smaller screens hide automatically when not in use.</li>
          <li>Height of the center stage panels is reworked to fit better on most screen types.</li>
          <li>EXPERIMENTAL: MIDI Fader control through MIDI input and Learn CC (click a fader, Song Menu then Learn CC, and move a knob on a midi controller to link the fader to the knob).</li>
          <li>Mixer view (was All Tracks). Add track on each group, empty groups, and the track-list footer. Add section on the song list.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h4>
          1.6.3<span></span>
        </h4>
        <ul>
          <li>Chord builder bass notes (slash chords), full Color row, and quieter unconventional color keys.</li>
          <li>Piano-roll marquee select, group move, and Delete removes selected notes not the track.</li>
          <li>Updated logo for legibility.</li>
        </ul>
        <h4>
          1.6.2<span></span>
        </h4>
        <ul>
          <li>Added proper branding and logo.</li>
        </ul>
        <h4>
          1.6.1 <span></span>
        </h4>
        <ul>
          <li>Fixed the sound picker in center stage instrument name dropdown.</li>
          <li>Fixed the copy content to part menu to copy only the selected instrument.</li>
        </ul>
        <h3>
          1.6 <span>Utility</span>
        </h3>
        <ul>
          <li>Delete or Backspace short cuts remove the last clicked part, track, group, or effect.</li>
          <li>Copy (Ctrl+C), Paste (Ctrl+V) and Duplicate (Ctrl+D) parts, tracks and groups, and Copy content to other parts for the selected track or group (steps and piano roll only). These options live in the song menu. Copy also sits on the part name in the center stage header.</li>
          <li>Part, track, and group names truncate to fit and keep the last word.</li>
          <li>The fire light in the center stage header plays drums as one-shots, and bass or melody through the channel so you can audition the sound of the instrument including effects. Hold to sustain. A group light fires every instrument together.</li>
          <li>Press a piano-roll note name to audition that pitch while the song plays.</li>
          <li>Bass and lead catalogs are mono; keys, organ, stab, strings, and pad are poly. Pedal holds until an empty step.</li> 
          <li>Chord builder has an octave picker so placed notes in the piano roll and sequencer are in the correct octave.</li>
          <li>Custom part BPM, key, and meter can be reset independently.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.5 <span>Transpose</span>
        </h3>
        <ul>
          <li>Changing song or part key chromatically transposes sequencer and piano-roll notes. The picker lists keys from -12 to +12 relative to the song key.</li>
          <li>Chord builder defaults to the root on bass and lead, and to I (1–3–5) on chord instruments. Either type can still stamp chords or single notes.</li>
          <li>Added bass and melodic Pedal instruments. They hold while a step is filled, stop on an empty step, and slide when the pitch changes. The chord builder has an octave picker. Copy, paste, and duplicate live in the song menu.</li>         
          <li>Added glide effect: Glide sets that slide from 1/16 to 8 beats, before, on, or after the beat.</li>
          <li>Changed sidebar and top bar behavior to create more space to make the interface suitable for mobile devices.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.4 <span>Polish</span>
        </h3>
        <ul>
          <li>Record while playing: click a track name or press A-L and Z-M to write notes onto the sequencer.</li>
          <li>Tap tempo in Song Master.</li>
          <li>Mute/solo from the keyboard: numbers for channels, Shift for groups, Ctrl to solo.</li>
          <li>Added effect: Chance. Insert for tracks and groups, automatable per step.</li>
          <li>Undo and redo, including from the file menu.</li>
          <li>Instrument list: audition from the light, Mute/Solo on hover. Groups mute, solo, drag, delete, and recolor.</li>
          <li>Added Cue control in Song Parts: Click onceto cue a part after this repeat (blink), twice after to play after this bar (fast blink).</li>
          <li>Added Help, Shortcuts, and Change log to the interface.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.3 <span>Arrange</span>
        </h3>
        <ul>
          <li>Piano roll, per-instrument steps, and chord builder.</li>
          <li>Automation lanes and group faders.</li>
          <li>1-bar through 8-bar part lengths.</li>
          <li>Channel mute and solo controls.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.2 <span>Control</span>
        </h3>
        <ul>
          <li>Instrument tracks and groups.</li>
          <li>Mixer with volume and pan controls.</li>
          <li>Meter 3/4, 6/8, and 12/8 time signatures.</li>
          <li>Song parts with BPM, key, and meter.</li>
          <li>Insert racks and JSON save in the browser.</li>
          <li>Added effects.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.1 <span>Kit</span>
        </h3>
        <ul>
          <li>Synthesized 808 / 909 / rock kit, bass, lead, and chords with sequencers.</li>
          <li>Song BPM, key, and meter.</li>
        </ul>
      </article>
      <article className="docs-version">
        <h3>
          1.0 <span>808 sequencer</span>
        </h3>
        <ul>
          <li>808 sequencer with a kick, snare, and open and closed hi-hat.</li>
          <li>Song BPM.</li>
        </ul>
      </article>
    </>
  )
}
