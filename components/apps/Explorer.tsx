"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { fs, useFS, fileTypeName, formatSize, formatSizeKB, formatDate, type FSNode, type FSDir } from "@/lib/win95/fs"
import { iconFor, displayName, openNode, SPECIAL, isSpecial, DESKTOP_DIR } from "@/lib/win95/shell"
import { icon as iconUrl, type IconName } from "@/lib/win95/icons"
import { sounds } from "@/lib/win95/sounds"
import { profile } from "@/lib/win95/portfolio"
import { MenuBar, showContextMenu, type MenuItem } from "@/components/win95/Menu"
import { StatusBar, Select, Button, Checkbox, TextInput, Tabs } from "@/components/win95/controls"
import { RenameBox } from "@/components/win95/Desktop"

/* ------------------------------------------------------------------ */
/*  Shell namespace                                                     */
/* ------------------------------------------------------------------ */

export interface Item {
  key: string
  name: string
  icon: IconName
  typeName: string
  size?: number
  modified?: number
  /** fs path if real */
  path?: string
  node?: FSNode
  /** location to navigate into (folder, drive, special) */
  location?: string
  /** extra column (Recycle Bin: original location) */
  extra?: string
  open: () => void
  menu?: MenuItem[]
}

export interface Location {
  id: string
  title: string
  icon: IconName
  items: Item[]
  parent?: string
  isFs: boolean
  status?: string
}

export const CPL_APPLETS: { id: string; name: string; icon: IconName; desc: string }[] = [
  { id: "accessibility", name: "Accessibility Options", icon: "accessibility", desc: "Changes accessibility options for your system." },
  { id: "addhardware", name: "Add New Hardware", icon: "hardware", desc: "Adds new hardware to your system." },
  { id: "addremove", name: "Add/Remove Programs", icon: "appwizard", desc: "Sets up programs and creates shortcuts." },
  { id: "datetime", name: "Date/Time", icon: "time_and_date", desc: "Changes date, time and time zone information." },
  { id: "display", name: "Display", icon: "display_properties", desc: "Changes settings for your display." },
  { id: "fonts", name: "Fonts", icon: "directory_fonts", desc: "Views, adds and removes fonts on your computer." },
  { id: "internet", name: "Internet", icon: "internet_options", desc: "Changes your Internet settings." },
  { id: "joystick", name: "Joystick", icon: "joystick", desc: "Changes settings for joystick devices." },
  { id: "keyboard", name: "Keyboard", icon: "keyboard", desc: "Changes settings for your keyboard." },
  { id: "mail", name: "Mail and Fax", icon: "envelope_closed", desc: "Microsoft Exchange Profiles" },
  { id: "modems", name: "Modems", icon: "modem", desc: "Installs a new modem and changes modem properties." },
  { id: "mouse", name: "Mouse", icon: "mouse", desc: "Changes settings for your mouse." },
  { id: "multimedia", name: "Multimedia", icon: "multimedia", desc: "Changes settings for multimedia devices." },
  { id: "network", name: "Network", icon: "network", desc: "Configures network hardware and software." },
  { id: "passwords", name: "Passwords", icon: "key_win", desc: "Changes passwords and sets security options." },
  { id: "printers", name: "Printers", icon: "printer", desc: "Adds, removes and changes settings for printers." },
  { id: "regional", name: "Regional Settings", icon: "world", desc: "Changes how numbers, currencies, dates and times are displayed." },
  { id: "sounds", name: "Sounds", icon: "loudspeaker_rays", desc: "Changes system and program sounds." },
  { id: "system", name: "System", icon: "computer", desc: "Provides system information and changes advanced settings." },
]

function driveName(letter: string, d: FSDir) {
  const k = d.drive?.kind
  const label = d.drive?.label
  if (k === "floppy") return `3½ Floppy (${letter})`
  if (k === "cdrom") return `${label || "CD-ROM"} (${letter})`
  return `${label ? label.charAt(0) + label.slice(1).toLowerCase() : "Local Disk"} (${letter})`
}

export function resolveLocation(loc: string): Location {
  const up = loc.toUpperCase()
  const special = (id: string, title: string, icon: IconName, items: Item[], parent?: string, status?: string): Location => ({ id, title, icon, items, parent, isFs: false, status })

  if (up === SPECIAL.DESKTOP) {
    const shell: Item[] = [
      { key: "mycomputer", name: "My Computer", icon: "computer_explorer", typeName: "System Folder", location: SPECIAL.MYCOMPUTER, open: () => launch("explorer", { path: SPECIAL.MYCOMPUTER }) },
      { key: "network", name: "Network Neighborhood", icon: "network_normal_two_pcs", typeName: "System Folder", location: SPECIAL.NETWORK, open: () => launch("explorer", { path: SPECIAL.NETWORK }) },
      { key: "inbox", name: "Inbox", icon: "envelope_closed", typeName: "System Folder", open: () => launch("exchange") },
      { key: "recycle", name: "Recycle Bin", icon: fs.recycleCount() ? "recycle_bin_full" : "recycle_bin_empty", typeName: "System Folder", location: SPECIAL.RECYCLE, open: () => launch("explorer", { path: SPECIAL.RECYCLE }) },
      { key: "ie", name: "The Internet", icon: "msie1", typeName: "System Folder", open: () => launch("iexplore") },
      { key: "msn", name: "The Microsoft Network", icon: "msn3", typeName: "System Folder", open: () => launch("msn") },
      { key: "briefcase", name: "My Briefcase", icon: "briefcase", typeName: "Briefcase", location: SPECIAL.BRIEFCASE, open: () => launch("explorer", { path: SPECIAL.BRIEFCASE }) },
    ]
    const files = fsItems(DESKTOP_DIR)
    return special(SPECIAL.DESKTOP, "Desktop", "desktop", [...shell, ...files])
  }
  if (up === SPECIAL.MYCOMPUTER) {
    const drives = Object.entries(fs.drives)
      .sort(([a], [b]) => a.localeCompare(b))
      .map<Item>(([letter, d]) => ({
        key: letter,
        name: driveName(letter, d),
        icon: d.drive?.kind === "cdrom" ? "cd_drive" : d.drive?.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive",
        typeName: d.drive?.kind === "cdrom" ? "CD-ROM Disc" : d.drive?.kind === "floppy" ? "3½ Inch Floppy Disk" : "Local Disk",
        size: d.drive?.total,
        path: letter + "\\",
        location: letter + "\\",
        open: () => {
          if (!fs.driveReady(letter)) {
            wm.msgBox({ title: letter, text: `${letter}\\ is not accessible.\n\nThe device is not ready.`, icon: "error" })
            return
          }
          launch("explorer", { path: letter + "\\" })
        },
        menu: [
          { label: "&Format...", onClick: () => launch("format", { drive: letter }) },
          { sep: true },
          { label: "P&roperties", onClick: () => launch("driveprops", { drive: letter }) },
        ],
      }))
    const folders: Item[] = [
      { key: "cpl", name: "Control Panel", icon: "directory_control_panel", typeName: "System Folder", location: SPECIAL.CONTROLPANEL, open: () => launch("explorer", { path: SPECIAL.CONTROLPANEL }) },
      { key: "printers", name: "Printers", icon: "printer", typeName: "System Folder", location: SPECIAL.PRINTERS, open: () => launch("explorer", { path: SPECIAL.PRINTERS }) },
      { key: "dialup", name: "Dial-Up Networking", icon: "directory_dial_up_networking", typeName: "System Folder", location: SPECIAL.DIALUP, open: () => launch("explorer", { path: SPECIAL.DIALUP }) },
    ]
    return special(SPECIAL.MYCOMPUTER, "My Computer", "computer_explorer", [...drives, ...folders], SPECIAL.DESKTOP)
  }
  if (up === SPECIAL.CONTROLPANEL) {
    return special(
      SPECIAL.CONTROLPANEL,
      "Control Panel",
      "directory_control_panel",
      CPL_APPLETS.map<Item>((a) => ({
        key: a.id,
        name: a.name,
        icon: a.icon,
        typeName: a.desc,
        open: () => (a.id === "fonts" ? launch("explorer", { path: "C:\\WINDOWS\\FONTS" }) : a.id === "printers" ? launch("explorer", { path: SPECIAL.PRINTERS }) : launch("cpl", { applet: a.id })),
      })),
      SPECIAL.MYCOMPUTER,
      "Changes settings for your computer.",
    )
  }
  if (up === SPECIAL.PRINTERS) {
    return special(
      SPECIAL.PRINTERS,
      "Printers",
      "printer",
      [
        { key: "add", name: "Add Printer", icon: "printer", typeName: "", open: () => wm.msgBox({ title: "Add Printer Wizard", text: "This wizard will help you to install your printer quickly and easily.\n\n(No printers are attached to this portfolio.)", icon: "info" }) },
        { key: "hp", name: "HP LaserJet 4", icon: "printer", typeName: "Default printer; Ready", open: () => launch("printqueue", { name: "HP LaserJet 4" }) },
        { key: "fax", name: "Microsoft Fax", icon: "fax_machine", typeName: "Ready", open: () => launch("printqueue", { name: "Microsoft Fax" }) },
      ],
      SPECIAL.MYCOMPUTER,
    )
  }
  if (up === SPECIAL.DIALUP) {
    return special(
      SPECIAL.DIALUP,
      "Dial-Up Networking",
      "directory_dial_up_networking",
      [
        { key: "new", name: "Make New Connection", icon: "modem", typeName: "", open: () => launch("dialup", { wizard: true }) },
        { key: "isp", name: "My Connection", icon: "directory_dial_up_networking", typeName: "Dial-Up Networking Connection", open: () => launch("dialup") },
      ],
      SPECIAL.MYCOMPUTER,
    )
  }
  if (up === SPECIAL.NETWORK) {
    return special(
      SPECIAL.NETWORK,
      "Network Neighborhood",
      "network_normal_two_pcs",
      [
        { key: "entire", name: "Entire Network", icon: "entire_network_globe", typeName: "Entire Network", location: SPECIAL.ENTIRENET, open: () => launch("explorer", { path: SPECIAL.ENTIRENET }) },
        { key: "pc", name: profile.firstName.toLowerCase() + "-pc", icon: "computer", typeName: "Computer", location: "C:\\", open: () => launch("explorer", { path: "C:\\" }) },
      ],
      SPECIAL.DESKTOP,
    )
  }
  if (up === SPECIAL.ENTIRENET) {
    return special(
      SPECIAL.ENTIRENET,
      "Entire Network",
      "entire_network_globe",
      [{ key: "wg", name: "Portfolio", icon: "network_three_pcs", typeName: "Workgroup", location: SPECIAL.NETWORK, open: () => launch("explorer", { path: SPECIAL.NETWORK }) }],
      SPECIAL.NETWORK,
    )
  }
  if (up === SPECIAL.RECYCLE) {
    const bin = fs.get("C:\\RECYCLED") as FSDir
    const items = Object.values(bin.children).map<Item>((n) => {
      const p = "C:\\RECYCLED\\" + n.name
      const origin = (n as { origin?: string }).origin ?? ""
      return {
        key: p,
        name: n.name,
        icon: iconFor(n, p),
        typeName: fileTypeName(n),
        size: fs.sizeOf(n),
        modified: n.modified,
        path: p,
        node: n,
        extra: origin ? fs.parent(origin) : "",
        open: () => wm.msgBox({ title: n.name, text: "This item is in the Recycle Bin. Restore it to open it.", icon: "info" }),
        menu: [
          { label: "&Restore", onClick: () => fs.restore(n.name) },
          { sep: true },
          { label: "&Delete", onClick: async () => {
              const r = await wm.msgBox({ title: "Confirm File Delete", text: `Are you sure you want to delete '${n.name}'?`, icon: "question", buttons: ["Yes", "No"] })
              if (r === "Yes") fs.remove(p, true)
            } },
          { sep: true },
          { label: "P&roperties", onClick: () => launch("properties", { path: p }) },
        ],
      }
    })
    return special(SPECIAL.RECYCLE, "Recycle Bin", items.length ? "recycle_bin_full" : "recycle_bin_empty", items, SPECIAL.DESKTOP)
  }
  if (up === SPECIAL.BRIEFCASE) {
    const p = "C:\\My Briefcase"
    if (!fs.exists(p)) {
      fs.mkdir(p)
      const n = fs.get(p)
      if (n) n.hidden = true
    }
    const l = fsLocation(p)
    return { ...l, id: SPECIAL.BRIEFCASE, title: "My Briefcase", icon: "briefcase", parent: SPECIAL.DESKTOP, status: "Briefcase: drag files here to keep them in sync." }
  }
  return fsLocation(loc)
}

function fsItems(dirPath: string): Item[] {
  const real = fs.realPath(dirPath).replace(/\\$/, "")
  return fs.list(dirPath).map<Item>((n) => {
    const p = (real.endsWith(":") ? real + "\\" : real + "\\") + n.name
    return {
      key: p,
      name: displayName(n),
      icon: iconFor(n, p),
      typeName: fileTypeName(n),
      size: n.type === "file" ? fs.sizeOf(n) : undefined,
      modified: n.modified,
      path: p,
      node: n,
      location: n.type === "dir" ? p : undefined,
      open: () => openNode(p, n),
    }
  })
}

function fsLocation(path: string): Location {
  const real = fs.realPath(path)
  const node = fs.get(real)
  const isRoot = fs.split(real).parts.length === 0
  const letter = real.slice(0, 2)
  const dr = fs.drives[letter]
  let title = isRoot && dr ? driveName(letter, dr) : fs.basename(real)
  if (real.toUpperCase() === "C:\\WINDOWS\\DESKTOP") title = "Desktop"
  const icon: IconName = isRoot ? (dr?.drive?.kind === "cdrom" ? "cd_drive" : dr?.drive?.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive") : node ? iconFor(node, real) : "directory_closed"
  const parent = isRoot ? SPECIAL.MYCOMPUTER : fs.parent(real)
  if (!node || node.type !== "dir") return { id: real, title, icon, items: [], parent, isFs: true }
  return { id: real, title, icon: icon === "directory_closed" ? "directory_open_cool" : icon, items: fsItems(real), parent, isFs: true }
}

/* ------------------------------------------------------------------ */
/*  File clipboard                                                      */
/* ------------------------------------------------------------------ */

let fileClip: { mode: "cut" | "copy"; paths: string[] } | null = null

/* ------------------------------------------------------------------ */
/*  Explorer window                                                     */
/* ------------------------------------------------------------------ */

type View = "large" | "small" | "list" | "details"
type SortKey = "name" | "type" | "size" | "modified"

export function Explorer({ win }: AppProps) {
  useFS()
  const [loc, setLoc] = useState<string>((win.props.path as string) ?? SPECIAL.MYCOMPUTER)
  const [tree, setTree] = useState<boolean>(!!win.props.tree)
  const [view, setView] = useState<View>("large")
  const [sort, setSort] = useState<SortKey>("name")
  const [showToolbar, setShowToolbar] = useState(true)
  const [showStatus, setShowStatus] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>([SPECIAL.DESKTOP, SPECIAL.MYCOMPUTER])
    const start = ((win.props.path as string) ?? "").toUpperCase()
    if (start && !isSpecial(start)) {
      // expand every ancestor of the starting folder
      const { drive, parts } = fs.split(start)
      let acc = drive + "\\"
      s.add(acc)
      for (const p of parts) {
        acc = acc.replace(/\\$/, "") + "\\" + p
        s.add(acc.toUpperCase())
      }
    } else if (start) s.add(start)
    return s
  })
  const listRef = useRef<HTMLDivElement>(null)

  // navigate when props.path changes (e.g. singleton reuse)
  useEffect(() => {
    const p = win.props.path as string | undefined
    if (p && p !== loc) setLoc(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.path])

  const location = useMemo(() => resolveLocation(loc), [loc, fs.getVersion()])

  const items = useMemo(() => {
    const arr = location.items.slice()
    if (!location.isFs && loc.toUpperCase() !== SPECIAL.RECYCLE && loc.toUpperCase() !== SPECIAL.DESKTOP) return arr
    const dirFirst = (a: Item, b: Item) => Number(!(a.node?.type === "dir" || a.location)) - Number(!(b.node?.type === "dir" || b.location))
    arr.sort((a, b) => {
      const d = dirFirst(a, b)
      if (d) return d
      if (sort === "name") return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      if (sort === "type") return a.typeName.localeCompare(b.typeName) || a.name.localeCompare(b.name)
      if (sort === "size") return (a.size ?? 0) - (b.size ?? 0)
      return (b.modified ?? 0) - (a.modified ?? 0)
    })
    return arr
  }, [location, sort, loc])

  useEffect(() => {
    const t = tree ? `Exploring - ${location.title}` : location.title
    wm.setTitle(win.id, t)
    wm.update(win.id, { icon: location.icon })
    setSelected(new Set())
    setRenaming(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.title, location.icon, tree, win.id])

  const navigate = useCallback(
    (to: string) => {
      if (/^[A-Z]:\\?$/i.test(to) && !fs.driveReady(to)) {
        wm.msgBox({ parentId: win.id, title: to.slice(0, 2), text: `${to.slice(0, 2)}\\ is not accessible.\n\nThe device is not ready.`, icon: "error" })
        return
      }
      setHistory((h) => [...h, loc].slice(-30))
      setLoc(to)
      if (isSpecial(to) || fs.isDir(to)) setExpanded((e) => new Set(e).add(to.toUpperCase()))
    },
    [loc, win.id],
  )

  // Windows 95 default: every folder opens in its own window; Windows Explorer
  // (tree view) browses in place.
  const openItem = useCallback(
    (it: Item) => {
      if (tree && it.location) {
        navigate(it.location)
        return
      }
      it.open()
    },
    [navigate, tree],
  )

  const up = () => {
    if (location.parent) navigate(location.parent)
  }

  const selItems = items.filter((i) => selected.has(i.key))
  const fsSel = selItems.filter((i) => i.path && i.node)

  /* ---------- file ops ---------- */
  /** Items a context-menu action applies to: the selection if it includes the clicked item, else just that item. */
  const targetsFor = (it?: Item) => (it && !selected.has(it.key) ? [it].filter((x) => x.node && x.path) : fsSel)

  const del = async (items: Item[] = fsSel) => {
    if (!items.length) return
    const inBin = loc.toUpperCase() === SPECIAL.RECYCLE
    const what = items.length === 1 ? `'${items[0].name}'` : `these ${items.length} items`
    const r = await wm.msgBox({
      parentId: win.id,
      title: items.length === 1 ? (items[0].node?.type === "dir" ? "Confirm Folder Delete" : "Confirm File Delete") : "Confirm Multiple File Delete",
      text: inBin ? `Are you sure you want to delete ${what}?` : `Are you sure you want to send ${what} to the Recycle Bin?`,
      icon: "question",
      buttons: ["Yes", "No"],
    })
    if (r !== "Yes") return
    for (const it of items) {
      if (inBin) fs.remove(it.path!, true)
      else if (it.node?.type === "file" && (it.node.system || it.node.readonly)) {
        const rr = await wm.msgBox({ parentId: win.id, title: "Confirm File Delete", text: `The file '${it.name}' is a system file. Are you sure you want to send it to the Recycle Bin?`, icon: "warning", buttons: ["Yes", "No"] })
        if (rr === "Yes") fs.recycle(it.path!)
      } else fs.recycle(it.path!)
    }
    setSelected(new Set())
  }

  const cutCopy = (mode: "cut" | "copy", items: Item[] = fsSel) => {
    if (!items.length) return
    fileClip = { mode, paths: items.map((i) => i.path!) }
  }

  const paste = () => {
    if (!fileClip || !location.isFs) return
    const dest = fs.realPath(location.id)
    for (const p of fileClip.paths) {
      const ok = fileClip.mode === "cut" ? fs.move(p, dest) : fs.copy(p, dest)
      if (!ok) wm.msgBox({ parentId: win.id, title: "Error Copying File", text: `Cannot copy ${fs.basename(p)}: The destination already contains a file with that name, or the destination is not accessible.`, icon: "error" })
    }
    if (fileClip.mode === "cut") fileClip = null
  }

  const newItem = (kind: "folder" | "txt" | "bmp" | "doc") => {
    if (!location.isFs) return
    const base = fs.realPath(location.id).replace(/\\$/, "")
    const names: Record<string, string> = { folder: "New Folder", txt: "New Text Document.txt", bmp: "New Bitmap Image.bmp", doc: "New WordPad Document.doc" }
    let name = names[kind]
    const stem = name.replace(/(\.[a-z]+)?$/, "")
    const e = name.slice(stem.length)
    let i = 1
    while (fs.exists(base + "\\" + name)) name = `${stem} (${++i})${e}`
    const ok = kind === "folder" ? fs.mkdir(base + "\\" + name) : fs.writeFile(base + "\\" + name, "")
    if (!ok) {
      wm.msgBox({ parentId: win.id, title: "Unable to create", text: "Unable to create the item. The drive may not be ready.", icon: "error" })
      return
    }
    const key = base + "\\" + name
    setSelected(new Set([key]))
    setRenaming(key)
  }

  const createShortcut = (items: Item[] = fsSel) => {
    for (const it of items) {
      if (!it.node) continue
      const base = fs.parent(it.path!)
      let name = `Shortcut to ${it.node.name}`
      let i = 1
      while (fs.exists(base + "\\" + name + ".lnk")) name = `Shortcut to ${it.node.name} (${++i})`
      const exe = it.node.type === "file" ? it.node.exe : undefined
      fs.writeFile(base + "\\" + name + ".lnk", "", { exe: exe ?? undefined, target: it.path, size: 400, icon: it.icon })
    }
  }

  const selectAll = () => setSelected(new Set(items.map((i) => i.key)))
  const invertSel = () => setSelected(new Set(items.filter((i) => !selected.has(i.key)).map((i) => i.key)))

  const properties = () => {
    if (fsSel.length) launch("properties", { path: fsSel[0].path })
    else if (selItems[0]?.key.length === 2 && fs.drives[selItems[0].key]) launch("driveprops", { drive: selItems[0].key })
    else if (location.isFs) launch("properties", { path: location.id })
  }

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      const t = e.target as HTMLElement
      if (t.tagName === "INPUT" || t.tagName === "SELECT") return
      if (e.key === "Delete") del()
      else if (e.key === "F2" && fsSel[0]) setRenaming(fsSel[0].key)
      else if (e.key === "F5") setLoc((l) => l)
      else if (e.key === "Backspace") up()
      else if (e.key === "Enter" && selItems[0]) openItem(selItems[0])
      else if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        selectAll()
      } else if (e.ctrlKey && e.key.toLowerCase() === "c") cutCopy("copy")
      else if (e.ctrlKey && e.key.toLowerCase() === "x") cutCopy("cut")
      else if (e.ctrlKey && e.key.toLowerCase() === "v") paste()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  /* ---------- menus ---------- */
  const viewMenu: MenuItem[] = [
    { label: "Lar&ge Icons", radio: true, checked: view === "large", onClick: () => setView("large") },
    { label: "S&mall Icons", radio: true, checked: view === "small", onClick: () => setView("small") },
    { label: "&List", radio: true, checked: view === "list", onClick: () => setView("list") },
    { label: "&Details", radio: true, checked: view === "details", onClick: () => setView("details") },
  ]
  const arrangeMenu: MenuItem[] = [
    { label: "by &Name", radio: true, checked: sort === "name", onClick: () => setSort("name") },
    { label: "by &Type", radio: true, checked: sort === "type", onClick: () => setSort("type") },
    { label: "by Si&ze", radio: true, checked: sort === "size", onClick: () => setSort("size") },
    { label: "by &Date", radio: true, checked: sort === "modified", onClick: () => setSort("modified") },
    { sep: true },
    { label: "&Auto Arrange", checked: true },
  ]
  const newMenu: MenuItem[] = [
    { label: "&Folder", icon: "directory_closed", onClick: () => newItem("folder") },
    { label: "&Shortcut", icon: "file_win_shortcut", disabled: true },
    { sep: true },
    { label: "&Text Document", icon: "notepad_file", onClick: () => newItem("txt") },
    { label: "&Bitmap Image", icon: "paint_file", onClick: () => newItem("bmp") },
    { label: "&WordPad Document", icon: "write_file", onClick: () => newItem("doc") },
  ]
  const isRecycle = loc.toUpperCase() === SPECIAL.RECYCLE

  const fileMenu = (): MenuItem[] => {
    const sel = selItems[0]
    const out: MenuItem[] = []
    if (sel) {
      out.push({ label: "&Open", bold: true, onClick: () => openItem(sel) })
      if (sel.location) out.push({ label: "&Explore", onClick: () => { setTree(true); navigate(sel.location!) } })
      if (sel.menu) out.push({ sep: true }, ...sel.menu.filter((m) => m.label !== "P&roperties"))
      out.push({ sep: true })
    }
    if (isRecycle) {
      out.push({ label: "&Empty Recycle Bin", disabled: !items.length, onClick: async () => {
          const r = await wm.msgBox({ parentId: win.id, title: "Confirm Multiple File Delete", text: `Are you sure you want to delete these ${items.length} items?`, icon: "question", buttons: ["Yes", "No"] })
          if (r === "Yes") { fs.emptyRecycleBin(); sounds.recycle() }
        } })
      out.push({ label: "&Restore", disabled: !fsSel.length, onClick: () => fsSel.forEach((i) => fs.restore(i.node!.name)) })
      out.push({ sep: true })
    } else if (location.isFs) {
      out.push({ label: "Ne&w", items: newMenu })
      out.push({ sep: true })
    }
    out.push(
      { label: "Create &Shortcut", disabled: !fsSel.length || isRecycle, onClick: createShortcut },
      { label: "&Delete", disabled: !fsSel.length, onClick: del },
      { label: "Rena&me", disabled: fsSel.length !== 1 || isRecycle, onClick: () => setRenaming(fsSel[0].key) },
      { label: "P&roperties", onClick: properties },
      { sep: true },
      { label: "&Close", onClick: () => wm.close(win.id) },
    )
    return out
  }

  const menus = [
    { label: "&File", items: fileMenu },
    {
      label: "&Edit",
      items: () => [
        { label: "&Undo", disabled: true },
        { sep: true },
        { label: "Cu&t", accel: "Ctrl+X", disabled: !fsSel.length, onClick: () => cutCopy("cut") },
        { label: "&Copy", accel: "Ctrl+C", disabled: !fsSel.length, onClick: () => cutCopy("copy") },
        { label: "&Paste", accel: "Ctrl+V", disabled: !fileClip || !location.isFs, onClick: paste },
        { label: "Paste &Shortcut", disabled: true },
        { sep: true },
        { label: "Select &All", accel: "Ctrl+A", onClick: selectAll },
        { label: "&Invert Selection", onClick: invertSel },
      ],
    },
    {
      label: "&View",
      items: () => [
        { label: "&Toolbar", checked: showToolbar, onClick: () => setShowToolbar(!showToolbar) },
        { label: "Status &Bar", checked: showStatus, onClick: () => setShowStatus(!showStatus) },
        { sep: true },
        ...viewMenu,
        { sep: true },
        { label: "Arrange &Icons", items: arrangeMenu },
        { label: "Line &up Icons" },
        { sep: true },
        { label: "&Refresh", accel: "F5", onClick: () => setLoc((l) => l) },
        { label: "&Options...", onClick: () => launch("folderoptions") },
      ],
    },
    ...(tree
      ? [
          {
            label: "&Tools",
            items: [
              { label: "&Find", items: [{ label: "&Files or Folders...", onClick: () => launch("find", { root: location.isFs ? location.id : "C:\\" }) }, { label: "&Computer...", onClick: () => launch("find", { computer: true }) }] },
              { label: "&Map Network Drive...", disabled: true },
              { label: "&Disconnect Network Drive...", disabled: true },
              { sep: true },
              { label: "&Go to...", onClick: async () => {
                  const p = await wm.prompt({ parentId: win.id, title: "Go To Folder", label: "Type the name and path of the folder you want to go to:", value: location.isFs ? location.id : "C:\\" })
                  if (p && fs.isDir(p)) navigate(fs.realPath(p))
                  else if (p) wm.msgBox({ parentId: win.id, title: "Go To Folder", text: `Cannot find the folder '${p}'.`, icon: "error" })
                } },
            ],
          },
        ]
      : []),
    {
      label: "&Help",
      items: [
        { label: "&Help Topics", onClick: () => launch("help", { topic: "explorer" }) },
        { sep: true },
        { label: "&About Windows 95", onClick: () => launch("winver") },
      ],
    },
  ]

  const bgMenu: MenuItem[] = [
    { label: "&View", items: viewMenu },
    { label: "Arrange &Icons", items: arrangeMenu },
    { label: "Line &up Icons" },
    { sep: true },
    { label: "&Refresh", onClick: () => setLoc((l) => l) },
    { sep: true },
    { label: "&Paste", disabled: !fileClip || !location.isFs, onClick: paste },
    { label: "Paste &Shortcut", disabled: true },
    { sep: true },
    ...(location.isFs ? [{ label: "Ne&w", items: newMenu }, { sep: true }] : []),
    { label: "P&roperties", onClick: properties },
  ]

  const itemMenu = (it: Item): MenuItem[] => {
    const isFsItem = !!it.node
    return [
      { label: "&Open", bold: true, onClick: () => openItem(it) },
      ...(it.location ? [{ label: "&Explore", onClick: () => { setTree(true); navigate(it.location!) } }] : []),
      ...(it.menu ? [{ sep: true }, ...it.menu.filter((m) => m.label !== "P&roperties")] : []),
      { sep: true },
      { label: "Send &To", items: [{ label: "3½ Floppy (A)", icon: "floppy_drive_3_5", disabled: !isFsItem, onClick: () => wm.msgBox({ parentId: win.id, title: "Copying...", text: "A:\\ is not accessible.\n\nThe device is not ready.", icon: "error" }) }, { label: "Mail Recipient", icon: "envelope_closed", onClick: () => launch("exchange", { compose: true, attach: it.name }) }, { label: "My Briefcase", icon: "briefcase", disabled: !isFsItem, onClick: () => { resolveLocation(SPECIAL.BRIEFCASE); fs.copy(it.path!, "C:\\My Briefcase") } }], disabled: isRecycle },
      { sep: true },
      { label: "Cu&t", disabled: !isFsItem || isRecycle, onClick: () => cutCopy("cut", targetsFor(it)) },
      { label: "&Copy", disabled: !isFsItem || isRecycle, onClick: () => cutCopy("copy", targetsFor(it)) },
      { sep: true },
      { label: "Create &Shortcut", disabled: !isFsItem || isRecycle, onClick: () => createShortcut(targetsFor(it)) },
      { label: "&Delete", disabled: !isFsItem, onClick: () => del(targetsFor(it)) },
      { label: "Rena&me", disabled: !isFsItem || isRecycle, onClick: () => setRenaming(it.key) },
      { sep: true },
      { label: "P&roperties", onClick: () => (it.path && it.node ? launch("properties", { path: it.path }) : it.key.length === 2 ? launch("driveprops", { drive: it.key }) : it.menu?.find((m) => m.label === "P&roperties")?.onClick?.()) },
    ]
  }

  /* ---------- status ---------- */
  const statusText = (() => {
    if (location.status && !selItems.length) return location.status
    if (selItems.length === 1) {
      const it = selItems[0]
      if (it.key.length === 2 && fs.drives[it.key]) {
        const d = fs.drives[it.key]
        if (!d.drive?.ready) return "Device not ready"
        return `Free Space: ${formatSize(Math.max(0, (d.drive?.total ?? 0) - fs.usedSpace(it.key)))}, Capacity: ${formatSize(d.drive?.total ?? 0)}`
      }
      return it.typeName
    }
    if (selItems.length > 1) return `${selItems.length} object(s) selected`
    return `${items.length} object(s)`
  })()
  const sizeText = (() => {
    const list = selItems.length ? selItems : items
    const total = list.reduce((a, i) => a + (i.node?.type === "file" ? i.size ?? 0 : 0), 0)
    if (location.isFs || isRecycle) return formatSize(total)
    return ""
  })()

  /* ---------- selection helpers ---------- */
  const clickItem = (e: React.MouseEvent, it: Item) => {
    e.stopPropagation()
    if (e.ctrlKey) {
      const n = new Set(selected)
      if (n.has(it.key)) n.delete(it.key)
      else n.add(it.key)
      setSelected(n)
    } else setSelected(new Set([it.key]))
  }

  const renameItem = (it: Item, v: string | null) => {
    setRenaming(null)
    if (!v || !it.node || v === it.node.name) return
    const e = it.node.type === "file" ? it.node.name.match(/\.(lnk|url|pif)$/i)?.[0] ?? "" : ""
    const newName = e && !v.toLowerCase().endsWith(e.toLowerCase()) ? v + e : v
    if (!fs.rename(it.path!, newName)) wm.msgBox({ parentId: win.id, title: "Error Renaming File", text: "Cannot rename file: A file with the name you specified already exists. Specify a different file name.", icon: "error" })
  }

  const addressOptions = [
    { v: SPECIAL.DESKTOP, label: "Desktop", icon: "desktop" as IconName },
    { v: SPECIAL.MYCOMPUTER, label: "My Computer", icon: "computer_explorer" as IconName },
    ...Object.entries(fs.drives).sort(([a], [b]) => a.localeCompare(b)).map(([l, d]) => ({ v: l + "\\", label: driveName(l, d), icon: (d.drive?.kind === "cdrom" ? "cd_drive" : d.drive?.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive") as IconName })),
    { v: SPECIAL.CONTROLPANEL, label: "Control Panel", icon: "directory_control_panel" as IconName },
    { v: SPECIAL.NETWORK, label: "Network Neighborhood", icon: "network_normal_two_pcs" as IconName },
    { v: SPECIAL.RECYCLE, label: "Recycle Bin", icon: "recycle_bin_empty" as IconName },
  ]
  const currentAddr = addressOptions.find((o) => o.v.toUpperCase() === loc.toUpperCase().replace(/([A-Z]:)$/, "$1\\"))

  const TB = ({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" className="tbtn" title={title} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )

  return (
    <>
      <MenuBar menus={menus} />
      {showToolbar && (
        <div className="toolbar" style={{ gap: 4 }}>
          <Select
            value={currentAddr?.v ?? "__cur"}
            onChange={(e) => e.target.value !== "__cur" && navigate(e.target.value)}
            style={{ width: 180, height: 20, padding: "1px 2px" }}
          >
            {!currentAddr && <option value="__cur">{location.title}</option>}
            {addressOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
          <TB title="Up One Level" onClick={up} disabled={!location.parent}>
            <img src={iconUrl("directory_open_cool", 16)} alt="" />
          </TB>
          <div className="tsep" />
          <TB title="Cut" onClick={() => cutCopy("cut")} disabled={!fsSel.length}>
            <span style={{ fontSize: 12 }}>✂</span>
          </TB>
          <TB title="Copy" onClick={() => cutCopy("copy")} disabled={!fsSel.length}>
            <img src={iconUrl("file_set", 16)} alt="" />
          </TB>
          <TB title="Paste" onClick={paste} disabled={!fileClip || !location.isFs}>
            <img src={iconUrl("note", 16)} alt="" />
          </TB>
          <div className="tsep" />
          <TB title="Undo" onClick={() => {}} disabled>
            <span style={{ fontSize: 12 }}>↶</span>
          </TB>
          <div className="tsep" />
          <TB title="Delete" onClick={del} disabled={!fsSel.length}>
            <img src={iconUrl("erase_file", 16)} alt="" />
          </TB>
          <TB title="Properties" onClick={properties}>
            <img src={iconUrl("file_lines", 16)} alt="" />
          </TB>
          <div className="tsep" />
          {(["large", "small", "list", "details"] as View[]).map((v) => (
            <button key={v} type="button" className={`tbtn ${view === v ? "on" : ""}`} title={{ large: "Large Icons", small: "Small Icons", list: "List", details: "Details" }[v]} onClick={() => setView(v)}>
              <ViewGlyph v={v} />
            </button>
          ))}
        </div>
      )}
      <div className="explorer-body" style={{ padding: "2px 0 0" }}>
        {tree && <TreePane loc={loc} onNavigate={navigate} expanded={expanded} setExpanded={setExpanded} />}
        <div
          ref={listRef}
          className={`explorer-list w95-scroll ${view}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelected(new Set())
              setRenaming(null)
            }
          }}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) showContextMenu(e, bgMenu)
          }}
        >
          {view === "details" ? (
            <table className="details-table">
              <thead>
                <tr>
                  <th onClick={() => setSort("name")}>Name</th>
                  {isRecycle && <th>Original Location</th>}
                  <th onClick={() => setSort("size")} style={{ textAlign: "right" }}>
                    {loc.toUpperCase() === SPECIAL.MYCOMPUTER ? "Total Size" : "Size"}
                  </th>
                  <th onClick={() => setSort("type")}>Type</th>
                  <th onClick={() => setSort("modified")}>Modified</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.key}
                    className={selected.has(it.key) ? "sel" : ""}
                    onClick={(e) => clickItem(e, it)}
                    onDoubleClick={() => openItem(it)}
                    onContextMenu={(e) => {
                      setSelected(new Set([it.key]))
                      showContextMenu(e, itemMenu(it))
                    }}
                  >
                    <td>
                      <img src={iconUrl(it.icon, 16)} alt="" />
                      {renaming === it.key ? <RenameBox value={it.node?.name ?? it.name} onDone={(v) => renameItem(it, v)} /> : it.name}
                    </td>
                    {isRecycle && <td>{it.extra}</td>}
                    <td style={{ textAlign: "right" }}>{it.size !== undefined ? (it.key.length === 2 ? formatSize(it.size) : formatSizeKB(it.size)) : ""}</td>
                    <td>{it.typeName}</td>
                    <td>{it.modified ? formatDate(it.modified) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            items.map((it) => (
              <button
                type="button"
                key={it.key}
                className={`file-icon ${selected.has(it.key) ? "sel" : ""}`}
                onClick={(e) => clickItem(e, it)}
                onDoubleClick={() => openItem(it)}
                onContextMenu={(e) => {
                  setSelected(new Set([it.key]))
                  showContextMenu(e, itemMenu(it))
                }}
                title={view === "large" ? undefined : it.typeName}
              >
                <img src={iconUrl(it.icon, view === "large" ? 32 : 16)} alt="" />
                {renaming === it.key ? <RenameBox value={it.node?.name ?? it.name} onDone={(v) => renameItem(it, v)} /> : <span className="lbl">{it.name}</span>}
              </button>
            ))
          )}
        </div>
      </div>
      {showStatus && <StatusBar cells={[statusText, sizeText]} />}
    </>
  )
}

function ViewGlyph({ v }: { v: View }) {
  const s: React.CSSProperties = { width: 14, height: 12, display: "grid", gap: 1 }
  if (v === "large") return <div style={{ ...s, gridTemplateColumns: "1fr 1fr" }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ background: "#000080" }} />)}</div>
  if (v === "small") return <div style={{ ...s, gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <i key={i} style={{ background: i % 2 ? "#000080" : "transparent" }} />)}</div>
  if (v === "list") return <div style={{ ...s, gridTemplateColumns: "3px 1fr 3px 1fr", gridTemplateRows: "repeat(3, 1fr)" }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <i key={i} style={{ background: i % 2 ? "#000" : "#000080" }} />)}</div>
  return <div style={{ ...s, gridTemplateColumns: "3px 1fr 1fr", gridTemplateRows: "repeat(3, 1fr)" }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <i key={i} style={{ background: i % 3 === 0 ? "#000080" : "#000" }} />)}</div>
}

/* ------------------------------------------------------------------ */
/*  Tree pane                                                           */
/* ------------------------------------------------------------------ */

function TreePane({ loc, onNavigate, expanded, setExpanded }: { loc: string; onNavigate: (l: string) => void; expanded: Set<string>; setExpanded: React.Dispatch<React.SetStateAction<Set<string>>> }) {
  useFS()
  const toggle = (id: string) =>
    setExpanded((e) => {
      const n = new Set(e)
      if (n.has(id.toUpperCase())) n.delete(id.toUpperCase())
      else n.add(id.toUpperCase())
      return n
    })

  const children = (id: string): { id: string; name: string; icon: IconName; hasKids: boolean }[] => {
    const up = id.toUpperCase()
    if (up === SPECIAL.DESKTOP) {
      return [
        { id: SPECIAL.MYCOMPUTER, name: "My Computer", icon: "computer_explorer", hasKids: true },
        { id: SPECIAL.NETWORK, name: "Network Neighborhood", icon: "network_normal_two_pcs", hasKids: true },
        { id: SPECIAL.RECYCLE, name: "Recycle Bin", icon: fs.recycleCount() ? "recycle_bin_full" : "recycle_bin_empty", hasKids: false },
        { id: SPECIAL.BRIEFCASE, name: "My Briefcase", icon: "briefcase", hasKids: false },
        ...fs.list(DESKTOP_DIR).filter((n) => n.type === "dir").map((n) => ({ id: DESKTOP_DIR + "\\" + n.name, name: n.name, icon: "directory_closed" as IconName, hasKids: fs.list(DESKTOP_DIR + "\\" + n.name).some((c) => c.type === "dir") })),
      ]
    }
    if (up === SPECIAL.MYCOMPUTER) {
      return [
        ...Object.entries(fs.drives).sort(([a], [b]) => a.localeCompare(b)).map(([l, d]) => ({ id: l + "\\", name: driveName(l, d), icon: (d.drive?.kind === "cdrom" ? "cd_drive" : d.drive?.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive") as IconName, hasKids: d.drive?.ready !== false && fs.list(l + "\\").some((c) => c.type === "dir") })),
        { id: SPECIAL.CONTROLPANEL, name: "Control Panel", icon: "directory_control_panel", hasKids: false },
        { id: SPECIAL.PRINTERS, name: "Printers", icon: "printer", hasKids: false },
        { id: SPECIAL.DIALUP, name: "Dial-Up Networking", icon: "directory_dial_up_networking", hasKids: false },
      ]
    }
    if (up === SPECIAL.NETWORK) return [{ id: SPECIAL.ENTIRENET, name: "Entire Network", icon: "entire_network_globe", hasKids: false }, { id: "C:\\", name: profile.firstName.toLowerCase() + "-pc", icon: "computer", hasKids: true }]
    if (isSpecial(id)) return []
    if (!fs.driveReady(id)) return []
    return fs.list(id).filter((n) => n.type === "dir").map((n) => {
      const p = id.replace(/\\$/, "") + "\\" + n.name
      return { id: p, name: n.name, icon: iconFor(n, p), hasKids: fs.list(p).some((c) => c.type === "dir") }
    })
  }

  const rows: React.ReactNode[] = []
  const render = (id: string, name: string, icon: IconName, depth: number, hasKids: boolean) => {
    const isOpen = expanded.has(id.toUpperCase())
    const isSel = id.toUpperCase().replace(/\\$/, "") === loc.toUpperCase().replace(/\\$/, "")
    rows.push(
      <div key={id} className={`tree-node ${isSel ? "sel" : ""}`} style={{ paddingLeft: depth * 18 + 2 }}>
        <span className={`tw ${hasKids ? (isOpen ? "open" : "closed") : "leaf"}`} onClick={() => hasKids && toggle(id)} />
        <img src={iconUrl(icon, 16)} alt="" onClick={() => onNavigate(id)} onDoubleClick={() => hasKids && toggle(id)} />
        <span className="tn-label" onClick={() => onNavigate(id)} onDoubleClick={() => hasKids && toggle(id)}>
          {name}
        </span>
      </div>,
    )
    if (isOpen && hasKids) for (const c of children(id)) render(c.id, c.name, c.icon, depth + 1, c.hasKids)
  }
  render(SPECIAL.DESKTOP, "Desktop", "desktop", 0, true)

  return (
    <div className="explorer-tree w95-scroll">
      <div style={{ padding: "2px 4px", borderBottom: "1px solid var(--shadow)", marginBottom: 2 }}>All Folders</div>
      {rows}
    </div>
  )
}

registerApp({
  id: "explorer",
  name: "Windows Explorer",
  icon: "directory_explorer",
  component: Explorer,
  width: 560,
  height: 400,
  minW: 300,
  minH: 200,
  exe: "EXPLORER.EXE",
  startMenu: ["Programs"],
  title: (p) => (p.path ? resolveLocationTitle(String(p.path), !!p.tree) : "My Computer"),
})

function resolveLocationTitle(path: string, tree: boolean) {
  try {
    const l = resolveLocation(path)
    return tree ? `Exploring - ${l.title}` : l.title
  } catch {
    return path
  }
}

/* ------------------------------------------------------------------ */
/*  Control Panel launcher                                              */
/* ------------------------------------------------------------------ */

registerApp({
  id: "controlpanel",
  name: "Control Panel",
  icon: "directory_control_panel",
  component: ({ win }: AppProps) => {
    const done = useRef(false)
    useEffect(() => {
      if (done.current) return
      done.current = true
      wm.close(win.id)
      launch("explorer", { path: SPECIAL.CONTROLPANEL })
    }, [win.id])
    return null
  },
  width: 100,
  height: 100,
  noTaskbar: true,
  exe: "CONTROL.EXE",
})

/* ------------------------------------------------------------------ */
/*  Drive properties                                                    */
/* ------------------------------------------------------------------ */

function DriveProps({ win }: AppProps) {
  const letter = String(win.props.drive ?? "C:").toUpperCase()
  const d = fs.drives[letter]
  const [tab, setTab] = useState(0)
  const [label, setLabel] = useState(d?.drive?.label ?? "")
  if (!d) return null
  const total = d.drive?.total ?? 0
  const used = d.drive?.ready === false ? 0 : fs.usedSpace(letter)
  const free = Math.max(0, total - used)
  const pct = total ? used / total : 0
  return (
    <div className="col" style={{ flex: 1, padding: 8 }}>
      <Tabs tabs={["General", "Tools"]} active={tab} onChange={setTab} />
      <div className="tab-page col" style={{ flex: 1, gap: 10 }}>
        {tab === 0 ? (
          <>
            <div className="row gap8">
              <img src={iconUrl(d.drive?.kind === "cdrom" ? "cd_drive" : d.drive?.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive", 32)} alt="" />
              <span style={{ width: 50 }}>Label:</span>
              <TextInput value={label} onChange={(e) => setLabel(e.target.value.toUpperCase().slice(0, 11))} style={{ flex: 1 }} disabled={d.drive?.kind !== "hdd"} />
            </div>
            <div className="hr" />
            <table style={{ borderSpacing: "0 4px" }}>
              <tbody>
                <tr><td style={{ width: 90 }}>Type:</td><td>{d.drive?.kind === "cdrom" ? "CD-ROM Disc" : d.drive?.kind === "floppy" ? "3½ Inch Floppy Disk" : "Local Disk"}</td></tr>
                <tr><td><span style={{ display: "inline-block", width: 10, height: 10, background: "#000080", marginRight: 6 }} />Used space:</td><td>{used.toLocaleString()} bytes</td><td style={{ paddingLeft: 10 }}>{formatSize(used)}</td></tr>
                <tr><td><span style={{ display: "inline-block", width: 10, height: 10, background: "#ff00ff", marginRight: 6 }} />Free space:</td><td>{free.toLocaleString()} bytes</td><td style={{ paddingLeft: 10 }}>{formatSize(free)}</td></tr>
              </tbody>
            </table>
            <div className="hr" />
            <table style={{ borderSpacing: "0 4px" }}>
              <tbody>
                <tr><td style={{ width: 90 }}>Capacity:</td><td>{total.toLocaleString()} bytes</td><td style={{ paddingLeft: 10 }}>{formatSize(total)}</td></tr>
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "center", padding: 10 }}>
              <svg width="120" height="70" viewBox="0 0 120 70">
                <ellipse cx="60" cy="45" rx="55" ry="20" fill="#ff00ff" stroke="#000" />
                <path d={`M60 45 L${60 + 55 * Math.cos(-Math.PI / 2)} ${45 + 20 * Math.sin(-Math.PI / 2)} A55 20 0 ${pct > 0.5 ? 1 : 0} 1 ${60 + 55 * Math.cos(-Math.PI / 2 + pct * Math.PI * 2)} ${45 + 20 * Math.sin(-Math.PI / 2 + pct * Math.PI * 2)} Z`} fill="#000080" stroke="#000" />
                <ellipse cx="60" cy="38" rx="55" ry="20" fill="none" stroke="#000" />
              </svg>
            </div>
            <div className="center">Drive {letter[0]}</div>
          </>
        ) : (
          <>
            <div className="groupbox" style={{ paddingTop: 16 }}>
              <span className="legend">Error-checking status</span>
              <div className="row" style={{ gap: 10 }}>
                <img src={iconUrl("scandisk", 32)} alt="" />
                <div style={{ flex: 1 }}>You last checked this drive for errors 2 day(s) ago.</div>
                <Button onClick={() => launch("scandisk")}>&Check Now...</Button>
              </div>
            </div>
            <div className="groupbox" style={{ paddingTop: 16 }}>
              <span className="legend">Backup status</span>
              <div className="row" style={{ gap: 10 }}>
                <img src={iconUrl("backup_devices_2", 32)} alt="" />
                <div style={{ flex: 1 }}>Windows was unable to determine when you last backed up files on this drive.</div>
                <Button onClick={() => launch("backup")}>&Backup Now...</Button>
              </div>
            </div>
            <div className="groupbox" style={{ paddingTop: 16 }}>
              <span className="legend">Defragmentation status</span>
              <div className="row" style={{ gap: 10 }}>
                <img src={iconUrl("defragment", 32)} alt="" />
                <div style={{ flex: 1 }}>You last defragmented this drive 9 day(s) ago.</div>
                <Button onClick={() => launch("defrag")}>&Defragment Now...</Button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="dlg-buttons" style={{ paddingTop: 8 }}>
        <Button isDefault onClick={() => { if (d.drive && d.drive.kind === "hdd") d.drive.label = label; wm.close(win.id) }}>OK</Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        <Button disabled>&Apply</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "driveprops",
  name: "Drive Properties",
  icon: "hard_disk_drive",
  component: DriveProps,
  width: 360,
  height: 440,
  resizable: false,
  maximizable: false,
  title: (p) => {
    const l = String(p.drive ?? "C:").toUpperCase()
    const d = fs.drives[l]
    return d ? `${driveName(l, d)} Properties` : "Properties"
  },
})

/* ------------------------------------------------------------------ */
/*  Format dialog                                                       */
/* ------------------------------------------------------------------ */

function FormatDlg({ win }: AppProps) {
  const letter = String(win.props.drive ?? "A:").toUpperCase()
  const [running, setRunning] = useState(false)
  const [pct, setPct] = useState(0)
  const [kind, setKind] = useState<"quick" | "full" | "sys">("quick")
  const [label, setLabel] = useState("")
  const start = async () => {
    if (letter === "C:" || letter === "D:") {
      wm.msgBox({ parentId: win.id, title: "Format", text: letter === "C:" ? "Windows cannot format this drive. Quit any disk utilities or other programs that are using this drive, and make sure that no window is displaying the contents of the drive. Then try formatting again." : "Windows cannot format a CD-ROM disc.", icon: "error" })
      return
    }
    setRunning(true)
    for (let i = 0; i <= 30; i++) {
      await new Promise((r) => setTimeout(r, 60))
      setPct(i * 3)
    }
    setRunning(false)
    wm.msgBox({ parentId: win.id, title: "Format - 3½ Floppy (A:)", text: "Windows was unable to complete the format.\n\nThe device is not ready.", icon: "error" })
  }
  return (
    <div className="dlg" style={{ gap: 10 }}>
      <div className="row gap8">
        <span style={{ width: 60 }}>Capacity:</span>
        <Select style={{ flex: 1 }} defaultValue={letter === "A:" ? "1.44 Mb (3.5\")" : "2.0 Gb"}>
          <option>{letter === "A:" ? "1.44 Mb (3.5\")" : "2.0 Gb"}</option>
        </Select>
      </div>
      <div className="groupbox" style={{ paddingTop: 14 }}>
        <span className="legend">Format type</span>
        <div className="col" style={{ gap: 4 }}>
          <label className="radio"><input type="radio" checked={kind === "quick"} onChange={() => setKind("quick")} /> <span>&Quick (erase)</span></label>
          <label className="radio"><input type="radio" checked={kind === "full"} onChange={() => setKind("full")} /> <span>&Full</span></label>
          <label className="radio"><input type="radio" checked={kind === "sys"} onChange={() => setKind("sys")} /> <span>Copy &system files only</span></label>
        </div>
      </div>
      <div className="groupbox" style={{ paddingTop: 14 }}>
        <span className="legend">Other options</span>
        <div className="col" style={{ gap: 6 }}>
          <div className="row gap8"><span style={{ width: 50 }}>&Label:</span><TextInput value={label} onChange={(e) => setLabel(e.target.value.toUpperCase().slice(0, 11))} style={{ flex: 1 }} /></div>
          <Checkbox label="&No label" checked={!label} onChange={() => setLabel("")} />
          <Checkbox label="&Display summary when finished" checked onChange={() => {}} />
          <Checkbox label="&Copy system files" checked={false} onChange={() => {}} />
        </div>
      </div>
      <div className="progress" style={{ height: 16 }}>
        {Array.from({ length: Math.floor(pct / 3.5) }).map((_, i) => <div key={i} className="blk" />)}
      </div>
      <div className="dlg-buttons" style={{ position: "absolute", right: 12, top: 12, flexDirection: "column" }}>
        <Button isDefault onClick={start} disabled={running}>&Start</Button>
        <Button onClick={() => wm.close(win.id)}>Close</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "format",
  name: "Format",
  icon: "floppy_drive_3_5",
  component: FormatDlg,
  width: 400,
  height: 380,
  resizable: false,
  maximizable: false,
  title: (p) => `Format - ${String(p.drive ?? "A:").toUpperCase() === "A:" ? "3½ Floppy (A:)" : `(${String(p.drive)})`}`,
})

/* ------------------------------------------------------------------ */
/*  Print queue                                                         */
/* ------------------------------------------------------------------ */

registerApp({
  id: "printqueue",
  name: "Printer",
  icon: "printer",
  component: ({ win }: AppProps) => (
    <>
      <MenuBar menus={[{ label: "&Printer", items: [{ label: "&Pause Printing" }, { label: "P&urge Print Jobs" }, { sep: true }, { label: "Set As De&fault", checked: true }, { label: "P&roperties", disabled: true }, { sep: true }, { label: "&Close", onClick: () => wm.close(win.id) }] }, { label: "&Document", items: [{ label: "&Pause Printing", disabled: true }, { label: "&Cancel Printing", disabled: true }] }, { label: "&View", items: [{ label: "&Status Bar", checked: true }] }, { label: "&Help", items: [{ label: "&Help Topics" }] }]} />
      <table className="details-table" style={{ flex: 1, alignSelf: "flex-start", background: "var(--window)" }}>
        <thead><tr><th>Document Name</th><th>Status</th><th>Owner</th><th>Progress</th><th>Started At</th></tr></thead>
        <tbody><tr><td colSpan={5} style={{ height: 200 }} /></tr></tbody>
      </table>
      <StatusBar cells={["0 jobs in queue"]} />
    </>
  ),
  width: 500,
  height: 300,
  title: (p) => String(p.name ?? "Printer"),
})

/* ------------------------------------------------------------------ */
/*  Folder Options                                                      */
/* ------------------------------------------------------------------ */

registerApp({
  id: "folderoptions",
  name: "Options",
  icon: "directory_closed",
  component: ({ win }: AppProps) => {
    const [tab, setTab] = useState(0)
    const [hidden, setHidden] = useState<"all" | "hide">("hide")
    return (
      <div className="col" style={{ flex: 1, padding: 8 }}>
        <Tabs tabs={["Folder", "View", "File Types"]} active={tab} onChange={setTab} />
        <div className="tab-page col" style={{ flex: 1, gap: 10 }}>
          {tab === 0 && (
            <>
              <div>Browsing options</div>
              <label className="radio"><input type="radio" defaultChecked /> <span>Browse folders using a &separate window for each folder.</span></label>
              <label className="radio"><input type="radio" /> <span>Browse folders by using a single &window that changes as you open each folder.</span></label>
            </>
          )}
          {tab === 1 && (
            <>
              <div>Hidden files:</div>
              <label className="radio"><input type="radio" checked={hidden === "all"} onChange={() => setHidden("all")} /> <span>Show &all files</span></label>
              <label className="radio"><input type="radio" checked={hidden === "hide"} onChange={() => setHidden("hide")} /> <span>&Hide files of these types:</span></label>
              <div className="listbox" style={{ height: 70, marginLeft: 20 }}>{[".DLL (Application Extension)", ".SYS (System file)", ".VXD (Virtual device driver)", ".386 (Virtual device driver)", ".DRV (Device driver)"].map((t) => <div key={t} className="li">{t}</div>)}</div>
              <Checkbox label="Display the &full MS-DOS path in the title bar" checked={false} onChange={() => {}} />
              <Checkbox label="Hide MS-DOS file &extensions for file types that are registered" checked onChange={() => {}} />
              <Checkbox label="&Include description bar for right and left panes" checked onChange={() => {}} />
            </>
          )}
          {tab === 2 && (
            <>
              <div>Registered file &types:</div>
              <div className="listbox w95-scroll" style={{ flex: 1 }}>
                {["Application", "Bitmap Image", "Help File", "Internet Document (HTML)", "MIDI Sequence", "MS-DOS Batch File", "Shortcut", "Text Document", "Wave Sound", "WordPad Document"].map((t) => <div key={t} className="li"><img src={iconUrl("file_windows", 16)} alt="" />{t}</div>)}
              </div>
            </>
          )}
        </div>
        <div className="dlg-buttons" style={{ paddingTop: 8 }}>
          <Button isDefault onClick={() => wm.close(win.id)}>OK</Button>
          <Button onClick={() => wm.close(win.id)}>Cancel</Button>
          <Button disabled>&Apply</Button>
        </div>
      </div>
    )
  },
  width: 360,
  height: 400,
  resizable: false,
  maximizable: false,
  singleton: true,
})

/* ------------------------------------------------------------------ */
/*  Find: Files or Folders / Computer                                   */
/* ------------------------------------------------------------------ */

function FindFiles({ win }: AppProps) {
  useFS()
  const computer = !!win.props.computer
  const [named, setNamed] = useState("")
  const [text, setText] = useState("")
  const [root, setRoot] = useState<string>((win.props.root as string) ?? "C:\\")
  const [sub, setSub] = useState(true)
  const [tab, setTab] = useState(0)
  const [results, setResults] = useState<{ path: string; node: FSNode }[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    wm.setTitle(win.id, computer ? "Find: Computer" : named ? `Find: Files named ${named}` : "Find: All Files")
  }, [computer, named, win.id])

  const go = async () => {
    setSearching(true)
    setResults(null)
    await new Promise((r) => setTimeout(r, 300))
    if (computer) {
      const q = named.toLowerCase()
      const pc = profile.firstName.toLowerCase() + "-pc"
      setResults(q && pc.includes(q) ? [{ path: pc, node: { type: "dir", name: pc, children: {}, modified: Date.now() } }] : [])
      setSearching(false)
      return
    }
    let pattern = named.trim() || "*"
    if (!pattern.includes("*") && !pattern.includes("?")) pattern = `*${pattern}*`
    const r = root === "::MYCOMPUTER" ? Object.keys(fs.drives).filter((d) => fs.driveReady(d)).flatMap((d) => fs.find(d + "\\", pattern, text || undefined)) : sub ? fs.find(root, pattern, text || undefined) : fs.list(root).filter((n) => new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i").test(n.name)).map((n) => ({ path: fs.realPath(root).replace(/\\$/, "") + "\\" + n.name, node: n }))
    setResults(r)
    setSearching(false)
  }

  const reset = () => {
    setNamed("")
    setText("")
    setResults(null)
  }

  const menus = [
    { label: "&File", items: [{ label: "&Open", disabled: !sel, onClick: () => sel && openNode(sel, fs.get(sel)!) }, { label: "Open &Containing Folder", disabled: !sel, onClick: () => sel && launch("explorer", { path: fs.parent(sel) }) }, { sep: true }, { label: "&Save Search", disabled: true }, { sep: true }, { label: "&Close", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "Select &All", onClick: () => {} }, { label: "&Invert Selection" }] },
    { label: "&View", items: [{ label: "Lar&ge Icons" }, { label: "S&mall Icons" }, { label: "&List" }, { label: "&Details", checked: true }] },
    { label: "&Options", items: [{ label: "&Case Sensitive" }, { label: "&Save Results" }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "find" }) }] },
  ]

  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ padding: 6, gap: 4 }}>
        <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <div className="col" style={{ flex: 1 }}>
            {!computer && <Tabs tabs={["Name & Location", "Date Modified", "Advanced"]} active={tab} onChange={setTab} />}
            <div className="tab-page col" style={{ gap: 8, minHeight: 90 }}>
              {computer ? (
                <div className="row gap8">
                  <span style={{ width: 60 }}>&Named:</span>
                  <TextInput value={named} onChange={(e) => setNamed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} style={{ flex: 1 }} autoFocus />
                </div>
              ) : tab === 0 ? (
                <>
                  <div className="row gap8">
                    <span style={{ width: 90 }}>&Named:</span>
                    <TextInput value={named} onChange={(e) => setNamed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} style={{ flex: 1 }} autoFocus />
                  </div>
                  <div className="row gap8">
                    <span style={{ width: 90 }}>&Containing text:</span>
                    <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} style={{ flex: 1 }} />
                  </div>
                  <div className="row gap8">
                    <span style={{ width: 90 }}>&Look in:</span>
                    <Select value={root} onChange={(e) => setRoot(e.target.value)} style={{ flex: 1 }}>
                      <option value="::MYCOMPUTER">My Computer</option>
                      {Object.entries(fs.drives).map(([l, d]) => (
                        <option key={l} value={l + "\\"}>
                          {driveName(l, d)}
                        </option>
                      ))}
                      <option value="C:\My Documents">My Documents</option>
                      <option value="C:\WINDOWS\DESKTOP">Desktop</option>
                      {!["::MYCOMPUTER", "A:\\", "C:\\", "D:\\", "C:\\My Documents", "C:\\WINDOWS\\DESKTOP"].includes(root) && <option value={root}>{root}</option>}
                    </Select>
                    <Button onClick={async () => {
                      const p = await wm.prompt({ parentId: win.id, title: "Browse for Folder", label: "Folder:", value: root })
                      if (p && fs.isDir(p)) setRoot(fs.realPath(p))
                    }}>&Browse...</Button>
                  </div>
                  <div style={{ paddingLeft: 98 }}>
                    <Checkbox label="Include &subfolders" checked={sub} onChange={setSub} />
                  </div>
                </>
              ) : tab === 1 ? (
                <>
                  <label className="radio"><input type="radio" defaultChecked /> <span>&All files</span></label>
                  <label className="radio"><input type="radio" /> <span>Find all files created or &modified:</span></label>
                  <div style={{ paddingLeft: 20 }} className="col gap4">
                    <label className="radio"><input type="radio" disabled /> <span>&between 1/1/95 and today</span></label>
                    <label className="radio"><input type="radio" disabled /> <span>during the previous 1 &month(s)</span></label>
                    <label className="radio"><input type="radio" disabled /> <span>during the previous 1 &day(s)</span></label>
                  </div>
                </>
              ) : (
                <>
                  <div className="row gap8"><span style={{ width: 90 }}>Of &type:</span><Select style={{ flex: 1 }}><option>All Files and Folders</option><option>Application</option><option>Text Document</option></Select></div>
                  <div className="row gap8"><span style={{ width: 90 }}>&Size is:</span><Select style={{ width: 80 }}><option>At least</option><option>At most</option></Select><TextInput style={{ width: 60 }} defaultValue="0" /> KB</div>
                </>
              )}
            </div>
          </div>
          <div className="col" style={{ gap: 6, paddingTop: computer ? 0 : 21 }}>
            <Button isDefault onClick={go} disabled={searching}>F&ind Now</Button>
            <Button onClick={() => setSearching(false)} disabled={!searching}>S&top</Button>
            <Button onClick={reset}>Ne&w Search</Button>
            <div style={{ display: "flex", justifyContent: "center", padding: 6 }}>
              <img src={iconUrl(computer ? "search_computer" : "search_file_2", 32)} alt="" style={{ animation: searching ? "blink 0.6s steps(1) infinite" : undefined }} />
            </div>
          </div>
        </div>
      </div>
      {results !== null && (
        <>
          <div className="explorer-list details w95-scroll" style={{ margin: "0 6px", flex: 1 }}>
            <table className="details-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>In Folder</th>
                  <th style={{ textAlign: "right" }}>Size</th>
                  <th>Type</th>
                  <th>Modified</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.path} className={sel === r.path ? "sel" : ""} onClick={() => setSel(r.path)} onDoubleClick={() => (computer ? launch("explorer", { path: "C:\\" }) : openNode(r.path, r.node))}>
                    <td>
                      <img src={iconUrl(computer ? "computer" : iconFor(r.node, r.path), 16)} alt="" />
                      {computer ? r.path : displayName(r.node)}
                    </td>
                    <td>{computer ? "Portfolio" : fs.parent(r.path)}</td>
                    <td style={{ textAlign: "right" }}>{r.node.type === "file" ? formatSizeKB(fs.sizeOf(r.node)) : ""}</td>
                    <td>{computer ? "Computer" : fileTypeName(r.node)}</td>
                    <td>{computer ? "" : formatDate(r.node.modified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatusBar cells={[`${results.length} file(s) found`, ""]} />
        </>
      )}
    </>
  )
}

registerApp({
  id: "find",
  name: "Find: All Files",
  icon: "search_file",
  component: FindFiles,
  width: 500,
  height: 400,
  minW: 420,
  minH: 240,
  title: (p) => (p.computer ? "Find: Computer" : "Find: All Files"),
})
