"use client"

import React, { useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { settings, useSettings } from "@/lib/win95/settings"
import { system } from "@/lib/win95/system"
import { sounds } from "@/lib/win95/sounds"
import { fs, fileTypeName, formatSize, formatDate, type FSNode } from "@/lib/win95/fs"
import { run, iconFor, openPath } from "@/lib/win95/shell"
import { profile, software } from "@/lib/win95/portfolio"
import { Button, Checkbox, Icon, Radio, Tabs, TextInput, GroupBox, Select } from "@/components/win95/controls"
import { Win95Flag } from "@/components/win95/Boot"
import type { IconName } from "@/lib/win95/icons"

/* ------------------------------------------------------------------ */
/*  Message box                                                         */
/* ------------------------------------------------------------------ */

const MSG_ICON: Record<string, IconName> = {
  error: "msg_error",
  warning: "msg_warning",
  question: "msg_question",
  info: "msg_information",
}

function MsgBox({ win }: AppProps) {
  const p = win.props as {
    text: string
    icon?: string
    buttons?: string[]
    defaultButton?: number
    resolve: (v: string) => void
  }
  const buttons = p.buttons ?? ["OK"]
  const firstRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    firstRef.current?.focus()
    if (p.icon === "error" || p.icon === "warning" || p.icon === "question") sounds.chord()
    else if (p.icon === "info") sounds.ding()
  }, [p.icon])
  const done = (v: string) => {
    p.resolve(v)
    wm.close(win.id)
  }
  return (
    <div className="col" style={{ flex: 1 }}>
      <div className="msgbox">
        {p.icon && p.icon !== "none" && <Icon name={MSG_ICON[p.icon] ?? "msg_information"} />}
        <div className="msg-text">{p.text}</div>
      </div>
      <div className="dlg-buttons center" style={{ padding: "0 12px 12px" }}>
        {buttons.map((b, i) => (
          <Button
            key={b}
            ref={i === (p.defaultButton ?? 0) ? firstRef : undefined}
            isDefault={i === (p.defaultButton ?? 0)}
            onClick={() => done(b)}
            onKeyDown={(e) => {
              if (e.key === "Escape") done(buttons[buttons.length - 1])
            }}
          >
            {b}
          </Button>
        ))}
      </div>
    </div>
  )
}

registerApp({
  id: "msgbox",
  name: "Message",
  icon: "msg_information",
  component: MsgBox,
  width: 360,
  height: 120,
  resizable: false,
  minimizable: false,
  maximizable: false,
  noTaskbar: true,
})

/* ------------------------------------------------------------------ */
/*  Prompt box                                                          */
/* ------------------------------------------------------------------ */

function PromptBox({ win }: AppProps) {
  const p = win.props as { label: string; value?: string; icon?: IconName; okLabel?: string; resolve: (v: string | null) => void }
  const [v, setV] = useState(p.value ?? "")
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const done = (val: string | null) => {
    p.resolve(val)
    wm.close(win.id)
  }
  return (
    <div className="dlg">
      <div className="dlg-row" style={{ alignItems: "flex-start" }}>
        {p.icon && <Icon name={p.icon} />}
        <div className="col gap4" style={{ flex: 1 }}>
          <span style={{ whiteSpace: "pre-wrap" }}>{p.label}</span>
          <TextInput
            ref={ref}
            value={v}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") done(v)
              if (e.key === "Escape") done(null)
            }}
            style={{ width: "100%" }}
          />
        </div>
      </div>
      <div className="dlg-buttons">
        <Button isDefault onClick={() => done(v)}>
          {p.okLabel ?? "OK"}
        </Button>
        <Button onClick={() => done(null)}>Cancel</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "promptbox",
  name: "Input",
  icon: "msg_question",
  component: PromptBox,
  width: 380,
  height: 130,
  resizable: false,
  minimizable: false,
  maximizable: false,
  noTaskbar: true,
})

/* ------------------------------------------------------------------ */
/*  Open With                                                           */
/* ------------------------------------------------------------------ */

const OPEN_WITH: { id: string; label: string; icon: IconName }[] = [
  { id: "notepad", label: "NOTEPAD", icon: "notepad" },
  { id: "wordpad", label: "WORDPAD", icon: "write_wordpad" },
  { id: "paint", label: "MSPAINT", icon: "paint_file" },
  { id: "mediaplayer", label: "MPLAYER", icon: "media_player" },
  { id: "iexplore", label: "IEXPLORE", icon: "msie1" },
]

function OpenWith({ win }: AppProps) {
  const { path, name } = win.props as { path: string; name: string }
  const [sel, setSel] = useState(0)
  const [desc, setDesc] = useState("")
  return (
    <div className="dlg">
      <div>Click the program you want to use to open the file &apos;{name}&apos;.</div>
      <div>
        <div style={{ marginBottom: 2 }}>
          <u>D</u>escription of &apos;.{name.split(".").pop()?.toUpperCase()}&apos; files:
        </div>
        <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: "100%" }} />
      </div>
      <div>
        <div style={{ marginBottom: 2 }}>
          Choose the program you want to use:
        </div>
        <div className="listbox" style={{ height: 120 }}>
          {OPEN_WITH.map((o, i) => (
            <div
              key={o.id}
              className={`li ${sel === i ? "sel" : ""}`}
              onClick={() => setSel(i)}
              onDoubleClick={() => {
                launch(o.id, { path, forceOpen: true })
                wm.close(win.id)
              }}
            >
              <Icon name={o.icon} size={16} /> {o.label}
            </div>
          ))}
        </div>
      </div>
      <Checkbox label="&Always use this program to open this file" checked={false} onChange={() => {}} />
      <div className="dlg-buttons">
        <Button
          isDefault
          onClick={() => {
            launch(OPEN_WITH[sel].id, { path, forceOpen: true })
            wm.close(win.id)
          }}
        >
          OK
        </Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        <Button disabled>Other...</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "openwith",
  name: "Open With",
  icon: "file_windows",
  component: OpenWith,
  width: 340,
  height: 300,
  resizable: false,
  minimizable: false,
  maximizable: false,
  noTaskbar: true,
})

/* ------------------------------------------------------------------ */
/*  Run                                                                 */
/* ------------------------------------------------------------------ */

let runHistory: string[] = []

function RunDialog({ win }: AppProps) {
  const [v, setV] = useState(runHistory[0] ?? "")
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const go = () => {
    const cmd = v.trim()
    if (!cmd) return
    runHistory = [cmd, ...runHistory.filter((h) => h !== cmd)].slice(0, 10)
    if (run(cmd, "C:\\WINDOWS", win.id)) wm.close(win.id)
    else {
      wm.msgBox({
        parentId: win.id,
        title: cmd,
        text: `Cannot find the file '${cmd}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.`,
        icon: "error",
      })
    }
  }
  return (
    <div className="dlg" style={{ gap: 10 }}>
      <div className="dlg-row" style={{ alignItems: "flex-start", gap: 12 }}>
        <Icon name="application_hourglass" />
        <div>Type the name of a program, folder, or document, and Windows will open it for you.</div>
      </div>
      <div className="dlg-row">
        <span style={{ width: 40 }}>
          <u>O</u>pen:
        </span>
        <input
          ref={ref}
          list="run-history"
          className="field"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go()
            if (e.key === "Escape") wm.close(win.id)
          }}
          style={{ flex: 1 }}
        />
        <datalist id="run-history">
          {runHistory.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
      </div>
      <Checkbox label="Run in &Separate Memory Space" checked={false} disabled onChange={() => {}} />
      <div className="dlg-buttons">
        <Button isDefault onClick={go}>
          OK
        </Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        <Button
          onClick={() => {
            launch("explorer", { path: "C:\\WINDOWS", browse: true })
          }}
        >
          &Browse...
        </Button>
      </div>
    </div>
  )
}

registerApp({
  id: "run",
  name: "Run",
  icon: "application_hourglass",
  component: RunDialog,
  width: 350,
  height: 160,
  resizable: false,
  maximizable: false,
  singleton: true,
})

/* ------------------------------------------------------------------ */
/*  Shut Down                                                           */
/* ------------------------------------------------------------------ */

function ShutDownDialog({ win }: AppProps) {
  const [choice, setChoice] = useState<"shutdown" | "restart" | "dos" | "logoff">("shutdown")
  const go = () => {
    wm.close(win.id)
    if (choice === "shutdown") system.shutdown()
    else if (choice === "restart") system.restart()
    else if (choice === "dos") system.dosMode()
    else system.restart()
  }
  return (
    <div className="dlg" style={{ gap: 12 }}>
      <div className="dlg-row" style={{ alignItems: "flex-start", gap: 14 }}>
        <Icon name="shut_down_with_computer" />
        <div className="col gap8" style={{ flex: 1 }}>
          <div>Are you sure you want to:</div>
          <div className="col" style={{ gap: 6 }}>
            <Radio name="sd" label="&Shut down the computer?" checked={choice === "shutdown"} onChange={() => setChoice("shutdown")} />
            <Radio name="sd" label="&Restart the computer?" checked={choice === "restart"} onChange={() => setChoice("restart")} />
            <Radio name="sd" label="Restart the computer in &MS-DOS mode?" checked={choice === "dos"} onChange={() => setChoice("dos")} />
            <Radio name="sd" label="&Close all programs and log on as a different user?" checked={choice === "logoff"} onChange={() => setChoice("logoff")} />
          </div>
        </div>
      </div>
      <div className="dlg-buttons center">
        <Button isDefault onClick={go} autoFocus>
          &Yes
        </Button>
        <Button onClick={() => wm.close(win.id)}>&No</Button>
        <Button onClick={() => launch("help", { topic: "shutdown" })}>&Help</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "shutdown",
  name: "Shut Down Windows",
  icon: "shut_down_with_computer",
  component: ShutDownDialog,
  width: 380,
  height: 190,
  resizable: false,
  minimizable: false,
  maximizable: false,
  singleton: true,
})

/* ------------------------------------------------------------------ */
/*  Welcome to Windows 95                                               */
/* ------------------------------------------------------------------ */

function Welcome({ win }: AppProps) {
  const s = useSettings()
  const [tip, setTip] = useState(() => Math.floor(Math.random() * profile.tips.length))
  return (
    <div className="col" style={{ flex: 1, padding: 10, gap: 8 }}>
      <div className="row" style={{ gap: 12, alignItems: "stretch", flex: 1 }}>
        <div className="col" style={{ flex: 1, gap: 8 }}>
          <div style={{ background: "#000080", color: "#fff", padding: "8px 10px", fontSize: 18, fontWeight: 700, fontFamily: "Arial, sans-serif", display: "flex", gap: 10, alignItems: "center" }}>
            <Win95Flag scale={0.35} />
            <span>
              Welcome to <i>Windows</i> 95
            </span>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "flex-start", flex: 1, padding: "4px 2px" }}>
            <Icon name="help_book_small" />
            <div style={{ flex: 1 }}>
              <b>Did you know...</b>
              <p style={{ margin: "8px 0 0", lineHeight: 1.4 }}>{profile.tips[tip]}</p>
            </div>
          </div>
        </div>
        <div className="col" style={{ gap: 6, width: 130 }}>
          <Button
            onClick={() => {
              openPath("C:\\My Documents\\README.TXT")
            }}
          >
            &Windows Tour
          </Button>
          <Button onClick={() => launch("explorer", { path: `C:\\Program Files\\${profile.company ?? "Software"}` })}>
            &What&apos;s New
          </Button>
          <Button onClick={() => launch("exchange", { compose: true })}>&Online Registration</Button>
          <Button onClick={() => launch("iexplore")}>&Product Catalog</Button>
          <Button onClick={() => setTip((t) => (t + 1) % profile.tips.length)}>&Next Tip</Button>
          <div style={{ flex: 1 }} />
          <Button isDefault onClick={() => wm.close(win.id)}>
            &Close
          </Button>
        </div>
      </div>
      <Checkbox
        label="&Show this Welcome Screen next time you start Windows"
        checked={s.showWelcome}
        onChange={(v) => settings.set({ showWelcome: v })}
      />
    </div>
  )
}

registerApp({
  id: "welcome",
  name: "Welcome",
  icon: "windows",
  component: Welcome,
  width: 480,
  height: 270,
  resizable: false,
  maximizable: false,
  singleton: true,
})

/* ------------------------------------------------------------------ */
/*  About Windows (winver)                                               */
/* ------------------------------------------------------------------ */

function AboutWindows({ win }: AppProps) {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  return (
    <div className="col" style={{ flex: 1 }}>
      <div className="about-box">
        <Win95Flag scale={0.55} />
        <div className="lines">
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "Arial, sans-serif" }}>
            Microsoft <i>Windows</i> 95
          </div>
          <div>Copyright &copy; 1981-1995 Microsoft Corp.</div>
          <div>Windows 95 — Portfolio Edition 4.00.950 B</div>
          <div className="hr" />
          <div>This product is licensed to:</div>
          <div style={{ paddingLeft: 10 }}>{profile.name}</div>
          <div style={{ paddingLeft: 10 }}>{profile.company}</div>
          <div className="hr" />
          <div>Physical Memory Available to Windows: {mem ? (mem * 1024 * 1024).toLocaleString() : "32,180"} KB</div>
          <div>System Resources: {Math.max(40, 95 - wm.getSnapshot().windows.length * 4)}% Free</div>
        </div>
      </div>
      <div className="dlg-buttons" style={{ padding: "0 12px 12px" }}>
        <Button isDefault onClick={() => wm.close(win.id)}>
          OK
        </Button>
      </div>
    </div>
  )
}

registerApp({
  id: "winver",
  name: "About Windows",
  icon: "windows",
  component: AboutWindows,
  width: 420,
  height: 250,
  resizable: false,
  minimizable: false,
  maximizable: false,
  singleton: true,
  exe: "WINVER.EXE",
})

/* ------------------------------------------------------------------ */
/*  File / folder properties                                            */
/* ------------------------------------------------------------------ */

function Properties({ win }: AppProps) {
  const { path } = win.props as { path: string }
  const node = fs.get(path) as FSNode | null
  const [tab, setTab] = useState(0)
  const [attrs, setAttrs] = useState(() => ({
    ro: !!(node && node.type === "file" && node.readonly),
    hidden: !!node?.hidden,
    archive: true,
    system: !!(node && node.type === "file" && node.system),
  }))
  if (!node) return <div className="dlg">File not found.</div>
  const size = fs.sizeOf(node)
  const isDir = node.type === "dir"
  let count = { files: 0, dirs: 0 }
  if (isDir) {
    const walk = (n: FSNode) => {
      if (n.type === "dir") Object.values(n.children).forEach((c) => (c.type === "dir" ? (count.dirs++, walk(c)) : count.files++))
    }
    walk(node)
  }
  const location = fs.parent(fs.realPath(path))
  const tabs = ["General"]
  if (node.type === "file" && (node.exe || node.url)) tabs.push("Shortcut")
  return (
    <div className="col" style={{ flex: 1, padding: 8 }}>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="tab-page col" style={{ flex: 1, gap: 8 }}>
        {tab === 0 && (
          <>
            <div className="row gap8">
              <Icon name={iconFor(node, path)} />
              <TextInput defaultValue={node.name} readOnly style={{ flex: 1 }} />
            </div>
            <div className="hr" />
            <table style={{ borderSpacing: "0 4px" }}>
              <tbody>
                <tr>
                  <td style={{ width: 90 }}>Type:</td>
                  <td>{fileTypeName(node)}</td>
                </tr>
                <tr>
                  <td>Location:</td>
                  <td>{location}</td>
                </tr>
                <tr>
                  <td>Size:</td>
                  <td>
                    {formatSize(size)} ({size.toLocaleString()} bytes)
                  </td>
                </tr>
                {isDir && (
                  <tr>
                    <td>Contains:</td>
                    <td>
                      {count.files} Files, {count.dirs} Folders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="hr" />
            <table style={{ borderSpacing: "0 4px" }}>
              <tbody>
                <tr>
                  <td style={{ width: 90 }}>MS-DOS name:</td>
                  <td>{node.name.toUpperCase().length <= 12 ? node.name.toUpperCase() : node.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) + "~1" + (node.type === "file" && node.name.includes(".") ? "." + node.name.split(".").pop()!.toUpperCase().slice(0, 3) : "")}</td>
                </tr>
                <tr>
                  <td>Created:</td>
                  <td>{formatDate(node.modified)}</td>
                </tr>
                <tr>
                  <td>Modified:</td>
                  <td>{formatDate(node.modified)}</td>
                </tr>
                <tr>
                  <td>Accessed:</td>
                  <td>{formatDate(Date.now())}</td>
                </tr>
              </tbody>
            </table>
            <div className="hr" />
            <div className="row" style={{ gap: 6 }}>
              <span style={{ width: 90 }}>Attributes:</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                <Checkbox label="&Read-only" checked={attrs.ro} onChange={(v) => setAttrs({ ...attrs, ro: v })} />
                <Checkbox label="&Hidden" checked={attrs.hidden} onChange={(v) => setAttrs({ ...attrs, hidden: v })} />
                <Checkbox label="&Archive" checked={attrs.archive} onChange={(v) => setAttrs({ ...attrs, archive: v })} />
                <Checkbox label="&System" checked={attrs.system} disabled onChange={() => {}} />
              </div>
            </div>
          </>
        )}
        {tab === 1 && node.type === "file" && (
          <>
            <div className="row gap8">
              <Icon name={iconFor(node, path)} />
              <span>{node.name}</span>
            </div>
            <div className="hr" />
            <table style={{ borderSpacing: "0 6px" }}>
              <tbody>
                <tr>
                  <td style={{ width: 90 }}>Target type:</td>
                  <td>{node.url ? "Internet Shortcut" : "Application"}</td>
                </tr>
                <tr>
                  <td>Target:</td>
                  <td>
                    <TextInput readOnly defaultValue={node.url ?? `C:\\WINDOWS\\${(node.exe ?? "").toUpperCase()}.EXE`} style={{ width: 240 }} />
                  </td>
                </tr>
                <tr>
                  <td>Start in:</td>
                  <td>
                    <TextInput readOnly defaultValue="C:\WINDOWS" style={{ width: 240 }} />
                  </td>
                </tr>
                <tr>
                  <td>Run:</td>
                  <td>
                    <Select defaultValue="Normal window" style={{ width: 240 }}>
                      <option>Normal window</option>
                      <option>Minimized</option>
                      <option>Maximized</option>
                    </Select>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}>
              <Button onClick={() => node.exe && launch(node.exe)}>&Find Target...</Button>
              <Button disabled>&Change Icon...</Button>
            </div>
          </>
        )}
      </div>
      <div className="dlg-buttons" style={{ paddingTop: 8 }}>
        <Button
          isDefault
          onClick={() => {
            if (node.type === "file") {
              node.readonly = attrs.ro
              node.hidden = attrs.hidden
            } else node.hidden = attrs.hidden
            wm.close(win.id)
          }}
        >
          OK
        </Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        <Button disabled>&Apply</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "properties",
  name: "Properties",
  icon: "file_windows",
  component: Properties,
  width: 370,
  height: 430,
  resizable: false,
  maximizable: false,
  title: (p) => `${fs.basename(String(p.path ?? ""))} Properties`,
})

/* ------------------------------------------------------------------ */
/*  Recycle Bin properties                                              */
/* ------------------------------------------------------------------ */

function RecycleProps({ win }: AppProps) {
  const [pct, setPct] = useState(10)
  const [confirm, setConfirm] = useState(true)
  return (
    <div className="col" style={{ flex: 1, padding: 8 }}>
      <Tabs tabs={["Global", "Benjamin (C:)"]} active={0} onChange={() => {}} />
      <div className="tab-page col" style={{ flex: 1, gap: 10 }}>
        <Radio label="Configure drives &independently" checked={false} onChange={() => {}} />
        <Radio label="&Use one setting for all drives:" checked onChange={() => {}} />
        <Checkbox label="&Do not move files to the Recycle Bin. Remove files immediately on delete" checked={false} onChange={() => {}} />
        <div style={{ padding: "0 10px" }}>
          <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(+e.target.value)} style={{ width: "100%" }} />
          <div className="center">{pct}%</div>
          <div className="center">Maximum size of Recycle Bin (percent of each drive)</div>
        </div>
        <Checkbox label="Display delete &confirmation dialog" checked={confirm} onChange={setConfirm} />
      </div>
      <div className="dlg-buttons" style={{ paddingTop: 8 }}>
        <Button isDefault onClick={() => wm.close(win.id)}>
          OK
        </Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        <Button disabled>&Apply</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "recycleprops",
  name: "Recycle Bin Properties",
  icon: "recycle_bin_empty",
  component: RecycleProps,
  width: 360,
  height: 330,
  resizable: false,
  maximizable: false,
  singleton: true,
})

/* ------------------------------------------------------------------ */
/*  Font viewer                                                         */
/* ------------------------------------------------------------------ */

function FontView({ win }: AppProps) {
  const { path } = win.props as { path: string }
  const name = fs.basename(path)
  const base = name.replace(/\.(ttf|fon)$/i, "")
  const family = /^ARIAL/i.test(base) ? "Arial" : /^COUR/i.test(base) ? "Courier New" : /^TIMES/i.test(base) ? "Times New Roman" : /SYMBOL/i.test(base) ? "Symbol" : /WINGDING/i.test(base) ? "Wingdings" : "var(--font)"
  const bold = /BD/i.test(base)
  const italic = /I\.TTF$/i.test(name) || /BI/i.test(base)
  const sample = "The quick brown fox jumps over the lazy dog. 1234567890"
  return (
    <div className="col" style={{ flex: 1, padding: 6, gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Button onClick={() => wm.close(win.id)}>&Done</Button>
        <Button disabled>&Print</Button>
      </div>
      <div className="doc-view w95-scroll" style={{ fontFamily: family, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal" }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>
          {base} ({/\.ttf$/i.test(name) ? "TrueType" : "Bitmap"})
        </div>
        <div style={{ fontSize: 12 }}>Typeface name: {family}</div>
        <div style={{ fontSize: 12 }}>File size: {formatSize(fs.sizeOf(fs.get(path)!))}</div>
        <div style={{ fontSize: 12 }}>Version: 2.00</div>
        <div style={{ fontSize: 12, marginBottom: 10 }}>Typeface &copy; The Monotype Corporation plc. Data &copy; The Monotype Corporation plc/Type Solutions Inc. 1990-1992. All Rights Reserved.</div>
        <hr />
        <div style={{ fontSize: 14 }}>abcdefghijklmnopqrstuvwxyz</div>
        <div style={{ fontSize: 14 }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
        <div style={{ fontSize: 14 }}>1234567890.:,;(:*!?&apos;)</div>
        <hr />
        {[12, 18, 24, 36, 48, 60, 72].map((sz) => (
          <div key={sz} style={{ fontSize: sz, whiteSpace: "nowrap", lineHeight: 1.1 }}>
            <span style={{ fontSize: 10, fontFamily: "var(--font)", marginRight: 6 }}>{sz}</span>
            {sample}
          </div>
        ))}
      </div>
    </div>
  )
}

registerApp({
  id: "fontview",
  name: "Font Viewer",
  icon: "font_tt",
  component: FontView,
  width: 520,
  height: 480,
  title: (p) => `${fs.basename(String(p.path ?? "")).replace(/\.(ttf|fon)$/i, "")} (TrueType)`,
})

/* ------------------------------------------------------------------ */
/*  Taskbar properties                                                  */
/* ------------------------------------------------------------------ */

function TaskbarProps({ win }: AppProps) {
  const s = useSettings()
  const [tab, setTab] = useState(0)
  const [local, setLocal] = useState({ autoHide: s.taskbarAutoHide, clock: s.showClock, small: false, top: true })
  const apply = () => settings.set({ taskbarAutoHide: local.autoHide, showClock: local.clock })
  return (
    <div className="col" style={{ flex: 1, padding: 8 }}>
      <Tabs tabs={["Taskbar Options", "Start Menu Programs"]} active={tab} onChange={setTab} />
      <div className="tab-page col" style={{ flex: 1, gap: 10 }}>
        {tab === 0 ? (
          <>
            <div style={{ height: 130, background: "var(--desktop)", boxShadow: "var(--sunken)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 10, top: 10, width: 120, height: 60, background: "var(--face)", boxShadow: "var(--raised)" }}>
                <div style={{ background: "var(--active-title)", height: 9, margin: 2 }} />
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 16, background: "var(--face)", boxShadow: "inset 0 1px var(--hilight)", display: "flex", alignItems: "center", padding: "0 2px", gap: 2 }}>
                <div style={{ width: 28, height: 11, boxShadow: "var(--raised)", fontSize: 7, fontWeight: 700, paddingLeft: 2 }}>Start</div>
                {local.clock && <div style={{ marginLeft: "auto", fontSize: 7, boxShadow: "var(--sunken-thin)", padding: "0 3px", height: 11 }}>12:45 PM</div>}
              </div>
            </div>
            <Checkbox label="Always on &top" checked={local.top} onChange={(v) => setLocal({ ...local, top: v })} />
            <Checkbox label="A&uto hide" checked={local.autoHide} onChange={(v) => setLocal({ ...local, autoHide: v })} />
            <Checkbox label="Show &small icons in Start menu" checked={local.small} onChange={(v) => setLocal({ ...local, small: v })} />
            <Checkbox label="Show &Clock" checked={local.clock} onChange={(v) => setLocal({ ...local, clock: v })} />
          </>
        ) : (
          <>
            <GroupBox title="Customize Start Menu">
              <div style={{ marginBottom: 8 }}>You may customize your Start Menu by adding or removing items from it.</div>
              <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}>
                <Button disabled>&Add...</Button>
                <Button disabled>&Remove...</Button>
                <Button onClick={() => launch("explorer", { path: "C:\\WINDOWS\\Start Menu", tree: true })}>Ad&vanced...</Button>
              </div>
            </GroupBox>
            <GroupBox title="Documents Menu">
              <div style={{ marginBottom: 8 }}>Click the Clear button to remove the contents of the Documents Menu.</div>
              <div className="dlg-buttons" style={{ justifyContent: "flex-end" }}>
                <Button onClick={() => settings.set({ recentDocs: [] })}>&Clear</Button>
              </div>
            </GroupBox>
          </>
        )}
      </div>
      <div className="dlg-buttons" style={{ paddingTop: 8 }}>
        <Button
          isDefault
          onClick={() => {
            apply()
            wm.close(win.id)
          }}
        >
          OK
        </Button>
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        <Button onClick={apply}>&Apply</Button>
      </div>
    </div>
  )
}

registerApp({
  id: "taskbarprops",
  name: "Taskbar Properties",
  icon: "desktop_w95",
  component: TaskbarProps,
  width: 380,
  height: 380,
  resizable: false,
  maximizable: false,
  singleton: true,
})

/* ------------------------------------------------------------------ */
/*  Program Manager (legacy)                                            */
/* ------------------------------------------------------------------ */

function Progman() {
  const groups: { name: string; items: { label: string; icon: IconName; app: string }[] }[] = [
    {
      name: "Main",
      items: [
        { label: "File Manager", icon: "directory_explorer", app: "explorer" },
        { label: "Control Panel", icon: "directory_control_panel", app: "controlpanel" },
        { label: "MS-DOS Prompt", icon: "ms_dos", app: "dos" },
        { label: "Clipboard Viewer", icon: "clipbrd" as IconName, app: "clipbrd" },
      ],
    },
    {
      name: "Accessories",
      items: [
        { label: "Notepad", icon: "notepad", app: "notepad" },
        { label: "Calculator", icon: "calculator", app: "calc" },
        { label: "Paintbrush", icon: "paint_old", app: "paint" },
        { label: "Write", icon: "write_yellow", app: "wordpad" },
        { label: "Clock", icon: "clock", app: "clock" },
        { label: "Character Map", icon: "charmap", app: "charmap" },
      ],
    },
    {
      name: "Games",
      items: [
        { label: "Solitaire", icon: "game_solitaire", app: "solitaire" },
        { label: "Minesweeper", icon: "minesweeper", app: "minesweeper" },
        { label: "FreeCell", icon: "game_freecell", app: "freecell" },
        { label: "Hearts", icon: "cardfile", app: "hearts" },
      ],
    },
    {
      name: profile.company ?? "Software",
      items: software.map((sw) => ({ label: sw.name, icon: sw.logo as IconName, app: "sw:" + sw.slug })),
    },
  ]
  return (
    <div className="col" style={{ flex: 1, background: "var(--app-workspace)", padding: 4, gap: 4, overflow: "auto" }}>
      {groups.map((g) => (
        <div key={g.name} style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 3 }}>
          <div style={{ background: "var(--active-title)", color: "var(--active-title-text)", fontWeight: 700, padding: "1px 4px", height: 18 }}>{g.name}</div>
          <div style={{ background: "var(--window)", display: "flex", flexWrap: "wrap", padding: 4 }}>
            {g.items.length === 0 && <span className="gray" style={{ padding: 8 }}>(Empty)</span>}
            {g.items.map((it) => (
              <button key={it.label} type="button" className="file-icon" onDoubleClick={() => launch(it.app)}>
                <Icon name={it.icon} style={{ marginBottom: 4, objectFit: "contain" }} />
                <span className="lbl">{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

registerApp({
  id: "progman",
  name: "Program Manager",
  icon: "program_manager",
  component: Progman,
  width: 520,
  height: 420,
  exe: "PROGMAN.EXE",
})

/* ------------------------------------------------------------------ */
/*  Simple "not available" stub used by a few legacy items              */
/* ------------------------------------------------------------------ */

export function Stub({ text, icon = "msg_information" }: { text: string; icon?: IconName }) {
  return (
    <div className="msgbox" style={{ flex: 1 }}>
      <Icon name={icon} />
      <div className="msg-text">{text}</div>
    </div>
  )
}
