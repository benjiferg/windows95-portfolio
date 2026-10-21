"use client"

import React, { useEffect, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch, useWM } from "@/lib/win95/store"
import { settings, useSettings, colorSchemes, wallpapers, patterns, patternToDataUrl, type Settings, type ScreenSaverId } from "@/lib/win95/settings"
import { sounds } from "@/lib/win95/sounds"
import { fs } from "@/lib/win95/fs"
import { profile, software } from "@/lib/win95/portfolio"
import { icon as iconUrl, type IconName } from "@/lib/win95/icons"
import { Button, Checkbox, GroupBox, Icon, Radio, Select, Slider, Tabs, TextInput } from "@/components/win95/controls"
import { ScreenSaver } from "@/components/win95/ScreenSaver"
import { CPL_APPLETS } from "./Explorer"

/* ------------------------------------------------------------------ */
/*  Shared property-sheet frame                                         */
/* ------------------------------------------------------------------ */

function Sheet({ tabs, children, onOk, onApply, onCancel, applyEnabled, width }: { tabs: string[]; children: (tab: number) => React.ReactNode; onOk: () => void; onApply?: () => void; onCancel: () => void; applyEnabled?: boolean; width?: number }) {
  const [tab, setTab] = useState(0)
  return (
    <div className="col" style={{ flex: 1, padding: 8, width }}>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="tab-page col w95-scroll" style={{ flex: 1, gap: 10, overflow: "auto" }}>
        {children(tab)}
      </div>
      <div className="dlg-buttons" style={{ paddingTop: 8 }}>
        <Button isDefault onClick={onOk}>OK</Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Button disabled={!applyEnabled} onClick={onApply}>&Apply</Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Display Properties                                                  */
/* ------------------------------------------------------------------ */

function Monitor({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
      <div style={{ width: 184, height: 150, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 184, height: 136, background: "var(--face)", boxShadow: "var(--raised)", borderRadius: 4, padding: 8 }}>
          <div style={{ width: "100%", height: "100%", background: "var(--desktop)", boxShadow: "var(--sunken)", overflow: "hidden", position: "relative", ...style }}>{children}</div>
        </div>
        <div style={{ position: "absolute", left: 60, top: 136, width: 64, height: 8, background: "var(--face)", boxShadow: "var(--raised)" }} />
        <div style={{ position: "absolute", left: 40, top: 144, width: 104, height: 6, background: "var(--face)", boxShadow: "var(--raised)" }} />
      </div>
    </div>
  )
}

export function DisplayProps({ win }: AppProps) {
  const s = useSettings()
  const [draft, setDraft] = useState<Settings>(s)
  const [preview, setPreview] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(s)
  const apply = () => settings.set(draft)
  const wp = draft.wallpaper ? (draft.customWallpapers[draft.wallpaper] ?? wallpapers[draft.wallpaper] ?? draft.wallpaper) : null
  const pat = draft.pattern && patterns[draft.pattern] ? patternToDataUrl(patterns[draft.pattern]) : null
  const scheme = colorSchemes[draft.colorScheme] ?? colorSchemes["Windows Standard"]
  const initialTab = Number(win.props.tab ?? 0)
  const wallpaperNames = ["(None)", ...Object.keys(wallpapers), ...Object.keys(draft.customWallpapers)]

  return (
    <>
      <Sheet
        tabs={["Background", "Screen Saver", "Appearance", "Settings"]}
        onOk={() => {
          apply()
          wm.close(win.id)
        }}
        onApply={apply}
        onCancel={() => wm.close(win.id)}
        applyEnabled={dirty}
      >
        {(tabRaw) => {
          const tab = tabRaw === 0 && initialTab && !preview ? tabRaw : tabRaw
          if (tab === 0)
            return (
              <>
                <Monitor
                  style={{
                    backgroundColor: scheme.desktop,
                    backgroundImage: wp ? `url("${wp}")` : pat ? `url("${pat}")` : undefined,
                    backgroundRepeat: wp && draft.wallpaperMode !== "tile" ? "no-repeat" : "repeat",
                    backgroundPosition: "center",
                    backgroundSize: wp && draft.wallpaperMode === "stretch" ? "100% 100%" : wp && draft.wallpaperMode === "center" ? "40%" : wp ? "25%" : "4px 4px",
                  }}
                />
                <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                  <div className="col" style={{ flex: 1 }}>
                    <div><u>P</u>attern</div>
                    <div className="listbox w95-scroll" style={{ height: 110 }}>
                      {["(None)", ...Object.keys(patterns)].map((p) => (
                        <div key={p} className={`li ${(draft.pattern ?? "(None)") === p ? "sel" : ""}`} onClick={() => setDraft({ ...draft, pattern: p === "(None)" ? null : p })}>{p}</div>
                      ))}
                    </div>
                    <Button className="sm" style={{ marginTop: 4, alignSelf: "flex-start" }} disabled={!draft.pattern}>&Edit Pattern...</Button>
                  </div>
                  <div className="col" style={{ flex: 1 }}>
                    <div><u>W</u>allpaper</div>
                    <div className="listbox w95-scroll" style={{ height: 110 }}>
                      {wallpaperNames.map((w) => (
                        <div key={w} className={`li ${(draft.wallpaper ?? "(None)") === w ? "sel" : ""}`} onClick={() => setDraft({ ...draft, wallpaper: w === "(None)" ? null : w })}>{w}</div>
                      ))}
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 4, justifyContent: "space-between" }}>
                      <Button className="sm" onClick={async () => {
                        const u = await wm.prompt({ parentId: win.id, title: "Browse", label: "Image URL or path (e.g. https://... or a .bmp from Paint):" })
                        if (u) {
                          const name = u.split("/").pop()?.split(".")[0] || "Custom"
                          setDraft({ ...draft, customWallpapers: { ...draft.customWallpapers, [name]: u }, wallpaper: name })
                        }
                      }}>&Browse...</Button>
                      <div className="row gap4" style={{ fontSize: 10 }}>
                        <Radio name="disp" label="&Tile" checked={draft.wallpaperMode === "tile"} onChange={() => setDraft({ ...draft, wallpaperMode: "tile" })} />
                        <Radio name="disp" label="&Center" checked={draft.wallpaperMode === "center"} onChange={() => setDraft({ ...draft, wallpaperMode: "center" })} />
                        <Radio name="disp" label="&Stretch" checked={draft.wallpaperMode === "stretch"} onChange={() => setDraft({ ...draft, wallpaperMode: "stretch" })} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )
          if (tab === 1)
            return (
              <>
                <Monitor style={{ background: "#000" }}>{draft.screenSaver !== "none" && <ScreenSaver mode={draft.screenSaver} text={draft.marqueeText} preview />}</Monitor>
                <GroupBox title="Screen Saver">
                  <div className="row gap8">
                    <Select value={draft.screenSaver} onChange={(e) => setDraft({ ...draft, screenSaver: e.target.value as ScreenSaverId })} style={{ flex: 1 }}>
                      <option value="none">(None)</option>
                      <option value="blank">Blank Screen</option>
                      <option value="flyingwindows">Flying Windows</option>
                      <option value="starfield">Flying Through Space</option>
                      <option value="mystify">Mystify Your Mind</option>
                      <option value="marquee">Scrolling Marquee</option>
                    </Select>
                    <Button className="sm" disabled={draft.screenSaver !== "marquee"} onClick={async () => {
                      const t = await wm.prompt({ parentId: win.id, title: "Options for Scrolling Marquee", label: "Text:", value: draft.marqueeText })
                      if (t !== null) setDraft({ ...draft, marqueeText: t })
                    }}>Se&ttings...</Button>
                    <Button className="sm" disabled={draft.screenSaver === "none"} onClick={() => setPreview(true)}>Pre&view</Button>
                  </div>
                  <div className="row gap8" style={{ marginTop: 8 }}>
                    <span><u>W</u>ait:</span>
                    <TextInput type="number" min={1} max={60} value={draft.screenSaverWait} onChange={(e) => setDraft({ ...draft, screenSaverWait: Math.max(1, Math.min(60, +e.target.value || 1)) })} style={{ width: 50 }} />
                    <span>minutes</span>
                    <Checkbox label="&Password protected" checked={false} onChange={() => {}} />
                    <Button className="sm" disabled>Change...</Button>
                  </div>
                </GroupBox>
                <GroupBox title="Energy saving features of monitor">
                  <div className="row gap8" style={{ alignItems: "flex-start" }}>
                    <Icon name="standby_monitor_moon" />
                    <div className="col gap4">
                      <Checkbox label="&Low-power standby" checked={false} onChange={() => {}} />
                      <Checkbox label="Shut &off monitor" checked={false} onChange={() => {}} />
                    </div>
                  </div>
                </GroupBox>
              </>
            )
          if (tab === 2)
            return (
              <>
                <div style={{ height: 150, background: scheme.desktop, boxShadow: "var(--sunken)", position: "relative", overflow: "hidden", fontSize: 11 }}>
                  <div style={{ position: "absolute", left: 10, top: 8, width: 190, height: 70, background: scheme.face, boxShadow: `inset -1px -1px ${scheme.dkshadow}, inset 1px 1px ${scheme.hilight}, inset -2px -2px ${scheme.shadow}, inset 2px 2px ${scheme.light}`, padding: 3 }}>
                    <div style={{ background: scheme.inactiveTitle, color: scheme.inactiveTitleText, fontWeight: 700, height: 16, padding: "1px 3px" }}>Inactive Window</div>
                  </div>
                  <div style={{ position: "absolute", left: 40, top: 40, width: 220, height: 100, background: scheme.face, boxShadow: `inset -1px -1px ${scheme.dkshadow}, inset 1px 1px ${scheme.hilight}, inset -2px -2px ${scheme.shadow}, inset 2px 2px ${scheme.light}`, padding: 3 }}>
                    <div style={{ background: scheme.activeTitle, color: scheme.activeTitleText, fontWeight: 700, height: 16, padding: "1px 3px" }}>Active Window</div>
                    <div style={{ background: scheme.menu, color: scheme.menuText, height: 16, padding: "1px 4px", display: "flex", gap: 8 }}><span>Normal</span><span style={{ color: scheme.grayText }}>Disabled</span><span style={{ background: scheme.highlight, color: scheme.highlightText, padding: "0 3px" }}>Selected</span></div>
                    <div style={{ background: scheme.window, color: scheme.windowText, height: 50, margin: 2, boxShadow: `inset -1px -1px ${scheme.hilight}, inset 1px 1px ${scheme.shadow}`, padding: 3 }}>Window Text</div>
                  </div>
                  <div style={{ position: "absolute", left: 150, top: 95, width: 120, height: 48, background: scheme.face, boxShadow: `inset -1px -1px ${scheme.dkshadow}, inset 1px 1px ${scheme.hilight}`, padding: 3 }}>
                    <div style={{ background: scheme.activeTitle, color: scheme.activeTitleText, fontWeight: 700, height: 16, padding: "1px 3px" }}>Message Box</div>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}><span style={{ background: scheme.face, boxShadow: `inset -1px -1px ${scheme.dkshadow}, inset 1px 1px ${scheme.hilight}`, padding: "1px 10px" }}>OK</span></div>
                  </div>
                </div>
                <div className="row gap8">
                  <div className="col" style={{ flex: 1 }}>
                    <div><u>S</u>cheme:</div>
                    <Select value={draft.colorScheme} onChange={(e) => setDraft({ ...draft, colorScheme: e.target.value })}>
                      {Object.keys(colorSchemes).map((n) => <option key={n}>{n}</option>)}
                    </Select>
                  </div>
                  <div className="col" style={{ justifyContent: "flex-end", gap: 4 }}>
                    <Button className="sm" disabled>Sa&ve As...</Button>
                    <Button className="sm" disabled={draft.colorScheme === "Windows Standard"} onClick={() => setDraft({ ...draft, colorScheme: "Windows Standard" })}>&Delete</Button>
                  </div>
                </div>
                <div className="row gap8">
                  <div className="col" style={{ flex: 2 }}><div>I<u>t</u>em:</div><Select defaultValue="Desktop"><option>Desktop</option><option>Active Title Bar</option><option>Menu</option><option>Window</option><option>Message Box</option></Select></div>
                  <div className="col" style={{ width: 50 }}><div>Si<u>z</u>e:</div><TextInput defaultValue="" /></div>
                  <div className="col" style={{ width: 50 }}><div>Colo<u>r</u>:</div><div className="field" style={{ background: scheme.desktop }} /></div>
                </div>
                <div className="row gap8">
                  <div className="col" style={{ flex: 2 }}><div><u>F</u>ont:</div><Select defaultValue="MS Sans Serif"><option>MS Sans Serif</option><option>Arial</option></Select></div>
                  <div className="col" style={{ width: 50 }}><div>Si<u>z</u>e:</div><Select defaultValue="8"><option>8</option><option>10</option></Select></div>
                  <div className="col" style={{ width: 50 }}><div>Color:</div><div className="field" style={{ background: scheme.windowText }} /></div>
                </div>
              </>
            )
          return (
            <>
              <Monitor style={{ backgroundColor: scheme.desktop }}>
                <div style={{ position: "absolute", left: 12, top: 10, width: 80, height: 40, background: scheme.face }}><div style={{ background: scheme.activeTitle, height: 6, margin: 1 }} /></div>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: scheme.face }} />
              </Monitor>
              <div className="row gap8">
                <GroupBox title="Color palette" style={{ flex: 1 }}>
                  <Select defaultValue="256 Color">
                    <option>16 Color</option>
                    <option>256 Color</option>
                    <option>High Color (16 bit)</option>
                    <option>True Color (24 bit)</option>
                  </Select>
                  <div style={{ height: 14, marginTop: 6, background: "linear-gradient(90deg, red, yellow, lime, cyan, blue, magenta, red)" }} />
                </GroupBox>
                <GroupBox title="Desktop area" style={{ flex: 1 }}>
                  <div className="row gap4"><span style={{ fontSize: 10 }}>Less</span><div style={{ flex: 1 }}><Slider value={66} onChange={() => {}} ticks={4} /></div><span style={{ fontSize: 10 }}>More</span></div>
                  <div className="center">{typeof window !== "undefined" ? `${window.innerWidth} by ${window.innerHeight} pixels` : "800 by 600 pixels"}</div>
                </GroupBox>
              </div>
              <GroupBox title="Font size">
                <Select defaultValue="Small Fonts"><option>Small Fonts</option><option>Large Fonts</option></Select>
                <div style={{ marginTop: 4 }}>Normal size (96 dpi)</div>
              </GroupBox>
              <Button style={{ alignSelf: "flex-end" }} onClick={() => wm.msgBox({ parentId: win.id, title: "Change Display Type", text: "Adapter Type: Standard PCI Graphics Adapter (VGA)\nManufacturer: (Standard display types)\n\nMonitor Type: Plug and Play Monitor", icon: "none" })}>&Change Display Type...</Button>
            </>
          )
        }}
      </Sheet>
      {preview && <ScreenSaver mode={draft.screenSaver} text={draft.marqueeText} onExit={() => setPreview(false)} />}
    </>
  )
}

registerApp({ id: "display", name: "Display Properties", icon: "display_properties", component: DisplayProps, width: 410, height: 470, resizable: false, maximizable: false, singleton: true })

/* ------------------------------------------------------------------ */
/*  Date/Time                                                           */
/* ------------------------------------------------------------------ */

function DateTimeProps({ win }: AppProps) {
  const s = useSettings()
  const [now, setNow] = useState(new Date())
  const [view, setView] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const offset = -new Date().getTimezoneOffset() / 60
  const first = new Date(view.getFullYear(), view.getMonth(), 1).getDay()
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const h = now.getHours()
  const hand = (len: number, ang: number, w: number) => {
    const a = (ang - 90) * (Math.PI / 180)
    return <line x1={50} y1={50} x2={50 + Math.cos(a) * len} y2={50 + Math.sin(a) * len} stroke="#000080" strokeWidth={w} />
  }
  return (
    <Sheet tabs={["Date & Time", "Time Zone"]} onOk={() => wm.close(win.id)} onCancel={() => wm.close(win.id)} onApply={() => {}} applyEnabled={false}>
      {(tab) =>
        tab === 0 ? (
          <>
            <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <GroupBox title="&Date" style={{ flex: 1 }}>
                <div className="row gap4">
                  <Select value={view.getMonth()} onChange={(e) => setView(new Date(view.getFullYear(), +e.target.value, 1))} style={{ flex: 1 }}>
                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })}</option>)}
                  </Select>
                  <TextInput type="number" value={view.getFullYear()} onChange={(e) => setView(new Date(+e.target.value || 1995, view.getMonth(), 1))} style={{ width: 60 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--window)", boxShadow: "var(--sunken)", marginTop: 6, padding: 2, textAlign: "center" }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} style={{ fontWeight: 700 }}>{d}</div>)}
                  {Array.from({ length: first }).map((_, i) => <div key={"e" + i} />)}
                  {Array.from({ length: days }).map((_, i) => {
                    const today = now.getDate() === i + 1 && now.getMonth() === view.getMonth() && now.getFullYear() === view.getFullYear()
                    return <div key={i} style={{ background: today ? "var(--highlight)" : undefined, color: today ? "var(--highlight-text)" : undefined }}>{i + 1}</div>
                  })}
                </div>
              </GroupBox>
              <GroupBox title="&Time" style={{ width: 150 }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ display: "block", margin: "0 auto" }}>
                  <circle cx="50" cy="50" r="46" fill="var(--face)" stroke="var(--shadow)" strokeWidth="2" />
                  {Array.from({ length: 12 }).map((_, i) => { const a = (i * 30 - 90) * (Math.PI / 180); return <circle key={i} cx={50 + Math.cos(a) * 40} cy={50 + Math.sin(a) * 40} r={1.5} fill="#000080" /> })}
                  {hand(22, (h % 12) * 30 + now.getMinutes() * 0.5, 3)}
                  {hand(32, now.getMinutes() * 6, 2)}
                  {hand(36, now.getSeconds() * 6, 1)}
                </svg>
                <TextInput readOnly value={now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !s.clock24 })} style={{ width: "100%", marginTop: 6, textAlign: "center" }} />
                <Checkbox label="24-hour clock" checked={s.clock24} onChange={(v) => settings.set({ clock24: v })} />
              </GroupBox>
            </div>
            <div>Current time zone: {tz}</div>
          </>
        ) : (
          <>
            <Select value={tz} onChange={() => {}}>
              <option value={tz}>(GMT{offset >= 0 ? "+" : ""}{String(Math.trunc(offset)).padStart(2, "0")}:{String(Math.abs(offset % 1) * 60).padStart(2, "0")}) {tz}</option>
            </Select>
            <svg viewBox="0 0 360 160" width="100%" height="160" style={{ background: "#000080", boxShadow: "var(--sunken)" }}>
              <rect x="0" y="0" width="360" height="160" fill="#000080" />
              {/* crude continents */}
              <path d="M30 30 l40 -8 l30 10 l10 30 l-20 25 l-30 5 l-20 -20 z M110 100 l20 -5 l10 30 l-10 25 l-15 -10 z M170 25 l60 -5 l40 15 l50 -5 l20 25 l-30 20 l-40 -5 l-30 15 l-40 -10 l-20 -20 z M190 85 l25 0 l10 30 l-15 20 l-20 -15 z M300 100 l30 -5 l10 20 l-25 10 z" fill="#008000" stroke="#00c000" strokeWidth="1" />
              <rect x={180 + offset * 15 - 7} y="0" width="15" height="160" fill="#ffff00" opacity="0.5" />
            </svg>
            <Checkbox label="&Automatically adjust clock for daylight saving changes" checked onChange={() => {}} />
          </>
        )
      }
    </Sheet>
  )
}

registerApp({ id: "datetime", name: "Date/Time Properties", icon: "time_and_date", component: DateTimeProps, width: 400, height: 400, resizable: false, maximizable: false, singleton: true })

/* ------------------------------------------------------------------ */
/*  Generic applets                                                     */
/* ------------------------------------------------------------------ */

function Cpl({ win }: AppProps) {
  const applet = String(win.props.applet ?? "system")
  const def = CPL_APPLETS.find((a) => a.id === applet)
  const s = useSettings()
  const { windows } = useWM()
  const close = () => wm.close(win.id)
  useEffect(() => {
    wm.setTitle(win.id, def ? `${def.name} Properties` : "Properties")
    wm.update(win.id, { icon: def?.icon ?? "settings_gear" })
  }, [def, win.id])

  const [dbl, setDbl] = useState(50)
  const [jack, setJack] = useState(false)
  const [sndEvent, setSndEvent] = useState("Start Windows")
  const [contrast, setContrast] = useState(s.colorScheme === "High Contrast Black")
  const [wizardStep, setWizardStep] = useState(0)
  const [addRemoveSel, setAddRemoveSel] = useState(0)
  const locale = typeof navigator !== "undefined" ? navigator.language : "en-US"

  const events: [string, () => void][] = [
    ["Asterisk", sounds.ding],
    ["Critical Stop", sounds.chord],
    ["Default sound", sounds.ding],
    ["Empty Recycle Bin", sounds.recycle],
    ["Exclamation", sounds.chord],
    ["Exit Windows", sounds.shutdown],
    ["Question", sounds.chord],
    ["Start Windows", sounds.startup],
    ["Tada", sounds.tada],
  ]

  switch (applet) {
    case "mouse":
      return (
        <Sheet tabs={["Buttons", "Pointers", "Motion", "General"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <GroupBox title="Button configuration">
                  <div className="row gap8">
                    <Icon name="mouse" />
                    <div className="col gap4">
                      <Radio name="hand" label="&Right-handed" checked onChange={() => {}} />
                      <Radio name="hand" label="&Left-handed" checked={false} onChange={() => {}} />
                    </div>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 6, fontSize: 10 }}>
                    <div>Left Button:<br />- Normal Select<br />- Normal Drag</div>
                    <div>Right Button:<br />- Context Menu<br />- Special Drag</div>
                  </div>
                </GroupBox>
                <GroupBox title="Double-click speed">
                  <div className="row gap8">
                    <div style={{ flex: 1 }}>
                      <div className="row gap4"><span style={{ fontSize: 10 }}>Slow</span><div style={{ flex: 1 }}><Slider value={dbl} onChange={setDbl} /></div><span style={{ fontSize: 10 }}>Fast</span></div>
                    </div>
                    <div className="col" style={{ alignItems: "center" }}>
                      <span style={{ fontSize: 10 }}>Test area:</span>
                      <div onDoubleClick={() => setJack(!jack)} style={{ width: 40, height: 40, background: "var(--window)", boxShadow: "var(--sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{jack ? "🤡" : "📦"}</div>
                    </div>
                  </div>
                </GroupBox>
              </>
            ) : tab === 1 ? (
              <>
                <div>&Scheme</div>
                <Select defaultValue="(None)"><option>(None)</option><option>Animated Hourglasses</option><option>3D Pointers</option><option>Windows Standard (large)</option></Select>
                <div className="listbox w95-scroll" style={{ flex: 1, minHeight: 150 }}>
                  {["Normal Select", "Help Select", "Working In Background", "Busy", "Precision Select", "Text Select", "Handwriting", "Unavailable", "Vertical Resize", "Horizontal Resize", "Diagonal Resize 1", "Diagonal Resize 2", "Move", "Alternate Select"].map((p) => <div key={p} className="li">{p}</div>)}
                </div>
                <div className="dlg-buttons"><Button disabled>Use &Default</Button><Button disabled>&Browse...</Button></div>
              </>
            ) : tab === 2 ? (
              <>
                <GroupBox title="Pointer speed"><div className="row gap4"><span style={{ fontSize: 10 }}>Slow</span><div style={{ flex: 1 }}><Slider value={50} onChange={() => {}} /></div><span style={{ fontSize: 10 }}>Fast</span></div></GroupBox>
                <GroupBox title="Pointer trail"><Checkbox label="&Show pointer trails" checked={false} onChange={() => {}} /><div className="row gap4" style={{ marginTop: 6 }}><span style={{ fontSize: 10 }}>Short</span><div style={{ flex: 1 }}><Slider value={30} onChange={() => {}} /></div><span style={{ fontSize: 10 }}>Long</span></div></GroupBox>
              </>
            ) : (
              <GroupBox title="Name">
                <div className="row gap8"><Icon name="mouse" /><span>Standard PS/2 Port Mouse</span><Button className="sm" style={{ marginLeft: "auto" }} disabled>&Change...</Button></div>
              </GroupBox>
            )
          }
        </Sheet>
      )
    case "keyboard":
      return (
        <Sheet tabs={["Speed", "Language", "General"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <GroupBox title="Character repeat">
                  <div className="row gap8"><Icon name="keyboard" /><div style={{ flex: 1 }}><div>Repeat &delay:</div><div className="row gap4"><span style={{ fontSize: 10 }}>Long</span><div style={{ flex: 1 }}><Slider value={70} onChange={() => {}} ticks={4} /></div><span style={{ fontSize: 10 }}>Short</span></div></div></div>
                  <div className="row gap8" style={{ marginTop: 6 }}><Icon name="keyboard" /><div style={{ flex: 1 }}><div>&Repeat rate:</div><div className="row gap4"><span style={{ fontSize: 10 }}>Slow</span><div style={{ flex: 1 }}><Slider value={80} onChange={() => {}} ticks={32} /></div><span style={{ fontSize: 10 }}>Fast</span></div></div></div>
                  <div style={{ marginTop: 6 }}>Click here and hold down a key to &test repeat rate:</div>
                  <TextInput style={{ width: "100%" }} />
                </GroupBox>
                <GroupBox title="Cursor blink rate">
                  <div className="row gap8"><span className="blink-text" style={{ display: "inline-block", width: 2, height: 16, background: "#000" }} /><span style={{ fontSize: 10 }}>Slow</span><div style={{ flex: 1 }}><Slider value={60} onChange={() => {}} /></div><span style={{ fontSize: 10 }}>Fast</span></div>
                </GroupBox>
              </>
            ) : tab === 1 ? (
              <>
                <div>Installed keyboard &languages and layouts</div>
                <div className="listbox" style={{ height: 70 }}><div className="li sel">En  English (United States)   United States 101</div></div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>A&dd...</Button><Button disabled>&Properties...</Button><Button disabled>&Remove</Button></div>
                <GroupBox title="Switch languages"><Radio label="Left Alt+Shift" checked onChange={() => {}} /> <Radio label="Ctrl+Shift" checked={false} onChange={() => {}} /> <Radio label="None" checked={false} onChange={() => {}} /></GroupBox>
                <Checkbox label="&Enable indicator on taskbar" checked={false} onChange={() => {}} />
              </>
            ) : (
              <GroupBox title="Keyboard type"><div className="row gap8"><Icon name="keyboard" /><span>Standard 101/102-Key or Microsoft Natural Keyboard</span><Button className="sm" style={{ marginLeft: "auto" }} disabled>&Change...</Button></div></GroupBox>
            )
          }
        </Sheet>
      )
    case "sounds":
      return (
        <Sheet tabs={["Sounds"]} onOk={close} onCancel={close} applyEnabled={false}>
          {() => (
            <>
              <div>E&vents:</div>
              <div className="listbox w95-scroll" style={{ height: 150 }}>
                <div className="li" style={{ fontWeight: 700 }}><img src={iconUrl("windows", 16)} alt="" />Windows</div>
                {events.map(([e]) => <div key={e} className={`li ${sndEvent === e ? "sel" : ""}`} style={{ paddingLeft: 20 }} onClick={() => setSndEvent(e)}><img src={iconUrl("loudspeaker_rays", 16)} alt="" />{e}</div>)}
              </div>
              <GroupBox title="Sound">
                <div className="row gap8">
                  <div className="col" style={{ flex: 1 }}><div>&Name:</div><Select value={sndEvent.replace(/ /g, "_") + ".wav"} onChange={() => {}}><option>{sndEvent.replace(/ /g, "_") + ".wav"}</option><option>(None)</option></Select></div>
                  <div className="col"><div>Preview:</div><div className="row gap4"><Icon name="loudspeaker_rays" /><Button className="sm" onClick={() => events.find(([e]) => e === sndEvent)?.[1]()}>▶</Button></div></div>
                </div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start", marginTop: 6 }}><Button disabled>&Browse...</Button><Button disabled>&Details...</Button></div>
              </GroupBox>
              <GroupBox title="Schemes">
                <div className="row gap8"><Select value={s.soundsEnabled ? "Windows Default" : "No Sounds"} onChange={(e) => settings.set({ soundsEnabled: e.target.value !== "No Sounds" })} style={{ flex: 1 }}><option>Windows Default</option><option>No Sounds</option><option>Jungle</option><option>Musica</option><option>Robotz</option><option>Utopia</option></Select><Button className="sm" disabled>Sa&ve As...</Button><Button className="sm" disabled>D&elete</Button></div>
              </GroupBox>
            </>
          )}
        </Sheet>
      )
    case "system": {
      const nav = typeof navigator !== "undefined" ? navigator : null
      const mem = (nav as unknown as { deviceMemory?: number } | null)?.deviceMemory
      const devices: [string, IconName, string[]][] = [
        ["CDROM", "cd_drive", ["MITSUMI CD-ROM FX400"]],
        ["Disk drives", "hard_disk_drive", ["GENERIC IDE DISK TYPE47", "GENERIC NEC FLOPPY DISK"]],
        ["Display adapters", "display_properties", ["Standard PCI Graphics Adapter (VGA)"]],
        ["Floppy disk controllers", "floppy_drive_3_5", ["Standard Floppy Disk Controller"]],
        ["Hard disk controllers", "hard_disk_drive_tools", ["Intel 82371SB PCI Bus Master IDE Controller"]],
        ["Keyboard", "keyboard", ["Standard 101/102-Key or Microsoft Natural Keyboard"]],
        ["Modem", "modem", ["Standard 28800 bps Modem"]],
        ["Monitor", "display_properties", ["Plug and Play Monitor"]],
        ["Mouse", "mouse", ["Standard PS/2 Port Mouse"]],
        ["Network adapters", "network", ["Dial-Up Adapter"]],
        ["Ports (COM & LPT)", "cable_2" as IconName, ["Communications Port (COM1)", "Communications Port (COM2)", "Printer Port (LPT1)"]],
        ["Sound, video and game controllers", "multimedia", ["Creative Labs Sound Blaster 16", "Gameport Joystick"]],
        ["System devices", "hardware", ["Advanced Power Management support", "Direct memory access controller", "PCI bus", "Plug and Play BIOS", "Programmable interrupt controller", "System CMOS/real time clock", "System board", "System speaker", "System timer"]],
      ]
      return (
        <Sheet tabs={["General", "Device Manager", "Hardware Profiles", "Performance"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <div className="row" style={{ gap: 14, alignItems: "flex-start", flex: 1 }}>
                <div style={{ width: 100, display: "flex", justifyContent: "center", paddingTop: 10 }}><img src={iconUrl("computer", 32)} alt="" style={{ width: 64, height: 64 }} /></div>
                <div className="col" style={{ gap: 14, flex: 1, paddingTop: 6 }}>
                  <div>System:<div style={{ paddingLeft: 16 }}>Microsoft Windows 95<br />4.00.950 B</div></div>
                  <div>Registered to:<div style={{ paddingLeft: 16 }}>{profile.name}<br />{profile.company}<br />24264-425-4890421-07155</div></div>
                  <div>Computer:<div style={{ paddingLeft: 16 }}>{nav?.platform ?? "Pentium(r)"}<br />{mem ? `${mem * 1024}.0MB RAM` : "32.0MB RAM"}<br />{nav?.hardwareConcurrency ? `${nav.hardwareConcurrency} processor(s)` : ""}</div></div>
                </div>
              </div>
            ) : tab === 1 ? (
              <>
                <div className="row gap8"><Radio label="View devices by &type" checked onChange={() => {}} /><Radio label="View devices by &connection" checked={false} onChange={() => {}} /></div>
                <div className="explorer-tree w95-scroll" style={{ flex: 1, width: "auto", minHeight: 200 }}>
                  <div className="tree-node"><span className="tw open" /><img src={iconUrl("computer", 16)} alt="" /><span className="tn-label">Computer</span></div>
                  {devices.map(([cat, ic, items]) => (
                    <DevNode key={cat} cat={cat} icon={ic} items={items} />
                  ))}
                </div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>P&roperties</Button><Button disabled>Re&fresh</Button><Button disabled>R&emove</Button><Button onClick={() => wm.msgBox({ parentId: win.id, title: "Print", text: "Printing System Summary to HP LaserJet 4...", icon: "info" })}>Pri&nt...</Button></div>
              </>
            ) : tab === 2 ? (
              <>
                <div>Hardware profiles provide a way to create different hardware configurations.</div>
                <div className="listbox" style={{ height: 80 }}><div className="li sel">Original Configuration</div></div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Copy...</Button><Button disabled>&Rename...</Button><Button disabled>&Delete</Button></div>
              </>
            ) : (
              <>
                <GroupBox title="Performance status">
                  <table style={{ borderSpacing: "0 4px" }}><tbody>
                    <tr><td style={{ width: 120 }}>Memory:</td><td>{mem ? `${mem * 1024}.0 MB` : "32.0 MB"} of RAM</td></tr>
                    <tr><td>System Resources:</td><td>{Math.max(10, 96 - windows.length * 5)}% free</td></tr>
                    <tr><td>File System:</td><td>32-bit</td></tr>
                    <tr><td>Virtual Memory:</td><td>32-bit</td></tr>
                    <tr><td>Disk Compression:</td><td>Not installed</td></tr>
                    <tr><td>PC Cards (PCMCIA):</td><td>No PCMCIA sockets installed</td></tr>
                  </tbody></table>
                  <div style={{ marginTop: 8 }}>Your system is configured for optimal performance.</div>
                </GroupBox>
                <GroupBox title="Advanced settings"><div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&File System...</Button><Button disabled>&Graphics...</Button><Button disabled>&Virtual Memory...</Button></div></GroupBox>
              </>
            )
          }
        </Sheet>
      )
    }
    case "addremove":
      return (
        <Sheet tabs={["Install/Uninstall", "Windows Setup", "Startup Disk"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <div className="row gap8"><Icon name="installer" /><div>To install a new program from a floppy disk or CD-ROM drive, click Install.</div><Button className="sm" onClick={() => launch("setup")}>&Install...</Button></div>
                <div className="hr" />
                <div className="row gap8"><Icon name="appwizard" /><div>The following software can be automatically removed by Windows. To remove a program or to modify its installed components, select it from the list and click Add/Remove.</div></div>
                <div className="listbox w95-scroll" style={{ flex: 1, minHeight: 120 }}>
                  {software.length ? software.map((sw, i) => <div key={sw.slug} className={`li ${addRemoveSel === i ? "sel" : ""}`} onClick={() => setAddRemoveSel(i)} onDoubleClick={() => launch("sw:" + sw.slug)}><img src={sw.logoSmall ?? sw.logo} alt="" style={{ width: 16, height: 16, objectFit: "contain", imageRendering: "auto" }} />{sw.name}{sw.version ? ` ${sw.version}` : ""}{sw.size ? <span className="gray" style={{ marginLeft: "auto" }}>{sw.size}</span> : null}</div>) : <div className="gray" style={{ padding: 6 }}>No programs are installed yet.</div>}
                  <div className="li"><img src={iconUrl("msie1", 16)} alt="" />Microsoft Internet Explorer 3.0</div>
                  <div className="li"><img src={iconUrl("msn3", 16)} alt="" />The Microsoft Network</div>
                </div>
                <div className="dlg-buttons"><Button disabled={!software.length} onClick={async () => {
                  const sw = software[addRemoveSel]
                  if (!sw) return
                  const r = await wm.msgBox({ parentId: win.id, title: "Confirm File Deletion", text: `Are you sure you want to completely remove '${sw.name}' and all of its components?`, icon: "question", buttons: ["Yes", "No"] })
                  if (r === "Yes") wm.msgBox({ parentId: win.id, title: "Remove Programs From Your Computer", text: `${sw.name} is part of ${profile.firstName}'s portfolio and cannot be removed.\n\nOpening it instead.`, icon: "info" }).then(() => launch("sw:" + sw.slug))
                }}>Add/&Remove...</Button></div>
              </>
            ) : tab === 1 ? (
              <>
                <div>To add or remove a component, click the check box. A shaded box means that only part of the component will be installed.</div>
                <div className="listbox w95-scroll" style={{ flex: 1, minHeight: 150 }}>
                  {[["Accessibility Options", "0.4 MB", true], ["Accessories", "12.1 MB", true], ["Communications", "2.8 MB", true], ["Disk Tools", "1.2 MB", true], ["Microsoft Exchange", "4.6 MB", true], ["Microsoft Fax", "2.5 MB", false], ["Multimedia", "3.9 MB", true], ["Screen Savers", "0.3 MB", true], ["The Microsoft Network", "2.3 MB", true]].map(([n, sz, on]) => (
                    <div key={n as string} className="li"><input type="checkbox" defaultChecked={on as boolean} style={{ margin: 0 }} /><img src={iconUrl("file_program_group", 16)} alt="" />{n}<span style={{ marginLeft: "auto" }}>{sz}</span></div>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}><span>Space used by installed components: 27.6 MB</span></div>
                <div className="row" style={{ justifyContent: "space-between" }}><span>Space available on disk: {(Math.max(0, (fs.drives["C:"].drive?.total ?? 0) - fs.usedSpace("C:")) / 1024 / 1024).toFixed(1)} MB</span><Button className="sm" disabled>&Details...</Button></div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Have Disk...</Button></div>
              </>
            ) : (
              <>
                <div className="row gap8" style={{ alignItems: "flex-start" }}><Icon name="floppy_drive_3_5" /><div>If you have trouble starting Windows, you can use a startup disk to start your computer, run diagnostic programs, and fix many problems.<br /><br />To create a startup disk, click Create Disk. You will need one floppy disk.</div></div>
                <div className="dlg-buttons"><Button onClick={() => wm.msgBox({ parentId: win.id, title: "Insert Disk", text: "Label a disk \"Windows 95 Startup Disk\" and insert it into drive A:.\n\nWARNING: Setup will delete any existing files on this disk.", icon: "info" }).then(() => wm.msgBox({ parentId: win.id, title: "Startup Disk", text: "A:\\ is not accessible.\n\nThe device is not ready.", icon: "error" }))}>&Create Disk...</Button></div>
              </>
            )
          }
        </Sheet>
      )
    case "regional": {
      const sample = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, opts).format(123456789.5)
      const d = new Date()
      return (
        <Sheet tabs={["Regional Settings", "Number", "Currency", "Time", "Date"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <svg viewBox="0 0 360 160" width="100%" height="140" style={{ background: "#000080", boxShadow: "var(--sunken)" }}><path d="M30 30 l40 -8 l30 10 l10 30 l-20 25 l-30 5 l-20 -20 z M110 100 l20 -5 l10 30 l-10 25 l-15 -10 z M170 25 l60 -5 l40 15 l50 -5 l20 25 l-30 20 l-40 -5 l-30 15 l-40 -10 l-20 -20 z M190 85 l25 0 l10 30 l-15 20 l-20 -15 z M300 100 l30 -5 l10 20 l-25 10 z" fill="#008000" stroke="#00c000" /></svg>
                <Select value={locale} onChange={() => {}}><option value={locale}>{new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale}</option></Select>
              </>
            ) : tab === 1 ? (
              <GroupBox title="Appearance samples"><table><tbody><tr><td style={{ width: 80 }}>Positive:</td><td>{sample({})}</td><td style={{ paddingLeft: 20 }}>Negative:</td><td>{new Intl.NumberFormat(locale).format(-123456789.5)}</td></tr></tbody></table></GroupBox>
            ) : tab === 2 ? (
              <GroupBox title="Appearance samples"><table><tbody><tr><td style={{ width: 80 }}>Positive:</td><td>{sample({ style: "currency", currency: "USD" })}</td><td style={{ paddingLeft: 20 }}>Negative:</td><td>{new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(-123456789.5)}</td></tr></tbody></table></GroupBox>
            ) : tab === 3 ? (
              <GroupBox title="Appearance"><table style={{ borderSpacing: "0 6px" }}><tbody><tr><td style={{ width: 100 }}>Time sample:</td><td>{d.toLocaleTimeString(locale)}</td></tr><tr><td>Time style:</td><td><Select defaultValue="h:mm:ss tt" style={{ width: 160 }}><option>h:mm:ss tt</option><option>HH:mm:ss</option></Select></td></tr><tr><td>Time separator:</td><td><TextInput defaultValue=":" style={{ width: 40 }} /></td></tr><tr><td>AM symbol:</td><td><TextInput defaultValue="AM" style={{ width: 60 }} /></td></tr><tr><td>PM symbol:</td><td><TextInput defaultValue="PM" style={{ width: 60 }} /></td></tr></tbody></table></GroupBox>
            ) : (
              <>
                <GroupBox title="Calendar type"><Select defaultValue="Gregorian Calendar"><option>Gregorian Calendar</option></Select></GroupBox>
                <GroupBox title="Short date"><table style={{ borderSpacing: "0 6px" }}><tbody><tr><td style={{ width: 120 }}>Short date sample:</td><td>{d.toLocaleDateString(locale)}</td></tr><tr><td>Short date style:</td><td><Select defaultValue="M/d/yy" style={{ width: 160 }}><option>M/d/yy</option><option>MM/dd/yy</option><option>yy/MM/dd</option></Select></td></tr><tr><td>Date separator:</td><td><TextInput defaultValue="/" style={{ width: 40 }} /></td></tr></tbody></table></GroupBox>
                <GroupBox title="Long date"><table style={{ borderSpacing: "0 6px" }}><tbody><tr><td style={{ width: 120 }}>Long date sample:</td><td>{d.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr></tbody></table></GroupBox>
              </>
            )
          }
        </Sheet>
      )
    }
    case "passwords":
      return (
        <Sheet tabs={["Change Passwords", "Remote Administration", "User Profiles"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <GroupBox title="Windows Password"><div className="row gap8"><Icon name="key_win" /><div style={{ flex: 1 }}>Click this button to change your Windows password.</div><Button onClick={() => wm.msgBox({ parentId: win.id, title: "Change Windows Password", text: "Old password: ****\nNew password: ****\nConfirm new password: ****\n\nThe Windows password has been successfully changed.", icon: "info" })}>Change &Windows Password...</Button></div></GroupBox>
                <GroupBox title="Other Passwords"><div className="row gap8"><Icon name="keys" /><div style={{ flex: 1 }}>Click this button to change your password for other password-protected services.</div><Button disabled>Change &Other Passwords...</Button></div></GroupBox>
              </>
            ) : tab === 1 ? (
              <><Checkbox label="&Enable Remote Administration of this server" checked={false} onChange={() => {}} /><div className="gray">Allows other people to manage your files and printers from remote computers.</div></>
            ) : (
              <>
                <Radio label="All users of this PC use the &same preferences and desktop settings." checked onChange={() => {}} />
                <Radio label="&Users can customize their preferences and desktop settings. Windows switches to your personal settings whenever you log in." checked={false} onChange={() => {}} />
                <GroupBox title="User Profile Settings"><Checkbox label="Include &desktop icons and Network Neighborhood contents in user settings" checked={false} disabled onChange={() => {}} /><Checkbox label="Include &Start Menu and Program groups in user settings" checked={false} disabled onChange={() => {}} /></GroupBox>
              </>
            )
          }
        </Sheet>
      )
    case "network":
      return (
        <Sheet tabs={["Configuration", "Identification", "Access Control"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <div>The following &network components are installed:</div>
                <div className="listbox w95-scroll" style={{ height: 110 }}>
                  {[["Client for Microsoft Networks", "network"], ["Dial-Up Adapter", "modem"], ["TCP/IP -> Dial-Up Adapter", "cable"], ["File and printer sharing for Microsoft Networks", "printer_shared"]].map(([n, ic]) => <div key={n} className="li"><img src={iconUrl(ic as IconName, 16)} alt="" />{n}</div>)}
                </div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Add...</Button><Button disabled>&Remove</Button><Button disabled>&Properties</Button></div>
                <div>Primary Network &Logon:</div>
                <Select defaultValue="Client for Microsoft Networks"><option>Client for Microsoft Networks</option><option>Windows Logon</option></Select>
                <Button style={{ alignSelf: "flex-start" }} disabled>&File and Print Sharing...</Button>
                <GroupBox title="Description">Dial-Up Networking lets you connect to the Internet or to another network by using a modem.</GroupBox>
              </>
            ) : tab === 1 ? (
              <>
                <div className="row gap8"><Icon name="network" /><div>Windows uses the following information to identify your computer on the network.</div></div>
                <div className="row gap8"><span style={{ width: 110 }}>Computer name:</span><TextInput defaultValue={profile.firstName.toLowerCase() + "-pc"} style={{ flex: 1 }} /></div>
                <div className="row gap8"><span style={{ width: 110 }}>Workgroup:</span><TextInput defaultValue="PORTFOLIO" style={{ flex: 1 }} /></div>
                <div className="row gap8"><span style={{ width: 110 }}>Computer Description:</span><TextInput defaultValue={`${profile.name}'s computer`} style={{ flex: 1 }} /></div>
              </>
            ) : (
              <>
                <div>Control access to shared resources using:</div>
                <Radio label="&Share-level access control" checked onChange={() => {}} />
                <Radio label="&User-level access control" checked={false} onChange={() => {}} />
              </>
            )
          }
        </Sheet>
      )
    case "modems":
      return (
        <Sheet tabs={["General", "Diagnostics"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <div className="row gap8"><Icon name="modem" /><span>The following &modems are set up on this computer:</span></div>
                <div className="listbox" style={{ height: 60 }}><div className="li sel"><img src={iconUrl("modem", 16)} alt="" />Standard 28800 bps Modem</div></div>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button onClick={() => launch("cpl", { applet: "addhardware" })}>&Add...</Button><Button disabled>&Remove</Button><Button disabled>&Properties</Button></div>
                <GroupBox title="Dialing Preferences"><div>Dialing from: Default Location</div><div className="gray">Use Dialing Properties to modify how your calls are dialed.</div><Button className="sm" style={{ marginTop: 6 }} disabled>&Dialing Properties...</Button></GroupBox>
              </>
            ) : (
              <>
                <div>Windows detected the following ports, and has already installed the following devices:</div>
                <table className="details-table" style={{ background: "var(--window)", boxShadow: "var(--sunken)" }}><thead><tr><th>Port</th><th>Installed</th></tr></thead><tbody><tr><td>COM1</td><td>No Modem Installed.</td></tr><tr><td>COM2</td><td>Standard 28800 bps Modem</td></tr><tr><td>LPT1</td><td>HP LaserJet 4</td></tr></tbody></table>
                <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Driver...</Button><Button onClick={() => wm.msgBox({ parentId: win.id, title: "More Info...", text: "Port: COM2\nInterrupt: 3\nAddress: 2F8\nUART: NS 16550AN\nHighest Speed: 115K Baud\n\nATI1 - 0000\nATI2 - OK\nATI3 - Standard 28800 bps Modem\nATI4 - Portfolio Edition", icon: "none" })}>&More Info...</Button><Button disabled>&Help</Button></div>
              </>
            )
          }
        </Sheet>
      )
    case "multimedia":
      return (
        <Sheet tabs={["Audio", "Video", "MIDI", "CD Music", "Advanced"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <>
                <GroupBox title="Playback"><div className="row gap8"><Icon name="loudspeaker_rays" /><div className="col" style={{ flex: 1 }}><span>Volume:</span><Slider value={s.volume} onChange={(v) => settings.set({ volume: v })} /></div></div><div style={{ marginTop: 6 }}>Preferred device:</div><Select defaultValue="SB16 Wave Out"><option>SB16 Wave Out [220]</option></Select><Checkbox label="Show volume control on the taskbar" checked onChange={() => {}} /></GroupBox>
                <GroupBox title="Recording"><div className="row gap8"><Icon name="microphone" /><div className="col" style={{ flex: 1 }}><span>Volume:</span><Slider value={60} onChange={() => {}} /></div></div><div style={{ marginTop: 6 }}>Preferred device:</div><Select defaultValue="SB16 Wave In"><option>SB16 Wave In [220]</option></Select><div className="row gap8" style={{ marginTop: 4 }}><span>Preferred quality:</span><Select defaultValue="Radio Quality" style={{ flex: 1 }}><option>CD Quality</option><option>Radio Quality</option><option>Telephone Quality</option></Select></div></GroupBox>
              </>
            ) : tab === 1 ? (
              <><Monitor style={{ background: "#000" }}><div style={{ position: "absolute", left: "30%", top: "30%", width: "40%", height: "40%", background: "#808080" }} /></Monitor><GroupBox title="Show video in"><Radio label="&Window:" checked onChange={() => {}} /><Select defaultValue="Original size" style={{ marginLeft: 20, width: 160 }}><option>Original size</option><option>Double original size</option><option>Maximized</option></Select><Radio label="&Full screen" checked={false} onChange={() => {}} /></GroupBox></>
            ) : tab === 2 ? (
              <><GroupBox title="MIDI output"><Radio label="&Single instrument" checked onChange={() => {}} /><div className="listbox" style={{ height: 60, marginLeft: 20 }}><div className="li sel">SB16 MIDI Out [330]</div><div className="li">MIDI for Internal OPL2/OPL3 FM Synthesis</div></div><Radio label="&Custom configuration" checked={false} onChange={() => {}} /></GroupBox><GroupBox title="MIDI instrument installation"><Button disabled>&Add New Instrument...</Button></GroupBox></>
            ) : tab === 3 ? (
              <><div className="row gap8"><span>CD-ROM drive:</span><Select defaultValue="D:" style={{ width: 60 }}><option>D:</option></Select></div><div className="row gap8"><Icon name="cd_audio_cd" /><div className="col" style={{ flex: 1 }}><span>Headphone volume:</span><Slider value={70} onChange={() => {}} /></div></div></>
            ) : (
              <div className="explorer-tree w95-scroll" style={{ flex: 1, width: "auto", minHeight: 200 }}>{["Audio Compression Codecs", "Audio Devices", "Joystick Devices", "MIDI Devices and Instruments", "Media Control Devices", "Mixer Devices", "Video Capture Devices", "Video Compression Codecs"].map((n) => <div key={n} className="tree-node"><span className="tw closed" /><img src={iconUrl("multimedia", 16)} alt="" /><span className="tn-label">{n}</span></div>)}</div>
            )
          }
        </Sheet>
      )
    case "joystick":
      return (
        <Sheet tabs={["Joystick"]} onOk={close} onCancel={close} applyEnabled={false}>
          {() => (
            <>
              <GroupBox title="Current joystick"><div className="row gap8"><span>&Current joystick:</span><Select defaultValue="1" style={{ flex: 1 }}><option value="1">Joystick 1</option><option>Joystick 2</option></Select></div></GroupBox>
              <GroupBox title="Joystick configuration"><div className="row gap8"><Icon name="joystick" /><div className="col" style={{ flex: 1, gap: 4 }}><span>Joystick &selection:</span><Select defaultValue="None"><option>(None)</option><option>2-axis, 2-button joystick</option><option>Gravis GamePad</option></Select><div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Calibrate...</Button><Button onClick={() => wm.msgBox({ parentId: win.id, title: "Joystick", text: "No joystick is attached to this computer.", icon: "warning" })}>&Test...</Button></div></div></div></GroupBox>
              <div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Reset</Button><Button disabled>&Rudder/Pedals...</Button></div>
            </>
          )}
        </Sheet>
      )
    case "internet":
      return (
        <Sheet tabs={["General", "Connection", "Navigation", "Programs", "Security", "Advanced"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <><GroupBox title="Multimedia"><Checkbox label="Show &pictures" checked onChange={() => {}} /><Checkbox label="Play &sounds" checked onChange={() => {}} /><Checkbox label="Play &videos" checked onChange={() => {}} /></GroupBox><GroupBox title="Colors"><Checkbox label="Use &Windows colors" checked onChange={() => {}} /></GroupBox><GroupBox title="Toolbar"><Checkbox label="Standard &buttons" checked onChange={() => {}} /><Checkbox label="&Address bar" checked onChange={() => {}} /><Checkbox label="&Links" checked onChange={() => {}} /><Checkbox label="Text &labels" checked onChange={() => {}} /></GroupBox></>
            ) : tab === 1 ? (
              <><GroupBox title="Dialing"><Checkbox label="&Connect to the Internet as needed" checked onChange={() => {}} /><div style={{ marginLeft: 20, marginTop: 4 }}><Select defaultValue="My Connection"><option>My Connection</option></Select></div></GroupBox><GroupBox title="Proxy server"><Checkbox label="Connect through a &proxy server" checked={false} onChange={() => {}} /></GroupBox></>
            ) : tab === 2 ? (
              <><GroupBox title="Customize"><div className="row gap8"><span style={{ width: 60 }}>Page:</span><Select defaultValue="Start Page" style={{ flex: 1 }}><option>Start Page</option><option>Search Page</option></Select></div><div className="row gap8" style={{ marginTop: 6 }}><span style={{ width: 60 }}>Name:</span><TextInput readOnly value="Start Page" style={{ flex: 1 }} /></div><div className="row gap8" style={{ marginTop: 6 }}><span style={{ width: 60 }}>Address:</span><TextInput readOnly value="http://www.benjaminferguson.home/" style={{ flex: 1 }} /></div></GroupBox><GroupBox title="History"><div className="row gap8"><span>Number of days to keep pages in history:</span><TextInput defaultValue="20" style={{ width: 40 }} /><Button className="sm" onClick={() => settings.set({ recentDocs: [] })}>&Clear History</Button></div></GroupBox></>
            ) : tab === 3 ? (
              <GroupBox title="Mail and news"><div className="row gap8"><span style={{ width: 50 }}>Mail:</span><Select defaultValue="Microsoft Exchange" style={{ flex: 1 }}><option>Microsoft Exchange</option></Select></div><div className="row gap8" style={{ marginTop: 6 }}><span style={{ width: 50 }}>News:</span><Select defaultValue="(None)" style={{ flex: 1 }}><option>(None)</option></Select></div></GroupBox>
            ) : tab === 4 ? (
              <><GroupBox title="Content advisor"><div>Ratings help you control what kind of Internet content can be viewed on this computer.</div><Button className="sm" style={{ marginTop: 6 }} disabled>&Enable Ratings...</Button></GroupBox><GroupBox title="Active content"><Checkbox label="Allow &downloading of active content" checked onChange={() => {}} /><Checkbox label="Enable &ActiveX controls and plug-ins" checked onChange={() => {}} /><Checkbox label="Run ActiveX &scripts" checked onChange={() => {}} /><Checkbox label="Enable &Java programs" checked onChange={() => {}} /></GroupBox></>
            ) : (
              <><GroupBox title="Warnings"><Checkbox label="Warn before sending over an open connection" checked onChange={() => {}} /><Checkbox label="Warn before accepting cookies" checked={false} onChange={() => {}} /></GroupBox><GroupBox title="Temporary Internet files"><div>Pages you view are stored in a special folder for quick viewing later.</div><div className="dlg-buttons" style={{ justifyContent: "flex-start", marginTop: 6 }}><Button className="sm" onClick={() => launch("explorer", { path: "C:\\WINDOWS\\TEMPORARY INTERNET FILES" })}>&View Files...</Button><Button className="sm" disabled>&Settings...</Button></div></GroupBox></>
            )
          }
        </Sheet>
      )
    case "mail":
      return (
        <Sheet tabs={["Services", "Delivery", "Addressing"]} onOk={close} onCancel={close} applyEnabled={false}>
          {(tab) =>
            tab === 0 ? (
              <><div>The following &information services are set up in this profile:</div><div className="listbox" style={{ height: 90 }}><div className="li"><img src={iconUrl("envelope_closed", 16)} alt="" />Internet Mail ({profile.email})</div><div className="li"><img src={iconUrl("address_book", 16)} alt="" />Personal Address Book</div><div className="li"><img src={iconUrl("directory_closed", 16)} alt="" />Personal Folders</div></div><div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Add...</Button><Button disabled>&Remove</Button><Button disabled>&Properties</Button></div><div className="dlg-buttons" style={{ justifyContent: "flex-start" }}><Button disabled>&Copy...</Button><Button disabled>A&bout...</Button></div><Button style={{ alignSelf: "flex-start" }} disabled>Show &Profiles...</Button></>
            ) : tab === 1 ? (
              <><div>Deliver new mail to the following location:</div><Select defaultValue="Personal Folders"><option>Personal Folders</option></Select><div style={{ marginTop: 8 }}>Recipient addresses are processed by these information services in the following order:</div><div className="listbox" style={{ height: 60 }}><div className="li">Internet Mail</div></div></>
            ) : (
              <><div>Show this address list first:</div><Select defaultValue="Personal Address Book"><option>Personal Address Book</option></Select><div style={{ marginTop: 8 }}>Keep personal addresses in:</div><Select defaultValue="Personal Address Book"><option>Personal Address Book</option></Select></>
            )
          }
        </Sheet>
      )
    case "accessibility":
      return (
        <Sheet tabs={["Keyboard", "Sound", "Display", "Mouse", "General"]} onOk={() => { if (contrast !== (s.colorScheme === "High Contrast Black")) settings.set({ colorScheme: contrast ? "High Contrast Black" : "Windows Standard" }); close() }} onCancel={close} onApply={() => settings.set({ colorScheme: contrast ? "High Contrast Black" : "Windows Standard" })} applyEnabled>
          {(tab) =>
            tab === 0 ? (
              <><GroupBox title="StickyKeys"><div>Use StickyKeys if you want to use Shift, Ctrl, or Alt by pressing one key at a time.</div><div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}><Checkbox label="&Use StickyKeys" checked={false} onChange={() => {}} /><Button className="sm" disabled>&Settings...</Button></div></GroupBox><GroupBox title="FilterKeys"><div>Use FilterKeys if you want Windows to ignore brief or repeated keystrokes.</div><div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}><Checkbox label="Use &FilterKeys" checked={false} onChange={() => {}} /><Button className="sm" disabled>S&ettings...</Button></div></GroupBox><GroupBox title="ToggleKeys"><div>Use ToggleKeys if you want to hear tones when pressing Caps Lock, Num Lock, and Scroll Lock.</div><div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}><Checkbox label="Use &ToggleKeys" checked={false} onChange={() => {}} /><Button className="sm" disabled>Se&ttings...</Button></div></GroupBox></>
            ) : tab === 1 ? (
              <><GroupBox title="SoundSentry"><div>Use SoundSentry if you want Windows to generate visual warnings when your system makes a sound.</div><Checkbox label="Use &SoundSentry" checked={false} onChange={() => {}} /></GroupBox><GroupBox title="ShowSounds"><div>Use ShowSounds to tell your programs to display captions for the speech and sounds they make.</div><Checkbox label="Use S&howSounds" checked={false} onChange={() => {}} /></GroupBox></>
            ) : tab === 2 ? (
              <GroupBox title="High Contrast"><div>Use this option if you want Windows to use colors and fonts designed for easy reading.</div><div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}><Checkbox label="&Use High Contrast" checked={contrast} onChange={setContrast} /><Button className="sm" disabled>&Settings...</Button></div></GroupBox>
            ) : tab === 3 ? (
              <GroupBox title="MouseKeys"><div>Use MouseKeys if you want to control the pointer with the numeric keypad on your keyboard.</div><div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}><Checkbox label="&Use MouseKeys" checked={false} onChange={() => {}} /><Button className="sm" disabled>&Settings...</Button></div></GroupBox>
            ) : (
              <><GroupBox title="Automatic reset"><Checkbox label="&Turn off accessibility features after idle for:" checked={false} onChange={() => {}} /><Select defaultValue="5 minutes" style={{ marginLeft: 20, width: 100 }}><option>5 minutes</option><option>10 minutes</option></Select></GroupBox><GroupBox title="Notification"><Checkbox label="Give &warning message when turning a feature on" checked onChange={() => {}} /><Checkbox label="Make a &sound when turning a feature on or off" checked onChange={() => {}} /></GroupBox><GroupBox title="SerialKey devices"><Checkbox label="Support &SerialKey devices" checked={false} onChange={() => {}} /></GroupBox></>
            )
          }
        </Sheet>
      )
    case "addhardware":
      return (
        <div className="col" style={{ flex: 1 }}>
          <div className="row" style={{ flex: 1, alignItems: "stretch" }}>
            <div style={{ width: 120, background: "linear-gradient(#000080, #1084d0)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="hardware" /></div>
            <div className="col gap8" style={{ flex: 1, padding: 14 }}>
              {wizardStep === 0 && <><div>This wizard will help you quickly install a new piece of hardware.</div><div>To begin installing your new hardware, click Next.</div></>}
              {wizardStep === 1 && <><div>If your hardware is already installed, you should have Windows detect it.</div><div>Do you want Windows to search for your new hardware?</div><Radio label="&Yes (Recommended)" checked onChange={() => {}} /><Radio label="&No" checked={false} onChange={() => {}} /></>}
              {wizardStep === 2 && <><div>Windows is now searching for new hardware. This may take several minutes.</div><div className="progress" style={{ height: 16 }}>{Array.from({ length: 12 }).map((_, i) => <div key={i} className="blk" style={{ animation: `blink 2s ${i * 0.15}s steps(1) infinite` }} />)}</div><div className="gray">Detection progress... (nothing is going to be found; this is a web page)</div></>}
              {wizardStep === 3 && <><div>Windows did not find any new Plug and Play devices on your system.</div><div>To install specific hardware, click Next.</div></>}
            </div>
          </div>
          <div className="dlg-buttons" style={{ padding: 10, borderTop: "1px solid var(--shadow)" }}>
            <Button disabled={wizardStep === 0} onClick={() => setWizardStep(wizardStep - 1)}>&lt; &Back</Button>
            <Button isDefault onClick={() => { if (wizardStep === 1) { setWizardStep(2); setTimeout(() => setWizardStep(3), 3000) } else if (wizardStep >= 3) close(); else setWizardStep(wizardStep + 1) }}>{wizardStep >= 3 ? "Finish" : "&Next >"}</Button>
            <Button onClick={close}>Cancel</Button>
          </div>
        </div>
      )
    default:
      return (
        <div className="dlg">
          <div className="row gap8"><Icon name={def?.icon ?? "settings_gear"} /><div>{def?.desc ?? "This applet is not available."}</div></div>
          <div className="dlg-buttons"><Button isDefault onClick={close}>OK</Button></div>
        </div>
      )
  }
}

function DevNode({ cat, icon, items }: { cat: string; icon: IconName; items: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="tree-node" style={{ paddingLeft: 18 }}>
        <span className={`tw ${open ? "open" : "closed"}`} onClick={() => setOpen(!open)} />
        <img src={iconUrl(icon, 16)} alt="" />
        <span className="tn-label" onDoubleClick={() => setOpen(!open)}>{cat}</span>
      </div>
      {open && items.map((it) => <div key={it} className="tree-node" style={{ paddingLeft: 36 }}><span className="tw leaf" /><img src={iconUrl(icon, 16)} alt="" /><span className="tn-label">{it}</span></div>)}
    </>
  )
}

registerApp({
  id: "cpl",
  name: "Control Panel",
  icon: "settings_gear",
  component: Cpl,
  width: 410,
  height: 460,
  resizable: false,
  maximizable: false,
  title: (p) => {
    const d = CPL_APPLETS.find((a) => a.id === p.applet)
    return d ? (p.applet === "addhardware" ? "Add New Hardware Wizard" : `${d.name} Properties`) : "Properties"
  },
})

/* System Properties shortcut (My Computer > Properties) */
registerApp({
  id: "sysprops",
  name: "System Properties",
  icon: "computer",
  component: ({ win }: AppProps) => {
    const done = useRef(false)
    useEffect(() => {
      if (done.current) return
      done.current = true
      wm.close(win.id)
      launch("cpl", { applet: "system" })
    }, [win.id])
    return null
  },
  width: 100,
  height: 100,
  noTaskbar: true,
})
