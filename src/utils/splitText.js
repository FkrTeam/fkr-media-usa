/**
 * Line and word splitting.
 *
 * GSAP SplitText is a Club plugin, so this is a small licence-free
 * equivalent: it measures real rendered line boxes (via Range rects) and
 * rebuilds the element as masked lines or inline-block words.
 *
 * Both helpers are idempotent — calling them twice re-splits from the
 * original text, which is what a resize handler needs.
 */

const ORIGINAL = new WeakMap()

function sourceText(node) {
  if (!ORIGINAL.has(node)) ORIGINAL.set(node, node.textContent.trim().replace(/\s+/g, ' '))
  return ORIGINAL.get(node)
}

/**
 * Splits into words wrapped in `<span class="statement__word">`.
 * Returns the word elements in document order.
 */
export function splitWords(node, wordClass = 'statement__word') {
  const text = sourceText(node)
  const frag = document.createDocumentFragment()
  const words = []

  text.split(' ').forEach((word, i, all) => {
    const span = document.createElement('span')
    span.className = wordClass
    span.textContent = word
    frag.append(span)
    if (i < all.length - 1) frag.append(document.createTextNode(' '))
    words.push(span)
  })

  node.replaceChildren(frag)
  return words
}

/**
 * Splits into rendered lines, each wrapped as
 * `<span class="line-mask"><span class="line-inner">…</span></span>`.
 *
 * Words are measured first, then grouped by their vertical position, so the
 * result matches however the browser actually wrapped the text.
 */
export function splitLines(node) {
  const words = splitWords(node, 'split-word')
  if (!words.length) return []

  const lines = []
  let currentTop = null
  let bucket = null

  for (const word of words) {
    const top = Math.round(word.getBoundingClientRect().top)
    if (currentTop === null || Math.abs(top - currentTop) > 2) {
      currentTop = top
      bucket = []
      lines.push(bucket)
    }
    bucket.push(word.textContent)
  }

  const frag = document.createDocumentFragment()
  const inners = []

  for (const line of lines) {
    const mask = document.createElement('span')
    mask.className = 'line-mask'
    const inner = document.createElement('span')
    inner.className = 'line-inner'
    inner.textContent = line.join(' ')
    mask.append(inner)
    frag.append(mask)
    inners.push(inner)
  }

  node.replaceChildren(frag)
  return inners
}

/** Restores an element to its unsplit text — used by the reduced-motion path. */
export function restore(node) {
  if (ORIGINAL.has(node)) node.textContent = ORIGINAL.get(node)
}
