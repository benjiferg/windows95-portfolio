"use client"

import React, { useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch, useWM } from "@/lib/win95/store"
import { fs, formatSize, type FSNode } from "@/lib/win95/fs"
import { profile, software } from "@/lib/win95/portfolio"
import { icon as iconUrl, type IconName } from "@/lib/win95/icons"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Checkbox, Icon, Progress, Radio, Select, StatusBar, Tabs, TextInput } from "@/components/win95/controls"
import { sounds } from "@/lib/win95/sounds"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function driveList() {
  return Object.entries(fs.drives)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([l, d]) => ({ letter: l, label: d.drive?.kind === "floppy" ? `3½ Floppy (${l})` : `${d.drive?.label ? d.drive.label[0] + d.drive.label.slice(1).toLowerCase() : "Local Disk"} (${l})`, kind: d.drive?.kind ?? "hdd", ready: d.drive?.ready !== false }))
}

/* ------------------------------------------------------------------ */
/*  ScanDisk                                                            */
/* ------------------------------------------------------------------ */

function ScanDisk({ win }: AppProps) {
  const drives = driveList()
  const [drive, setDrive] = useState("C:")
  const [thorough, setThorough] = useState(false)
  const [fix, setFix] = useState(true)
  const [running, setRunning] = useState(false)
  const [pct, setPct] = useState(0)
  const [status, setStatus] = useState("")
  const stop = useRef(false)

  const start = async () => {
    if (!fs.driveReady(drive)) {
      wm.msgBox({ parentId: win.id, title: "ScanDisk", text: `ScanDisk cannot check drive ${drive[0]} because the drive is not ready. Insert a disk and try again.`, icon: "error" })
      return
    }
    setRunning(true)
    stop.current = false
    const steps = ["Checking file allocation table...", "Checking directory structure...", "Checking file system...", "Checking long filenames...", ...(thorough ? ["Checking disk surface..."] : [])]
    for (let i = 0; i < steps.length && !stop.current; i++) {
      setStatus(steps[i])
      const base = (i / steps.length) * 100
      for (let k = 0; k <= 20 && !stop.current; k++) {
        setPct(base + (k / 20) * (100 / steps.length))
        await sleep(thorough && i === steps.length - 1 ? 90 : 45)
      }
    }
    setRunning(false)
    if (stop.current) {
      setStatus("")
      setPct(0)
      return
    }
    setPct(100)
    setStatus("ScanDisk did not find any errors on this drive.")
    const d = fs.drives[drive]
    let files = 0
    let dirs = 0
    let hidden = 0
    const walk = (n: FSNode) => {
      if (n.type !== "dir") return
      for (const c of Object.values(n.children)) {
        if (c.type === "dir") {
          dirs++
          walk(c)
        } else {
          files++
          if (c.hidden) hidden++
        }
      }
    }
    walk(d)
    const total = d.drive?.total ?? 0
    const used = fs.usedSpace(drive)
    sounds.ding()
    wm.msgBox({
      parentId: win.id,
      title: `ScanDisk Results - ${drives.find((x) => x.letter === drive)?.label}`,
      text: `ScanDisk did not find any errors on this drive.\n\n${total.toLocaleString()} bytes total disk space\n${(hidden * 32768).toLocaleString()} bytes in ${hidden} hidden files\n${(dirs * 32768).toLocaleString()} bytes in ${dirs} folders\n${used.toLocaleString()} bytes in ${files} user files\n${Math.max(0, total - used).toLocaleString()} bytes available on disk\n\n32,768 bytes in each allocation unit\n${Math.floor(total / 32768).toLocaleString()} total allocation units on disk\n${Math.floor(Math.max(0, total - used) / 32768).toLocaleString()} available allocation units`,
      icon: "none",
    })
  }

  return (
    <div className="dlg" style={{ gap: 8 }}>
      <div className="row gap8">
        <Icon name="scandisk" />
        <span>Select the drive(s) you want to check for errors:</span>
      </div>
      <div className="listbox" style={{ height: 60 }}>
        {drives.map((d) => (
          <div key={d.letter} className={`li ${drive === d.letter ? "sel" : ""}`} onClick={() => setDrive(d.letter)}>
            <img src={iconUrl(d.kind === "cdrom" ? "cd_drive" : d.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive", 16)} alt="" />
            {d.label}
          </div>
        ))}
      </div>
      <div className="groupbox col gap4" style={{ paddingTop: 14 }}>
        <span className="legend">Type of test</span>
        <Radio name="t" label="&Standard" checked={!thorough} onChange={() => setThorough(false)} />
        <div className="gray" style={{ paddingLeft: 20 }}>(checks files and folders for errors)</div>
        <Radio name="t" label="&Thorough" checked={thorough} onChange={() => setThorough(true)} />
        <div className="row" style={{ paddingLeft: 20, justifyContent: "space-between" }}>
          <span className="gray">(performs Standard test and scans disk surface for errors)</span>
          <Button className="sm" disabled={!thorough}>&Options...</Button>
        </div>
      </div>
      <Checkbox label="&Automatically fix errors" checked={fix} onChange={setFix} />
      <div style={{ minHeight: 14 }}>{status}</div>
      <Progress value={pct} />
      <div className="dlg-buttons">
        <Button isDefault onClick={start} disabled={running}>&Start</Button>
        <Button onClick={() => (running ? (stop.current = true) : wm.close(win.id))}>{running ? "Cancel" : "Close"}</Button>
        <Button onClick={() => wm.msgBox({ parentId: win.id, title: "ScanDisk Advanced Options", text: "Display summary: Always\nLog file: Replace log\nCross-linked files: Make copies\nLost file fragments: Convert to files\nCheck files for: Invalid file names, Invalid dates and times\nCheck host drive first", icon: "none" })}>&Advanced...</Button>
      </div>
    </div>
  )
}

registerApp({ id: "scandisk", name: "ScanDisk", icon: "scandisk", component: ScanDisk, width: 400, height: 370, resizable: false, maximizable: false, singleton: true, exe: "SCANDSKW.EXE", startMenu: ["Programs", "Accessories", "System Tools"], title: () => "ScanDisk - Benjamin (C:)" })

/* ------------------------------------------------------------------ */
/*  Disk Defragmenter                                                   */
/* ------------------------------------------------------------------ */

const DEFRAG_COLORS = ["#fff", "#000080", "#ff0000", "#008080", "#800080", "#c0c0c0"]

function Defrag({ win }: AppProps) {
  const [stage, setStage] = useState<"select" | "ready" | "running" | "done">("select")
  const [drive, setDrive] = useState("C:")
  const [pct, setPct] = useState(0)
  const [details, setDetails] = useState(false)
  const [blocks, setBlocks] = useState<number[]>(() => Array.from({ length: 600 }, (_, i) => (i < 420 ? (Math.random() < 0.15 ? 2 : Math.random() < 0.7 ? 1 : 0) : Math.random() < 0.1 ? 1 : 0)))
  const [paused, setPaused] = useState(false)
  const run = useRef(false)

  useEffect(() => {
    wm.setTitle(win.id, stage === "running" ? `Defragmenting Drive ${drive[0]}` : "Disk Defragmenter")
  }, [stage, drive, win.id])

  const start = async () => {
    setStage("running")
    run.current = true
    let b = blocks.slice()
    for (let p = 0; p <= 100 && run.current; p++) {
      while (paused && run.current) await sleep(100)
      // move a few used blocks to the front
      for (let k = 0; k < 6; k++) {
        const used = b.findIndex((v, i) => (v === 1 || v === 2) && i > p * 4 && b.slice(0, i).some((x) => x === 0))
        if (used < 0) break
        const empty = b.findIndex((x) => x === 0)
        if (empty < 0 || empty > used) break
        b[empty] = 1
        b[used] = 0
      }
      b = b.slice()
      setBlocks(b)
      setPct(p)
      await sleep(60)
    }
    if (run.current) {
      setStage("done")
      sounds.ding()
      const r = await wm.msgBox({ parentId: win.id, title: "Disk Defragmenter", text: `Defragmentation of drive ${drive[0]} is complete.\n\nDo you want to quit Disk Defragmenter?`, icon: "question", buttons: ["Yes", "No"] })
      if (r === "Yes") wm.close(win.id)
      else setStage("select")
    }
  }

  if (stage === "select") {
    return (
      <div className="dlg" style={{ gap: 10 }}>
        <div className="row gap8">
          <Icon name="defragment" />
          <span>Which drive do you want to defragment?</span>
        </div>
        <Select value={drive} onChange={(e) => setDrive(e.target.value)}>
          {driveList().map((d) => (
            <option key={d.letter} value={d.letter}>
              {d.label}
            </option>
          ))}
          <option value="all">All Hard Drives</option>
        </Select>
        <div className="gray">Copyright © 1988-1992 Symantec Corporation. Copyright © 1988-1995 Microsoft Corporation.</div>
        <div className="dlg-buttons">
          <Button isDefault onClick={() => {
            if (!fs.driveReady(drive)) {
              wm.msgBox({ parentId: win.id, title: "Disk Defragmenter", text: `Drive ${drive[0]} is not ready.`, icon: "error" })
              return
            }
            setStage("ready")
          }}>OK</Button>
          <Button onClick={() => wm.close(win.id)}>Exit</Button>
        </div>
      </div>
    )
  }
  if (stage === "ready") {
    return (
      <div className="dlg" style={{ gap: 10 }}>
        <div className="row gap8" style={{ alignItems: "flex-start" }}>
          <Icon name="msg_information" />
          <div>
            Drive {drive[0]} is 3 % fragmented.
            <br />
            <br />
            You don&apos;t need to defragment this drive now. If you want to defragment it anyway, click Start.
          </div>
        </div>
        <div className="dlg-buttons">
          <Button isDefault onClick={start}>&Start</Button>
          <Button onClick={() => setStage("select")}>&Select Drive...</Button>
          <Button onClick={() => wm.msgBox({ parameterId: win.id, parentId: win.id, title: "Advanced Options", text: "Defragmentation method:\n  ● Full defragmentation (both files and free space)\n  ○ Defragment files only\n  ○ Consolidate free space only\n\n☑ Check drive for errors", icon: "none" } as never)}>&Advanced...</Button>
          <Button onClick={() => wm.close(win.id)}>E&xit</Button>
        </div>
      </div>
    )
  }
  return (
    <div className="dlg" style={{ gap: 8 }}>
      {details && (
        <>
          <div className="defrag-grid w95-scroll" style={{ height: 180 }}>
            {blocks.map((b, i) => (
              <i key={i} style={{ background: DEFRAG_COLORS[b], boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }} />
            ))}
          </div>
          <div className="row" style={{ gap: 10, fontSize: 10, flexWrap: "wrap" }}>
            {[["Unoptimized data", 1], ["Optimized data", 1], ["Free space", 0], ["Data that will not be moved", 2], ["Bad area of disk", 4]].map(([l, c]) => (
              <span key={l as string} className="row gap4"><i style={{ display: "inline-block", width: 7, height: 9, background: DEFRAG_COLORS[c as number], boxShadow: "inset 0 0 0 1px #000" }} />{l}</span>
            ))}
          </div>
        </>
      )}
      <div className="row gap8">
        <Icon name="defragment" />
        <div style={{ flex: 1 }}>
          <Progress value={pct} />
          <div style={{ marginTop: 4 }}>{pct}% Complete</div>
        </div>
      </div>
      <div className="dlg-buttons center">
        <Button onClick={() => { run.current = false; wm.close(win.id) }}>&Stop</Button>
        <Button onClick={() => setPaused(!paused)}>{paused ? "&Resume" : "&Pause"}</Button>
        <Button onClick={() => { setDetails(!details); wm.update(win.id, { h: details ? 150 : 360, w: details ? 320 : 560 }) }}>{details ? "&Hide Details" : "Show &Details"}</Button>
      </div>
    </div>
  )
}

registerApp({ id: "defrag", name: "Disk Defragmenter", icon: "defragment", component: Defrag, width: 320, height: 150, resizable: false, maximizable: false, singleton: true, exe: "DEFRAG.EXE", startMenu: ["Programs", "Accessories", "System Tools"] })

/* ------------------------------------------------------------------ */
/*  Backup                                                              */
/* ------------------------------------------------------------------ */

function Backup({ win }: AppProps) {
  const [tab, setTab] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set(["C:\\My Documents"]))
  const [step, setStep] = useState(0)
  const [pct, setPct] = useState(0)
  const [welcome, setWelcome] = useState(true)
  const roots = ["C:\\My Documents", "C:\\Program Files", "C:\\WINDOWS", "C:\\Exchange"]
  const toggle = (p: string) =>
    setChecked((s) => {
      const n = new Set(s)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  const total = Array.from(checked).reduce((a, p) => a + fs.sizeOf(fs.get(p)!), 0)
  const start = async () => {
    setStep(2)
    for (let i = 0; i <= 100; i++) {
      setPct(i)
      await sleep(30)
    }
    sounds.ding()
    await wm.msgBox({ parentId: win.id, title: "Microsoft Backup", text: "Operation complete.", icon: "info" })
    setStep(0)
    setPct(0)
  }
  const menus = [
    { label: "&File", items: [{ label: "&Open File Set...", disabled: true }, { label: "&Save", disabled: true }, { label: "Save &As...", disabled: true }, { sep: true }, { label: "&Print...", disabled: true }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Settings", items: [{ label: "&File Filtering...", disabled: true }, { label: "&Drag and Drop...", disabled: true }, { label: "&Options...", disabled: true }] },
    { label: "&Tools", items: [{ label: "&Format Tape", disabled: true }, { label: "&Erase Tape", disabled: true }, { label: "&Redetect Tape Drive", onClick: () => wm.msgBox({ parentId: win.id, title: "Microsoft Backup", text: "Backup did not detect a tape drive on your computer.", icon: "info" }) }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "systools" }) }, { sep: true }, { label: "&About Backup", onClick: () => wm.msgBox({ parentId: win.id, title: "About Backup", text: "Microsoft Backup\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.\nPortions © Colorado Memory Systems.", icon: "none" }) }] },
  ]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ flex: 1, padding: 6 }}>
        <Tabs tabs={["Backup", "Restore", "Compare"]} active={tab} onChange={setTab} />
        <div className="tab-page col" style={{ flex: 1, gap: 8 }}>
          {step === 0 && (
            <>
              <div>{tab === 0 ? "What to back up:" : tab === 1 ? "Restore from:" : "Compare from:"}</div>
              <div className="row" style={{ gap: 6, flex: 1 }}>
                <div className="explorer-tree w95-scroll" style={{ flex: 1, width: "auto" }}>
                  <div className="tree-node"><span className="tw open" /><img src={iconUrl("desktop", 16)} alt="" /><span className="tn-label">Desktop</span></div>
                  <div className="tree-node" style={{ paddingLeft: 18 }}><span className="tw open" /><img src={iconUrl("computer_explorer", 16)} alt="" /><span className="tn-label">My Computer</span></div>
                  <div className="tree-node" style={{ paddingLeft: 36 }}><span className="tw open" /><img src={iconUrl("hard_disk_drive", 16)} alt="" /><span className="tn-label">Benjamin (C:)</span></div>
                  {roots.map((p) => (
                    <div key={p} className="tree-node" style={{ paddingLeft: 54 }}>
                      <span className="tw leaf" />
                      <label className="check" style={{ height: 16 }}><input type="checkbox" checked={checked.has(p)} onChange={() => toggle(p)} /></label>
                      <img src={iconUrl("directory_closed", 16)} alt="" />
                      <span className="tn-label">{fs.basename(p)}</span>
                    </div>
                  ))}
                </div>
                <div className="explorer-list details w95-scroll" style={{ flex: 1 }}>
                  <table className="details-table">
                    <thead><tr><th>Name</th><th>Size</th><th>Modified</th></tr></thead>
                    <tbody>
                      {Array.from(checked).flatMap((p) => fs.list(p).slice(0, 12).map((n) => <tr key={p + n.name}><td><img src={iconUrl(n.type === "dir" ? "directory_closed" : "file_windows", 16)} alt="" />{n.name}</td><td>{n.type === "file" ? formatSize(fs.sizeOf(n)) : ""}</td><td>{new Date(n.modified).toLocaleDateString()}</td></tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div>Where to back up:</div>
              <div className="explorer-tree w95-scroll" style={{ flex: 1, width: "auto" }}>
                {driveList().map((d) => (
                  <div key={d.letter} className={`tree-node ${d.letter === "A:" ? "sel" : ""}`} style={{ paddingLeft: 18 }}>
                    <span className="tw leaf" />
                    <img src={iconUrl(d.kind === "cdrom" ? "cd_drive" : d.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive", 16)} alt="" />
                    <span className="tn-label">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="gray">Selected: {formatSize(total)} in {checked.size} folder(s)</div>
            </>
          )}
          {step === 2 && (
            <div className="col gap8" style={{ padding: 20 }}>
              <div className="row gap8"><Icon name="backup_devices_2" /><div>Backing up to 3½ Floppy (A:)...<br /><span className="gray">Files: {Math.floor(pct * 3.2)} of 320 &middot; {formatSize(Math.floor((total * pct) / 100))}</span></div></div>
              <Progress value={pct} />
            </div>
          )}
        </div>
        <div className="row" style={{ justifyContent: "space-between", paddingTop: 6 }}>
          <span className="gray">{checked.size} folder(s) selected, {formatSize(total)}</span>
          <div className="dlg-buttons">
            {step === 0 && <Button isDefault onClick={() => setStep(1)}>&Next Step &gt;</Button>}
            {step === 1 && <><Button onClick={() => setStep(0)}>&lt; &Previous Step</Button><Button isDefault onClick={start}>Start &Backup</Button></>}
          </div>
        </div>
      </div>
      {welcome && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.1)" }}>
          <div style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 14, width: 380 }} className="col gap8">
            <div style={{ fontWeight: 700 }}>Welcome to Microsoft Backup</div>
            <div className="row gap8" style={{ alignItems: "flex-start" }}>
              <Icon name="backup_devices_2" />
              <div>
                Backup makes copies of your important files so that you can restore them if the originals are lost or damaged.
                <br />
                <br />
                There are three steps: select the files, choose the destination, and start the backup.
              </div>
            </div>
            <Checkbox label="&Don't show this again" checked={false} onChange={() => {}} />
            <div className="dlg-buttons"><Button isDefault onClick={() => setWelcome(false)}>OK</Button></div>
          </div>
        </div>
      )}
    </>
  )
}

registerApp({ id: "backup", name: "Microsoft Backup", icon: "backup_devices_2", component: Backup, width: 560, height: 420, minW: 400, minH: 300, singleton: true, exe: "BACKUP.EXE", startMenu: ["Programs", "Accessories", "System Tools"] })

/* ------------------------------------------------------------------ */
/*  DriveSpace                                                          */
/* ------------------------------------------------------------------ */

function DriveSpace({ win }: AppProps) {
  const [sel, setSel] = useState("C:")
  const menus = [
    { label: "&Drive", items: [{ label: "&Compress...", onClick: () => wm.msgBox({ parentId: win.id, title: "Compress a Drive", text: `Drive ${sel[0]} is a portfolio drive and cannot be compressed.\n\n(Compressing it would make the software harder to read.)`, icon: "warning" }) }, { label: "&Uncompress...", disabled: true }, { label: "&Adjust Free Space...", disabled: true }, { label: "&Properties...", onClick: () => launch("driveprops", { drive: sel }) }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Advanced", items: [{ label: "&Mount", disabled: true }, { label: "&Unmount", disabled: true }, { label: "&Create Empty...", disabled: true }, { label: "&Delete...", disabled: true }, { sep: true }, { label: "Change &Ratio...", disabled: true }, { label: "Change &Size...", disabled: true }, { sep: true }, { label: "&Settings...", disabled: true }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "systools" }) }, { sep: true }, { label: "&About DriveSpace", onClick: () => wm.msgBox({ parentId: win.id, title: "About DriveSpace", text: "Microsoft DriveSpace\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ padding: 6, flex: 1, gap: 4 }}>
        <div>Drives on this computer:</div>
        <div className="listbox w95-scroll" style={{ flex: 1 }}>
          {driveList().map((d) => (
            <div key={d.letter} className={`li ${sel === d.letter ? "sel" : ""}`} onClick={() => setSel(d.letter)} onDoubleClick={() => launch("driveprops", { drive: d.letter })}>
              <img src={iconUrl(d.kind === "cdrom" ? "cd_drive" : d.kind === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive", 16)} alt="" />
              {d.label} &nbsp;&nbsp;{d.kind === "hdd" ? "Physical drive" : d.kind === "cdrom" ? "CD-ROM" : "Removable"}
            </div>
          ))}
        </div>
      </div>
      <StatusBar cells={[`Drive ${sel[0]}: ${fs.drives[sel]?.drive?.kind === "hdd" ? "Not compressed" : "Cannot be compressed"}`]} />
    </>
  )
}

registerApp({ id: "drivespace", name: "DriveSpace", icon: "clean_drive", component: DriveSpace, width: 360, height: 220, singleton: true, exe: "DRVSPACE.EXE", startMenu: ["Programs", "Accessories", "System Tools"] })

/* ------------------------------------------------------------------ */
/*  Resource Meter                                                      */
/* ------------------------------------------------------------------ */

function ResMeter({ win }: AppProps) {
  const { windows } = useWM()
  const sysRes = Math.max(10, 96 - windows.length * 5)
  const userRes = Math.max(10, 98 - windows.length * 4)
  const gdiRes = Math.max(10, 94 - windows.length * 6)
  const bar = (label: string, v: number) => (
    <div className="col gap4">
      <span>{label}: {v}% free</span>
      <div className="progress" style={{ height: 18 }}>
        {Array.from({ length: Math.round((v / 100) * 28) }).map((_, i) => (
          <div key={i} className="blk" style={{ background: v < 30 ? "#f00" : v < 60 ? "#ff0" : "#0a0" }} />
        ))}
      </div>
    </div>
  )
  return (
    <div className="dlg" style={{ gap: 10 }}>
      {bar("System resources", sysRes)}
      {bar("User resources", userRes)}
      {bar("GDI resources", gdiRes)}
      <div className="dlg-buttons center">
        <Button isDefault onClick={() => wm.close(win.id)}>OK</Button>
      </div>
    </div>
  )
}

registerApp({ id: "resmeter", name: "Resource Meter", icon: "bar_graph", component: ResMeter, width: 320, height: 200, resizable: false, maximizable: false, singleton: true, exe: "RSRCMTR.EXE", startMenu: ["Programs", "Accessories", "System Tools"] })

/* ------------------------------------------------------------------ */
/*  System Monitor                                                      */
/* ------------------------------------------------------------------ */

const SYSMON_ITEMS: { name: string; color: string; max: number; gen: (t: number, w: number) => number }[] = [
  { name: "Kernel: Processor Usage (%)", color: "#00ff00", max: 100, gen: (t, w) => Math.min(100, 8 + w * 6 + Math.abs(Math.sin(t / 3)) * 30 + Math.random() * 10) },
  { name: "Memory Manager: Allocated memory", color: "#ffff00", max: 32 * 1024 * 1024, gen: (t, w) => 9_000_000 + w * 1_200_000 + Math.sin(t / 10) * 800_000 },
  { name: "File System: Reads/second", color: "#ff00ff", max: 200, gen: () => Math.random() * 60 },
]

function SysMon({ win }: AppProps) {
  const { windows } = useWM()
  const [chart, setChart] = useState<"line" | "bar" | "num">("line")
  const [data, setData] = useState<number[][]>(() => SYSMON_ITEMS.map(() => []))
  const t = useRef(0)
  const wc = useRef(windows.length)
  wc.current = windows.length
  useEffect(() => {
    const iv = setInterval(() => {
      t.current++
      setData((d) => d.map((series, i) => [...series.slice(-99), SYSMON_ITEMS[i].gen(t.current, wc.current)]))
    }, 1000)
    return () => clearInterval(iv)
  }, [])
  const menus = [
    { label: "&File", items: [{ label: "&Start Logging...", disabled: true }, { label: "S&top Logging", disabled: true }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Add Item...", onClick: () => wm.msgBox({ parentId: win.id, title: "Add Item", text: "Categories:\n  File System\n  Kernel\n  Memory Manager\n  Microsoft Network Client\n\nAll available items are already shown.", icon: "none" }) }, { label: "&Remove Item...", disabled: true }, { label: "&Edit Item...", disabled: true }] },
    { label: "&View", items: [{ label: "&Toolbar", checked: true }, { label: "&Status Bar", checked: true }, { label: "&Always on Top" }, { sep: true }, { label: "&Line Charts", radio: true, checked: chart === "line", onClick: () => setChart("line") }, { label: "&Bar Charts", radio: true, checked: chart === "bar", onClick: () => setChart("bar") }, { label: "&Numeric Charts", radio: true, checked: chart === "num", onClick: () => setChart("num") }] },
    { label: "&Options", items: [{ label: "&Chart...", disabled: true }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "systools" }) }, { sep: true }, { label: "&About System Monitor", onClick: () => wm.msgBox({ parentId: win.id, title: "About System Monitor", text: "Microsoft System Monitor\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]
  const fmt = (v: number, i: number) => (i === 1 ? `${(v / 1024 / 1024).toFixed(1)}M` : Math.round(v).toString())
  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ flex: 1, padding: 4, gap: 4 }}>
        {SYSMON_ITEMS.map((it, i) => {
          const series = data[i]
          const last = series[series.length - 1] ?? 0
          return (
            <div key={it.name} className="col" style={{ flex: 1, minHeight: 0 }}>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 10 }}>
                <span>{it.name}</span>
                <span>Last value: {fmt(last, i)}  Peak value: {fmt(Math.max(0, ...series), i)}</span>
              </div>
              <div className="sys-mon" style={{ position: "relative" }}>
                {chart === "num" ? (
                  <div style={{ color: it.color, fontFamily: "var(--font-dos)", fontSize: 28, padding: 8 }}>{fmt(last, i)}</div>
                ) : (
                  <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ display: "block" }}>
                    {[10, 20, 30].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#004000" strokeWidth="0.3" />)}
                    {chart === "line" ? (
                      <polyline fill="none" stroke={it.color} strokeWidth="0.8" points={series.map((v, k) => `${k},${40 - (v / it.max) * 40}`).join(" ")} />
                    ) : (
                      <rect x="0" y={40 - (last / it.max) * 40} width="100" height={(last / it.max) * 40} fill={it.color} />
                    )}
                  </svg>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <StatusBar cells={["For Help, press F1", `${windows.length} window(s) open`]} />
    </>
  )
}

registerApp({ id: "sysmon", name: "System Monitor", icon: "computer_taskmgr", component: SysMon, width: 460, height: 380, singleton: true, exe: "SYSMON.EXE", startMenu: ["Programs", "Accessories", "System Tools"] })

/* ------------------------------------------------------------------ */
/*  Registry Editor                                                     */
/* ------------------------------------------------------------------ */

type RegNode = { name: string; values?: [string, string][]; children?: RegNode[] }

function buildRegistry(): RegNode[] {
  return [
    { name: "HKEY_CLASSES_ROOT", children: [{ name: ".txt", values: [["(Default)", "txtfile"]] }, { name: ".bmp", values: [["(Default)", "Paint.Picture"]] }, { name: "txtfile", children: [{ name: "shell", children: [{ name: "open", children: [{ name: "command", values: [["(Default)", "C:\\WINDOWS\\NOTEPAD.EXE %1"]] }] }] }] }] },
    { name: "HKEY_CURRENT_USER", children: [{ name: "Control Panel", children: [{ name: "Desktop", values: [["Wallpaper", "(None)"], ["TileWallpaper", "1"], ["ScreenSaveTimeOut", "300"]] }, { name: "Colors", values: [["Background", "0 128 128"], ["ActiveTitle", "0 0 128"]] }] }, { name: "Software", children: [{ name: "Microsoft", children: [{ name: "Windows", children: [{ name: "CurrentVersion", children: [{ name: "Explorer", children: [{ name: "RecentDocs" }, { name: "RunMRU" }] }] }] }] }] }] },
    {
      name: "HKEY_LOCAL_MACHINE",
      children: [
        { name: "Config", children: [{ name: "0001" }] },
        { name: "Enum", children: [{ name: "BIOS" }, { name: "ESDI" }, { name: "FLOP" }, { name: "ISAPNP" }, { name: "Root" }] },
        { name: "Network", children: [{ name: "Logon", values: [["username", profile.firstName]] }] },
        {
          name: "SOFTWARE",
          children: [
            { name: profile.company ?? "Software", children: software.map((s) => ({ name: s.name, values: [["Version", s.version ?? "1.0"], ["InstallDir", `C:\\Program Files\\${profile.company ?? "Software"}\\${s.name}`], ["Website", s.website ?? ""]] as [string, string][] })) },
            { name: "Classes" },
            {
              name: "Microsoft",
              children: [
                { name: "Windows", children: [{ name: "CurrentVersion", values: [["ProductName", "Microsoft Windows 95"], ["Version", "Windows 95"], ["VersionNumber", "4.00.950 B"], ["RegisteredOwner", profile.name], ["RegisteredOrganization", profile.company ?? ""], ["ProductId", "24264-425-4890421-07155"], ["SystemRoot", "C:\\WINDOWS"], ["ProgramFilesDir", "C:\\Program Files"]], children: [{ name: "Run", values: [["SystemTray", "SysTray.Exe"]] }, { name: "RunOnce" }, { name: "Uninstall", children: software.map((s) => ({ name: s.name, values: [["DisplayName", s.name], ["UninstallString", "n/a"]] as [string, string][] })) }] }] },
                { name: "Internet Explorer", values: [["Version", "4.70.1155"]] },
              ],
            },
          ],
        },
        { name: "System", children: [{ name: "CurrentControlSet", children: [{ name: "Services" }, { name: "control", values: [["Current User", profile.firstName]] }] }] },
      ],
    },
    { name: "HKEY_USERS", children: [{ name: ".Default" }] },
    { name: "HKEY_CURRENT_CONFIG", children: [{ name: "Display", children: [{ name: "Settings", values: [["Resolution", "800,600"], ["BitsPerPixel", "8"], ["DPILogicalX", "96"]] }] }] },
    { name: "HKEY_DYN_DATA", children: [{ name: "Config Manager" }, { name: "PerfStats" }] },
  ]
}

function Regedit({ win }: AppProps) {
  const [tree] = useState(buildRegistry)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["HKEY_LOCAL_MACHINE", "HKEY_LOCAL_MACHINE\\SOFTWARE"]))
  const [selPath, setSelPath] = useState("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion")
  const [edits, setEdits] = useState<Record<string, string>>({})

  const find = (path: string): RegNode | null => {
    const parts = path.split("\\")
    let list = tree
    let node: RegNode | null = null
    for (const p of parts) {
      node = list.find((n) => n.name === p) ?? null
      if (!node) return null
      list = node.children ?? []
    }
    return node
  }
  useEffect(() => {
    // expand path to selection
    const parts = selPath.split("\\")
    const acc: string[] = []
    const n = new Set(expanded)
    for (const p of parts) {
      acc.push(p)
      n.add(acc.join("\\"))
    }
    setExpanded(n)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows: React.ReactNode[] = []
  const render = (node: RegNode, path: string, depth: number) => {
    const open = expanded.has(path)
    const kids = node.children ?? []
    rows.push(
      <div key={path} className={`tree-node ${selPath === path ? "sel" : ""}`} style={{ paddingLeft: depth * 16 + 2 }}>
        <span className={`tw ${kids.length ? (open ? "open" : "closed") : "leaf"}`} onClick={() => setExpanded((e) => { const n = new Set(e); if (n.has(path)) n.delete(path); else n.add(path); return n })} />
        <img src={iconUrl(open ? "directory_open_cool" : "directory_closed", 16)} alt="" />
        <span className="tn-label" onClick={() => setSelPath(path)} onDoubleClick={() => setExpanded((e) => { const n = new Set(e); if (n.has(path)) n.delete(path); else n.add(path); return n })}>{node.name}</span>
      </div>,
    )
    if (open) for (const k of kids) render(k, path + "\\" + k.name, depth + 1)
  }
  tree.forEach((n) => render(n, n.name, 0))
  const sel = find(selPath)
  const values: [string, string][] = [["(Default)", "(value not set)"], ...(sel?.values ?? []).filter(([k]) => k !== "(Default)")]
  if (sel?.values?.some(([k]) => k === "(Default)")) values[0] = sel.values.find(([k]) => k === "(Default)")!

  const edit = async (k: string, v: string) => {
    const r = await wm.prompt({ parentId: win.id, title: "Edit String", label: `Value name:\n${k}\n\nValue data:`, value: edits[selPath + "|" + k] ?? v })
    if (r !== null) setEdits({ ...edits, [selPath + "|" + k]: r })
  }

  const menus = [
    { label: "&Registry", items: [{ label: "&Import Registry File...", disabled: true }, { label: "&Export Registry File...", onClick: () => fs.writeFile("C:\\My Documents\\Export.reg", `REGEDIT4\n\n[${selPath}]\n${values.map(([k, v]) => `"${k}"="${edits[selPath + "|" + k] ?? v}"`).join("\n")}\n`) }, { sep: true }, { label: "&Connect Network Registry...", disabled: true }, { label: "&Disconnect Network Registry...", disabled: true }, { sep: true }, { label: "&Print...", disabled: true }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Modify", disabled: true }, { sep: true }, { label: "&New", items: [{ label: "&Key", disabled: true }, { label: "&String Value", disabled: true }, { label: "&Binary Value", disabled: true }, { label: "&DWORD Value", disabled: true }] }, { sep: true }, { label: "&Delete", accel: "Del", disabled: true }, { label: "&Rename", disabled: true }, { sep: true }, { label: "&Copy Key Name", onClick: () => navigator.clipboard?.writeText(selPath).catch(() => {}) }, { sep: true }, { label: "&Find...", accel: "Ctrl+F", onClick: async () => { const q = await wm.prompt({ parentId: win.id, title: "Find", label: "Find what:" }); if (q) wm.msgBox({ parentId: win.id, title: "Registry Editor", text: `Finished searching through the registry for "${q}".`, icon: "info" }) } }] },
    { label: "&View", items: [{ label: "&Status Bar", checked: true }, { sep: true }, { label: "Sp&lit" }, { sep: true }, { label: "&Refresh", accel: "F5" }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help") }, { sep: true }, { label: "&About Registry Editor", onClick: () => wm.msgBox({ parentId: win.id, title: "About Registry Editor", text: "Microsoft Registry Editor\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="explorer-body" style={{ padding: "2px 0 0" }}>
        <div className="explorer-tree w95-scroll" style={{ width: 240, flexBasis: 240 }}>
          <div className="tree-node"><span className="tw open" /><img src={iconUrl("computer", 16)} alt="" /><span className="tn-label">My Computer</span></div>
          <div style={{ paddingLeft: 16 }}>{rows}</div>
        </div>
        <div className="explorer-list details w95-scroll">
          <table className="details-table">
            <thead><tr><th>Name</th><th>Data</th></tr></thead>
            <tbody>
              {values.map(([k, v]) => (
                <tr key={k} onDoubleClick={() => edit(k, v)}>
                  <td><img src={iconUrl("file_lines", 16)} alt="" />{k}</td>
                  <td>&quot;{edits[selPath + "|" + k] ?? v}&quot;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <StatusBar cells={[`My Computer\\${selPath}`]} />
    </>
  )
}

registerApp({ id: "regedit", name: "Registry Editor", icon: "regedit", component: Regedit, width: 620, height: 420, minW: 400, minH: 250, singleton: true, exe: "REGEDIT.EXE" })

/* ------------------------------------------------------------------ */
/*  Task Manager (TASKMAN.EXE)                                          */
/* ------------------------------------------------------------------ */

function TaskMan({ win }: AppProps) {
  const { windows } = useWM()
  const [sel, setSel] = useState<string | null>(null)
  const tasks = windows.filter((w) => w.taskbar && w.id !== win.id)
  return (
    <div className="dlg" style={{ gap: 6 }}>
      <div className="listbox w95-scroll" style={{ flex: 1, minHeight: 120 }}>
        {tasks.map((w) => (
          <div key={w.id} className={`li ${sel === w.id ? "sel" : ""}`} onClick={() => setSel(w.id)} onDoubleClick={() => { wm.focus(w.id); wm.close(win.id) }}>
            <img src={iconUrl(w.icon, 16)} alt="" />
            {w.title}
          </div>
        ))}
        {!tasks.length && <div className="gray" style={{ padding: 6 }}>No tasks are running.</div>}
      </div>
      <div className="dlg-buttons center" style={{ flexWrap: "wrap" }}>
        <Button isDefault disabled={!sel} onClick={() => sel && (wm.focus(sel), wm.close(win.id))}>&Switch To</Button>
        <Button disabled={!sel} onClick={() => sel && wm.requestClose(sel)}>&End Task</Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
      </div>
      <div className="dlg-buttons center">
        <Button onClick={() => wm.cascade()}>&Cascade</Button>
        <Button onClick={() => wm.tile("h")}>&Tile</Button>
        <Button onClick={() => launch("run")}>&Run...</Button>
      </div>
    </div>
  )
}

registerApp({ id: "taskman", name: "Task List", icon: "computer_taskmgr", component: TaskMan, width: 300, height: 260, resizable: false, maximizable: false, singleton: true, exe: "TASKMAN.EXE" })

/* ------------------------------------------------------------------ */
/*  Imaging (Kodak)                                                     */
/* ------------------------------------------------------------------ */

function Imaging({ win }: AppProps) {
  const [path, setPath] = useState<string | null>((win.props.path as string) ?? null)
  const [zoom, setZoom] = useState(100)
  const content = path ? fs.readFile(path) : null
  const open = async () => {
    const { fileDialog } = await import("@/components/win95/FileDialog")
    const t = await fileDialog({ parentId: win.id, mode: "open", filters: [{ label: "Image files (*.bmp;*.png;*.gif;*.jpg)", exts: ["BMP", "PNG", "GIF", "JPG"] }], initialDir: "C:\\My Documents" })
    if (t) setPath(fs.realPath(t))
  }
  const menus = [
    { label: "&File", items: [{ label: "&New", onClick: () => setPath(null) }, { label: "&Open...", onClick: open }, { sep: true }, { label: "&Print...", onClick: () => window.print() }, { label: "&Scan New...", onClick: () => { sounds.shutter(); wm.msgBox({ parentId: win.id, title: "Imaging", text: "No scanner is installed. Use Add New Hardware in Control Panel to install one.", icon: "warning" }) } }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Zoom", items: [25, 50, 100, 200, 400].map((z) => ({ label: `${z}%`, radio: true, checked: zoom === z, onClick: () => setZoom(z) })) },
    { label: "&Help", items: [{ label: "&About Imaging", onClick: () => wm.msgBox({ parentId: win.id, title: "About Imaging", text: "Imaging for Windows\nKodak\n\nCopyright © 1996 Eastman Kodak Company.", icon: "none" }) }] },
  ]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="paint-canvas w95-scroll" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {content?.startsWith("data:image") ? <img src={content} alt="" style={{ transform: `scale(${zoom / 100})`, imageRendering: "pixelated", background: "#fff" }} /> : <div className="gray" style={{ color: "#fff" }}>{path ? "This file has no image data." : "Open an image file (File > Open)."}</div>}
      </div>
      <StatusBar cells={[path ?? "No document", `${zoom}%`]} />
    </>
  )
}

registerApp({ id: "imaging", name: "Imaging", icon: "kodak_imaging", component: Imaging, width: 500, height: 400, exe: "IMAGING.EXE", startMenu: ["Programs", "Accessories"], title: (p) => (p.path ? `${fs.basename(String(p.path))} - Imaging` : "Imaging") })

/* ------------------------------------------------------------------ */
/*  Misc stubs: Object Packager, Themes, Pinball                        */
/* ------------------------------------------------------------------ */

registerApp({
  id: "packager",
  name: "Object Packager",
  icon: "package",
  component: ({ win }: AppProps) => (
    <>
      <MenuBar menus={[{ label: "&File", items: [{ label: "E&xit", onClick: () => wm.close(win.id) }] }, { label: "&Edit", items: [{ label: "&Label...", disabled: true }, { label: "&Command Line...", disabled: true }] }, { label: "&Help", items: [{ label: "&About Object Packager", onClick: () => wm.msgBox({ parentId: win.id, title: "About Object Packager", text: "Microsoft Object Packager\nWindows 95", icon: "none" }) }] }]} />
      <div className="row" style={{ flex: 1, gap: 4, padding: 4 }}>
        <div className="col" style={{ flex: 1 }}><div>Appearance</div><div className="doc-view" style={{ flex: 1 }} /></div>
        <div className="col" style={{ flex: 1 }}><div>Content</div><div className="doc-view" style={{ flex: 1 }} /></div>
      </div>
    </>
  ),
  width: 400,
  height: 260,
  exe: "PACKAGER.EXE",
})

registerApp({
  id: "themes",
  name: "Desktop Themes",
  icon: "themes",
  component: ({ win }: AppProps) => {
    const done = useRef(false)
    useEffect(() => {
      if (done.current) return
      done.current = true
      wm.close(win.id)
      launch("display", { tab: 2 })
    }, [win.id])
    return null
  },
  width: 100,
  height: 100,
  noTaskbar: true,
  exe: "THEMES.EXE",
})

registerApp({
  id: "pinball",
  name: "3D Pinball",
  icon: "joystick",
  component: ({ win }: AppProps) => (
    <div className="msgbox" style={{ flex: 1 }}>
      <Icon name="msg_warning" />
      <div className="msg-text">
        3D Pinball for Windows - Space Cadet requires the Microsoft Plus! CD-ROM.
        {"\n\n"}Insert the Plus! disc in drive D: and run Setup.
        {"\n\n"}
        <Button onClick={() => wm.close(win.id)}>OK</Button>
      </div>
    </div>
  ),
  width: 360,
  height: 160,
  resizable: false,
  exe: "PINBALL.EXE",
})

export { TextInput }
export type { IconName }
