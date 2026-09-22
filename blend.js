// Standard source-over compositing (the "over" operator).
// Each src pixel covers exactly its own dst pixel: the border never
// expands outward, and scale only affects display zoom, never the
// painted footprint.
export function coverBlend(dst, src, x, y, scale = 1) {
  const out = new Uint8ClampedArray(dst);
  const w = Math.sqrt(dst.length / 4) | 0;
  for (let sy = 0; sy < w; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = (sy * w + sx) * 4;
      // Fully transparent covers nothing: leave dst untouched.
      if (src[si + 3] === 0) continue;
      const px = x + sx;
      const py = y + sy;
      if (px < 0 || py < 0 || px >= w || py >= w) continue;
      const di = (py * w + px) * 4;
      const a = src[si + 3] / 255;
      const da = out[di + 3] / 255;
      const outA = a + da * (1 - a);
      if (outA > 0) {
        // Add the alpha-weighted colors first, then divide by outA.
        out[di] = (src[si] * a + out[di] * da * (1 - a)) / outA;
        out[di + 1] = (src[si + 1] * a + out[di + 1] * da * (1 - a)) / outA;
        out[di + 2] = (src[si + 2] * a + out[di + 2] * da * (1 - a)) / outA;
      }
      out[di + 3] = outA * 255;
    }
  }
  return out;
}

// 修前版本，仅用于页面演示"交界多涂一截、放大变宽"的效果。
export function coverBlendBuggy(dst, src, x, y, scale = 1) {
  const out = new Uint8ClampedArray(dst);
  const w = Math.sqrt(dst.length / 4) | 0;
  for (let sy = 0; sy < w; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = (sy * w + sx) * 4;
      const a = src[si + 3] / 255;
      if (src[si + 3] === 0) {
        const di = ((y + sy) * w + (x + sx)) * 4;
        out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 0;
        continue;
      }
      const pad = Math.max(0, Math.round(scale) - 1);
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          const px = x + sx + dx;
          const py = y + sy + dy;
          if (px < 0 || py < 0 || px >= w || py >= w) continue;
          const di = (py * w + px) * 4;
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

export function drawDemo(ctx, scale, blend = coverBlend) {
  const w = 8;
  const blue = new Uint8ClampedArray(w * w * 4);
  const red = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < w * w; i++) {
    blue[i * 4 + 2] = 255; blue[i * 4 + 3] = 255;
    red[i * 4] = 255; red[i * 4 + 3] = 128;
  }
  let buf = blue;
  buf = blend(buf, red, 2, 2, scale);
  const img = ctx.createImageData(w, w);
  img.data.set(buf);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = w;
  tmp.getContext("2d").putImageData(img, 0, 0);
  const size = w * 10 * scale;
  const ox = Math.floor((ctx.canvas.width - size) / 2);
  const oy = Math.floor((ctx.canvas.height - size) / 2);
  ctx.drawImage(tmp, 0, 0, w, w, ox, oy, size, size);
}
