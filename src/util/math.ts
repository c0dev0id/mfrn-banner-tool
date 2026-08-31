/** Shared numeric helpers. Lives outside crop/ and render/ so neither has to
 *  import the other for a primitive. */
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
