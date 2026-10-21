/**
 * ===========================================================================
 *  PORTFOLIO DATA — this is the one file to edit when adding your software.
 * ===========================================================================
 *
 * Each entry in `software` becomes, automatically:
 *   - a desktop shortcut
 *   - an item under Start > Programs > Benjamin Ferguson Software
 *   - a folder in C:\Program Files\<name>\ with a launchable .EXE
 *   - an entry in Control Panel > Add/Remove Programs
 *   - a `start <slug>` command in the MS-DOS Prompt
 *   - a program window (the "app") showing logo, description, screenshots, links
 *
 * Put logo files in /public/software/<slug>/ and reference them as
 * "/software/<slug>/logo.png". Screenshots work the same way.
 */

export interface Software {
  /** URL-safe id, e.g. "taskflow". Also used as the DOS command: `start taskflow` */
  slug: string
  /** Display name, e.g. "TaskFlow" */
  name: string
  /** One-line tagline shown under the name */
  tagline: string
  /** Longer description. Plain text; blank lines make paragraphs. */
  description: string
  /** Path to logo image (32x32 or larger, square). Used as the icon everywhere. */
  logo: string
  /** Optional 16x16 version of the logo for title bars / small icons */
  logoSmall?: string
  /** Version string shown in Add/Remove Programs and the About box */
  version?: string
  /** Year released */
  year?: string
  /** Tech / tags, e.g. ["TypeScript", "Electron"] */
  tags?: string[]
  /** Bullet list of features */
  features?: string[]
  /** Screenshot image paths */
  screenshots?: string[]
  /** Links: website, download, source */
  website?: string
  download?: string
  source?: string
  /** Approximate install size shown in Add/Remove Programs, e.g. "4.2 MB" */
  size?: string
}

export interface Profile {
  name: string
  firstName: string
  title: string
  email: string
  location?: string
  bio: string
  skills: string[]
  links: { label: string; url: string; icon?: string }[]
  /** Shown in the Welcome dialog's "Did you know..." box */
  tips: string[]
  /** Registered-to string in System Properties / About Windows */
  company?: string
}

export const profile: Profile = {
  name: "Benjamin Ferguson",
  firstName: "Benjamin",
  title: "Software Developer",
  email: "benjiferg@gmail.com",
  location: "",
  bio: `Hi, I'm Benjamin Ferguson. I build software.

This desktop is my portfolio. Every program under Start > Programs > Benjamin Ferguson Software is something I made. Double-click one to read about it, see screenshots and launch it.

The rest of the machine is a working recreation of Windows 95: open the MS-DOS Prompt and type HELP, play a round of Solitaire, or poke around My Computer.`,
  skills: ["Software Development", "Web", "Desktop Apps", "Tooling"],
  links: [
    { label: "Email", url: "mailto:benjiferg@gmail.com", icon: "envelope_closed" },
    // { label: "GitHub", url: "https://github.com/...", icon: "world" },
    // { label: "LinkedIn", url: "https://linkedin.com/in/...", icon: "user_world" },
  ],
  tips: [
    "You can open the MS-DOS Prompt from Start > Programs and type HELP to see every command.",
    "Double-click a program in Start > Programs > Benjamin Ferguson Software to read about it.",
    "Right-click the desktop and choose Properties to change the wallpaper and colors.",
    "Press Alt+F4 to close the active window.",
    "Type README in the MS-DOS Prompt to read about this site.",
    "You can drag windows by their title bar and resize them from any edge.",
    "Minesweeper, Solitaire, FreeCell and Hearts are all under Start > Programs > Accessories > Games.",
  ],
  company: "Benjamin Ferguson Software",
}

/**
 * Add your software here. Example entry (remove the comment markers):
 *
 * {
 *   slug: "example",
 *   name: "Example App",
 *   tagline: "Does one thing really well",
 *   description: "A longer description of what the app does and why you built it.",
 *   logo: "/software/example/logo.png",
 *   version: "1.0",
 *   year: "2024",
 *   tags: ["TypeScript", "React"],
 *   features: ["Fast", "Offline-first", "Keyboard driven"],
 *   screenshots: ["/software/example/shot1.png"],
 *   website: "https://example.com",
 *   source: "https://github.com/you/example",
 *   size: "2.1 MB",
 * },
 */
export const software: Software[] = []

export const softwareBySlug = (slug: string) => software.find((s) => s.slug === slug)
