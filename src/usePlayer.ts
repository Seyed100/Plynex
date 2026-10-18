import { useState, useEffect, useRef, useCallback } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Chapter, Media, PlayerState, Preferences } from "./types";

export const native = isTauri();
const initial: PlayerState = {
  ready: false,
  active: false,
  path: "",
  buffering: false,
  seeking: false,
  playing: false,
  time: 0,
  duration: 0,
  volume: 75,
  muted: false,
  speed: 1,
  tracks: [],
  chapters: [],
  chapter: 0,
  width: 0,
  height: 0,
  codec: "",
  hwdec: "",
  eof: false,
  sid: false,
  aid: false,
  title: "",
};

export function usePlayer(onError: (message: string) => void) {
  const [state, setState] = useState(initial);
  const video = useRef<HTMLVideoElement>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const preferenceTask = useRef<Promise<void>>(Promise.resolve());
  const prefsRef = useRef<Preferences | null>(null);
  const audioRef = useRef<{ context: AudioContext; gain: GainNode } | null>(
    null,
  );
  const cmd = useCallback(async (...command: unknown[]) => {
    if (!native) return;
    return invoke("player_command", { command });
  }, []);
  const safe = useCallback((promise: Promise<unknown>) => {
    void promise.catch((e) => errorRef.current(String(e)));
  }, []);

  useEffect(() => {
    if (!native) {
      setState((s) => ({ ...s, ready: true }));
      return;
    }
    let disposed = false;
    const cleanups: (() => void)[] = [];
    void (async () => {
      cleanups.push(
        await listen<Record<string, any>>("mpv-event", ({ payload: event }) => {
          if (event.event === "property-change") {
            const d = event.data;
            setState((s) => {
              switch (event.name) {
                case "time-pos":
                  return { ...s, time: typeof d === "number" ? d : 0 };
                case "duration":
                  return { ...s, duration: typeof d === "number" ? d : 0 };
                case "pause":
                  return { ...s, playing: d === false };
                case "volume":
                  return { ...s, volume: typeof d === "number" ? d : s.volume };
                case "mute":
                  return { ...s, muted: !!d };
                case "speed":
                  return { ...s, speed: d || 1 };
                case "track-list":
                  return { ...s, tracks: Array.isArray(d) ? d : [] };
                case "chapter-list":
                  return {
                    ...s,
                    chapters: Array.isArray(d)
                      ? d.map((c: Chapter, i: number) => ({
                          time: c.time,
                          title: c.title || `Chapter ${i + 1}`,
                        }))
                      : [],
                  };
                case "chapter":
                  return { ...s, chapter: Math.max(0, d || 0) };
                case "video-params":
                  return {
                    ...s,
                    width: d?.w || 0,
                    height: d?.h || 0,
                    codec: d?.pixelformat || "",
                  };
                case "hwdec-current":
                  return { ...s, hwdec: d || "" };
                case "eof-reached":
                  return { ...s, eof: !!d, playing: d ? false : s.playing };
                case "sid":
                  return { ...s, sid: d };
                case "aid":
                  return { ...s, aid: d };
                case "media-title":
                  return { ...s, title: d || "" };
                case "path":
                  return { ...s, path: typeof d === "string" ? d : "" };
                case "paused-for-cache":
                  return { ...s, buffering: !!d };
                case "seeking":
                  return { ...s, seeking: !!d };
                default:
                  return s;
              }
            });
          }
          if (event.event === "file-loaded")
            setState((s) => ({ ...s, active: true, eof: false }));
          if (event.event === "end-file" && event.reason === "error") {
            setState((s) => ({ ...s, active: false, playing: false }));
            errorRef.current(
              `Could not play this file: ${event.file_error || "unsupported or damaged media"}`,
            );
          }
        }),
      );
      cleanups.push(
        await listen("engine-disconnected", () => {
          if (!disposed) {
            setState((s) => ({ ...s, ready: false, playing: false }));
            errorRef.current(
              "The playback engine disconnected. Restart Plynex to reconnect.",
            );
          }
        }),
      );
      if (disposed) {
        cleanups.forEach((fn) => fn());
        return;
      }
      await invoke("engine_start");
      if (!disposed) setState((s) => ({ ...s, ready: true }));
    })().catch((e) => {
      errorRef.current(String(e));
    });
    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const applyPreferences = useCallback(
    (p: Preferences) => {
      const task = preferenceTask.current
        .catch(() => {})
        .then(async () => {
          const previous = prefsRef.current;
          if (native) {
            if (!previous || previous.volume !== p.volume)
              await cmd("set_property", "volume", p.volume);
            if (!previous || previous.speed !== p.speed)
              await cmd("set_property", "speed", p.speed);
            if (!previous || previous.hwdec !== p.hwdec)
              await cmd("set_property", "hwdec", p.hwdec ? "auto-safe" : "no");
            if (!previous || previous.subScale !== p.subScale)
              await cmd("set_property", "sub-scale", p.subScale);
            if (!previous || previous.subDelay !== p.subDelay)
              await cmd("set_property", "sub-delay", p.subDelay);
            if (!previous || previous.audioDelay !== p.audioDelay)
              await cmd("set_property", "audio-delay", p.audioDelay);
            if (!previous || previous.fit !== p.fit)
              await cmd("set_property", "panscan", p.fit === "cover" ? 1 : 0);
          } else {
            if (video.current) video.current.playbackRate = p.speed;
            setState((s) => ({ ...s, speed: p.speed, volume: p.volume }));
            if (p.volume > 100 && video.current && !audioRef.current) {
              const context = new AudioContext(),
                gain = context.createGain();
              context.createMediaElementSource(video.current).connect(gain);
              gain.connect(context.destination);
              audioRef.current = { context, gain };
              video.current.volume = 1;
            }
            if (audioRef.current) {
              audioRef.current.gain.gain.value = p.volume / 100;
              if (video.current) video.current.volume = 1;
              void audioRef.current.context.resume();
            } else if (video.current)
              video.current.volume = Math.min(1, p.volume / 100);
          }
          prefsRef.current = p;
        });
      preferenceTask.current = task;
      return task;
    },
    [cmd],
  );
  const load = useCallback(
    async (media: Media, start = 0) => {
      setState((s) => ({
        ...s,
        time: start,
        duration: 0,
        eof: false,
        active: false,
        chapters: [],
        tracks: [],
      }));
      if (native) {
        await invoke("load_media", { path: media.path, start });
      } else if (video.current) {
        video.current.src = media.url || media.path;
        const element = video.current;
        element.addEventListener(
          "loadedmetadata",
          () => {
            element.currentTime =
              Number.isFinite(element.duration) && start < element.duration - 2
                ? Math.max(0, start)
                : 0;
          },
          { once: true },
        );
        video.current.load();
        await audioRef.current?.context.resume();
        await video.current.play();
        setState((s) => ({ ...s, active: true, playing: true }));
      }
    },
    [cmd],
  );
  const toggle = useCallback(async () => {
    if (native) {
      if (state.eof) {
        await cmd("seek", 0, "absolute+exact");
        await cmd("set_property", "pause", false);
      } else await cmd("cycle", "pause");
    } else if (video.current) {
      if (video.current.paused) await video.current.play();
      else video.current.pause();
    }
  }, [cmd, state.eof]);
  const seek = useCallback(
    async (value: number, relative = false) => {
      if (native)
        await cmd(
          "seek",
          value,
          relative ? "relative+exact" : "absolute+exact",
        );
      else if (video.current)
        video.current.currentTime = Math.max(
          0,
          Math.min(
            video.current.duration || 0,
            relative ? video.current.currentTime + value : value,
          ),
        );
    },
    [cmd],
  );
  const volume = useCallback(
    async (value: number) => {
      const next = Math.max(0, Math.min(150, value));
      if (native) await cmd("set_property", "volume", next);
      else if (video.current) {
        if (!audioRef.current) {
          const context = new AudioContext();
          const gain = context.createGain();
          context.createMediaElementSource(video.current).connect(gain);
          gain.connect(context.destination);
          audioRef.current = { context, gain };
        }
        await audioRef.current.context.resume();
        audioRef.current.gain.gain.value = next / 100;
        video.current.volume = 1;
        setState((s) => ({ ...s, volume: next }));
      }
    },
    [cmd],
  );
  const mute = useCallback(async () => {
    if (native) await cmd("cycle", "mute");
    else if (video.current) {
      video.current.muted = !video.current.muted;
      setState((s) => ({ ...s, muted: video.current!.muted }));
    }
  }, [cmd]);
  const speed = useCallback(
    async (value: number) => {
      if (native) await cmd("set_property", "speed", value);
      else if (video.current) {
        video.current.playbackRate = value;
        setState((s) => ({ ...s, speed: value }));
      }
    },
    [cmd],
  );
  const stop = useCallback(async () => {
    if (native) await invoke("stop_media");
    else if (video.current) {
      video.current.pause();
      video.current.removeAttribute("src");
      video.current.load();
    }
    setState((s) => ({
      ...initial,
      ready: s.ready,
      volume: s.volume,
      muted: s.muted,
      speed: s.speed,
    }));
  }, [cmd]);
  const replay = useCallback(async () => {
    await seek(0);
    if (native) await cmd("set_property", "pause", false);
    else await video.current?.play();
  }, [seek, cmd]);
  const browserEvents = {
    onTimeUpdate: () => {
      const v = video.current!;
      setState((s) => ({ ...s, time: v.currentTime }));
    },
    onLoadedMetadata: () => {
      const v = video.current!;
      setState((s) => ({
        ...s,
        duration: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
        active: true,
      }));
    },
    onPlay: () => setState((s) => ({ ...s, playing: true, eof: false })),
    onPause: () => setState((s) => ({ ...s, playing: false })),
    onEnded: () => setState((s) => ({ ...s, eof: true, playing: false })),
    onError: () =>
      errorRef.current(
        "This browser cannot decode this file. Open it in the desktop app for mpv format support.",
      ),
  };
  return {
    state,
    video,
    cmd,
    safe,
    applyPreferences,
    load,
    toggle,
    seek,
    volume,
    mute,
    speed,
    stop,
    replay,
    browserEvents,
  };
}
