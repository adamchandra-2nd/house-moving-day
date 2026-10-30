const ALPHA_FLOOR = 8;

/**
 * The frame the Spline canvas last drew, as pixels.
 *
 * Read through toDataURL(), not drawImage(canvas): drawing the Spline canvas
 * straight onto a 2D one comes back fully transparent in Chromium, while the
 * data URL carries the real frame. The data URL is taken synchronously, at
 * the moment of the call; only decoding waits.
 */
async function readFrame(canvas: HTMLCanvasElement): Promise<{ data: Uint8ClampedArray; w: number; h: number; image: HTMLImageElement } | null> {
  const { width: w, height: h } = canvas;
  if (!w || !h) return null;
  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, image };
}

/**
 * The rows the character occupies: the first tall opaque band, a quarter of
 * the frame or more.
 *
 * Not simply "every opaque pixel": the runtime can draw more than the
 * character, namely the "Built with Spline" badge of an export that keeps it,
 * below the feet. Taking all of it grounded the badge instead of the feet and
 * would have cropped the badge into the guest's portrait. The height test
 * matters too: the badge is drawn before the character has loaded, and on
 * those first frames it is the only band there is.
 */
function characterBand(data: Uint8ClampedArray, w: number, h: number): { top: number; bottom: number } | null {
  const opaque = (y: number) => {
    for (let i = y * w * 4 + 3, end = (y + 1) * w * 4; i < end; i += 4) if (data[i] > ALPHA_FLOOR) return true;
    return false;
  };
  for (let y = 0; y < h; ) {
    while (y < h && !opaque(y)) y++;
    const top = y;
    while (y < h && opaque(y)) y++;
    if (y > top && y - top >= h / 4) return { top, bottom: y - 1 };
  }
  return null;
}

/**
 * The rows the character is drawn on -- the top of its horns and its feet --
 * or null when the frame is empty or unreadable.
 */
export async function characterRows(canvas: HTMLCanvasElement): Promise<{ top: number; bottom: number } | null> {
  try {
    const frame = await readFrame(canvas);
    return frame ? characterBand(frame.data, frame.w, frame.h) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the last rendered frame off the Spline canvas, cropped to the character.
 *
 * The 3D framing leaves transparent space around the character while the 2D art
 * is cropped tight, so an uncropped capture would render small and off-centre
 * wherever the sprite is used. Cropping to the character's bounding box makes
 * it a drop-in replacement.
 *
 * The frame is taken at the moment of the call -- the caller navigates
 * straight after, which moves the canvas -- and only cropped afterwards.
 * Before readFrame() this used drawImage(canvas), which read back an empty
 * frame every time, so every guest got the bundled art instead of the
 * character they had just made.
 *
 * Resolves to null — and the caller keeps the 2D character — when the buffer
 * is empty or the canvas is tainted by a cross-origin texture.
 */
export async function capture(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const frame = await readFrame(canvas);
    if (!frame) return null;
    const { data, w, h, image } = frame;
    const band = characterBand(data, w, h);
    if (!band) return null; // nothing was drawn

    let minX = w;
    let maxX = -1;
    for (let y = band.top; y <= band.bottom; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= ALPHA_FLOOR) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }

    const pad = Math.round(Math.min(w, h) * 0.02);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, band.top - pad);
    const cw = Math.min(w, maxX + pad) - sx + 1;
    // Not past the band: under the feet is where the badge would be.
    const ch = Math.min(h - 1, band.bottom + pad) - sy + 1;

    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    const outCtx = out.getContext("2d");
    if (!outCtx) return null;
    outCtx.drawImage(image, sx, sy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/webp", 0.9);
  } catch {
    return null; // tainted canvas or no 2D context
  }
}
