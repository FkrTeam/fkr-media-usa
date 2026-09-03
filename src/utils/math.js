/** Numeric helpers shared by the animation and WebGL layers. */

export const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max)

export const lerp = (a, b, t) => a + (b - a) * t

/** Frame-rate independent smoothing — `smoothing` is the fraction left after 1s. */
export const damp = (a, b, smoothing, dt) => lerp(a, b, 1 - Math.pow(smoothing, dt))

export const map = (value, inMin, inMax, outMin, outMax) =>
  outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)

export const clamped = (value, inMin, inMax, outMin, outMax) =>
  clamp(map(value, inMin, inMax, outMin, outMax), Math.min(outMin, outMax), Math.max(outMin, outMax))

/** Pads a number for the tabular index labels used across the UI. */
export const pad2 = (n) => String(n).padStart(2, '0')

/** Formats seconds as mm:ss for the intro timer. */
export function timecode(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}
