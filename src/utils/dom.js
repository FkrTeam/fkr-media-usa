/** Small DOM helpers — keeps the rest of the codebase free of boilerplate. */

export const qs = (selector, scope = document) => scope.querySelector(selector)
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector))

/** Creates an element with attributes and children in one call. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'class') node.className = value
    else if (key === 'text') node.textContent = value
    else if (key === 'html') node.innerHTML = value
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value)
    } else node.setAttribute(key, value === true ? '' : value)
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue
    node.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }

  return node
}

/** Replaces a container's children in a single reflow. */
export function fill(container, nodes) {
  if (!container) return
  const frag = document.createDocumentFragment()
  for (const node of [].concat(nodes)) if (node) frag.append(node)
  container.replaceChildren(frag)
}

/**
 * The deploy base, stamped onto <html data-base> by scripts/pages.mjs.
 * Everything the app builds at runtime is resolved against this rather than
 * against `document.baseURI`, which changes with the current route's depth
 * and would silently break assets on a sub-directory deploy.
 */
export const base = () => document.documentElement.dataset.base || '/'

/**
 * The build id, stamped onto <html data-build> by scripts/pages.mjs. It is a
 * hash of everything in public/, so it changes exactly when one of those
 * files changes and not otherwise.
 */
export const build = () => document.documentElement.dataset.build || ''

/**
 * Resolves a public asset path, honouring the deploy base, and versions it.
 *
 * The version query is why this is a function rather than a string concat.
 * Vite content-hashes every file IT emits, so the bundle can never go stale
 * — but files copied verbatim out of public/ keep their path forever, and a
 * replaced client logo would otherwise stay masked by whatever the visitor's
 * browser cached months ago. Appending ?v=<id> gives those files a URL that
 * changes with their contents, which is what lets a server cache them hard
 * AND still serve the new one the moment it is deployed.
 *
 * A `v` query already on the path is respected and left alone.
 */
export function asset(path) {
  const url = new URL(String(path).replace(/^\/+/, ''), location.origin + base())
  const id = build()
  if (id && !url.searchParams.has('v')) url.searchParams.set('v', id)
  return url.href
}

/** Builds an internal route URL, honouring the deploy base. */
export function route(path = '/') {
  const [clean, hash = ''] = String(path).replace(/^\/+/, '').split('#')
  const trimmed = clean.replace(/\/+$/, '')
  return `${base()}${trimmed ? `${trimmed}/` : ''}${hash ? `#${hash}` : ''}`
}
