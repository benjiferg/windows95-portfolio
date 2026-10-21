"use client"

import { useSyncExternalStore } from "react"

/* ------------------------------------------------------------------ */
/*  User settings (Display Properties, Taskbar, Sounds...) persisted   */
/*  to localStorage.                                                   */
/* ------------------------------------------------------------------ */

export type ScreenSaverId = "none" | "marquee" | "mystify" | "starfield" | "flyingwindows" | "blank"

export interface Settings {
  colorScheme: string
  wallpaper: string | null
  wallpaperMode: "tile" | "center" | "stretch"
  pattern: string | null
  screenSaver: ScreenSaverId
  screenSaverWait: number // minutes
  marqueeText: string
  soundsEnabled: boolean
  volume: number
  muted: boolean
  showClock: boolean
  clock24: boolean
  taskbarAutoHide: boolean
  showWelcome: boolean
  booted: boolean
  iconPositions: Record<string, { x: number; y: number }>
  recentDocs: string[]
  customWallpapers: Record<string, string>
}

const DEFAULTS: Settings = {
  colorScheme: "Windows Standard",
  wallpaper: null,
  wallpaperMode: "tile",
  pattern: null,
  screenSaver: "marquee",
  screenSaverWait: 5,
  marqueeText: "Benjamin Ferguson",
  soundsEnabled: true,
  volume: 70,
  muted: false,
  showClock: true,
  clock24: false,
  taskbarAutoHide: false,
  showWelcome: true,
  booted: false,
  iconPositions: {},
  recentDocs: [],
  customWallpapers: {},
}

const KEY = "w95.settings.v1"

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

let state: Settings = DEFAULTS
let loaded = false
const listeners = new Set<() => void>()

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    state = load()
    loaded = true
  }
}

export const settings = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  get(): Settings {
    ensureLoaded()
    return state
  },
  set(patch: Partial<Settings>) {
    ensureLoaded()
    state = { ...state, ...patch }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore quota */
    }
    listeners.forEach((l) => l())
  },
  reset() {
    state = DEFAULTS
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  },
  addRecent(path: string) {
    const list = [path, ...state.recentDocs.filter((p) => p !== path)].slice(0, 15)
    settings.set({ recentDocs: list })
  },
}

export function useSettings(): Settings {
  return useSyncExternalStore(settings.subscribe, settings.get, () => DEFAULTS)
}

/* ------------------------------------------------------------------ */
/*  Color schemes (approximations of the Windows 95 presets)           */
/* ------------------------------------------------------------------ */

export interface Scheme {
  face: string
  light: string
  hilight: string
  shadow: string
  dkshadow: string
  desktop: string
  activeTitle: string
  activeTitleText: string
  inactiveTitle: string
  inactiveTitleText: string
  highlight: string
  highlightText: string
  window: string
  windowText: string
  grayText: string
  menu: string
  menuText: string
  appWorkspace: string
}

const base: Scheme = {
  face: "#c0c0c0",
  light: "#dfdfdf",
  hilight: "#ffffff",
  shadow: "#808080",
  dkshadow: "#0a0a0a",
  desktop: "#008080",
  activeTitle: "#000080",
  activeTitleText: "#ffffff",
  inactiveTitle: "#808080",
  inactiveTitleText: "#c0c0c0",
  highlight: "#000080",
  highlightText: "#ffffff",
  window: "#ffffff",
  windowText: "#000000",
  grayText: "#808080",
  menu: "#c0c0c0",
  menuText: "#000000",
  appWorkspace: "#808080",
}

function s(p: Partial<Scheme>): Scheme {
  return { ...base, ...p }
}

export const colorSchemes: Record<string, Scheme> = {
  "Windows Standard": base,
  Brick: s({ desktop: "#808000", activeTitle: "#800000", inactiveTitle: "#808040", highlight: "#800000" }),
  Desert: s({
    face: "#d5ccbb",
    light: "#e8e3d7",
    shadow: "#a28d68",
    desktop: "#a28d68",
    activeTitle: "#008080",
    inactiveTitle: "#a28d68",
    highlight: "#008080",
    menu: "#d5ccbb",
    appWorkspace: "#a28d68",
  }),
  Eggplant: s({
    face: "#c0c0c0",
    desktop: "#404040",
    activeTitle: "#008080",
    inactiveTitle: "#808080",
    highlight: "#800080",
    window: "#ffffff",
  }),
  Lilac: s({
    face: "#c0b0c0",
    light: "#d8ccd8",
    shadow: "#806080",
    desktop: "#8080c0",
    activeTitle: "#800080",
    inactiveTitle: "#a08aa0",
    highlight: "#800080",
    menu: "#c0b0c0",
  }),
  Maple: s({ desktop: "#404000", activeTitle: "#800000", inactiveTitle: "#808000", highlight: "#800000" }),
  "Marine (high color)": s({
    face: "#80c0c0",
    light: "#a8d8d8",
    shadow: "#408080",
    dkshadow: "#004040",
    desktop: "#008080",
    activeTitle: "#000080",
    inactiveTitle: "#408080",
    highlight: "#000080",
    menu: "#80c0c0",
    window: "#ffffff",
    appWorkspace: "#408080",
  }),
  Plum: s({
    face: "#c0a0c0",
    light: "#d8c4d8",
    shadow: "#806080",
    desktop: "#400040",
    activeTitle: "#800080",
    inactiveTitle: "#a080a0",
    highlight: "#800080",
    menu: "#c0a0c0",
  }),
  Pumpkin: s({ desktop: "#804000", activeTitle: "#ff8000", activeTitleText: "#000000", inactiveTitle: "#808040", highlight: "#ff8000", highlightText: "#000000" }),
  "Rainy Day": s({
    face: "#808080",
    light: "#a0a0a0",
    hilight: "#c0c0c0",
    shadow: "#404040",
    dkshadow: "#000000",
    desktop: "#404040",
    activeTitle: "#000040",
    inactiveTitle: "#404040",
    highlight: "#000080",
    window: "#c0c0c0",
    menu: "#808080",
    appWorkspace: "#404040",
  }),
  "Red, White, and Blue": s({ desktop: "#000080", activeTitle: "#ff0000", inactiveTitle: "#808080", highlight: "#ff0000", window: "#ffffff" }),
  Rose: s({
    face: "#cfafb7",
    light: "#e0c8ce",
    shadow: "#9f5f7f",
    desktop: "#808080",
    activeTitle: "#9f5f7f",
    inactiveTitle: "#cfafb7",
    inactiveTitleText: "#000000",
    highlight: "#9f5f7f",
    menu: "#cfafb7",
  }),
  Slate: s({
    face: "#c0c0c0",
    desktop: "#000040",
    activeTitle: "#404080",
    inactiveTitle: "#808080",
    highlight: "#404080",
  }),
  Spruce: s({ desktop: "#000040", activeTitle: "#008040", inactiveTitle: "#808040", highlight: "#008040" }),
  Storm: s({
    face: "#808080",
    light: "#a0a0a0",
    hilight: "#c0c0c0",
    shadow: "#404040",
    dkshadow: "#000000",
    desktop: "#000000",
    activeTitle: "#808080",
    inactiveTitle: "#404040",
    highlight: "#808080",
    window: "#c0c0c0",
    menu: "#808080",
  }),
  Teal: s({ desktop: "#008080", activeTitle: "#008080", inactiveTitle: "#808080", highlight: "#008080" }),
  Wheat: s({
    face: "#d8d0b8",
    light: "#e8e4d4",
    shadow: "#a09070",
    desktop: "#808040",
    activeTitle: "#808000",
    inactiveTitle: "#a09070",
    highlight: "#808000",
    menu: "#d8d0b8",
  }),
  "High Contrast Black": s({
    face: "#000000",
    light: "#808080",
    hilight: "#ffffff",
    shadow: "#808080",
    dkshadow: "#ffffff",
    desktop: "#000000",
    activeTitle: "#800080",
    inactiveTitle: "#008080",
    highlight: "#008000",
    window: "#000000",
    windowText: "#ffffff",
    menu: "#000000",
    menuText: "#ffffff",
    grayText: "#00ff00",
  }),
  "High Contrast White": s({
    face: "#ffffff",
    light: "#ffffff",
    shadow: "#808080",
    dkshadow: "#000000",
    desktop: "#ffffff",
    activeTitle: "#000000",
    inactiveTitle: "#ffffff",
    inactiveTitleText: "#000000",
    highlight: "#000000",
    window: "#ffffff",
    menu: "#ffffff",
  }),
}

export function applyScheme(name: string) {
  const sc = colorSchemes[name] ?? base
  const root = document.documentElement.style
  root.setProperty("--face", sc.face)
  root.setProperty("--light", sc.light)
  root.setProperty("--hilight", sc.hilight)
  root.setProperty("--shadow", sc.shadow)
  root.setProperty("--dkshadow", sc.dkshadow)
  root.setProperty("--desktop", sc.desktop)
  root.setProperty("--active-title", sc.activeTitle)
  root.setProperty("--active-title-text", sc.activeTitleText)
  root.setProperty("--inactive-title", sc.inactiveTitle)
  root.setProperty("--inactive-title-text", sc.inactiveTitleText)
  root.setProperty("--highlight", sc.highlight)
  root.setProperty("--highlight-text", sc.highlightText)
  root.setProperty("--window", sc.window)
  root.setProperty("--window-text", sc.windowText)
  root.setProperty("--gray-text", sc.grayText)
  root.setProperty("--menu", sc.menu)
  root.setProperty("--menu-text", sc.menuText)
  root.setProperty("--app-workspace", sc.appWorkspace)
}

/* ------------------------------------------------------------------ */
/*  Wallpapers & patterns — procedurally generated SVG tiles           */
/* ------------------------------------------------------------------ */

function svg(w: number, h: number, body: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>${body}</svg>`,
  )}`
}

export const wallpapers: Record<string, string> = {
  "Black Thatch": svg(
    16,
    16,
    `<rect width='16' height='16' fill='#000'/><path d='M0 0h8v1H0zM2 2h8v1H2zM4 4h8v1H4zM6 6h8v1H6zM8 8h8v1H8zM0 10h6v1H0zM12 12h4v1h-4zM0 12h4v1H0zM14 14h2v1h-2zM0 14h8v1H0zM8 2h1v1H8zM10 4h1v1h-1zM12 6h1v1h-1zM14 8h1v1h-1z' fill='#808080'/>`,
  ),
  "Blue Rivets": svg(
    32,
    32,
    `<rect width='32' height='32' fill='#0000a8'/><circle cx='8' cy='8' r='3' fill='#5454fc'/><circle cx='7' cy='7' r='1.5' fill='#fff'/><circle cx='24' cy='24' r='3' fill='#5454fc'/><circle cx='23' cy='23' r='1.5' fill='#fff'/><circle cx='9' cy='9' r='1' fill='#000054'/><circle cx='25' cy='25' r='1' fill='#000054'/>`,
  ),
  Bubbles: svg(
    64,
    64,
    `<rect width='64' height='64' fill='#000080'/><circle cx='14' cy='18' r='9' fill='none' stroke='#5fa8ff' stroke-width='1'/><circle cx='11' cy='15' r='2' fill='#fff'/><circle cx='44' cy='40' r='13' fill='none' stroke='#5fa8ff' stroke-width='1'/><circle cx='39' cy='34' r='3' fill='#fff'/><circle cx='52' cy='10' r='4' fill='none' stroke='#5fa8ff'/><circle cx='20' cy='52' r='5' fill='none' stroke='#5fa8ff'/>`,
  ),
  "Carved Stone": svg(
    32,
    32,
    `<rect width='32' height='32' fill='#8c8c8c'/><path d='M0 0h32v1H0zM0 0h1v32H0z' fill='#c8c8c8'/><path d='M31 0h1v32h-1zM0 31h32v1H0z' fill='#505050'/><path d='M8 8h16v1H8zM8 8h1v16H8z' fill='#505050'/><path d='M23 8h1v16h-1zM8 23h16v1H8z' fill='#c8c8c8'/>`,
  ),
  Circles: svg(
    24,
    24,
    `<rect width='24' height='24' fill='#c0c0c0'/><circle cx='12' cy='12' r='10' fill='none' stroke='#000' stroke-width='1'/><circle cx='12' cy='12' r='6' fill='none' stroke='#808080'/>`,
  ),
  Clouds: svg(
    256,
    256,
    `<defs><radialGradient id='a' cx='30%' cy='30%' r='45%'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient><radialGradient id='b' cx='70%' cy='65%' r='40%'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs><rect width='256' height='256' fill='#5a9bd8'/><rect width='256' height='256' fill='url(#a)'/><rect width='256' height='256' fill='url(#b)'/>`,
  ),
  Egypt: svg(
    32,
    32,
    `<rect width='32' height='32' fill='#c0a060'/><path d='M4 28L16 4l12 24z' fill='#806020'/><path d='M16 4l12 24H16z' fill='#604010'/>`,
  ),
  Forest: svg(
    64,
    64,
    `<rect width='64' height='64' fill='#004000'/><path d='M12 60V30M12 30l-8 12h16zM12 20l-6 10h12zM44 62V26M44 26l-10 16h20zM44 14l-8 12h16z' stroke='#00a000' fill='#008000'/>`,
  ),
  "Gold Weave": svg(
    16,
    16,
    `<rect width='16' height='16' fill='#c0a000'/><path d='M0 0h8v8H0z' fill='#e0c040'/><path d='M8 8h8v8H8z' fill='#e0c040'/><path d='M0 7h8v1H0zM7 0h1v8H7zM8 15h8v1H8zM15 8h1v8h-1z' fill='#806000'/>`,
  ),
  Houndstooth: svg(
    16,
    16,
    `<rect width='16' height='16' fill='#fff'/><path d='M0 0h8v8H0zM8 8h8v8H8zM8 0l8 8H8zM0 8l8 8H0z' fill='#000'/>`,
  ),
  "Metal Links": svg(
    32,
    32,
    `<rect width='32' height='32' fill='#404040'/><rect x='4' y='4' width='24' height='12' rx='6' fill='none' stroke='#c0c0c0' stroke-width='3'/><rect x='4' y='16' width='24' height='12' rx='6' fill='none' stroke='#808080' stroke-width='3'/>`,
  ),
  Pinstripe: svg(8, 8, `<rect width='8' height='8' fill='#000080'/><rect x='3' width='1' height='8' fill='#8080ff'/>`),
  "Red Blocks": svg(
    32,
    32,
    `<rect width='32' height='32' fill='#800000'/><rect x='2' y='2' width='28' height='28' fill='#ff0000'/><path d='M2 2h28v2H2zM2 2h2v28H2z' fill='#ff8080'/><path d='M28 2h2v28h-2zM2 28h28v2H2z' fill='#400000'/>`,
  ),
  Sandstone: svg(
    32,
    32,
    `<rect width='32' height='32' fill='#d8c8a8'/><path d='M3 5h1v1H3zM10 2h1v1h-1zM18 7h1v1h-1zM26 3h1v1h-1zM6 14h1v1H6zM14 12h1v1h-1zM22 17h1v1h-1zM29 13h1v1h-1zM4 24h1v1H4zM12 27h1v1h-1zM20 23h1v1h-1zM27 28h1v1h-1z' fill='#a08860'/>`,
  ),
  "Straw Mat": svg(
    16,
    16,
    `<rect width='16' height='16' fill='#d8b870'/><path d='M0 0h8v8H0z' fill='#c0a050'/><path d='M8 8h8v8H8z' fill='#c0a050'/><path d='M0 2h8v1H0zM0 5h8v1H0zM8 10h8v1H8zM8 13h8v1H8zM10 0h1v8h-1zM13 0h1v8h-1zM2 8h1v8H2zM5 8h1v8H5z' fill='#806020'/>`,
  ),
  Tiles: svg(
    32,
    32,
    `<rect width='32' height='32' fill='#008080'/><rect x='1' y='1' width='30' height='30' fill='#00a0a0'/><path d='M1 1h30v1H1zM1 1h1v30H1z' fill='#80e0e0'/><path d='M30 1h1v30h-1zM1 30h30v1H1z' fill='#004040'/>`,
  ),
  Triangles: svg(
    16,
    16,
    `<rect width='16' height='16' fill='#c0c0c0'/><path d='M0 16L8 0l8 16z' fill='#808080'/><path d='M8 0l8 16H8z' fill='#404040'/>`,
  ),
  Waves: svg(
    32,
    16,
    `<rect width='32' height='16' fill='#000080'/><path d='M0 8q8-8 16 0t16 0' fill='none' stroke='#00c0c0' stroke-width='2'/>`,
  ),
}

/** 8x8 monochrome desktop patterns (1 = pixel on). */
export const patterns: Record<string, number[]> = {
  Bricks: [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08],
  Buttons: [0x3c, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3c],
  "Cargo Net": [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81],
  Circuits: [0x10, 0x10, 0xfe, 0x10, 0x10, 0x10, 0xfe, 0x10],
  Cobblestones: [0x18, 0x24, 0x42, 0x81, 0x81, 0x42, 0x24, 0x18],
  Daisies: [0x18, 0x18, 0xdb, 0x7e, 0x7e, 0xdb, 0x18, 0x18],
  Dizzy: [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01],
  "Field Effect": [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55],
  Key: [0xfe, 0x82, 0xba, 0xa2, 0xba, 0x8a, 0xfa, 0x00],
  "Live Wire": [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
  Plaid: [0xff, 0x11, 0x11, 0x11, 0xff, 0x11, 0x11, 0x11],
  Rounder: [0x3c, 0x7e, 0xff, 0xff, 0xff, 0xff, 0x7e, 0x3c],
  Scales: [0x81, 0x42, 0x3c, 0x00, 0x18, 0x24, 0xc3, 0x00],
  Stone: [0x00, 0x7e, 0x42, 0x5a, 0x5a, 0x42, 0x7e, 0x00],
  Thatches: [0x88, 0x44, 0x22, 0x11, 0x88, 0x44, 0x22, 0x11],
  Tulip: [0x18, 0x24, 0x42, 0x7e, 0x18, 0x18, 0x3c, 0x00],
  "Waffle's Revenge": [0xff, 0x81, 0x81, 0x81, 0xff, 0x81, 0x81, 0x81],
  Weave: [0xf0, 0xf0, 0xf0, 0xf0, 0x0f, 0x0f, 0x0f, 0x0f],
}

export function patternToDataUrl(bits: number[], fg = "#000000"): string {
  let rects = ""
  bits.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
      if (row & (0x80 >> x)) rects += `<rect x='${x}' y='${y}' width='1' height='1'/>`
    }
  })
  return svg(8, 8, `<g fill='${fg}'>${rects}</g>`)
}

/** Resolve the current wallpaper setting to a CSS background-image URL (or null). */
export function wallpaperUrl(s: Settings): string | null {
  if (!s.wallpaper) return null
  if (s.wallpaper.startsWith("data:") || s.wallpaper.startsWith("/") || s.wallpaper.startsWith("http"))
    return s.wallpaper
  if (s.customWallpapers[s.wallpaper]) return s.customWallpapers[s.wallpaper]
  return wallpapers[s.wallpaper] ?? null
}
