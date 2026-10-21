"use client"

import React, { useEffect, useRef, useState } from "react"
import { icon, type IconName } from "@/lib/win95/icons"

/* ------------------------------------------------------------------ */
/*  Basic Win95 controls                                               */
/* ------------------------------------------------------------------ */

export function Icon({
  name,
  size = 32,
  className,
  style,
  alt = "",
}: {
  name: IconName
  size?: 16 | 32
  className?: string
  style?: React.CSSProperties
  alt?: string
}) {
  return (
    <img
      src={icon(name, size)}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      className={className}
      style={{ width: size, height: size, ...style }}
    />
  )
}

/** Renders "&File" as F̲ile */
export function Mnemonic({ text }: { text: string }) {
  const i = text.indexOf("&")
  if (i < 0 || i === text.length - 1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <u>{text[i + 1]}</u>
      {text.slice(i + 2)}
    </>
  )
}

export function Button({
  children,
  className = "",
  isDefault,
  ...rest
}: React.ComponentPropsWithRef<"button"> & { isDefault?: boolean }) {
  return (
    <button type="button" className={`btn ${isDefault ? "default" : ""} ${className}`} {...rest}>
      {typeof children === "string" ? <Mnemonic text={children} /> : children}
    </button>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span>
        <Mnemonic text={label} />
      </span>
    </label>
  )
}

export function Radio({
  label,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: string
  checked: boolean
  onChange?: () => void
  disabled?: boolean
  name?: string
}) {
  return (
    <label className="radio">
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={() => onChange?.()} />
      <span>
        <Mnemonic text={label} />
      </span>
    </label>
  )
}

export function GroupBox({
  title,
  children,
  style,
  className = "",
}: {
  title?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div className={`groupbox ${className}`} style={style}>
      {title && (
        <span className="legend">
          <Mnemonic text={title} />
        </span>
      )}
      {children}
    </div>
  )
}

export function TextInput(props: React.ComponentPropsWithRef<"input">) {
  return <input type="text" {...props} className={`field ${props.className ?? ""}`} />
}

export function Select(props: React.ComponentPropsWithRef<"select">) {
  return <select {...props} className={`field ${props.className ?? ""}`} />
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[]
  active: number
  onChange: (i: number) => void
}) {
  return (
    <div className="tabs">
      {tabs.map((t, i) => (
        <button type="button" key={t} className={`tab ${i === active ? "active" : ""}`} onClick={() => onChange(i)}>
          <Mnemonic text={t} />
        </button>
      ))}
    </div>
  )
}

export function StatusBar({ cells, grip }: { cells: (string | React.ReactNode)[]; grip?: boolean }) {
  return (
    <div className="statusbar">
      {cells.map((c, i) => (
        <div key={i} className={`cell ${i > 0 && cells.length > 1 ? "fixed" : ""}`} style={i > 0 ? { minWidth: 90 } : {}}>
          {c}
        </div>
      ))}
      {grip && <div className="grip" />}
    </div>
  )
}

export function Progress({ value, style }: { value: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [blocks, setBlocks] = useState(10)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBlocks(Math.floor((el.clientWidth - 4) / 10)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const n = Math.round((Math.max(0, Math.min(100, value)) / 100) * blocks)
  return (
    <div className="progress" ref={ref} style={style}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="blk" />
      ))}
    </div>
  )
}

export function Slider({
  value,
  min = 0,
  max = 100,
  onChange,
  vertical,
  style,
  ticks,
}: {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  vertical?: boolean
  style?: React.CSSProperties
  ticks?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = (value - min) / (max - min)
  const onPointer = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const calc = (ev: PointerEvent | React.PointerEvent) => {
      let p = vertical ? 1 - (ev.clientY - r.top - 6) / (r.height - 12) : (ev.clientX - r.left - 6) / (r.width - 12)
      p = Math.max(0, Math.min(1, p))
      onChange(Math.round(min + p * (max - min)))
    }
    calc(e)
    const move = (ev: PointerEvent) => calc(ev)
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <div
      ref={ref}
      className={`slider ${vertical ? "vertical" : ""}`}
      style={style}
      onPointerDown={onPointer}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <div className="track" />
      {ticks &&
        Array.from({ length: ticks }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              background: "var(--window-text)",
              ...(vertical
                ? { right: 0, top: `calc(${(i / (ticks - 1)) * 100}% - 1px)`, width: 4, height: 1 }
                : { bottom: 0, left: `calc(6px + ${(i / (ticks - 1)) * 100}% - ${(i / (ticks - 1)) * 12}px)`, width: 1, height: 4 }),
            }}
          />
        ))}
      <div
        className="thumb"
        style={vertical ? { bottom: `calc(${pct * 100}% - ${pct * 11}px)` } : { left: `calc(${pct * 100}% - ${pct * 11}px)` }}
      />
    </div>
  )
}

export function ListBox<T>({
  items,
  selected,
  onSelect,
  onActivate,
  render,
  style,
  className = "",
}: {
  items: T[]
  selected: number
  onSelect: (i: number) => void
  onActivate?: (i: number) => void
  render: (item: T) => React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div
      className={`listbox w95-scroll ${className}`}
      style={style}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          onSelect(Math.min(items.length - 1, selected + 1))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          onSelect(Math.max(0, selected - 1))
        } else if (e.key === "Enter" && onActivate && selected >= 0) onActivate(selected)
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          className={`li ${i === selected ? "sel" : ""}`}
          onClick={() => onSelect(i)}
          onDoubleClick={() => onActivate?.(i)}
        >
          {render(it)}
        </div>
      ))}
    </div>
  )
}

/** Tooltip rendered on hover after a short delay. */
export function Tooltip({ text, children }: { text: string; children: React.ReactElement }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const child = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    onMouseEnter: (e: React.MouseEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      timer.current = setTimeout(() => setPos({ x: r.left, y: r.top - 22 }), 600)
    },
    onMouseLeave: () => {
      if (timer.current) clearTimeout(timer.current)
      setPos(null)
    },
    onPointerDown: () => {
      if (timer.current) clearTimeout(timer.current)
      setPos(null)
    },
  })
  return (
    <>
      {child}
      {pos && (
        <div className="tooltip" style={{ left: pos.x, top: pos.y }}>
          {text}
        </div>
      )}
    </>
  )
}

/** Error boundary that renders a Win95 "illegal operation" notice. */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="msgbox" style={{ background: "var(--face)" }}>
          <Icon name="msg_error" />
          <div className="msg-text sel-text">
            This program has performed an illegal operation and will be shut down.
            {"\n\n"}
            {this.props.name} caused a general protection fault in module {this.props.name.toUpperCase()}.EXE.
            {"\n\n"}
            <span className="gray">{String(this.state.error.message)}</span>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
