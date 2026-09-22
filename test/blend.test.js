import test from "node:test";
import assert from "node:assert/strict";
import { coverBlend, legacyCoverBlend, borderScene, stackScene } from "../blend.js";

function solid(w, r, g, b, a) {
  const out = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < w * w; i++) {
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return out;
}

test("opaque interior unchanged and transparent does not erase", () => {
  const w = 4;
  const base = solid(w, 0, 0, 255, 255);
  const top = solid(w, 255, 0, 0, 0); // fully transparent
  const out = coverBlend(base, top, 0, 0, 1);
  assert.equal(out[2], 255);
  assert.equal(out[3], 255);
});

test("fully opaque source replaces interior exactly", () => {
  const w = 4;
  const base = solid(w, 0, 0, 255, 255);
  const top = solid(w, 255, 0, 0, 255);
  const out = coverBlend(base, top, 0, 0, 1);
  for (let i = 0; i < w * w; i++) {
    assert.deepEqual(
      [out[i * 4], out[i * 4 + 1], out[i * 4 + 2], out[i * 4 + 3]],
      [255, 0, 0, 255],
    );
  }
});

test("transparent source keeps every channel, at every scale", () => {
  const w = 8;
  const base = solid(w, 7, 77, 177, 255);
  for (const scale of [1, 2, 3, 4]) {
    const clear = new Uint8ClampedArray(w * w * 4); // alpha 0
    const out = coverBlend(base, clear, 0, 0, scale);
    for (let i = 0; i < out.length; i++) assert.equal(out[i], base[i]);
  }
});

test("two translucent layers stack by coverage, not alpha squared (no grey)", () => {
  const w = 1;
  const blue = solid(w, 0, 0, 255, 255);
  const veil = solid(w, 255, 0, 0, 128);
  let out = coverBlend(blue, veil, 0, 0, 1);
  out = coverBlend(out, veil, 0, 0, 1);
  // 盖在不透明底上 alpha 保持 255; 每叠一次红色覆盖度都正确增长:
  // 一次: R=128,B=127; 两次: R=192,B=63。
  assert.equal(out[3], 255);
  assert.equal(out[0], 192);
  assert.equal(out[2], 63);
  // the buggy alpha-squared math instead drifts muddy grey:
  let bad = legacyCoverBlend(blue, veil, 0, 0, 1);
  bad = legacyCoverBlend(bad, veil, 0, 0, 1);
  assert.ok(bad[0] < out[0] - 20);
  assert.ok(bad[2] > out[2] + 20);
});

test("coverage order matters: A over B differs from B over A", () => {
  const w = 1;
  const blue = solid(w, 0, 0, 255, 255);
  const veil = solid(w, 255, 0, 0, 128);
  const redFirst = coverBlend(veil, blue, 0, 0, 1); // 不透明蓝盖半透明红 => 纯蓝
  const redOverBlue = coverBlend(blue, veil, 0, 0, 1);
  assert.deepEqual([redFirst[0], redFirst[2], redFirst[3]], [0, 255, 255]);
  assert.deepEqual([redOverBlue[0], redOverBlue[2], redOverBlue[3]], [128, 127, 255]);
});

test("fringe width must not grow with scale", () => {
  const w = 8;
  const base = solid(w, 0, 0, 255, 255);
  // paint a 2x2 block at (3,3)
  const src = new Uint8ClampedArray(w * w * 4);
  for (let y = 3; y < 5; y++) for (let x = 3; x < 5; x++) {
    const i = (y * w + x) * 4; src[i] = 255; src[i + 3] = 255;
  }
  const a = coverBlend(base, src, 0, 0, 1);
  const b = coverBlend(base, src, 0, 0, 3);
  const count = (buf) => {
    let n = 0;
    for (let i = 0; i < buf.length; i += 4) if (buf[i] > 200 && buf[i + 2] < 50) n++;
    return n;
  };
  assert.equal(count(a), count(b));
});

test("block stays exactly 2x2 and touches neighbors without expanding", () => {
  for (const scale of [1, 2, 3, 4]) {
    const buf = borderScene(coverBlend, scale);
    let red = 0;
    for (let yy = 0; yy < 8; yy++) {
      for (let xx = 0; xx < 8; xx++) {
        const i = (yy * 8 + xx) * 4;
        const isRed = buf[i] === 255 && buf[i + 2] === 0 && buf[i + 3] === 255;
        const inside = xx >= 3 && xx <= 4 && yy >= 3 && yy <= 4;
        assert.equal(isRed, inside, `scale ${scale} pixel (${xx},${yy})`);
        if (isRed) red++;
      }
    }
    assert.equal(red, 4);
  }
});

test("legacy scene shows the expanding fringe (demo guard)", () => {
  const s1 = borderScene(legacyCoverBlend, 1);
  const s3 = borderScene(legacyCoverBlend, 3);
  const count = (buf) => {
    let n = 0;
    for (let i = 0; i < buf.length; i += 4) if (buf[i] > 200 && buf[i + 2] < 50) n++;
    return n;
  };
  assert.equal(count(s1), 4);
  assert.ok(count(s3) > 4, "buggy fringe must be visible at scale 3");
});

test("legacy transparent source erases, fixed one does not", () => {
  const good = stackScene(coverBlend, 1);
  const bad = stackScene(legacyCoverBlend, 1);
  // 全透明源压在右半区 (列 4..7): 修复后右半区保持叠色结果, 旧实现擦成黑洞。
  const probe = (0 * 8 + 6) * 4;
  assert.equal(good[probe + 3], 255);
  assert.equal(bad[probe + 3], 0);
});
