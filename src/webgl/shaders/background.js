import { SIMPLEX_3D, FBM, GRAIN, PALETTE } from './common.js'

/**
 * Atmospheric ground plate.
 *
 * A single fullscreen quad. The scene is a neutral black room with one
 * light in it: a slow drifting haze in graphite, and a restrained ember
 * bloom that follows the scroll. Red never washes the frame — it reads as
 * a single source of energy in an otherwise unlit space.
 */

export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const backgroundFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uScroll;
uniform float uIntensity;
uniform vec2  uPointer;
uniform vec2  uResolution;

varying vec2 vUv;

${SIMPLEX_3D}
${FBM}
${GRAIN}
${PALETTE}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Slow haze — neutral graphite, not coloured. It gives the black room
  // its tonal variation so the frame never reads as flat #000.
  float t = uTime * 0.014;
  float n1 = fbm(vec3(p * 1.35, t));
  float n2 = fbm(vec3(p * 2.6 + 12.0, t * 1.7));
  float haze = smoothstep(-0.35, 0.85, n1 * 0.75 + n2 * 0.35);

  // Vertical lift: graphite at the top edge falling to void at the bottom.
  float wash = smoothstep(1.05, -0.15, uv.y);

  // The single light source. It tracks scroll down the frame and drifts a
  // little with the pointer, so the room feels inhabited rather than lit.
  vec2 emberCentre = vec2(0.5 + uPointer.x * 0.06, 0.94 - uScroll * 0.55);
  float ember = 1.0 - smoothstep(0.0, 0.58,
    distance(uv * vec2(aspect, 1.0), emberCentre * vec2(aspect, 1.0)));
  ember = pow(max(ember, 0.0), 3.4);

  vec3 color = C_VOID;
  color = mix(color, C_INK, wash * 0.9);
  color = mix(color, C_ASH, haze * wash * 0.44);

  // Ember ladder: the falloff carries the tonal range, so the red arrives
  // through dark ember rather than as a flat coloured circle.
  color += C_EMBER * ember * 0.46 * uIntensity;
  color += C_DEEP  * pow(ember, 2.0) * 0.20 * uIntensity;
  color += C_BRAND * pow(ember, 4.5) * 0.07 * uIntensity;

  // The room cools very slightly toward neutral as the page progresses.
  color = mix(color, color * vec3(0.96, 0.99, 1.0), uScroll * 0.35);

  // Corner falloff keeps attention centred.
  float vignette = 1.0 - smoothstep(0.42, 1.18, length(p));
  color *= mix(0.55, 1.0, vignette);

  // Dither: ±1/255 of noise removes visible banding on the dark ramp.
  color += (grain(uv * uResolution, fract(uTime)) - 0.5) * 0.010;

  gl_FragColor = vec4(color, 1.0);
}
`
