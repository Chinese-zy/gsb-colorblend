import test from "node:test";
import assert from "node:assert/strict";
import { coverBlend } from "../blend.js";

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

test("opaque top covers exactly, interior untouched underneath", () => {
  const w = 4;
  const base = solid(w, 0, 0, 255, 255);
  const top = solid(w, 255, 0, 0, 255);
  const out = coverBlend(base, top, 0, 0, 1);
  assert.deepEqual([...out.slice(0, 4)], [255, 0, 0, 255]);
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
  // exactly the 2x2 footprint, no outward expansion at any scale
  assert.equal(count(a), 4);
  assert.deepEqual(b, a);
  // pixels just outside the border stay pure blue
  const outside = (3 * w + 2) * 4;
  assert.deepEqual([...a.slice(outside, outside + 4)], [0, 0, 255, 255]);
});

test("stacking translucents moves toward the top color, not grey", () => {
  const w = 4;
  const base = solid(w, 0, 0, 255, 255);
  const top = solid(w, 255, 0, 0, 128);
  const once = coverBlend(base, top, 0, 0, 1);
  assert.deepEqual([...once.slice(0, 4)], [128, 0, 127, 255]);
  const twice = coverBlend(once, top, 0, 0, 1);
  assert.deepEqual([...twice.slice(0, 4)], [192, 0, 63, 255]);
});

test("source-over composites by coverage: add first, then divide", () => {
  const w = 4;
  const base = solid(w, 0, 0, 255, 128);
  const top = solid(w, 255, 0, 0, 128);
  const out = coverBlend(base, top, 0, 0, 1);
  // outA = 128/255 + 128/255 * 127/255 -> 192
  // R = 128 / outA -> 170, B = (255 * 128/255 * 127/255) / outA -> 85
  assert.deepEqual([...out.slice(0, 4)], [170, 0, 85, 192]);
});

test("scale never changes the painted result", () => {
  const w = 8;
  const base = solid(w, 0, 0, 255, 255);
  const top = solid(w, 255, 0, 0, 128);
  const a = coverBlend(base, top, 2, 2, 1);
  const b = coverBlend(base, top, 2, 2, 3);
  assert.deepEqual(b, a);
});
