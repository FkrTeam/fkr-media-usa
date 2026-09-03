/**
 * FKR MEDIA USA — brand colour source of truth for JavaScript and WebGL.
 *
 * Mirrors `styles/tokens.css`. Every colour used by Three.js, GLSL uniforms
 * or GSAP tweens is imported from here, so the brand is never hardcoded
 * across the render layer.
 *
 * `#EE473D` and `#050505` are sampled directly from the supplied logo
 * artwork — they are not approximations and must not be adjusted.
 */

/** Hex integers, for THREE.Color / setClearColor. */
export const HEX = {
  void: 0x050505,
  ink: 0x0c0c0c,
  ash: 0x202020,
  brand: 0xee473d,
  brandHot: 0xff5b51,
  brandDeep: 0xc2352d,
  warm: 0xffe3df,
  paper: 0xf4f2ef
}

/** CSS strings, for GSAP tweens and inline styles. */
export const CSS = {
  paper: '#F4F2EF',
  paperDim: '#A7A4A0',
  paperMute: '#85827E',
  brand: '#EE473D',
  brandHot: '#FF5B51',
  brandSoft: 'rgba(238, 71, 61, 0.14)',
  brandBorder: 'rgba(238, 71, 61, 0.70)',
  neutralBorder: 'rgba(244, 242, 239, 0.55)',
  neutralSoft: 'rgba(244, 242, 239, 0.08)',
  transparent: 'rgba(0, 0, 0, 0)'
}

/**
 * The shader ramp, as a GLSL chunk.
 *
 * Deliberately a tonal ladder rather than a single red: near-black through
 * a dark ember, into the brand coral, finishing on a warm off-white
 * specular. That range is what keeps the WebGL scene cinematic instead of
 * flat and hot.
 */
export const SHADER_PALETTE = /* glsl */ `
const vec3 C_VOID  = vec3(0.020, 0.020, 0.020);  // #050505 page ground
const vec3 C_INK   = vec3(0.047, 0.047, 0.047);  // #0C0C0C
const vec3 C_ASH   = vec3(0.125, 0.125, 0.125);  // #202020 neutral geometry
const vec3 C_EMBER = vec3(0.267, 0.086, 0.078);  // #441614 red-black
const vec3 C_DEEP  = vec3(0.545, 0.157, 0.129);  // #8B2821
const vec3 C_BRAND = vec3(0.933, 0.278, 0.239);  // #EE473D — the logo red
const vec3 C_HOT   = vec3(1.000, 0.357, 0.318);  // #FF5B51
const vec3 C_WARM  = vec3(1.000, 0.890, 0.875);  // #FFE3DF warm specular
`

export default { HEX, CSS, SHADER_PALETTE }
