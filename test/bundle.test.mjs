/**
 * Integration test for the built bundle (dist/emulator.js) in Node, using a
 * minimal DOM/canvas/RAF stub. This exercises the same code path the browser
 * uses: load ROM -> start -> per-frame render -> canvas ImageData.
 *
 *   node test/bundle.test.mjs [rom.nes]
 */
import { readFileSync } from "node:fs";
import { buildTestRom } from "../tools/make-test-rom.mjs";

// ------------------------------------------------------------- DOM stubs --
const putImageDataCalls = [];
let lastImage = null;

function makeCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    parentElement: {
      clientWidth: 800,
      clientHeight: 600,
      // Screen.resize() prefers getBoundingClientRect; without it the stub
      // falls back to clientWidth/clientHeight.
      getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0 }),
    },
    getContext() {
      return {
        createImageData: (w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: (img) => {
          putImageDataCalls.push(img);
          lastImage = img;
        },
      };
    },
    toDataURL: () => "data:image/png;base64,stub",
  };
  return canvas;
}

const listeners = new Map();
globalThis.window = {
  addEventListener: (t, fn) => listeners.set(t, [...(listeners.get(t) || []), fn]),
  removeEventListener: () => {},
  devicePixelRatio: 1,
};
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
};
const fakeNavigator = { getGamepads: () => [] };

const rafQueue = [];
globalThis.requestAnimationFrame = (fn) => {
  rafQueue.push(fn);
  return rafQueue.length;
};
globalThis.cancelAnimationFrame = () => {};

// Load the built IIFE bundle into this global scope.
const bundle = readFileSync(new URL("../dist/emulator.js", import.meta.url), "utf8");
// eslint-disable-next-line no-new-func
new Function("window", "document", "navigator", bundle).call(
  globalThis,
  globalThis.window,
  globalThis.document,
  fakeNavigator,
);

const api = globalThis.window.GunNacEmulator || globalThis.GunNacEmulator;
if (!api || typeof api.createPlayer !== "function") {
  console.error("FAIL: bundle did not expose createPlayer");
  process.exit(1);
}

// ------------------------------------------------------------- DOM checks --
// Regression guard for the "Import ROM does nothing in the APK" bug: the file
// input must be a real, visible-in-DOM element that a click event reaches, and
// the save-state buttons must live inside the .slots container that the app
// delegates clicks to.

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const checks = [
  [/<label[^>]+for="file"[^>]*>/, "label[for=file] trigger for the picker"],
  [/<input type="file" id="file"/, "#file input exists"],
  [/accept="[^"]*\.nes/, "accept includes .nes"],
  [/class="sr"[^>]*>/, "file input stays in the DOM (sr, not removed)"],
  [/<div class="slots"[^>]*>[\s\S]*data-action="save1"[\s\S]*data-action="load1"/, "slot 1 buttons inside .slots"],
  [/data-action="save2"[\s\S]*data-action="load2"/, "slot 2 buttons present"],
];
let domOk = true;
for (const [re, label] of checks) {
  const pass = re.test(html);
  console.log(`${pass ? "ok  " : "FAIL"} ${label}`);
  if (!pass) domOk = false;
}

// App JS must attach the slot listener to the container, not a removed node.
const appJs = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const appOk =
  appJs.includes('slots: $(".slots")') &&
  appJs.includes("els.slots.addEventListener") &&
  !appJs.includes("els.saveSlot");
console.log(`${appOk ? "ok  " : "FAIL"} slot clicks delegated to .slots`);
if (!appOk) domOk = false;

// ---------------------------------------------------------------- run it --
const romPath = process.argv[2];
const rom = romPath
  ? new Uint8Array(readFileSync(romPath))
  : new Uint8Array(buildTestRom());

const canvas = makeCanvas();
const player = api.createPlayer({ canvas });

await player.load(rom);
const info = player.romInfo;
console.log(`mapper=${info.mapper} supported=${info.supported} battery=${info.battery}`);
if (!info.supported) {
  console.error("FAIL: mapper unsupported");
  process.exit(1);
}

await player.start();

// Drive ~120 animation frames of 16.7 ms each; the player throttles NES
// frames internally.
let now = 0;
for (let i = 0; i < 200; i++) {
  const pending = rafQueue.splice(0, rafQueue.length);
  now += 16.7;
  for (const fn of pending) fn(now);
  if (putImageDataCalls.length > 30) break;
}

if (!lastImage) {
  console.error("FAIL: no frame was drawn to the canvas");
  process.exit(1);
}

const d = lastImage.data;
let nonBlack = 0;
for (let i = 0; i < d.length; i += 4) {
  if (d[i] || d[i + 1] || d[i + 2]) nonBlack++;
}

// Save a PNG-less dump for eyeballing if requested.
if (process.env.DUMP_PPM) {
  const header = Buffer.from(`P6\n256 240\n255\n`);
  const body = Buffer.alloc(256 * 240 * 3);
  for (let i = 0; i < 256 * 240; i++) {
    body[i * 3] = d[i * 4];
    body[i * 3 + 1] = d[i * 4 + 1];
    body[i * 3 + 2] = d[i * 4 + 2];
  }
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.DUMP_PPM, Buffer.concat([header, body]));
}

// Save states + reset should work through the public API too.
const state = player.saveState();
const parsed = JSON.parse(state);
if (parsed.version !== 2) {
  console.error("FAIL: unexpected save-state version", parsed.version);
  process.exit(1);
}
player.loadState(state);
player.reset();

player.stop();

console.log(`framesPainted=${putImageDataCalls.length} nonBlackPixels=${nonBlack}`);
const ok = domOk && putImageDataCalls.length > 0 && nonBlack > 50;
console.log(ok ? "PASS: built bundle renders frames" : "FAIL: blank canvas");
process.exit(ok ? 0 : 1);
