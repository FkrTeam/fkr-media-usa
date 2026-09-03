/**
 * FKR MEDIA USA — global site configuration.
 *
 * Site-wide chrome only: brand, navigation, socials, contact details and the
 * intro film. Page content lives in its sibling data files:
 *
 *   services.js    service catalogue, process, propositions
 *   reviews.js     client reviews  (all placeholder slots)
 *   stats.js       company metrics (all placeholder values)
 *   references.js  client wall     (all empty slots)
 *   about.js       about copy      (placeholder)
 *
 * Prose that matters for SEO lives in the page HTML under `src/pages/`, so
 * it is crawlable and survives with JavaScript off.
 */

export const siteData = {
  brand: {
    name: 'FKR Media USA',
    short: 'FKR',
    tagline: 'Creative technology & digital media'
  },

  nav: [
    { label: 'Home', href: '/' },
    { label: 'Services', href: '/services' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
  ],

  cta: { label: 'Start a project', href: '/contact' },

  /* --- Contact ----------------------------------------------------------
     THE single source for the address and email. scripts/pages.mjs reads
     this file at build time and substitutes the values into the page markup,
     so the details stay crawlable prose while existing in exactly one place.
     Never hardcode any of them in HTML again.

     There is deliberately NO phone number and NO reply-time promise here.
     Both were placeholders and FKR asked for them off the site entirely; a
     stated turnaround is a commitment to visitors, so it should only come
     back as a real one. Adding `phone` back means restoring the {{phone}} /
     {{phoneHref}} tokens in scripts/pages.mjs and the "telephone" property
     in the JSON-LD block of src/pages/_shell.html. */
  contact: {
    email: 'hello@fkrmediausa.com',

    address: {
      street: '3131 NE 7th Ave',
      city: 'Miami',
      region: 'FL',
      postalCode: '33137',
      country: 'United States',
      countryCode: 'US'
    },

    availability: 'Taking on projects for Q1 2027'   // PLACEHOLDER
  },

  /* The three real FKR accounts, supplied by FKR. This array is the ONLY
     list of them: the footer, the contact page and the JSON-LD `sameAs`
     property all read it, so adding or removing an account here changes it
     everywhere at once. */
  socials: [
    { label: 'Instagram', url: 'https://www.instagram.com/fkrmediausa/' },
    { label: 'Facebook', url: 'https://www.facebook.com/fkrmediausa/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/company/fkr-media-usa/' }
  ],

  /**
   * Sources for the WebGL media plane.
   *
   * NOTHING READS THIS RIGHT NOW, and no route carries a `[data-media-stage]`
   * anchor, so the plane stays dormant — `initMediaPlane` sees no stage and
   * calls `setMediaStage(null)`, which holds it at zero opacity for free.
   *
   * The home page used to anchor it against `about` below, but the only
   * artwork available was a generated vector stand-in: a decorative rectangle
   * illustrating nothing, in the middle of a paragraph making a specific
   * claim. That slot now holds the practice ladder instead.
   *
   * The plumbing is deliberately left intact. Put real renders or photography
   * at these paths, add `data-media-stage data-media-src="..."` to an element,
   * and the plane picks it up again with no other change.
   */
  media: {
    about: 'images/work/project-03.svg',
    services: 'images/work/project-02.svg',
    placeholder: true
  },

  /* --- Intro film -------------------------------------------------------
     Sources are tried in order; the first that plays wins. If none load,
     the experience falls through to a generated title sequence. */
  intro: {
    desktop: [
      { src: 'media/intro-desktop.webm', type: 'video/webm' },
      { src: 'media/intro-desktop.mp4', type: 'video/mp4' }
    ],
    mobile: [
      { src: 'media/intro-mobile.webm', type: 'video/webm' },
      { src: 'media/intro-mobile.mp4', type: 'video/mp4' }
    ],
    poster: 'media/intro-poster.jpg',
    // Length of the encoded film, and only a fallback: the intro reads
    // video.duration as soon as metadata arrives and prefers that. It exists
    // so the timecode and the progress bar have something sane to show in
    // the moments before the browser has parsed the file.
    duration: 42,
    fallbackLines: ['Strategy', 'Creativity', 'Technology', 'FKR Media USA']
  }
}

const { address } = siteData.contact

/** `3131 NE 7th Ave, Miami, FL 33137` */
export const addressLine = `${address.street}, ${address.city}, ${address.region} ${address.postalCode}`

/** `Miami, FL · United States` — the short form used in chrome. */
export const addressShort = `${address.city}, ${address.region} · ${address.country}`

export default siteData
