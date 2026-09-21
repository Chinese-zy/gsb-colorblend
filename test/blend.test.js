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

test("fringe width must not grow with scale", () => {
  const w = 8;
  const base = solid(w, 0, 0, 255, 255);
  const top = solid(w, 255, 0, 0, 255);
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
