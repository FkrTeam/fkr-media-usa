/**
 * Generates the placeholder project posters.
 *
 * The favicon, apple-touch icon and Open Graph card are NOT generated here —
 * they are composited from the real logo artwork by
 * scripts/generate-brand-assets.sh, so nothing ever redraws the mark.
 *
 * These are vector stand-ins for real photography and renders. Replace the
 * files in public/images/work with optimised WebP or AVIF before launch and
 * update the `image` fields in src/data/site.js.
 *
 *   node scripts/generate-placeholders.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workDir = resolve(root, 'public/images/work')
mkdirSync(workDir, { recursive: true })

const W = 1600
const H = 1000
const NL = '\n'

const RAMP = {
  void: '#050505',
  ink: '#0C0C0C',
  charcoal: '#121212',
  surface: '#202020',
  soft: '#2A2A2A',
  ember: '#441614',
  deep: '#8B2821',
  brand: '#EE473D',
  hot: '#FF5B51',
  warm: '#FFE3DF',
  paper: '#F4F2EF'
}

/** Deterministic PRNG so regenerating produces identical files. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const shell = (id, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#242424"/>
      <stop offset="0.45" stop-color="#333333"/>
      <stop offset="1" stop-color="#151515"/>
    </linearGradient>
    <linearGradient id="ramp-${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${RAMP.ember}"/>
      <stop offset="0.5" stop-color="${RAMP.deep}"/>
      <stop offset="1" stop-color="${RAMP.brand}"/>
    </linearGradient>
    <radialGradient id="halo-${id}" cx="0.5" cy="0.4" r="0.68">
      <stop offset="0" stop-color="${RAMP.paper}" stop-opacity="0.14"/>
      <stop offset="0.42" stop-color="${RAMP.soft}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${RAMP.ink}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${RAMP.void}" stop-opacity="0"/>
      <stop offset="1" stop-color="${RAMP.void}" stop-opacity="0.26"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base-${id})"/>
  <rect width="${W}" height="${H}" fill="url(#halo-${id})"/>
${body}
  <rect width="${W}" height="${H}" fill="url(#fade-${id})"/>
</svg>
`

/* 01 — Horizon: stacked light planes receding to a burning vanishing line */
function horizon() {
  const parts = [`  <rect width="${W}" height="500" fill="${RAMP.ink}" fill-opacity="0.5"/>`]

  for (let i = 0; i < 22; i++) {
    const t = i / 21
    const y = (500 + Math.pow(t, 1.85) * 500).toFixed(0)
    const inset = ((1 - t) * 260).toFixed(0)
    const op = (0.18 + t * 0.55).toFixed(3)
    const w = (1.4 + t * 3.2).toFixed(2)
    parts.push(`  <path d="M${inset} ${y} L${W - inset} ${y}" stroke="${RAMP.paper}" stroke-opacity="${(op * 0.9).toFixed(3)}" stroke-width="${w}"/>`)
  }

  for (let i = 0; i < 13; i++) {
    parts.push(`  <path d="M${100 + i * 117} 1000 L800 500" stroke="${RAMP.brand}" stroke-opacity="0.30" stroke-width="1.4"/>`)
  }

  parts.push(`  <ellipse cx="800" cy="500" rx="560" ry="120" fill="${RAMP.paper}" fill-opacity="0.10"/>`)
  parts.push(`  <ellipse cx="800" cy="500" rx="300" ry="52" fill="${RAMP.brand}" fill-opacity="0.38"/>`)
  parts.push(`  <path d="M120 500 L1480 500" stroke="${RAMP.warm}" stroke-opacity="0.95" stroke-width="3"/>`)

  return shell('01', parts.join(NL))
}

/* 02 — Grid field: perspective mesh split by an illuminated corridor */
function gridField() {
  const parts = ['  <g>']

  for (let i = 0; i <= 30; i++) {
    const x = ((i / 30) * W).toFixed(1)
    const bottom = (800 + (x - 800) * 2.6).toFixed(1)
    parts.push(`    <path d="M${x} 90 L${bottom} 1000" stroke="${RAMP.paper}" stroke-opacity="0.30" stroke-width="1.4"/>`)
  }

  for (let i = 0; i < 20; i++) {
    const t = i / 19
    const y = (90 + Math.pow(t, 2) * 910).toFixed(1)
    const op = (0.14 + t * 0.42).toFixed(3)
    const w = (1 + t * 2).toFixed(2)
    parts.push(`    <path d="M0 ${y} L${W} ${y}" stroke="${RAMP.deep}" stroke-opacity="${op}" stroke-width="${w}"/>`)
  }

  parts.push('  </g>')
  parts.push('  <rect x="600" y="90" width="400" height="910" fill="url(#ramp-02)" fill-opacity="0.30"/>')
  parts.push(`  <path d="M600 90 L600 1000 M1000 90 L1000 1000" stroke="${RAMP.warm}" stroke-opacity="0.75" stroke-width="2.4"/>`)

  return shell('02', parts.join(NL))
}

/* 03 — Signal rings: concentric emission with broken arcs */
function signalRings() {
  const parts = []

  for (let i = 0; i < 24; i++) {
    const r = 44 + i * 40
    const op = (0.62 - i * 0.021).toFixed(3)
    const w = i % 4 === 0 ? 3 : 1.4
    parts.push(`  <circle cx="800" cy="510" r="${r}" fill="none" stroke="${RAMP.paper}" stroke-opacity="${(op * 0.9).toFixed(3)}" stroke-width="${w}"/>`)
  }

  parts.push(`  <circle cx="800" cy="510" r="352" fill="none" stroke="${RAMP.warm}" stroke-opacity="0.9" stroke-width="4" stroke-dasharray="560 1650"/>`)
  parts.push(`  <circle cx="800" cy="510" r="228" fill="none" stroke="${RAMP.brand}" stroke-opacity="0.85" stroke-width="3" stroke-dasharray="210 1220"/>`)
  parts.push(`  <circle cx="800" cy="510" r="112" fill="${RAMP.deep}" fill-opacity="0.20"/>`)
  parts.push(`  <circle cx="800" cy="510" r="26" fill="${RAMP.paper}" fill-opacity="0.95"/>`)

  return shell('03', parts.join(NL))
}

/* 04 — Data ribbon: layered bezier bands sweeping through the frame */
function dataRibbon() {
  const parts = []

  for (let i = 0; i < 30; i++) {
    const t = i / 29
    const off = -180 + t * 700
    const op = (0.22 + Math.sin(t * Math.PI) * 0.7).toFixed(3)
    const w = (1.6 + Math.sin(t * Math.PI) * 5.5).toFixed(2)
    const a = (760 + off * 0.32).toFixed(1)
    const b = (300 + off).toFixed(1)
    const c = (980 - off * 0.6).toFixed(1)
    const d = (260 + off * 0.5).toFixed(1)
    parts.push(`  <path d="M-60 ${a} C 420 ${b}, 1140 ${c}, ${W + 60} ${d}" fill="none" stroke="url(#ramp-04)" stroke-opacity="${op}" stroke-width="${w}"/>`)
  }

  parts.push(`  <path d="M-60 872 C 420 660, 1140 620, ${W + 60} 435" fill="none" stroke="${RAMP.paper}" stroke-opacity="0.85" stroke-width="2.6"/>`)

  return shell('04', parts.join(NL))
}

/* 05 — Particle field: scattered emission points with a density gradient */
function particleField() {
  const rand = rng(20260831)
  const parts = ['  <g>']

  for (let i = 0; i < 900; i++) {
    const x = rand() * W
    const y = rand() * H
    const dist = Math.hypot((x - 800) / 800, (y - 500) / 500)
    const op = Math.max(0, 1 - dist * 0.82) * (0.35 + rand() * 0.65)
    if (op < 0.05) continue
    const r = (1.1 + rand() * 3.4).toFixed(2)
    const color = rand() > 0.66 ? RAMP.paper : RAMP.deep
    parts.push(`    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" fill-opacity="${op.toFixed(3)}"/>`)
  }

  parts.push('  </g>')

  for (let i = 0; i < 6; i++) {
    const y = 250 + i * 110
    parts.push(`  <path d="M80 ${y} L1520 ${y}" stroke="${RAMP.paper}" stroke-opacity="0.22" stroke-width="1.4"/>`)
  }

  return shell('05', parts.join(NL))
}

const posters = [horizon(), gridField(), signalRings(), dataRibbon(), particleField()]
posters.forEach((svg, i) => {
  writeFileSync(resolve(workDir, `project-0${i + 1}.svg`), svg, 'utf8')
})
console.log(`wrote ${posters.length} project posters`)

/* The favicon, apple-touch icon and OG card are composited from the real
   logo artwork by scripts/generate-brand-assets.sh — they are deliberately
   not generated here, so nothing ever redraws the mark. */
