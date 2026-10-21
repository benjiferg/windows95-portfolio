"use client"

import { fs, ext, iconForNode, type FSNode } from "./fs"
import { getApp, appByExe, allApps } from "./registry"
import { launch, wm } from "./store"
import { settings } from "./settings"
import type { IconName } from "./icons"
import { software } from "./portfolio"

/* ------------------------------------------------------------------ */
/*  Shell: how the desktop opens things                                 */
/* ------------------------------------------------------------------ */

export const SPECIAL = {
  DESKTOP: "::DESKTOP",
  MYCOMPUTER: "::MYCOMPUTER",
  NETWORK: "::NETWORK",
  RECYCLE: "::RECYCLE",
  CONTROLPANEL: "::CONTROLPANEL",
  PRINTERS: "::PRINTERS",
  DIALUP: "::DIALUP",
  BRIEFCASE: "::BRIEFCASE",
  ENTIRENET: "::ENTIRENET",
} as const

export const DESKTOP_DIR = "C:\\WINDOWS\\DESKTOP"

export function isSpecial(path: string) {
  return path.startsWith("::")
}

/** Icon for a filesystem node, resolving .EXE / .LNK through the app registry. */
export function iconFor(node: FSNode, path?: string): IconName {
  if (node.type === "file" && node.exe) {
    if (node.icon) return node.icon
    const app = getApp(node.exe)
    if (app) return app.icon
  }
  return iconForNode(node, path)
}

/** Display name: hides .LNK/.URL/.PIF extensions like the real shell. */
export function displayName(node: FSNode): string {
  if (node.type === "dir") return node.name
  const e = ext(node.name)
  if (e === "LNK" || e === "URL" || e === "PIF") return node.name.slice(0, node.name.length - 4)
  return node.name
}

export function openUrl(url: string, parentId?: string) {
  if (url.startsWith("mailto:")) {
    window.location.href = url
    return
  }
  launch("iexplore", { url }, parentId ? { parentId } : undefined)
}

const DOC_EXT = new Set(["TXT", "INI", "LOG", "BAT", "INF", "1ST", "DOC", "RTF", "WRI", "BMP", "PNG", "GIF", "JPG"])

export function openNode(path: string, node: FSNode, opts: { parentId?: string } = {}) {
  const real = fs.realPath(path)
  if (node.type === "dir") {
    launch("explorer", { path: real })
    return
  }
  if (node.exe) {
    if (getApp(node.exe)) launch(node.exe)
    else notFound(real, opts.parentId)
    return
  }
  if (node.url) {
    openUrl(node.url)
    return
  }
  const e = ext(node.name)
  if (DOC_EXT.has(e)) settings.addRecent(real)
  switch (e) {
    case "TXT":
    case "INI":
    case "LOG":
    case "BAT":
    case "INF":
    case "1ST":
    case "CNT":
      launch("notepad", { path: real })
      return
    case "DOC":
    case "RTF":
    case "WRI":
      launch("wordpad", { path: real })
      return
    case "BMP":
    case "PNG":
    case "GIF":
    case "JPG":
      launch("paint", { path: real })
      return
    case "WAV":
    case "MID":
    case "RMI":
    case "AVI":
      launch("mediaplayer", { path: real })
      return
    case "HLP":
      launch("help")
      return
    case "HTM":
    case "HTML":
    case "URL":
      launch("iexplore", { path: real })
      return
    case "TTF":
    case "FON":
      launch("fontview", { path: real })
      return
    case "EXE":
    case "COM":
      if (node.size && node.size > 0) {
        wm.msgBox({
          parentId: opts.parentId,
          title: node.name,
          text: `Cannot run ${node.name}: This program requires MS-DOS mode or is not a valid Win32 application.`,
          icon: "error",
        })
        return
      }
      break
    case "DLL":
    case "SYS":
    case "DRV":
    case "VXD":
    case "PDR":
      wm.msgBox({
        parentId: opts.parentId,
        title: node.name,
        text: `${node.name} is a system file and cannot be opened directly.`,
        icon: "warning",
      })
      return
  }
  openWith(real, node, opts.parentId)
}

function notFound(path: string, parentId?: string) {
  wm.msgBox({
    parentId,
    title: "Problem with Shortcut",
    text: `The item '${fs.basename(path)}' that this shortcut refers to has been changed or moved. The nearest match, based on size, date, and type, is unavailable.`,
    icon: "warning",
  })
}

function openWith(path: string, node: FSNode, parentId?: string) {
  wm.open({
    appId: "openwith",
    parentId,
    modal: !!parentId,
    props: { path, name: node.name },
  })
}

export function openPath(path: string, opts: { parentId?: string } = {}) {
  if (isSpecial(path)) {
    launch("explorer", { path })
    return
  }
  const node = fs.get(path)
  if (!node) {
    wm.msgBox({
      parentId: opts.parentId,
      title: "Windows",
      text: `Cannot find '${path}'. Make sure the path or Internet address is correct.`,
      icon: "error",
    })
    return
  }
  openNode(path, node, opts)
}

/**
 * The Run dialog / Start command: accepts app names, executable names,
 * paths, folders and URLs. Returns false if nothing matched.
 */
export function run(cmdline: string, cwd = "C:\\WINDOWS", parentId?: string): boolean {
  const line = cmdline.trim()
  if (!line) return false
  const lower = line.toLowerCase()

  // URLs
  if (/^(https?:\/\/|www\.|mailto:)/i.test(line)) {
    openUrl(/^www\./i.test(line) ? "http://" + line : line, parentId)
    return true
  }
  // Software by slug/name
  const sw = software.find((s) => s.slug === lower || s.name.toLowerCase() === lower)
  if (sw) {
    launch("sw:" + sw.slug)
    return true
  }
  // Well-known aliases
  const aliases: Record<string, string> = {
    cmd: "dos",
    command: "dos",
    "command.com": "dos",
    dos: "dos",
    control: "controlpanel",
    "control.exe": "controlpanel",
    explorer: "explorer",
    "explorer.exe": "explorer",
    winfile: "explorer",
    notepad: "notepad",
    calc: "calc",
    mspaint: "paint",
    pbrush: "paint",
    paint: "paint",
    write: "wordpad",
    wordpad: "wordpad",
    sol: "solitaire",
    solitaire: "solitaire",
    winmine: "minesweeper",
    minesweeper: "minesweeper",
    freecell: "freecell",
    mshearts: "hearts",
    hearts: "hearts",
    charmap: "charmap",
    clock: "clock",
    sndvol32: "volume",
    sndrec32: "soundrecorder",
    mplayer: "mediaplayer",
    cdplayer: "cdplayer",
    dialer: "dialer",
    hypertrm: "hyperterm",
    telnet: "hyperterm",
    defrag: "defrag",
    scandskw: "scandisk",
    scandisk: "scandisk",
    regedit: "regedit",
    winhelp: "help",
    winhlp32: "help",
    help: "help",
    iexplore: "iexplore",
    msn: "msn",
    welcome: "welcome",
    taskman: "taskman",
    sysmon: "sysmon",
    rsrcmtr: "resmeter",
    drvspace: "drivespace",
    backup: "backup",
    clipbrd: "clipbrd",
    progman: "progman",
    winver: "winver",
    exchange: "exchange",
    exchng32: "exchange",
    msdos: "dos",
    "readme": "readme",
    "readme.txt": "readme",
    about: "about",
    desktop: "explorer",
  }
  const first = lower.split(/\s+/)[0].replace(/\.exe$/, "")
  if (aliases[first]) {
    if (aliases[first] === "readme") {
      openPath("C:\\My Documents\\README.TXT")
      return true
    }
    if (aliases[first] === "about") {
      openPath("C:\\My Documents\\About Benjamin.txt")
      return true
    }
    if (aliases[first] === "explorer") {
      const arg = line.split(/\s+/).slice(1).join(" ")
      if (arg) openPath(arg, { parentId })
      else launch("explorer", { path: "C:\\", tree: true })
      return true
    }
    launch(aliases[first])
    return true
  }
  if (getApp(first)) {
    launch(first)
    return true
  }
  const byExe = appByExe(first)
  if (byExe) {
    launch(byExe.id)
    return true
  }
  // Filesystem path
  const path = fs.normalize(line.replace(/^"|"$/g, ""), cwd)
  if (fs.exists(path)) {
    openPath(path, { parentId })
    return true
  }
  // try with extensions
  for (const e of [".EXE", ".COM", ".BAT", ".TXT", ".LNK"]) {
    if (fs.exists(path + e)) {
      openPath(path + e, { parentId })
      return true
    }
  }
  // search PATH
  for (const dir of ["C:\\WINDOWS", "C:\\WINDOWS\\COMMAND", "C:\\Program Files\\Accessories"]) {
    for (const e of ["", ".EXE", ".COM"]) {
      const p = dir + "\\" + line + e
      if (fs.exists(p)) {
        openPath(p, { parentId })
        return true
      }
    }
  }
  return false
}

/** All registered apps that have a Start menu placement (for Find/Help). */
export function startMenuApps() {
  return allApps().filter((a) => a.startMenu)
}
