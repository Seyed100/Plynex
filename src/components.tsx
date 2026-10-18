import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  X,
  Plus,
  Play,
  FilmSlate,
  Trash,
  DotsThree,
  FolderOpen,
  MagnifyingGlass,
  Waveform,
} from "@phosphor-icons/react";
import type { Media, Chapter } from "./types";
import { formatTime } from "./types";

export function IconButton({
  children,
  label,
  onClick,
  active = false,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Range({
  label,
  value,
  max = 100,
  min = 0,
  step = 1,
  onChange,
  className = "",
}: {
  label: string;
  value: number;
  max?: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max || 1}
      step={step}
      value={Math.min(max, Math.max(min, value))}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`range ${className}`}
      style={
        {
          "--fill": `${((value - min) / (max - min || 1)) * 100}%`,
        } as CSSProperties
      }
    />
  );
}
export function SpeedLabel({ value }: { value: number }) {
  return (
    <span className="speed-value">
      <span className="speed-number">{value}</span>
      <X className="speed-multiplier" weight="regular" aria-hidden="true" />
    </span>
  );
}

export function SeekBar({
  time,
  duration,
  onSeek,
}: {
  time: number;
  duration: number;
  onSeek: (value: number) => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const dragging = useRef(false);
  const target = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );
  useEffect(() => {
    if (
      !dragging.current &&
      target.current !== null &&
      Math.abs(time - target.current) < 0.75
    ) {
      target.current = null;
      setPreview(null);
    }
  }, [time]);
  const point = (element: HTMLInputElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    // Use the actual thumb travel, not the input's default change-event order.
    return Math.max(
      0,
      Math.min(
        duration,
        ((clientX - rect.left - 6) / Math.max(1, rect.width - 12)) * duration,
      ),
    );
  };
  const commit = (value: number) => {
    target.current = value;
    setPreview(value);
    onSeek(value);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (!dragging.current) {
        target.current = null;
        setPreview(null);
      }
    }, 1500);
  };
  const position = preview ?? time;
  return (
    <div className="seek-block">
      <input
        className="range seek-range"
        type="range"
        aria-label="Seek video"
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(duration || 1, position)}
        style={
          {
            "--fill": `${(position / (duration || 1)) * 100}%`,
          } as CSSProperties
        }
        onPointerDown={(e) => {
          if (e.button !== 0 || !duration) return;
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          dragging.current = true;
          if (settle.current) clearTimeout(settle.current);
          target.current = point(e.currentTarget, e.clientX);
          setPreview(target.current);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragging.current) {
            e.preventDefault();
            target.current = point(e.currentTarget, e.clientX);
            setPreview(target.current);
          }
        }}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (!dragging.current) commit(value);
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          const value = point(e.currentTarget, e.clientX);
          dragging.current = false;
          commit(value);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          target.current = null;
          setPreview(null);
        }}
        onKeyDown={(e) => {
          let value: number | undefined;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown")
            value = position - 5;
          if (e.key === "ArrowRight" || e.key === "ArrowUp")
            value = position + 5;
          if (e.key === "Home") value = 0;
          if (e.key === "End") value = duration;
          if (e.key === "PageDown") value = position - 60;
          if (e.key === "PageUp") value = position + 60;
          if (value !== undefined) {
            e.preventDefault();
            e.stopPropagation();
            commit(Math.max(0, Math.min(duration, value)));
          }
        }}
      />
      <div className="time-labels">
        <span>{formatTime(position)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const first = ref.current?.querySelector<HTMLElement>(
      "button,input,select",
    );
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        );
        if (!items?.length) return;
        const a = items[0],
          b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Playlist({
  queue,
  current,
  onPlay,
  onAdd,
  onRemove,
  onClose,
  onClear,
  query,
  onQuery,
}: {
  queue: Media[];
  current: string;
  onPlay: (m: Media) => void;
  onAdd: () => void;
  onRemove: (m: Media) => void;
  onClose: () => void;
  onClear: () => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  const filtered = queue.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <aside className="playlist">
      <header>
        <h2>
          Up next <span>{queue.length.toString().padStart(2, "0")}</span>
        </h2>
        <div>
          <IconButton label="Add to playlist" onClick={onAdd}>
            <Plus />
          </IconButton>
          <IconButton label="Close playlist" onClick={onClose}>
            <X />
          </IconButton>
        </div>
      </header>
      {queue.length > 4 && (
        <label className="queue-search">
          <MagnifyingGlass />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Find in queue"
            aria-label="Find in queue"
          />
        </label>
      )}
      <div className="queue-items">
        {filtered.map((m, i) => (
          <div
            className={`queue-item ${m.path === current ? "current" : ""}`}
            key={m.path}
          >
            <button className="queue-play" onClick={() => onPlay(m)}>
              <span className={`queue-art ${m.sample ? "sample-art" : ""}`}>
                {!m.sample && <FilmSlate size={24} />}
                <span className="art-play">
                  <Play weight="fill" size={18} />
                </span>
              </span>
              <span className="queue-text">
                <strong>{m.name}</strong>
                <small>
                  {m.path === current
                    ? "Now selected"
                    : m.sample
                      ? "A 30-second visual escape"
                      : `Queue ${String(i + 1).padStart(2, "0")}`}
                </small>
              </span>
            </button>
            <IconButton
              label={`Remove ${m.name}`}
              className="queue-remove"
              onClick={() => onRemove(m)}
            >
              <X size={14} />
            </IconButton>
          </div>
        ))}
      </div>
      {!queue.length && (
        <div className="queue-empty">
          <FilmSlate size={32} />
          <p>A little room for your favorites.</p>
          <button className="text-button" onClick={onAdd}>
            Add your first film <Plus size={15} />
          </button>
        </div>
      )}
      <footer>
        <button className="text-button" onClick={onAdd}>
          <Plus size={15} /> Add files
        </button>
        {queue.length > 0 && (
          <button className="text-button muted" onClick={onClear}>
            Clear queue
          </button>
        )}
      </footer>
    </aside>
  );
}
export function ChapterRail({
  chapters,
  current,
  time,
  onSeek,
  sample,
  onOpen,
  onNext,
}: {
  chapters: Chapter[];
  current: number;
  time: number;
  onSeek: (s: number) => void;
  sample: boolean;
  onOpen: () => void;
  onNext: () => void;
}) {
  return (
    <section className="chapter-rail" aria-label="Video chapters">
      <div className="rail-heading">
        <span>THE SCENES</span>
        <span>
          {chapters.length
            ? `${chapters.length} chapters · Make yourself at home`
            : "Your next story is a click away"}
        </span>
      </div>
      {chapters.length > 0 ? (
        <div className="chapter-scroll">
          {chapters.map((c, i) => (
            <button
              key={`${c.time}-${i}`}
              className={`chapter-card ${current === i ? "selected" : ""}`}
              onClick={() => onSeek(c.time)}
            >
              <span
                className={`chapter-art ${sample ? "sample-art" : ""}`}
                style={{
                  backgroundPosition: `${i * 20}% ${i % 2 ? 60 : 40}%`,
                  backgroundSize: sample ? `${110 + i * 17}%` : "cover",
                }}
              >
                {!sample && <FilmSlate size={27} />}
                <span className="chapter-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {current === i && (
                  <span className="chapter-indicator">
                    <Waveform size={15} />
                  </span>
                )}
              </span>
              <span className="chapter-title">
                {i + 1}. {c.title}
              </span>
              <span className="chapter-time">
                {formatTime(c.time)}
                {current === i && time > c.time ? " · Playing" : ""}
              </span>
            </button>
          ))}
          <IconButton
            label="Next chapter"
            className="rail-next"
            onClick={onNext}
          >
            <DotsThree size={25} />
          </IconButton>
        </div>
      ) : (
        <button className="no-chapters" onClick={onOpen}>
          <FolderOpen size={27} />
          <span>
            <strong>Bring your own cinema.</strong>
            <small>Open a film, drop a folder, or press Ctrl + O.</small>
          </span>
          <Plus />
        </button>
      )}
    </section>
  );
}
export function Library({
  queue,
  onPlay,
  onAdd,
  onRemove,
}: {
  queue: Media[];
  onPlay: (m: Media) => void;
  onAdd: () => void;
  onRemove: (m: Media) => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  return (
    <section className="library">
      <header>
        <div>
          <p className="section-note">YOUR PERSONAL COLLECTION</p>
          <h1>A place for every story.</h1>
          <p>Your films. Your pace. Always close.</p>
        </div>
        <button className="primary-button" onClick={onAdd}>
          <Plus /> Add films
        </button>
      </header>
      <div className="library-grid">
        {queue.map((m) => (
          <article key={m.path} className="library-card">
            <button onClick={() => onPlay(m)}>
              <span className={`library-art ${m.sample ? "sample-art" : ""}`}>
                {!m.sample && <FilmSlate size={46} />}
                <span className="library-play">
                  <Play weight="fill" size={26} />
                </span>
                {m.sample && (
                  <span className="sample-label">
                    PLYNEX ORIGINAL · VISUAL STUDY
                  </span>
                )}
              </span>
              <h3>{m.name}</h3>
              <p>
                {m.sample
                  ? "30 seconds of stillness"
                  : "Local media · Ready to play"}
              </p>
            </button>
            <IconButton
              label={`Remove ${m.name} from library`}
              onClick={() => onRemove(m)}
            >
              <Trash size={18} />
            </IconButton>
          </article>
        ))}
        <button className="library-add" onClick={onAdd}>
          <FolderOpen size={35} />
          <strong>Something worth watching.</strong>
          <span>Add files from your computer</span>
        </button>
      </div>
      <input ref={search} hidden readOnly />
    </section>
  );
}
