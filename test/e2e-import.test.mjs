/**
 * End-to-end import test in jsdom: loads the real index.html + dist/app.js,
 * dispatches a change event on the file input with a generated .nes, and
 * asserts that the emulator actually renders a frame afterwards.
 *
 * This is the headless equivalent of "tap Import ROM, pick a file" and it
 * catches regressions that a DOM-string grep cannot (IndexedDB, FileReader,
 * component wiring, renderer).
 *
 *   node test/e2e-import.test.mjs
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
import { buildTestRom } from "../tools/make-test-rom.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  // Drop the real bundles; we inject the built ones manually so jsdom controls
  // script execution order.
  .replace(/<script src="(emulator|app)\.js"><\/script>/g, "");

const dom = new JSDOM(html, {
  url: "https://appassets.androidplatform.net/assets/web/index.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const { window } = dom;

// --- browser APIs jsdom lacks ------------------------------------------------
window.indexedDB = globalThis.indexedDB;
window.IDBKeyRange = globalThis.IDBKeyRange;
window.AudioContext = undefined; // audio never blocks loading
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    createImageData: (w, h) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => {
      this.__painted = (this.__painted || 0) + 1;
    },
    drawImage: () => {},
    imageSmoothingEnabled: true,
  };
};
window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,stub";

// --- inject the built bundles ------------------------------------------------
const run = (file) => {
  const code = readFileSync(new URL(`../dist/${file}`, import.meta.url), "utf8");
  const script = new window.Function(code);
  script.call(window);
};
run("emulator.js");
run("app.js");

const errors = [];
window.addEventListener("error", (e) => errors.push(e.message));

// --- simulate picking a ROM --------------------------------------------------
const bytes = new Uint8Array(buildTestRom());
const file = new window.File([bytes], "gun-nac-usa.nes", {
  type: "application/octet-stream",
});

const input = window.document.querySelector("#file");
if (!input) throw new Error("no #file input in index.html");

// jsdom has no FileReader-backed File.arrayBuffer? It does. Our app uses
// FileReader.readAsArrayBuffer, which jsdom implements.
// jsdom enforces the real FileList type, so build a DataTransfer-like object.
Object.defineProperty(input, "files", {
  configurable: true,
  value: {
    0: file,
    length: 1,
    item: (i) => (i === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file;
    },
  },
});
input.dispatchEvent(new window.Event("change", { bubbles: true }));

// Wait for: read -> validate -> IndexedDB put -> load -> start -> frames.
await new Promise((r) => setTimeout(r, 1200));

const doc = window.document;
const shell = doc.querySelector("#shell");
const canvas = doc.querySelector("#screen");
const title = doc.querySelector("#game-title")?.textContent || "";
const toastText = doc.querySelector("#toast")?.textContent || "";
const libraryItems = doc.querySelectorAll(".lib-item").length;

// Advance a few animation frames so the renderer paints.
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 16));
}

const painted = canvas.__painted || 0;
// --- second scenario: the Kotlin shell path ------------------------------
// When the page runs inside the APK, Import ROM calls
// AndroidBridge.openRomPicker() and MainActivity later pushes the ROM back as
// base64 chunks via evaluateJavascript. Replay that exact sequence.
const romBase64 = Buffer.from(buildTestRom()).toString("base64");
const chunks = [];
const bridge = {
  openRomPicker: () => {},          // never resolves in this test
  onWebReady: () => {},
  log: () => {},
  isNativeShell: () => true,
};
window.AndroidBridge = bridge;
// Send it in two halves to also exercise the chunk assembly.
const half = Math.ceil(romBase64.length / 2);
window.eval(`window.__gunNacRomBegin("bridge.nes", 2)`);
window.eval(`window.__gunNacRomChunk("bridge.nes", 0, ${JSON.stringify(romBase64.slice(0, half))})`);
window.eval(`window.__gunNacRomChunk("bridge.nes", 1, ${JSON.stringify(romBase64.slice(half))})`);
window.eval(`window.__gunNacRomEnd("bridge.nes")`);
await new Promise((r) => setTimeout(r, 900));
for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 16));

const bridgeResult = {
  title: doc.querySelector("#game-title")?.textContent || "",
  toast: doc.querySelector("#toast")?.textContent || "",
  libraryItems: doc.querySelectorAll(".lib-item").length,
  painted: canvas.__painted || 0,
};

const result = {
  playing: shell.classList.contains("playing"),
  title,
  toast: toastText,
  libraryItems,
  painted,
  errors,
  bridge: bridgeResult,
};

console.log(JSON.stringify(result, null, 2));

const ok =
  result.playing &&
  painted > 0 &&
  libraryItems >= 1 &&
  bridgeResult.title === "bridge.nes" &&
  bridgeResult.libraryItems >= 2 &&
  bridgeResult.painted > painted &&
  errors.length === 0;

console.log(ok ? "PASS: import -> load -> render works" : "FAIL: import path broken");
process.exit(ok ? 0 : 1);
