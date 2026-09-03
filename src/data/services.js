/**
 * FKR MEDIA USA — service catalogue.
 *
 * One source for the homepage overview and the /services detail page. The
 * homepage renders `num`, `name`, `summary` and `capabilities`; the services
 * page additionally renders `detail` and `deliverables`.
 *
 * ⚠ PLACEHOLDER CONTENT — these six categories and their copy are a
 * reasonable starting structure, not verified FKR service definitions.
 * Confirm the offer with the company before launch and edit here only.
 */

export const services = [
  {
    id: 'digital-advertising',
    num: '01',
    name: 'Digital Advertising',
    summary: 'Paid media architecture built around what actually converts, not what reports well.',
    detail:
      'Media planning, channel mix and campaign architecture, run against a single measurement model so every channel is judged on the same evidence. Creative is tested as a variable, not decorated after the fact.',
    capabilities: ['Google Ads', 'Meta Advertising', 'Paid Social', 'Programmatic', 'Campaign Strategy'],
    deliverables: ['Media plan & channel mix', 'Campaign build & launch', 'Creative testing framework', 'Conversion tracking setup', 'Performance reporting'],
    placeholder: true
  },
  {
    id: 'social-media',
    num: '02',
    name: 'Social Media',
    summary: 'Channel strategy and always-on creative that compounds instead of resetting every quarter.',
    detail:
      'A publishing system rather than a content calendar: positioning per channel, a repeatable production rhythm, and community management that treats replies as part of the brand voice.',
    capabilities: ['Social Media Strategy', 'Content Planning', 'Community Management', 'Paid Social', 'Reporting'],
    deliverables: ['Channel strategy', 'Content system & calendar', 'Production rhythm', 'Community guidelines', 'Monthly reporting'],
    placeholder: true
  },
  {
    id: 'seo',
    num: '03',
    name: 'SEO & Organic Growth',
    summary: 'Technical foundations and editorial programmes that capture demand already looking for you.',
    detail:
      'Crawl, index and Core Web Vitals work first, because content cannot outrun a broken foundation. Then topic architecture, internal linking and an editorial programme mapped to real search behaviour.',
    capabilities: ['SEO Strategy', 'Technical SEO', 'Local SEO', 'Content SEO', 'Search Performance'],
    deliverables: ['Technical audit & fixes', 'Topic & keyword architecture', 'Editorial programme', 'Local search setup', 'Search performance dashboard'],
    placeholder: true
  },
  {
    id: 'web',
    num: '04',
    name: 'Web Design & Development',
    summary: 'Editorial sites, WebGL experiences and production front-end engineering.',
    detail:
      'Design and engineering as one practice. Interfaces are prototyped in the browser, built on a real design system, and measured on how they perform under load — not on how they look in a static mockup.',
    capabilities: ['UI/UX Design', 'Corporate Websites', 'Landing Pages', 'Web Development', 'Conversion Optimisation'],
    deliverables: ['UX architecture', 'Design system', 'Front-end build', 'CMS integration', 'Performance & CRO pass'],
    placeholder: true
  },
  {
    id: 'branding',
    num: '05',
    name: 'Branding & Creative',
    summary: 'Positioning, identity systems and the design language that has to carry them for years.',
    detail:
      'The argument comes before the artwork: what the brand claims, to whom, and why it holds. Then a system — type, colour, image, motion, voice — documented well enough that other people can run it.',
    capabilities: ['Brand Strategy', 'Visual Identity', 'Campaign Creative', 'Graphic Design', 'Creative Direction'],
    deliverables: ['Positioning & messaging', 'Visual identity system', 'Brand guidelines', 'Campaign platform', 'Asset library'],
    placeholder: true
  },
  {
    id: 'content',
    num: '06',
    name: 'Content & Video',
    summary: 'Brand films, motion design and modular content built for every surface at once.',
    detail:
      'Production planned around distribution: one shoot, one grade, and a matrix of cuts that already fit the channels they were commissioned for. Treatment through to final delivery.',
    capabilities: ['Video Production', 'Motion Design', 'Photography', 'Social Content', 'Commercial Production'],
    deliverables: ['Treatment & storyboard', 'Production & direction', 'Edit, grade & sound', 'Motion design', 'Channel-ready cut matrix'],
    placeholder: true
  }
]

/**
 * /services — how the work runs. PLACEHOLDER: confirm the real engagement
 * model before launch.
 */
export const process = [
  {
    num: '01',
    name: 'Diagnose',
    body: 'We audit what exists — media, analytics, search, brand, site — and establish the baseline everything will later be measured against.',
    placeholder: true
  },
  {
    num: '02',
    name: 'Define',
    body: 'Positioning, audience and the measurement model. One document that the creative, the media plan and the build all answer to.',
    placeholder: true
  },
  {
    num: '03',
    name: 'Build',
    body: 'Design, engineering and production run in parallel against that definition, reviewed in the browser rather than in slides.',
    placeholder: true
  },
  {
    num: '04',
    name: 'Compound',
    body: 'Launch is the start of the measurement. What worked is scaled, what did not is cut, and the system gets better every cycle.',
    placeholder: true
  }
]

/**
 * /services — value proposition. PLACEHOLDER copy.
 */
export const propositions = [
  {
    title: 'One team, one standard',
    body: 'Strategy, design, engineering and film sit in the same practice. Nothing is handed across an agency boundary and quietly downgraded.',
    placeholder: true
  },
  {
    title: 'Built to be measured',
    body: 'Every engagement starts by agreeing what success looks like numerically, so the work can be judged on evidence rather than taste.',
    placeholder: true
  },
  {
    title: 'Systems, not deliverables',
    body: 'You get something your team can keep running — documented, repeatable, and designed to survive long after the launch film ends.',
    placeholder: true
  }
]

export default services
