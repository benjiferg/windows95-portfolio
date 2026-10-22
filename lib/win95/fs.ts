"use client"

import { useSyncExternalStore } from "react"
import type { IconName } from "./icons"
import { profile, software } from "./portfolio"

/* ------------------------------------------------------------------ */
/*  Virtual file system — C:\ (hard disk), A:\ (floppy), D:\ (CD-ROM) */
/*  Persisted to localStorage; seed files are refreshed on every load. */
/* ------------------------------------------------------------------ */

export interface FSFile {
  type: "file"
  name: string
  content: string
  /** fake byte size for binaries; text uses content length */
  size?: number
  modified: number
  /** registered app id to launch for .EXE files */
  exe?: string
  /** .URL / .LNK target */
  url?: string
  /** for .LNK: target path */
  target?: string
  icon?: IconName
  hidden?: boolean
  readonly?: boolean
  system?: boolean
  /** seeded by the site (re-created on load) */
  seed?: boolean
  /** for files in RECYCLED: original path */
  origin?: string
}

export interface FSDir {
  type: "dir"
  name: string
  children: Record<string, FSNode>
  modified: number
  icon?: IconName
  hidden?: boolean
  seed?: boolean
  system?: boolean
  /** drive meta (root dirs only) */
  drive?: { label: string; kind: "hdd" | "floppy" | "cdrom"; total: number; ready: boolean }
}

export type FSNode = FSFile | FSDir

const WIN95_DATE = new Date(1995, 6, 11, 9, 50).getTime()
const NOW = Date.now()

const d = (name: string, children: FSNode[] = [], extra: Partial<FSDir> = {}): FSDir => ({
  type: "dir",
  name,
  children: Object.fromEntries(children.map((c) => [c.name.toUpperCase(), c])),
  modified: WIN95_DATE,
  seed: true,
  ...extra,
})

const f = (name: string, content = "", extra: Partial<FSFile> = {}): FSFile => ({
  type: "file",
  name,
  content,
  modified: WIN95_DATE,
  seed: true,
  ...extra,
})

const exe = (name: string, appId: string, size = 0, extra: Partial<FSFile> = {}) =>
  f(name, "", { exe: appId, size: size || 40000 + ((hash(name) % 400) * 1024), ...extra })

const bin = (name: string, size: number, extra: Partial<FSFile> = {}) => f(name, "", { size, ...extra })

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/* ------------------------------------------------------------------ */
/*  Seed content                                                        */
/* ------------------------------------------------------------------ */

function readmeText() {
  return `README.TXT - ${profile.name}
${"=".repeat(14 + profile.name.length)}

Welcome to my desktop.

This site is a recreation of Windows 95, built as a portfolio.
Everything you see is a working program:

  * Start > Programs > Benjamin Ferguson Software
      My own software. Open any item to read about it,
      see screenshots and launch it.

  * Start > Programs > MS-DOS Prompt
      A real command interpreter. Type HELP.

  * Start > Programs > Accessories
      Notepad, Paint, WordPad, Calculator, Character Map,
      Phone Dialer, HyperTerminal and the Games folder.

  * Control Panel (Start > Settings)
      Change the wallpaper, colors and screen saver.
      Add/Remove Programs lists my software.

CONTACT
-------
  ${profile.email}
${profile.links
  .filter((l) => !l.url.startsWith("mailto:"))
  .map((l) => `  ${l.label}: ${l.url}`)
  .join("\n")}

Thanks for visiting.
${profile.name}
`
}

function aboutText() {
  return `${profile.name}
${profile.title}
${profile.location ? profile.location + "\n" : ""}
${profile.bio}

SKILLS
------
${profile.skills.map((s) => "  * " + s).join("\n")}

CONTACT
-------
  Email: ${profile.email}
${profile.links
  .filter((l) => !l.url.startsWith("mailto:"))
  .map((l) => `  ${l.label}: ${l.url}`)
  .join("\n")}
`
}

function softwareText(s: (typeof software)[number]) {
  return `${s.name}${s.version ? " " + s.version : ""}
${"=".repeat(s.name.length + (s.version ? s.version.length + 1 : 0))}
${s.tagline}

${s.description}
${s.features?.length ? "\nFEATURES\n--------\n" + s.features.map((x) => "  * " + x).join("\n") + "\n" : ""}${
    s.tags?.length ? "\nBUILT WITH\n----------\n  " + s.tags.join(", ") + "\n" : ""
  }${s.website ? "\nWebsite:  " + s.website : ""}${s.download ? "\nDownload: " + s.download : ""}${
    s.source ? "\nSource:   " + s.source : ""
  }

(c) ${s.year ?? new Date().getFullYear()} ${profile.name}
`
}

function resumeRtf() {
  // Stored as plain text with lightweight markdown — WordPad renders it.
  return `# ${profile.name}
## ${profile.title}

${profile.email}${profile.location ? " | " + profile.location : ""}

### Summary
${profile.bio.split("\n\n")[0]}

### Software
${
  software.length
    ? software.map((s) => `- **${s.name}** - ${s.tagline}${s.year ? ` (${s.year})` : ""}`).join("\n")
    : "- (Add your software in lib/win95/portfolio.ts)"
}

### Skills
${profile.skills.map((s) => `- ${s}`).join("\n")}
`
}

const DOS_EXTERNALS = [
  "ATTRIB.EXE",
  "CHKDSK.EXE",
  "CHOICE.COM",
  "DEBUG.EXE",
  "DELTREE.EXE",
  "DISKCOPY.COM",
  "DOSKEY.COM",
  "EDIT.COM",
  "EXTRACT.EXE",
  "FC.EXE",
  "FDISK.EXE",
  "FIND.EXE",
  "FORMAT.COM",
  "KEYB.COM",
  "LABEL.EXE",
  "MEM.EXE",
  "MODE.COM",
  "MORE.COM",
  "MOVE.EXE",
  "MSCDEX.EXE",
  "SCANDISK.EXE",
  "SORT.EXE",
  "START.EXE",
  "SUBST.EXE",
  "SYS.COM",
  "XCOPY.EXE",
  "XCOPY32.EXE",
]

const SYSTEM_DLLS = [
  "SHELL32.DLL",
  "USER32.DLL",
  "USER.EXE",
  "GDI32.DLL",
  "GDI.EXE",
  "KERNEL32.DLL",
  "KRNL386.EXE",
  "COMMDLG.DLL",
  "COMCTL32.DLL",
  "MSVCRT20.DLL",
  "OLE32.DLL",
  "WINMM.DLL",
  "MMSYSTEM.DLL",
  "VMM32.VXD",
  "IOSUBSYS",
  "VGA.DRV",
  "MOUSE.DRV",
  "SOUND.DRV",
  "SB16.DRV",
  "MSMOUSE.VXD",
  "SHELL.DLL",
  "COMM.DRV",
  "KEYBOARD.DRV",
  "SYSTEM.DRV",
  "ADVAPI32.DLL",
  "VERSION.DLL",
  "LZ32.DLL",
  "WINSOCK.DLL",
  "WSOCK32.DLL",
  "MPR.DLL",
  "MSNET32.DLL",
  "RPCRT4.DLL",
  "SETUPX.DLL",
  "TAPI32.DLL",
  "TAPI.DLL",
  "RSRC32.DLL",
  "DDEML.DLL",
]

const FONTS = [
  "ARIAL.TTF",
  "ARIALBD.TTF",
  "ARIALBI.TTF",
  "ARIALI.TTF",
  "COUR.TTF",
  "COURBD.TTF",
  "TIMES.TTF",
  "TIMESBD.TTF",
  "TIMESI.TTF",
  "SYMBOL.TTF",
  "WINGDING.TTF",
  "MARLETT.TTF",
  "SSERIFE.FON",
  "SSERIFF.FON",
  "SERIFE.FON",
  "SERIFF.FON",
  "COURE.FON",
  "COURF.FON",
  "SMALLE.FON",
  "SMALLF.FON",
  "SYMBOLE.FON",
  "MODERN.FON",
  "ROMAN.FON",
  "SCRIPT.FON",
  "VGASYS.FON",
  "VGAFIX.FON",
  "VGAOEM.FON",
  "DOSAPP.FON",
  "8514SYS.FON",
  "8514FIX.FON",
  "8514OEM.FON",
]

const WALLPAPER_BMPS = [
  "Black Thatch.bmp",
  "Blue Rivets.bmp",
  "Bubbles.bmp",
  "Carved Stone.bmp",
  "Circles.bmp",
  "Clouds.bmp",
  "Egypt.bmp",
  "Forest.bmp",
  "Gold Weave.bmp",
  "Houndstooth.bmp",
  "Metal Links.bmp",
  "Pinstripe.bmp",
  "Red Blocks.bmp",
  "Sandstone.bmp",
  "Setup.bmp",
  "Straw Mat.bmp",
  "Tiles.bmp",
  "Triangles.bmp",
  "Waves.bmp",
]

function programsMenu(): FSDir {
  const lnk = (name: string, appId: string) => f(name + ".lnk", "", { exe: appId, size: 400 })
  return d("Programs", [
    d("Accessories", [
      d("Games", [
        lnk("FreeCell", "freecell"),
        lnk("Hearts", "hearts"),
        lnk("Minesweeper", "minesweeper"),
        lnk("Solitaire", "solitaire"),
      ]),
      d("Multimedia", [
        lnk("CD Player", "cdplayer"),
        lnk("Media Player", "mediaplayer"),
        lnk("Sound Recorder", "soundrecorder"),
        lnk("Volume Control", "volume"),
      ]),
      d("System Tools", [
        lnk("Backup", "backup"),
        lnk("Disk Defragmenter", "defrag"),
        lnk("DriveSpace", "drivespace"),
        lnk("Resource Meter", "resmeter"),
        lnk("ScanDisk", "scandisk"),
        lnk("System Monitor", "sysmon"),
      ]),
      lnk("Calculator", "calc"),
      lnk("Character Map", "charmap"),
      lnk("Clipboard Viewer", "clipbrd"),
      lnk("Dial-Up Networking", "dialup"),
      lnk("Direct Cable Connection", "dcc"),
      lnk("HyperTerminal", "hyperterm"),
      lnk("Notepad", "notepad"),
      lnk("Paint", "paint"),
      lnk("Phone Dialer", "dialer"),
      lnk("WordPad", "wordpad"),
    ]),
    d("StartUp", []),
    d(profile.company ?? "Software", software.map((s) => lnk(s.name, "sw:" + s.slug))),
    lnk("Internet Explorer", "iexplore"),
    lnk("Microsoft Exchange", "exchange"),
    lnk("MS-DOS Prompt", "dos"),
    lnk("The Microsoft Network", "msn"),
    lnk("Windows Explorer", "explorer"),
  ])
}

function buildSeed(): Record<string, FSDir> {
  const windowsDir = d("WINDOWS", [
    exe("NOTEPAD.EXE", "notepad", 34304),
    exe("CALC.EXE", "calc", 59392),
    exe("PBRUSH.EXE", "paint", 4608),
    exe("EXPLORER.EXE", "explorer", 204288),
    exe("WIN.COM", "win", 22679),
    exe("CONTROL.EXE", "controlpanel", 2048),
    exe("TASKMAN.EXE", "taskman", 20480),
    exe("CHARMAP.EXE", "charmap", 23552),
    exe("CLOCK.EXE", "clock", 16896),
    exe("DEFRAG.EXE", "defrag", 232448),
    exe("SCANDSKW.EXE", "scandisk", 4576),
    exe("SNDVOL32.EXE", "volume", 59392),
    exe("SNDREC32.EXE", "soundrecorder", 106496),
    exe("MPLAYER.EXE", "mediaplayer", 134656),
    exe("CDPLAYER.EXE", "cdplayer", 81408),
    exe("DIALER.EXE", "dialer", 61440),
    exe("FREECELL.EXE", "freecell", 32768),
    exe("MSHEARTS.EXE", "hearts", 118784),
    exe("SOL.EXE", "solitaire", 171008),
    exe("WINMINE.EXE", "minesweeper", 24576),
    exe("WINHELP.EXE", "help", 9008),
    exe("WINHLP32.EXE", "help", 306688),
    exe("REGEDIT.EXE", "regedit", 120320),
    exe("CLIPBRD.EXE", "clipbrd", 18432),
    exe("WELCOME.EXE", "welcome", 24576),
    exe("DRVSPACE.EXE", "drivespace", 294400),
    exe("SYSMON.EXE", "sysmon", 61440),
    exe("RSRCMTR.EXE", "resmeter", 14848),
    exe("PROGMAN.EXE", "progman", 134000),
    exe("WINFILE.EXE", "explorer", 180000),
    exe("TELNET.EXE", "hyperterm", 72000),
    exe("PACKAGER.EXE", "packager", 56000),
    exe("RUNDLL32.EXE", "run", 8192),
    exe("WRITE.EXE", "wordpad", 5120),
    exe("TOUR.EXE", "welcome", 20000),
    f(
      "WIN.INI",
      `[windows]
load=
run=
NullPort=None
device=,,

[Desktop]
Wallpaper=(None)
TileWallpaper=1
Pattern=(None)

[intl]
sLanguage=enu
sCountry=United States
iCountry=1
sShortDate=M/d/yy
sTime=:

[fonts]
Arial (TrueType)=ARIAL.TTF
Courier New (TrueType)=COUR.TTF
Times New Roman (TrueType)=TIMES.TTF
Symbol (TrueType)=SYMBOL.TTF
Wingdings (TrueType)=WINGDING.TTF

[Extensions]
txt=notepad.exe ^.txt
ini=notepad.exe ^.ini
bmp=pbrush.exe ^.bmp
wri=write.exe ^.wri
cal=calendar.exe ^.cal
crd=cardfile.exe ^.crd
rec=recorder.exe ^.rec
hlp=winhelp.exe ^.hlp

[MCI Extensions]
wav=waveaudio
mid=sequencer
rmi=sequencer
avi=AVIVideo

[Compatibility]
_BNOTES=0x24000
_LNOTES=0x00100000

[RegisteredApps]
${profile.name.replace(/ /g, "")}=${software.length} program(s)
`,
    ),
    f(
      "SYSTEM.INI",
      `[boot]
shell=Explorer.exe
system.drv=system.drv
drivers=mmsystem.dll power.drv
user.exe=user.exe
gdi.exe=gdi.exe
sound.drv=mmsound.drv
dibeng.drv=dibeng.dll
comm.drv=comm.drv
mouse.drv=mouse.drv
keyboard.drv=keyboard.drv
*DisplayFallback=0
fonts.fon=vgasys.fon
fixedfon.fon=vgafix.fon
oemfonts.fon=vgaoem.fon
386Grabber=vgafull.3gr
display.drv=pnpdrvr.drv
SCRNSAVE.EXE=

[keyboard]
keyboard.dll=
oemansi.bin=
subtype=
type=4

[boot.description]
system.drv=Standard PC
keyboard.typ=Standard 101/102-Key or Microsoft Natural Keyboard
mouse.drv=Standard mouse
aspect=100,96,96
display.drv=Standard VGA

[386Enh]
ebios=*ebios
woafont=dosapp.fon
mouse=*vmouse, msmouse.vxd
device=*dynapage
device=*vcd
device=*vpd
device=*int13
keyboard=*vkd
display=*vdd,*vflatd
EMMExclude=C000-CFFF
MaxBPs=768
PagingDrive=C:
MinSPs=4

[NonWindowsApp]
TTInitialSizes=4 5 6 7 8 9 10 11 12 13 14 15 16 18 20 22

[mci]
cdaudio=mcicda.drv
sequencer=mciseq.drv
waveaudio=mciwave.drv
avivideo=mciavi.drv
MPEGVideo=mciqtz.drv

[drivers]
wavemapper=*.drv
MSACM.imaadpcm=*.drv
midimapper=midimap.drv
timer=timer.drv
wave=sb16snd.drv
`,
    ),
    f("CONTROL.INI", "[current]\ncolor schemes=Windows Standard\n\n[Patterns]\n(None)=(None)\n"),
    f("PROGMAN.INI", "[Settings]\nWindow=68 48 580 390 1\nOrder=1 2 3\n\n[Groups]\nGroup1=C:\\WINDOWS\\MAIN.GRP\nGroup2=C:\\WINDOWS\\ACCESSOR.GRP\nGroup3=C:\\WINDOWS\\GAMES.GRP\n"),
    f("EXCHNG32.INI", "[Exchange]\nProfiles=Default\n"),
    f("MSDOS.SYS", "[Paths]\nWinDir=C:\\WINDOWS\nWinBootDir=C:\\WINDOWS\nHostWinBootDrv=C\n\n[Options]\nBootMulti=1\nBootGUI=1\nNetwork=0\n", {
      hidden: true,
      system: true,
      readonly: true,
    }),
    f("SETUPLOG.TXT", "[Started]\nMicrosoft Windows 95 Setup\n[Installing]\nSuccess\n[FinishedUpdates]\n"),
    f(
      "TIPS.TXT",
      profile.tips.map((t, i) => `${i + 1}. ${t}`).join("\n\n"),
    ),
    f("README.TXT", readmeText(), { modified: NOW }),
    bin("MOUSE.TXT", 4096),
    bin("NETWORK.TXT", 12560),
    bin("PRINTERS.TXT", 8800),
    bin("HARDWARE.TXT", 23000),
    bin("DISPLAY.TXT", 7600),
    bin("PROGRAMS.TXT", 11000),
    bin("GENERAL.TXT", 15600),
    bin("FAQ.TXT", 9300),
    bin("EXCHANGE.TXT", 14000),
    bin("INTERNET.TXT", 5400),
    bin("SUPPORT.TXT", 2700),
    bin("WINNEWS.TXT", 8300),
    bin("BOOTLOG.TXT", 25000, { hidden: true }),
    bin("DETLOG.TXT", 35000, { hidden: true }),
    bin("NETLOG.TXT", 9000, { hidden: true }),
    bin("DOSSTART.BAT", 120),
    bin("WINVER.EXE", 3328),
    bin("WIN386.SWP", 16 * 1024 * 1024, { hidden: true, system: true }),
    bin("ARCADE.BMP", 630),
    bin("ARGYLE.BMP", 630),
    bin("CARS.BMP", 630),
    bin("CASTLE.BMP", 778),
    bin("EGYPT.BMP", 630),
    ...WALLPAPER_BMPS.filter((b) => !/EGYPT/i.test(b)).map((b) => bin(b, 190 + (hash(b) % 60000))),
    bin("CIRCLES.BMP", 190),
    bin("HLPGLOBE.AVI", 1320000),
    bin("CLOUD.BMP", 307000),
    d("SYSTEM", [
      ...SYSTEM_DLLS.map((n) => bin(n, 8000 + (hash(n) % 900) * 1024, { system: true })),
      d("IOSUBSYS", [bin("CDFS.VXD", 56000), bin("ESDI_506.PDR", 24000), bin("HSFLOP.PDR", 20000), bin("VOLTRACK.VXD", 18000)]),
      d("VIPER", []),
      d("VMM32", []),
      d("COLOR", [bin("SRGB.ICM", 3000)]),
      d("SHELLEXT", []),
    ]),
    d("COMMAND", [exe("COMMAND.COM", "dos", 92870), ...DOS_EXTERNALS.map((n) => bin(n, 8000 + (hash(n) % 60) * 1024))]),
    d("FONTS", FONTS.map((n) => bin(n, 20000 + (hash(n) % 200) * 1024))),
    d("HELP", [
      bin("WINDOWS.HLP", 1540000),
      bin("WINDOWS.CNT", 25000),
      bin("CALC.HLP", 32000),
      bin("NOTEPAD.HLP", 16000),
      bin("MSPAINT.HLP", 68000),
      bin("WORDPAD.HLP", 54000),
      bin("WINMINE.HLP", 12000),
      bin("SOL.HLP", 14000),
      bin("FREECELL.HLP", 11000),
      bin("MSHEARTS.HLP", 22000),
      bin("TIPS.HLP", 8000),
      bin("CHARMAP.HLP", 9000),
    ]),
    d("MEDIA", [
      bin("The Microsoft Sound.wav", 296734),
      bin("Chimes.wav", 15920),
      bin("Chord.wav", 24982),
      bin("Ding.wav", 11598),
      bin("Tada.wav", 27804),
      bin("Canyon.mid", 33883),
      bin("Passport.mid", 25714),
      bin("Jungle Asterisk.wav", 60000),
      bin("Musica Windows Exit.wav", 40000),
      bin("Robotz Default.wav", 30000),
      bin("Utopia Critical Stop.wav", 20000),
    ]),
    d("TEMP", []),
    d("INF", [bin("MSDET.INF", 6000), bin("NET.INF", 12000), bin("MSPORTS.INF", 4000), bin("MSMOUSE.INF", 5000), bin("MONITOR.INF", 30000)]),
    d("CURSORS", [bin("APPSTART.ANI", 7000), bin("HOURGLAS.ANI", 6000), bin("ARROW_L.CUR", 326), bin("BUSY_L.CUR", 326), bin("BEAM_L.CUR", 326)]),
    d("PIF", [bin("MS-DOS Prompt.pif", 967)]),
    d("SENDTO", [bin("3½ Floppy (A).lnk", 300), bin("Fax Recipient.lnk", 300), bin("Mail Recipient.lnk", 300), bin("My Briefcase.lnk", 300)]),
    d("RECENT", []),
    d("SPOOL", [d("PRINTERS", [])]),
    d("SHELLNEW", [bin("WINWORD.DOC", 4608), bin("EXCEL.XLS", 2000), bin("SNDREC.WAV", 100), bin("WORDPAD.DOC", 100)]),
    d(
      "DESKTOP",
      software.map((s) => f(s.name + ".lnk", "", { exe: "sw:" + s.slug, size: 400, icon: s.logo as IconName, modified: NOW })),
      { modified: NOW },
    ),
    d("START MENU", [programsMenu()]),
    d("FAVORITES", [
      ...profile.links
        .filter((l) => !l.url.startsWith("mailto:"))
        .map((l) => f(l.label + ".url", `[InternetShortcut]\nURL=${l.url}\n`, { url: l.url })),
    ]),
    d("HISTORY", []),
    d("COOKIES", []),
    d("TEMPORARY INTERNET FILES", []),
    d("CONFIG", [bin("GENERAL.IDF", 20000), bin("MIDIMAP.CFG", 4000)]),
    d("SYSBCKUP", []),
  ])

  const programFiles = d("Program Files", [
    d("Accessories", [
      exe("WORDPAD.EXE", "wordpad", 184832),
      exe("MSPAINT.EXE", "paint", 344064),
      exe("BACKUP.EXE", "backup", 400000),
      exe("IMAGING.EXE", "imaging", 240000),
      d("HyperTerminal", [exe("HYPERTRM.EXE", "hyperterm", 12288), bin("HYPERTRM.DLL", 480000), bin("CompuServe.ht", 700), bin("MCI Mail.ht", 700), bin("AT&T Mail.ht", 700)]),
    ]),
    d("Internet Explorer", [exe("IEXPLORE.EXE", "iexplore", 143000), bin("IEXPLORE.INI", 800)]),
    d("The Microsoft Network", [exe("MSNSTART.EXE", "msn", 95000), bin("MSNVER.DLL", 20000)]),
    d("Microsoft Exchange", [exe("EXCHNG32.EXE", "exchange", 42000), bin("MAPI32.DLL", 600000)]),
    d("Plus!", [bin("PLUS!.INI", 500), exe("THEMES.EXE", "themes", 93000), exe("PINBALL.EXE", "pinball", 400000)]),
    d(
      profile.company ?? "Software",
      software.map((s) =>
        d(s.name, [
          exe(s.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) + ".EXE", "sw:" + s.slug, 0, {
            icon: s.logo as IconName,
            modified: NOW,
          }),
          f("README.TXT", softwareText(s), { modified: NOW }),
          ...(s.website ? [f(s.name + ".url", `[InternetShortcut]\nURL=${s.website}\n`, { url: s.website, modified: NOW })] : []),
          ...(s.source ? [f("Source Code.url", `[InternetShortcut]\nURL=${s.source}\n`, { url: s.source, modified: NOW })] : []),
        ]),
      ),
      { modified: NOW },
    ),
  ])

  const myDocs = d(
    "My Documents",
    [
      f("README.TXT", readmeText(), { modified: NOW }),
      f("About Benjamin.txt", aboutText(), { modified: NOW }),
      f("Resume.doc", resumeRtf(), { modified: NOW }),
      f(
        "Contact.txt",
        `Contact ${profile.name}
-------------------${"-".repeat(profile.name.length)}

Email: ${profile.email}
${profile.links
  .filter((l) => !l.url.startsWith("mailto:"))
  .map((l) => `${l.label}: ${l.url}`)
  .join("\n")}

The quickest way to reach me is email.
`,
        { modified: NOW },
      ),
      d(
        "Projects",
        software.map((s) => f(s.name + ".txt", softwareText(s), { modified: NOW })),
        { modified: NOW },
      ),
      d("Pictures", [], { modified: NOW }),
    ],
    { modified: NOW },
  )

  const cRoot = d(
    "C:",
    [
      windowsDir,
      programFiles,
      myDocs,
      d("Exchange", [bin("MAILBOX.PST", 270000), bin("MSPST.DLL", 100000)]),
      d("RECYCLED", [], { hidden: true, system: true }),
      f(
        "AUTOEXEC.BAT",
        `@ECHO OFF
PROMPT $p$g
PATH C:\\WINDOWS;C:\\WINDOWS\\COMMAND
SET TEMP=C:\\WINDOWS\\TEMP
SET TMP=C:\\WINDOWS\\TEMP
SET BLASTER=A220 I5 D1 H5 P330 T6
LH C:\\WINDOWS\\COMMAND\\MSCDEX.EXE /D:MSCD001 /L:D
LH C:\\WINDOWS\\COMMAND\\DOSKEY
REM ${profile.name} - portfolio machine
`,
      ),
      f(
        "CONFIG.SYS",
        `DEVICE=C:\\WINDOWS\\HIMEM.SYS
DEVICE=C:\\WINDOWS\\EMM386.EXE NOEMS
DEVICEHIGH=C:\\CDROM\\CDROM.SYS /D:MSCD001
DOS=HIGH,UMB
FILES=40
BUFFERS=20
STACKS=9,256
LASTDRIVE=Z
`,
      ),
      exe("COMMAND.COM", "dos", 92870),
      bin("IO.SYS", 223148, { hidden: true, system: true, readonly: true }),
      bin("MSDOS.SYS", 1641, { hidden: true, system: true, readonly: true }),
      bin("DRVSPACE.BIN", 71287, { hidden: true, system: true, readonly: true }),
      bin("BOOTLOG.PRV", 24000, { hidden: true }),
      bin("SUHDLOG.DAT", 5166, { hidden: true, readonly: true }),
      bin("SETUPLOG.TXT", 60000, { hidden: true }),
      bin("DETLOG.TXT", 50000, { hidden: true }),
      bin("NETLOG.TXT", 8000, { hidden: true }),
      bin("SYSTEM.1ST", 90000, { hidden: true, system: true, readonly: true }),
      bin("SCANDISK.LOG", 700),
      bin("WINDOWS.SWP", 0, { hidden: true }),
    ],
    { drive: { label: "BENJAMIN", kind: "hdd", total: 2147155968, ready: true } },
  )

  const aRoot = d("A:", [], { drive: { label: "", kind: "floppy", total: 1457664, ready: false } })

  const dRoot = d(
    "D:",
    [
      f(
        "AUTORUN.INF",
        `[autorun]
open=SETUP.EXE
icon=SETUP.EXE,0
label=${profile.firstName.toUpperCase()}_PORTFOLIO
`,
      ),
      exe("SETUP.EXE", "setup", 184320),
      f("README.TXT", readmeText()),
      d(
        "SOFTWARE",
        software.map((s) =>
          d(s.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8), [
            exe("SETUP.EXE", "sw:" + s.slug, 0, { icon: s.logo as IconName }),
            f("README.TXT", softwareText(s)),
          ]),
        ),
      ),
      d("DOCS", [f("About Benjamin.txt", aboutText()), f("Resume.doc", resumeRtf())]),
    ],
    { drive: { label: `${profile.firstName.toUpperCase()}_PORTFOLIO`, kind: "cdrom", total: 681574400, ready: true } },
  )

  return { "A:": aRoot, "C:": cRoot, "D:": dRoot }
}

/* ------------------------------------------------------------------ */
/*  Store                                                               */
/* ------------------------------------------------------------------ */

const KEY = "w95.fs.v1"

export class FileSystem {
  drives: Record<string, FSDir>
  private listeners = new Set<() => void>()
  private version = 0
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.drives = buildSeed()
    if (typeof window !== "undefined") this.load()
  }

  /* --- subscriptions --- */
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
  getVersion = () => this.version
  private changed() {
    this.version++
    this.listeners.forEach((l) => l())
    this.scheduleSave()
  }

  /* --- persistence --- */
  private load() {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, FSDir>
      // overlay: keep user files, refresh seed files
      const seed = buildSeed()
      for (const letter of Object.keys(seed)) {
        if (saved[letter]) {
          this.drives[letter] = mergeSeed(seed[letter], saved[letter])
        }
      }
    } catch {
      /* corrupt — ignore */
    }
  }
  private scheduleSave() {
    if (typeof window === "undefined") return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.drives))
      } catch {
        /* quota */
      }
    }, 300)
  }
  reset() {
    this.drives = buildSeed()
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    this.changed()
  }

  /* --- paths --- */

  /** Normalize to "C:\DIR\FILE" form. */
  normalize(path: string, cwd = "C:\\"): string {
    let p = path.trim().replace(/\//g, "\\")
    if (!p) return cwd
    let drive: string
    if (/^[A-Za-z]:/.test(p)) {
      drive = p.slice(0, 2).toUpperCase()
      p = p.slice(2)
      if (!p.startsWith("\\")) {
        // relative to that drive's cwd — we only track one cwd, so treat as root-relative
        p = "\\" + p
      }
    } else if (p.startsWith("\\")) {
      drive = cwd.slice(0, 2).toUpperCase()
    } else {
      drive = cwd.slice(0, 2).toUpperCase()
      const base = cwd.slice(2).replace(/\\+$/, "")
      p = base + "\\" + p
    }
    const parts: string[] = []
    for (const seg of p.split("\\")) {
      if (!seg || seg === ".") continue
      if (seg === "..") {
        parts.pop()
        continue
      }
      parts.push(seg)
    }
    return drive + "\\" + parts.join("\\")
  }

  split(path: string): { drive: string; parts: string[] } {
    const n = this.normalize(path)
    const drive = n.slice(0, 2)
    const rest = n.slice(3)
    return { drive, parts: rest ? rest.split("\\") : [] }
  }

  parent(path: string): string {
    const { drive, parts } = this.split(path)
    parts.pop()
    return drive + "\\" + parts.join("\\")
  }

  basename(path: string): string {
    const { parts } = this.split(path)
    return parts[parts.length - 1] ?? path.slice(0, 2)
  }

  /** Return node at path, or null. Case-insensitive. */
  get(path: string): FSNode | null {
    const { drive, parts } = this.split(path)
    let node: FSNode | undefined = this.drives[drive]
    if (!node) return null
    for (const seg of parts) {
      if (node.type !== "dir") return null
      node = node.children[seg.toUpperCase()]
      if (!node) return null
    }
    return node
  }

  /** Real-cased absolute path for a node (fixes user casing). */
  realPath(path: string): string {
    const { drive, parts } = this.split(path)
    let node: FSNode | undefined = this.drives[drive]
    const out: string[] = []
    if (!node) return this.normalize(path)
    for (const seg of parts) {
      if (node.type !== "dir") break
      const child: FSNode | undefined = node.children[seg.toUpperCase()]
      if (!child) {
        out.push(seg)
        continue
      }
      out.push(child.name)
      node = child
    }
    return drive + "\\" + out.join("\\")
  }

  exists(path: string) {
    return !!this.get(path)
  }
  isDir(path: string) {
    return this.get(path)?.type === "dir"
  }
  driveReady(letter: string) {
    const dr = this.drives[letter.slice(0, 2).toUpperCase()]
    return !!dr && dr.drive?.ready !== false
  }

  list(path: string, opts: { hidden?: boolean } = {}): FSNode[] {
    const node = this.get(path)
    if (!node || node.type !== "dir") return []
    const items = Object.values(node.children).filter((c) => opts.hidden || !c.hidden)
    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
    })
  }

  readFile(path: string): string | null {
    const n = this.get(path)
    return n && n.type === "file" ? n.content : null
  }

  sizeOf(node: FSNode): number {
    if (node.type === "file") return node.size ?? node.content.length
    let total = 0
    for (const c of Object.values(node.children)) total += this.sizeOf(c)
    return total
  }

  usedSpace(driveLetter: string): number {
    const dr = this.drives[driveLetter.slice(0, 2).toUpperCase()]
    if (!dr) return 0
    // pretend Windows is big
    return this.sizeOf(dr) + (dr.drive?.kind === "hdd" ? 480 * 1024 * 1024 : 0)
  }

  writeFile(path: string, content: string, extra: Partial<FSFile> = {}): boolean {
    const parentPath = this.parent(path)
    const parent = this.get(parentPath)
    if (!parent || parent.type !== "dir") return false
    if (!this.driveReady(path)) return false
    const name = this.basename(path)
    const existing = parent.children[name.toUpperCase()]
    if (existing && existing.type === "dir") return false
    parent.children[name.toUpperCase()] = {
      type: "file",
      name: existing?.name ?? name,
      content,
      modified: Date.now(),
      ...(existing && existing.type === "file" ? { exe: existing.exe, url: existing.url, icon: existing.icon } : {}),
      ...extra,
      seed: false,
    }
    parent.modified = Date.now()
    this.changed()
    return true
  }

  mkdir(path: string): boolean {
    const parentPath = this.parent(path)
    const parent = this.get(parentPath)
    if (!parent || parent.type !== "dir") return false
    if (!this.driveReady(path)) return false
    const name = this.basename(path)
    if (parent.children[name.toUpperCase()]) return false
    parent.children[name.toUpperCase()] = { type: "dir", name, children: {}, modified: Date.now() }
    parent.modified = Date.now()
    this.changed()
    return true
  }

  remove(path: string, recursive = false): boolean {
    const node = this.get(path)
    if (!node) return false
    const { parts } = this.split(path)
    if (parts.length === 0) return false
    if (node.type === "dir" && !recursive && Object.keys(node.children).length) return false
    const parent = this.get(this.parent(path)) as FSDir
    delete parent.children[node.name.toUpperCase()]
    parent.modified = Date.now()
    this.changed()
    return true
  }

  rename(path: string, newName: string): boolean {
    const node = this.get(path)
    if (!node || /[\\/:*?"<>|]/.test(newName) || !newName.trim()) return false
    const parent = this.get(this.parent(path)) as FSDir
    if (parent.children[newName.toUpperCase()] && newName.toUpperCase() !== node.name.toUpperCase()) return false
    delete parent.children[node.name.toUpperCase()]
    node.name = newName
    node.seed = false
    parent.children[newName.toUpperCase()] = node
    this.changed()
    return true
  }

  /** Move node to destination directory (or new full path if dest isn't a dir). */
  move(src: string, dest: string): boolean {
    const node = this.get(src)
    if (!node) return false
    const destNode = this.get(dest)
    let destDir: FSDir
    let newName = node.name
    if (destNode && destNode.type === "dir") destDir = destNode
    else {
      const p = this.get(this.parent(dest))
      if (!p || p.type !== "dir") return false
      destDir = p
      newName = this.basename(dest)
    }
    if (destDir.children[newName.toUpperCase()]) return false
    // prevent moving into itself
    if (node.type === "dir" && this.normalize(dest).startsWith(this.normalize(src))) return false
    const parent = this.get(this.parent(src)) as FSDir
    delete parent.children[node.name.toUpperCase()]
    node.name = newName
    node.seed = false
    destDir.children[newName.toUpperCase()] = node
    destDir.modified = Date.now()
    this.changed()
    return true
  }

  copy(src: string, dest: string): boolean {
    const node = this.get(src)
    if (!node) return false
    const clone = JSON.parse(JSON.stringify(node)) as FSNode
    clone.seed = false
    const destNode = this.get(dest)
    let destDir: FSDir
    let newName = node.name
    if (destNode && destNode.type === "dir") destDir = destNode
    else {
      const p = this.get(this.parent(dest))
      if (!p || p.type !== "dir") return false
      destDir = p
      newName = this.basename(dest)
    }
    if (!this.driveReady(dest)) return false
    clone.name = newName
    clone.modified = Date.now()
    if (destDir.children[newName.toUpperCase()]) {
      // Explorer-style "Copy of"
      if (destDir === this.get(this.parent(src))) {
        clone.name = "Copy of " + newName
        if (destDir.children[clone.name.toUpperCase()]) return false
      } else return false
    }
    destDir.children[clone.name.toUpperCase()] = clone
    destDir.modified = Date.now()
    this.changed()
    return true
  }

  /** Move to Recycle Bin (C:\RECYCLED). */
  recycle(path: string): boolean {
    const node = this.get(path)
    if (!node) return false
    const bin = this.get("C:\\RECYCLED") as FSDir
    const origin = this.realPath(path)
    let name = node.name
    let i = 1
    while (bin.children[name.toUpperCase()]) name = `${node.name} (${++i})`
    const parent = this.get(this.parent(path)) as FSDir
    delete parent.children[node.name.toUpperCase()]
    node.name = name
    node.seed = false
    if (node.type === "file") node.origin = origin
    else (node as FSDir & { origin?: string }).origin = origin
    bin.children[name.toUpperCase()] = node
    this.changed()
    return true
  }

  restore(nameInBin: string): boolean {
    const bin = this.get("C:\\RECYCLED") as FSDir
    const node = bin.children[nameInBin.toUpperCase()]
    if (!node) return false
    const origin = (node as { origin?: string }).origin
    if (!origin) return false
    const destParent = this.get(this.parent(origin))
    if (!destParent || destParent.type !== "dir") return false
    delete bin.children[nameInBin.toUpperCase()]
    const realName = this.basename(origin)
    node.name = realName
    delete (node as { origin?: string }).origin
    destParent.children[realName.toUpperCase()] = node
    this.changed()
    return true
  }

  emptyRecycleBin() {
    const bin = this.get("C:\\RECYCLED") as FSDir
    bin.children = {}
    this.changed()
  }

  recycleCount() {
    const bin = this.get("C:\\RECYCLED") as FSDir | null
    return bin ? Object.keys(bin.children).length : 0
  }

  /** Recursive search by glob-ish name (supports * and ?) and optional content text. */
  find(root: string, pattern: string, text?: string, limit = 500): { path: string; node: FSNode }[] {
    const out: { path: string; node: FSNode }[] = []
    const re = globToRegExp(pattern || "*")
    const needle = text?.toLowerCase()
    const walk = (dirPath: string, dir: FSDir) => {
      for (const child of Object.values(dir.children)) {
        if (out.length >= limit) return
        const p = dirPath.replace(/\\$/, "") + "\\" + child.name
        if (re.test(child.name) && (!needle || (child.type === "file" && child.content.toLowerCase().includes(needle)))) {
          out.push({ path: p, node: child })
        }
        if (child.type === "dir") walk(p, child)
      }
    }
    const start = this.get(root)
    if (start?.type === "dir") walk(this.realPath(root), start)
    return out
  }
}

function mergeSeed(seed: FSDir, saved: FSDir): FSDir {
  // Start from saved, then make sure every seed node exists & seed files are fresh.
  const out: FSDir = { ...saved, children: { ...saved.children }, drive: seed.drive }
  for (const [key, sNode] of Object.entries(seed.children)) {
    const existing = out.children[key]
    if (sNode.type === "dir") {
      out.children[key] = existing && existing.type === "dir" ? mergeSeed(sNode, existing) : sNode
    } else {
      // seed file: always refresh content & metadata from seed, unless the user edited it
      if (existing && existing.type === "file" && existing.seed === false) continue
      out.children[key] = sNode
    }
  }
  return out
}

export function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")
  return new RegExp("^" + esc + "$", "i")
}

/** DOS-style wildcard match in a directory. */
export function matchGlob(fs: FileSystem, dirPath: string, glob: string, opts: { hidden?: boolean } = {}) {
  const re = globToRegExp(glob)
  return fs.list(dirPath, opts).filter((n) => re.test(n.name))
}

export const fs = new FileSystem()

export function useFS(): number {
  return useSyncExternalStore(fs.subscribe, fs.getVersion, fs.getVersion)
}

/* ------------------------------------------------------------------ */
/*  Helpers: icons, types, formatting                                  */
/* ------------------------------------------------------------------ */

export function ext(name: string): string {
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i + 1).toUpperCase() : ""
}

export function fileTypeName(node: FSNode): string {
  if (node.type === "dir") return "File Folder"
  const e = ext(node.name)
  const map: Record<string, string> = {
    TXT: "Text Document",
    INI: "Configuration Settings",
    BAT: "MS-DOS Batch File",
    COM: "MS-DOS Application",
    EXE: "Application",
    SYS: "System file",
    DLL: "Application Extension",
    DRV: "Device driver",
    VXD: "Virtual device driver",
    PDR: "Port driver",
    BMP: "Bitmap Image",
    GIF: "GIF Image",
    JPG: "JPEG Image",
    PNG: "PNG Image",
    WAV: "Wave Sound",
    MID: "MIDI Sequence",
    AVI: "Video Clip",
    HLP: "Help File",
    CNT: "Help Contents",
    DOC: "WordPad Document",
    RTF: "Rich Text Format",
    WRI: "Write Document",
    LNK: "Shortcut",
    PIF: "Shortcut to MS-DOS Program",
    URL: "Internet Shortcut",
    HTM: "Internet Document (HTML)",
    HTML: "Internet Document (HTML)",
    TTF: "TrueType Font file",
    FON: "Font file",
    INF: "Setup Information",
    LOG: "Text Document",
    DAT: "DAT File",
    PST: "Personal Folders File",
    SWP: "Swap File",
    ANI: "Animated Cursor",
    CUR: "Cursor",
    ICM: "ICC Profile",
    GRP: "Program Group",
    REG: "Registration Entries",
    "1ST": "1ST File",
    IDF: "IDF File",
    CFG: "CFG File",
    HT: "HyperTerminal File",
    PRV: "PRV File",
    BIN: "BIN File",
    XLS: "Microsoft Excel Worksheet",
  }
  return map[e] ?? (e ? `${e} File` : "File")
}

export function iconForNode(node: FSNode, path?: string): IconName {
  if (node.type === "dir") {
    if (node.icon) return node.icon
    const up = node.name.toUpperCase()
    if (path && /^[A-Z]:\\?$/.test(path)) {
      const k = node.drive?.kind
      return k === "cdrom" ? "cd_drive" : k === "floppy" ? "floppy_drive_3_5" : "hard_disk_drive"
    }
    if (up === "MY DOCUMENTS") return "directory_open_file_mydocs"
    if (up === "FONTS") return "directory_fonts"
    if (up === "START MENU" || up === "PROGRAMS") return "directory_closed"
    return "directory_closed"
  }
  if (node.icon) return node.icon
  const e = ext(node.name)
  if (node.exe) {
    // resolved lazily by caller (registry) — provide generic fallbacks here
    return e === "LNK" ? "file_win_shortcut" : "executable"
  }
  switch (e) {
    case "TXT":
    case "LOG":
    case "1ST":
      return "notepad_file"
    case "INI":
    case "INF":
    case "CFG":
    case "IDF":
      return "file_lines"
    case "BAT":
      return "executable_script"
    case "COM":
    case "EXE":
      return "ms_dos"
    case "SYS":
    case "DLL":
    case "DRV":
    case "VXD":
    case "PDR":
    case "386":
    case "BIN":
      return "ole"
    case "BMP":
      return "paint_file"
    case "GIF":
      return "imaggif"
    case "JPG":
    case "JPEG":
      return "imagjpeg"
    case "PNG":
      return "imagpng"
    case "WAV":
      return "soundgrn"
    case "MID":
    case "RMI":
      return "midi_bl"
    case "AVI":
      return "video_mk"
    case "HLP":
    case "CNT":
      return "help_sheet"
    case "DOC":
    case "RTF":
    case "WRI":
      return "write_file"
    case "URL":
    case "HTM":
    case "HTML":
      return "html"
    case "TTF":
      return "font_tt"
    case "FON":
      return "font_bitmap"
    case "LNK":
      return "file_win_shortcut"
    case "PIF":
      return "ms_dos"
    case "REG":
      return "regedit"
    case "PST":
      return "envelope_closed"
    case "HT":
      return "modem"
    default:
      return "file_windows"
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

export function formatSizeKB(bytes: number): string {
  return `${Math.max(1, Math.ceil(bytes / 1024)).toLocaleString()}KB`
}

export function formatDate(ts: number): string {
  const dt = new Date(ts)
  const h = dt.getHours()
  const ampm = h >= 12 ? "PM" : "AM"
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${dt.getMonth() + 1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)} ${hh}:${String(dt.getMinutes()).padStart(2, "0")} ${ampm}`
}

/** 8.3 short name for DIR listings. */
export function shortName(name: string, siblings: string[] = []): string {
  const upper = name.toUpperCase()
  const dot = upper.lastIndexOf(".")
  let base = dot > 0 ? upper.slice(0, dot) : upper
  let e = dot > 0 ? upper.slice(dot + 1) : ""
  const clean = (s: string) => s.replace(/[^A-Z0-9!#$%&'()\-@^_`{}~]/g, "")
  const cleanBase = clean(base.replace(/\./g, ""))
  const cleanExt = clean(e).slice(0, 3)
  const needsShort = cleanBase.length > 8 || cleanBase !== base || e.length > 3 || /\s/.test(name)
  if (!needsShort) return e ? `${cleanBase}.${cleanExt}` : cleanBase
  base = cleanBase.slice(0, 6)
  e = cleanExt
  let n = 1
  let candidate = `${base}~${n}`
  const taken = new Set(siblings.map((s) => s.toUpperCase()))
  while (taken.has(e ? `${candidate}.${e}` : candidate) && n < 9) candidate = `${base}~${++n}`
  return e ? `${candidate}.${e}` : candidate
}
