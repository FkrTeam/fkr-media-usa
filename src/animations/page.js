import gsap from 'gsap'
import { qs, qsa } from '../utils/dom.js'
import { renderPage } from '../components/render.js'
import { prepareSplits } from './transitions.js'
import { initScroll, killPageTriggers } from './scroll.js'
import { initMagnetic } from '../components/magnetic.js'
import Marquee from '../components/marquee.js'
import ContactForm from '../components/contactForm.js'

/**
 * Per-route lifecycle.
 *
 * `mountPage` wires whatever the current document contains; `unmountPage`
 * takes it all down again before the router replaces `<main>`. Everything
 * page-scoped lives here so a route change cannot leave a ScrollTrigger, a
 * tween or a listener pointing at a detached node.
 *
 * The shell — renderer, render loop, cursor, navigation, menu, footer — is
 * outside this file and is never rebuilt.
 */

let instances = []
let disposeMagnetic = null

export function mountPage({ experience, reducedMotion = false } = {}) {
  // 1 · Data → DOM for whichever containers this route declares.
  renderPage()

  // 2 · Split the type before anything measures it.
  const splits = prepareSplits(reducedMotion)

  // 3 · Scroll behaviour, WebGL moods and the media plane.
  initScroll({ experience, splits })

  // 4 · Page-scoped components. Each is a no-op when its markup is absent.
  // The reviews section used to be a rail with its own slider class; it is
  // now three cards side by side, which is plain markup and needs no JS.
  instances = [new Marquee(), new ContactForm()]
    .filter((instance) => instance && instance.destroy)

  disposeMagnetic = initMagnetic('[data-magnetic]')

  return splits
}

export function unmountPage({ experience } = {}) {
  killPageTriggers()

  for (const instance of instances) instance.destroy()
  instances = []

  disposeMagnetic?.()
  disposeMagnetic = null

  // Kill tweens still pointing at nodes that are about to be discarded.
  const main = qs('#main')
  if (main) {
    gsap.killTweensOf(qsa('*', main))
    gsap.killTweensOf(main)
  }

  // Anything still downloading for the page we are leaving is no longer
  // wanted, and should not report itself as a failure.
  experience?.resources.abandonPending()

  // The next route decides whether it wants the media plane at all.
  experience?.setMediaStage(null)
  if (experience) {
    experience.ambient = 0
    experience.accent = 0
  }
}
