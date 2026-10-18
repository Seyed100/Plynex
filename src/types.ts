export type Media = {
  path: string;
  name: string;
  sample?: boolean;
  url?: string;
};
export type Chapter = { title: string; time: number };
export type Track = {
  id: number;
  type: "audio" | "sub" | "video";
  title?: string;
  lang?: string;
  codec?: string;
  selected?: boolean;
  external?: boolean;
};
export type Theme = "dark" | "light" | "system";
export type Preferences = {
  theme: Theme;
  volume: number;
  speed: number;
  resume: boolean;
  autoplay: boolean;
  hwdec: boolean;
  subScale: number;
  subDelay: number;
  audioDelay: number;
  fit: "contain" | "cover";
  queue: Media[];
  positions: Record<string, number>;
};
export type PlayerState = {
  ready: boolean;
  active: boolean;
  path: string;
  buffering: boolean;
  seeking: boolean;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  speed: number;
  tracks: Track[];
  chapters: Chapter[];
  chapter: number;
  width: number;
  height: number;
  codec: string;
  hwdec: string;
  eof: boolean;
  sid: number | false;
  aid: number | false;
  title: string;
};
export const defaults: Preferences = {
  theme: "dark",
  volume: 75,
  speed: 1,
  resume: true,
  autoplay: true,
  hwdec: true,
  subScale: 1,
  subDelay: 0,
  audioDelay: 0,
  fit: "contain",
  queue: [],
  positions: {},
};
// Saved files can outlive several versions or be manually edited.
export function normalizePreferences(value: unknown): Preferences {
  const p =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const number = (key: keyof Preferences, min: number, max: number) =>
    typeof p[key] === "number" && Number.isFinite(p[key])
      ? Math.max(min, Math.min(max, p[key] as number))
      : (defaults[key] as number);
  const boolean = (key: keyof Preferences) =>
    typeof p[key] === "boolean"
      ? (p[key] as boolean)
      : (defaults[key] as boolean);
  return {
    theme: ["dark", "light", "system"].includes(p.theme as string)
      ? (p.theme as Theme)
      : defaults.theme,
    fit: p.fit === "cover" ? "cover" : "contain",
    volume: number("volume", 0, 150),
    speed: number("speed", 0.25, 4),
    subScale: number("subScale", 0.5, 3),
    subDelay: number("subDelay", -60, 60),
    audioDelay: number("audioDelay", -60, 60),
    resume: boolean("resume"),
    autoplay: boolean("autoplay"),
    hwdec: boolean("hwdec"),
    queue: Array.isArray(p.queue)
      ? p.queue
          .filter(
            (m): m is Media =>
              !!m &&
              typeof m.path === "string" &&
              typeof m.name === "string" &&
              !m.url &&
              !m.sample,
          )
          .slice(0, 2000)
      : [],
    positions:
      p.positions && typeof p.positions === "object"
        ? Object.fromEntries(
            Object.entries(p.positions)
              .filter(
                ([, v]) =>
                  typeof v === "number" && Number.isFinite(v) && v >= 0,
              )
              .slice(-2000),
          )
        : {},
  };
}
export const sampleChapters: Chapter[] = [
  { title: "Arrival", time: 0 },
  { title: "The coast", time: 5 },
  { title: "A softer light", time: 10 },
  { title: "Open water", time: 15 },
  { title: "Stillness", time: 20 },
  { title: "Home again", time: 25 },
];
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
