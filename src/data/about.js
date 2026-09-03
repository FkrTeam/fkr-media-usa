/**
 * FKR MEDIA USA — about content.
 *
 * ⚠ PLACEHOLDER COPY. This describes a plausible agency posture; it is not
 * verified FKR positioning, history or team information. No founding date,
 * headcount, office list or staff name is asserted anywhere in this file —
 * those claims are deliberately absent rather than invented.
 */

/** Homepage About block — deliberately short; the page carries the depth. */
export const aboutIntro = {
  eyebrow: 'Independent creative & digital media agency',
  headline: ['We turn attention', 'into business', 'growth.'],
  accentWord: 'growth.',
  body: 'FKR Media USA connects strategy, creative and engineering into a single practice. One team, one standard, one continuous line from the first insight to the launch — and to everything that has to keep working afterwards.',
  cta: { label: 'About FKR', href: '/about' },
  placeholder: true
}

/** /about — the manifesto. */
export const manifesto = {
  lines: ['Most work is', 'forgotten because', 'it was designed', 'to be finished.'],
  body: [
    'Not to be felt, not to be argued with, not to be remembered a week later. It cleared an approval and it stopped there.',
    'We start at the other end. What should this make someone feel, decide or do — and what has to be true, technically and strategically, for that to survive contact with the real world?'
  ],
  placeholder: true
}

/** /about — how the practice works. */
export const approach = [
  {
    num: '01',
    title: 'Strategy first, always',
    body: 'No creative brief is written before the argument is settled: what the brand claims, to whom, and why that claim holds against the alternatives.',
    placeholder: true
  },
  {
    num: '02',
    title: 'Design in the browser',
    body: 'Interfaces are prototyped where they will actually live. A static mockup cannot tell you how something feels at sixty frames a second.',
    placeholder: true
  },
  {
    num: '03',
    title: 'Engineering is not a phase',
    body: 'Developers are in the room from the first week. It is the only reliable way to know that an idea is buildable before it is sold.',
    placeholder: true
  },
  {
    num: '04',
    title: 'Measured, then improved',
    body: 'Every engagement agrees its numbers up front. Launch is the beginning of the measurement, not the end of the project.',
    placeholder: true
  }
]

/** /about — principles. */
export const values = [
  {
    word: 'Clarity',
    body: 'If the idea needs a paragraph of explanation before it lands, it is not finished.',
    placeholder: true
  },
  {
    word: 'Craft',
    body: 'The details nobody is asked to notice are exactly the ones that decide whether the whole thing reads as considered.',
    placeholder: true
  },
  {
    word: 'Candour',
    body: 'We would rather lose an argument early than deliver work we know will underperform.',
    placeholder: true
  },
  {
    word: 'Continuity',
    body: 'What we hand over has to keep running without us. Systems, documented, not one-off deliverables.',
    placeholder: true
  }
]

export default { aboutIntro, manifesto, approach, values }
