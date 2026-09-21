export function coverBlend(dst, src, x, y, scale = 1) {
  // BUG: paint order reversed vs coverage stack order.
  const out = new Uint8ClampedArray(dst);
  const w = Math.sqrt(dst.length / 4) | 0;
  for (let sy = 0; sy < w; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = (sy * w + sx) * 4;
      const a = src[si + 3] / 255;
      // BUG: fully transparent still clears underneath.
      if (src[si + 3] === 0) {
        const di = ((y + sy) * w + (x + sx)) * 4;
        out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 0;
        continue;
      }
      // BUG: border expands with scale (extra painted fringe grows).
      const pad = Math.max(0, Math.round(scale) - 1);
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          const px = x + sx + dx;
          const py = y + sy + dy;
          if (px < 0 || py < 0 || px >= w || py >= w) continue;
          const di = (py * w + px) * 4;
          // BUG: multiply alpha again -> grey when stacking translucents.
          const aa = a * a;
          out[di] = src[si] * aa + out[di] * (1 - aa);
          out[di + 1] = src[si + 1] * aa + out[di + 1] * (1 - aa);
          out[di + 2] = src[si + 2] * aa + out[di + 2] * (1 - aa);
          out[di + 3] = Math.min(255, out[di + 3] + src[si + 3] * aa);
        }
      }
    }
  }
  return out;
}

export function drawDemo(ctx, scale) {
  const w = 8;
  const blue = new Uint8ClampedArray(w * w * 4);
  const red = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < w * w; i++) {
    blue[i * 4 + 2] = 255; blue[i * 4 + 3] = 255;
    red[i * 4] = 255; red[i * 4 + 3] = 128;
  }
  let buf = blue;
  buf = coverBlend(buf, red, 2, 2, scale);
  const img = ctx.createImageData(w, w);
  img.data.set(buf);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(ctx.canvas, 0, 0, w, w, 0, 0, w * 10 * scale, w * 10 * scale);
}
