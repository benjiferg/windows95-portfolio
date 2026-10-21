"use client"

import React, { useEffect, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { profile, software, type Software } from "@/lib/win95/portfolio"
import type { IconName } from "@/lib/win95/icons"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Checkbox, Icon, Progress, StatusBar, Tabs } from "@/components/win95/controls"
import { sounds } from "@/lib/win95/sounds"

/* ------------------------------------------------------------------ */
/*  One program window per piece of software in portfolio.ts            */
/* ------------------------------------------------------------------ */

function openExternal(url?: string) {
  if (url) window.open(url, "_blank", "noopener,noreferrer")
}

function SoftwareApp({ win, sw }: AppProps & { sw: Software }) {
  const [tab, setTab] = useState(0)
  const [shot, setShot] = useState(0)
  const tabs = ["About", ...(sw.screenshots?.length ? ["Screenshots"] : []), "Links"]

  const menus = [
    {
      label: "&File",
      items: [
        ...(sw.website ? [{ label: "&Visit Website", onClick: () => openExternal(sw.website) }] : []),
        ...(sw.download ? [{ label: "&Download", onClick: () => openExternal(sw.download) }] : []),
        ...(sw.source ? [{ label: "View &Source Code", onClick: () => openExternal(sw.source) }] : []),
        { sep: true },
        { label: "Open in &Internet Explorer", onClick: () => launch("iexplore", { url: `http://www.benjaminferguson.home/software/${sw.slug}` }) },
        { label: "Open program &folder", onClick: () => launch("explorer", { path: `C:\\Program Files\\${profile.company ?? "Software"}\\${sw.name}` }) },
        { sep: true },
        { label: "E&xit", onClick: () => wm.close(win.id) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Help Topics", onClick: () => launch("help", { topic: "sw-" + sw.slug }) },
        { sep: true },
        { label: `&About ${sw.name}`, onClick: () => wm.msgBox({ parentId: win.id, title: `About ${sw.name}`, text: `${sw.name}${sw.version ? " " + sw.version : ""}\n${sw.tagline}\n\nCopyright © ${sw.year ?? new Date().getFullYear()} ${profile.name}\n\nThis product is licensed to:\n${profile.name}`, icon: "none" }) },
      ],
    },
  ]

  const tabName = tabs[tab]

  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ flex: 1, padding: 6, minHeight: 0 }}>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="tab-page col" style={{ flex: 1, minHeight: 0, padding: 0 }}>
          {tabName === "About" && (
            <div className="sw-page w95-scroll" style={{ boxShadow: "none" }}>
              <div className="sw-head">
                <img src={sw.logo} alt="" />
                <div>
                  <h1>
                    {sw.name}
                    {sw.version && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>version {sw.version}</span>}
                  </h1>
                  <p>{sw.tagline}</p>
                  {sw.year && <p>Released {sw.year}</p>}
                </div>
              </div>
              <div className="hr" />
              {sw.description.split("\n\n").map((p, i) => (
                <p key={i} style={{ margin: "0 0 8px" }}>
                  {p}
                </p>
              ))}
              {sw.features?.length ? (
                <>
                  <b>Features</b>
                  <ul style={{ margin: "4px 0 10px 18px", padding: 0 }}>
                    {sw.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {sw.tags?.length ? (
                <div style={{ marginTop: 6 }}>
                  {sw.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          {tabName === "Screenshots" && sw.screenshots && (
            <div className="col" style={{ flex: 1, minHeight: 0, padding: 8, gap: 6 }}>
              <div className="paint-canvas w95-scroll" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                <img src={sw.screenshots[shot]} alt="" style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "auto", border: "1px solid #000" }} />
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Button className="sm" disabled={shot === 0} onClick={() => setShot(shot - 1)}>
                  &lt; &Previous
                </Button>
                <span>
                  {shot + 1} of {sw.screenshots.length}
                </span>
                <Button className="sm" disabled={shot >= sw.screenshots.length - 1} onClick={() => setShot(shot + 1)}>
                  &Next &gt;
                </Button>
              </div>
            </div>
          )}
          {tabName === "Links" && (
            <div className="col" style={{ padding: 14, gap: 10 }}>
              {sw.website && (
                <div className="row gap8">
                  <Icon name="html" />
                  <div style={{ flex: 1 }}>
                    <b>Website</b>
                    <br />
                    <span className="gray">{sw.website}</span>
                  </div>
                  <Button onClick={() => openExternal(sw.website)}>&Visit</Button>
                </div>
              )}
              {sw.download && (
                <div className="row gap8">
                  <Icon name="installer" />
                  <div style={{ flex: 1 }}>
                    <b>Download</b>
                    <br />
                    <span className="gray">{sw.download}</span>
                  </div>
                  <Button onClick={() => openExternal(sw.download)}>&Download</Button>
                </div>
              )}
              {sw.source && (
                <div className="row gap8">
                  <Icon name="executable_script" />
                  <div style={{ flex: 1 }}>
                    <b>Source code</b>
                    <br />
                    <span className="gray">{sw.source}</span>
                  </div>
                  <Button onClick={() => openExternal(sw.source)}>&Browse</Button>
                </div>
              )}
              {!sw.website && !sw.download && !sw.source && <div className="gray">No links yet.</div>}
              <div className="hr" />
              <div className="row gap8">
                <Icon name="envelope_closed" />
                <div style={{ flex: 1 }}>
                  <b>Questions about {sw.name}?</b>
                  <br />
                  <span className="gray">{profile.email}</span>
                </div>
                <Button onClick={() => launch("exchange", { compose: true, attach: sw.name })}>&E-mail</Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <StatusBar cells={[`${sw.name} - ${profile.name}`, sw.size ?? ""]} />
    </>
  )
}

for (const sw of software) {
  registerApp({
    id: "sw:" + sw.slug,
    name: sw.name,
    icon: sw.logo as IconName,
    component: (props: AppProps) => <SoftwareApp {...props} sw={sw} />,
    width: 520,
    height: 420,
    minW: 360,
    minH: 260,
    singleton: true,
    exe: sw.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) + ".EXE",
    startMenu: ["Programs", profile.company ?? "Software"],
  })
}

/* ------------------------------------------------------------------ */
/*  D:\SETUP.EXE — portfolio installer                                  */
/* ------------------------------------------------------------------ */

function Setup({ win }: AppProps) {
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState<Set<string>>(() => new Set(software.map((s) => s.slug)))
  const [pct, setPct] = useState(0)
  const [file, setFile] = useState("")

  useEffect(() => {
    if (step !== 3) return
    let i = 0
    const files = software.flatMap((s) => (sel.has(s.slug) ? [`${s.name}\\${s.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8)}.EXE`, `${s.name}\\README.TXT`, `${s.name}\\${s.slug.toUpperCase()}.DLL`] : [])).concat(["SHELL32.DLL", "PORTFOLIO.INF", "UNINST.EXE"])
    const iv = setInterval(() => {
      i++
      setPct(Math.min(100, Math.round((i / (files.length * 4)) * 100)))
      setFile(files[Math.min(files.length - 1, Math.floor(i / 4))])
      if (i >= files.length * 4) {
        clearInterval(iv)
        setTimeout(() => {
          sounds.tada()
          setStep(4)
        }, 400)
      }
    }, 120)
    return () => clearInterval(iv)
  }, [step, sel])

  const pages = [
    <>
      <div style={{ fontWeight: 700, fontSize: 12 }}>Welcome to the {profile.name} Portfolio Setup program.</div>
      <div>This program will install {profile.firstName}&apos;s software on your computer.</div>
      <div>It is strongly recommended that you exit all Windows programs before running this Setup program.</div>
      <div className="gray">Click Cancel to quit Setup and then close any programs you have running. Click Next to continue with the Setup program.</div>
      <div className="gray" style={{ fontSize: 10 }}>WARNING: This program is protected by copyright law and international treaties. Unauthorized reproduction or distribution of this program, or any portion of it, may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under law.</div>
    </>,
    <>
      <div style={{ fontWeight: 700 }}>Choose Destination Location</div>
      <div>Setup will install the software in the following folder.</div>
      <div className="field" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="directory_closed" size={16} />
        C:\Program Files\{profile.company ?? "Software"}
      </div>
      <Button className="sm" style={{ alignSelf: "flex-end" }} disabled>
        B&rowse...
      </Button>
    </>,
    <>
      <div style={{ fontWeight: 700 }}>Select Components</div>
      <div>Select the components you want to install, clear the components you do not want to install.</div>
      <div className="listbox w95-scroll" style={{ flex: 1, minHeight: 90 }}>
        {software.length ? (
          software.map((s) => (
            <div key={s.slug} className="li" style={{ justifyContent: "space-between" }}>
              <Checkbox label={s.name} checked={sel.has(s.slug)} onChange={(v) => setSel((x) => { const n = new Set(x); if (v) n.add(s.slug); else n.delete(s.slug); return n })} />
              <span>{s.size ?? "1.2 MB"}</span>
            </div>
          ))
        ) : (
          <div className="gray" style={{ padding: 6 }}>No components on this disc yet.</div>
        )}
      </div>
      <div className="row" style={{ justifyContent: "space-between", fontSize: 10 }}>
        <span>Space Required: {software.filter((s) => sel.has(s.slug)).length * 1.2 || 0} MB</span>
        <span>Space Available: 1,540 MB</span>
      </div>
    </>,
    <>
      <div style={{ fontWeight: 700 }}>Copying program files...</div>
      <div className="gray" style={{ minHeight: 14 }}>{file}</div>
      <Progress value={pct} />
      <div className="center">{pct}%</div>
    </>,
    <>
      <div style={{ fontWeight: 700, fontSize: 12 }}>Setup Complete</div>
      <div>Setup has finished installing {profile.firstName}&apos;s software on your computer.</div>
      <Checkbox label="Yes, I want to view the program folder now." checked onChange={() => {}} />
      <Checkbox label="Yes, I want to read the README file." checked={false} onChange={() => {}} />
      <div>Click Finish to complete Setup.</div>
    </>,
  ]

  return (
    <div className="col" style={{ flex: 1 }}>
      <div className="row" style={{ flex: 1, alignItems: "stretch", minHeight: 0 }}>
        <div style={{ width: 140, background: "linear-gradient(#000080, #1084d0)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 10, color: "#fff", textAlign: "center", fontFamily: "Arial, sans-serif", fontWeight: 700 }}>
          <Icon name="installer" />
          <div>{profile.name}</div>
          <div style={{ fontWeight: 400, fontSize: 10 }}>Portfolio Setup</div>
        </div>
        <div className="col gap8" style={{ flex: 1, padding: 14, minHeight: 0 }}>{pages[step]}</div>
      </div>
      <div className="dlg-buttons" style={{ padding: 10, borderTop: "1px solid var(--shadow)" }}>
        <Button disabled={step === 0 || step === 3 || step === 4} onClick={() => setStep(step - 1)}>
          &lt; &Back
        </Button>
        {step < 3 && (
          <Button isDefault onClick={() => setStep(step + 1)}>
            &Next &gt;
          </Button>
        )}
        {step === 4 && (
          <Button
            isDefault
            onClick={() => {
              wm.close(win.id)
              launch("explorer", { path: `C:\\Program Files\\${profile.company ?? "Software"}` })
            }}
          >
            Finish
          </Button>
        )}
        <Button disabled={step === 3} onClick={() => wm.close(win.id)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

registerApp({ id: "setup", name: "Setup", icon: "installer", component: Setup, width: 480, height: 320, resizable: false, maximizable: false, singleton: true, exe: "SETUP.EXE", title: () => `${profile.name} Portfolio Setup` })
