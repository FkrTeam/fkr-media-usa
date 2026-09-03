import App from './core/App.js'

/**
 * FKR Media USA — entry point.
 *
 * Boots the experience and, if anything in that chain throws, unlocks the
 * page so a visitor is never left staring at a preloader.
 */
const app = new App()

app.boot().catch((error) => {
  console.error('[fkr] boot failed', error)

  document.querySelector('[data-preloader]')?.remove()
  document.querySelector('[data-intro]')?.setAttribute('hidden', '')
  document.body.classList.remove('is-locked')

  const site = document.querySelector('[data-site]')
  if (site) site.style.opacity = '1'

  const nav = document.querySelector('[data-nav]')
  if (nav) nav.style.transform = 'translateY(0)'

  document.documentElement.classList.remove('js')
})

// Exposed for debugging in the console; harmless in production.
window.__fkr = app
