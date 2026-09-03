import { SIMPLEX_3D, PALETTE } from './common.js'

/**
 * Media plane.
 *
 * One plane, matched to a DOM rect, carrying an abstract brand visual.
 * Changing its texture is a noise-driven displacement wipe with a chromatic
 * offset — the outgoing frame tears into the incoming one rather than
 * cross-fading — and the same material handles pointer-driven deformation.
 */

export const mediaPlaneVertex = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uProgress;
uniform float uHover;
uniform vec2  uPointer;

varying vec2 vUv;
varying float vBend;

${SIMPLEX_3D}

void main() {
  vUv = uv;
  vec3 pos = position;

  // Transition bulge: the plane swells at the midpoint of a change.
  float wipe = sin(uProgress * 3.14159265);
  float n = snoise(vec3(uv * 2.4, uTime * 0.12));
  float bend = n * wipe * 0.42;

  // Pointer tilt — a few degrees of parallax, nothing more.
  vec2 toPointer = uv - 0.5 - uPointer * 0.5;
  bend += (0.5 - length(toPointer)) * uHover * 0.14;

  pos.z += bend;
  vBend = bend;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

export const mediaPlaneFragment = /* glsl */ `
precision highp float;

uniform sampler2D uCurrent;
uniform sampler2D uNext;
uniform vec2  uCurrentSize;
uniform vec2  uNextSize;
uniform vec2  uPlaneSize;
uniform float uProgress;
uniform float uTime;
uniform float uHover;
uniform float uOpacity;

varying vec2 vUv;
varying float vBend;

${SIMPLEX_3D}
${PALETTE}

/** object-fit: cover, in UV space. */
vec2 cover(vec2 uv, vec2 texSize, vec2 planeSize) {
  vec2 ratio = vec2(
    min((planeSize.x / planeSize.y) / (texSize.x / texSize.y), 1.0),
    min((planeSize.y / planeSize.x) / (texSize.y / texSize.x), 1.0)
  );
  return uv * ratio + (1.0 - ratio) * 0.5;
}

void main() {
  float p = clamp(uProgress, 0.0, 1.0);

  // Displacement field drives both the wipe threshold and the tear offset.
  float n = snoise(vec3(vUv * 3.1, uTime * 0.08)) * 0.5 + 0.5;
  float edge = smoothstep(n * 0.55, n * 0.55 + 0.45, p);

  float tear = (1.0 - abs(p * 2.0 - 1.0)) * 0.055;
  vec2 shift = vec2(0.0, (n - 0.5) * tear * 2.0);

  // Chromatic offset scales with transition energy and hover.
  float ca = tear * 0.55 + uHover * 0.004;

  vec2 uvA = cover(vUv + shift, uCurrentSize, uPlaneSize);
  vec2 uvB = cover(vUv - shift, uNextSize, uPlaneSize);

  vec3 a = vec3(
    texture2D(uCurrent, uvA + vec2(ca, 0.0)).r,
    texture2D(uCurrent, uvA).g,
    texture2D(uCurrent, uvA - vec2(ca, 0.0)).b
  );
  vec3 b = vec3(
    texture2D(uNext, uvB + vec2(ca, 0.0)).r,
    texture2D(uNext, uvB).g,
    texture2D(uNext, uvB - vec2(ca, 0.0)).b
  );

  vec3 color = mix(a, b, edge);

  // The tear front is the only place brand red touches project imagery:
  // a thin ember-to-coral seam that exists during the wipe and then leaves.
  // Project photography is never permanently tinted.
  float seamCore = smoothstep(0.02, 0.0, abs(edge - 0.5));
  float seamWide = smoothstep(0.11, 0.0, abs(edge - 0.5));
  float energy = 1.0 - abs(p * 2.0 - 1.0);
  color += C_EMBER * seamWide * energy * 0.45;
  color += C_BRAND * seamCore * energy * 0.75;

  // Grade: settle the shadows into neutral ink so the plane belongs to the
  // room without shifting the artwork's own hue.
  color = mix(color, C_INK, 0.10);
  color += C_DEEP * max(vBend, 0.0) * 0.28;

  // Inner falloff so the plane edge never looks like a pasted rectangle.
  vec2 fromEdge = min(vUv, 1.0 - vUv);
  float frame = smoothstep(0.0, 0.045, min(fromEdge.x, fromEdge.y));

  gl_FragColor = vec4(color, uOpacity * frame);
}
`
