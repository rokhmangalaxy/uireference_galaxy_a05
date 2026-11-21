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
  mute: $("#btn-mute"),
  freeze: $("#btn-pause"),
  shot: $("#btn-shot"),
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
  await renderLibrary();
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
}

function hideLoader() {
  const loader = $("#loader");
  if (loader) loader.remove();
}

// --------------------------------------------------------------- stage ----
function showStage(playing) {
  els.shell.classList.toggle("playing", playing);
  els.title.textContent = playing ? state.romName || "GAME" : "GUN NAC";
}

// ------------------------------------------------------------- loading ----
async function loadRom(bytes, name) {
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
    const info = player.romInfo;
    if (info && !info.supported) {
      toast(`Mapper ${info.mapper} isn't supported by this build.`, 6000);
      return;
    }
    await player.start();
    state.paused = false;
    showStage(true);
    els.shell.classList.remove("menu-open");
    toast(info?.battery ? "Loaded (battery save found)" : "Loaded — have fun!");
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
    toast("That doesn't look like an iNES file.", 5000);
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
      toast("Removed from library");
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

  $("#open-menu").addEventListener("click", () => {
    els.shell.classList.add("menu-open");
    renderLibrary();
  });
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

  // Quick save / load.
  els.slots.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action || !state.romKey) {
      toast("Load a ROM first.");
      return;
    }
    if (action === "save1" || action === "save2") {
      const json = player.saveState();
      await db.put(DB_STORE, `state:${state.romKey}:${action}`, json);
      db.put(DB_STORE, `state:${state.romKey}:thumb`, player.screenshot()).catch(() => {});
      toast("State saved");
    } else if (action === "load1" || action === "load2") {
      const key = `state:${state.romKey}:${action.replace("load", "save")}`;
      const json = await db.get(DB_STORE, key);
      if (!json) {
        toast("No save state in this slot");
        return;
      }
      try {
        player.loadState(json);
        toast("State loaded");
      } catch (err) {
        toast(`Can't load state: ${err.message}`);
      }
    }
  });

  // Top bar buttons.
  els.mute.addEventListener("click", () => {
    state.muted = !state.muted;
    player.setMuted(state.muted);
    els.mute.textContent = state.muted ? "🔇" : "🔊";
    els.mute.setAttribute("aria-pressed", String(state.muted));
  });

  els.freeze.addEventListener("click", () => {
    if (!state.romKey) return;
    state.paused = !state.paused;
    if (state.paused) player.pause();
    else player.resume();
    els.freeze.textContent = state.paused ? "▶" : "⏸";
    els.freeze.setAttribute("aria-pressed", String(state.paused));
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
    els.freeze.textContent = "⏸";
    toast("Reset");
  });

  // Touch d-pad + buttons. Pointer events cover mouse, pen and touch.
  const hold = (el, btn) => {
    const down = (e) => {
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
      toast("Fullscreen not available in this browser");
    }
  });

  // Keyboard hints for desktop players.
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && document.fullscreenElement) document.exitFullscreen();
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
    toast("Built-in test ROM not found. Build it with: npm run build", 6000);
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
