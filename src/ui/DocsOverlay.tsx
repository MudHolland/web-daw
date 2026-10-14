import { useEffect, useRef } from 'react'

export type DocsPage = 'help' | 'log' | 'keys'

const DOCS_TITLE: Record<DocsPage, string> = {
  help: 'Help',
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
            <span className="wordmark-kicker">Groove box</span>
            <strong id="docs-title">{DOCS_TITLE[page]}</strong>
            <span className="wordmark-version">VERSION 1.4</span>
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
      <p className="docs-lead">Beat Forge is a browser groovebox for making songs and live sets that can be saved, shared, and changed in front of an audience. Songs are built from parts. Each part holds instruments with sequencer and/or piano-roll patterns, effects, and automation. All Tracks is the mixer, where tracks and groups can be muted, soloed, or automated, and where the master can be adjusted.</p>

      <h3>How to use</h3>
      <p>The interface consists of multiple parts:</p>
      <ul>
        <li>The <b>top bar</b> contains the transport controls, the master audio output view, and buttons to open/close the sidebars.</li>
        <li>The <b>left sidebar</b> of the screen contains the song structure.</li>
        <li>The <b>right sidebar</b> of the screen contains the instrument tracks.</li>
        <li>The <b>center Stage</b> contains the tools to adjust the selected track, its effects and automation of track properties, as well as the mixer when in All Tracks overview.</li>
      </ul>

      <h3>Top Bar: Transport and Master Output</h3>
      <p>The top bar contains the options for basic transport and changes the view of the interface:</p>
      <ul>
        <li>Song structure sidebar open/close: open or close the left sidebar to see the song structure.</li>
        <li>Song name: click the song name to change it.</li>
        <li>Song options: click the triangle to the right of the name for undo (Ctrl+Z), redo (Ctrl+Y or Ctrl+Shift+Z), Open/Save songs, Reset to start over, Help, Shortcuts, and Change log.</li>
        <li>Beat Forge: the name of the product.</li>
        <li>LIVE: follow the sounding part and show the playing bar.</li>
        <li>Record: arm recording, then tap a track name or hold A-L an Z-M to write notes onto the sequencer.</li>
        <li>Play/Stop: play or stop the song (Spacebar).</li>
        <li>Song Settings: open Song Master to set the song BPM, key, and meter. Parts follow these unless customized.</li>
        <li>Master Output: a visualization of the master audio output. This is a visual representation of the audio output of the master track, showing the volume and pan of the track.</li>
        <li>Instrument tracks sidebar open/close: open or close the right sidebar to see the instrument tracks and groups.</li>
      </ul>

      <h3>Left Sidebar: Song structure</h3>
      <p>Each block on the left is a song part (Part A, Verse, Drop, Chorus, etc.). Click the part name to change it. The light in the top left shows the part&apos;s state:</p>
      <ul>
        <li>Unlit: not playing.</li>
        <li>Lit: currently playing.</li>
        <li>Blinking: the part is cued. Click once to play after the current part&apos;s repeat. Click again to play after the currently playing bar.</li>
      </ul>
      <p>Select a part to edit its settings:</p>
      <ul>
        <li>Bars: how many bars the part spans.</li>
        <li>Repeat: how many times the part repeats.</li>
        <li>Next: what plays next — the same part, another part, or stop.</li>
      </ul>
      <p>Open the chevron on a selected part to override the song BPM, key, and meter. If a part differs from the song, it shows a custom tag and an Adhere to song button:</p>
      <ul>
        <li>BPM: the tempo of the song part.</li>
        <li>Key: the musical key of the part. This sets the scale used by the chord board, bass, and piano roll.</li>
        <li>Meter: the time signature of the part. This determines how many beats and steps are in a bar.</li>
      </ul>
      <p>Add button: the button at the bottom adds a part by duplicating the selected part and adding it to the song structure and linking the selected part to the newly added part. </p>

      <h3>Tracks</h3>
      <p>The right sidebar contains the instrument tracks. Each track is a different instrument, and each track can have a different instrument, effects, and automation.</p>
      <p>All Tracks: the top line shows the mixer for all tracks and groups in the center screen. The mixer shows the volume and pan of the tracks and groups, as well as the mute and solo status of the tracks and groups.</p>
      <p>Groups: the groups are a way to group tracks together. Every clean project is prepared with a group for the drums, a group for the bass, and a group for the melodic Instruments. Click the group name to view the sequencers of all instruments in a group. </p>
      <ul>
        <li>Color bar: a drag handle. Drag a group the change the order of groups or all the way to the bottom to delete the group. Click to open a color picker.</li>
        <li>Group name: click the name to edit the group name.</li>
        <li>M and S button: Hover over the group row to see the M and S buttons. This way you can mute or solo the entire group at once. </li>
        <li>Click the chevron to the right of a group name to open or close the group to show/hide the tracks inside the group.</li>
      </ul>
      <p>Tracks: the tracks are the individual instruments in a group. Click the track name to view the sequencer and/or piano roll of the instrument. </p>
      <ul>
      <li>Color bar: a drag handle. Drag an instrument track to the change the order of tracks or all the way to the bottom to delete the track. Click to open a color picker.</li>
        <li>Track name: click the name to edit the track name.</li>
        <li>M and S button: Hover over the track row to see the M and S buttons to mute or solo the track.</li>
      </ul>
      <p>Add button: the button at the bottom opens a menu to add a group or any instrument.</p>

      <h3>Center Stage</h3>
      <p>The center of the screen is where the magic happens. This is the main area where you can adjust the selected track, its effects and automation of track properties, as well as the mixer when in All Tracks overview.</p>
      <h4>Tracks and Groups view</h4>
      <p>When in Tracks and Groups view, the center stage is divided into multiple parts:</p>
      <ul>
        <li>The top part contains the sequencer and piano roll of the selected track.</li>
        <li>The middle part contains the effects and automation of the selected track.</li>
        <li>The bottom part contains the mixer of the selected track and group.</li>
      </ul>
      <h4>All Tracks view</h4>
      <p>When in All Tracks view, the center stage is the mixer for all tracks and groups. This is the main area where you can adjust the volume and pan of all tracks and groups at once.</p>
      <h4>Effects</h4>
      <p>The effects are the different effects that can be applied to the selected track, group or all tracks. Each effect has a different set of parameters that can be adjusted to change the sound.</p>
      <h4>Automation</h4>
      <p>The automation lane allows for a granular, pre-set change over time to effect sliders, and can be applied to instrument tracks, groups and all tracks. Automation cues set in the automation sequencer are linearly interpolated between set slider settings.</p>
    </>
  )
}

function ShortcutsCopy() {
  return (
    <>
      <p className="docs-lead">Shortcuts are ignored while a name field is focused, and while Help, Shortcuts, or the change log is open. On Mac, use Cmd in place of Ctrl.</p>

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
          <kbd>Delete</kbd>
          <span>Remove the selected piano-roll note</span>
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
      <p>Arm record, then play. Click a track name to write the current step, or hold a pad for the next step. Pads follow the selected track, group, or All Tracks order.</p>
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
          <li>Improved sounds.</li>
          <li>Song parts with BPM, key, and meter.</li>
          <li>Insert racks, mixer, and JSON save in the browser.</li>
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
    </>
  )
}
