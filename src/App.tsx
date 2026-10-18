import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
  Subtitles,
  CornersOut,
  CornersIn,
  ListBullets,
  MagnifyingGlass,
  GearSix,
  Plus,
  Minus,
  Square,
  X,
  Sun,
  Moon,
  CaretRight,
  CaretDown,
  FolderOpen,
  FilmSlate,
  Check,
  Camera,
  PushPin,
  Repeat,
  Shuffle,
  WarningCircle,
  ArrowCounterClockwise,
  Keyboard,
  Waveform,
  Info,
} from "@phosphor-icons/react";
import { usePlayer, native } from "./usePlayer";
import {
  defaults,
  normalizePreferences,
  sampleChapters,
  formatTime,
  type Media,
  type Preferences,
} from "./types";
import {
  IconButton,
  Range,
  SeekBar,
  SpeedLabel,
  Playlist,
  ChapterRail,
  Library,
  Modal,
} from "./components";
import Settings from "./Settings";

type Panel =
  "settings" | "subtitles" | "audio" | "speed" | "search" | "info" | null;
const videoExtensions = [
  "mp4",
  "mkv",
  "avi",
  "mov",
  "webm",
  "m4v",
  "wmv",
  "flv",
  "ts",
  "mts",
  "m2ts",
  "mpeg",
  "mpg",
  "vob",
  "ogv",
  "3gp",
  "mp3",
  "flac",
  "wav",
  "ogg",
  "m4a",
  "aac",
  "opus",
];
const subtitleExtensions = [
  "srt",
  "ass",
  "ssa",
  "vtt",
  "sub",
  "idx",
  "smi",
  "sup",
];
function localPreferences(): Preferences {
  try {
    return normalizePreferences(
      JSON.parse(localStorage.getItem("plynex.preferences") || "{}"),
    );
  } catch {
    return defaults;
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<Preferences>(localPreferences);
  const [hydrated, setHydrated] = useState(!native);
  const [queue, setQueue] = useState<Media[]>(prefs.queue);
  const [current, setCurrent] = useState<Media | null>(null);
  const [view, setView] = useState<"home" | "library" | "chapters">("home");
  const [playlist, setPlaylist] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [queueQuery, setQueueQuery] = useState("");
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [hideChrome, setHideChrome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [systemDark, setSystemDark] = useState(
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const videoArea = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const positionRef = useRef(prefs.positions);
  const loadedPath = useRef("");
  const loadSequence = useRef(0);
  const initialized = useRef(false);
  const currentRef = useRef(current);
  currentRef.current = current;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const notice = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  const player = usePlayer(
    useCallback(
      (message: string) => {
        notice(message, true);
        setBusy(false);
      },
      [notice],
    ),
  );
  const { state } = player;
  const dark = prefs.theme === "system" ? systemDark : prefs.theme === "dark";
  const closePanel = useCallback(() => setPanel(null), []);
  const safe = player.safe;
  const chapters = state.chapters.length
    ? state.chapters
    : current?.sample || !current
      ? sampleChapters
      : [];
  const chapterIndex = state.chapters.length
    ? state.chapter
    : Math.max(
        0,
        chapters.reduce((index, c, i) => (c.time <= state.time ? i : index), 0),
      );
  const sample = !current || !!current.sample;

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSystemDark(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.error ? 9000 : 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!native) return;
    let disposed = false;
    void (async () => {
      const data = await invoke<Partial<Preferences>>("load_preferences");
      if (disposed) return;
      const merged = normalizePreferences({
        ...defaults,
        ...localPreferences(),
        ...data,
      });
      setPrefs(merged);
      positionRef.current = merged.positions;
      setQueue(merged.queue.filter((m) => !m.url && !m.sample));
      setHydrated(true);
    })().catch((e) => {
      notice(String(e), true);
      setHydrated(true);
    });
    return () => {
      disposed = true;
    };
  }, [notice]);
  useEffect(() => {
    if (!state.ready || !hydrated || initialized.current) return;
    initialized.current = true;
    safe(player.applyPreferences(prefsRef.current));
  }, [state.ready, hydrated, player.applyPreferences, safe]);
  useEffect(() => {
    if (!hydrated) return;
    const value = {
      ...prefs,
      queue: queue.filter((m) => !m.url),
      positions: positionRef.current,
    };
    localStorage.setItem("plynex.preferences", JSON.stringify(value));
    const id = setTimeout(() => {
      if (native) safe(invoke("save_preferences", { data: value }));
    }, 500);
    return () => clearTimeout(id);
  }, [prefs, queue, hydrated, safe]);
  useEffect(() => {
    if (
      current &&
      state.active &&
      (!native || state.path === current.path) &&
      state.time > 0
    )
      positionRef.current[current.path] =
        state.eof || (state.duration > 0 && state.time > state.duration - 2)
          ? 0
          : state.time;
  }, [
    current,
    state.time,
    state.eof,
    state.active,
    state.path,
    state.duration,
  ]);
  useEffect(() => {
    const save = () => {
      if (!hydrated) return;
      const value = {
        ...prefsRef.current,
        queue: queue.filter((m) => !m.url),
        positions: positionRef.current,
      };
      localStorage.setItem("plynex.preferences", JSON.stringify(value));
      if (native)
        void invoke("save_preferences", { data: value }).catch(console.error);
    };
    const id = setInterval(save, 5000);
    window.addEventListener("beforeunload", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", save);
    };
  }, [queue, hydrated]);
  const updatePrefs = useCallback(
    (patch: Partial<Preferences>) => {
      setPrefs((p) => ({ ...p, ...patch }));
      if (state.ready) {
        const next = { ...prefsRef.current, ...patch };
        safe(player.applyPreferences(next));
      }
    },
    [state.ready, player.applyPreferences, safe],
  );

  const play = useCallback(
    async (media: Media) => {
      if (!state.ready) {
        notice("The playback engine is still starting.", true);
        return;
      }
      setBusy(true);
      const sequence = ++loadSequence.current;
      setPlaylist(false);
      setCurrent(media);
      setView("home");
      loadedPath.current = media.path;
      const start = prefsRef.current.resume
        ? positionRef.current[media.path] || 0
        : 0;
      try {
        await player.load(media, start);
        if (start > 2 && sequence === loadSequence.current)
          notice(`Resumed at ${formatTime(start)}`);
      } catch (e) {
        if (sequence === loadSequence.current) {
          notice(String(e), true);
          setCurrent(null);
        }
      } finally {
        if (sequence === loadSequence.current) setBusy(false);
      }
    },
    [state.ready, player.load, notice],
  );
  const addPaths = useCallback(
    async (paths: string[]) => {
      const subtitle = paths.find((p) =>
        subtitleExtensions.includes(p.split(".").pop()?.toLowerCase() || ""),
      );
      if (subtitle) {
        if (!currentRef.current) {
          notice("Open a film before adding subtitles.", true);
        } else {
          await player.cmd("sub-add", subtitle, "select");
          notice("Subtitle added.");
        }
        return;
      }
      const files = await invoke<Media[]>("collect_media", { paths });
      if (!files.length) {
        notice("No supported media files were found.", true);
        return;
      }
      setQueue((q) => [
        ...q,
        ...files.filter((m) => !q.some((existing) => existing.path === m.path)),
      ]);
      await play(files[0]);
    },
    [play, player.cmd, notice],
  );
  const trySample = useCallback(async () => {
    const path = native
      ? await invoke<string>("sample_media")
      : "/quiet-horizon.mp4";
    const media = { path, name: "The Quiet Horizon", sample: true };
    setQueue((q) => (q.some((m) => m.path === path) ? q : [...q, media]));
    await play(media);
  }, [play]);
  const openFiles = useCallback(async () => {
    if (!native) {
      fileInput.current?.click();
      return;
    }
    const paths = await open({
      multiple: true,
      title: "Open your next story",
      filters: [{ name: "Video & audio", extensions: videoExtensions }],
    });
    if (paths) await addPaths(Array.isArray(paths) ? paths : [paths]);
  }, [addPaths]);
  const closeFilm = useCallback(async () => {
    ++loadSequence.current;
    await player.stop();
    setBusy(false);
    setCurrent(null);
    setView("home");
    setPanel(null);
    setHideChrome(false);
  }, [player.stop]);
  const openFolder = useCallback(async () => {
    if (!native) {
      notice("Folder import is available in the desktop app.");
      return;
    }
    const path = await open({ directory: true, title: "Add a media folder" });
    if (path) await addPaths(Array.isArray(path) ? path : [path]);
  }, [addPaths, notice]);
  const openSubtitles = useCallback(async () => {
    if (!current) {
      notice("Open a film before adding subtitles.", true);
      return;
    }
    if (!native) {
      subtitleInput.current?.click();
      return;
    }
    const path = await open({
      title: "Add subtitle",
      filters: [{ name: "Subtitles", extensions: subtitleExtensions }],
    });
    if (typeof path === "string") {
      await player.cmd("sub-add", path, "select");
      notice("Subtitle added.");
    }
  }, [current, player.cmd, notice]);
  useEffect(() => {
    if (!native) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void listen<string[]>("files-dropped", ({ payload }) =>
      safe(addPaths(payload)),
    ).then((fn) => {
      if (cancelled) fn();
      else off = fn;
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [addPaths, safe]);

  const next = useCallback(
    (direction = 1) => {
      if (!queue.length) return;
      const index = queue.findIndex((m) => m.path === current?.path);
      const target =
        shuffle && queue.length > 1
          ? (index + 1 + Math.floor(Math.random() * (queue.length - 1))) %
            queue.length
          : (index + direction + queue.length) % queue.length;
      safe(play(queue[target]));
    },
    [queue, current, shuffle, play, safe],
  );
  const eofHandled = useRef(false);
  useEffect(() => {
    if (!state.eof) {
      eofHandled.current = false;
      return;
    }
    if (eofHandled.current) return;
    eofHandled.current = true;
    if (current) positionRef.current[current.path] = 0;
    if (repeat) {
      safe(player.replay());
    } else if (
      prefs.autoplay &&
      queue.length > 1 &&
      (shuffle ||
        queue.findIndex((m) => m.path === current?.path) < queue.length - 1)
    )
      next();
  }, [
    state.eof,
    repeat,
    prefs.autoplay,
    queue.length,
    next,
    current,
    player.seek,
    player.toggle,
    player.replay,
    shuffle,
    safe,
  ]);
  const togglePlay = useCallback(() => {
    if (!current) {
      const m = queue.find((m) => m.sample) || queue[0];
      if (m) safe(play(m));
      else safe(openFiles());
    } else if (!state.active && !busy) safe(play(current));
    else safe(player.toggle());
  }, [
    current,
    queue,
    play,
    player.toggle,
    safe,
    openFiles,
    state.active,
    busy,
  ]);
  const toggleFullscreen = useCallback(async () => {
    const value = !fullscreen;
    if (native) await getCurrentWindow().setFullscreen(value);
    else if (value) await document.documentElement.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
    setFullscreen(value);
  }, [fullscreen]);
  useEffect(() => {
    if (native) return;
    const cb = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", cb);
    return () => document.removeEventListener("fullscreenchange", cb);
  }, []);
  const capture = useCallback(async () => {
    if (!current) {
      notice("Open a film first.", true);
      return;
    }
    if (!native) {
      notice("Save screenshots in the desktop app.");
      return;
    }
    const path = await invoke<string>("screenshot");
    notice(`Saved to ${path}`);
  }, [current, notice]);
  const jumpChapter = useCallback(
    (direction: number) => {
      if (!chapters.length) return;
      const target =
        chapters[
          Math.max(0, Math.min(chapters.length - 1, chapterIndex + direction))
        ];
      if (!current) {
        const m = queue.find((m) => m.sample);
        if (m) safe(play(m).then(() => player.seek(target.time)));
      } else safe(player.seek(target.time));
    },
    [chapters, chapterIndex, current, queue, play, player.seek, safe],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.matches(
          "input,select,textarea,[contenteditable]",
        )
      )
        return;
      if (e.key === "Escape") {
        setPanel(null);
        if (fullscreen) safe(toggleFullscreen());
        return;
      }
      if (panel) return;
      const ctrl = e.ctrlKey || e.metaKey;
      let handled = true;
      if (ctrl && e.key.toLowerCase() === "o")
        safe(e.shiftKey ? openSubtitles() : openFiles());
      else if (ctrl && e.key === ",") setPanel("settings");
      else if (ctrl) handled = false;
      else
        switch (e.key.toLowerCase()) {
          case " ":
          case "k":
            togglePlay();
            break;
          case "arrowleft":
            if (current) safe(player.seek(e.shiftKey ? -60 : -5, true));
            break;
          case "arrowright":
            if (current) safe(player.seek(e.shiftKey ? 60 : 5, true));
            break;
          case "arrowup":
            updatePrefs({ volume: Math.min(150, state.volume + 5) });
            notice(`Volume ${Math.min(150, Math.round(state.volume + 5))}%`);
            break;
          case "arrowdown":
            updatePrefs({ volume: Math.max(0, state.volume - 5) });
            notice(`Volume ${Math.max(0, Math.round(state.volume - 5))}%`);
            break;
          case "m":
            safe(player.mute());
            break;
          case "f":
            safe(toggleFullscreen());
            break;
          case "l":
            setPlaylist((p) => !p);
            break;
          case "n":
            next(1);
            break;
          case "p":
            next(-1);
            break;
          case "[":
            jumpChapter(-1);
            break;
          case "]":
            jumpChapter(1);
            break;
          case "+":
          case "=":
            updatePrefs({
              speed: Math.min(4, Math.round((state.speed + 0.25) * 100) / 100),
            });
            break;
          case "-":
            updatePrefs({
              speed: Math.max(
                0.25,
                Math.round((state.speed - 0.25) * 100) / 100,
              ),
            });
            break;
          case "v":
            if (native && current) safe(player.cmd("cycle", "sub-visibility"));
            break;
          case "s":
            safe(capture());
            break;
          case "?":
            setPanel("settings");
            break;
          default:
            handled = false;
        }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    current,
    panel,
    fullscreen,
    openFiles,
    openSubtitles,
    player.seek,
    player.mute,
    player.cmd,
    updatePrefs,
    state.volume,
    state.speed,
    togglePlay,
    toggleFullscreen,
    next,
    jumpChapter,
    capture,
    notice,
    safe,
  ]);

  useEffect(() => {
    if (!native) return;
    const update = () => {
      const r = videoArea.current?.getBoundingClientRect();
      if (!r) return;
      const scale = window.devicePixelRatio;
      safe(
        invoke("video_bounds", {
          x: Math.round(r.x * scale),
          y: Math.round(r.y * scale),
          width: Math.round(r.width * scale),
          height: Math.round(r.height * scale),
          visible: !!current && state.active && view !== "library",
        }),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (videoArea.current) observer.observe(videoArea.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [current, state.active, view, fullscreen, pinned, playlist, safe]);
  useEffect(() => {
    if (
      !current ||
      !state.playing ||
      panel ||
      playlist ||
      view === "library" ||
      view === "chapters"
    ) {
      setHideChrome(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const move = () => {
      setHideChrome(false);
      clearTimeout(timer);
      timer = setTimeout(() => setHideChrome(true), 2800);
    };
    move();
    const nearControls = (e: PointerEvent) => {
      if (e.clientY < 105 || e.clientY > window.innerHeight - 195) move();
    };
    window.addEventListener("pointermove", nearControls);
    window.addEventListener("keydown", move);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", nearControls);
      window.removeEventListener("keydown", move);
    };
  }, [current, state.playing, panel, playlist, view]);
  const remove = (m: Media) =>
    setQueue((q) => q.filter((f) => f.path !== m.path));
  const selectedTitle = current?.name || "The Quiet Horizon";

  return (
    <main
      className={`app ${fullscreen ? "fullscreen" : ""} ${hideChrome ? "chrome-hidden" : ""} ${view === "library" ? "library-view" : ""} ${!current ? "empty-view" : ""} ${current && view !== "library" ? "watching" : ""} ${playlist ? "with-queue" : ""} ${view === "chapters" ? "chapters-view" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (native) return;
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const media = files.map((f) => ({
          name: f.name.replace(/\.[^.]+$/, ""),
          path: f.name,
          url: URL.createObjectURL(f),
        }));
        setQueue((q) => [...q, ...media]);
        if (media[0]) safe(play(media[0]));
      }}
    >
      {native && !fullscreen && (
        <div className="resize-handles" aria-hidden="true">
          {(
            [
              "North",
              "South",
              "East",
              "West",
              "NorthEast",
              "NorthWest",
              "SouthEast",
              "SouthWest",
            ] as const
          ).map((direction) => (
            <div
              key={direction}
              className={`resize-edge resize-${direction.toLowerCase()}`}
              onPointerDown={(e) => {
                if (e.button === 0)
                  safe(getCurrentWindow().startResizeDragging(direction));
              }}
            />
          ))}
        </div>
      )}
      <header
        className="topbar"
        data-tauri-drag-region
        onDoubleClick={(e) => {
          if (native && (e.target as HTMLElement).classList.contains("topbar"))
            safe(getCurrentWindow().toggleMaximize());
        }}
      >
        <button
          className="brand"
          aria-label="Plynex home"
          onClick={() => setView("home")}
        >
          <img
            className="brand-icon"
            src="/plynex.png"
            alt=""
            aria-hidden="true"
          />
          <span>
            plynex<span className="brand-dot">.</span>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {(["home", "library", "chapters"] as const).map((v) => (
            <button
              key={v}
              className={view === v ? "selected" : ""}
              onClick={() => {
                setView(v === "chapters" && view === "chapters" ? "home" : v);
                if (v === "chapters")
                  document
                    .querySelector(".chapter-rail")
                    ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
        <div className="topbar-space" data-tauri-drag-region />
        <div className="topbar-actions">
          <button className="open-button" onClick={() => safe(openFiles())}>
            <Plus size={16} />
            <span>Open film</span>
            <kbd>Ctrl O</kbd>
          </button>
          <IconButton label="Search library" onClick={() => setPanel("search")}>
            <MagnifyingGlass />
          </IconButton>
          <IconButton
            label={dark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => updatePrefs({ theme: dark ? "light" : "dark" })}
          >
            {dark ? <Sun /> : <Moon />}
          </IconButton>
          <IconButton label="Settings" onClick={() => setPanel("settings")}>
            <GearSix />
          </IconButton>
          <IconButton
            label="Toggle playlist"
            active={playlist}
            onClick={() => setPlaylist((p) => !p)}
          >
            <ListBullets />
            {queue.length > 0 && <span className="notification-dot" />}
          </IconButton>
        </div>
        {native && (
          <div className="window-controls">
            <IconButton
              label="Minimize window"
              onClick={() => safe(getCurrentWindow().minimize())}
            >
              <Minus size={14} />
            </IconButton>
            <IconButton
              label="Maximize window"
              onClick={() => safe(getCurrentWindow().toggleMaximize())}
            >
              <Square size={12} />
            </IconButton>
            <IconButton
              label="Close window"
              className="window-close"
              onClick={() => safe(getCurrentWindow().close())}
            >
              <X size={15} />
            </IconButton>
          </div>
        )}
      </header>
      {!current && view !== "library" && (
        <section className="welcome" aria-label="Open a video">
          <div className="welcome-content">
            <div className="drop-zone">
              <span className="welcome-icon">
                <FilmSlate size={43} weight="light" />
              </span>
              <h1>A little space for your next story.</h1>
              <p>Drop a video here, or choose something to watch.</p>
              <button
                className="primary-button"
                onClick={() => safe(openFiles())}
              >
                <FolderOpen size={19} /> Open a video <kbd>Ctrl O</kbd>
              </button>
              <span className="welcome-formats">
                MKV, MP4, AVI, MOV, WebM & more
              </span>
            </div>
            <div className="welcome-options">
              <button
                className="text-button"
                onClick={() => safe(openFolder())}
              >
                <FolderOpen size={16} /> Open a folder
              </button>
              <span>·</span>
              <button className="text-button" onClick={() => safe(trySample())}>
                <Play size={14} /> Try a sample
              </button>
            </div>
          </div>
          <footer className="welcome-footer">
            <span>
              <span className={`status-dot ${state.ready ? "ready" : ""}`} />
              {state.ready
                ? native
                  ? "Native playback is ready"
                  : "Browser preview"
                : "Starting playback engine…"}
            </span>
            <span>Made for the way you watch.</span>
            <button
              className="text-button"
              onClick={() => setPanel("settings")}
            >
              <Keyboard size={15} /> Shortcuts
            </button>
          </footer>
        </section>
      )}
      <div
        className="player-view"
        style={{ display: view === "library" || !current ? "none" : undefined }}
      >
        <section
          className={`stage ${sample ? "is-sample" : ""} ${state.active && native && current ? "native-playing" : ""}`}
          aria-label="Video player"
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest("button,.playlist"))
              safe(toggleFullscreen());
          }}
        >
          <div
            ref={videoArea}
            className="video-area"
            onClick={(e) => {
              if (e.target === e.currentTarget) togglePlay();
            }}
          />
          {(!state.active || !native) && (
            <div className={`poster ${sample ? "sample-art" : ""}`}>
              {!sample && <FilmSlate size={64} />}
            </div>
          )}
          {!native && (
            <video
              ref={player.video}
              className={`browser-video ${state.active ? "visible" : ""}`}
              playsInline
              {...player.browserEvents}
              onClick={togglePlay}
              style={{ objectFit: prefs.fit }}
            />
          )}
          <div className="stage-top">
            <span className="stage-label">
              <span />
              {current ? "NOW WATCHING" : "PLYNEX ORIGINAL"}
            </span>
            <div className="stage-utilities">
              <IconButton label="Close video" onClick={() => safe(closeFilm())}>
                <X size={19} />
              </IconButton>
              <IconButton
                label="Save screenshot (S)"
                onClick={() => safe(capture())}
              >
                <Camera size={19} />
              </IconButton>
              <IconButton
                label="Media information"
                onClick={() => setPanel("info")}
              >
                <Info size={19} />
              </IconButton>
            </div>
          </div>
          {playlist && (
            <Playlist
              queue={queue}
              current={current?.path || ""}
              onPlay={(m) => safe(play(m))}
              onAdd={() => safe(openFiles())}
              onRemove={remove}
              onClose={() => setPlaylist(false)}
              onClear={() => setQueue([])}
              query={queueQuery}
              onQuery={setQueueQuery}
            />
          )}
          {(busy || state.buffering) && (
            <div className="loading">
              <span />
              {busy ? "Opening your story…" : "Buffering…"}
            </div>
          )}
          {!current && (
            <button
              className="center-play"
              onClick={togglePlay}
              aria-label="Play The Quiet Horizon"
            >
              <Play size={28} weight="fill" />
            </button>
          )}
          <div className="film-info">
            <div className="film-meta">
              <span>{sample ? "A VISUAL STUDY" : "FROM YOUR COLLECTION"}</span>
              <span className="meta-dot" />
              {state.width > 0 ? (
                <span>
                  {state.width} × {state.height}
                </span>
              ) : (
                <span>
                  {sample ? "30 SECONDS OF STILLNESS" : "LOCAL MEDIA"}
                </span>
              )}
            </div>
            <button className="film-title" onClick={() => setPanel("info")}>
              <span>{selectedTitle}</span>
              <CaretRight size={22} />
            </button>
            <p>
              {chapters.length
                ? `Chapter ${chapterIndex + 1} · ${chapters[chapterIndex]?.title || ""}`
                : "Settle in. The rest can wait."}
            </p>
          </div>
          <div className="stage-bottom-line" />
        </section>
        <section className="controls" aria-label="Playback controls">
          <SeekBar
            time={state.time}
            duration={state.duration || (sample ? 30 : 0)}
            onSeek={(value) => {
              if (current) safe(player.seek(value));
            }}
          />
          <div className="transport">
            <IconButton
              label="Shuffle"
              active={shuffle}
              className="subtle-control"
              onClick={() => {
                setShuffle((s) => !s);
                notice(shuffle ? "Shuffle off" : "Shuffle on");
              }}
            >
              <Shuffle size={18} />
            </IconButton>
            <IconButton label="Previous file (P)" onClick={() => next(-1)}>
              <SkipBack weight="fill" size={21} />
            </IconButton>
            <IconButton
              label={state.playing ? "Pause (Space)" : "Play (Space)"}
              className="play-button"
              disabled={busy}
              onClick={togglePlay}
            >
              {state.playing ? (
                <Pause weight="fill" size={25} />
              ) : (
                <Play weight="fill" size={25} />
              )}
            </IconButton>
            <IconButton label="Next file (N)" onClick={() => next(1)}>
              <SkipForward weight="fill" size={21} />
            </IconButton>
            <IconButton
              label="Repeat current film"
              active={repeat}
              className="subtle-control"
              onClick={() => {
                setRepeat((r) => !r);
                notice(repeat ? "Repeat off" : "Repeat on");
              }}
            >
              <Repeat size={18} />
            </IconButton>
          </div>
          <div className="right-controls">
            <div className="volume-control">
              <IconButton
                label="Mute / unmute (M)"
                onClick={() => safe(player.mute())}
              >
                {state.muted || state.volume === 0 ? (
                  <SpeakerSlash />
                ) : (
                  <SpeakerHigh />
                )}
              </IconButton>
              <Range
                label="Volume"
                value={state.muted ? 0 : state.volume}
                max={150}
                onChange={(volume) => updatePrefs({ volume })}
              />
              <span className="volume-number">
                {Math.round(state.volume)}
                <small>%</small>
              </span>
            </div>
            <button
              className="speed-button"
              onClick={() => setPanel("speed")}
              aria-label="Playback speed"
            >
              <SpeedLabel value={state.speed} />
            </button>
            <IconButton
              label="Subtitles"
              active={!!state.sid}
              onClick={() => setPanel("subtitles")}
            >
              <Subtitles />
            </IconButton>
            <IconButton label="Audio tracks" onClick={() => setPanel("audio")}>
              <Waveform />
            </IconButton>
            <IconButton
              label="Fullscreen (F)"
              onClick={() => safe(toggleFullscreen())}
            >
              {fullscreen ? <CornersIn /> : <CornersOut />}
            </IconButton>
          </div>
        </section>
        <ChapterRail
          chapters={chapters}
          current={chapterIndex}
          time={state.time}
          sample={sample}
          onSeek={(time) => {
            if (current) safe(player.seek(time));
            else {
              const m = queue.find((m) => m.sample);
              if (m) safe(play(m).then(() => player.seek(time)));
            }
          }}
          onOpen={() => safe(openFiles())}
          onNext={() => jumpChapter(1)}
        />
        <footer className="statusbar">
          <span>
            <span className={`status-dot ${state.ready ? "ready" : ""}`} />
            {state.ready
              ? native
                ? "Native playback · mpv"
                : "Browser preview"
              : "Starting playback engine…"}
          </span>
          <span>A quieter way to watch.</span>
          <button onClick={() => setPanel("settings")}>
            <Keyboard size={14} />
            <span>Keyboard shortcuts</span>
            <kbd>?</kbd>
          </button>
        </footer>
      </div>
      {view === "library" && (
        <Library
          queue={queue}
          onPlay={(m) => safe(play(m))}
          onAdd={() => safe(openFiles())}
          onRemove={remove}
        />
      )}
      {panel === "settings" && (
        <Settings
          prefs={prefs}
          state={state}
          onChange={updatePrefs}
          onClose={closePanel}
          onOpenSubtitles={() => safe(openSubtitles())}
        />
      )}
      {panel === "search" && (
        <Modal
          title="Find your next story."
          subtitle={`${queue.length} films in your collection`}
          onClose={closePanel}
        >
          <label className="search-input">
            <MagnifyingGlass />
            <input
              autoFocus
              aria-label="Search films"
              placeholder="Search your collection…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="search-results">
            {queue
              .filter((m) =>
                m.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((m) => (
                <button
                  key={m.path}
                  onClick={() => {
                    safe(play(m));
                    closePanel();
                  }}
                >
                  <FilmSlate />
                  <span>{m.name}</span>
                  <Play weight="fill" />
                </button>
              ))}
            {!queue.some((m) =>
              m.name.toLowerCase().includes(search.toLowerCase()),
            ) && <p>No films found. Add something you love.</p>}
          </div>
          <button
            className="secondary-button"
            onClick={() => safe(openFolder())}
          >
            <FolderOpen size={18} /> Add a folder
          </button>
        </Modal>
      )}
      {(panel === "subtitles" || panel === "audio") && (
        <Modal
          title={
            panel === "subtitles"
              ? "Every word. Every detail."
              : "A sound of your own."
          }
          subtitle={
            panel === "subtitles"
              ? "Choose a subtitle track or bring your own."
              : "Choose from the audio tracks in this film."
          }
          onClose={closePanel}
        >
          <div className="track-list">
            {panel === "subtitles" && (
              <button
                onClick={() => safe(player.cmd("set_property", "sid", "no"))}
              >
                <Subtitles />
                <span>Subtitles off</span>
                {!state.sid && <Check />}
              </button>
            )}
            {state.tracks
              .filter(
                (t) => t.type === (panel === "subtitles" ? "sub" : "audio"),
              )
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    safe(
                      player.cmd(
                        "set_property",
                        panel === "subtitles" ? "sid" : "aid",
                        t.id,
                      ),
                    )
                  }
                >
                  {panel === "subtitles" ? <Subtitles /> : <SpeakerHigh />}
                  <span>
                    <strong>{t.title || t.lang || `Track ${t.id}`}</strong>
                    <small>
                      {[t.lang, t.codec, t.external ? "External file" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  {t.selected && <Check />}
                </button>
              ))}
          </div>
          {!state.tracks.some(
            (t) => t.type === (panel === "subtitles" ? "sub" : "audio"),
          ) && (
            <p className="empty-message">
              {current
                ? "No embedded tracks found."
                : "Open a film to see its available tracks."}
            </p>
          )}
          {panel === "subtitles" && (
            <>
              <button
                className="primary-button"
                onClick={() => safe(openSubtitles())}
              >
                <Plus size={18} /> Add subtitle file
              </button>
              <button
                className="text-button settings-link"
                onClick={() => setPanel("settings")}
              >
                Subtitle size & synchronization <CaretRight />
              </button>
            </>
          )}
        </Modal>
      )}
      {panel === "speed" && (
        <Modal
          title="At your own pace."
          subtitle="Playback speed"
          onClose={closePanel}
        >
          <div className="speed-grid">
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4].map((v) => (
              <button
                className={state.speed === v ? "selected" : ""}
                aria-label={`${v}×${v === 1 ? " Normal" : ""}`}
                key={v}
                onClick={() => {
                  updatePrefs({ speed: v });
                  closePanel();
                }}
              >
                <SpeedLabel value={v} />
                <small>{v === 1 ? "Normal" : "\u00a0"}</small>
                {state.speed === v && (
                  <Check
                    className="speed-selected-mark"
                    size={11}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {panel === "info" && (
        <Modal
          title={selectedTitle}
          subtitle={current ? "Media information" : "Plynex · Visual study"}
          onClose={closePanel}
        >
          <div className="media-info">
            <span>Location</span>
            <strong className="file-path">
              {current?.path || "Bundled sample film"}
            </strong>
            <span>Duration</span>
            <strong>{formatTime(state.duration || (sample ? 30 : 0))}</strong>
            <span>Video</span>
            <strong>
              {state.width ? `${state.width} × ${state.height}` : "Not playing"}
            </strong>
            <span>Decoder</span>
            <strong>{state.hwdec || "Not active"}</strong>
            <span>Audio tracks</span>
            <strong>
              {state.tracks.filter((t) => t.type === "audio").length}
            </strong>
            <span>Subtitle tracks</span>
            <strong>
              {state.tracks.filter((t) => t.type === "sub").length}
            </strong>
            <span>Chapters</span>
            <strong>{chapters.length}</strong>
          </div>
          <button className="secondary-button" onClick={() => safe(capture())}>
            <Camera size={18} /> Save current frame
          </button>
          <button
            className="text-button settings-link"
            onClick={() => {
              const next = !pinned;
              if (native) safe(getCurrentWindow().setAlwaysOnTop(next));
              else notice("Always on top is available in the desktop app.");
              setPinned(next);
            }}
          >
            <PushPin size={17} />
            {pinned ? "Disable always on top" : "Keep window on top"}
            {pinned && <Check />}
          </button>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <WarningCircle size={21} /> : <Check size={19} />}
          <span>{toast.text}</span>
          <IconButton
            label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept="video/*,audio/*,.mkv,.avi,.flac"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          const media = files.map((f) => ({
            path: f.name,
            name: f.name.replace(/\.[^.]+$/, ""),
            url: URL.createObjectURL(f),
          }));
          setQueue((q) => [...q, ...media]);
          if (media[0]) safe(play(media[0]));
          e.target.value = "";
        }}
      />
      <input
        ref={subtitleInput}
        type="file"
        hidden
        accept=".vtt,.srt"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !player.video.current) return;
          let text = await file.text();
          if (!text.startsWith("WEBVTT"))
            text =
              "WEBVTT\n\n" +
              text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
          const track = document.createElement("track");
          track.kind = "subtitles";
          track.label = file.name;
          track.src = URL.createObjectURL(
            new Blob([text], { type: "text/vtt" }),
          );
          track.default = true;
          player.video.current.appendChild(track);
          track.track.mode = "showing";
          notice("Subtitle added.");
          e.target.value = "";
        }}
      />
    </main>
  );
}
