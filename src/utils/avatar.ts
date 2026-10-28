// How an image avatar is drawn. Shared by UserAvatar, the screens that draw
// their own avatar <img>, and the server-rendered pages (src/seo/render.ts), so
// the first HTML and the app draw the same circle.

// Generated listings use the business's logo as their avatar. Logos are square
// and often transparent, so cropping them to fill (object-cover) either clips the
// mark or leaves it invisible against a dark page — they need a white disc
// behind them instead. We can tell them apart by where they're stored.
//
// The inset is a single pixel on purpose. How much white shows around a logo
// depends on the source image — an opaque square fills the disc, a tall or
// transparent mark leaves more visible — so any padding beyond a hairline reads
// as a thick, uneven ring that varies from listing to listing.
export const isBusinessLogo = (url: string) => url.includes('listingLogos');

// On light mode a logo with a white or transparent background has no visible
// edge against the white page (GIG-73), so every image avatar gets a light
// stroke. It is an inset outline rather than a border: it is drawn over the
// image, takes no space, and leaves dark mode exactly as it was. The image
// must be rounded itself for the outline to follow the circle. slate-600 is
// the variable that resolves to slate-300 on light mode.
export const AVATAR_LIGHT_STROKE = 'light:outline light:-outline-offset-1 light:outline-slate-600';

/** Fit, backing and stroke for an avatar <img>; the caller adds size and rounded-full. */
export const avatarImageClasses = (url: string) =>
  isBusinessLogo(url)
    ? `bg-white object-contain p-px ${AVATAR_LIGHT_STROKE}`
    : `object-cover ${AVATAR_LIGHT_STROKE}`;
