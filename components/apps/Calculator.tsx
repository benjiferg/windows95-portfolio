"use client"

import React, { useCallback, useEffect, useState } from "react"
import { registerApp, type AppProps } from "@/lib/win95/registry"
import { wm, launch } from "@/lib/win95/store"
import { MenuBar } from "@/components/win95/Menu"
import { Checkbox, Radio } from "@/components/win95/controls"

/* ------------------------------------------------------------------ */
/*  Calculator — Standard and Scientific views                          */
/* ------------------------------------------------------------------ */

type Op = "+" | "-" | "*" | "/" | "^" | "mod" | "and" | "or" | "xor" | "lsh" | null

function fmt(n: number, base = 10): string {
  if (!isFinite(n)) return "Cannot divide by zero."
  if (base !== 10) return Math.trunc(n).toString(base).toUpperCase()
  const s = n.toPrecision(13)
  const num = Number(s)
  let out = Math.abs(num) >= 1e13 || (Math.abs(num) < 1e-9 && num !== 0) ? num.toExponential(8) : String(num)
  if (out.length > 32) out = num.toExponential(8)
  return out
}

export function Calculator({ win }: AppProps) {
  const [sci, setSci] = useState(false)
  const [display, setDisplay] = useState("0")
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op>(null)
  const [fresh, setFresh] = useState(true)
  const [memory, setMemory] = useState(0)
  const [base, setBase] = useState<10 | 16 | 8 | 2>(10)
  const [angle, setAngle] = useState<"deg" | "rad" | "grad">("deg")
  const [inv, setInv] = useState(false)
  const [hyp, setHyp] = useState(false)
  const [parens, setParens] = useState<{ acc: number | null; op: Op }[]>([])
  const [stats, setStats] = useState<number[]>([])

  useEffect(() => {
    wm.update(win.id, { w: sci ? 470 : 262, h: sci ? 300 : 268 })
  }, [sci, win.id])

  const value = useCallback(() => (base === 10 ? parseFloat(display) || 0 : parseInt(display, base) || 0), [display, base])

  const show = (n: number) => {
    setDisplay(fmt(n, base))
    setFresh(true)
  }

  const apply = (a: number, b: number, o: Op): number => {
    switch (o) {
      case "+":
        return a + b
      case "-":
        return a - b
      case "*":
        return a * b
      case "/":
        return b === 0 ? NaN : a / b
      case "^":
        return Math.pow(a, b)
      case "mod":
        return a % b
      case "and":
        return Math.trunc(a) & Math.trunc(b)
      case "or":
        return Math.trunc(a) | Math.trunc(b)
      case "xor":
        return Math.trunc(a) ^ Math.trunc(b)
      case "lsh":
        return Math.trunc(a) << Math.trunc(b)
      default:
        return b
    }
  }

  const digit = (d: string) => {
    const allowed = base === 16 ? /[0-9A-F]/ : base === 8 ? /[0-7]/ : base === 2 ? /[01]/ : /[0-9.]/
    if (!allowed.test(d)) return
    if (fresh || display === "0" || display.startsWith("Cannot")) {
      setDisplay(d === "." ? "0." : d)
      setFresh(false)
      return
    }
    if (d === "." && display.includes(".")) return
    if (display.replace(/[-.]/g, "").length >= 32) return
    setDisplay(display + d)
  }

  const equals = () => {
    let result = value()
    if (op && acc !== null) result = apply(acc, result, op)
    setAcc(null)
    setOp(null)
    show(result)
  }

  const operator = (o: Op) => {
    const v = value()
    if (op && acc !== null && !fresh) {
      const r = apply(acc, v, op)
      setAcc(r)
      show(r)
    } else if (acc === null || !fresh || op === null) {
      setAcc(v)
    }
    setOp(o)
    setFresh(true)
  }

  const clear = () => {
    setDisplay("0")
    setAcc(null)
    setOp(null)
    setFresh(true)
    setParens([])
  }
  const clearEntry = () => {
    setDisplay("0")
    setFresh(true)
  }
  const backspace = () => {
    if (fresh) return
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0")
  }

  const unary = (f: (x: number) => number) => {
    show(f(value()))
  }

  const toRad = (x: number) => (angle === "deg" ? (x * Math.PI) / 180 : angle === "grad" ? (x * Math.PI) / 200 : x)
  const fromRad = (x: number) => (angle === "deg" ? (x * 180) / Math.PI : angle === "grad" ? (x * 200) / Math.PI : x)

  const trig = (fn: "sin" | "cos" | "tan") => {
    const x = value()
    let r: number
    if (hyp) {
      const f = { sin: Math.sinh, cos: Math.cosh, tan: Math.tanh }[fn]
      const fi = { sin: Math.asinh, cos: Math.acosh, tan: Math.atanh }[fn]
      r = inv ? fi(x) : f(x)
    } else {
      const f = { sin: Math.sin, cos: Math.cos, tan: Math.tan }[fn]
      const fi = { sin: Math.asin, cos: Math.acos, tan: Math.atan }[fn]
      r = inv ? fromRad(fi(x)) : f(toRad(x))
    }
    setInv(false)
    setHyp(false)
    show(Math.abs(r) < 1e-14 ? 0 : r)
  }

  const factorial = (n: number) => {
    if (n < 0 || n > 170) return NaN
    if (n !== Math.floor(n)) {
      // gamma approximation
      const g = 7
      const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
      const gamma = (z: number): number => {
        if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
        z -= 1
        let x = c[0]
        for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
        const t = z + g + 0.5
        return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
      }
      return gamma(n + 1)
    }
    let r = 1
    for (let i = 2; i <= n; i++) r *= i
    return r
  }

  const changeBase = (b: 10 | 16 | 8 | 2) => {
    const v = value()
    setBase(b)
    setDisplay(fmt(b === 10 ? v : Math.trunc(v), b))
    setFresh(true)
  }

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wm.getSnapshot().activeId !== win.id) return
      const k = e.key
      if (/^[0-9.]$/.test(k) || (base === 16 && /^[a-fA-F]$/.test(k))) digit(k.toUpperCase())
      else if (k === "+" || k === "-" || k === "*" || k === "/") operator(k as Op)
      else if (k === "Enter" || k === "=") {
        e.preventDefault()
        equals()
      } else if (k === "Backspace") backspace()
      else if (k === "Escape") clear()
      else if (k === "Delete") clearEntry()
      else if (k === "%") unary((x) => (acc ?? 0) * x / 100)
      else if (k === "@") unary(Math.sqrt)
      else if (k.toLowerCase() === "r") unary((x) => 1 / x)
      else if (k === "F9") unary((x) => -x)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const menus = [
    {
      label: "&Edit",
      items: [
        { label: "&Copy", accel: "Ctrl+C", onClick: () => navigator.clipboard?.writeText(display).catch(() => {}) },
        { label: "&Paste", accel: "Ctrl+V", onClick: () => navigator.clipboard?.readText().then((t) => { const n = parseFloat(t); if (!isNaN(n)) show(n) }).catch(() => {}) },
      ],
    },
    {
      label: "&View",
      items: [
        { label: "S&cientific", radio: true, checked: sci, onClick: () => setSci(true) },
        { label: "&Standard", radio: true, checked: !sci, onClick: () => setSci(false) },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Help Topics", onClick: () => launch("help", { topic: "calc" }) },
        { sep: true },
        { label: "&About Calculator", onClick: () => wm.msgBox({ parentId: win.id, title: "About Calculator", text: "Microsoft Calculator\nWindows 95\n\nCopyright © 1981-1995 Microsoft Corp.", icon: "none" }) },
      ],
    },
  ]

  const B = ({ label, onClick, cls = "", w, title }: { label: string; onClick: () => void; cls?: string; w?: number; title?: string }) => (
    <button type="button" className={`calc-btn ${cls}`} style={w ? { width: w, minWidth: w } : undefined} onClick={onClick} title={title} tabIndex={-1}>
      {label}
    </button>
  )

  const memBox = (
    <div className="lcd mem-ind" style={{ width: 36, height: 27, textAlign: "center", boxShadow: "var(--sunken-thin)", padding: 6, marginRight: 6 }}>
      {memory ? "M" : ""}
    </div>
  )

  const memBtns = (
    <div className="col" style={{ gap: 4 }}>
      <B label="MC" cls="red" w={36} onClick={() => setMemory(0)} />
      <B label="MR" cls="red" w={36} onClick={() => show(memory)} />
      <B label="MS" cls="red" w={36} onClick={() => { setMemory(value()); setFresh(true) }} />
      <B label="M+" cls="red" w={36} onClick={() => { setMemory(memory + value()); setFresh(true) }} />
    </div>
  )

  const numPad = (
    <div className="calc-grid" style={{ gridTemplateColumns: "repeat(5, 36px)" }}>
      <B label="7" onClick={() => digit("7")} />
      <B label="8" onClick={() => digit("8")} />
      <B label="9" onClick={() => digit("9")} />
      <B label="/" cls="red" onClick={() => operator("/")} />
      <B label="sqrt" cls="dark" onClick={() => unary(Math.sqrt)} />
      <B label="4" onClick={() => digit("4")} />
      <B label="5" onClick={() => digit("5")} />
      <B label="6" onClick={() => digit("6")} />
      <B label="*" cls="red" onClick={() => operator("*")} />
      <B label="%" cls="dark" onClick={() => unary((x) => ((acc ?? 0) * x) / 100)} />
      <B label="1" onClick={() => digit("1")} />
      <B label="2" onClick={() => digit("2")} />
      <B label="3" onClick={() => digit("3")} />
      <B label="-" cls="red" onClick={() => operator("-")} />
      <B label="1/x" cls="dark" onClick={() => unary((x) => 1 / x)} />
      <B label="0" onClick={() => digit("0")} />
      <B label="+/-" onClick={() => unary((x) => -x)} />
      <B label="." onClick={() => digit(".")} />
      <B label="+" cls="red" onClick={() => operator("+")} />
      <B label="=" cls="red" onClick={equals} />
    </div>
  )

  const sciPad = (
    <div className="calc-grid" style={{ gridTemplateColumns: "repeat(5, 36px)" }}>
      <B label="7" onClick={() => digit("7")} />
      <B label="8" onClick={() => digit("8")} />
      <B label="9" onClick={() => digit("9")} />
      <B label="/" cls="red" onClick={() => operator("/")} />
      <B label="Mod" cls="red" onClick={() => operator("mod")} />
      <B label="And" cls="red" onClick={() => operator("and")} />
      <B label="4" onClick={() => digit("4")} />
      <B label="5" onClick={() => digit("5")} />
      <B label="6" onClick={() => digit("6")} />
      <B label="*" cls="red" onClick={() => operator("*")} />
      <B label="Or" cls="red" onClick={() => operator("or")} />
      <B label="Xor" cls="red" onClick={() => operator("xor")} />
      <B label="1" onClick={() => digit("1")} />
      <B label="2" onClick={() => digit("2")} />
      <B label="3" onClick={() => digit("3")} />
      <B label="-" cls="red" onClick={() => operator("-")} />
      <B label="Lsh" cls="red" onClick={() => operator("lsh")} />
      <B label="Not" cls="red" onClick={() => unary((x) => ~Math.trunc(x))} />
      <B label="0" onClick={() => digit("0")} />
      <B label="+/-" onClick={() => unary((x) => -x)} />
      <B label="." onClick={() => digit(".")} />
      <B label="+" cls="red" onClick={() => operator("+")} />
      <B label="=" cls="red" onClick={equals} />
      <B label="Int" cls="red" onClick={() => unary((x) => (inv ? x - Math.trunc(x) : Math.trunc(x)))} />
    </div>
  )

  const funcPad = (
    <div className="calc-grid" style={{ gridTemplateColumns: "repeat(4, 36px)" }}>
      <B label="Sta" cls="dark" onClick={() => wm.msgBox({ parentId: win.id, title: "Statistics Box", text: stats.length ? stats.map(fmt as (n: number) => string).join("\n") : "(empty)\n\nUse Dat to add the displayed value.", icon: "none" })} />
      <B label="F-E" cls="dark" onClick={() => show(value())} />
      <B label="(" cls="dark" onClick={() => { setParens([...parens, { acc, op }]); setAcc(null); setOp(null); setFresh(true) }} />
      <B label=")" cls="dark" onClick={() => {
          const inner = op && acc !== null ? apply(acc, value(), op) : value()
          const top = parens[parens.length - 1]
          setParens(parens.slice(0, -1))
          if (top) { setAcc(top.acc); setOp(top.op) } else { setAcc(null); setOp(null) }
          show(inner)
        }} />
      <B label="Ave" cls="dark" onClick={() => stats.length && show(stats.reduce((a, b) => a + b, 0) / stats.length)} />
      <B label="dms" cls="dark" onClick={() => unary((x) => { const d = Math.trunc(x); const m = (x - d) * 60; const s = (m - Math.trunc(m)) * 60; return inv ? d + (Math.trunc(m) * 100 + s) / 3600 : d + Math.trunc(m) / 100 + s / 10000 })} />
      <B label="Exp" cls="dark" onClick={() => { if (!display.includes("e")) { setDisplay(display + "e+0"); setFresh(false) } }} />
      <B label="ln" cls="dark" onClick={() => unary((x) => (inv ? Math.exp(x) : Math.log(x)))} />
      <B label="Sum" cls="dark" onClick={() => show(stats.reduce((a, b) => a + b, 0))} />
      <B label="sin" cls="dark" onClick={() => trig("sin")} />
      <B label="x^y" cls="dark" onClick={() => operator("^")} />
      <B label="log" cls="dark" onClick={() => unary((x) => (inv ? Math.pow(10, x) : Math.log10(x)))} />
      <B label="s" cls="dark" onClick={() => { if (stats.length < 2) return; const m = stats.reduce((a, b) => a + b, 0) / stats.length; show(Math.sqrt(stats.reduce((a, b) => a + (b - m) ** 2, 0) / (stats.length - 1))) }} />
      <B label="cos" cls="dark" onClick={() => trig("cos")} />
      <B label="x^3" cls="dark" onClick={() => unary((x) => (inv ? Math.cbrt(x) : x ** 3))} />
      <B label="n!" cls="dark" onClick={() => unary(factorial)} />
      <B label="Dat" cls="dark" onClick={() => { setStats([...stats, value()]); setFresh(true) }} />
      <B label="tan" cls="dark" onClick={() => trig("tan")} />
      <B label="x^2" cls="dark" onClick={() => unary((x) => (inv ? Math.sqrt(x) : x * x))} />
      <B label="1/x" cls="dark" onClick={() => unary((x) => 1 / x)} />
    </div>
  )

  return (
    <>
      <MenuBar menus={menus} />
      <div className="col" style={{ padding: "4px 6px 6px", gap: 6, flex: 1 }}>
        <div className="lcd">{display}</div>
        {sci && (
          <div className="row" style={{ gap: 8 }}>
            <div className="groupbox row" style={{ gap: 10, padding: "6px 8px", margin: 0, flex: 1 }}>
              <Radio name="base" label="He&x" checked={base === 16} onChange={() => changeBase(16)} />
              <Radio name="base" label="&Dec" checked={base === 10} onChange={() => changeBase(10)} />
              <Radio name="base" label="&Oct" checked={base === 8} onChange={() => changeBase(8)} />
              <Radio name="base" label="&Bin" checked={base === 2} onChange={() => changeBase(2)} />
            </div>
            <div className="groupbox row" style={{ gap: 10, padding: "6px 8px", margin: 0, flex: 1 }}>
              {base === 10 ? (
                <>
                  <Radio name="ang" label="D&egrees" checked={angle === "deg"} onChange={() => setAngle("deg")} />
                  <Radio name="ang" label="&Radians" checked={angle === "rad"} onChange={() => setAngle("rad")} />
                  <Radio name="ang" label="&Grads" checked={angle === "grad"} onChange={() => setAngle("grad")} />
                </>
              ) : (
                <>
                  <Radio name="wsz" label="D&word" checked onChange={() => {}} />
                  <Radio name="wsz" label="&Word" checked={false} onChange={() => {}} />
                  <Radio name="wsz" label="B&yte" checked={false} onChange={() => {}} />
                </>
              )}
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
          {sci && (
            <div className="col" style={{ gap: 4, paddingTop: 0 }}>
              <div className="row" style={{ gap: 8, height: 27 }}>
                <Checkbox label="&Inv" checked={inv} onChange={setInv} />
                <Checkbox label="&Hyp" checked={hyp} onChange={setHyp} />
              </div>
              {funcPad}
            </div>
          )}
          <div className="col" style={{ gap: 4, flex: 1 }}>
            <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
              {memBox}
              <B label="Backspace" cls="red" w={sci ? 60 : 62} onClick={backspace} />
              <B label="CE" cls="red" w={sci ? 60 : 62} onClick={clearEntry} />
              <B label="C" cls="red" w={sci ? 60 : 62} onClick={clear} />
            </div>
            <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
              {memBtns}
              {sci ? sciPad : numPad}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

registerApp({
  id: "calc",
  name: "Calculator",
  icon: "calculator",
  component: Calculator,
  width: 262,
  height: 268,
  resizable: false,
  maximizable: false,
  exe: "CALC.EXE",
  startMenu: ["Programs", "Accessories"],
})
