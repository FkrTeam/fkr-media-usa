/**
 * One-off headless probe (development aid).
 * Loads the page in real Chrome, waits, then evaluates an expression and
 * prints the result plus any console errors.
 *
 *   node scripts/probe.mjs "<url>" "<expression>" [waitMs]
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_ = process.argv[2] || 'http://localhost:5173/'
const EXPR = process.argv[3] || '1'
const WAIT = Number(process.argv[4] || 6000)
const PORT = 9334

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((p) => existsSync(p))

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=1440,900',
  ...(process.env.PROBE_ARGS ? process.env.PROBE_ARGS.split(' ') : []),
  'about:blank'
], { stdio: 'ignore' })
process.on('exit', () => chrome.kill())

let wsUrl = null
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl
  } catch { /* not up */ }
  if (!wsUrl) await sleep(250)
}

const ws = new WebSocket(wsUrl)
let id = 1
const pending = new Map()
const logs = []

ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`)
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`)
  }
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? reject(new Error(m.error.message)) : resolve(m.result)
  }
})

await new Promise((r) => ws.addEventListener('open', r, { once: true }))
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = id++
    pending.set(n, { resolve: res, reject: rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

await send('Runtime.enable')
await send('Page.enable')

// PROBE_MEDIA=prefers-reduced-motion=reduce emulates a media feature.
if (process.env.PROBE_MEDIA) {
  const features = process.env.PROBE_MEDIA.split(',').map((pair) => {
    const [name, value] = pair.split('=')
    return { name, value }
  })
  await send('Emulation.setEmulatedMedia', { features })
}

// PROBE_W/PROBE_H emulate a viewport size.
if (process.env.PROBE_W) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(process.env.PROBE_W),
    height: Number(process.env.PROBE_H || 844),
    deviceScaleFactor: 1,
    mobile: Number(process.env.PROBE_W) < 768
  })
}

await send('Page.navigate', { url: URL_ })
await sleep(WAIT)

const out = await send('Runtime.evaluate', { expression: EXPR, awaitPromise: true, returnByValue: true })

// PROBE_SHOT=path captures the viewport after the expression has run.
if (process.env.PROBE_SHOT) {
  const { writeFileSync } = await import('node:fs')
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(process.env.PROBE_SHOT, Buffer.from(data, 'base64'))
  console.log('shot:', process.env.PROBE_SHOT)
}
console.log('RESULT:', JSON.stringify(out.result?.value ?? out.result?.description, null, 2))
if (logs.length) console.log('\nCONSOLE:\n' + logs.join('\n'))

ws.close()
chrome.kill()
