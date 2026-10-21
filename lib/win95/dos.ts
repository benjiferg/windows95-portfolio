"use client"

import { fs, matchGlob, shortName, type FSNode, type FSDir } from "./fs"
import { profile, software } from "./portfolio"
import { run as shellRun, openPath } from "./shell"
import { launch } from "./store"
import { sounds } from "./sounds"

/* ------------------------------------------------------------------ */
/*  COMMAND.COM — an MS-DOS 7 style command interpreter over the        */
/*  virtual file system.                                                */
/* ------------------------------------------------------------------ */

export interface DosIO {
  print(text: string): void
  clear(): void
  ask(prompt: string): Promise<string>
  askKey(prompt: string): Promise<string>
  sleep(ms: number): Promise<void>
  exit(): void
  setTitle?(title: string): void
}

const BAD = "Bad command or file name"

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}
function rpad(s: string, n: number) {
  return s.length >= n ? s : " ".repeat(n - s.length) + s
}
function num(n: number) {
  return n.toLocaleString("en-US")
}
function dosDate(ts: number) {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getFullYear()).slice(2)}`
}
function dosTime(ts: number) {
  const d = new Date(ts)
  const h = d.getHours()
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${String(hh).padStart(2, " ")}:${String(d.getMinutes()).padStart(2, "0")}${h >= 12 ? "p" : "a"}`
}

function tokenize(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let q = false
  for (const ch of line) {
    if (ch === '"') {
      q = !q
      continue
    }
    if (!q && /\s/.test(ch)) {
      if (cur) out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const HELP: Record<string, string> = {
  ATTRIB: "Displays or changes file attributes.",
  CD: "Displays the name of or changes the current directory.",
  CHKDSK: "Checks a disk and displays a status report.",
  CLS: "Clears the screen.",
  COPY: "Copies one or more files to another location.",
  DATE: "Displays or sets the date.",
  DEL: "Deletes one or more files.",
  DELTREE: "Deletes a directory and all the subdirectories and files in it.",
  DEFRAG: "Reorganizes the files on a disk to optimize the disk.",
  DIR: "Displays a list of files and subdirectories in a directory.",
  ECHO: "Displays messages, or turns command-echoing on or off.",
  EDIT: "Starts MS-DOS Editor, which creates and changes ASCII files.",
  EXIT: "Quits the MS-DOS prompt and returns to Windows.",
  FIND: "Searches for a text string in a file or files.",
  FORMAT: "Formats a disk for use with MS-DOS.",
  HELP: "Provides Help information for MS-DOS commands.",
  LABEL: "Creates, changes, or deletes the volume label of a disk.",
  MD: "Creates a directory.",
  MEM: "Displays the amount of used and free memory in your system.",
  MORE: "Displays output one screen at a time.",
  MOVE: "Moves one or more files. Also renames files and directories.",
  PATH: "Displays or sets a search path for executable files.",
  PROMPT: "Changes the MS-DOS command prompt.",
  RD: "Removes a directory.",
  REN: "Renames a file or files.",
  SCANDISK: "Checks a drive for errors and repairs them.",
  SET: "Displays, sets, or removes MS-DOS environment variables.",
  START: "Runs a Windows program or opens a document.",
  TIME: "Displays or sets the system time.",
  TREE: "Graphically displays the directory structure of a drive or path.",
  TYPE: "Displays the contents of a text file.",
  VER: "Displays the MS-DOS version.",
  VOL: "Displays a disk volume label and serial number.",
  WIN: "Starts Windows.",
  XCOPY: "Copies files and directory trees.",
  // portfolio
  ABOUT: `Displays information about ${profile.name}.`,
  CONTACT: "Shows how to get in touch.",
  README: "Displays README.TXT.",
  SOFTWARE: `Lists software written by ${profile.firstName}.`,
  OPEN: "Opens a program: OPEN <name>  (see SOFTWARE for names).",
  PING: "Sends ICMP echo requests to a network host.",
  IPCONFIG: "Displays Windows IP configuration.",
  COLOR: "Sets the console colors (COLOR 0A, COLOR 17 ...).",
  CLOCK: "Shows the current time.",
}

export class DosShell {
  cwd = "C:\\WINDOWS"
  env: Record<string, string> = {
    PATH: "C:\\WINDOWS;C:\\WINDOWS\\COMMAND",
    PROMPT: "$p$g",
    TEMP: "C:\\WINDOWS\\TEMP",
    TMP: "C:\\WINDOWS\\TEMP",
    COMSPEC: "C:\\WINDOWS\\COMMAND.COM",
    WINDIR: "C:\\WINDOWS",
    BLASTER: "A220 I5 D1 H5 P330 T6",
    USER: profile.name.toUpperCase().replace(/ /g, "_"),
  }
  echo = true
  colors: { fg: string; bg: string } = { fg: "#c0c0c0", bg: "#000000" }
  private drives: Record<string, string> = { "C:": "C:\\WINDOWS", "D:": "D:\\", "A:": "A:\\" }
  private aborted = false
  onColor?: (fg: string, bg: string) => void

  constructor(
    private io: DosIO,
    private opts: { fullscreen?: boolean } = {},
  ) {}

  abort() {
    this.aborted = true
  }

  prompt(): string {
    const p = this.env.PROMPT || "$p$g"
    const now = Date.now()
    return p.replace(/\$(.)/gi, (_, c: string) => {
      switch (c.toLowerCase()) {
        case "p":
          return this.cwd
        case "g":
          return ">"
        case "l":
          return "<"
        case "n":
          return this.cwd.slice(0, 1)
        case "d":
          return new Date(now).toDateString()
        case "t":
          return new Date(now).toLocaleTimeString()
        case "v":
          return "Windows 95"
        case "$":
          return "$"
        case "_":
          return "\n"
        case "b":
          return "|"
        case "q":
          return "="
        case "e":
          return "\x1b"
        case "h":
          return "\b"
        default:
          return ""
      }
    })
  }

  banner(): string {
    return "Microsoft(R) Windows 95\n   (C)Copyright Microsoft Corp 1981-1996.\n\n"
  }

  private out(text = "") {
    this.io.print(text + "\n")
  }

  /* ---------------- entry ---------------- */

  async exec(raw: string, depth = 0): Promise<void> {
    this.aborted = false
    let line = raw.trim()
    if (!line) return
    // variable expansion
    line = line.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, v) => this.env[v.toUpperCase()] ?? m)

    // redirection
    let redirect: { file: string; append: boolean } | null = null
    const redir = line.match(/(>>?)\s*("[^"]+"|\S+)\s*$/)
    if (redir) {
      redirect = { file: redir[2].replace(/"/g, ""), append: redir[1] === ">>" }
      line = line.slice(0, redir.index).trim()
    }
    // strip "| more"
    line = line.replace(/\|\s*more\s*$/i, "").trim()

    if (redirect) {
      const buf: string[] = []
      const realPrint = this.io.print
      this.io.print = (t: string) => buf.push(t)
      try {
        await this.dispatch(line, depth)
      } finally {
        this.io.print = realPrint
      }
      const target = fs.normalize(redirect.file, this.cwd)
      const prev = redirect.append ? fs.readFile(target) ?? "" : ""
      if (!fs.writeFile(target, prev + buf.join(""))) this.out("Access denied")
      return
    }
    await this.dispatch(line, depth)
  }

  private async dispatch(line: string, depth: number): Promise<void> {
    const tokens = tokenize(line)
    if (!tokens.length) return
    let cmd = tokens[0].toUpperCase()
    const args = tokens.slice(1)
    const argline = line.slice(tokens[0].length).trim()

    // "CD.." / "CD\" forms
    if (/^CD[.\\]/.test(cmd)) {
      args.unshift(cmd.slice(2))
      cmd = "CD"
    }
    if (/^MD\\/.test(cmd) || /^RD\\/.test(cmd)) {
      args.unshift(cmd.slice(2))
      cmd = cmd.slice(0, 2)
    }

    // drive change
    if (/^[A-Z]:$/.test(cmd) && args.length === 0) {
      await this.changeDrive(cmd)
      return
    }

    if (args[0] === "/?" && HELP[cmd]) {
      this.out(HELP[cmd])
      return
    }

    // Single-path commands accept unquoted names with spaces (CD My Documents)
    const pathArg = tokens.length > 1 && !line.includes('"') && !args.some((a) => a.startsWith("/")) ? argline : args[0]

    switch (cmd) {
      case "CD":
      case "CHDIR":
        return this.cd(pathArg)
      case "CLS":
        this.io.clear()
        return
      case "DIR":
        return this.dir(args)
      case "TYPE":
        return this.type(tokens.length > 1 ? [pathArg] : args)
      case "ECHO":
        return this.echoCmd(argline)
      case "VER":
        this.out("\nWindows 95. [Version 4.00.950]\n")
        return
      case "VOL":
        return this.vol(args[0])
      case "DATE":
        return this.date()
      case "TIME":
        return this.time()
      case "MD":
      case "MKDIR":
        return this.md(pathArg)
      case "RD":
      case "RMDIR":
        return this.rd(pathArg)
      case "DEL":
      case "ERASE":
        return this.del(args)
      case "DELTREE":
        return this.deltree(args)
      case "COPY":
        return this.copy(args)
      case "XCOPY":
      case "XCOPY32":
        return this.copy(args, true)
      case "MOVE":
        return this.move(args)
      case "REN":
      case "RENAME":
        return this.ren(args)
      case "ATTRIB":
        return this.attrib(args)
      case "TREE":
        return this.tree(args)
      case "MEM":
        return this.mem(args)
      case "SET":
        return this.set(argline)
      case "PATH":
        if (!argline) this.out(`PATH=${this.env.PATH}`)
        else this.env.PATH = argline.replace(/^=/, "")
        return
      case "PROMPT":
        this.env.PROMPT = argline || "$p$g"
        return
      case "EXIT":
        this.io.exit()
        return
      case "WIN":
        if (this.opts.fullscreen) this.io.exit()
        else this.out("Windows is already running.")
        return
      case "HELP":
        return this.help(args[0])
      case "FIND":
        return this.find(args)
      case "MORE":
        return this.type(args)
      case "EDIT":
        if (args[0]) launch("notepad", { path: fs.normalize(args[0], this.cwd) })
        else launch("notepad")
        return
      case "START":
        return this.start(argline)
      case "EXPLORER":
        if (argline) openPath(fs.normalize(argline, this.cwd))
        else launch("explorer", { path: "::MYCOMPUTER" })
        return
      case "FORMAT":
        return this.format(args)
      case "FDISK":
        this.out("\nFDISK Options\n\nCurrent fixed disk drive: 1\n\nThis disk contains a portfolio. Partitioning has been disabled\nto protect its contents.\n")
        return
      case "SCANDISK":
      case "SCANDSKW":
        launch("scandisk")
        return
      case "DEFRAG":
        launch("defrag")
        return
      case "CHKDSK":
        return this.chkdsk(args[0])
      case "LABEL":
        return this.label(args)
      case "SYS":
        this.out("System transferred")
        return
      case "DOSKEY":
        this.out("DOSKey installed.")
        return
      case "KEYB":
        this.out("Current keyboard code: US code page: 437")
        return
      case "MODE":
        this.out("\nStatus for device CON:\n----------------------\nColumns=80\nLines=25\n\nCode page operation not supported on this device\n")
        return
      case "MSCDEX":
        this.out("MSCDEX Version 2.25\nCopyright (C) Microsoft Corp. 1986-1995. All rights reserved.\n    Drive D: = Driver MSCD001 unit 0")
        return
      case "CHOICE":
        return this.choice(args)
      case "PAUSE":
        await this.io.askKey("Press any key to continue . . .")
        this.out()
        return
      case "REM":
      case "::":
        return
      case "CALL":
        return this.dispatch(argline, depth + 1)
      case "VERIFY":
      case "BREAK":
        this.out(`${cmd} is on`)
        return
      case "COMMAND":
        this.out("\nMicrosoft(R) Windows 95\n   (C)Copyright Microsoft Corp 1981-1996.\n")
        return
      case "DEBUG":
        this.out("-q")
        return
      case "SUBST":
      case "DISKCOPY":
      case "FC":
      case "SORT":
        this.out(`${cmd}: not enough parameters`)
        return
      case "COLOR":
        return this.color(args[0])
      case "TITLE":
        this.io.setTitle?.(argline || "MS-DOS Prompt")
        return
      case "CLOCK":
        this.out(new Date().toLocaleTimeString())
        return
      case "BEEP":
        sounds.beep()
        return
      // --- portfolio ---
      case "ABOUT":
      case "WHOAMI":
        return this.about()
      case "CONTACT":
        return this.contact()
      case "README":
        return this.type(["C:\\My Documents\\README.TXT"])
      case "SOFTWARE":
      case "PROJECTS":
      case "APPS":
      case "PORTFOLIO":
        return this.software()
      case "OPEN":
      case "LAUNCH":
        return this.open(args.join(" "))
      case "PING":
        return this.ping(args)
      case "TRACERT":
        return this.tracert(args)
      case "IPCONFIG":
      case "WINIPCFG":
        this.out(`\nWindows 95 IP Configuration\n\n\tHost Name . . . . . . . . . : ${profile.firstName.toLowerCase()}-pc\n\tDNS Servers . . . . . . . . : 192.168.0.1\n\tNode Type . . . . . . . . . : Broadcast\n\nDial-Up Adapter:\n\n\tIP Address. . . . . . . . . : 192.168.0.95\n\tSubnet Mask . . . . . . . . : 255.255.255.0\n\tDefault Gateway . . . . . . : 192.168.0.1\n`)
        return
      case "NET":
        this.out("\nThe command completed successfully.\n")
        return
      case "NETSTAT":
        this.out("\nActive Connections\n\n  Proto  Local Address          Foreign Address        State\n  TCP    benjamin-pc:1027       portfolio.local:80     ESTABLISHED\n")
        return
      case "TELNET":
        launch("hyperterm", { host: args[0] })
        return
      case "FTP":
        this.out(`ftp> ${args[0] ? `connect ${args[0]}: Connection refused` : "bye"}`)
        return
      case "TASKLIST":
      case "TASKMGR":
        launch("taskman")
        return
      case "NOTEPAD":
      case "CALC":
      case "SOL":
      case "WINMINE":
      case "FREECELL":
      case "MSHEARTS":
      case "PBRUSH":
      case "MSPAINT":
      case "WRITE":
      case "WORDPAD":
      case "CHARMAP":
      case "CONTROL":
      case "REGEDIT":
      case "MPLAYER":
      case "CDPLAYER":
      case "SNDVOL32":
      case "SNDREC32":
      case "DIALER":
      case "HYPERTRM":
      case "IEXPLORE":
      case "WINVER":
      case "WINHELP":
      case "WINHLP32":
      case "TASKMAN":
      case "PROGMAN":
      case "WELCOME":
      case "SYSMON":
      case "RSRCMTR":
      case "DRVSPACE":
      case "BACKUP":
      case "CLIPBRD":
      case "CLOCK.EXE":
        if (shellRun(line, this.cwd)) return
        this.out(BAD)
        return
    }

    // Run a file / program by name
    if (await this.runFile(tokens[0], args, depth)) return
    // Known Windows alias?
    if (shellRun(tokens[0], this.cwd)) return
    this.out(BAD)
  }

  /* ---------------- helpers ---------------- */

  private async changeDrive(letter: string) {
    const ready = fs.driveReady(letter)
    if (!fs.drives[letter]) {
      this.out("Invalid drive specification")
      return
    }
    if (!ready) {
      for (;;) {
        this.out(`\nNot ready reading drive ${letter[0]}`)
        const k = (await this.io.askKey("Abort, Retry, Fail?")).toUpperCase()
        this.out(k)
        if (k === "R") continue
        if (k === "F") {
          this.out("Current drive is no longer valid>")
          break
        }
        break
      }
      return
    }
    this.drives[this.cwd.slice(0, 2)] = this.cwd
    this.cwd = this.drives[letter] ?? letter + "\\"
  }

  private cd(arg?: string) {
    if (!arg) {
      this.out(this.cwd)
      return
    }
    const target = fs.normalize(arg, this.cwd)
    if (/^[A-Z]:$/i.test(arg)) {
      this.out(this.drives[arg.toUpperCase()] ?? arg.toUpperCase() + "\\")
      return
    }
    if (!fs.driveReady(target)) {
      this.out("Invalid drive specification")
      return
    }
    const node = fs.get(target)
    if (!node || node.type !== "dir") {
      this.out("Invalid directory")
      return
    }
    const real = fs.realPath(target)
    if (real.slice(0, 2) !== this.cwd.slice(0, 2)) {
      // CD to another drive sets that drive's directory but does not switch
      this.drives[real.slice(0, 2)] = real
      return
    }
    this.cwd = real
  }

  private volumeInfo(drive: string) {
    const d = fs.drives[drive]
    const label = d?.drive?.label
    const serial = `${(1234 + drive.charCodeAt(0)).toString(16).toUpperCase().padStart(4, "0")}-${(43981).toString(16).toUpperCase()}`
    return { label, serial }
  }

  private vol(arg?: string) {
    const drive = (arg ? arg.slice(0, 2) : this.cwd.slice(0, 2)).toUpperCase()
    if (!fs.drives[drive]) {
      this.out("Invalid drive specification")
      return
    }
    if (!fs.driveReady(drive)) {
      this.out(`\nNot ready reading drive ${drive[0]}\nAbort, Retry, Fail?f`)
      return
    }
    const { label, serial } = this.volumeInfo(drive)
    this.out(`\n Volume in drive ${drive[0]} ${label ? "is " + label : "has no label"}\n Volume Serial Number is ${serial}`)
  }

  private dir(args: string[]) {
    const flags = new Set(args.filter((a) => a.startsWith("/")).map((a) => a.toUpperCase().slice(1)))
    const target = args.find((a) => !a.startsWith("/"))
    const wide = flags.has("W") || flags.has("/W")
    const bare = flags.has("B")
    const showHidden = Array.from(flags).some((f) => f.startsWith("A"))
    const recurse = flags.has("S")

    let dirPath = this.cwd
    let glob = "*"
    if (target) {
      const n = fs.normalize(target, this.cwd)
      if (/^[A-Z]:$/i.test(target)) dirPath = this.drives[target.toUpperCase()] ?? target.toUpperCase() + "\\"
      else if (fs.isDir(n)) dirPath = n
      else {
        dirPath = fs.parent(n)
        glob = fs.basename(n)
      }
    }
    if (!fs.driveReady(dirPath)) {
      this.out(`\nNot ready reading drive ${dirPath[0]}\nAbort, Retry, Fail?f`)
      return
    }
    if (!fs.isDir(dirPath)) {
      this.out("File not found")
      return
    }
    const drive = dirPath.slice(0, 2)
    const { label, serial } = this.volumeInfo(drive)
    if (!bare) {
      this.out(`\n Volume in drive ${drive[0]} ${label ? "is " + label : "has no label"}`)
      this.out(` Volume Serial Number is ${serial}`)
    }

    let totalFiles = 0
    let totalDirs = 0
    let totalBytes = 0

    const listOne = (p: string) => {
      const real = fs.realPath(p)
      const items = matchGlob(fs, p, glob, { hidden: showHidden })
      if (!bare) {
        this.out(` Directory of ${real}\n`)
      }
      const dirNode = fs.get(p) as FSDir
      const isRoot = fs.split(p).parts.length === 0
      const names = items.map((i) => i.name)
      let files = 0
      let dirs = 0
      let bytes = 0
      if (wide) {
        const cells: string[] = []
        if (!isRoot && glob === "*") cells.push("[.]", "[..]")
        for (const it of items) cells.push(it.type === "dir" ? `[${shortName(it.name, names)}]` : shortName(it.name, names))
        for (let i = 0; i < cells.length; i += 5) this.out(cells.slice(i, i + 5).map((c) => pad(c, 16)).join(""))
      } else if (bare) {
        for (const it of items) this.out(recurse ? real.replace(/\\$/, "") + "\\" + it.name : it.name)
      } else {
        if (!isRoot && glob === "*") {
          this.out(`${pad(".", 8)} ${pad("", 3)}  ${pad("<DIR>", 14)} ${dosDate(dirNode.modified)}  ${dosTime(dirNode.modified)} .`)
          this.out(`${pad("..", 8)} ${pad("", 3)}  ${pad("<DIR>", 14)} ${dosDate(dirNode.modified)}  ${dosTime(dirNode.modified)} ..`)
        }
        for (const it of items) {
          const sn = shortName(it.name, names)
          const dot = sn.lastIndexOf(".")
          const base = dot > 0 ? sn.slice(0, dot) : sn
          const e = dot > 0 ? sn.slice(dot + 1) : ""
          const size = it.type === "dir" ? "<DIR>" : num(fs.sizeOf(it))
          const sizeCol = it.type === "dir" ? pad(size, 14) : rpad(size, 14)
          this.out(`${pad(base, 8)} ${pad(e, 3)}  ${sizeCol} ${dosDate(it.modified)}  ${dosTime(it.modified)} ${it.name}`)
        }
      }
      for (const it of items) {
        if (it.type === "dir") dirs++
        else {
          files++
          bytes += fs.sizeOf(it)
        }
      }
      totalFiles += files
      totalDirs += dirs
      totalBytes += bytes
      if (!bare) {
        this.out(`${rpad(String(files), 10)} file(s) ${rpad(num(bytes), 14)} bytes`)
        if (!recurse) {
          const d = fs.drives[drive]
          const free = Math.max(0, (d?.drive?.total ?? 0) - fs.usedSpace(drive))
          this.out(`${rpad(String(dirs + (!isRoot && glob === "*" ? 2 : 0)), 10)} dir(s) ${rpad(num(free), 15)} bytes free`)
        } else this.out()
      }
      if (recurse) {
        for (const it of fs.list(p, { hidden: showHidden })) if (it.type === "dir") listOne(p.replace(/\\$/, "") + "\\" + it.name)
      }
    }
    listOne(dirPath)
    if (recurse && !bare) {
      const d = fs.drives[drive]
      const free = Math.max(0, (d?.drive?.total ?? 0) - fs.usedSpace(drive))
      this.out(`Total files listed:\n${rpad(String(totalFiles), 10)} file(s) ${rpad(num(totalBytes), 14)} bytes\n${rpad(String(totalDirs), 10)} dir(s) ${rpad(num(free), 15)} bytes free`)
    }
  }

  private type(args: string[]) {
    if (!args[0]) {
      this.out("Required parameter missing")
      return
    }
    const p = fs.normalize(args[0], this.cwd)
    const node = fs.get(p)
    if (!node) {
      this.out("File not found - " + args[0].toUpperCase())
      return
    }
    if (node.type === "dir") {
      this.out("Access denied - " + args[0].toUpperCase())
      return
    }
    if (!node.content && node.size) {
      // binary gibberish
      let s = ""
      const n = Math.min(400, node.size)
      for (let i = 0; i < n; i++) s += String.fromCharCode(0x2591 + ((i * 7919 + node.size) % 3) * (i % 3 ? 1 : 0) + (i % 11 === 0 ? 0 : 0))
      this.out(`MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u00ff\u00ff\u0000\u0000\u00b8\u0000\u0000\u0000\u0000\u0000\u0000\u0000@\u0000\u0000\u0000` + s.slice(0, 300) + "\nThis program cannot be run in DOS mode.\n")
      return
    }
    this.out(node.content)
  }

  private echoCmd(argline: string) {
    if (!argline) {
      this.out(`ECHO is ${this.echo ? "on" : "off"}`)
      return
    }
    const up = argline.toUpperCase()
    if (up === "ON") {
      this.echo = true
      return
    }
    if (up === "OFF") {
      this.echo = false
      return
    }
    if (argline.startsWith(".")) {
      this.out(argline.slice(1))
      return
    }
    this.out(argline)
  }

  private async date() {
    const d = new Date()
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    this.out(`Current date is ${days[d.getDay()]} ${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`)
    const r = await this.io.ask("Enter new date (mm-dd-yy): ")
    if (r.trim()) this.out("Invalid date")
  }

  private async time() {
    const d = new Date()
    this.out(`Current time is ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}.${String(Math.floor(d.getMilliseconds() / 10)).padStart(2, "0")}`)
    const r = await this.io.ask("Enter new time: ")
    if (r.trim()) this.out("Invalid time")
  }

  private md(arg?: string) {
    if (!arg) {
      this.out("Required parameter missing")
      return
    }
    const p = fs.normalize(arg, this.cwd)
    if (fs.exists(p)) {
      this.out("Directory already exists")
      return
    }
    if (!fs.mkdir(p)) this.out("Unable to create directory")
  }

  private rd(arg?: string) {
    if (!arg) {
      this.out("Required parameter missing")
      return
    }
    const p = fs.normalize(arg, this.cwd)
    const node = fs.get(p)
    if (!node || node.type !== "dir" || fs.realPath(p) === this.cwd || !fs.remove(p, false)) {
      this.out("Invalid path, not directory,\nor directory not empty")
    }
  }

  private async del(args: string[]) {
    const target = args.find((a) => !a.startsWith("/"))
    if (!target) {
      this.out("Required parameter missing")
      return
    }
    const p = fs.normalize(target, this.cwd)
    let dirPath = p
    let glob = "*"
    const node = fs.get(p)
    if (node && node.type === "dir") {
      glob = "*"
    } else {
      dirPath = fs.parent(p)
      glob = fs.basename(p)
    }
    if (!fs.isDir(dirPath)) {
      this.out("File not found")
      return
    }
    const matches = matchGlob(fs, dirPath, glob).filter((n) => n.type === "file")
    if (!matches.length) {
      this.out("File not found")
      return
    }
    if (glob === "*" || glob === "*.*") {
      const k = await this.io.askKey("All files in directory will be deleted!\nAre you sure (Y/N)?")
      this.out(k)
      if (k.toUpperCase() !== "Y") return
    }
    for (const m of matches) {
      if ((m as { readonly?: boolean }).readonly) {
        this.out(`Access denied - ${m.name.toUpperCase()}`)
        continue
      }
      fs.remove(dirPath.replace(/\\$/, "") + "\\" + m.name)
    }
  }

  private async deltree(args: string[]) {
    const target = args.find((a) => !a.startsWith("/"))
    const yes = args.some((a) => a.toUpperCase() === "/Y")
    if (!target) {
      this.out("Required parameter missing")
      return
    }
    const p = fs.normalize(target, this.cwd)
    const node = fs.get(p)
    if (!node) {
      this.out(`${target} not found`)
      return
    }
    if (!yes) {
      const k = await this.io.askKey(`Delete ${node.type === "dir" ? "directory" : "file"} "${fs.realPath(p)}" and all its subdirectories? [yn] `)
      this.out(k)
      if (k.toUpperCase() !== "Y") return
    }
    this.out(`Deleting ${fs.realPath(p)}...`)
    if (fs.realPath(p) === "C:\\WINDOWS" || fs.realPath(p) === "C:\\") {
      this.out("Access denied - this is the portfolio's system directory.")
      return
    }
    if (!fs.remove(p, true)) this.out("Unable to delete")
  }

  private copy(args: string[], xcopy = false) {
    const files = args.filter((a) => !a.startsWith("/"))
    if (files.length < 1) {
      this.out("Required parameter missing")
      return
    }
    const src = fs.normalize(files[0], this.cwd)
    const dst = fs.normalize(files[1] ?? ".", this.cwd)
    let srcDir = src
    let glob = "*"
    const sNode = fs.get(src)
    if (!sNode || sNode.type === "file") {
      srcDir = fs.parent(src)
      glob = fs.basename(src)
    } else if (!xcopy) {
      // copy dir\* semantics
    }
    const matches = matchGlob(fs, srcDir, glob).filter((n) => xcopy || n.type === "file")
    if (!matches.length) {
      this.out("File not found - " + fs.basename(src).toUpperCase())
      this.out("        0 file(s) copied")
      return
    }
    let n = 0
    for (const m of matches) {
      const from = srcDir.replace(/\\$/, "") + "\\" + m.name
      const ok = fs.copy(from, dst)
      if (ok) {
        n++
        if (xcopy) this.out(from)
      } else this.out(`Unable to copy ${m.name}`)
    }
    this.out(`        ${n} file(s) copied`)
  }

  private move(args: string[]) {
    const files = args.filter((a) => !a.startsWith("/"))
    if (files.length < 2) {
      this.out("Required parameter missing")
      return
    }
    const src = fs.normalize(files[0], this.cwd)
    const dst = fs.normalize(files[1], this.cwd)
    if (!fs.exists(src)) {
      this.out(`Cannot move ${files[0]} - No such file or directory`)
      return
    }
    if (fs.move(src, dst)) this.out(`${fs.realPath(src)} => ${fs.realPath(dst)} [ok]`)
    else this.out(`Cannot move ${files[0]} - Access denied`)
  }

  private ren(args: string[]) {
    if (args.length < 2) {
      this.out("Required parameter missing")
      return
    }
    const src = fs.normalize(args[0], this.cwd)
    if (!fs.exists(src)) {
      this.out("File not found")
      return
    }
    if (!fs.rename(src, args[1])) this.out("Duplicate file name or file not found")
  }

  private attrib(args: string[]) {
    const target = args.find((a) => !/^[+-/]/.test(a))
    const p = target ? fs.normalize(target, this.cwd) : this.cwd
    let dirPath = p
    let glob = "*"
    if (!fs.isDir(p)) {
      dirPath = fs.parent(p)
      glob = fs.basename(p)
    }
    const items = matchGlob(fs, dirPath, glob, { hidden: true })
    const setFlags = args.filter((a) => /^[+-][ARSH]$/i.test(a))
    for (const it of items) {
      const f = it as { readonly?: boolean; hidden?: boolean; system?: boolean }
      for (const s of setFlags) {
        const on = s[0] === "+"
        const c = s[1].toUpperCase()
        if (c === "R") f.readonly = on
        if (c === "H") f.hidden = on
        if (c === "S") f.system = on
      }
      if (!setFlags.length) {
        const flags = `${f.readonly ? "R" : " "}${f.hidden ? "H" : " "}${f.system ? "S" : " "}${it.type === "file" ? "A" : " "}`
        this.out(`${flags}     ${fs.realPath(dirPath).replace(/\\$/, "")}\\${it.name}`)
      }
    }
  }

  private tree(args: string[]) {
    const target = args.find((a) => !a.startsWith("/"))
    const showFiles = args.some((a) => a.toUpperCase() === "/F")
    const p = target ? fs.normalize(target, this.cwd) : this.cwd
    if (!fs.isDir(p)) {
      this.out("Invalid path - " + (target ?? ""))
      return
    }
    const drive = p.slice(0, 2)
    const { label } = this.volumeInfo(drive)
    this.out(`Directory PATH listing${label ? " for Volume " + label : ""}`)
    this.out(fs.realPath(p))
    let count = 0
    const walk = (dir: string, prefix: string) => {
      const items = fs.list(dir)
      const dirs = items.filter((i) => i.type === "dir")
      const files = items.filter((i) => i.type === "file")
      if (showFiles) for (const f of files) this.out(`${prefix}    ${f.name}`)
      dirs.forEach((d, i) => {
        if (count++ > 400) return
        const last = i === dirs.length - 1
        this.out(`${prefix}${last ? "\u2514" : "\u251c"}\u2500\u2500\u2500${d.name}`)
        walk(dir.replace(/\\$/, "") + "\\" + d.name, prefix + (last ? "    " : "\u2502   "))
      })
    }
    walk(p, "")
  }

  private mem(args: string[]) {
    const c = args.some((a) => /^\/C/i.test(a))
    this.out()
    if (c) {
      this.out("Modules using memory below 1 MB:\n")
      this.out("  Name           Total           Conventional       Upper Memory")
      this.out("  --------  ----------------   ----------------   ----------------")
      this.out("  SYSTEM      17,120   (17K)     10,096   (10K)      7,024    (7K)")
      this.out("  HIMEM        1,168    (1K)      1,168    (1K)          0    (0K)")
      this.out("  EMM386       4,320    (4K)      4,320    (4K)          0    (0K)")
      this.out("  WIN          3,696    (4K)      3,696    (4K)          0    (0K)")
      this.out("  vmm32          960    (1K)        960    (1K)          0    (0K)")
      this.out("  COMMAND      7,616    (7K)      7,616    (7K)          0    (0K)")
      this.out("  MSCDEX      27,760   (27K)          0    (0K)     27,760   (27K)")
      this.out("  DOSKEY       4,688    (5K)          0    (0K)      4,688    (5K)")
      this.out("  Free       634,784  (620K)    627,936  (613K)      6,848    (7K)\n")
    }
    this.out("Memory Type        Total       Used       Free")
    this.out("----------------  --------   --------   --------")
    this.out("Conventional          640K        27K       613K")
    this.out("Upper                  46K        39K         7K")
    this.out("Reserved              384K       384K         0K")
    this.out("Extended (XMS)     31,698K     2,466K    29,232K")
    this.out("----------------  --------   --------   --------")
    this.out("Total memory       32,768K     2,916K    29,852K\n")
    this.out("Total under 1 MB      686K        66K       620K\n")
    this.out("Largest executable program size        613K (627,936 bytes)")
    this.out("Largest free upper memory block          7K   (6,848 bytes)")
    this.out("MS-DOS is resident in the high memory area.")
  }

  private set(argline: string) {
    if (!argline) {
      for (const [k, v] of Object.entries(this.env)) this.out(`${k}=${v}`)
      return
    }
    const eq = argline.indexOf("=")
    if (eq < 0) {
      const v = this.env[argline.toUpperCase()]
      this.out(v ? `${argline.toUpperCase()}=${v}` : "Environment variable not defined")
      return
    }
    const k = argline.slice(0, eq).trim().toUpperCase()
    const v = argline.slice(eq + 1)
    if (!v) delete this.env[k]
    else this.env[k] = v
  }

  private help(topic?: string) {
    if (topic && HELP[topic.toUpperCase()]) {
      this.out(HELP[topic.toUpperCase()])
      return
    }
    this.out("For more information on a specific command, type HELP command-name.\n")
    const keys = Object.keys(HELP).sort()
    const portfolio = ["ABOUT", "CONTACT", "README", "SOFTWARE", "OPEN", "PING", "IPCONFIG", "COLOR", "CLOCK"]
    for (const k of keys) if (!portfolio.includes(k)) this.out(`${pad(k, 10)}${HELP[k]}`)
    this.out(`\n${profile.firstName}'s commands:`)
    for (const k of portfolio) this.out(`${pad(k, 10)}${HELP[k]}`)
    this.out("\nYou can also type the name of any Windows program (NOTEPAD, CALC, SOL, WINMINE...)\nor a file name to open it.")
  }

  private find(args: string[]) {
    const quoted = args.find((a) => !a.startsWith("/"))
    if (!quoted) {
      this.out("FIND: Parameter format not correct")
      return
    }
    const files = args.filter((a) => a !== quoted && !a.startsWith("/"))
    if (!files.length) {
      this.out("FIND: Required parameter missing")
      return
    }
    for (const f of files) {
      const p = fs.normalize(f, this.cwd)
      const content = fs.readFile(p)
      this.out(`\n---------- ${fs.basename(p).toUpperCase()}`)
      if (content === null) {
        this.out(`File not found - ${f.toUpperCase()}`)
        continue
      }
      for (const line of content.split("\n")) if (line.toLowerCase().includes(quoted.toLowerCase())) this.out(line)
    }
  }

  private start(argline: string) {
    if (!argline) {
      launch("dos")
      return
    }
    const sw = software.find((s) => s.slug === argline.toLowerCase() || s.name.toLowerCase() === argline.toLowerCase())
    if (sw) {
      launch("sw:" + sw.slug)
      return
    }
    if (!shellRun(argline, this.cwd)) this.out(`Cannot find the file '${argline}'`)
  }

  private async format(args: string[]) {
    const drive = (args.find((a) => /^[A-Z]:$/i.test(a)) ?? "").toUpperCase()
    if (!drive) {
      this.out("Required parameter missing")
      return
    }
    if (!fs.drives[drive]) {
      this.out("Invalid drive specification")
      return
    }
    if (drive === "C:" || drive === "D:") {
      this.out(`\nWARNING, ALL DATA ON NON-REMOVABLE DISK\nDRIVE ${drive} WILL BE LOST!\nProceed with Format (Y/N)?`)
      const k = await this.io.askKey("")
      this.out(k)
      if (k.toUpperCase() !== "Y") return
      this.out(`\nChecking existing disk format.`)
      await this.io.sleep(900)
      this.out(`Formatting ${drive === "C:" ? "2,047.52M" : "650.00M"}`)
      for (let i = 1; i <= 10; i++) {
        await this.io.sleep(200)
        this.io.print(`\r${i * 10} percent completed.`)
        if (i === 4) {
          this.out(`\n\nFormat terminated: ${drive === "C:" ? "Write protect error writing drive C" : "Cannot format a CD-ROM"}.`)
          this.out(drive === "C:" ? "\n(Nice try. The portfolio drive is protected.)" : "")
          return
        }
      }
      return
    }
    this.out(`\nInsert new diskette for drive ${drive}\nand press ENTER when ready...`)
    await this.io.ask("")
    this.out(`\nNot ready reading drive ${drive[0]}\nAbort, Retry, Fail?a`)
  }

  private chkdsk(arg?: string) {
    const drive = (arg ? arg.slice(0, 2) : this.cwd.slice(0, 2)).toUpperCase()
    const d = fs.drives[drive]
    if (!d || !fs.driveReady(drive)) {
      this.out("Invalid drive specification")
      return
    }
    const total = d.drive?.total ?? 0
    const used = fs.usedSpace(drive)
    const { label } = this.volumeInfo(drive)
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
    this.out(`\nVolume ${label ?? ""} created ${dosDate(d.modified)} ${dosTime(d.modified)}`)
    this.out(`Volume Serial Number is ${this.volumeInfo(drive).serial}\n`)
    this.out(`${rpad(num(total), 15)} bytes total disk space`)
    this.out(`${rpad(num(hidden * 32768), 15)} bytes in ${hidden} hidden files`)
    this.out(`${rpad(num(dirs * 32768), 15)} bytes in ${dirs} directories`)
    this.out(`${rpad(num(used), 15)} bytes in ${files} user files`)
    this.out(`${rpad(num(Math.max(0, total - used)), 15)} bytes available on disk\n`)
    this.out(`${rpad(num(32768), 15)} bytes in each allocation unit`)
    this.out(`${rpad(num(Math.floor(total / 32768)), 15)} total allocation units on disk`)
    this.out(`${rpad(num(Math.floor(Math.max(0, total - used) / 32768)), 15)} available allocation units on disk\n`)
    this.out(`${rpad(num(655360), 15)} total bytes memory`)
    this.out(`${rpad(num(627936), 15)} bytes free\n`)
    this.out("Instead of using CHKDSK, try using SCANDISK. SCANDISK can reliably detect\nand fix a much wider range of disk problems.")
  }

  private label(args: string[]) {
    const drive = (args.find((a) => /^[A-Z]:$/i.test(a)) ?? this.cwd.slice(0, 2)).toUpperCase()
    const d = fs.drives[drive]
    if (!d || !d.drive) {
      this.out("Invalid drive specification")
      return
    }
    const name = args.find((a) => !/^[A-Z]:$/i.test(a))
    if (name) {
      d.drive.label = name.toUpperCase().slice(0, 11)
      return
    }
    this.out(`Volume in drive ${drive[0]} ${d.drive.label ? "is " + d.drive.label : "has no label"}`)
  }

  private async choice(args: string[]) {
    const text = args.filter((a) => !a.startsWith("/")).join(" ")
    const k = await this.io.askKey(`${text}[Y,N]?`)
    this.out(k.toUpperCase())
  }

  private color(arg?: string) {
    const pal = ["#000000", "#0000a8", "#00a800", "#00a8a8", "#a80000", "#a800a8", "#a85400", "#a8a8a8", "#545454", "#5454fc", "#54fc54", "#54fcfc", "#fc5454", "#fc54fc", "#fcfc54", "#ffffff"]
    if (!arg || !/^[0-9a-f]{1,2}$/i.test(arg)) {
      this.colors = { fg: "#c0c0c0", bg: "#000000" }
    } else {
      const v = arg.toLowerCase()
      const bg = v.length === 2 ? parseInt(v[0], 16) : 0
      const fg = parseInt(v[v.length - 1], 16)
      if (bg === fg) {
        return
      }
      this.colors = { fg: pal[fg], bg: pal[bg] }
    }
    this.onColor?.(this.colors.fg, this.colors.bg)
  }

  /* ---------------- portfolio ---------------- */

  private about() {
    this.out()
    this.out(` ${profile.name}`)
    this.out(` ${"=".repeat(profile.name.length)}`)
    this.out(` ${profile.title}${profile.location ? " - " + profile.location : ""}`)
    this.out()
    for (const para of profile.bio.split("\n\n")) this.out(wrap(para, 76) + "\n")
    this.out(" Skills: " + profile.skills.join(", "))
    this.out()
    this.out(" Type SOFTWARE to list my programs, CONTACT to reach me.")
  }

  private contact() {
    this.out(`\n Contact ${profile.name}\n`)
    this.out(` Email : ${profile.email}`)
    for (const l of profile.links) if (!l.url.startsWith("mailto:")) this.out(` ${pad(l.label, 6)}: ${l.url}`)
    this.out()
  }

  private software() {
    this.out()
    if (!software.length) {
      this.out(" No software registered yet.")
      this.out(" (Add entries to lib/win95/portfolio.ts)")
      this.out()
      return
    }
    this.out(` Software by ${profile.name}:\n`)
    this.out(` ${pad("NAME", 14)}${pad("VERSION", 9)}${pad("YEAR", 6)}DESCRIPTION`)
    this.out(` ${"-".repeat(13)} ${"-".repeat(8)} ${"-".repeat(5)} ${"-".repeat(40)}`)
    for (const s of software) this.out(` ${pad(s.slug.toUpperCase(), 14)}${pad(s.version ?? "", 9)}${pad(s.year ?? "", 6)}${s.tagline}`)
    this.out(`\n Type OPEN <name> to launch one, e.g. OPEN ${software[0].slug.toUpperCase()}`)
    this.out()
  }

  private open(name: string) {
    if (!name) {
      this.out("Required parameter missing. Type SOFTWARE for a list.")
      return
    }
    const sw = software.find((s) => s.slug === name.toLowerCase() || s.name.toLowerCase() === name.toLowerCase())
    if (sw) {
      this.out(`Starting ${sw.name}...`)
      launch("sw:" + sw.slug)
      return
    }
    if (shellRun(name, this.cwd)) return
    this.out(`Cannot find '${name}'. Type SOFTWARE for a list.`)
  }

  private async ping(args: string[]) {
    const host = args.find((a) => !a.startsWith("-")) ?? ""
    if (!host) {
      this.out("\nUsage: ping [-t] [-n count] target_name")
      return
    }
    const ip = `${(hashStr(host) % 200) + 20}.${(hashStr(host + "1") % 250) + 1}.${(hashStr(host + "2") % 250) + 1}.${(hashStr(host + "3") % 250) + 1}`
    this.out(`\nPinging ${host} [${ip}] with 32 bytes of data:\n`)
    const times: number[] = []
    for (let i = 0; i < 4; i++) {
      if (this.aborted) break
      await this.io.sleep(700)
      const t = 20 + Math.floor(Math.random() * 60)
      times.push(t)
      this.out(`Reply from ${ip}: bytes=32 time=${t}ms TTL=${128 - (hashStr(host) % 40)}`)
    }
    const min = Math.min(...times)
    const max = Math.max(...times)
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    this.out(`\nPing statistics for ${ip}:\n    Packets: Sent = ${times.length}, Received = ${times.length}, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`)
  }

  private async tracert(args: string[]) {
    const host = args[0]
    if (!host) {
      this.out("\nUsage: tracert target_name")
      return
    }
    this.out(`\nTracing route to ${host}\nover a maximum of 30 hops:\n`)
    const hops = ["192.168.0.1", "10.0.0.1", "isp-gw.net [172.16.4.1]", "core1.1995.net [204.152.189.116]", `${host}`]
    for (let i = 0; i < hops.length; i++) {
      if (this.aborted) break
      await this.io.sleep(600)
      const t = () => `${10 + i * 15 + Math.floor(Math.random() * 10)} ms`
      this.out(`  ${i + 1}    ${t()}    ${t()}    ${t()}  ${hops[i]}`)
    }
    this.out("\nTrace complete.")
  }

  /* ---------------- programs & batch files ---------------- */

  private async runFile(name: string, args: string[], depth: number): Promise<boolean> {
    const candidates: string[] = []
    const base = fs.normalize(name, this.cwd)
    candidates.push(base, base + ".EXE", base + ".COM", base + ".BAT")
    for (const dir of this.env.PATH.split(";")) {
      candidates.push(fs.normalize(name, dir), fs.normalize(name + ".EXE", dir), fs.normalize(name + ".COM", dir), fs.normalize(name + ".BAT", dir))
    }
    for (const c of candidates) {
      const node = fs.get(c)
      if (!node) continue
      if (node.type === "dir") continue
      const up = node.name.toUpperCase()
      if (up.endsWith(".BAT")) {
        await this.runBatch(node.content, args, depth)
        return true
      }
      if (node.exe) {
        if (node.exe === "dos" || node.exe === "win") {
          this.out(node.exe === "win" ? "Windows is already running." : "\nMicrosoft(R) Windows 95\n   (C)Copyright Microsoft Corp 1981-1996.\n")
          return true
        }
        launch(node.exe)
        return true
      }
      if (up.endsWith(".EXE") || up.endsWith(".COM")) {
        this.out("This program requires Microsoft Windows.")
        return true
      }
      // documents
      openPath(c)
      return true
    }
    return false
  }

  private async runBatch(content: string, args: string[], depth: number) {
    if (depth > 8) {
      this.out("Batch file nesting too deep")
      return
    }
    const lines = content.split(/\r?\n/)
    const labels = new Map<string, number>()
    lines.forEach((l, i) => {
      const m = l.trim().match(/^:(\S+)/)
      if (m) labels.set(m[1].toUpperCase(), i)
    })
    let pc = 0
    let steps = 0
    while (pc < lines.length && steps++ < 2000 && !this.aborted) {
      let line = lines[pc++].trim()
      if (!line || line.startsWith(":")) continue
      let silent = false
      if (line.startsWith("@")) {
        silent = true
        line = line.slice(1).trim()
      }
      line = line.replace(/%(\d)/g, (_, d) => args[+d - 1] ?? "")
      const up = line.toUpperCase()
      if (this.echo && !silent) this.out(`\n${this.prompt()}${line}`)
      if (up.startsWith("GOTO ")) {
        const target = labels.get(line.slice(5).trim().toUpperCase())
        if (target === undefined) {
          this.out("Label not found")
          return
        }
        pc = target
        continue
      }
      if (up.startsWith("IF ")) {
        const m = line.match(/^IF\s+(NOT\s+)?EXIST\s+(\S+)\s+(.+)$/i)
        if (m) {
          const exists = fs.exists(fs.normalize(m[2], this.cwd))
          if (exists !== !!m[1]) await this.exec(m[3], depth + 1)
          continue
        }
        const eq = line.match(/^IF\s+(NOT\s+)?(\S+)==(\S+)\s+(.+)$/i)
        if (eq) {
          const same = eq[2].replace(/"/g, "") === eq[3].replace(/"/g, "")
          if (same !== !!eq[1]) await this.exec(eq[4], depth + 1)
          continue
        }
        continue
      }
      await this.exec(line, depth + 1)
    }
  }
}

function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function wrap(text: string, width: number): string {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      lines.push(" " + cur.trim())
      cur = w
    } else cur += " " + w
  }
  if (cur.trim()) lines.push(" " + cur.trim())
  return lines.join("\n")
}
