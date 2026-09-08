/**
 * Google Analytics — the one thing the tag cannot do for itself here.
 *
 * The gtag snippet in src/pages/_shell.html sends a page_view for the
 * document the browser actually loaded, and that is the only one it will
 * ever send. Every route change after that is a client-side swap:
 * core/Router.js fetches the next document, replaces `#main`, rewrites the
 * head and calls history.pushState. No document load, so no page_view, and
 * a visitor who lands on the home page and reads all four routes counts as
 * one page view of one page.
 *
 * So the router reports them. The initial view stays automatic — sending it
 * here as well would double-count every session's first page.
 *
 * Everything is guarded on `gtag` existing. It is absent whenever the
 * snippet did not run: a blocker, a network the tag cannot reach, or a
 * local build served without it. That is not an error and must never break
 * a navigation, so this file has no behaviour of its own beyond reporting.
 */

/**
 * Reports the route the visitor has just arrived at.
 *
 * Call it AFTER the head has been rewritten and history.pushState has run,
 * or the title and URL sent are the ones the visitor just left.
 */
export function reportPageView() {
  if (typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_location: location.href,
    page_path: location.pathname + location.search + location.hash
  })
}
