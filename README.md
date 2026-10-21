# Benjamin Ferguson — Windows 95 portfolio

A working recreation of the Windows 95 desktop that doubles as a software portfolio. Everything runs in the browser: the Start menu, a persistent virtual C: drive, an MS-DOS Prompt with a real command interpreter, and the applications that shipped with Windows 95.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build && pnpm start
pnpm typecheck  # tsc --noEmit
```

## Add your software

Edit **`lib/win95/portfolio.ts`**. It is the only file you need to touch.

1. Put the logo (and any screenshots) in `public/software/<slug>/`.
2. Add an entry to the `software` array:

```ts
{
  slug: "taskflow",                       // used by `start taskflow` in DOS
  name: "TaskFlow",
  tagline: "Keyboard-first task manager",
  description: "What it does and why you built it.\n\nBlank lines make paragraphs.",
  logo: "/software/taskflow/logo.png",    // square, 32px or larger
  version: "2.1",
  year: "2024",
  tags: ["TypeScript", "Electron"],
  features: ["Offline-first", "Vim keys", "Sync"],
  screenshots: ["/software/taskflow/shot1.png"],
  website: "https://taskflow.example",
  download: "https://taskflow.example/download",
  source: "https://github.com/you/taskflow",
  size: "4.2 MB",
},
```

Each entry automatically becomes: a program window (About / Screenshots / Links tabs), an item under **Start ▸ Programs ▸ Benjamin Ferguson Software**, a folder in `C:\Program Files\`, a line in **Add/Remove Programs**, a track in CD Player, a page on the Internet Explorer home page, a Help topic, a BBS download in HyperTerminal, and a `start <slug>` / `open <slug>` command in the MS-DOS Prompt.

The same file holds the `profile` block (name, title, bio, skills, links, Welcome-screen tips). Those feed README.TXT, About Benjamin.txt, Resume.doc, the IE home page, Windows Help, System Properties and the DOS `ABOUT` / `CONTACT` commands.

## What's inside

| Area | Files |
|------|-------|
| Window manager, settings, sounds, boot | `lib/win95/store.ts`, `settings.ts`, `sounds.ts`, `system.ts` |
| Virtual file system (persisted to localStorage) | `lib/win95/fs.ts` |
| MS-DOS command interpreter | `lib/win95/dos.ts` |
| Shell (opening files, Run dialog resolution) | `lib/win95/shell.ts` |
| Desktop, taskbar, Start menu, window frame, menus | `components/win95/` |
| Applications (one file per group) | `components/apps/` |
| Win95 stylesheet (8pt MS Sans Serif, bevels, scrollbars) | `app/globals.css` |
| Icons (classic shell32 set, 32px + 16px) | `public/icons/` |

### Applications

Accessories: Notepad, WordPad, Paint, Calculator (standard + scientific), Character Map, Clock, Clipboard Viewer, Phone Dialer, HyperTerminal (dials a BBS), Dial-Up Networking, Direct Cable Connection.
Games: Solitaire, FreeCell (original Microsoft deal numbers), Minesweeper, Hearts.
Multimedia: Media Player, CD Player, Sound Recorder (records from the mic), Volume Control.
System Tools: ScanDisk, Disk Defragmenter, Backup, DriveSpace, Resource Meter, System Monitor, Registry Editor, Task List.
Shell: My Computer / Windows Explorer, Recycle Bin, Find Files, Control Panel (19 applets), Display Properties with wallpapers, patterns, color schemes and screen savers, Run, Shut Down (with MS-DOS mode), Welcome, Windows Help.
Online: Internet Explorer 3 (internal home page + search), Microsoft Exchange (sends real e-mail via `mailto:`), The Microsoft Network.

### Reset

Files and settings live in the browser's localStorage. Help ▸ Troubleshooting ▸ "If you want to start over" clears them, or run `localStorage.clear()` in the browser console.

## Notes

- `pnpm-workspace.yaml` excludes `caniuse-lite` and `electron-to-chromium` from pnpm's minimum-release-age policy; those data packages publish daily and otherwise block installs.
- `components/ui/`, `hooks/` and `styles/` are leftovers from the original v0 template and are not used by the desktop.
