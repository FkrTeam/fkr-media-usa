import { GRAIN } from './common.js'

/**
 * Final composite pass.
 *
 * Deliberately cheap: a radial chromatic offset, film grain and a vignette.
 * No bloom pass — the glow is authored inside the field shader with additive
 * blending, which costs a fraction of a separate blur chain.
 */

export const compositeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const compositeFragment = /* glsl */ `
precision highp float;

uniform sampler2D uScene;
uniform vec2  uResolution;
uniform float uTime;
uniform float uAberration;
uniform float uGrain;
uniform float uVignette;

varying vec2 vUv;

${GRAIN}

void main() {
  vec2 uv = vUv;
  vec2 centred = uv - 0.5;
  float r2 = dot(centred, centred);

  // Aberration grows toward the corners, so the centre stays razor sharp.
  vec2 offset = centred * r2 * uAberration;

  vec3 color;
  color.r = texture2D(uScene, uv + offset).r;
  color.g = texture2D(uScene, uv).g;
  color.b = texture2D(uScene, uv - offset).b;

  // Vignette.
  color *= mix(1.0, 1.0 - smoothstep(0.16, 0.78, r2), uVignette);

  // Grain, scaled down in the highlights so it reads as film, not noise.
  float g = grain(uv * uResolution, fract(uTime * 0.7)) - 0.5;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += g * uGrain * mix(1.0, 0.35, luma);

  gl_FragColor = vec4(color, 1.0);
}
`
