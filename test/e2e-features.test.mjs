/**
 * End-to-end test for the "quality of life" features added on top of the
 * import fix:
 *
 *   1. Auto-resume  - closing the app and reopening it reloads the last ROM
 *                     from IndexedDB (the ROM is never re-imported).
 *   2. Slot captures - saving a slot stores state + a screenshot + metadata.
 *   3. State export/import - a .json state file round-trips.
 *   4. Button skins - a skin choice is persisted and applied to <html>.
 *   5. Edit layout  - dragged pad offsets are stored per orientation.
 *
 * Runs the real index.html + dist bundles in jsdom, exactly like the other
 * e2e test, so a broken selector or typo fails here instead of on the phone.
 *
 *   node test/e2e-features.test.mjs
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
import { buildTestRom } from "../tools/make-test-rom.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(
  /<script src="(emulator|app)\.js"><\/script>/g,
  "",
);

// ---- a localStorage that survives two "app launches" -----------------------
const store = new Map();
function makeWindow(sharedPrefs) {
  const dom = new JSDOM(html, {
    url: "https://appassets.androidplatform.net/assets/web/index.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.indexedDB = globalThis.indexedDB;
  window.IDBKeyRange = globalThis.IDBKeyRange;
  window.AudioContext = undefined;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => (sharedPrefs.has(k) ? sharedPrefs.get(k) : null),
      setItem: (k, v) => sharedPrefs.set(k, String(v)),
      removeItem: (k) => sharedPrefs.delete(k),
      clear: () => sharedPrefs.clear(),
      key: (i) => [...sharedPrefs.keys()][i] ?? null,
      get length() {
        return sharedPrefs.size;
      },
    },
  });
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {
        this.__painted = (this.__painted || 0) + 1;
      },
      drawImage: () => {},
      imageSmoothingEnabled: true,
    };
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,stub-thumb";
  window.URL.createObjectURL = () => "blob:stub";
  window.URL.revokeObjectURL = () => {};
  return dom;
}

function runBundles(window) {
  for (const file of ["emulator.js", "app.js"]) {
    const code = readFileSync(new URL(`../dist/${file}`, import.meta.url), "utf8");
    new window.Function(code).call(window);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (name) => console.log(`... ${name}`);
let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`ok   ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

async function pickRom(window, name = "gun-nac-usa.nes") {
  const bytes = new Uint8Array(buildTestRom());
  const file = new window.File([bytes], name, { type: "application/octet-stream" });
  const input = window.document.querySelector("#file");
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
  await sleep(1100);
  return window.document;
}

// ===================================================== launch 1: import ====
const prefsStore = new Map();
const dom1 = makeWindow(prefsStore);
runBundles(dom1.window);
const doc1 = await pickRom(dom1.window);

step("ROM loads and plays");
check("ROM loads and plays", doc1.querySelector("#shell").classList.contains("playing"));

// ---- feature 4: skins ------------------------------------------------------
const skinCards = [...doc1.querySelectorAll("#skin-grid [data-skin-id]")];
step("skin gallery is rendered");
check("skin gallery is rendered", skinCards.length >= 4, `got ${skinCards.length}`);
skinCards.find((b) => b.dataset.skinId === "neon").dispatchEvent(
  new dom1.window.MouseEvent("click", { bubbles: true }),
);
check(
  "skin is applied to the document",
  doc1.documentElement.dataset.skin === "neon",
  doc1.documentElement.dataset.skin,
);
check(
  "skin choice is persisted",
  JSON.parse(prefsStore.get("pocketnes:prefs") || "{}").skin === "neon",
);

// ---- feature 2: save slot captures a screenshot ----------------------------
doc1.querySelector('[data-action="save1"]').dispatchEvent(
  new dom1.window.MouseEvent("click", { bubbles: true }),
);
await sleep(700);
check(
  "slot card shows the automatic screenshot",
  !!doc1.querySelector('[data-thumb="1"] img'),
  doc1.querySelector('[data-thumb="1"]')?.innerHTML,
);
check(
  "slot card shows when it was saved",
  /menit lalu|baru saja|jam lalu/.test(doc1.querySelector('[data-when="1"]')?.textContent || ""),
  doc1.querySelector('[data-when="1"]')?.textContent,
);

// ---- feature 5: edit layout drag ------------------------------------------
doc1.querySelector("#btn-edit-layout").dispatchEvent(
  new dom1.window.MouseEvent("click", { bubbles: true }),
);
step("edit mode turns on");
check("edit mode turns on", doc1.querySelector("#shell").classList.contains("editing"));
const dpad = doc1.querySelector("#dpad");
const fire = (type, x, y) =>
  dpad.dispatchEvent(
    new dom1.window.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }),
  );
fire("pointerdown", 100, 500);
fire("pointermove", 130, 470);
fire("pointerup", 130, 470);
await sleep(120);
const layout = JSON.parse(prefsStore.get("pocketnes:prefs") || "{}").layout || {};
const portrait = layout.portrait?.dpad || {};
check(
  "dragged D-pad position is stored for portrait",
  portrait.dx === 30 && portrait.dy === -30,
  JSON.stringify(portrait),
);
doc1.querySelector("#edit-done").dispatchEvent(new dom1.window.MouseEvent("click", { bubbles: true }));
check("edit mode turns off", !doc1.querySelector("#shell").classList.contains("editing"));

// In edit mode the D-pad must drag the pad, not press "right" on the game pad.
// Both handlers listen on #dpad, so this is a real conflict risk: verify the
// game's button state stays cleared after a drag.
doc1.querySelector("#btn-edit-layout").dispatchEvent(
  new dom1.window.MouseEvent("click", { bubbles: true }),
);
fire("pointerdown", 40, 300);
fire("pointermove", 60, 320);
fire("pointerup", 60, 320);
await sleep(100);
const layout2 = JSON.parse(prefsStore.get("pocketnes:prefs") || "{}").layout?.portrait?.dpad || {};
check(
  "second drag accumulates from the saved position",
  layout2.dx === 50 && layout2.dy === -10,
  JSON.stringify(layout2),
);
check("edit mode can be entered twice", doc1.querySelector("#shell").classList.contains("editing"));
// A drag must not leave a direction latched on the emulator.
check(
  "no game button stays pressed after editing",
  !doc1.querySelector("#dpad").classList.contains("active"),
);
doc1.querySelector("#edit-done").dispatchEvent(new dom1.window.MouseEvent("click", { bubbles: true }));

// ---- feature 3: state export ------------------------------------------------
let exported = null;
const realCreate = dom1.window.URL.createObjectURL;
dom1.window.URL.createObjectURL = (blob) => {
  // Capture the payload instead of writing a file.
  blob.text().then((t) => (exported = t));
  return realCreate(blob);
};
doc1.querySelector("#btn-export-state").dispatchEvent(
  new dom1.window.MouseEvent("click", { bubbles: true }),
);
await sleep(300);
let payload = null;
try {
  payload = JSON.parse(exported);
} catch {}
step("export produces a pocketnes-savestate JSON");
check("export produces a pocketnes-savestate JSON", payload?.format === "pocketnes-savestate");
check("export names the game", payload?.game === "gun-nac-usa.nes", payload?.game);
check("export carries the emulator state", !!payload?.state?.cpu, Object.keys(payload?.state || {}).join(","));

// ========================================= launch 2: auto-resume + import ==
const dom2 = makeWindow(prefsStore);
runBundles(dom2.window);
await sleep(1600);
const doc2 = dom2.window.document;

step("app reopens the last ROM");
check(
  "app reopens the last ROM without importing it again",
  doc2.querySelector("#shell").classList.contains("playing"),
  "stage never entered playing state",
);
check(
  "reopened ROM keeps its title",
  /gun-nac-usa/.test(doc2.querySelector("#game-title")?.textContent || ""),
  doc2.querySelector("#game-title")?.textContent,
);
check("skin survived the restart", doc2.documentElement.dataset.skin === "neon");
check(
  "layout survived the restart",
  (doc2.querySelector("#dpad")?.style.transform || "").includes("50px"),
  doc2.querySelector("#dpad")?.style.transform,
);

// ---- feature 3b: state import ---------------------------------------------
const stateInput = doc2.querySelector("#state-file");
const jsonFile = new dom2.window.File([exported], "gun-nac-save1.pnesstate.json", {
  type: "application/json",
});
Object.defineProperty(stateInput, "files", {
  configurable: true,
  value: {
    0: jsonFile,
    length: 1,
    item: (i) => (i === 0 ? jsonFile : null),
    [Symbol.iterator]: function* () {
      yield jsonFile;
    },
  },
});
stateInput.dispatchEvent(new dom2.window.Event("change", { bubbles: true }));
await sleep(700);
const toastText = doc2.querySelector("#toast")?.textContent || "";
check(
  "imported state is accepted for the matching ROM",
  /State diimport/.test(toastText),
  toastText,
);

// ---- importing a state for a *different* ROM must be refused --------------
const wrongFile = new dom2.window.File(
  [JSON.stringify({ format: "pocketnes-savestate", version: 1, game: "other.nes", state: {} })],
  "other.pnesstate.json",
  { type: "application/json" },
);
Object.defineProperty(stateInput, "files", {
  configurable: true,
  value: {
    0: wrongFile,
    length: 1,
    item: (i) => (i === 0 ? wrongFile : null),
    [Symbol.iterator]: function* () {
      yield wrongFile;
    },
  },
});
stateInput.dispatchEvent(new dom2.window.Event("change", { bubbles: true }));
await sleep(400);
check(
  "state for a different ROM is refused with an explanation",
  /State ini untuk/.test(doc2.querySelector("#toast")?.textContent || ""),
  doc2.querySelector("#toast")?.textContent,
);

// ---- header collapse -------------------------------------------------------
doc2.querySelector("#btn-chrome").dispatchEvent(
  new dom2.window.MouseEvent("click", { bubbles: true }),
);
check(
  "top bar can be collapsed while playing",
  doc2.querySelector("#shell").classList.contains("chrome-open"),
);

// jsdom keeps timers (the running emulator, toasts) alive forever; close both
// windows so `npm test` cannot hang.
dom2.window.close();
dom1.window.close();

if (failures) {
  console.log(`\nFAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log("\nPASS: auto-resume, slot screenshots, state io, skins, layout editor");
process.exit(0);
