import { SIMPLEX_3D, PALETTE } from './common.js'

/**
 * The signal field — the one visual idea the whole site is built on.
 *
 * A wide lattice of points lying on a receding plane, lifted by layered
 * travelling waves. The colour hierarchy is deliberate and fixed by the
 * `aTint` attribute: roughly 80% of points are neutral graphite and barely
 * present, 15% smoulder in dark ember, and only the top 5% carry the brand
 * coral. That distribution is what makes the field read as a field of
 * signals rather than as sparks or fire.
 */

export const signalFieldVertex = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform float uSize;
uniform float uPixelRatio;
uniform float uScroll;
uniform float uReveal;
uniform float uAccent;
uniform vec2  uPointer;

attribute float aRandom;
attribute float aScale;
attribute float aTint;

varying float vGlow;
varying float vDepth;
varying float vRandom;
varying float vTint;

${SIMPLEX_3D}

void main() {
  vec3 pos = position;

  float t = uTime * 0.24;

  // Three travelling wave trains at different angles and wavelengths.
  float w1 = sin(pos.x * 0.42 + pos.z * 0.18 + t * 1.15);
  float w2 = sin(pos.x * 0.19 - pos.z * 0.34 - t * 0.86 + 1.7);
  float w3 = sin(pos.z * 0.55 + t * 0.62 + aRandom * 0.9);

  // A slow noise field breaks the regularity so it never reads as a grid.
  float n = snoise(vec3(pos.x * 0.11, pos.z * 0.13, uTime * 0.05));

  float height = (w1 * 0.42 + w2 * 0.33 + w3 * 0.22) + n * 0.85;

  // Pointer ripple: a soft radial lift that trails the cursor.
  vec2 pointerWorld = uPointer * vec2(9.0, 5.0);
  float d = distance(pos.xz, vec2(pointerWorld.x, pointerWorld.y - 4.0));
  float ripple = exp(-d * 0.30) * sin(d * 1.6 - uTime * 2.2);

  pos.y += (height + ripple * 0.7) * uAmplitude;

  // The field folds away at the far edge, curving the horizon.
  pos.y -= pow(max(-pos.z - 2.0, 0.0) * 0.05, 2.0);

  // Reveal sweeps in from the horizon toward the viewer during the handoff.
  // depthAlong runs 0 at the nearest row to ~30 at the horizon.
  float depthAlong = -pos.z + 6.0;
  float edge = 34.0 - uReveal * 40.0;
  float revealMask = smoothstep(edge, edge + 10.0, depthAlong);
  pos.y *= revealMask;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float depth = -mvPosition.z;
  vDepth = depth;
  vRandom = aRandom;
  vTint = aTint;

  // Crest brightness — the "signal" reading.
  vGlow = smoothstep(-0.3, 1.5, height) * revealMask;
  vGlow += exp(-d * 0.45) * 0.5 * uAccent;

  gl_PointSize = uSize * aScale * uPixelRatio * (16.0 / max(depth, 1.2));
  gl_PointSize *= mix(0.55, 1.25, vGlow);
  // Brand-tier points carry a little more presence.
  gl_PointSize *= 1.0 + step(0.95, aTint) * 0.35;
}
`

export const signalFieldFragment = /* glsl */ `
precision highp float;

uniform float uOpacity;
uniform float uAccent;

varying float vGlow;
varying float vDepth;
varying float vRandom;
varying float vTint;

${PALETTE}

void main() {
  // Soft round sprite, no texture fetch.
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.05, d);
  if (alpha < 0.01) discard;

  // Hovering a service or crossing a project transition pulls more points
  // up into the brand tier — the field answers the interaction.
  float emberEdge = mix(0.80, 0.66, uAccent);
  float brandEdge = mix(0.95, 0.86, uAccent);

  // Three tiers, each with its own internal tonal range.
  vec3 neutral = mix(C_INK, C_ASH, smoothstep(0.0, 0.70, vGlow));
  vec3 ember   = mix(C_EMBER, C_DEEP, smoothstep(0.10, 0.80, vGlow));
  vec3 brand   = mix(C_DEEP, C_BRAND, smoothstep(0.0, 0.60, vGlow));
  brand        = mix(brand, C_WARM, smoothstep(0.78, 1.0, vGlow) * 0.55);

  vec3 color = neutral;
  color = mix(color, ember, step(emberEdge, vTint));
  color = mix(color, brand, step(brandEdge, vTint));

  // Neutral points stay barely there; brand points carry the light.
  float weight = 0.30;
  weight = mix(weight, 0.70, step(emberEdge, vTint));
  weight = mix(weight, 1.00, step(brandEdge, vTint));

  // Distance fade keeps the far field from turning into noise.
  float fog = smoothstep(1.5, 6.0, vDepth) * (1.0 - smoothstep(18.0, 44.0, vDepth));

  // A small fraction of brand points burn brighter, giving the field its
  // sparkle without ever reading as embers from a fire.
  float spark = step(0.985, vRandom) * step(brandEdge, vTint) * 0.7;

  float a = alpha * uOpacity * fog * weight * (0.20 + vGlow * 0.95 + spark);
  gl_FragColor = vec4(color * (0.6 + vGlow * 0.9 + spark), a);
}
`
