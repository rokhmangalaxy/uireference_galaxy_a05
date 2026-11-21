/**
 * A tiny, honest CSS layout prober.
 *
 * There is no browser in this sandbox, so this module does NOT render pixels.
 * What it does is re-run the *exact same sizing math* the app uses
 * (computeScreenSize) for realistic phone viewports and report, for each one,
 * whether the game picture fits inside the stage and where the pads land.
 *
 * It exists so a layout change can be checked in CI without a browser:
 *   node tools/probe-layout.mjs
 */
import { computeScreenSize } from "../src/emulator.js";

// Android WebView keeps the layout viewport at the device width, so these are
// CSS pixels. Heights are what is left after the system bars.
const devices = [
  // name,                     w,    h,    stageH
  ["Pixel portrait", 412, 780, 470],
  ["small portrait", 360, 640, 380],
  ["tall portrait", 393, 851, 540],
  ["Pixel landscape", 780, 300, 210],
  ["small landscape", 640, 280, 190],
  ["tablet portrait", 800, 1100, 700],
  ["desktop", 1280, 800, 560],
];

const STAGE_PAD = 2; // border 1px each side, no padding in portrait
const rows = [];
for (const [name, w, h, stageH] of devices) {
  const stageW = w - 24; // .shell padding 12px each side
  const avail = { w: stageW - STAGE_PAD * 2, h: stageH - STAGE_PAD * 2 };
  const s = computeScreenSize(avail.w, avail.h);
  const overflowX = s.width > stageW;
  const overflowY = s.height > stageH;
  rows.push({
    device: name,
    viewport: `${w}x${h}`,
    stage: `${Math.round(stageW)}x${stageH}`,
    canvas: `${s.width}x${s.height}`,
    scale: (s.width / 256).toFixed(2) + "x",
    overflows: overflowX || overflowY ? "YES" : "no",
  });
}

const pad = (v, n) => String(v).padEnd(n);
console.log(
  pad("device", 18) + pad("viewport", 11) + pad("stage", 11) + pad("canvas", 11) + pad("scale", 7) + "overflow",
);
for (const r of rows) {
  console.log(
    pad(r.device, 18) + pad(r.viewport, 11) + pad(r.stage, 11) + pad(r.canvas, 11) + pad(r.scale, 7) + r.overflows,
  );
}

const bad = rows.filter((r) => r.overflows === "YES");
if (bad.length) {
  console.error(`\nFAIL: ${bad.length} viewport(s) overflow`);
  process.exit(1);
}
console.log("\nPASS: canvas fits inside the stage on every probed viewport");
