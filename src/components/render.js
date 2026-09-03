import { el, fill, qs, qsa, asset, route } from '../utils/dom.js'
import { pad2 } from '../utils/math.js'
import { siteData } from '../data/site.js'
import { services, process, propositions } from '../data/services.js'
import { reviews, reviewSummary } from '../data/reviews.js'
import { stats } from '../data/stats.js'
import { references } from '../data/references.js'
import { approach, values } from '../data/about.js'
import { budgetRanges } from '../config/contact.js'

/**
 * Content rendering: turns the files in `src/data` into DOM.
 *
 * Every renderer is a no-op when its container is absent, so one call covers
 * all four routes — each page simply declares the containers it wants. That
 * is also what makes the router cheap: after a swap we run the same pass
 * again and only the new page's containers fill.
 *
 * Nothing in this file knows about GSAP or WebGL.
 */

const svgNS = 'http://www.w3.org/2000/svg'

function icon(path, className = '') {
  const svg = document.createElementNS(svgNS, 'svg')
  if (className) svg.setAttribute('class', className)
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  const node = document.createElementNS(svgNS, 'path')
  node.setAttribute('d', path)
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', '1.5')
  svg.append(node)
  return svg
}

const arrow = (className) => icon('M2 14 L14 2 M6 2 h8 v8', className)

/* ══════════════════════════════════════════════════════════════════════
   Service marks

   Six abstract line figures, all built inside the same circle so they read
   as one family. Every line is computed against the circle's own geometry
   rather than clipped, which keeps each mark self-contained — no shared
   ids, no duplicate-id collisions when six of them sit on one page.
   ══════════════════════════════════════════════════════════════════════ */

const R = 25          // circle radius inside a 64×64 box
const C = 32          // centre

function line(x1, y1, x2, y2, width = 1) {
  const node = document.createElementNS(svgNS, 'line')
  node.setAttribute('x1', x1.toFixed(2))
  node.setAttribute('y1', y1.toFixed(2))
  node.setAttribute('x2', x2.toFixed(2))
  node.setAttribute('y2', y2.toFixed(2))
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', String(width))
  node.setAttribute('stroke-linecap', 'round')
  return node
}

/** Parallel chords across the circle at `angle`, so nothing spills outside. */
function hatch(angle, count, { from = -1, to = 1 } = {}) {
  const rad = (angle * Math.PI) / 180
  const dir = [Math.cos(rad), Math.sin(rad)]
  const nor = [-Math.sin(rad), Math.cos(rad)]
  const out = []

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const d = (from + (to - from) * t) * R * 0.94
    const half = Math.sqrt(Math.max(R * R - d * d, 0))
    if (half < 1) continue
    out.push(line(
      C + nor[0] * d - dir[0] * half, C + nor[1] * d - dir[1] * half,
      C + nor[0] * d + dir[0] * half, C + nor[1] * d + dir[1] * half
    ))
  }
  return out
}

/** Spokes from an inner radius to the rim. */
function spokes(count, inner) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    out.push(line(
      C + Math.cos(a) * inner, C + Math.sin(a) * inner,
      C + Math.cos(a) * R, C + Math.sin(a) * R
    ))
  }
  return out
}

function arc(radius, startDeg, endDeg, width = 1) {
  const rad = (deg) => (deg * Math.PI) / 180
  const x1 = C + Math.cos(rad(startDeg)) * radius
  const y1 = C + Math.sin(rad(startDeg)) * radius
  const x2 = C + Math.cos(rad(endDeg)) * radius
  const y2 = C + Math.sin(rad(endDeg)) * radius
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0

  const node = document.createElementNS(svgNS, 'path')
  node.setAttribute('d', `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`)
  node.setAttribute('fill', 'none')
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', String(width))
  node.setAttribute('stroke-linecap', 'round')
  return node
}

const MARKS = [
  () => spokes(30, 11),                                       // 01 emission
  () => hatch(-45, 15),                                       // 02 full field
  () => [...hatch(-45, 9, { from: -0.1, to: 1 })],            // 03 half field
  () => [arc(24, -140, 110, 1.4), arc(17, 30, 300, 1.2), arc(10, -60, 190, 1.2), arc(4, 0, 359, 1.2)],
  () => hatch(90, 15),                                        // 05 signal bars
  () => [...hatch(-45, 10), ...hatch(45, 10)]                 // 06 weave
]

function serviceMark(index) {
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'srv__mark')
  svg.setAttribute('viewBox', '0 0 64 64')
  svg.setAttribute('aria-hidden', 'true')
  const group = document.createElementNS(svgNS, 'g')
  for (const node of MARKS[index % MARKS.length]()) group.append(node)
  svg.append(group)
  return svg
}

/* ══════════════════════════════════════════════════════════════════════
   Shared chrome
   ══════════════════════════════════════════════════════════════════════ */

function renderChrome() {
  const year = qs('[data-year]')
  if (year) year.textContent = String(new Date().getFullYear())

  const footerSocials = qs('[data-footer-socials]')
  if (footerSocials) {
    fill(
      footerSocials,
      siteData.socials.map((social) =>
        el('li', {}, [
          el('a', {
            class: 'link',
            href: social.url,
            rel: 'noopener noreferrer',
            target: '_blank',
            text: social.label
          })
        ])
      )
    )
  }

  const socials = qs('[data-socials]')
  if (socials) {
    const nodes = []
    siteData.socials.forEach((social, i) => {
      if (i > 0) nodes.push(document.createTextNode(' · '))
      nodes.push(
        el('a', {
          class: 'link',
          href: social.url,
          rel: 'noopener noreferrer',
          target: '_blank',
          text: social.label
        })
      )
    })
    fill(socials, nodes)
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Home · Services grid
   ══════════════════════════════════════════════════════════════════════ */

function renderServicesGrid() {
  const host = qs('[data-services-grid]')
  if (!host) return

  fill(
    host,
    services.map((service, i) =>
      el('a', {
        class: 'srv',
        href: route(`/services#${service.id}`),
        'data-route-link': true,
        'data-service': String(i),
        'aria-label': `${service.name} — see full service detail`
      }, [
        serviceMark(i),

        el('h3', { class: 'srv__name', text: service.name }),
        el('p', { class: 'srv__summary', text: service.summary }),

        el('ul', { class: 'srv__caps' },
          service.capabilities.map((cap) => el('li', { text: cap }))
        )
      ])
    )
  )
}

/* ══════════════════════════════════════════════════════════════════════
   Home · Client filmstrip

   The same reference data as the /about wall, presented as a single
   drifting band under the hero. Two identical groups make the loop
   seamless; the clone is hidden from assistive tech so the roster is
   announced once.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * A client mark, or the client's name when no artwork exists.
 *
 * width/height are stamped from the data rather than left to the image to
 * report after it loads. The marquee measures its own track the instant it
 * is built, so an unsized lazy image would be measured as zero-wide and the
 * loop would come up short and seam. It also keeps the strip from reflowing
 * as the marks arrive.
 */
function refImage(ref, eager = false) {
  if (!ref.logo) return el('span', { class: 'ref__wordmark', text: ref.name })

  return el('img', {
    src: asset(ref.logo),
    alt: ref.name,
    width: ref.w,
    height: ref.h,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async'
  })
}

function renderLogoStrip() {
  const host = qs('[data-logostrip]')
  if (!host) return

  const item = (ref, index, eagerGroup) => {
    const inner = refImage(ref, eagerGroup && index < 10)

    return el('li', { class: `strip__item${ref.placeholder ? ' strip__item--placeholder' : ''}` }, [
      ref.url
        ? el('a', { class: 'strip__link', href: ref.url, rel: 'noopener noreferrer', target: '_blank' }, [inner])
        : inner
    ])
  }

  const group = (hidden) =>
    el('ul', { class: 'marquee__group', 'aria-hidden': hidden ? 'true' : undefined },
      references.map((ref, index) => item(ref, index, !hidden)))

  fill(host, [
    el('div', { class: 'marquee__track' }, [group(false), group(true)])
  ])

}

/* ══════════════════════════════════════════════════════════════════════
   Home + About · Numbers
   ══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
   Home · 01 About — the practice ladder
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The four stages of the work, beside the claim that they are one line.
 *
 * This slot used to hold a generated placeholder poster behind the WebGL
 * media plane: a decorative rectangle that illustrated nothing and said
 * nothing. The paragraph next to it already makes a specific claim — one
 * team, one continuous line from first insight to launch — so the honest
 * companion to it is the line itself, named stage by stage.
 *
 * Titles only. The full reasoning for each stage lives on /about, which is
 * where the "About FKR" button in this same block goes; repeating the bodies
 * here would turn a summary into a duplicate. It also does not collide with
 * the services grid below, which answers a different question — that section
 * is WHAT the work is, this one is HOW it runs.
 */
function renderPractice() {
  const host = qs('[data-practice]')
  if (!host) return

  fill(host, [
    el('p', { class: 'practice__label', text: 'How the work runs' }),
    el('div', { class: 'practice__track', 'data-rule': '' }, [
      el('span', { class: 'practice__rule', 'aria-hidden': 'true' }),
      el('ol', { class: 'practice__list' },
        approach.map((step) =>
          el('li', { class: 'practice__step', 'data-reveal': 'up' }, [
            el('span', { class: 'practice__num', text: step.num }),
            el('h3', { class: 'practice__title', text: step.title })
          ])
        )
      )
    ])
  ])
}

function renderStats() {
  const host = qs('[data-stats]')
  if (!host) return

  fill(
    host,
    stats.map((stat) => {
      const real = !stat.placeholder && Number.isFinite(stat.value)

      // A placeholder never animates. Counting a fabricated number up from
      // zero would dress it as a measured fact.
      const value = real
        ? el('span', { 'data-count': String(stat.value), text: '0' })
        : el('span', { class: 'stat__placeholder', title: 'Placeholder — awaiting verified figure', text: stat.display })

      return el('div', { class: `stat${real ? '' : ' stat--placeholder'}`, 'data-reveal': 'up' }, [
        el('p', { class: 'stat__value' }, [
          value,
          stat.suffix ? el('span', { class: 'stat__suffix', text: stat.suffix }) : null
        ]),
        el('p', { class: 'stat__label', text: stat.label })
      ])
    })
  )
}

/* ══════════════════════════════════════════════════════════════════════
   Home · 04 Reviews
   ══════════════════════════════════════════════════════════════════════ */

function renderReviews() {
  const track = qs('[data-reviews-track]')
  if (!track) return

  // `?reviews=draft` shows the unapproved drafts, each stamped DRAFT, so the
  // section can be reviewed at real text length without that state ever
  // reaching a visitor by accident.
  const showDrafts = new URLSearchParams(location.search).get('reviews') === 'draft'

  // The aggregate rating only renders against a real, attributable source.
  const summary = qs('[data-reviews-summary]')
  if (summary) {
    if (reviewSummary.enabled && reviewSummary.score) {
      summary.hidden = false
      fill(summary, [
        el('span', { class: 'reviews__score', text: `${reviewSummary.score} / ${reviewSummary.outOf}` }),
        el('span', { class: 'reviews__stars', 'aria-hidden': 'true', text: '★★★★★' }),
        el('span', {
          class: 'reviews__source',
          text: reviewSummary.count
            ? `Based on ${reviewSummary.count} verified reviews${reviewSummary.source ? ` on ${reviewSummary.source}` : ''}`
            : 'Based on verified client reviews'
        })
      ])
    } else {
      summary.hidden = true
    }
  }

  fill(
    track,
    reviews.map((review, i) =>
      el('li', {
        class: `review${review.featured ? ' review--featured' : ''}${review.quotePending ? ' review--pending' : ''}`,
        'data-review': String(i)
      }, [
        el('span', { class: 'review__index', text: pad2(i + 1) }),

        review.rating
          ? el('span', { class: 'review__rating', 'aria-label': `${review.rating} out of 5`, text: '★★★★★'.slice(0, review.rating) })
          : null,

        // A named person never gets words they did not say. Until the client
        // approves, the card states that plainly — unless this is an explicit
        // draft preview, which stamps every card DRAFT.
        review.quote && (!review.quotePending || showDrafts)
          ? el('blockquote', { class: 'review__quote' }, [el('p', { text: `“${review.quote}”` })])
          : el('div', { class: 'review__pending' }, [
              el('p', { class: 'review__pending-label', text: 'Testimonial pending approval' }),
              el('p', { class: 'review__pending-note', text: 'The client’s own wording will appear here.' })
            ]),

        review.quotePending && showDrafts
          ? el('span', { class: 'review__draft', text: 'Draft — not approved' })
          : null,

        el('figcaption', { class: 'review__by' }, [
          // Typography rather than stock photography when no portrait exists.
          review.portrait
            ? el('img', { class: 'review__portrait', src: asset(review.portrait), alt: '', width: '96', height: '96', loading: 'lazy', decoding: 'async' })
            : el('span', { class: 'review__monogram', 'aria-hidden': 'true', text: (review.name || '—').trim().charAt(0) }),
          el('span', { class: 'review__meta' }, [
            el('span', { class: 'review__name', text: review.name }),
            el('span', { class: 'review__role', text: [review.role, review.company].filter(Boolean).join(' · ') })
          ])
        ])
      ])
    )
  )
}

/* ══════════════════════════════════════════════════════════════════════
   Home + About · 05 References
   ══════════════════════════════════════════════════════════════════════ */

function renderReferences() {
  const host = qs('[data-references]')
  if (!host) return

  fill(
    host,
    references.map((ref) => {
      const inner = refImage(ref)

      const body = ref.url
        ? el('a', { class: 'ref__link', href: ref.url, rel: 'noopener noreferrer', target: '_blank' }, [inner])
        : inner

      return el('li', {
        class: `ref${ref.placeholder ? ' ref--placeholder' : ''}`,
        'data-reveal': 'up'
      }, [body])
    })
  )
}

/* ══════════════════════════════════════════════════════════════════════
   /services
   ══════════════════════════════════════════════════════════════════════ */

function renderServicesOverview() {
  const host = qs('[data-services-overview]')
  if (!host) return

  fill(
    host,
    services.map((service) =>
      el('a', {
        class: 'ovw',
        href: `#${service.id}`,
        'data-jump': service.id,
        'data-reveal': 'up'
      }, [
        el('span', { class: 'ovw__num', text: service.num }),
        el('h3', { class: 'ovw__name', text: service.name }),
        el('p', { class: 'ovw__summary', text: service.summary })
      ])
    )
  )
}

function renderServicesDetail() {
  const host = qs('[data-services-detail]')
  if (!host) return

  fill(
    host,
    services.map((service) =>
      el('article', { class: 'detail', id: service.id, 'data-detail': service.id }, [
        el('header', { class: 'detail__head' }, [
          el('span', { class: 'detail__num', text: service.num }),
          el('h3', { class: 'detail__name', text: service.name })
        ]),

        el('p', { class: 'detail__summary lead', text: service.summary }),
        el('p', { class: 'detail__body', text: service.detail }),

        el('div', { class: 'detail__cols' }, [
          el('div', { class: 'detail__col' }, [
            el('p', { class: 'contact__key', text: 'Capabilities' }),
            el('ul', { class: 'detail__list' }, service.capabilities.map((cap) => el('li', { text: cap })))
          ]),
          el('div', { class: 'detail__col' }, [
            el('p', { class: 'contact__key', text: 'Deliverables' }),
            el('ul', { class: 'detail__list' }, service.deliverables.map((item) => el('li', { text: item })))
          ])
        ])
      ])
    )
  )

  const index = qs('[data-detail-index-list]')
  if (index) {
    fill(
      index,
      services.map((service) =>
        el('li', {}, [
          el('a', {
            class: 'services-detail__link',
            href: `#${service.id}`,
            'data-jump': service.id,
            'data-index-for': service.id
          }, [
            el('span', { class: 'services-detail__num', text: service.num }),
            el('span', { text: service.name })
          ])
        ])
      )
    )
  }
}

function renderProcess() {
  const host = qs('[data-process]')
  if (!host) return

  fill(
    host,
    process.map((step) =>
      el('li', { class: 'process__step', 'data-reveal': 'up' }, [
        el('span', { class: 'process__num', text: step.num }),
        el('h3', { class: 'process__name', text: step.name }),
        el('p', { class: 'process__body', text: step.body })
      ])
    )
  )
}

function renderPropositions() {
  const host = qs('[data-propositions]')
  if (!host) return

  fill(
    host,
    propositions.map((item) =>
      el('div', { class: 'prop', 'data-reveal': 'up' }, [
        el('h3', { class: 'prop__title', text: item.title }),
        el('p', { class: 'prop__body', text: item.body })
      ])
    )
  )
}

/* ══════════════════════════════════════════════════════════════════════
   /about
   ══════════════════════════════════════════════════════════════════════ */

function renderApproach() {
  const host = qs('[data-approach]')
  if (!host) return

  fill(
    host,
    approach.map((item) =>
      el('li', { class: 'approach__item', 'data-reveal': 'up' }, [
        el('span', { class: 'approach__num', text: item.num }),
        el('div', { class: 'approach__body' }, [
          el('h3', { class: 'approach__title', text: item.title }),
          el('p', { text: item.body })
        ])
      ])
    )
  )
}

function renderValues() {
  const host = qs('[data-values]')
  if (!host) return

  fill(
    host,
    values.map((item) =>
      el('div', { class: 'value', 'data-reveal': 'up' }, [
        el('h3', { class: 'value__word', text: item.word }),
        el('p', { text: item.body })
      ])
    )
  )
}

/* ══════════════════════════════════════════════════════════════════════
   /contact
   ══════════════════════════════════════════════════════════════════════ */

function renderContactSelects() {
  const service = qs('[data-service-select]')
  if (service) {
    fill(service, [
      el('option', { value: '', text: 'Select a service' }),
      ...services.map((item) => el('option', { value: item.id, text: item.name })),
      el('option', { value: 'other', text: 'Something else' })
    ])
  }

  const budget = qs('[data-budget-select]')
  if (budget) {
    fill(budget, budgetRanges.map((range) => el('option', { value: range.value, text: range.label })))
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Intro film sources — shell-level, rendered once
   ══════════════════════════════════════════════════════════════════════ */

export function renderIntroSources({ mobile = false } = {}) {
  const video = qs('[data-intro-video]')
  if (!video) return

  const sources = mobile ? siteData.intro.mobile : siteData.intro.desktop
  fill(video, sources.map((source) => el('source', { src: asset(source.src), type: source.type })))
  video.setAttribute('poster', asset(siteData.intro.poster))
}

/**
 * Renders every data-driven container present in the document.
 * Safe to call again after a route swap.
 */
export function renderPage() {
  renderChrome()
  renderServicesGrid()
  renderLogoStrip()
  renderPractice()
  renderStats()
  renderReviews()
  renderReferences()
  renderServicesOverview()
  renderServicesDetail()
  renderProcess()
  renderPropositions()
  renderApproach()
  renderValues()
  renderContactSelects()
}
