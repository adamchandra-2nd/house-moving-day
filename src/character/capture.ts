const ALPHA_FLOOR = 8;

/**
 * The lowest row of the canvas the character is drawn on, or null when the
 * frame is empty or unreadable.
 *
 * Read through toDataURL(), not drawImage(canvas): drawing the Spline canvas
 * straight onto a 2D one comes back fully transparent in Chromium, while the
 * data URL carries the real frame. Scanned from the bottom up and stopped at
 * the first opaque row, so it costs a few rows rather than the whole frame.
 */
export async function lowestOpaqueRow(canvas: HTMLCanvasElement): Promise<number | null> {
  try {
    const { width: w, height: h } = canvas;
    if (!w || !h) return null;
    const frame = new Image();
    frame.src = canvas.toDataURL();
    await frame.decode();
    const scratch = document.createElement("canvas");
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(frame, 0, 0);
    for (let y = h - 1; y >= 0; y--) {
      const { data } = ctx.getImageData(0, y, w, 1);
      for (let i = 3; i < data.length; i += 4) if (data[i] > ALPHA_FLOOR) return y;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads the last rendered frame off the Spline canvas, cropped to the character.
 *
 * The 3D framing leaves transparent space around the character while the 2D art
 * is cropped tight, so an uncropped capture would render small and off-centre
 * wherever the sprite is used. Cropping to the visible bounding box makes it a
 * drop-in replacement.
 *
 * The frame is taken synchronously, through toDataURL(), at the moment of the
 * call -- the caller navigates straight after, which moves the canvas -- and
 * only decoded and cropped afterwards. Not drawImage(canvas): see
 * lowestOpaqueRow, it read back an empty frame every time, so every guest got
 * the bundled art instead of the character they had just made.
 *
 * Resolves to null — and the caller keeps the 2D character — when the buffer
 * is empty or the canvas is tainted by a cross-origin texture.
 */
export async function capture(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const { width: w, height: h } = canvas;
    if (!w || !h) return null;
    const frame = new Image();
    frame.src = canvas.toDataURL();
    await frame.decode();

    const full = document.createElement("canvas");
    full.width = w;
    full.height = h;
    const ctx = full.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(frame, 0, 0);

    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= ALPHA_FLOOR) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null; // nothing was drawn

    const pad = Math.round(Math.min(w, h) * 0.02);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const cw = Math.min(w, maxX + pad) - sx + 1;
    const ch = Math.min(h, maxY + pad) - sy + 1;

    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    const outCtx = out.getContext("2d");
    if (!outCtx) return null;
    outCtx.drawImage(full, sx, sy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/webp", 0.9);
  } catch {
    return null; // tainted canvas or no 2D context
  }
}
