/**
 * Tuning surface for the overlays. Overlays exist to manufacture legible space
 * for the title, so these values trade "how much of the photo survives" against
 * "how reliably white text reads on top".
 */

/**
 * Fraction of the top-left -> bottom-right diagonal over which an overlay fades
 * to nothing. 1 = corner to corner. Shorter leaves the right-hand side of the
 * photo completely untouched, which is what the house banners do.
 */
export const RAMP_LENGTH = 0.6;

/** Max blur radius as a fraction of the output's shorter side. */
export const BLUR_FRACTION = 0.05;
/** Floor, so a 256px avatar still frosts visibly. */
export const BLUR_MIN = 6;

/**
 * Levels in the blur pyramid, including the sharp base. Cross-fading between
 * adjacent levels is what avoids the ghosting a single blurred layer produces;
 * more levels = smaller radius steps = less ghosting, at linear cost.
 * Setting this to 1 reduces the effect to that naive single-layer version.
 */
export const BLUR_LEVELS = 5;

/** Blur mutes colour, so lift saturation to keep the frosted area from going flat. */
export const SATURATION = 1.3;

/** Darkening under the blur. Blur removes detail but not luminance — this is
 *  what actually guarantees a white title reads on a bright photo. */
export const SCRIM_ALPHA = 0.45;

/**
 * Long-edge cap for the blur working canvas. The result is blurry by
 * definition, so rendering it smaller and upscaling is visually free and keeps
 * a 20 Mpx freeform crop from costing a second.
 */
export const WORKING_RESOLUTION_CAP = 1400;
