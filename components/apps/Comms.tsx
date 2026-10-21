"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { fs, useFS, type FSNode } from "@/lib/win95/fs"
import { sounds } from "@/lib/win95/sounds"
import { profile, software } from "@/lib/win95/portfolio"
import { icon as iconUrl, type IconName } from "@/lib/win95/icons"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Checkbox, Icon, Select, StatusBar, Tabs, TextInput, GroupBox } from "@/components/win95/controls"

/* ------------------------------------------------------------------ */
/*  Phone Dialer                                                        */
/* ------------------------------------------------------------------ */

function PhoneDialer({ win }: AppProps) {
  const [num, setNum] = useState("")
  const [speed, setSpeed] = useState<{ name: string; num: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("w95.dialer.speed") ?? "null") ?? Array.from({ length: 8 }, () => ({ name: "", num: "" }))
    } catch {
      return Array.from({ length: 8 }, () => ({ name: "", num: "" }))
    }
  })
  const [log, setLog] = useState<string[]>([])
  const [dialing, setDialing] = useState<string | null>(null)

  const press = (k: string) => {
    sounds.dtmf(k)
    setNum((n) => n + k)
  }
  const dial = async (n = num) => {
    if (!n) return
    setDialing(n)
    for (const ch of n.replace(/\D/g, "")) {
      sounds.dtmf(ch)
      await new Promise((r) => setTimeout(r, 160))
    }
    await new Promise((r) => setTimeout(r, 400))
    sounds.ring()
    setLog((l) => [`${new Date().toLocaleTimeString()}  Dialed ${n}`, ...l])
  }
  const setSpeedDial = async (i: number) => {
    const name = await wm.prompt({ parentId: win.id, title: "Program Speed Dial", label: "Name:", value: speed[i].name })
    if (name === null) return
    const n = await wm.prompt({ parentId: win.id, title: "Program Speed Dial", label: "Number to dial:", value: speed[i].num })
    if (n === null) return
    const next = speed.map((s, k) => (k === i ? { name, num: n } : s))
    setSpeed(next)
    localStorage.setItem("w95.dialer.speed", JSON.stringify(next))
  }
  const menus = [
    { label: "&File", items: [{ label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Speed Dial...", onClick: () => setSpeedDial(0) }] },
    { label: "&Tools", items: [{ label: "&Connect Using...", onClick: () => wm.msgBox({ parentId: win.id, title: "Connect Using", text: "Line: Standard 28800 bps Modem\nAddress: Address 0\n\nUse Phone Dialer to handle voice call requests from other programs.", icon: "none" }) }, { label: "&Dialing Properties...", onClick: () => launch("cpl", { applet: "modems" }) }, { label: "Show &Log", onClick: () => wm.msgBox({ parentId: win.id, title: "Call Log", text: log.length ? log.join("\n") : "(no calls)", icon: "none" }) }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "comms" }) }, { sep: true }, { label: "&About Phone Dialer", onClick: () => wm.msgBox({ parentId: win.id, title: "About Phone Dialer", text: "Microsoft Phone Dialer\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]
  const keys: [string, string][] = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PRS"], ["8", "TUV"], ["9", "WXY"], ["*", ""], ["0", ""], ["#", ""]]
  return (
    <>
      <MenuBar menus={menus} />
      <div className="row" style={{ padding: 8, gap: 12, alignItems: "flex-start" }}>
        <div className="col" style={{ gap: 8 }}>
          <div>
            <div style={{ marginBottom: 2 }}>
              <u>N</u>umber to dial:
            </div>
            <div className="row gap4">
              <TextInput value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dial()} style={{ width: 130 }} />
              <Button isDefault onClick={() => dial()} style={{ minWidth: 60 }}>&Dial</Button>
            </div>
          </div>
          <div className="dialer-pad">
            {keys.map(([k, l]) => (
              <button type="button" key={k} className="btn" onClick={() => press(k)}>
                {k}
                <small>{l || " "}</small>
              </button>
            ))}
          </div>
        </div>
        <GroupBox title="Speed dial" style={{ marginTop: 0 }}>
          <div className="col" style={{ gap: 3 }}>
            {speed.map((s, i) => (
              <Button key={i} className="sm" style={{ width: 120, textAlign: "left", justifyContent: "flex-start" }} onClick={() => (s.num ? dial(s.num) : setSpeedDial(i))} onContextMenu={(e) => { e.preventDefault(); setSpeedDial(i) }}>
                {i + 1} {s.name || <span className="gray">(empty)</span>}
              </Button>
            ))}
          </div>
        </GroupBox>
      </div>
      {dialing && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.1)" }}>
          <div style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 12, width: 260 }} className="col gap8">
            <div style={{ fontWeight: 700 }}>Dialing</div>
            <div className="row gap8"><Icon name="telephony" /><div>Dialing {dialing}...<br /><span className="gray">Name to place in call log:</span></div></div>
            <TextInput defaultValue={profile.name} />
            <div className="dlg-buttons">
              <Button isDefault onClick={() => setDialing(null)}>&Hang Up</Button>
              <Button onClick={() => setDialing(null)}>Change &Options</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

registerApp({ id: "dialer", name: "Phone Dialer", icon: "telephony", component: PhoneDialer, width: 400, height: 300, resizable: false, maximizable: false, singleton: true, exe: "DIALER.EXE", startMenu: ["Programs", "Accessories"] })

/* ------------------------------------------------------------------ */
/*  HyperTerminal — dials a BBS that happens to be Benjamin's           */
/* ------------------------------------------------------------------ */

type HtStage = "newconn" | "phone" | "connect" | "dialing" | "online" | "offline"

function HyperTerminal({ win }: AppProps) {
  const [stage, setStage] = useState<HtStage>("newconn")
  const [connName, setConnName] = useState(`${profile.firstName}'s BBS`)
  const [phone, setPhone] = useState("555-0195")
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [menu, setMenu] = useState<"main" | "software" | "about" | "contact">("main")
  const viewRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    wm.setTitle(win.id, `${connName} - HyperTerminal`)
  }, [connName, win.id])

  useEffect(() => {
    if (stage !== "online") return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [stage])

  useEffect(() => {
    const el = viewRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const print = useCallback((...ls: string[]) => setLines((l) => [...l, ...ls].slice(-500)), [])

  const bbsMenu = useCallback(() => {
    print("", `  ╔══════════════════════════════════════════════╗`, `  ║      ${profile.name.toUpperCase().padEnd(20)} BBS  -  MAIN MENU     ║`, `  ╚══════════════════════════════════════════════�╝`, "", "   [A] About the sysop", "   [S] Software library", "   [C] Contact / leave mail", "   [W] Who's online", "   [G] Goodbye (hang up)", "", "  Command: ")
    setMenu("main")
  }, [print])

  const dial = async () => {
    setStage("dialing")
    sounds.modem(5)
    print("ATDT" + phone.replace(/\D/g, ""))
    await new Promise((r) => setTimeout(r, 2600))
    print("", "CONNECT 28800/ARQ/V34/LAPM/V42BIS", "")
    await new Promise((r) => setTimeout(r, 900))
    setStage("online")
    print(`  Welcome to ${profile.name}'s Bulletin Board System`, `  Running on Windows 95 - Node 1 - ${new Date().toLocaleDateString()}`, "", "  Press ENTER to continue...")
    setMenu("main")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const hangup = () => {
    print("", "NO CARRIER")
    setStage("offline")
  }

  const handle = (cmd: string) => {
    const c = cmd.trim().toUpperCase()
    print(cmd)
    if (menu === "main" || c === "") {
      if (c === "" && lines.some((l) => l.includes("Press ENTER"))) {
        bbsMenu()
        return
      }
      switch (c) {
        case "A":
          print("", `  ── ABOUT THE SYSOP ──`, ...profile.bio.split("\n").map((l) => "  " + l), "", `  Skills: ${profile.skills.join(", ")}`, "", "  [M] Main menu   Command: ")
          setMenu("about")
          return
        case "S":
          print("", "  ── SOFTWARE LIBRARY ──", "", ...(software.length ? software.map((s, i) => `   [${i + 1}] ${s.name.padEnd(20)} ${s.tagline}`) : ["   (The library is empty. Check back soon!)"]), "", "  Enter a number to download, or [M] for main menu: ")
          setMenu("software")
          return
        case "C":
          print("", "  ── CONTACT ──", "", `   E-mail: ${profile.email}`, ...profile.links.filter((l) => !l.url.startsWith("mailto:")).map((l) => `   ${l.label}: ${l.url}`), "", "  [E] Send e-mail now   [M] Main menu   Command: ")
          setMenu("contact")
          return
        case "W":
          print("", "  ── WHO'S ONLINE ──", "", `   Node 1: You                 (${Math.floor(secs / 60)} min)`, `   Node 2: ${profile.firstName} (sysop)        (idle)`, "", "  Command: ")
          return
        case "G":
          print("", "  Thanks for calling! Goodbye.", "")
          setTimeout(hangup, 800)
          return
        default:
          print("  Unknown command. Command: ")
          return
      }
    }
    if (menu === "software") {
      const n = parseInt(c)
      if (!isNaN(n) && software[n - 1]) {
        const s = software[n - 1]
        print("", `  Downloading ${s.name}.ZIP via ZMODEM...`, "  ████████████████████████████ 100%", "  Transfer complete. Launching...", "")
        setTimeout(() => launch("sw:" + s.slug), 600)
        bbsMenu()
        return
      }
      if (c === "M") {
        bbsMenu()
        return
      }
      print("  Invalid selection. Enter a number or [M]: ")
      return
    }
    if (menu === "contact" && c === "E") {
      launch("exchange", { compose: true })
      bbsMenu()
      return
    }
    if (c === "M") bbsMenu()
    else print("  [M] Main menu   Command: ")
  }

  const menus = [
    { label: "&File", items: [{ label: "&New Connection", onClick: () => { setStage("newconn"); setLines([]) } }, { label: "&Open...", disabled: true }, { label: "&Save", disabled: true }, { label: "Save &As...", disabled: true }, { sep: true }, { label: "&Properties", onClick: () => setStage("phone") }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Copy", disabled: true }, { label: "&Paste to Host", disabled: true }, { label: "Select &All" }, { sep: true }, { label: "Clear &Backscroll", onClick: () => setLines([]) }] },
    { label: "&View", items: [{ label: "&Toolbar", checked: true }, { label: "&Status Bar", checked: true }, { sep: true }, { label: "&Font...", disabled: true }] },
    { label: "&Call", items: [{ label: "&Connect", disabled: stage === "online" || stage === "dialing", onClick: () => (stage === "newconn" ? setStage("phone") : dial()) }, { label: "&Disconnect", disabled: stage !== "online", onClick: hangup }] },
    { label: "&Transfer", items: [{ label: "&Send File...", disabled: stage !== "online" }, { label: "&Receive File...", disabled: stage !== "online" }, { label: "&Capture Text...", disabled: true }, { label: "Send &Text File...", disabled: true }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "comms" }) }, { sep: true }, { label: "&About HyperTerminal", onClick: () => wm.msgBox({ parentId: win.id, title: "About HyperTerminal", text: "HyperTerminal\nHilgraeve Inc.\n\nCopyright © 1995 Hilgraeve Inc. All rights reserved.", icon: "none" }) }] },
  ]

  const dialog = (title: string, body: React.ReactNode, buttons: React.ReactNode) => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)", fontSize: 11, lineHeight: 1.2, color: "var(--window-text)", whiteSpace: "normal", userSelect: "none" }}>
      <div style={{ background: "var(--face)", boxShadow: "var(--raised)", padding: 12, width: 340 }} className="col gap8">
        <div style={{ fontWeight: 700 }}>{title}</div>
        {body}
        <div className="dlg-buttons">{buttons}</div>
      </div>
    </div>
  )

  return (
    <>
      <MenuBar menus={menus} />
      <div className="toolbar">
        {["document", "directory_open_cool", "telephony", "modem", "file_lines", "note", "search_file"].map((i, k) => (
          <button key={k} type="button" className="tbtn" onClick={k === 2 ? () => (stage === "newconn" ? setStage("phone") : dial()) : k === 3 ? hangup : undefined}>
            <img src={iconUrl(i as IconName, 16)} alt="" />
          </button>
        ))}
      </div>
      <div ref={viewRef} className="dos w95-scroll" style={{ fontSize: 16, lineHeight: "18px", position: "relative" }} onClick={() => inputRef.current?.focus()}>
        {lines.join("\n")}
        {stage === "online" && (
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handle(input)
                setInput("")
              }
            }}
            style={{ background: "transparent", border: 0, color: "inherit", font: "inherit", outline: "none", width: "60%" }}
            autoFocus
          />
        )}
        {stage === "newconn" &&
          dialog(
            "Connection Description",
            <>
              <div className="row gap8"><Icon name="modem" /><span>Enter a name and choose an icon for the connection:</span></div>
              <div className="row gap8"><span style={{ width: 40 }}>&Name:</span><TextInput value={connName} onChange={(e) => setConnName(e.target.value)} style={{ flex: 1 }} /></div>
              <div className="row gap4">{(["modem", "telephony", "world", "network_drive_world" as IconName, "mailbox_world", "msn3"] as IconName[]).map((i) => <div key={i} style={{ padding: 2, boxShadow: i === "modem" ? "var(--sunken)" : undefined }}><Icon name={i} /></div>)}</div>
            </>,
            <>
              <Button isDefault onClick={() => setStage("phone")}>OK</Button>
              <Button onClick={() => wm.close(win.id)}>Cancel</Button>
            </>,
          )}
        {stage === "phone" &&
          dialog(
            "Phone Number",
            <>
              <div className="row gap8"><Icon name="modem" /><span>Enter details for the phone number that you want to dial:</span></div>
              <div className="row gap8"><span style={{ width: 90 }}>&Country code:</span><Select style={{ flex: 1 }} defaultValue="1"><option value="1">United States of America (1)</option></Select></div>
              <div className="row gap8"><span style={{ width: 90 }}>Ar&ea code:</span><TextInput defaultValue="555" style={{ width: 60 }} /></div>
              <div className="row gap8"><span style={{ width: 90 }}>&Phone number:</span><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: 1 }} /></div>
              <div className="row gap8"><span style={{ width: 90 }}>Co&nnect using:</span><Select style={{ flex: 1 }} defaultValue="m"><option value="m">Standard 28800 bps Modem</option><option>Direct to Com1</option></Select></div>
            </>,
            <>
              <Button isDefault onClick={() => setStage("connect")}>OK</Button>
              <Button onClick={() => setStage("offline")}>Cancel</Button>
            </>,
          )}
        {stage === "connect" &&
          dialog(
            "Connect",
            <>
              <div className="row gap8"><Icon name="modem" /><span>{connName}</span></div>
              <div className="row gap8"><span style={{ width: 90 }}>Phone number:</span><span>555 {phone}</span><Button className="sm" onClick={() => setStage("phone")}>&Modify...</Button></div>
              <div className="row gap8"><span style={{ width: 90 }}>Your location:</span><Select style={{ flex: 1 }} defaultValue="d"><option value="d">Default Location</option></Select><Button className="sm">Dialing &Properties</Button></div>
              <div className="row gap8"><span style={{ width: 90 }}>Calling card:</span><span>None (Direct Dial)</span></div>
            </>,
            <>
              <Button isDefault onClick={dial}>&Dial</Button>
              <Button onClick={() => setStage("offline")}>Cancel</Button>
            </>,
          )}
      </div>
      <StatusBar cells={[stage === "online" ? `Connected ${String(Math.floor(secs / 3600)).padStart(1, "0")}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}` : stage === "dialing" ? "Dialing..." : "Disconnected", "ANSI", "28800 8-N-1", "SCROLL", "CAPS", "NUM"]} />
    </>
  )
}

registerApp({ id: "hyperterm", name: "HyperTerminal", icon: "modem", component: HyperTerminal, width: 620, height: 440, minW: 420, minH: 300, exe: "HYPERTRM.EXE", startMenu: ["Programs", "Accessories"] })

/* ------------------------------------------------------------------ */
/*  Dial-Up Networking                                                  */
/* ------------------------------------------------------------------ */

function DialUp({ win }: AppProps) {
  const wizard = !!win.props.wizard
  const [step, setStep] = useState(wizard ? 0 : 10)
  const [status, setStatus] = useState("")
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState("My Connection")
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!connected) return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [connected])

  const connect = async () => {
    setStep(11)
    sounds.modem(5)
    const steps = ["Dialing...", "Dialing attempt 1 of 1", "Verifying user name and password...", "Logging on to network..."]
    for (const s of steps) {
      setStatus(s)
      await new Promise((r) => setTimeout(r, 1300))
    }
    setStatus("Connected at 28800 bps")
    setConnected(true)
    setStep(12)
  }

  if (wizard) {
    const pages = [
      <>
        <div className="row gap8" style={{ alignItems: "flex-start" }}><Icon name="directory_dial_up_networking" /><div>Type a name for the computer you are dialing:</div></div>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        <div>Select a modem:</div>
        <Select defaultValue="m"><option value="m">Standard 28800 bps Modem</option></Select>
        <Button className="sm" style={{ alignSelf: "flex-start" }} onClick={() => launch("cpl", { applet: "modems" })}>&Configure...</Button>
      </>,
      <>
        <div>Type the phone number for the computer you want to call:</div>
        <div className="row gap8"><span style={{ width: 80 }}>Area code:</span><TextInput defaultValue="555" style={{ width: 60 }} /><span>Telephone number:</span><TextInput defaultValue="0195" style={{ width: 90 }} /></div>
        <div className="row gap8"><span style={{ width: 80 }}>Country code:</span><Select style={{ flex: 1 }} defaultValue="1"><option value="1">United States of America (1)</option></Select></div>
      </>,
      <>
        <div>You have successfully created a new Dial-Up Networking connection called:</div>
        <div style={{ fontWeight: 700, padding: "6px 0" }}>{name}</div>
        <div>Click Finish to save it in your Dial-Up Networking folder. Double-click it to connect.</div>
      </>,
    ]
    return (
      <div className="col" style={{ flex: 1 }}>
        <div className="row" style={{ flex: 1, alignItems: "stretch" }}>
          <div style={{ width: 120, background: "linear-gradient(#000080, #1084d0)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="modem" /></div>
          <div className="col gap8" style={{ flex: 1, padding: 14 }}>{pages[step]}</div>
        </div>
        <div className="dlg-buttons" style={{ padding: 10, borderTop: "1px solid var(--shadow)" }}>
          <Button disabled={step === 0} onClick={() => setStep(step - 1)}>&lt; &Back</Button>
          {step < 2 ? <Button isDefault onClick={() => setStep(step + 1)}>&Next &gt;</Button> : <Button isDefault onClick={() => wm.close(win.id)}>Finish</Button>}
          <Button onClick={() => wm.close(win.id)}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="dlg" style={{ gap: 10 }}>
      {step === 10 && (
        <>
          <div className="row gap8"><Icon name="directory_dial_up_networking" /><span style={{ fontWeight: 700, fontSize: 12 }}>{name}</span></div>
          <div className="row gap8"><span style={{ width: 90 }}>&User name:</span><TextInput defaultValue={profile.firstName.toLowerCase()} style={{ flex: 1 }} /></div>
          <div className="row gap8"><span style={{ width: 90 }}>&Password:</span><TextInput type="password" defaultValue="hunter2" style={{ flex: 1 }} /></div>
          <div style={{ paddingLeft: 98 }}><Checkbox label="&Save password" checked onChange={() => {}} /></div>
          <div className="row gap8"><span style={{ width: 90 }}>Phone &number:</span><TextInput defaultValue="555-0195" style={{ flex: 1 }} /></div>
          <div className="row gap8"><span style={{ width: 90 }}>Dialing &from:</span><Select style={{ flex: 1 }} defaultValue="d"><option value="d">Default Location</option></Select><Button className="sm">Dial &Properties...</Button></div>
          <div className="dlg-buttons">
            <Button isDefault onClick={connect}>Connect</Button>
            <Button onClick={() => wm.close(win.id)}>Cancel</Button>
          </div>
        </>
      )}
      {step === 11 && (
        <>
          <div className="row gap8"><Icon name="modem" /><div><div style={{ fontWeight: 700 }}>Connecting to {name}</div><div>Status: {status}</div></div></div>
          <div className="dlg-buttons"><Button onClick={() => wm.close(win.id)}>Cancel</Button></div>
        </>
      )}
      {step === 12 && (
        <>
          <div className="row gap8"><Icon name="directory_dial_up_networking" /><div><div style={{ fontWeight: 700 }}>Connected to {name}</div><div>Connected at 28800 bps</div><div>Duration: 000:{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</div><div>Bytes received: {(secs * 1534).toLocaleString()}  Bytes sent: {(secs * 212).toLocaleString()}</div></div></div>
          <div className="dlg-buttons">
            <Button onClick={() => launch("iexplore")}>&Browse</Button>
            <Button isDefault onClick={() => { setConnected(false); wm.close(win.id) }}>Di&sconnect</Button>
            <Button onClick={() => wm.minimize(win.id)}>&Details &gt;&gt;</Button>
          </div>
        </>
      )}
    </div>
  )
}

registerApp({ id: "dialup", name: "Dial-Up Networking", icon: "directory_dial_up_networking", component: DialUp, width: 400, height: 260, resizable: false, maximizable: false, startMenu: ["Programs", "Accessories"], title: (p) => (p.wizard ? "Make New Connection" : "Connect To") })

/* ------------------------------------------------------------------ */
/*  Direct Cable Connection                                              */
/* ------------------------------------------------------------------ */

function DCC({ win }: AppProps) {
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<"host" | "guest">("guest")
  return (
    <div className="col" style={{ flex: 1 }}>
      <div className="row" style={{ flex: 1, alignItems: "stretch" }}>
        <div style={{ width: 120, background: "linear-gradient(#000080, #1084d0)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="direct_cable_conn" /></div>
        <div className="col gap8" style={{ flex: 1, padding: 14 }}>
          {step === 0 && (
            <>
              <div>Direct Cable Connection enables you to quickly and easily establish a direct serial or parallel cable connection between two computers.</div>
              <div>To connect two computers now, specify which one you are using:</div>
              <label className="radio"><input type="radio" checked={role === "host"} onChange={() => setRole("host")} /> <span>&Host: This computer has the resources you want to access.</span></label>
              <label className="radio"><input type="radio" checked={role === "guest"} onChange={() => setRole("guest")} /> <span>&Guest: This computer will be used to access resources on the host.</span></label>
            </>
          )}
          {step === 1 && (
            <>
              <div>Select the port you want to use:</div>
              <div className="listbox" style={{ height: 60 }}>{["Parallel cable on LPT1", "Serial cable on COM1", "Serial cable on COM2"].map((p, i) => <div key={p} className={`li ${i === 0 ? "sel" : ""}`}>{p}</div>)}</div>
              <div>NOTE: You must use the same type of port on both computers.</div>
            </>
          )}
          {step === 2 && (
            <>
              <div style={{ fontWeight: 700 }}>Status: {role === "host" ? "Waiting for a guest computer to connect via Parallel cable on LPT1..." : "Checking for cable on LPT1..."}</div>
              <div className="progress" style={{ height: 16 }}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="blk" style={{ animation: `blink 1.6s ${i * 0.2}s steps(1) infinite` }} />)}</div>
              <div className="gray">Make sure the cable is plugged into both computers. This is a web page, so it may take a while.</div>
            </>
          )}
        </div>
      </div>
      <div className="dlg-buttons" style={{ padding: 10, borderTop: "1px solid var(--shadow)" }}>
        <Button disabled={step === 0} onClick={() => setStep(step - 1)}>&lt; &Back</Button>
        {step < 2 ? <Button isDefault onClick={() => setStep(step + 1)}>{step === 1 ? "&Finish" : "&Next >"}</Button> : <Button onClick={() => wm.close(win.id)}>Close</Button>}
        <Button onClick={() => wm.close(win.id)}>Cancel</Button>
      </div>
    </div>
  )
}

registerApp({ id: "dcc", name: "Direct Cable Connection", icon: "direct_cable_conn", component: DCC, width: 440, height: 260, resizable: false, maximizable: false, singleton: true, startMenu: ["Programs", "Accessories"] })

/* ------------------------------------------------------------------ */
/*  The Microsoft Network                                               */
/* ------------------------------------------------------------------ */

function MSN({ win }: AppProps) {
  const [stage, setStage] = useState<"signin" | "connecting" | "central">("signin")
  const connect = async () => {
    setStage("connecting")
    sounds.modem(4)
    await new Promise((r) => setTimeout(r, 3800))
    setStage("central")
  }
  if (stage !== "central") {
    return (
      <div className="col" style={{ flex: 1 }}>
        <div style={{ background: "#000", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="msn3" />
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 700 }}>The Microsoft Network</div>
        </div>
        <div className="dlg" style={{ gap: 10 }}>
          {stage === "signin" ? (
            <>
              <div className="row gap8"><span style={{ width: 80 }}>&Member ID:</span><TextInput defaultValue={profile.email.split("@")[0]} style={{ flex: 1 }} /></div>
              <div className="row gap8"><span style={{ width: 80 }}>&Password:</span><TextInput type="password" defaultValue="password" style={{ flex: 1 }} /></div>
              <Checkbox label="&Remember my password" checked onChange={() => {}} />
              <div className="dlg-buttons">
                <Button isDefault onClick={connect}>&Connect</Button>
                <Button onClick={() => wm.close(win.id)}>Cancel</Button>
                <Button onClick={() => launch("cpl", { applet: "modems" })}>&Settings...</Button>
              </div>
            </>
          ) : (
            <>
              <div>Dialing The Microsoft Network...</div>
              <div className="progress"><div className="blk" style={{ width: "100%", flex: 1, animation: "blink 1s steps(1) infinite" }} /></div>
              <div className="gray">Using Standard 28800 bps Modem</div>
              <div className="dlg-buttons"><Button onClick={() => wm.close(win.id)}>Cancel</Button></div>
            </>
          )}
        </div>
      </div>
    )
  }
  const tiles: { label: string; icon: IconName; onClick: () => void }[] = [
    { label: "E-MAIL", icon: "envelope_closed", onClick: () => launch("exchange", { compose: true }) },
    { label: "SOFTWARE", icon: "package", onClick: () => launch("explorer", { path: `C:\\Program Files\\${profile.company ?? "Software"}` }) },
    { label: "ABOUT", icon: "user_world", onClick: () => launch("notepad", { path: "C:\\My Documents\\About Benjamin.txt" }) },
    { label: "FAVORITE PLACES", icon: "directory_favorites", onClick: () => launch("explorer", { path: "C:\\WINDOWS\\FAVORITES" }) },
    { label: "MEMBER ASSISTANCE", icon: "help_book_big", onClick: () => launch("help") },
    { label: "INTERNET", icon: "msie1", onClick: () => launch("iexplore") },
  ]
  return (
    <div className="col" style={{ flex: 1, background: "#000" }}>
      <div style={{ padding: "10px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <Icon name="msn3" />
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 18, fontWeight: 700 }}>MSN CENTRAL</div>
        <div style={{ marginLeft: "auto", fontSize: 10, color: "#aaa" }}>Welcome, {profile.firstName}</div>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "0 16px 16px" }}>
        {tiles.map((t) => (
          <button key={t.label} type="button" onClick={t.onClick} style={{ background: ["#c00", "#09c", "#690", "#c60", "#639", "#06c"][tiles.indexOf(t)], border: "2px solid #fff", color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

registerApp({ id: "msn", name: "The Microsoft Network", icon: "msn3", component: MSN, width: 440, height: 340, singleton: true, exe: "MSNSTART.EXE", startMenu: ["Programs"], title: () => "The Microsoft Network" })

/* ------------------------------------------------------------------ */
/*  Microsoft Exchange (Inbox)                                          */
/* ------------------------------------------------------------------ */

interface Mail {
  id: string
  from: string
  subject: string
  date: number
  body: string
  read: boolean
  folder: "Inbox" | "Sent Items" | "Deleted Items" | "Outbox"
}

function seedMail(): Mail[] {
  const now = Date.now()
  return [
    {
      id: "m1",
      from: `${profile.name} <${profile.email}>`,
      subject: "Welcome to my desktop",
      date: now - 3600_000,
      read: false,
      folder: "Inbox",
      body: `Hi,\n\nThanks for stopping by. This whole site is a working Windows 95 desktop that I built as my portfolio.\n\nA few things to try:\n  - Start > Programs > ${profile.company ?? "Software"} for the things I've made\n  - Start > Programs > MS-DOS Prompt, then type HELP\n  - Right-click the desktop > Properties to change the look\n\nIf you want to get in touch, hit Reply (or Compose) - it opens your mail program addressed to me.\n\n${profile.name}`,
    },
    {
      id: "m2",
      from: `${profile.name} <${profile.email}>`,
      subject: software.length ? `Software: ${software.map((s) => s.name).join(", ")}` : "Software library",
      date: now - 86400_000,
      read: false,
      folder: "Inbox",
      body: software.length
        ? `Here's what's installed on this machine:\n\n${software.map((s) => `${s.name}${s.version ? " " + s.version : ""}\n  ${s.tagline}${s.website ? "\n  " + s.website : ""}`).join("\n\n")}\n\nEach one has a program window with screenshots and links.`
        : "The software library is being set up. Check Start > Programs soon.",
    },
    {
      id: "m3",
      from: "Microsoft Network Administrator",
      subject: "Welcome to Microsoft Exchange",
      date: now - 2 * 86400_000,
      read: true,
      folder: "Inbox",
      body: "Welcome to Microsoft Exchange!\n\nMicrosoft Exchange is your universal inbox for e-mail, faxes and online service messages.\n\nThis message was generated automatically.",
    },
  ]
}

const MAIL_KEY = "w95.exchange.mail"

function Exchange({ win }: AppProps) {
  const [mail, setMail] = useState<Mail[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MAIL_KEY) ?? "null")
      return saved ?? seedMail()
    } catch {
      return seedMail()
    }
  })
  const [folder, setFolder] = useState<Mail["folder"]>("Inbox")
  const [sel, setSel] = useState<string | null>(null)
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string } | null>(win.props.compose ? { to: profile.email, subject: win.props.attach ? `Re: ${win.props.attach}` : "Hello from your Windows 95 portfolio", body: "" } : null)

  useEffect(() => {
    localStorage.setItem(MAIL_KEY, JSON.stringify(mail))
  }, [mail])

  useEffect(() => {
    if (win.props.compose && !compose) setCompose({ to: profile.email, subject: "Hello from your Windows 95 portfolio", body: "" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.compose])

  const list = mail.filter((m) => m.folder === folder).sort((a, b) => b.date - a.date)
  const current = mail.find((m) => m.id === sel)
  const unread = mail.filter((m) => m.folder === "Inbox" && !m.read).length

  useEffect(() => {
    wm.setTitle(win.id, `${folder} - Microsoft Exchange`)
  }, [folder, win.id])

  const open = (m: Mail) => {
    setSel(m.id)
    if (!m.read) setMail((ms) => ms.map((x) => (x.id === m.id ? { ...x, read: true } : x)))
  }
  const del = () => {
    if (!current) return
    if (current.folder === "Deleted Items") setMail((ms) => ms.filter((x) => x.id !== current.id))
    else setMail((ms) => ms.map((x) => (x.id === current.id ? { ...x, folder: "Deleted Items" } : x)))
    setSel(null)
  }
  const send = () => {
    if (!compose) return
    const href = `mailto:${compose.to}?subject=${encodeURIComponent(compose.subject)}&body=${encodeURIComponent(compose.body)}`
    window.location.href = href
    setMail((ms) => [...ms, { id: "s" + Date.now(), from: "You", subject: compose.subject, date: Date.now(), read: true, folder: "Sent Items", body: `To: ${compose.to}\n\n${compose.body}` }])
    setCompose(null)
    sounds.ding()
  }

  const menus = [
    { label: "&File", items: [{ label: "&Open", disabled: !current, onClick: () => current && wm.msgBox({ parentId: win.id, title: current.subject, text: current.body, icon: "none" }) }, { label: "&Delete", accel: "Ctrl+D", disabled: !current, onClick: del }, { sep: true }, { label: "&Print...", disabled: true }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "Select &All" }, { label: "Mark as &Read", onClick: () => current && setMail((ms) => ms.map((x) => (x.id === current.id ? { ...x, read: true } : x))) }, { label: "Mark as &Unread", onClick: () => current && setMail((ms) => ms.map((x) => (x.id === current.id ? { ...x, read: false } : x))) }] },
    { label: "&View", items: [{ label: "&Folders", checked: true }, { label: "&Toolbar", checked: true }, { label: "&Status Bar", checked: true }, { sep: true }, { label: "&Sort...", disabled: true }] },
    { label: "&Tools", items: [{ label: "&Deliver Now", onClick: () => sounds.ding() }, { label: "&Address Book...", onClick: () => wm.msgBox({ parentId: win.id, title: "Address Book", text: `${profile.name}\n${profile.email}`, icon: "none" }) }, { sep: true }, { label: "&Services...", onClick: () => launch("cpl", { applet: "mail" }) }, { label: "&Options...", disabled: true }] },
    { label: "&Compose", items: [{ label: "&New Message", accel: "Ctrl+N", onClick: () => setCompose({ to: profile.email, subject: "", body: "" }) }, { label: "&Reply to Sender", accel: "Ctrl+R", disabled: !current, onClick: () => current && setCompose({ to: profile.email, subject: "RE: " + current.subject, body: `\n\n----------\nFrom: ${current.from}\nSubject: ${current.subject}\n\n${current.body}` }) }, { label: "&Forward", accel: "Ctrl+F", disabled: !current, onClick: () => current && setCompose({ to: "", subject: "FW: " + current.subject, body: `\n\n----------\n${current.body}` }) }] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "exchange" }) }, { sep: true }, { label: "&About Microsoft Exchange", onClick: () => wm.msgBox({ parentId: win.id, title: "About Microsoft Exchange", text: "Microsoft Exchange\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) }] },
  ]

  const folders: Mail["folder"][] = ["Deleted Items", "Inbox", "Outbox", "Sent Items"]

  return (
    <>
      <MenuBar menus={menus} />
      <div className="toolbar">
        <button type="button" className="tbtn" title="New Message" onClick={() => setCompose({ to: profile.email, subject: "", body: "" })}><img src={iconUrl("message_file", 16)} alt="" /></button>
        <button type="button" className="tbtn" title="Reply to Sender" disabled={!current} onClick={() => current && setCompose({ to: profile.email, subject: "RE: " + current.subject, body: `\n\n----------\n${current.body}` })}><img src={iconUrl("message_envelope_open", 16)} alt="" /></button>
        <div className="tsep" />
        <button type="button" className="tbtn" title="Delete" disabled={!current} onClick={del}><img src={iconUrl("erase_file", 16)} alt="" /></button>
        <button type="button" className="tbtn" title="Address Book"><img src={iconUrl("address_book", 16)} alt="" /></button>
        <div className="tsep" />
        <button type="button" className="tbtn" title="Help" onClick={() => launch("help", { topic: "exchange" })}><img src={iconUrl("help_question_mark", 16)} alt="" /></button>
      </div>
      <div className="explorer-body" style={{ padding: "2px 0 0" }}>
        <div className="explorer-tree w95-scroll" style={{ width: 150, flexBasis: 150 }}>
          <div className="tree-node"><span className="tw open" /><img src={iconUrl("envelope_closed", 16)} alt="" /><span className="tn-label">Microsoft Exchange</span></div>
          <div className="tree-node" style={{ paddingLeft: 18 }}><span className="tw open" /><img src={iconUrl("directory_closed", 16)} alt="" /><span className="tn-label">Personal Folders</span></div>
          {folders.map((f) => (
            <div key={f} className={`tree-node ${folder === f ? "sel" : ""}`} style={{ paddingLeft: 36 }} onClick={() => { setFolder(f); setSel(null) }}>
              <span className="tw leaf" />
              <img src={iconUrl(f === "Deleted Items" ? "recycle_bin_empty" : f === "Inbox" ? "envelope_closed" : f === "Outbox" ? "message_file" : "message_envelope_open", 16)} alt="" />
              <span className="tn-label">{f}{f === "Inbox" && unread ? ` (${unread})` : ""}</span>
            </div>
          ))}
        </div>
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <div className="explorer-list details w95-scroll" style={{ flex: 1 }}>
            <table className="details-table">
              <thead><tr><th style={{ width: 20 }}>!</th><th style={{ width: 20 }}></th><th>From</th><th>Subject</th><th>Received</th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} className={sel === m.id ? "sel" : ""} style={{ fontWeight: m.read ? 400 : 700 }} onClick={() => open(m)} onDoubleClick={() => wm.msgBox({ parentId: win.id, title: m.subject, text: `From: ${m.from}\nDate: ${new Date(m.date).toLocaleString()}\n\n${m.body}`, icon: "none" })}>
                    <td></td>
                    <td><img src={iconUrl(m.read ? "message_envelope_open" : "envelope_closed", 16)} alt="" /></td>
                    <td>{m.from.replace(/<.*>/, "").trim()}</td>
                    <td>{m.subject}</td>
                    <td>{new Date(m.date).toLocaleString()}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={5} className="gray" style={{ padding: 10 }}>There are no items in this folder.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="doc-view w95-scroll sel-text" style={{ height: 130, flex: "none", fontFamily: "var(--font)", fontSize: 11, whiteSpace: "pre-wrap", marginTop: 3 }}>
            {current ? (
              <>
                <div style={{ borderBottom: "1px solid var(--shadow)", marginBottom: 6, paddingBottom: 4 }}>
                  <b>From:</b> {current.from}
                  <br />
                  <b>Subject:</b> {current.subject}
                </div>
                {current.body}
              </>
            ) : (
              <span className="gray">Select a message to read it.</span>
            )}
          </div>
        </div>
      </div>
      <StatusBar cells={[`${list.length} Items, ${list.filter((m) => !m.read).length} Unread`, ""]} />
      {compose && (
        <div style={{ position: "absolute", inset: 0, background: "var(--face)", display: "flex", flexDirection: "column", zIndex: 5 }}>
          <div className="titlebar active" style={{ background: "var(--active-title)", color: "var(--active-title-text)", flex: "0 0 18px" }}>
            <img src={iconUrl("message_file", 16)} alt="" />
            <span className="title">{compose.subject || "New Message"} - Microsoft Exchange</span>
          </div>
          <div className="dlg" style={{ gap: 6 }}>
            <div className="row gap8"><Button className="sm" style={{ width: 60 }}>To...</Button><TextInput value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} style={{ flex: 1 }} /></div>
            <div className="row gap8"><Button className="sm" style={{ width: 60 }}>Cc...</Button><TextInput style={{ flex: 1 }} /></div>
            <div className="row gap8"><span style={{ width: 60 }}>Subject:</span><TextInput value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} style={{ flex: 1 }} /></div>
            <textarea className="field w95-scroll" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} style={{ flex: 1, minHeight: 100 }} placeholder={`Write to ${profile.firstName}...`} />
            <div className="dlg-buttons">
              <Button isDefault onClick={send}>&Send</Button>
              <Button onClick={() => setCompose(null)}>Cancel</Button>
            </div>
            <div className="gray">Send opens your own e-mail program addressed to {profile.email}.</div>
          </div>
        </div>
      )}
    </>
  )
}

registerApp({ id: "exchange", name: "Inbox - Microsoft Exchange", icon: "envelope_closed", component: Exchange, width: 620, height: 440, minW: 400, minH: 300, singleton: true, exe: "EXCHNG32.EXE", startMenu: ["Programs"], title: () => "Inbox - Microsoft Exchange" })

/* ------------------------------------------------------------------ */
/*  Internet Explorer                                                   */
/* ------------------------------------------------------------------ */

const HOME = "http://www.benjaminferguson.home/"
const SEARCH = "http://www.benjaminferguson.home/search"

function internalPage(url: string, query: string, go: (u: string) => void): { title: string; node: React.ReactNode } | null {
  const u = url.replace(/\/$/, "")
  if (u === HOME.replace(/\/$/, "") || url === "about:home") {
    return {
      title: `${profile.name} - Home Page`,
      node: (
        <div className="webpage">
          <div className="marquee"><span>Welcome to {profile.name}&apos;s home page! Best viewed in Internet Explorer 3.0 at 800x600 ★ {software.length} program(s) available for download ★</span></div>
          <h1>{profile.name}</h1>
          <p><i>{profile.title}</i></p>
          <hr />
          <table width="100%"><tbody><tr>
            <td style={{ verticalAlign: "top", width: 160, background: "#e0e0e0" }}>
              <b>Navigation</b>
              <ul style={{ paddingLeft: 18 }}>
                <li><a href="#" onClick={(e) => { e.preventDefault(); go(HOME + "about") }}>About me</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); go(HOME + "software") }}>Software</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); go(HOME + "contact") }}>Contact</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); go(SEARCH) }}>Search</a></li>
              </ul>
              <p style={{ fontSize: 11 }}>You are visitor number<br /><span style={{ background: "#000", color: "#0f0", fontFamily: "monospace", padding: "0 4px" }}>{String(1995 + new Date().getDate() * 37).padStart(6, "0")}</span></p>
            </td>
            <td style={{ verticalAlign: "top", paddingLeft: 12 }}>
              {profile.bio.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
              <h2>Software</h2>
              {software.length ? (
                <ul>{software.map((s) => <li key={s.slug}><a href="#" onClick={(e) => { e.preventDefault(); go(HOME + "software/" + s.slug) }}>{s.name}</a> - {s.tagline}</li>)}</ul>
              ) : <p><i>Coming soon.</i></p>}
              <h2>Links</h2>
              <ul>{profile.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul>
            </td>
          </tr></tbody></table>
          <hr />
          <p style={{ fontSize: 11 }}>Last updated {new Date().toLocaleDateString()} &middot; Made with Notepad &middot; <a href="mailto:${profile.email}">{profile.email}</a></p>
        </div>
      ),
    }
  }
  if (u === HOME + "about") {
    return { title: `About ${profile.name}`, node: <div className="webpage"><h1>About {profile.name}</h1><hr />{profile.bio.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}<h2>Skills</h2><ul>{profile.skills.map((s) => <li key={s}>{s}</li>)}</ul><p><a href="#" onClick={(e) => { e.preventDefault(); go(HOME) }}>&laquo; Back home</a></p></div> }
  }
  if (u === HOME + "software") {
    return { title: "Software", node: <div className="webpage"><h1>Software</h1><hr />{software.length ? <table width="100%"><thead><tr><th>Name</th><th>Version</th><th>Description</th><th>Links</th></tr></thead><tbody>{software.map((s) => <tr key={s.slug}><td><a href="#" onClick={(e) => { e.preventDefault(); go(HOME + "software/" + s.slug) }}>{s.name}</a></td><td>{s.version ?? ""}</td><td>{s.tagline}</td><td>{s.website && <a href={s.website} target="_blank" rel="noreferrer">Web</a>} {s.download && <a href={s.download} target="_blank" rel="noreferrer">Download</a>} {s.source && <a href={s.source} target="_blank" rel="noreferrer">Source</a>}</td></tr>)}</tbody></table> : <p>No software listed yet.</p>}<p><a href="#" onClick={(e) => { e.preventDefault(); go(HOME) }}>&laquo; Back home</a></p></div> }
  }
  if (u.startsWith(HOME + "software/")) {
    const s = software.find((x) => x.slug === u.slice((HOME + "software/").length))
    if (!s) return null
    return { title: s.name, node: <div className="webpage"><div className="row gap8"><img src={s.logo} alt="" style={{ width: 48, height: 48, imageRendering: "auto" }} /><h1 style={{ margin: 0 }}>{s.name}</h1></div><p><i>{s.tagline}</i></p><hr />{s.description.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}{s.features?.length ? <><h2>Features</h2><ul>{s.features.map((f) => <li key={f}>{f}</li>)}</ul></> : null}{s.screenshots?.length ? <><h2>Screenshots</h2>{s.screenshots.map((sh) => <img key={sh} src={sh} alt="" style={{ maxWidth: "100%", display: "block", marginBottom: 8, border: "1px solid #808080" }} />)}</> : null}<p>{s.website && <><a href={s.website} target="_blank" rel="noreferrer">Visit website</a> &middot; </>}{s.download && <><a href={s.download} target="_blank" rel="noreferrer">Download</a> &middot; </>}{s.source && <a href={s.source} target="_blank" rel="noreferrer">Source code</a>} <a href="#" onClick={(e) => { e.preventDefault(); launch("sw:" + s.slug) }}>Open program</a></p><p><a href="#" onClick={(e) => { e.preventDefault(); go(HOME + "software") }}>&laquo; All software</a></p></div> }
  }
  if (u === HOME + "contact") {
    return { title: "Contact", node: <div className="webpage"><h1>Contact</h1><hr /><p>E-mail: <a href={`mailto:${profile.email}`}>{profile.email}</a></p><ul>{profile.links.filter((l) => !l.url.startsWith("mailto:")).map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul><p><a href="#" onClick={(e) => { e.preventDefault(); launch("exchange", { compose: true }) }}>Send mail with Microsoft Exchange</a></p><p><a href="#" onClick={(e) => { e.preventDefault(); go(HOME) }}>&laquo; Back home</a></p></div> }
  }
  if (u.startsWith(SEARCH) || url === "search") {
    const q = query.toLowerCase()
    const results: { title: string; url: string; desc: string }[] = []
    if (q) {
      for (const s of software) if ((s.name + s.tagline + s.description + (s.tags ?? []).join(" ")).toLowerCase().includes(q)) results.push({ title: s.name, url: HOME + "software/" + s.slug, desc: s.tagline })
      if ((profile.name + profile.bio + profile.skills.join(" ")).toLowerCase().includes(q)) results.push({ title: `About ${profile.name}`, url: HOME + "about", desc: profile.title })
      for (const r of fs.find("C:\\My Documents", `*${q}*`, undefined, 20)) results.push({ title: r.node.name, url: "file:///" + r.path.replace(/\\/g, "/"), desc: r.path })
    }
    return {
      title: "Search - Benjamin Search",
      node: (
        <div className="webpage">
          <h1 style={{ textAlign: "center", color: "#008" }}>Benjamin<span style={{ color: "#c00" }}>Search</span></h1>
          <form style={{ textAlign: "center" }} onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value; go(SEARCH + "?q=" + encodeURIComponent(v)) }}>
            <input name="q" defaultValue={query} className="field" style={{ width: 260, height: 24, fontSize: 14 }} /> <Button type="submit">Search</Button>
          </form>
          <hr />
          {q ? (results.length ? results.map((r) => <p key={r.url}><a href="#" onClick={(e) => { e.preventDefault(); if (r.url.startsWith("file:")) launch("notepad", { path: r.desc }); else go(r.url) }} style={{ fontSize: 18 }}>{r.title}</a><br /><span style={{ color: "#080", fontSize: 12 }}>{r.url}</span><br />{r.desc}</p>) : <p>No documents match your query.</p>) : <p style={{ textAlign: "center" }}>Search {profile.firstName}&apos;s software, documents and pages.</p>}
        </div>
      ),
    }
  }
  if (url === "about:blank") return { title: "about:blank", node: <div className="webpage" /> }
  return null
}

function InternetExplorer({ win }: AppProps) {
  useFS()
  const initial = (() => {
    const u = win.props.url as string | undefined
    const p = win.props.path as string | undefined
    if (u === "search") return SEARCH
    if (u) return u
    if (p) {
      const node = fs.get(p)
      if (node?.type === "file" && node.url) return node.url
      return "file:///" + p.replace(/\\/g, "/")
    }
    return HOME
  })()
  const [url, setUrl] = useState(initial)
  const [addr, setAddr] = useState(initial)
  const [hist, setHist] = useState<string[]>([initial])
  const [hi, setHi] = useState(0)
  const [loading, setLoading] = useState(false)
  const [frameFailed, setFrameFailed] = useState(false)
  const [showLinks, setShowLinks] = useState(true)

  const go = useCallback(
    (to: string, push = true) => {
      let u = to.trim()
      if (!u) return
      if (!/^[a-z]+:/i.test(u)) u = /^(www\.|[\w-]+\.[a-z]{2,})/i.test(u) ? "http://" + u : SEARCH + "?q=" + encodeURIComponent(u)
      setUrl(u)
      setAddr(u)
      setFrameFailed(false)
      setLoading(true)
      setTimeout(() => setLoading(false), 700)
      if (push) {
        const h = [...hist.slice(0, hi + 1), u]
        setHist(h)
        setHi(h.length - 1)
      }
    },
    [hist, hi],
  )

  useEffect(() => {
    const u = win.props.url as string | undefined
    if (u && u !== "search" && u !== url) go(u)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.props.url])

  const query = (() => {
    try {
      return new URL(url).searchParams.get("q") ?? ""
    } catch {
      return ""
    }
  })()
  const page = useMemo(() => internalPage(url, query, go), [url, query, go])
  const isFile = url.startsWith("file:///")
  const fileContent = isFile ? fs.readFile(url.slice(8).replace(/\//g, "\\")) : null

  const title = page?.title ?? (isFile ? fs.basename(url.slice(8).replace(/\//g, "\\")) : url)
  useEffect(() => {
    wm.setTitle(win.id, `${title} - Microsoft Internet Explorer`)
  }, [title, win.id])

  const favorites = fs.list("C:\\WINDOWS\\FAVORITES").filter((n): n is FSNode & { type: "file" } => n.type === "file")

  const addFavorite = async () => {
    const name = await wm.prompt({ parentId: win.id, title: "Add To Favorites", label: "Name:", value: title.replace(/[\\/:*?"<>|]/g, "") })
    if (!name) return
    fs.writeFile(`C:\\WINDOWS\\FAVORITES\\${name}.url`, `[InternetShortcut]\nURL=${url}\n`, { url })
  }

  const menus = [
    { label: "&File", items: [{ label: "&New Window", accel: "Ctrl+N", onClick: () => launch("iexplore", { url }) }, { label: "&Open...", accel: "Ctrl+O", onClick: async () => { const u = await wm.prompt({ parentId: win.id, title: "Open", label: "Open:", value: url }); if (u) go(u) } }, { label: "&Save As...", disabled: true }, { sep: true }, { label: "&Print...", onClick: () => window.print() }, { sep: true }, { label: "&Properties", onClick: () => wm.msgBox({ parentId: win.id, title: "Properties", text: `${title}\n\nProtocol: ${url.split(":")[0]}\nType: HTML Document\nAddress (URL): ${url}`, icon: "none" }) }, { sep: true }, { label: "&Close", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "Cu&t", disabled: true }, { label: "&Copy", onClick: () => document.execCommand("copy") }, { label: "&Paste", disabled: true }, { sep: true }, { label: "Select &All" }, { label: "&Find (on this page)...", accel: "Ctrl+F", disabled: true }] },
    { label: "&View", items: [{ label: "&Toolbar", checked: true }, { label: "&Status Bar", checked: true }, { label: "&Links", checked: showLinks, onClick: () => setShowLinks(!showLinks) }, { sep: true }, { label: "&Fonts", items: [{ label: "Largest" }, { label: "Large" }, { label: "Medium", checked: true, radio: true }, { label: "Small" }, { label: "Smallest" }] }, { label: "Stop", accel: "Esc", onClick: () => setLoading(false) }, { label: "&Refresh", accel: "F5", onClick: () => go(url, false) }, { sep: true }, { label: "Sou&rce", onClick: () => launch("notepad", { path: "C:\\WINDOWS\\README.TXT" }) }, { label: "&Options...", onClick: () => launch("cpl", { applet: "internet" }) }] },
    { label: "&Go", items: [{ label: "&Back", accel: "Alt+Left", disabled: hi === 0, onClick: () => { setHi(hi - 1); go(hist[hi - 1], false) } }, { label: "&Forward", accel: "Alt+Right", disabled: hi >= hist.length - 1, onClick: () => { setHi(hi + 1); go(hist[hi + 1], false) } }, { sep: true }, { label: "&Start Page", onClick: () => go(HOME) }, { label: "Search the &Web", onClick: () => go(SEARCH) }, { label: "&Read Mail", onClick: () => launch("exchange") }, { sep: true }, ...hist.slice(-8).map((h, i) => ({ label: `&${i + 1} ${h.length > 40 ? h.slice(0, 40) + "…" : h}`, checked: h === url, onClick: () => go(h) })), { sep: true }, { label: "Open &History Folder", onClick: () => launch("explorer", { path: "C:\\WINDOWS\\HISTORY" }) }] },
    { label: "F&avorites", items: () => [{ label: "&Add To Favorites...", onClick: addFavorite }, { label: "&Organize Favorites...", onClick: () => launch("explorer", { path: "C:\\WINDOWS\\FAVORITES" }) }, { sep: true }, ...(favorites.length ? favorites.map((f) => ({ label: f.name.replace(/\.url$/i, ""), icon: "html" as IconName, onClick: () => f.url && go(f.url) })) : [{ label: "(Empty)", disabled: true }])] },
    { label: "&Help", items: [{ label: "&Help Topics", onClick: () => launch("help", { topic: "internet" }) }, { label: "&Microsoft on the Web", items: [{ label: "Free Stuff", disabled: true }, { label: "Product News", disabled: true }] }, { sep: true }, { label: "&About Internet Explorer", onClick: () => wm.msgBox({ parentId: win.id, title: "About Internet Explorer", text: "Microsoft Internet Explorer 3.0\nVersion 4.70.1155\n\nBased on NCSA Mosaic. NCSA Mosaic(TM); was developed at the National Center for Supercomputing Applications at the University of Illinois at Urbana-Champaign.\n\nCopyright © 1995-1996 Microsoft Corp.", icon: "none" }) }] },
  ]

  const TB = ({ title: t, onClick, children, disabled }: { title: string; onClick?: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" className="tbtn" title={t} onClick={onClick} disabled={disabled} style={{ width: 44, height: 38, flexDirection: "column", gap: 2, fontSize: 9 }}>
      {children}
      <span>{t}</span>
    </button>
  )

  return (
    <>
      <MenuBar menus={menus} />
      <div className="toolbar" style={{ padding: "2px 4px" }}>
        <TB title="Back" disabled={hi === 0} onClick={() => { setHi(hi - 1); go(hist[hi - 1], false) }}><span style={{ fontSize: 14 }}>←</span></TB>
        <TB title="Forward" disabled={hi >= hist.length - 1} onClick={() => { setHi(hi + 1); go(hist[hi + 1], false) }}><span style={{ fontSize: 14 }}>→</span></TB>
        <TB title="Stop" onClick={() => setLoading(false)}><img src={iconUrl("no", 16)} alt="" /></TB>
        <TB title="Refresh" onClick={() => go(url, false)}><img src={iconUrl("history", 16)} alt="" /></TB>
        <TB title="Home" onClick={() => go(HOME)}><img src={iconUrl("homepage", 16)} alt="" /></TB>
        <div className="tsep" />
        <TB title="Search" onClick={() => go(SEARCH)}><img src={iconUrl("search_computer", 16)} alt="" /></TB>
        <TB title="Favorites" onClick={() => launch("explorer", { path: "C:\\WINDOWS\\FAVORITES" })}><img src={iconUrl("directory_favorites", 16)} alt="" /></TB>
        <TB title="Print" onClick={() => window.print()}><img src={iconUrl("printer", 16)} alt="" /></TB>
        <TB title="Font"><span style={{ fontSize: 13, fontFamily: "serif" }}>A</span></TB>
        <TB title="Mail" onClick={() => launch("exchange")}><img src={iconUrl("envelope_closed", 16)} alt="" /></TB>
        <div style={{ flex: 1 }} />
        <div style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", boxShadow: "var(--sunken)" }}>
          <img src={iconUrl("msie1", 32)} alt="" style={{ width: 28, height: 28, animation: loading ? "spin 1s linear infinite" : undefined }} />
        </div>
      </div>
      <div className="combo" style={{ boxShadow: "var(--groove)", padding: "3px 4px" }}>
        <span>Address:</span>
        <div className="field" style={{ flex: 1, padding: "1px 2px" }}>
          <img src={iconUrl("html", 16)} alt="" />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go(addr)} style={{ flex: 1, border: 0, outline: 0, background: "transparent", font: "inherit", color: "inherit" }} />
        </div>
      </div>
      {showLinks && (
        <div className="combo" style={{ boxShadow: "var(--groove)", padding: "2px 4px", gap: 10 }}>
          <span>Links:</span>
          {[["Home", HOME], ["About", HOME + "about"], ["Software", HOME + "software"], ["Contact", HOME + "contact"], ["Search", SEARCH]].map(([l, u]) => (
            <a key={l} href="#" onClick={(e) => { e.preventDefault(); go(u) }} style={{ color: "var(--window-text)", display: "flex", alignItems: "center", gap: 3 }}>
              <img src={iconUrl("html", 16)} alt="" />
              {l}
            </a>
          ))}
        </div>
      )}
      <div className="ie-page w95-scroll">
        {page ? (
          page.node
        ) : isFile ? (
          <pre className="webpage" style={{ whiteSpace: "pre-wrap", fontFamily: "Courier New, monospace", fontSize: 12 }}>{fileContent ?? "File not found."}</pre>
        ) : (
          <>
            {!frameFailed && (
              <iframe
                src={url}
                title={url}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                onError={() => setFrameFailed(true)}
              />
            )}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--info)", borderTop: "1px solid #000", padding: "4px 8px", fontSize: 11, display: "flex", gap: 10, alignItems: "center" }}>
              <img src={iconUrl("msg_information", 16)} alt="" />
              <span>Many modern sites refuse to load inside Internet Explorer 3.0. </span>
              <a href={url} target="_blank" rel="noreferrer">Open {url.length > 40 ? url.slice(0, 40) + "…" : url} in a new window</a>
            </div>
          </>
        )}
      </div>
      <StatusBar cells={[loading ? `Opening page ${url}...` : "Done", page ? "Internet zone" : ""]} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}

registerApp({ id: "iexplore", name: "Internet Explorer", icon: "msie1", component: InternetExplorer, width: 700, height: 520, minW: 400, minH: 300, exe: "IEXPLORE.EXE", startMenu: ["Programs"], title: () => "Microsoft Internet Explorer" })
