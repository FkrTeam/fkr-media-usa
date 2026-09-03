/**
 * Headless screenshot harness (development aid).
 *
 * Drives Chrome over the DevTools protocol so the real animation loop runs,
 * then captures a set of viewports and scroll positions. Used to check the
 * layout at each breakpoint without a visible browser.
 *
 *   node scripts/shots.mjs [baseUrl] [outDir]
 */

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = process.argv[2] || 'http://localhost:5173'
const ONLY = process.env.SHOT_VIEWS ? process.env.SHOT_VIEWS.split(',') : null
const OUT = resolve(process.argv[3] || 'shots')
const PORT = 9333

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((path) => existsSync(path))

if (!CHROME) {
  console.error('No Chrome or Edge binary found.')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

const VIEWS = [
  { name: 'desktop-1920', width: 1920, height: 1080, dpr: 1 },
  { name: 'desktop-1440', width: 1440, height: 900, dpr: 1 },
  { name: 'tablet-768', width: 768, height: 1024, dpr: 2 },
  { name: 'mobile-390', width: 390, height: 844, dpr: 3 },
  { name: 'mobile-360', width: 360, height: 740, dpr: 3 }
]

const SHOTS = [
  { id: 'hero', scroll: 0 },
  { id: 'about', selector: '.intro-block' },
  { id: 'services', selector: '.services' },
  { id: 'numbers', selector: '.numbers' },
  { id: 'reviews', selector: '.reviews' },
  { id: 'references', selector: '.references' },
  { id: 'cta', selector: '.contact-cta' },
  { id: 'overview', selector: '.services-overview' },
  { id: 'detail', selector: '.services-detail' },
  { id: 'process', selector: '.process' },
  { id: 'manifesto', selector: '.manifesto' },
  { id: 'approach', selector: '.approach' },
  { id: 'enquiry', selector: '.enquiry' },
  { id: 'footer', selector: 'footer' }
]

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--hide-scrollbars',
  '--window-size=1920,1080',
  'about:blank'
], { stdio: 'ignore' })

process.on('exit', () => chrome.kill())

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target')
}

const wsUrl = await connect()
const ws = new WebSocket(wsUrl) // Node 22+ ships a global WebSocket

let nextId = 1
const pending = new Map()

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve: done, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : done(msg.result)
  }
})

await new Promise((done) => ws.addEventListener('open', done, { once: true }))

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = nextId++
    pending.set(id, { resolve: res, reject: rej })
    ws.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  return result.result?.value
}

await send('Page.enable')
await send('Runtime.enable')

for (const view of VIEWS.filter((v) => !ONLY || ONLY.includes(v.name))) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: view.width,
    height: view.height,
    deviceScaleFactor: 1,
    mobile: view.width < 768
  })

  await send('Page.navigate', { url: `${BASE}${process.env.SHOT_PATH || '/'}?intro=skip` })
  await sleep(9500)

  for (const shot of SHOTS) {
    await evaluate(`(() => {
      const s = ${JSON.stringify(shot.selector ?? null)};
      if (!s) { window.scrollTo(0, 0); return 0; }
      const node = document.querySelector(s);
      if (!node) return -1;
      const rect = node.getBoundingClientRect();
      const top = rect.top + window.scrollY + (${shot.offset ?? 0}) * rect.height;
      window.scrollTo(0, top);
      return top;
    })()`)

    await sleep(1900)

    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(resolve(OUT, `${view.name}--${shot.id}.png`), Buffer.from(data, 'base64'))
    console.log('captured', `${view.name}--${shot.id}`)
  }
}

ws.close()
chrome.kill()
console.log('\nScreenshots written to', OUT)
