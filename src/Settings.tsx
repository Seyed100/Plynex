import { useState } from "react";
import {
  SlidersHorizontal,
  PlayCircle,
  Subtitles,
  Keyboard,
  Info,
  SpeakerHigh,
  Moon,
  Sun,
  Desktop,
  Check,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { Modal, Range } from "./components";
import type { PlayerState, Preferences } from "./types";
import { native } from "./usePlayer";

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={`toggle ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}
function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export default function Settings({
  prefs,
  onChange,
  onClose,
  state,
  onOpenSubtitles,
}: {
  prefs: Preferences;
  onChange: (p: Partial<Preferences>) => void;
  onClose: () => void;
  state: PlayerState;
  onOpenSubtitles: () => void;
}) {
  const [tab, setTab] = useState("general");
  const tabs = [
    ["general", "Appearance", SlidersHorizontal],
    ["playback", "Playback", PlayCircle],
    ["audio", "Audio", SpeakerHigh],
    ["subtitles", "Subtitles", Subtitles],
    ["shortcuts", "Shortcuts", Keyboard],
    ["about", "About Plynex", Info],
  ] as const;
  return (
    <Modal
      title="Make it yours."
      subtitle="Small details. A better way to watch."
      onClose={onClose}
      wide
    >
      <div className="settings-body">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={tab === id ? "selected" : ""}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === "general" && (
            <>
              <h3>A little light. Or a little less.</h3>
              <p className="settings-intro">
                A warm, considered space for whatever you watch.
              </p>
              <div className="theme-options">
                {(
                  [
                    ["dark", "After hours", Moon],
                    ["light", "Morning light", Sun],
                    ["system", "Follow system", Desktop],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    className={`theme-option ${id} ${prefs.theme === id ? "selected" : ""}`}
                    key={id}
                    onClick={() => onChange({ theme: id })}
                  >
                    <span className="theme-preview">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span>
                      <Icon size={17} />
                      {label}
                      {prefs.theme === id && <Check size={15} />}
                    </span>
                  </button>
                ))}
              </div>
              <Row
                title="Remember where you left off"
                description="Continue from your last position, even after restarting."
              >
                <Toggle
                  label="Remember playback position"
                  value={prefs.resume}
                  onChange={(resume) => onChange({ resume })}
                />
              </Row>
              <Row
                title="Play the next film"
                description="Keep your queue moving when a video ends."
              >
                <Toggle
                  label="Automatically play next file"
                  value={prefs.autoplay}
                  onChange={(autoplay) => onChange({ autoplay })}
                />
              </Row>
              <div className="palette">
                <span style={{ background: "#1a1a1a" }} />
                <span style={{ background: "#2e2e2e" }} />
                <span style={{ background: "#d4b896" }} />
                <span style={{ background: "#e7d8c9" }} />
                <span style={{ background: "#f5f5f4" }} />
                <small>Warm Neutral · A quieter palette</small>
              </div>
            </>
          )}
          {tab === "playback" && (
            <>
              <h3>Every frame, considered.</h3>
              <Row
                title="Hardware decoding"
                description="Let your GPU decode compatible videos with less CPU usage."
              >
                <Toggle
                  label="Hardware decoding"
                  value={prefs.hwdec}
                  onChange={(hwdec) => onChange({ hwdec })}
                />
              </Row>
              <Row title="Default playback speed">
                <select
                  aria-label="Default playback speed"
                  value={prefs.speed}
                  onChange={(e) => onChange({ speed: Number(e.target.value) })}
                >
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {v}×{v === 1 ? " · Normal" : ""}
                    </option>
                  ))}
                </select>
              </Row>
              <Row
                title="Picture fit"
                description="Keep the original proportions, or fill the video frame."
              >
                <select
                  aria-label="Picture fit"
                  value={prefs.fit}
                  onChange={(e) =>
                    onChange({ fit: e.target.value as Preferences["fit"] })
                  }
                >
                  <option value="contain">Original aspect ratio</option>
                  <option value="cover">Fill frame</option>
                </select>
              </Row>
              <div className="info-box">
                {state.active ? (
                  <>
                    <strong>Current stream</strong>
                    <p>
                      {state.width} × {state.height} ·{" "}
                      {state.codec || "Audio only"}
                    </p>
                    <p>
                      Decoder:{" "}
                      {state.hwdec && state.hwdec !== "no"
                        ? state.hwdec
                        : "Software"}
                    </p>
                  </>
                ) : (
                  <p>Open a film to inspect its video stream and decoder.</p>
                )}
              </div>
            </>
          )}
          {tab === "audio" && (
            <>
              <h3>Find your perfect level.</h3>
              <Row
                title="Volume"
                description="Software amplification up to 150%."
              >
                <span className="setting-value">
                  {Math.round(prefs.volume)}%
                </span>
              </Row>
              <Range
                label="Default volume"
                value={prefs.volume}
                max={150}
                onChange={(volume) => onChange({ volume })}
              />
              <div className="range-labels">
                <span>Silent</span>
                <span>100%</span>
                <span>150%</span>
              </div>
              <Row
                title="Audio synchronization"
                description="Positive values delay sound. Measured in seconds."
              >
                <input
                  aria-label="Audio delay in seconds"
                  type="number"
                  min={-30}
                  max={30}
                  step={0.1}
                  value={prefs.audioDelay}
                  onChange={(e) =>
                    onChange({ audioDelay: Number(e.target.value) })
                  }
                />
              </Row>
              <p className="fine-print">
                Audio and subtitle tracks can be selected from the controls
                while watching.
              </p>
            </>
          )}
          {tab === "subtitles" && (
            <>
              <h3>Every word belongs.</h3>
              <Row
                title="Add a subtitle file"
                description="SRT, ASS, SSA, VTT, SUB and more."
              >
                <button className="secondary-button" onClick={onOpenSubtitles}>
                  Browse files <ArrowSquareOut size={15} />
                </button>
              </Row>
              <Row title="Subtitle size">
                <span className="setting-value">
                  {Math.round(prefs.subScale * 100)}%
                </span>
              </Row>
              <Range
                label="Subtitle font size"
                min={0.5}
                max={2}
                step={0.05}
                value={prefs.subScale}
                onChange={(subScale) => onChange({ subScale })}
              />
              <div
                className="subtitle-preview"
                style={{ fontSize: 18 * prefs.subScale }}
              >
                <span dir="rtl">هر داستان، دنیایی تازه است.</span>
                <span>Every story is a world of its own.</span>
              </div>
              <Row
                title="Subtitle synchronization"
                description="Positive values show subtitles later. In seconds."
              >
                <input
                  aria-label="Subtitle delay in seconds"
                  type="number"
                  min={-600}
                  max={600}
                  step={0.1}
                  value={prefs.subDelay}
                  onChange={(e) =>
                    onChange({ subDelay: Number(e.target.value) })
                  }
                />
              </Row>
              <p className="fine-print">
                Persian and Arabic shaping, embedded fonts and styled ASS
                subtitles are rendered by mpv/libass. A matching subtitle beside
                the video loads automatically.
              </p>
            </>
          )}
          {tab === "shortcuts" && (
            <>
              <h3>Keep your hands on the story.</h3>
              <div className="shortcut-list">
                {[
                  ["Play / pause", "Space / K"],
                  ["Seek backward / forward", "← / →"],
                  ["Seek by one minute", "Shift + ← / →"],
                  ["Volume up / down", "↑ / ↓"],
                  ["Mute / unmute", "M"],
                  ["Fullscreen / exit", "F / Esc"],
                  ["Open media files", "Ctrl + O"],
                  ["Add subtitle file", "Ctrl + Shift + O"],
                  ["Previous / next file", "P / N"],
                  ["Previous / next chapter", "[ / ]"],
                  ["Playback speed", "− / +"],
                  ["Toggle playlist", "L"],
                  ["Toggle subtitles", "V"],
                  ["Save screenshot", "S"],
                  ["Settings", "Ctrl + ,"],
                  ["Show keyboard shortcuts", "?"],
                ].map(([label, key]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <kbd>{key}</kbd>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "about" && (
            <div className="about">
              <img src="/plynex.png" alt="Plynex icon" />
              <h3>Plynex</h3>
              <p className="about-tagline">A quieter way to watch.</p>
              <span className="version">Version 0.2.0 · Windows & Linux</span>
              <p>
                Made for the moments between everything else.
                <br />
                Rust at the core. mpv at the heart.
              </p>
              <div className="about-detail">
                <span>Interface</span>
                <strong>Tauri 2 · React · Phosphor</strong>
                <span>Playback</span>
                <strong>
                  {native ? "Native mpv · FFmpeg · libass" : "Browser preview"}
                </strong>
                <span>Typography</span>
                <strong>Manrope · Vazirmatn</strong>
                <span>License</span>
                <strong>GPL-3.0-or-later</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
