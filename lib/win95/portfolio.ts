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
  /**
   * What opening the program does:
   *  - "window"  (default) opens the About/Screenshots/Links program window
   *  - "browser" opens `website` inside Internet Explorer on the desktop
   *  - "external" opens `website` in a new browser tab
   */
  openMode?: "window" | "browser" | "external"
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
export const software: Software[] = [
  {
    slug: "sparkform",
    name: "Sparkform",
    tagline: "Custom matchbooks and matchboxes, designed in your browser",
    description: `Design it flat. Watch it fold. Strike it for real.

Sparkform is a matchbook and matchbox designer that shows your design in 3D while you work. Every format sits on the real factory dieline, so bleed, live areas and the striker are enforced before you order.

Printed by the last match factory in America, in Jaffrey, New Hampshire. Runs start at 50 pieces, for weddings, bars, hotels and brands.`,
    logo: "/software/sparkform/logo.png",
    logoSmall: "/software/sparkform/logo-16.png",
    year: "2026",
    tags: ["Web app", "3D designer", "E-commerce", "Print"],
    features: [
      "Live 3D preview that folds the sheet into the finished book or box, including foil and gloss",
      "Real factory dielines with bleed, live areas and striker enforced by preflight",
      "Six formats: 20- and 30-strike books, Euro box, lipstick box and more",
      "Small runs from 50 pieces with automatic bulk pricing",
      "Proof approval before anything prints",
    ],
    website: "https://sparkform.dev",
    size: "3.2 MB",
    openMode: "browser",
  },
  {
    slug: "nursewellness",
    name: "Nurse Wellness",
    tagline: "Premium THC & CBD, shipped fast and discreetly",
    description: `Nurse Wellness is an online store for THC and CBD products: gummies, flower, pre-rolls, vapes, beverages, tinctures and topicals, with no medical card required.

Every product is third-party lab tested. Orders ship discreetly, with free shipping over $100, and there is a retail location in Old City Philadelphia.

Over 3,000 five-star reviews. You must be 21 or older to shop.`,
    logo: "/software/nursewellness/logo.png",
    logoSmall: "/software/nursewellness/logo-16.png",
    year: "2026",
    tags: ["E-commerce", "Web app", "Retail"],
    features: [
      "Shop by product type or by mood: Sleepy, Happy, Energized, Chill, Creative, Social",
      "Third-party lab results for every product",
      "Rewards program and order tracking",
      "Age verification and secure card payments",
      "Store hours, directions and events for the Philadelphia location",
    ],
    website: "https://nursewellness.com",
    size: "5.8 MB",
    openMode: "external",
  },
  {
    slug: "mountmansfieldstake",
    name: "Mt Mansfield Snow Stake",
    tagline: "Live snow depth and 70+ years of daily data from 3,900 ft",
    description: `Live readings from the Mt Mansfield snow stake in Stowe, Vermont, with daily snow depth records going back to 1954.

Compare the current season against every season on record, browse by decade, explore any date, and check the webcams, resort conditions and trail map before you head up.

Built on the data collected and openly shared by Matthew Parrilla, with daily reports from NWS Burlington.`,
    logo: "/software/mountmansfieldstake/logo.png",
    logoSmall: "/software/mountmansfieldstake/logo-16.png",
    year: "2026",
    tags: ["Data visualization", "Web app", "Weather", "Skiing"],
    features: [
      "Current depth, today's ranking and season max against 68 seasons of history",
      "Interactive depth charts with historical average and percentile bands",
      "Quick compare: top five snowiest, least snow, last five years",
      "Date explorer, snow calendar and decade views",
      "Webcams, resort forecast, trail map and CSV data download",
    ],
    website: "https://mountmansfieldstake.com",
    size: "2.4 MB",
    openMode: "browser",
  },
  {
    slug: "enjoyhemp",
    name: "Enjoy Hemp",
    tagline: "Legal hemp-derived THC gummies, drinks and spirits",
    description: `Enjoy Hemp sells legal, hemp-derived THC products: gummies, seltzers, drinks, syrups and spirits, made for how you want to feel.

Pick Your Feeling: Euphoria, Sleep, Chill, Social, Bliss or Relief, then choose a strength from beginner-friendly low potency up to high potency. Every product is third-party lab tested and ships nationwide, with free shipping over $100.

Over five million legal THC products sold.`,
    logo: "/software/enjoyhemp/logo.png",
    logoSmall: "/software/enjoyhemp/logo-16.png",
    year: "2026",
    tags: ["E-commerce", "Web app", "Consumer brand"],
    features: [
      "Shop by feeling and by strength, with a 30-second product quiz",
      "Gummies, THC drinks and seltzers, syrups and THC spirits",
      "Quick onset, lab-tested formulas with predictable dosing",
      "Published lab results and a wholesale program",
      "Nationwide shipping with free shipping over $100",
    ],
    website: "https://enjoyhemp.co",
    size: "6.1 MB",
    openMode: "external",
  },
  {
    slug: "summersolacetallow",
    name: "Summer Solace Tallow",
    tagline: "Regenerative tallow skincare and candles, handmade in Oakland",
    description: `Summer Solace Tallow makes holistic skincare, balms, soaps and clean-burning candles from regeneratively raised Northern California suet tallow and regional ingredients.

Chef- and perfumer-crafted in Oakland, California since 2014, for dry, sensitive and hardworking skin. Whole-body nourishment from pasture to palm.

Available worldwide and at Nordstrom and Urban Outfitters, with free domestic shipping over $175.`,
    logo: "/software/summersolacetallow/logo.png",
    logoSmall: "/software/summersolacetallow/logo-16.png",
    year: "2026",
    tags: ["E-commerce", "Shopify", "Consumer brand", "Skincare"],
    features: [
      "Shop by skin concern or by product: balms, face oils, lip balms, soaps and candles",
      "Pure unscented tallow line for sensitive skin, plus mineral zinc and tinted balms",
      "Learn section and getting-started guides for tallow skincare",
      "Rewards program and customer reviews on every product",
      "Accessibility screen-reader mode built in",
    ],
    website: "https://summersolacetallow.com",
    size: "4.7 MB",
    openMode: "external",
  },
  {
    slug: "w3bp",
    name: "W3bp",
    tagline: "Image to WebP converter, right in the browser",
    description: `W3bp converts images to WebP without uploading anything to a server. Pick a single file or a whole folder, and get back smaller files that load faster on the web.

No account, no install, no waiting. Open the page, choose your images, download the results.`,
    logo: "/software/w3bp/logo.png",
    logoSmall: "/software/w3bp/logo-16.png",
    year: "2026",
    tags: ["Web app", "Tool", "Images", "WebP"],
    features: [
      "Convert a single image or an entire folder at once",
      "Runs in the browser, so files stay on your machine",
      "Smaller output for faster-loading sites",
      "Nothing to sign up for or install",
    ],
    website: "https://www.w3bp.com",
    size: "0.9 MB",
    openMode: "browser",
  },
  {
    slug: "luxurycharterbrokers",
    name: "Luxury Charter Brokers",
    tagline: "Fully crewed, all-inclusive yacht charters, Caribbean and worldwide",
    description: `Luxury Charter Brokers books crewed, all-inclusive charters on hand-picked, vetted yachts: catamarans, power cats, motor yachts, sailing yachts and motor sailers.

The Caribbean is the specialty, with the US and British Virgin Islands the most popular destination, followed by the Bahamas and the Leeward and Windward Islands. Real prices and availability are shown up front, with a broker on hand from first enquiry to the end of the trip.

Search by yacht type, destination, dates and guest count, read the guest book, and see how booking works.`,
    logo: "/software/luxurycharterbrokers/logo.png",
    logoSmall: "/software/luxurycharterbrokers/logo-16.png",
    year: "2026",
    tags: ["Web app", "Booking", "Travel", "Marketplace"],
    features: [
      "Browse vetted yachts by type, destination, dates and number of guests",
      "Live weekly pricing and availability for every yacht",
      "Destination guides for the Virgin Islands, Bahamas and beyond",
      "Guest reviews and a guest book from real charters",
      "Broker support throughout, with FAQs and a how-booking-works guide",
    ],
    website: "https://web-drab-phi-95.vercel.app",
    size: "7.4 MB",
    openMode: "browser",
  },
]

export const softwareBySlug = (slug: string) => software.find((s) => s.slug === slug)
