import sceneUrl from "../assets/characters/pota.splinecode?url";

/**
 * Everything specific to the published Spline scene lives here, so tuning it
 * never means touching CharacterStage.
 */
export const SCENE = {
  /**
   * Self-hosted rather than loaded from prod.spline.design.
   *
   * Same-origin matters here: a cross-origin texture taints the WebGL canvas,
   * and a tainted canvas makes toDataURL() throw — which would silently kill
   * the sprite capture. Serving it ourselves also puts the file under this
   * app's own cache rules instead of Spline's CDN.
   *
   * To update it: re-export from Spline and replace
   * src/assets/characters/pota.splinecode. That is the only step for the
   * wardrobe too: it is not configured anywhere, CharacterStage looks for the
   * node names from src/data/outfits.ts on load and starts dressing the
   * character as soon as an export carries them.
   */
  url: sceneUrl,

  /**
   * The scene paints its own background, which covers the room illustration
   * behind the character with a grey box. "transparent" turns it off.
   */
  background: "transparent",

  /**
   * Scene furniture to force-hide, matched as a *prefix* so one entry covers a
   * whole group along with its parts. Empty: this scene has nothing to hide.
   */
  hide: [] as string[],

  /**
   * Objects to force *visible* after load.
   *
   * The runtime applies the scene's base state, which is not necessarily the
   * state shown in the Spline editor — so a pose can differ between the two
   * (e.g. the mouth). Listing the objects of the pose you want pins it.
   *
   * Find the right combination live with `splineSet("Pota Mouth", true)` in
   * the console, then record it here. Applied after `hide`.
   */
  show: [] as string[],

  /**
   * Camera zoom once loaded. null keeps the scene's own framing, which is what
   * `Pota Camera` is for.
   */
  zoom: null as number | null,
};
