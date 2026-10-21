import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Benjamin Ferguson - Windows 95",
  description: "Benjamin Ferguson's software portfolio, presented as a working Windows 95 desktop.",
  icons: {
    icon: [{ url: "/icons/windows-16.png", type: "image/png" }, { url: "/icons/windows.png", type: "image/png", sizes: "32x32" }],
    apple: "/icons/windows.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#008080",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
