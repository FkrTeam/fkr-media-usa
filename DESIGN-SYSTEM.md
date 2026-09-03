# FKR Media USA — Design System

The system is small on purpose. One typeface family for display, one for text,
one accent, one motion vocabulary, one WebGL idea. Everything on the site is
assembled from the tokens below, which live in `styles/tokens.css` and — for
JavaScript and GLSL — in `src/data/brand.js`.

---

## 1 · Creative concept — "The Signal Field"

FKR moves signal: strategy becomes language, language becomes light, light
reaches an audience. The whole experience is built on that single image.

The room is neutral black. There is exactly one source of energy in it, and
it is FKR red. Nothing else is coloured.

A lattice of thousands of points lies on a receding plane and is lifted by
travelling waves. Crests read as transmission; troughs fall back into the
dark. The waves respond to the cursor, and the camera dollies forward through
the field as the visitor scrolls, so the site reads as one continuous space
rather than a stack of sections. The 40-second opening film is the same idea
pre-rendered — flowing signal waves under typographic title cards — so the
handoff from film to real-time is a continuation, not a cut. Where a route
needs one strong graphic object, the field steps back and a single DOM-synced
plane carries it, changing through a noise-driven displacement wipe; that
tear front is the only place brand red ever touches imagery. Nothing else is
added: no floating spheres, no bloom chain, no second effect competing for
attention. The restraint is what makes it read as premium rather than as a
demo — and it is why the same world can carry four different routes without
inventing a new effect for each one.

---

## 2 · Colour

Both brand constants are **sampled from the supplied logo artwork**
(`public/brand/fkr-media-usa-logo.png`), not approximated:

| | Value | Share of the logo's opaque pixels |
|---|---|---|
| FKR red | `#EE473D` | 87.1% |
| Logo black | `#050505` | 12.4% |

Everything below is derived from those two values.

### Budget

This is a black identity with a red signal in it. Held to roughly:

- **75–80%** black, near-black and charcoal
- **12–18%** warm off-white and neutral greys — the typography
- **5–8%** FKR red

Red is spent on calls to action, active states, one word per headline,
section indices, cursor states, progress, the transition seam and the top 5%
of the particle field. It is never a surface, never a section background,
and never body text.

### Neutral ramp — warm-leaning blacks, never navy

| Token | Value | Role |
|---|---|---|
| `--n-950` | `#050505` | Page ground — the logo's own black |
| `--n-900` | `#080808` | |
| `--n-850` | `#0C0C0C` | Raised ground, menu |
| `--n-800` | `#121212` | Surface |
| `--n-750` | `#181818` | Surface 2 |
| `--n-700` | `#202020` | Neutral geometry |
| `--n-600` | `#2A2A2A` | |

### FKR red ramp

| Token | Value | Role |
|---|---|---|
| `--r-700` | `#A82A23` | Pressed |
| `--r-600` | `#C2352D` | Deep, gradient base |
| `--r-500` | `#EE473D` | **BRAND — the exact logo value, never altered** |
| `--r-400` | `#FF5B51` | Hover, hot highlight |
| `--r-200` | `#F7AEAA` | Soft tint, present in the logo's own edges |
| `--r-050` | `#FFE3DF` | Warm specular highlight |

### Semantic and contrast

| Token | Value | On `#050505` | Under the ember |
|---|---|---|---|
| `--fg` | `#F4F2EF` | 18.2 : 1 | 16.9 : 1 |
| `--fg-muted` | `#A7A4A0` | 8.2 : 1 | 7.6 : 1 |
| `--fg-faint` | `#85827E` | 5.3 : 1 | 4.9 : 1 |
| `--brand` | `#EE473D` | 5.4 : 1 | 5.0 : 1 |
| `--brand-hover` | `#FF5B51` | 6.7 : 1 | 6.2 : 1 |

`#050505` on `--brand` — the solid CTA — is 5.4 : 1. Every pair clears WCAG AA
against both the page ground and the brightest point of the ambient ember.

Structure is neutral: `--border` is `rgba(255,255,255,.08)`. Red borders
(`--border-brand`, `--border-brand-strong`) mark **state**, not boxes.

### Depth, not flat black

The page never uses flat `#000`. Depth comes from one fixed atmospheric
ground carrying a single restrained signal:

```css
--ground: radial-gradient(95% 55% at 50% -14%,
  rgba(238, 71, 61, 0.050) 0%, rgba(238, 71, 61, 0.014) 28%, var(--n-950) 56%);
```

The WebGL background shader layers a neutral graphite haze on top of it — the
tonal variation is grey, the single light is red — and dithers the result so
the dark ramp never bands.

---

## 3 · Typography

**Space Grotesk** (display) + **Inter** (text). Both self-hosted as latin /
latin-ext variable-font subsets in `styles/fonts/` — no external font request.

| Token | Clamp | Use |
|---|---|---|
| `--fs-mega` | `clamp(1.75rem, 8vw, 8.5rem)` | Hero headline |
| `--fs-display` | `clamp(2.75rem, 8.4vw, 8rem)` | Statement, contact |
| `--fs-h2` | `clamp(2rem, 5.4vw, 4.75rem)` | About title |
| `--fs-h3` | `clamp(1.375rem, 2.6vw, 2.375rem)` | Project title |
| `--fs-h4` | `clamp(1.125rem, 1.5vw, 1.5rem)` | Capability group |
| `--fs-lead` | `clamp(1.0625rem, 1.35vw, 1.375rem)` | Standfirst |
| `--fs-body` | `1rem` | Body |
| `--fs-sm` | `0.875rem` | Secondary body |
| `--fs-label` | `0.75rem` | Uppercase metadata (12px floor) |

Display type is uppercase, warm off-white, tracked in (`-0.045em` at mega,
`-0.035em` at display), and set at `0.92`–`1.02` line-height. Exactly one word
per headline may take `.accent-word` and carry the brand red — that is the
entire red type budget for a viewport, and it is why the red still registers
when it appears.

Body is `1.65` at 45–75 characters. Numerals in indices, statistics and timers
use `font-variant-numeric: tabular-nums` so nothing shifts as values change.

The hero headline is set as three authored lines that never re-wrap above
720px; the type scale is calibrated so the longest line always fits. Below
720px it is allowed to wrap, because three no-wrap lines on a phone would
force the type down to a size that stops reading as a statement.

---

## 4 · Spacing, grid and containers

4px base scale: `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 ·
`--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48 · `--sp-8` 64 · `--sp-9` 96 ·
`--sp-10` 128 · `--sp-11` 176.

- Section rhythm: `--sp-section: clamp(6rem, 13vh, 11rem)`
- Container: `--container: 1560px`, narrow variant `980px`
- Gutter: `clamp(1.25rem, 4vw, 4.5rem)`
- Grid: 12 columns, `--col-gap: clamp(1rem, 1.8vw, 2rem)`

Breakpoints: 1920 · 1440 · 1024 · 900 · 780 · 720 · 640. Mobile layouts are
authored, not scaled down.

---

## 5 · Borders, radii and surfaces

Sharp and engineered: `--r-0` 0 · `--r-1` 2px · `--r-2` 6px · `--r-pill` 999px.
Cards do not exist. Structure is carried by neutral hairlines
(`rgba(255,255,255,.08)`) and negative space. There are no drop shadows
anywhere; elevation is expressed by the WebGL layer behind the DOM.

The only blur in the system is the navigation membrane at
`blur(14px) saturate(140%)`, and it only appears once the visitor has scrolled.

---

## 6 · Buttons and links

**Secondary (`.btn`)** — an uppercase slab with a neutral hairline border,
used in the navigation so the bar never carries a glowing red button. On hover
a brand panel slides up from below and the label inverts to near-black. On
desktop it is magnetic: it leans toward the pointer within its own bounds and
snaps back on leave. Minimum height 52px (68px for `--lg`), always clearing
the 44px touch target.

**Primary (`.btn--solid`)** — brand fill, near-black label, brightening to
`--r-400` on hover. Used once, on the closing CTA, so it reads as a climax
rather than as another red panel.

**Ghost (`.btn--ghost`)** — transparent with a neutral border that becomes
`--border-brand-strong` on intent.

**Link (`.link`)** — warm white with an underline that wipes in from the left
and out to the right, 620ms on `power4.out`.

**Service row** — no button chrome at all. Hover sweeps a dark-ember gradient
across the row, shifts the title right, turns the index brand red, and raises
the accent in the WebGL field. Focus produces the identical state via
`:focus-within`.

---

## 7 · Motion

| Token | Value | Use |
|---|---|---|
| `--e-out` | `cubic-bezier(.16,1,.30,1)` | Entrances |
| `--e-inout` | `cubic-bezier(.83,0,.17,1)` | State changes |
| `--e-quick` | `cubic-bezier(.40,0,.20,1)` | Colour, opacity |
| `--d-fast` | 180ms | Micro-interactions |
| `--d-base` | 280ms | Standard |
| `--d-slow` | 620ms | Sweeps, underlines |
| `--d-cine` | 1200ms | Reveals, handoffs |

In GSAP: `power4.out` for entries, `power3.inOut` for state, `expo.out` for
anything cinematic. Exits run at roughly 1.6× the entry speed. No bounce, no
elastic, anywhere. The brand migration changed colour states only — every
timing, easing and timeline is unchanged.

Motion hierarchy: at most one or two elements move per view. Masked-line
reveals are the signature; everything else is opacity and a short translate.
Only `transform` and `opacity` are animated.

Under `prefers-reduced-motion: reduce` the film never plays, split text is
restored unsplit, the marquee stops, WebGL amplitude drops to 35%,
post-processing is disabled and every GSAP duration collapses to ~0.

---

## 8 · WebGL visual language

Three layers, one persistent context, one render loop:

1. **Background** — a fullscreen shader quad: a neutral graphite haze for
   tonal variation, plus one restrained ember that follows scroll down the
   frame, vignette and dither. The haze is grey; only the light is red.
2. **Signal field** — 45,000 additive points on a receding plane (desktop;
   60% on tablet, 30% on phones), lifted by three wave trains plus a noise
   field, with a pointer ripple. One draw call. Colour is fixed by the
   `aTint` attribute: **80% neutral graphite** and barely present, **15% dark
   ember**, **5% brand coral**. Interaction lowers the tier thresholds so the
   field answers a hover — it never turns uniformly red.
3. **Media plane** — a single plane matched to whichever element on the
   current route carries `data-media-stage`, carrying an abstract brand
   visual through a noise displacement wipe. The wipe front carries a thin
   ember-to-coral seam that exists only during the transition; imagery is
   never permanently tinted. The DOM decides what it tracks, so any route
   can adopt it without touching the module.

A final composite pass adds radial chromatic aberration, film grain and a
vignette. Aberration rests at `0.0042` rather than `0.006` — red fringes read
harder than blue ones did, and typography has to stay crisp. There is no
separate bloom chain: the glow is authored inside the field shader with
additive blending, which costs a fraction of a blur pass and keeps red from
bleeding into nearby text.

The shader ramp is a tonal ladder, never a single flat red:

```glsl
C_VOID  #050505   C_INK   #0C0C0C   C_ASH   #202020
C_EMBER #441614   C_DEEP  #8B2821   C_BRAND #EE473D
C_HOT   #FF5B51   C_WARM  #FFE3DF
```

It is defined once in `src/data/brand.js` and imported by every shader, so the
GLSL palette and the CSS tokens cannot drift apart.

Colour convention: every surface is a custom `ShaderMaterial` writing final
display-space colour, so textures are sampled raw (`NoColorSpace`) and neither
tone mapping nor an automatic output transform is applied.

---

## 9 · Logo

Two official files are in use, and neither is ever recoloured or redrawn:

- `fkr-media-usa-logo.png` — the primary lockup, **MEDIA** set in black
- `fkr-media-logo-new-white.png` — the approved **negative variant**, with
  MEDIA reversed to white and FKR/USA still in brand red

Because an approved negative variant exists, the footer now carries the full
lockup directly on the black ground; the warm presentation plate it used
before has been removed. Two presentations:

- **Compact mark** — the red FKR portion of the lockup, cropped from the
  master at bounds measured from its alpha channel (`x 0–841`, `y 34–333`;
  the full-height divider bar begins at `x 890`). Used in the navigation, the
  preloader and the favicon, where it sits on near-black at full legibility.
- **Full lockup (negative)** — straight on the black ground in the footer,
  no plate required.
- **Full lockup (primary)** — still presented on a warm off-white plate on
  the Open Graph card, because that card is composited from the black-wordmark
  master.

Both are produced by `scripts/generate-brand-assets.sh`. No variant of the
logo is invented, redrawn, recoloured or CSS-filtered anywhere in the codebase.

---

## 10 · Information architecture

```
HOME                    SERVICES              ABOUT              CONTACT
├ Hero                  ├ Hero                ├ Hero             ├ Hero
├ 01 About              ├ 01 Overview         ├ 01 Manifesto     └ 01 Enquiry
├ 02 Services           ├ 02 Capabilities     ├ 02 Approach         · form
├ 03 Numbers            │   (sticky index)    ├ 03 Principles       · details
├ 04 Reviews            ├ 03 How we work      ├ 04 Experience
├ 05 References         ├ 04 Why FKR          ├ 05 References
└ 06 Contact CTA        └ 05 Contact CTA      └ 06 Contact CTA
```

Every route ends on the same CTA block, so the whole site funnels to one
place. Section indices restart per route — they number that page's argument,
not the site.

### Routing

Four real static documents, composed from one shell by `scripts/pages.mjs`.
A direct URL loads its own document with its own metadata; in-session
navigation is intercepted by `src/core/Router.js`, which fetches the target,
swaps `<main>`, lifts the metadata across, and leaves the WebGL context,
render loop and intro session state completely untouched.

The transition is a curtain: the page recedes, a sheet wipes up carrying a
faint ember at its base, the content is exchanged behind it, and the sheet
wipes away. Roughly 1.2 s end to end, `power4.inOut`. No white flash, no
reload.

### Section colour rhythm

Tonal variation comes from the WebGL ambient, not from alternating panels.
Each section sets a resting accent level as it enters:

| Section | Ambient | Reading |
|---|---|---|
| Hero | 0.10 | Composed |
| About | 0.28 | The world opens |
| Services | 0.20 | Steady |
| Numbers | 0.42 | Signal density rises |
| Reviews | **0.04** | Deliberately quiet — readability first |
| References | 0.16 | Settled |
| Contact CTA | **0.62** | Resolves to the brand focal energy |

There are no light sections and no alternating boxes. The page is one
continuous dark room in which the light level changes.

## 11 · What this system does not do

No glassmorphism panels. No rounded cards. No icon grids. No stock
illustration. No red section backgrounds, no red duotone over photography, no
red borders around containers, no neon glow. Nothing here belongs to gaming,
cyberpunk, crypto or automotive branding — the red is editorial, not
aggressive. No scroll-jacking: scrolling is native everywhere, and exactly one
section is pinned because its storytelling needs it.

One deliberate omission: the custom cursor does **not** use
`mix-blend-mode: difference`. Differencing white against `#EE473D` inverts it
straight back to cyan — the exact colour this identity replaced. The cursor
states its own colour instead.
