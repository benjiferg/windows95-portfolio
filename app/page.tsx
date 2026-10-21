"use client"

import dynamic from "next/dynamic"

// The desktop relies on window/localStorage; render it client-side only.
const Win95 = dynamic(() => import("@/components/win95/Win95").then((m) => m.Win95), {
  ssr: false,
  loading: () => <div style={{ position: "fixed", inset: 0, background: "#000" }} />,
})

export default function Home() {
  return <Win95 />
}
