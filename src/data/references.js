/**
 * FKR MEDIA USA — client references.
 *
 * The 15 marks below are the clients FKR chose to show, sliced from the
 * brand wall they provided. Every record is real; there are no placeholder
 * slots left. The remaining artwork from that wall was retired together with
 * its files in public/images/clients/ — see git history to bring one back.
 *
 * ── The artwork ──────────────────────────────────────────────────────────
 * Each file in public/images/clients/ is a WHITE mark on a transparent
 * ground, produced by inverting the supplied black-on-white artwork into the
 * alpha channel. A knocked-out mark (Knorr) therefore stays correct:
 * the enclosing block becomes solid white and the lettering inside becomes
 * transparent, so it reads on the dark ground exactly as intended.
 *
 * That inversion alone was not enough. Many marks on the supplied sheet are
 * drawn in mid-grey rather than black — Park Avenue, Kervan, Garrett — and a straight luminance-to-alpha mapping turned those
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
 * centred, and all of them were scaled by one shared factor. That is what keeps
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
  mark('knorr', 'Knorr', 'knorr', 112),
  mark('radisson-blu', 'Radisson Blu Mount Erciyes', 'radisson-blu-mount-erciyes', 313),
  mark('karaca', 'Karaca', 'karaca', 312),
  mark('burano', 'Burano', 'burano', 312),
  mark('home-sweet-home', 'Home Sweet Home', 'home-sweet-home', 131),
  mark('park-avenue', 'Park Avenue YDA', 'park-avenue-yda', 313),
  mark('luxera', 'Luxera', 'luxera', 272),
  mark('as-robotics', 'AS Robotics', 'as-robotics', 340),
  mark('kervan', 'Kervan', 'kervan', 232),
  mark('cups-and-clouds', 'Cups & Clouds Coffee House', 'cups-and-clouds', 312),
  mark('brooklyn-park', 'Brooklyn Park', 'brooklyn-park', 310),
  mark('garrett', 'Garrett by Honeywell', 'garrett', 312)
]

export default references
