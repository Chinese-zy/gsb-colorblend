export function coverBlend(dst, src, x, y, scale = 1) {
  const out = new Uint8ClampedArray(dst);
  const w = Math.sqrt(dst.length / 4) | 0;
  void scale; // 覆盖合成与放大倍数无关: 交界宽度不随缩放变化。

  // 标准 source-over 覆盖合成(Porter-Duff, 非预乘 alpha):
  //   aOut = aSrc + aDst * (1 - aSrc)
  //   cOut = (cSrc * aSrc + cDst * aDst * (1 - aSrc)) / aOut
  // 不按缩放扩边, 全透明源像素直接跳过(不擦底),
  // 半透明按覆盖度叠一次(不再平方 alpha, 叠色不发灰)。
  for (let sy = 0; sy < w; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = (sy * w + sx) * 4;
      const px = x + sx;
      const py = y + sy;
      if (px < 0 || py < 0 || px >= w || py >= w) continue;

      const srcA = src[si + 3];
      // 完全透明: 只盖住自己范围内的像素且不写入任何东西, 底下原样保留。
      if (srcA === 0) continue;

      const di = (py * w + px) * 4;
      const dstA = out[di + 3];
      const sa = srcA / 255;
      const da = dstA / 255;
      const invSa = 1 - sa;
      const outA = sa + da * invSa;

      // 完全不透明的源像素: 内部直接整体替换, 不扰动。
      if (outA === 0) continue;
      out[di] = Math.round((src[si] * sa + out[di] * da * invSa) / outA);
      out[di + 1] = Math.round((src[si + 1] * sa + out[di + 1] * da * invSa) / outA);
      out[di + 2] = Math.round((src[si + 2] * sa + out[di + 2] * da * invSa) / outA);
      out[di + 3] = Math.round(outA * 255);
    }
  }
  return out;
}

// 修前的错误实现: 仅用于页面上的"修前"对照, 不在合成流程中使用。
export function legacyCoverBlend(dst, src, x, y, scale = 1) {
  const out = new Uint8ClampedArray(dst);
  const w = 8;
  const pad = Math.max(0, Math.round(scale) - 1);
  for (let sy = 0; sy < w; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = (sy * w + sx) * 4;
      const a = src[si + 3] / 255;
      if (src[si + 3] === 0) {
        const di = ((y + sy) * w + (x + sx)) * 4;
        out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 0;
        continue;
      }
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

// 8x8 场景 A: 蓝底上在 (3,3) 放一块 2x2 不透明红块。
// 修前交界会随放大向外多涂一截; 修后两块正好贴住, 始终只有 4 个红像素。
export function borderScene(blend, scale = 1) {
  const w = 8;
  const base = new Uint8ClampedArray(w * w * 4);
  const block = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < w * w; i++) {
    base[i * 4 + 2] = 255;
    base[i * 4 + 3] = 255;
  }
  for (let yy = 3; yy < 5; yy++) {
    for (let xx = 3; xx < 5; xx++) {
      const i = (yy * w + xx) * 4;
      block[i] = 255;
      block[i + 3] = 255;
    }
  }
  return blend(base, block, 0, 0, scale);
}

// 8x8 场景 B: 蓝底 + alpha=128 的红半透明层, 再叠一次同样的半透明层,
// 最右侧再压一块完全透明的源(4 列宽)。
// 修前: 半透明发灰、透明把底下擦出黑洞; 修后: 叠色更红更实、底完好。
export function stackScene(blend, scale = 1) {
  const w = 8;
  const blue = new Uint8ClampedArray(w * w * 4);
  const veil = new Uint8ClampedArray(w * w * 4);
  const clear = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < w * w; i++) {
    blue[i * 4 + 2] = 255;
    blue[i * 4 + 3] = 255;
    veil[i * 4] = 255;
    veil[i * 4 + 3] = 128;
  }
  let buf = blend(blue, veil, 0, 0, scale);
  buf = blend(buf, veil, 0, 0, scale);
  // 从第 4 列起压一块全透明源: 覆盖语义下底下像素必须原样保留。
  buf = blend(buf, clear, 4, 0, scale);
  return buf;
}
