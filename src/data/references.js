/**
 * FKR MEDIA USA — client references.
 *
 * The 42 marks below were supplied by FKR as their own client roster, sliced
 * from the brand wall they provided. Every record is real; there are no
 * placeholder slots left.
 *
 * ── The artwork ──────────────────────────────────────────────────────────
 * Each file in public/images/clients/ is a WHITE mark on a transparent
 * ground, produced by inverting the supplied black-on-white artwork into the
 * alpha channel. A knocked-out mark (Knorr, MNG) therefore stays correct:
 * the enclosing block becomes solid white and the lettering inside becomes
 * transparent, so it reads on the dark ground exactly as intended.
 *
 * That inversion alone was not enough. Many marks on the supplied sheet are
 * drawn in mid-grey rather than black — Northgate, Park Avenue, Kervan,
 * Garrett, Elite — and a straight luminance-to-alpha mapping turned those
 * into half-transparent white next to solid neighbours. The export therefore
 * levels the alpha channel as well: ink at or past ~55% goes fully opaque,
 * the run below it keeps its gradient so antialiased edges survive, and a
 * small black point clips the near-white background to nothing so no halo
 * appears. The curve is applied at full 8K resolution, before the downscale,
 * so the resampler still has clean edges to work with.
 *
 * The consequence for the CSS: the marks render at FULL strength — no
 * opacity, no filter. Their weight lives in the files.
 *
 * Every file is padded to the SAME canvas height (132px) with the artwork
 * centred, and all 42 were scaled by one shared factor. That is what keeps
 * the strip optically balanced — a square mark does not tower over a wide
 * wordmark the way it would if each file were trimmed to its own height. It
 * also means the CSS sets ONE height for every image and lets width follow.
 *
 * `w` is the intrinsic pixel width. It is not decoration: the marquee
 * measures its own track with `offsetWidth` the moment it is built, so the
 * images must reserve their real space before they load or the loop is
 * measured short and visibly seams. The renderer stamps width/height onto
 * every <img> for exactly that reason.
 *
 * ── Adding or replacing a client ─────────────────────────────────────────
 *   1. Export the mark as white-on-transparent, 132px tall canvas.
 *   2. Drop it in public/images/clients/.
 *   3. Add a record here with `name`, `logo` and the intrinsic `w`.
 * A record with `logo: null` falls back to a typographic wordmark, so a
 * missing file degrades to the client's name rather than to a gap.
 *
 * `url` is null throughout — deliberately. Linking a client out needs their
 * real address, and guessing one would point visitors at a site that may not
 * be theirs. Fill them in as they are confirmed.
 */

const mark = (id, name, slug, w) => ({
  id,
  name,
  logo: `images/clients/${slug}.webp`,
  w,
  h: 132,
  url: null,
  placeholder: false
})

export const references = [
  mark('coca-cola', 'Coca-Cola', 'coca-cola', 312),
  mark('philips', 'Philips', 'philips', 313),
  mark('hp', 'HP', 'hp', 131),
  mark('subaru', 'Subaru Authorised', 'subaru', 167),
  mark('knorr', 'Knorr', 'knorr', 112),
  mark('radisson-blu', 'Radisson Blu Mount Erciyes', 'radisson-blu-mount-erciyes', 313),
  mark('karaca', 'Karaca', 'karaca', 312),

  mark('mesa', 'Mesa 1969', 'mesa-1969', 312),
  mark('artas', 'Artaş Holding', 'artas-holding', 111),
  mark('ihlas', 'İhlas Holding', 'ihlas-holding', 209),
  mark('gedik', 'Gedik', 'gedik', 166),
  mark('mng', 'MNG', 'mng', 312),
  mark('burano', 'Burano', 'burano', 312),
  mark('home-sweet-home', 'Home Sweet Home', 'home-sweet-home', 131),

  mark('northgate', 'Northgate Ankara', 'northgate-ankara', 213),
  mark('park-avenue', 'Park Avenue YDA', 'park-avenue-yda', 313),
  mark('luxera', 'Luxera', 'luxera', 272),
  mark('as-robotics', 'AS Robotics', 'as-robotics', 340),
  mark('kervan', 'Kervan', 'kervan', 232),
  mark('gloria', 'Gloria Hotels & Resorts', 'gloria-hotels-resorts', 305),
  mark('garrett', 'Garrett by Honeywell', 'garrett', 312),

  mark('world-of-movies', 'World of Movies — Istanbul Film Studio Complex', 'world-of-movies', 310),
  mark('mallexpert', 'Mallexpert', 'mallexpert', 312),
  mark('cups-and-clouds', 'Cups & Clouds Coffee House', 'cups-and-clouds', 312),
  mark('commerce-center', 'Commerce Center Ankara', 'commerce-center-ankara', 244),
  mark('ems', 'EMS Emergency Mobile Systems', 'ems', 312),
  mark('green-park', 'The Green Park Hotels & Resorts', 'the-green-park', 313),
  mark('garment-tech', 'Garment Tech Istanbul', 'garment-tech-istanbul', 312),

  mark('whs', 'WHS World Halal Summit', 'whs', 119),
  mark('turex', 'Turex', 'turex', 310),
  mark('hillport', 'Hillport Family Suites', 'hillport', 169),
  mark('residence-eagle', 'Residence Eagle', 'residence-eagle', 227),
  mark('west-gate', 'West Gate Residence', 'west-gate', 206),
  mark('red-line', 'Red Line', 'red-line', 103),
  mark('brooklyn-park', 'Brooklyn Park', 'brooklyn-park', 310),

  mark('cordella', 'Cordella Tuzla', 'cordella-tuzla', 303),
  mark('ethexpo', 'Ethexpo — Eurasia Tourism & Health Expo', 'ethexpo', 313),
  mark('elite-erenkoy', 'Elite Erenköy', 'elite-erenkoy', 197),
  mark('route-istanbul', 'Route Istanbul', 'route-istanbul', 310),
  mark('isra', 'ISRA Holding', 'isra-holding', 312),
  mark('istanbul-residence', 'The Istanbul Residence', 'the-istanbul-residence', 153),
  mark('orta-asya', 'Orta Asya Investment Holding', 'orta-asya', 312)
]

export default references
