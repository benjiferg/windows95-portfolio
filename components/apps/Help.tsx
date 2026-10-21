"use client"

import React, { useEffect, useMemo, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { profile, software } from "@/lib/win95/portfolio"
import { openPath } from "@/lib/win95/shell"
import { icon as iconUrl } from "@/lib/win95/icons"
import { MenuBar } from "@/components/win95/Menu"
import { Button, Tabs, TextInput } from "@/components/win95/controls"

/* ------------------------------------------------------------------ */
/*  Windows Help — contents are about Benjamin and this desktop         */
/* ------------------------------------------------------------------ */

interface Topic {
  id: string
  title: string
  body: React.ReactNode
}
interface Book {
  title: string
  topics: Topic[]
}

function Shortcut({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <p>
      <button type="button" onClick={onClick} style={{ background: "transparent", border: 0, padding: 0, display: "inline-flex", alignItems: "center", gap: 6, color: "#000", cursor: "pointer", font: "inherit" }}>
        <img src={iconUrl("file_win_shortcut", 16)} alt="" style={{ width: 16, height: 16 }} />
        <span>{label}</span>
      </button>
    </p>
  )
}

function buildBooks(): Book[] {
  return [
    {
      title: "Introducing Windows",
      topics: [
        {
          id: "welcome",
          title: "Welcome",
          body: (
            <>
              <h1>Welcome to {profile.name}&apos;s desktop</h1>
              <p>This is a recreation of Windows 95, built as a portfolio. Everything works: the Start menu, the file system, the MS-DOS Prompt, and the accessories.</p>
              <p>Use the Contents on the left to learn more, or jump straight in:</p>
              <Shortcut label={`Open ${profile.firstName}'s software folder`} onClick={() => launch("explorer", { path: `C:\\Program Files\\${profile.company ?? "Software"}` })} />
              <Shortcut label="Read README.TXT" onClick={() => openPath("C:\\My Documents\\README.TXT")} />
              <Shortcut label="Open the MS-DOS Prompt" onClick={() => launch("dos")} />
            </>
          ),
        },
        {
          id: "tour",
          title: "Ten minutes to using Windows",
          body: (
            <>
              <h1>Ten minutes to using Windows</h1>
              <p><b>Starting a program:</b> Click the Start button, point to Programs, and click the program you want.</p>
              <p><b>Switching between windows:</b> Click a button on the taskbar at the bottom of the screen.</p>
              <p><b>Moving a window:</b> Drag its title bar. <b>Resizing:</b> drag any edge or corner.</p>
              <p><b>Closing a window:</b> Click the × button in the top-right corner, or press Alt+F4.</p>
              <p><b>Shutting down:</b> Click Start, then Shut Down.</p>
              <p><b>Right-click</b> almost anything for a shortcut menu, including the desktop, files and the taskbar.</p>
            </>
          ),
        },
        {
          id: "whatsnew",
          title: "What's new in this edition",
          body: (
            <>
              <h1>What&apos;s new in the Portfolio Edition</h1>
              <ul>
                <li>A working MS-DOS Prompt with over 50 commands (type <b>HELP</b>).</li>
                <li>A persistent C: drive. Files you create in Notepad, Paint or WordPad stay on this computer.</li>
                <li>Display Properties: wallpaper, patterns, color schemes and screen savers.</li>
                <li>Games: Solitaire, FreeCell (real game numbers), Minesweeper and Hearts.</li>
                <li>HyperTerminal dials into {profile.firstName}&apos;s BBS. Internet Explorer has a home page.</li>
                <li>Microsoft Exchange sends real e-mail to {profile.firstName}.</li>
              </ul>
            </>
          ),
        },
      ],
    },
    {
      title: profile.name,
      topics: [
        {
          id: "about",
          title: `About ${profile.firstName}`,
          body: (
            <>
              <h1>{profile.name}</h1>
              <p><i>{profile.title}</i></p>
              {profile.bio.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
              <p><b>Skills:</b> {profile.skills.join(", ")}</p>
              <Shortcut label="Open About Benjamin.txt" onClick={() => openPath("C:\\My Documents\\About Benjamin.txt")} />
              <Shortcut label="Open the resume in WordPad" onClick={() => openPath("C:\\My Documents\\Resume.doc")} />
            </>
          ),
        },
        ...software.map<Topic>((s) => ({
          id: "sw-" + s.slug,
          title: s.name,
          body: (
            <>
              <h1>{s.name}{s.version ? ` ${s.version}` : ""}</h1>
              <p><i>{s.tagline}</i></p>
              {s.description.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
              {s.features?.length ? <ul>{s.features.map((f) => <li key={f}>{f}</li>)}</ul> : null}
              {s.tags?.length ? <p><b>Built with:</b> {s.tags.join(", ")}</p> : null}
              <Shortcut label={`Open ${s.name}`} onClick={() => launch("sw:" + s.slug)} />
              {s.website && <Shortcut label="Visit the website" onClick={() => window.open(s.website, "_blank", "noopener")} />}
            </>
          ),
        })),
        {
          id: "contact",
          title: "Contacting " + profile.firstName,
          body: (
            <>
              <h1>Contacting {profile.firstName}</h1>
              <p>E-mail: <a href={`mailto:${profile.email}`}>{profile.email}</a></p>
              <ul>{profile.links.filter((l) => !l.url.startsWith("mailto:")).map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul>
              <Shortcut label="Compose a message in Microsoft Exchange" onClick={() => launch("exchange", { compose: true })} />
            </>
          ),
        },
        {
          id: "howbuilt",
          title: "How this site was built",
          body: (
            <>
              <h1>How this site was built</h1>
              <p>This desktop is a web application. It runs entirely in your browser with no server behind it.</p>
              <ul>
                <li><b>Window manager</b>: draggable, resizable windows with a real z-order, minimize, maximize and modal dialogs.</li>
                <li><b>File system</b>: a virtual C: drive shared by Explorer, the DOS prompt, Notepad, Paint and WordPad, saved in your browser.</li>
                <li><b>MS-DOS Prompt</b>: a command interpreter with DIR, CD, COPY, batch files, redirection and more.</li>
                <li><b>Pixel-accurate UI</b>: 8pt MS Sans Serif, 3D bevels, the teal desktop, 16px scrollbars.</li>
                <li><b>Sounds</b>: synthesized in the browser, so no copyrighted samples are used.</li>
              </ul>
              <Shortcut label="View system information" onClick={() => launch("cpl", { applet: "system" })} />
            </>
          ),
        },
      ],
    },
    {
      title: "How To...",
      topics: [
        { id: "runprograms", title: "Run programs", body: <><h1>Run programs</h1><p>Click <b>Start</b>, point to <b>Programs</b>, then click a program. You can also click Start, then <b>Run...</b> and type a name such as <b>notepad</b>, <b>calc</b>, <b>sol</b> or <b>winmine</b>.</p><Shortcut label="Open the Run dialog" onClick={() => launch("run")} /></> },
        { id: "files", title: "Work with files and folders", body: <><h1>Work with files and folders</h1><p>Double-click <b>My Computer</b> on the desktop to browse drives. Right-click a file for Cut, Copy, Delete, Rename and Properties. Deleted files go to the <b>Recycle Bin</b>, where they can be restored.</p><p>Right-click an empty area of a folder and point to <b>New</b> to create a folder, text document, bitmap or WordPad document.</p><Shortcut label="Open My Documents" onClick={() => launch("explorer", { path: "C:\\My Documents" })} /><Shortcut label="Open Windows Explorer" onClick={() => launch("explorer", { path: "C:\\", tree: true })} /></> },
        { id: "dos", title: "Use the MS-DOS Prompt", body: <><h1>Use the MS-DOS Prompt</h1><p>Type <b>HELP</b> for a list of commands. Useful ones: <b>DIR</b>, <b>CD</b>, <b>TYPE README.TXT</b>, <b>TREE</b>, <b>MEM</b>, <b>VER</b>.</p><p>{profile.firstName}&apos;s commands: <b>ABOUT</b>, <b>SOFTWARE</b>, <b>OPEN &lt;name&gt;</b>, <b>CONTACT</b>, <b>README</b>.</p><p>Redirect output with <b>&gt;</b>: <code>DIR &gt; LIST.TXT</code>. Press Tab to complete file names, ↑ for history, Ctrl+C to cancel.</p><Shortcut label="Open the MS-DOS Prompt" onClick={() => launch("dos")} /></> },
        { id: "display", title: "Change how the desktop looks", body: <><h1>Change how the desktop looks</h1><p>Right-click the desktop and click <b>Properties</b>. Use the <b>Background</b> tab for wallpaper and patterns, <b>Appearance</b> for color schemes (try Rainy Day or Pumpkin) and <b>Screen Saver</b> to pick one and set the wait time.</p><p>In Paint, use <b>File &gt; Set As Wallpaper</b> to use your own drawing.</p><Shortcut label="Open Display Properties" onClick={() => launch("display")} /></> },
        { id: "games", title: "Play games", body: <><h1>Play games</h1><p>Click Start, Programs, Accessories, Games.</p><ul><li><b>Solitaire</b>: drag cards; double-click to send to a suit stack. Options for Draw Three and Vegas scoring.</li><li><b>FreeCell</b>: click a card, then click where it goes. Game numbers match the original.</li><li><b>Minesweeper</b>: left-click to uncover, right-click to flag, double-click a number to chord.</li><li><b>Hearts</b>: pass three cards, then avoid taking hearts and the Queen of Spades.</li></ul><Shortcut label="Play Solitaire" onClick={() => launch("solitaire")} /><Shortcut label="Play Minesweeper" onClick={() => launch("minesweeper")} /></> },
        { id: "shutdown", title: "Shut down the computer", body: <><h1>Shut down the computer</h1><p>Click Start, then Shut Down. You can shut down, restart, or restart in MS-DOS mode (type <b>WIN</b> or <b>EXIT</b> to come back). After shutting down, click anywhere to turn the computer back on.</p></> },
      ],
    },
    {
      title: "Tips and Tricks",
      topics: profile.tips.map<Topic>((t, i) => ({ id: "tip" + i, title: t.length > 50 ? t.slice(0, 50) + "..." : t, body: <><h1>Tip</h1><p>{t}</p></> })),
    },
    {
      title: "Troubleshooting",
      topics: [
        { id: "ts-sound", title: "If you don't hear any sounds", body: <><h1>If you don&apos;t hear any sounds</h1><p>Browsers only allow sound after you click something. Click the desktop once, then check the speaker icon in the taskbar isn&apos;t muted. Sounds can be turned off in Control Panel &gt; Sounds.</p></> },
        { id: "ts-reset", title: "If you want to start over", body: <><h1>If you want to start over</h1><p>Files and settings are stored in your browser. To restore everything to how it shipped, open the MS-DOS Prompt and type <b>DELTREE C:\WINDOWS\TEMP</b> ... just kidding. Use the button below.</p><Shortcut label="Reset files and settings (reloads the page)" onClick={async () => { const r = await wm.msgBox({ title: "Reset", text: "This will delete files you created and restore the default settings. Continue?", icon: "warning", buttons: ["Yes", "No"] }); if (r === "Yes") { localStorage.clear(); location.reload() } }} /></> },
        { id: "ts-web", title: "If a web page won't open in Internet Explorer", body: <><h1>If a web page won&apos;t open</h1><p>Most modern sites refuse to be shown inside another page. Internet Explorer offers a link to open the site in a new browser window instead.</p></> },
      ],
    },
  ]
}

export function Help({ win }: AppProps) {
  const books = useMemo(buildBooks, [])
  const all = useMemo(() => books.flatMap((b) => b.topics), [books])
  const [tab, setTab] = useState(0)
  const [open, setOpen] = useState<Set<string>>(() => new Set([books[0].title, books[1].title]))
  const [topic, setTopic] = useState<Topic>(() => {
    const t = win.props.topic as string | undefined
    const map: Record<string, string> = { notepad: "files", calc: "runprograms", paint: "display", wordpad: "files", explorer: "files", minesweeper: "games", solitaire: "games", freecell: "games", hearts: "games", shutdown: "shutdown", find: "files", multimedia: "runprograms", comms: "runprograms", exchange: "contact", internet: "ts-web", systools: "files" }
    return all.find((x) => x.id === (t ? map[t] ?? t : "welcome")) ?? all[0]
  })
  const [q, setQ] = useState("")

  useEffect(() => {
    wm.setTitle(win.id, "Windows Help")
  }, [win.id])

  const indexList = all.filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title))

  const menus = [
    { label: "&File", items: [{ label: "&Open...", disabled: true }, { label: "&Print Topic...", onClick: () => window.print() }, { sep: true }, { label: "E&xit", onClick: () => wm.close(win.id) }] },
    { label: "&Edit", items: [{ label: "&Copy", onClick: () => document.execCommand("copy") }, { label: "&Annotate...", disabled: true }] },
    { label: "&Bookmark", items: [{ label: "&Define...", disabled: true }] },
    { label: "&Options", items: [{ label: "&Keep Help on Top", items: [{ label: "&Default", radio: true, checked: true }, { label: "&On Top", radio: true }, { label: "&Not On Top", radio: true }] }, { label: "&Font", items: [{ label: "&Small", radio: true }, { label: "&Normal", radio: true, checked: true }, { label: "&Large", radio: true }] }, { label: "&Use System Colors", checked: true }] },
    { label: "&Help", items: [{ label: "&Version...", onClick: () => wm.msgBox({ parentId: win.id, title: "Version", text: "Windows Help\nVersion 4.00.950\n\nCopyright © 1990-1995 Microsoft Corp.", icon: "none" }) }] },
  ]

  return (
    <>
      <MenuBar menus={menus} />
      <div className="toolbar">
        <Button className="sm" onClick={() => setTab(0)}>Help &Topics</Button>
        <Button className="sm" onClick={() => setTopic(all[Math.max(0, all.indexOf(topic) - 1)])} disabled={all.indexOf(topic) === 0}>&Back</Button>
        <Button className="sm" onClick={() => window.print()}>&Print</Button>
        <Button className="sm" onClick={() => setTopic(all[all.indexOf(topic) + 1])} disabled={all.indexOf(topic) >= all.length - 1}>&gt;&gt;</Button>
      </div>
      <div className="help-body" style={{ padding: "2px 0 0" }}>
        <div className="col" style={{ width: 230, flex: "0 0 230px", marginRight: 3 }}>
          <Tabs tabs={["Contents", "Index", "Find"]} active={tab} onChange={setTab} />
          <div className="tab-page col" style={{ flex: 1, padding: 4, minHeight: 0 }}>
            {tab === 0 && (
              <div className="explorer-tree w95-scroll" style={{ flex: 1, width: "auto", margin: 0 }}>
                {books.map((b) => (
                  <React.Fragment key={b.title}>
                    <div className="help-topic" onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(b.title)) n.delete(b.title); else n.add(b.title); return n })}>
                      <img src={iconUrl(open.has(b.title) ? "help_book_cool" : "help_book_small", 16)} alt="" />
                      <span>{b.title}</span>
                    </div>
                    {open.has(b.title) && b.topics.map((t) => (
                      <div key={t.id} className={`help-topic ${topic.id === t.id ? "sel" : ""}`} style={{ paddingLeft: 20, background: topic.id === t.id ? "var(--highlight)" : undefined, color: topic.id === t.id ? "var(--highlight-text)" : undefined }} onClick={() => setTopic(t)}>
                        <img src={iconUrl("help_sheet", 16)} alt="" />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}
            {tab !== 0 && (
              <>
                <div style={{ marginBottom: 2 }}>{tab === 1 ? "1 Type the first few letters of the word you're looking for." : "1 Type the word(s) you want to find"}</div>
                <TextInput value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 4 }} />
                <div style={{ marginBottom: 2 }}>2 Click the index entry you want, and then click Display.</div>
                <div className="listbox w95-scroll" style={{ flex: 1 }}>
                  {indexList.map((t) => (
                    <div key={t.id} className={`li ${topic.id === t.id ? "sel" : ""}`} onClick={() => setTopic(t)} onDoubleClick={() => setTopic(t)}>{t.title}</div>
                  ))}
                </div>
                <div className="dlg-buttons" style={{ paddingTop: 4 }}><Button className="sm" onClick={() => {}}>&Display</Button></div>
              </>
            )}
          </div>
        </div>
        <div className="help-content w95-scroll">{topic.body}</div>
      </div>
    </>
  )
}

registerApp({
  id: "help",
  name: "Help",
  icon: "help_book_big",
  component: Help,
  width: 640,
  height: 440,
  minW: 420,
  minH: 260,
  singleton: true,
  exe: "WINHLP32.EXE",
})
