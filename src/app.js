/**
 * App shell: ROM picker, library, save states, touch controls, PWA wiring.
 * No network calls anywhere — every byte comes from the user's own device.
 */
const $ = (sel) => document.querySelector(sel);

const els = {
  screen: $("#screen"),
  shell: $("#shell"),
  stage: $("#stage"),
  file: $("#file"),
  drop: $("#drop"),
  menu: $("#menu"),
  title: $("#game-title"),
  toast: $("#toast"),
  library: $("#library"),
  libraryList: $("#library-list"),
  libEmpty: $("#lib-empty"),
  importBtn: $("#import-rom"),
  playTest: $("#play-test"),
  slots: $(".slots"),
  dpad: $("#dpad"),
  padA: $("#btn-a"),
  padB: $("#btn-b"),
  start: $("#btn-start"),
  select: $("#btn-select"),
  mute: $("#chip-mute"),
  freeze: $("#chip-pause"),
  shot: $("#btn-shot"),
  qsheet: $("#qsheet"),
  qsheetList: $("#qsheet-list"),
};

const state = {
  player: null,
  romName: null,
  romKey: null,
  romBytes: null,
  paused: false,
  muted: false,
  fpsTimer: 0,
};

// ------------------------------------------------------------ storage ----
const DB_NAME = "gunnac-offline";
const DB_STORE = "roms";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      if (!db.objectStoreNames.contains("states")) db.createObjectStore("states");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const db = {
  async put(store, key, value) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(store, key) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async keys(store) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, "readonly");
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async del(store, key) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// --------------------------------------------------------------- prefs ----
// Small, synchronous key/value store for UI settings and for remembering which
// ROM to reopen. IndexedDB holds the ROM itself; this only holds pointers.
const PREFS_KEY = "pocketnes:prefs";
const prefs = {
  data: {},
  load() {
    try {
      this.data = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
    } catch {
      this.data = {};
    }
    return this.data;
  },
  get(key, fallback) {
    return this.data[key] === undefined ? fallback : this.data[key];
  },
  set(key, value) {
    this.data[key] = value;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.data));
    } catch {}
    return value;
  },
};
prefs.load();

// --------------------------------------------------------------- toast ----
let toastTimer = 0;
function toast(msg, ms = 2600) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
}

// ---------------------------------------------------------------- boot ----
function makeThumb(buffer) {
  // Downscale the NES frame to a small data URL for the library list.
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 120;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(256, 240);
  const d32 = new Uint32Array(img.data.buffer);
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    d32[i] = 0xff000000 | ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff);
  }
  const full = document.createElement("canvas");
  full.width = 256;
  full.height = 240;
  full.getContext("2d").putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(full, 0, 0, 128, 120);
  return c.toDataURL("image/png");
}

async function boot() {
  try {
    const { createPlayer } = window.GunNacEmulator;
    state.player = createPlayer({
      canvas: els.screen,
      onFrame: () => {
        if (state.paused) return;
      },
      onError: (e) => {
        showStage(true);
        toast(`Emulator stopped: ${e.message}`, 6000);
      },
    });
    els.stage.classList.add("ready");
  } catch (e) {
    toast(`Failed to start emulator: ${e.message}`, 8000);
    return;
  }
  bindControls();
  applySkin(prefs.get("skin", "classic"));
  await renderLibrary();
  await autoResume();
  // Kotlin queues ROM payloads until this fires; without it a file opened from
  // the file manager could arrive before app.js was listening.
  window.AndroidBridge?.onWebReady?.();
  log("web ready");
  hideLoader();
  window.addEventListener("beforeunload", () => {
    state.player?.stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (!state.player) return;
    if (document.hidden) state.player.pause();
    else if (state.romKey && !state.paused) state.player.resume();
  });

  // A page that is being closed should come back exactly where it was.
  window.addEventListener("pagehide", () => {
    prefs.set("lastPaused", !!state.paused);
    if (state.romKey) prefs.set("lastRom", state.romKey);
  });
}

function hideLoader() {
  const loader = $("#loader");
  if (loader) loader.remove();
}

/**
 * Reopens the ROM that was playing when the app was last closed.
 *
 * The ROM bytes never leave the device: they live in IndexedDB, and this only
 * remembers the key plus the play state (pause, slot, timestamp). Anything
 * stale is ignored silently so a fresh install still opens the library first.
 */
async function autoResume() {
  const last = prefs.get("lastRom");
  if (!last) return;
  if (prefs.get("autoResume", true) === false) return;
  state.resuming = true;
  try {
    const bytes = await db.get(DB_STORE, last);
    if (!bytes || bytes.byteLength < 16) {
      prefs.set("lastRom", null);
      return;
    }
    await loadRom(bytes, last, { auto: true });
    const slot = prefs.get("lastSlot");
    if (slot) {
      const json = await db.get(DB_STORE, `state:${last}:${slot}`);
      if (json) {
        try {
          state.player.loadState(json);
          toast(`Lanjut dari save slot ${slot.replace("save", "")}`, 3200);
        } catch {}
      }
    }
    if (prefs.get("lastPaused")) {
      state.paused = true;
      state.player.pause();
      syncPauseButtons();
    }
    log(`auto-resumed ${last}`);
  } catch (e) {
    log(`auto-resume failed: ${e.message}`);
  } finally {
    state.resuming = false;
  }
}

/** Keeps every pause control (bar + floating chip) in sync. */
function syncPauseButtons() {
  const label = state.paused ? "▶" : "⏸";
  const pressed = String(state.paused);
  for (const el of [els.freeze, $("#chip-pause")]) {
    if (!el) continue;
    el.textContent = label;
    el.setAttribute("aria-pressed", pressed);
  }
}

function formatWhen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = Date.now();
  const mins = Math.round((now - ts) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} jam lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Fills both save-slot cards with their automatic screenshot + timestamp. */
async function renderSlotPreviews() {
  const key = state.romKey;
  for (const n of [1, 2]) {
    const thumbEl = document.querySelector(`[data-thumb="${n}"]`);
    const whenEl = document.querySelector(`[data-when="${n}"]`);
    if (!thumbEl || !whenEl) continue;
    if (!key) {
      thumbEl.innerHTML = "—";
      whenEl.textContent = "Muat ROM dulu";
      continue;
    }
    const meta = await db.get(DB_STORE, `state:${key}:save${n}:meta`);
    const thumb = await db.get(DB_STORE, `state:${key}:save${n}:thumb`);
    if (thumb) {
      thumbEl.innerHTML = `<img alt="" src="${thumb}">`;
    } else {
      thumbEl.textContent = "—";
    }
    whenEl.innerHTML = meta
      ? `<b>Slot ${n}</b>${formatWhen(meta.at)}${meta.frames ? ` · ${meta.frames} frame` : ""}`
      : `<b>Slot ${n}</b>Belum ada screenshot`;
  }
}

/** Saves a state slot together with its automatic screenshot + metadata. */
async function saveSlot(n) {
  const { player } = state;
  if (!state.romKey) {
    toast("Muat ROM dulu.");
    return;
  }
  const json = player.saveState();
  const shot = player.screenshot();
  const meta = { at: Date.now(), name: state.romName, slot: n };
  await db.put(DB_STORE, `state:${state.romKey}:save${n}`, json);
  await db.put(DB_STORE, `state:${state.romKey}:save${n}:thumb`, shot);
  await db.put(DB_STORE, `state:${state.romKey}:save${n}:meta`, meta);
  prefs.set("lastSlot", `save${n}`);
  await renderSlotPreviews();
  toast(`State + screenshot tersimpan di slot ${n}`);
}

// ------------------------------------------------ quick save-state sheet ----
/**
 * The 💾 chip in the corner opens a mini list of both save slots without
 * going through the full menu: screenshot, time, and Simpan/Muat per row.
 * It is deliberately small and semi-transparent-transparent so it can be used
 * mid-game without losing sight of the action.
 */
async function renderQuickSheet() {
  const list = els.qsheetList;
  if (!list) return;
  if (!state.romKey) {
    list.innerHTML = `<div class="qrow empty"><p>Muat ROM dulu untuk menyimpan state.</p></div>`;
    return;
  }
  const rows = [];
  for (const n of [1, 2]) {
    const meta = await db.get(DB_STORE, `state:${state.romKey}:save${n}:meta`);
    const thumb = await db.get(DB_STORE, `state:${state.romKey}:save${n}:thumb`);
    rows.push(`
      <div class="qrow" data-slot="${n}">
        <span class="qthumb">${thumb ? `<img alt="" src="${thumb}">` : "—"}</span>
        <span class="qwhen">
          <b>Slot ${n}</b>
          <span>${meta ? formatWhen(meta.at) : "kosong"}</span>
        </span>
        <button class="qsave" data-q="save${n}">Simpan</button>
        <button data-q="load${n}" ${meta ? "" : "disabled"}>Muat</button>
      </div>`);
  }
  list.innerHTML = rows.join("");
}

function quickSheetOpen() {
  return els.shell.classList.contains("qsheet-open");
}

async function openQuickSheet() {
  els.shell.classList.remove("menu-open", "editing");
  els.shell.classList.add("qsheet-open");
  els.shell.classList.toggle("chrome-open", true);
  await renderQuickSheet();
  refitScreen();
}

function closeQuickSheet() {
  if (!els.shell.classList.contains("qsheet-open")) return;
  els.shell.classList.remove("qsheet-open");
  els.shell.classList.remove("chrome-open");
}

async function bindQuickSheet() {
  $("#chip-state")?.addEventListener("click", () => {
    if (quickSheetOpen()) closeQuickSheet();
    else openQuickSheet();
  });
  $("#qsheet-close")?.addEventListener("click", closeQuickSheet);

  els.qsheetList?.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-q]")?.dataset.q;
    if (!action) return;
    if (action.startsWith("save")) {
      await saveSlot(action.replace("save", ""));
      await renderQuickSheet();
    } else {
      const key = `state:${state.romKey}:${action.replace("load", "save")}`;
      const json = await db.get(DB_STORE, key);
      if (!json) return;
      try {
        state.player.loadState(json);
        state.paused = false;
        state.player.resume();
        syncPauseButtons();
        prefs.set("lastSlot", `save${action.replace("load", "")}`);
        toast(`State slot ${action.replace("load", "")} dimuat`);
        closeQuickSheet();
      } catch (err) {
        toast(`State tidak bisa dimuat: ${err.message}`);
      }
    }
  });

  // Export / import straight from the quick sheet too.
  $("#qsheet-export")?.addEventListener("click", exportState);
  $("#qsheet-import")?.addEventListener("change", async (e) => {
    await importState(e.target.files?.[0]);
    e.target.value = "";
    closeQuickSheet();
  });

  // Tapping the game area closes the sheet; it must never trap the pointer.
  els.stage?.addEventListener("pointerdown", (e) => {
    if (!quickSheetOpen()) return;
    if (e.target.closest("#qsheet") || e.target.closest(".chrome")) return;
    closeQuickSheet();
  });

  // Keyboard shortcut for desktop testing / Chromebooks: S toggles the sheet.
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey && state.romKey) {
      if (quickSheetOpen()) closeQuickSheet();
      else openQuickSheet();
    }
  });
}

// --------------------------------------------------- state import/export ----
function safeBase(romName) {
  return String(romName || "game")
    .replace(/\.nes$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .slice(0, 60) || "game";
}

/** Exports the *currently running* state as a portable .json file. */
function exportState() {
  if (!state.romKey || !state.player) {
    toast("Muat ROM dulu sebelum export state.");
    return;
  }
  const payload = {
    format: "pocketnes-savestate",
    version: 1,
    game: state.romName,
    romSha: state.romSha || null,
    mappers: state.player.romInfo?.mapper ?? null,
    savedAt: new Date().toISOString(),
    state: JSON.parse(state.player.saveState()),
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeBase(state.romName)}-${Date.now()}.pnesstate.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("State diekspor sebagai file .json");
}

/** Reads a .json/.pnesstate file and applies it to the running ROM. */
async function importState(file) {
  if (!file) return;
  if (!state.romKey || !state.player) {
    toast("Muat ROM yang sama dulu, baru import state.", 5000);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    toast("File state tidak bisa dibaca (bukan JSON).", 6000);
    return;
  }
  const payload =
    parsed && parsed.format === "pocketnes-savestate" ? parsed : { state: parsed, game: null };
  const raw = payload.state ?? parsed;
  const gameName = payload.game;
  if (gameName && state.romName && gameName !== state.romName) {
    toast(
      `State ini untuk "${gameName}", sedangkan ROM aktif "${state.romName}". ` +
        `Muat ROM yang sesuai dulu.`,
      7000,
    );
    return;
  }
  try {
    state.player.loadState(typeof raw === "string" ? raw : JSON.stringify(raw));
    state.paused = false;
    state.player.resume();
    syncPauseButtons();
    toast(`State diimport${gameName ? ` (${gameName})` : ""}`);
  } catch (e) {
    toast(`State tidak cocok: ${e.message}`, 7000);
  }
}

// --------------------------------------------------------------- skins ----
const SKINS = [
  { id: "classic", label: "Klasik", a: "#ffe066", b: "#ff8f9c", pad: "#1b2534" },
  { id: "arcade", label: "Arcade", a: "#ff7ad9", b: "#9df2ff", pad: "#251a33" },
  { id: "retro", label: "Retro", a: "#ffd0a8", b: "#d6f0a8", pad: "#2b241c" },
  { id: "mono", label: "Mono", a: "#ffffff", b: "#e6edf6", pad: "#202836" },
  { id: "neon", label: "Neon", a: "#c8ff5e", b: "#ffb45e", pad: "#0d1a14" },
];

function applySkin(id) {
  const known = SKINS.some((s) => s.id === id) ? id : "classic";
  document.documentElement.dataset.skin = known;
  prefs.set("skin", known);
  for (const btn of document.querySelectorAll("#skin-grid [data-skin-id]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.skinId === known));
  }
  // Neon is the only skin with a glow; keep the CSS honest about it.
  document.documentElement.classList.toggle("skin-glow", known === "neon");
}

function buildSkinGallery() {
  const grid = $("#skin-grid");
  if (!grid) return;
  const current = prefs.get("skin", "classic");
  grid.innerHTML = SKINS.map(
    (s) => `
    <button class="skin-card" type="button" data-skin-id="${s.id}"
            aria-pressed="${s.id === current}">
      <span class="skin-dots">
        <i style="background:${s.a}"></i><i style="background:${s.b}"></i><i style="background:${s.pad}"></i>
      </span>
      ${s.label}
    </button>`,
  ).join("");
  grid.addEventListener("click", (e) => {
    const id = e.target.closest("[data-skin-id]")?.dataset.skinId;
    if (id) {
      applySkin(id);
      toast(`Gaya tombol: ${SKINS.find((s) => s.id === id)?.label || id}`);
    }
  });
}

// --------------------------------------------------------- edit layout ----
/**
 * Drag-to-place controls.
 *
 * Positions are stored as percentages of the control row, one set per
 * orientation (portrait/landscape), so they survive rotation, different screen
 * sizes and Android split-screen. `--dx/--dy` are translations applied to the
 * normal flow position, which keeps the CSS grid intact for accessibility.
 */
const LAYOUT_KEY = "layout";
let dragState = null;

const isEditing = () => els.shell.classList.contains("editing");

function currentOrientation() {
  return window.matchMedia?.("(orientation: landscape)").matches ? "landscape" : "portrait";
}

function layoutFor(orientation) {
  const all = prefs.get(LAYOUT_KEY, {}) || {};
  return all[orientation] || { dpad: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } };
}

function applyLayout() {
  const map = layoutFor(currentOrientation());
  const dpad = els.dpad;
  const right = document.querySelector(".pad-right");
  if (dpad) {
    dpad.style.setProperty("--dx", `${map.dpad?.dx || 0}px`);
    dpad.style.setProperty("--dy", `${map.dpad?.dy || 0}px`);
    dpad.style.transform = `translate(${map.dpad?.dx || 0}px, ${map.dpad?.dy || 0}px)`;
  }
  if (right) {
    right.style.setProperty("--dx", `${map.right?.dx || 0}px`);
    right.style.setProperty("--dy", `${map.right?.dy || 0}px`);
    right.style.transform = `translate(${map.right?.dx || 0}px, ${map.right?.dy || 0}px)`;
  }
}

function saveLayout(orientation, map) {
  const all = prefs.get(LAYOUT_KEY, {}) || {};
  all[orientation] = map;
  prefs.set(LAYOUT_KEY, all);
}

let layoutBeforeEdit = null;

function setEditing(on) {
  if (on) {
    layoutBeforeEdit = JSON.parse(JSON.stringify(prefs.get(LAYOUT_KEY, {}) || {}));
  } else {
    layoutBeforeEdit = null;
  }
  els.shell.classList.toggle("editing", on);
  document.body.classList.toggle("editing", on);
  if (!on) {
    applyLayout();
    dragState = null;
    refitScreen();
  } else {
    const o = currentOrientation();
    for (const btn of document.querySelectorAll("#edit-portrait, #edit-landscape")) {
      const mine = btn.id === `edit-${o}`;
      btn.setAttribute("aria-pressed", String(mine));
      btn.disabled = !mine;
    }
    toast(`Mode atur posisi (${o}) — geser D-pad / tombol A·B`, 4000);
  }
}

function bindDrag(el, key) {
  if (!el) return;
  el.style.touchAction = "none";

  const pointOf = (e) => ({ x: e.clientX, y: e.clientY });

  el.addEventListener("pointerdown", (e) => {
    if (!els.shell.classList.contains("editing")) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture?.(e.pointerId);
    const map = layoutFor(currentOrientation());
    dragState = {
      key,
      el,
      start: pointOf(e),
      base: { ...(map[key] || { dx: 0, dy: 0 }) },
      map,
      moved: false,
    };
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragState || dragState.el !== el) return;
    e.preventDefault();
    const dx = dragState.base.dx + (e.clientX - dragState.start.x);
    const dy = dragState.base.dy + (e.clientY - dragState.start.y);
    // Keep the pad reachable: never drag it further than the viewport.
    const max = Math.max(window.innerWidth, window.innerHeight);
    const clamp = (v) => Math.max(-max, Math.min(max, Math.round(v)));
    el.style.transform = `translate(${clamp(dx)}px, ${clamp(dy)}px)`;
    dragState.next = { dx: clamp(dx), dy: clamp(dy) };
    dragState.moved = true;
  });

  const finish = (e) => {
    if (!dragState || dragState.el !== el) return;
    e.preventDefault?.();
    if (dragState.moved && dragState.next) {
      const map = { ...dragState.map, [key]: dragState.next };
      saveLayout(currentOrientation(), map);
      toast("Posisi disimpan", 1500);
    }
    dragState = null;
  };
  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", finish);
}

function bindEditLayout() {
  const right = document.querySelector(".pad-right");
  bindDrag(els.dpad, "dpad");
  bindDrag(right, "right");

  $("#btn-edit-layout")?.addEventListener("click", () => {
    els.shell.classList.remove("menu-open");
    setEditing(true);
  });
  $("#edit-done")?.addEventListener("click", () => {
    setEditing(false);
    toast("Posisi tombol disimpan", 1800);
  });
  // Batal: restore exactly what was active before edit mode started.
  $("#edit-cancel")?.addEventListener("click", () => {
    if (layoutBeforeEdit) prefs.set(LAYOUT_KEY, layoutBeforeEdit);
    setEditing(false);
    applyLayout();
    toast("Perubahan posisi dibatalkan", 2000);
  });
  $("#edit-reset")?.addEventListener("click", () => {
    const o = currentOrientation();
    saveLayout(o, { dpad: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } });
    applyLayout();
    toast("Tata letak dikembalikan");
  });
  $("#btn-reset-layout")?.addEventListener("click", () => {
    prefs.set(LAYOUT_KEY, {});
    applyLayout();
    toast("Semua tata letak dikembalikan ke awal");
  });
  const syncOrientationButtons = () => {
    const o = currentOrientation();
    for (const btn of document.querySelectorAll("#edit-portrait, #edit-landscape")) {
      const mine = btn.id === `edit-${o}`;
      btn.setAttribute("aria-pressed", String(mine));
      // The other layout cannot be previewed without rotating the device, so
      // do not pretend it can: mark it disabled and say why on tap.
      btn.disabled = !mine;
      btn.title = mine ? "" : `Putar HP ke ${btn.id.replace("edit-", "")} untuk mengatur ini`;
    }
  };
  window.addEventListener("orientationchange", syncOrientationButtons);
  window.addEventListener("orientationchange", applyLayout);
  // Also covered by the ResizeObserver path, but matchMedia fires reliably when
  // a phone rotates without changing the innerWidth/innerHeight pair we saw.
  window.matchMedia?.("(orientation: landscape)").addEventListener?.("change", syncOrientationButtons);
  syncOrientationButtons();
  applyLayout();
}

// --------------------------------------------------------------- stage ----
function showStage(playing) {
  els.shell.classList.toggle("playing", playing);
  if (els.title) els.title.textContent = playing ? state.romName || "GAME" : "Gun Nac";
  // Entering/leaving "playing" changes the stage height (the idle bar is
  // hidden), so the canvas has to be re-fitted on the next frame.
  refitScreen();
}

/** Re-fits the canvas to whatever room the stage currently has. */
function refitScreen() {
  const screen = state.player?.screen;
  if (!screen) return;
  const run = () => screen.resize();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      run();
      // A second pass catches late layout shifts (menu transition, safe-area
      // insets reported after the first frame, Android bars settling).
      requestAnimationFrame(run);
    });
  } else {
    run();
  }
}

// ------------------------------------------------------------- loading ----
async function loadRom(bytes, name, opts = {}) {
  const { player } = state;
  if (!player) return;
  const key = name;
  try {
    const sram = await db.get(DB_STORE, `sram:${key}`);
    await player.load(new Uint8Array(bytes), {
      sram: sram ? new Uint8Array(sram) : null,
      saveSram: (data) => {
        db.put(DB_STORE, `sram:${key}`, data).catch(() => {});
      },
    });
    state.romName = name;
    state.romKey = key;
    state.romBytes = new Uint8Array(bytes);
    state.romSha = await sha1Hex(state.romBytes).catch(() => null);
    // Remember what to reopen next launch (pointer only, the ROM stays in IDB).
    prefs.set("lastRom", key);
    prefs.set("lastPaused", false);
    const info = player.romInfo;
    if (info && !info.supported) {
      toast(`Mapper ${info.mapper} belum didukung build ini.`, 6000);
      return;
    }
    await player.start();
    state.paused = false;
    showStage(true);
    closeQuickSheet();
    syncPauseButtons();
    els.shell.classList.remove("menu-open");
    applyLayout();
    renderSlotPreviews();
    toast(
      opts.auto
        ? `Melanjutkan ${name}`
        : info?.battery
          ? "Loaded (battery save found)"
          : "Loaded — have fun!",
    );
    setTimeout(async () => {
      try {
        const thumb = makeThumb(player.screen.pending || player.pendingBuffer || []);
        if (thumb) await db.put(DB_STORE, `thumb:${key}`, thumb);
      } catch {}
    }, 2500);
  } catch (e) {
    toast(`ROM tidak bisa dijalankan: ${e.message}`, 8000);
    log(`load failed: ${e.message}`);
  }
}

async function sha1Hex(bytes) {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readFileAsBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function importFile(file) {
  if (!file) {
    toast("Tidak ada file yang dipilih.", 4000);
    return;
  }
  const okExt = /\.(nes|fds|unf|unif|zip)$/i.test(file.name);
  if (!okExt) {
    toast(`"${file.name}" bukan file .nes. Pilih ROM NES Anda.`, 6000);
    return;
  }
  if (file.size < 16) {
    toast("File terlalu kecil / rusak.", 5000);
    return;
  }
  const bytes = await readFileAsBytes(file);
  if (!(bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53)) {
    toast("Sepertinya ini bukan file iNES yang valid.", 5000);
    return;
  }
  await db.put(DB_STORE, file.name, bytes);
  await loadRom(bytes, file.name);
  await renderLibrary();
}

// -------------------------------------------------------------- library ----
async function renderLibrary() {
  const keys = (await db.keys(DB_STORE)).filter((k) => !String(k).includes(":"));
  els.libraryList.innerHTML = "";
  els.libEmpty.hidden = keys.length > 0;
  for (const key of keys) {
    const size = (await db.get(DB_STORE, key))?.byteLength || 0;
    const thumb = await db.get(DB_STORE, `thumb:${key}`);
    const li = document.createElement("li");
    li.className = "lib-item";
    li.innerHTML = `
      <button class="lib-play" type="button">
        <span class="lib-thumb">${thumb ? `<img alt="" src="${thumb}">` : "NES"}</span>
        <span class="lib-meta">
          <strong>${escapeHtml(String(key))}</strong>
          <small>${(size / 1024).toFixed(0)} KB · ROM</small>
        </span>
        <span class="lib-go">▶</span>
      </button>
      <button class="lib-del" type="button" title="Remove">✕</button>`;
    li.querySelector(".lib-play").addEventListener("click", async () => {
      const bytes = await db.get(DB_STORE, key);
      if (bytes) await loadRom(bytes, key);
    });
    li.querySelector(".lib-del").addEventListener("click", async (e) => {
      e.stopPropagation();
      await db.del(DB_STORE, key);
      await db.del(DB_STORE, `sram:${key}`);
      await db.del(DB_STORE, `state:${key}`);
      await db.del(DB_STORE, `thumb:${key}`);
      await renderLibrary();
      toast("Dihapus dari library");
    });
    els.libraryList.appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ------------------------------------------------------------- controls ----
function bindControls() {
  const { player } = state;
  if (!player) return;

  // In the Kotlin shell, prefer the native picker: some WebView builds ignore
  // <input type=file> entirely, which is why importing "did nothing" before.
  els.importBtn.addEventListener("click", (e) => {
    if (window.AndroidBridge?.openRomPicker) {
      e.preventDefault();
      window.AndroidBridge.openRomPicker();
    }
  });

  els.file.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    await importFile(file);
    // Allow re-importing the same file name later.
    e.target.value = "";
  });

  const openMenu = () => {
    els.shell.classList.add("menu-open");
    closeQuickSheet();
    renderSlotPreviews();
    renderLibrary();
  };
  $("#chip-menu")?.addEventListener("click", openMenu);

  $("#close-menu").addEventListener("click", () => els.shell.classList.remove("menu-open"));

  // Drag & drop onto the window.
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.shell.classList.add("dragging");
  });
  window.addEventListener("dragleave", () => els.shell.classList.remove("dragging"));
  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    els.shell.classList.remove("dragging");
    const file = e.dataTransfer?.files?.[0];
    if (file) await importFile(file);
  });

  // Quick save / load. Saves always capture a screenshot next to the state.
  els.slots.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (!state.romKey) {
      toast("Muat ROM dulu.");
      return;
    }
    if (action === "save1" || action === "save2") {
      await saveSlot(action.replace("save", ""));
    } else if (action === "load1" || action === "load2") {
      const slot = action.replace("load", "save");
      const json = await db.get(DB_STORE, `state:${state.romKey}:${slot}`);
      if (!json) {
        toast(`Slot ${slot.replace("save", "")} masih kosong`);
        return;
      }
      try {
        player.loadState(json);
        state.paused = false;
        player.resume();
        syncPauseButtons();
        prefs.set("lastSlot", slot);
        await renderSlotPreviews();
        toast(`State slot ${slot.replace("save", "")} dimuat`);
      } catch (err) {
        toast(`State tidak bisa dimuat: ${err.message}`);
      }
    }
  });

  // State import/export.
  $("#btn-export-state")?.addEventListener("click", exportState);
  $("#state-file")?.addEventListener("change", async (e) => {
    await importState(e.target.files?.[0]);
    e.target.value = "";
  });

  buildSkinGallery();
  bindEditLayout();
  bindQuickSheet();

  // Top bar buttons.
  els.mute?.addEventListener("click", () => {
    state.muted = !state.muted;
    player.setMuted(state.muted);
    els.mute.textContent = state.muted ? "🔇" : "🔊";
    els.mute.setAttribute("aria-pressed", String(state.muted));
  });

  els.freeze?.addEventListener("click", () => {
    if (!state.romKey) {
      toast("Muat ROM dulu.");
      return;
    }
    state.paused = !state.paused;
    if (state.paused) player.pause();
    else player.resume();
    syncPauseButtons();
    prefs.set("lastPaused", state.paused);
  });
  $("#chip-pause")?.addEventListener("click", () => els.freeze.click());
  $("#chip-menu")?.addEventListener("click", () => {
    els.shell.classList.add("menu-open");
    renderSlotPreviews();
    renderLibrary();
  });

  els.shot.addEventListener("click", () => {
    if (!state.romKey) return;
    const a = document.createElement("a");
    a.href = player.screenshot();
    a.download = `${(state.romName || "gun-nac").replace(/\.nes$/i, "")}-${Date.now()}.png`;
    a.click();
  });

  $("#btn-reset").addEventListener("click", () => {
    if (!state.romKey) return;
    player.reset();
    player.resume();
    state.paused = false;
    syncPauseButtons();
    toast("Reset");
  });

  // Touch d-pad + buttons. Pointer events cover mouse, pen and touch.
  const hold = (el, btn) => {
    const down = (e) => {
      if (isEditing()) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add("active");
      player.press(btn);
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove("active");
      player.release(btn);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", (e) => {
      if (e.buttons) up(e);
    });
  };

  hold(els.padA, player.BTN.A);
  hold(els.padB, player.BTN.B);
  hold(els.start, player.BTN.START);
  hold(els.select, player.BTN.SELECT);

  // d-pad as a single cluster: work out the direction from the touch point.
  const dpad = els.dpad;
  let activeDir = null;
  const setDir = (btn) => {
    if (activeDir === btn) return;
    if (activeDir !== null) player.release(activeDir);
    activeDir = btn;
    if (btn !== null) player.press(btn);
  };
  const dirFromPoint = (clientX, clientY) => {
    const r = dpad.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? player.BTN.RIGHT : player.BTN.LEFT;
    return dy > 0 ? player.BTN.DOWN : player.BTN.UP;
  };
  dpad.addEventListener("pointerdown", (e) => {
    // In edit mode the same pointer drags the pad around; pressing directions
    // would fight the gesture (and press keys the player never asked for).
    if (isEditing()) return;
    e.preventDefault();
    dpad.setPointerCapture?.(e.pointerId);
    setDir(dirFromPoint(e.clientX, e.clientY));
  });
  dpad.addEventListener("pointermove", (e) => {
    if (e.buttons || e.pointerType === "touch") {
      if (e.pointerType === "touch" || e.buttons) setDir(dirFromPoint(e.clientX, e.clientY));
    }
  });
  const clearDir = () => setDir(null);
  dpad.addEventListener("pointerup", clearDir);
  dpad.addEventListener("pointercancel", clearDir);
  dpad.addEventListener("pointerleave", clearDir);

  // Fullscreen toggle on the stage.
  $("#btn-full").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await els.stage.requestFullscreen({ navigationUI: "hide" });
      setTimeout(() => player.screen.resize(), 120);
    } catch (err) {
      toast("Layar penuh tidak tersedia di browser ini");
    }
  });

  // Keyboard hints for desktop players.
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    // Escape is the universal "get me out of here": it leaves edit mode first,
    // then closes the quick sheet/menu, and only then exits fullscreen.
    if (els.shell.classList.contains("editing")) {
      $("#edit-cancel")?.click();
      return;
    }
    if (quickSheetOpen()) {
      closeQuickSheet();
      return;
    }
    if (els.shell.classList.contains("menu-open")) {
      els.shell.classList.remove("menu-open");
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen();
  });
}

// Play the built-in test ROM so first-run users can verify the emulator.
els.playTest?.addEventListener("click", async () => {
  try {
    const res = await fetch("./roms/test.nes");
    if (!res.ok) throw new Error("test ROM missing");
    const buf = new Uint8Array(await res.arrayBuffer());
    await db.put(DB_STORE, "test.nes", buf);
    await loadRom(buf, "test.nes");
    await renderLibrary();
  } catch (e) {
    toast("Test ROM bawaan tidak ditemukan. Jalankan: npm run build", 6000);
  }
});

// --------------------------------------------------- Kotlin/WebView bridge --
// MainActivity.kt exposes AndroidBridge and calls these globals when the user
// opens a .nes file from a file manager (ACTION_VIEW) or when the activity is
// paused/resumed by the OS.
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const romChunks = new Map();

window.__gunNacRomBegin = (name, count) => {
  romChunks.set(name, { parts: new Array(count), got: 0, count });
  log(`rom begin ${name} x${count}`);
};

window.__gunNacRomChunk = (name, index, chunk) => {
  const entry = romChunks.get(name);
  if (!entry) return;
  entry.parts[index] = chunk;
  entry.got++;
  if (entry.got === entry.count) finishRom(name);
};

window.__gunNacRomEnd = (name) => {
  const entry = romChunks.get(name);
  if (entry && entry.got === entry.count) finishRom(name);
};

async function finishRom(name) {
  const entry = romChunks.get(name);
  if (!entry) return;
  romChunks.delete(name);
  try {
    const bytes = base64ToBytes(entry.parts.join(""));
    if (bytes.length < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53) {
      toast(`"${name}" bukan file iNES yang valid (${bytes.length} byte).`, 8000);
      return;
    }
    await db.put(DB_STORE, name, bytes);
    await loadRom(bytes, name);
    await renderLibrary();
    log(`restored from native backup: ${name}`);
  } catch (e) {
    toast(`Gagal membuka ROM: ${e.message}`, 8000);
    log(`rom error ${e.message}`);
  }
}

// Backwards-compatible single-shot entry point (still used by tests/older
// shells).
window.__gunNacOpenRom = async (name, base64) => {
  window.__gunNacRomBegin(name, 1);
  window.__gunNacRomChunk(name, 0, base64);
};

function log(message) {
  try {
    window.AndroidBridge?.log?.(String(message));
    if (!window.AndroidBridge) console.log("[gun-nac]", message);
  } catch {}
}
window.__gunNacPause = () => state.player?.pause();

/**
 * Kotlin asks this after boot: if we have a ROM pointer and the bytes are
 * still in IndexedDB, auto-resume will handle it -- so the native backup copy
 * must NOT be replayed (that would load the game twice). If the library was
 * wiped, return false and the shell restores its own copy instead.
 */
window.__gunNacHasLastRom = () => {
  const last = prefs.get("lastRom");
  if (!last) return true; // nothing to resume, and nothing to restore
  // If we are still restoring, say "yes": the native side must not race us and
  // load a second copy from its backup.
  if (state.resuming) return true;
  return state.romKey === last;
};
// Called by the Kotlin shell whenever the WebView changes size: rotation,
// system bars appearing, split-screen, keyboard. Without this the canvas kept
// the size it was given before the change and could overflow the stage.
window.__gunNacResize = () => refitScreen();
window.__gunNacResume = () => {
  if (state.romKey && !state.paused) state.player?.resume();
};
// Let the native shell tune the layout (safe areas, fullscreen button, ...).
window.__gunNacIsNative = () => !!window.AndroidBridge?.isNativeShell?.();
if (window.AndroidBridge?.isNativeShell?.()) {
  document.documentElement.classList.add("native");
}

// Service worker: makes the app work with no network at all.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

boot();
