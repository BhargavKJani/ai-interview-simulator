// Builds docs/demo.gif from docs/frames/*.png (no ffmpeg required).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const dir = "docs/frames";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
const SCALE = 2; // 1280x800 -> 640x400
const gif = GIFEncoder();
let w = 0, h = 0;

for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  w = Math.floor(png.width / SCALE);
  h = Math.floor(png.height / SCALE);
  const out = new Uint8Array(w * h * 4);
  // box-filter downscale
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      const i = ((y * SCALE + dy) * png.width + (x * SCALE + dx)) * 4;
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2];
    }
    const o = (y * w + x) * 4, n = SCALE * SCALE;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  const palette = quantize(out, 256);
  gif.writeFrame(applyPalette(out, palette), w, h, { palette, delay: 700 });
}
gif.finish();
fs.writeFileSync("docs/demo.gif", gif.bytes());
fs.rmSync(dir, { recursive: true, force: true });
console.log(`docs/demo.gif: ${files.length} frames, ${w}x${h}, ${(fs.statSync("docs/demo.gif").size / 1024).toFixed(0)} KB`);
