/**
 * Emulator glue. The jsnes package is bundled in; this file only adds the
 * browser plumbing the app needs: canvas output, Web Audio, input, save states
 * and battery-backed SRAM persistence.
 *
 * Exposes window.GunNacEmulator = { createPlayer } (assigned explicitly at the
 * bottom so the bundle also works when evaluated outside a page's global
 * scope, e.g. in tests).
 */
import { NES } from "jsnes";

const W = 256;
const H = 240;

/**
 * Sizes the 256x240 canvas so it always fits inside `availW x availH`.
 *
 * Fitting matters more than crispness: a canvas even one pixel wider than its
 * column makes an Android WebView scroll sideways, which is what used to push
 * the game picture off the left edge. So this never rounds UP, and it also
 * allows shrinking below 1x (the old code forced a 1x minimum, so on short
 * landscape stages the 256 px canvas overflowed the stage).
 *
 *   computeScreenSize(388, 500) -> { width: 384, height: 360 }   // 1.5x
 *   computeScreenSize(200, 300) -> { width: 192, height: 180 }   // 0.75x
 */
export function computeScreenSize(availW, availH) {
  const w = Number.isFinite(availW) && availW > 0 ? availW : W;
  const h = Number.isFinite(availH) && availH > 0 ? availH : H;
  const raw = Math.min(w / W, h / H);
  if (!Number.isFinite(raw) || raw <= 0) return { width: W, height: H };

  let scale;
  if (raw >= 2) {
    scale = Math.floor(raw); // whole-pixel upscales stay crisp
  } else if (raw >= 0.25) {
    scale = Math.floor(raw * 16) / 16; // fine steps when downscaling
  } else {
    scale = raw; // tiny box: don't quantise into nothing
  }

  // Round down so the result always fits, then clamp to at least one pixel:
  // a zero-height canvas would hide the picture entirely on absurdly small
  // boxes (Android split-screen, a 1-px stage during rotation).
  const width = Math.max(1, Math.min(Math.floor(W * scale), Math.floor(w)));
  const height = Math.max(1, Math.min(Math.floor(H * scale), Math.floor(h)));
  return { width, height };
}

// jsnes packs pixels as 0xRRGGBB in a Uint32Array; the canvas wants
// little-endian ABGR, which is what we assemble in the ImageData buffer.
class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.image = this.ctx.createImageData(W, H);
    this.buf32 = new Uint32Array(this.image.data.buffer);
    this.pending = null;
    this.resize();
    // Re-fit on every geometry change: rotation, the on-screen keyboard, a
    // menu sliding in, Android split-screen, or entering fullscreen. Listening
    // to the element (not just the window) also covers layout changes that do
    // not fire a window resize event.
    const refit = () => this.resize();
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("resize", refit);
      window.addEventListener("orientationchange", refit);
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("fullscreenchange", refit);
      }
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(refit);
        if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
      }
    }
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    // jsdom and the bundle test stub the parent element with a bare object, so
    // fall back to clientWidth/clientHeight when getBoundingClientRect is gone.
    const box =
      typeof parent.getBoundingClientRect === "function"
        ? parent.getBoundingClientRect()
        : { width: parent.clientWidth, height: parent.clientHeight };
    const cs =
      typeof window !== "undefined" && typeof window.getComputedStyle === "function"
        ? window.getComputedStyle(parent)
        : null;
    const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
    // The stage has padding and a border; the canvas must fit INSIDE them.
    const padX = cs ? num(cs.paddingLeft) + num(cs.paddingRight) : 0;
    const padY = cs ? num(cs.paddingTop) + num(cs.paddingBottom) : 0;
    const lineX = cs ? num(cs.borderLeftWidth) + num(cs.borderRightWidth) : 0;
    const lineY = cs ? num(cs.borderTopWidth) + num(cs.borderBottomWidth) : 0;
    const size = computeScreenSize(box.width - padX - lineX, box.height - padY - lineY);
    this.canvas.style.width = `${size.width}px`;
    this.canvas.style.height = `${size.height}px`;
  }

  setFrame(buffer) {
    this.pending = buffer;
  }

  draw() {
    if (!this.pending) return;
    const src = this.pending;
    const dst = this.buf32;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      dst[i] = 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.pending = null;
  }

  screenshot() {
    return this.canvas.toDataURL("image/png");
  }
}

class Audio {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.muted = false;
    this.left = new Float32Array(4096);
    this.right = new Float32Array(4096);
    this.n = 0;
  }

  // Must be called from a user gesture (policy: autoplay). No sampleRate is
  // requested: the APU is configured with getSampleRate() after the context
  // exists, so it always matches the device (44.1 kHz or 48 kHz).
  async start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    const code = `
      class NESProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.cap = 16384;
          this.l = new Float32Array(this.cap);
          this.r = new Float32Array(this.cap);
          this.w = 0; this.read = 0; this.count = 0;
          this.port.onmessage = (e) => {
            if (e.data.type !== "samples") return;
            const { l, r } = e.data;
            if (this.count + l.length > this.cap) {
              const drop = this.count + l.length - this.cap;
              this.read = (this.read + drop) % this.cap;
              this.count -= drop;
            }
            for (let i = 0; i < l.length; i++) {
              this.l[this.w] = l[i]; this.r[this.w] = r[i];
              this.w = (this.w + 1) % this.cap;
            }
            this.count += l.length;
          };
        }
        process(_in, out) {
          const o = out[0]; if (!o) return true;
          const L = o[0], R = o[1] || o[0];
          const size = L.length;
          const n = Math.min(size, this.count);
          for (let i = 0; i < n; i++) {
            L[i] = this.l[this.read]; R[i] = this.r[this.read];
            this.read = (this.read + 1) % this.cap;
          }
          for (let i = n; i < size; i++) { L[i] = 0; R[i] = 0; }
          this.count -= n;
          return true;
        }
      }
      registerProcessor("nes-audio", NESProcessor);
    `;
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.node = new AudioWorkletNode(this.ctx, "nes-audio", { outputChannelCount: [2] });
    this.node.connect(this.ctx.destination);
    this.sampleRate = this.ctx.sampleRate;
  }

  getSampleRate() {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }

  // jsnes supplies normalised stereo samples in [-1, 1].
  push(l, r) {
    if (!this.node || this.muted) return;
    this.left[this.n] = l;
    this.right[this.n] = r;
    this.n++;
    if (this.n === 128) this.flush();
  }

  flush() {
    if (!this.node || this.n === 0) return;
    if (this.muted) {
      this.n = 0;
      return;
    }
    this.node.port.postMessage({
      type: "samples",
      l: this.left.slice(0, this.n),
      r: this.right.slice(0, this.n),
    });
    this.n = 0;
  }

  setMuted(m) {
    this.muted = m;
  }
}

// Controller button ids mirror jsnes' Controller statics.
const BTN = { A: 0, B: 1, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7 };

const DEFAULT_KEYS = {
  ArrowUp: BTN.UP,
  ArrowDown: BTN.DOWN,
  ArrowLeft: BTN.LEFT,
  ArrowRight: BTN.RIGHT,
  KeyZ: BTN.A,
  KeyX: BTN.B,
  KeyA: BTN.B,
  KeyS: BTN.A,
  Enter: BTN.START,
  ShiftRight: BTN.SELECT,
  ShiftLeft: BTN.SELECT,
  Tab: BTN.SELECT,
};

export function createPlayer({ canvas, onFrame, onError } = {}) {
  const screen = new Screen(canvas);
  const audio = new Audio();
  let raf = 0;
  let running = false;
  let useAudioClock = false;

  // The APU resamples with the context's rate; the app creates the audio
  // context on the first play tap, so this matches the device.
  const nes = new NES({
    onFrame: (buffer) => {
      screen.setFrame(buffer);
      if (onFrame) onFrame();
    },
    onAudioSample: (l, r) => audio.push(l, r),
    onBatteryRamWrite: () => scheduleSramSave(),
    onStatusUpdate: () => {},
    sampleRate: audio.getSampleRate(),
    emulateSound: true,
  });

  // ---------------------------------------------------------------- SRAM ----
  // Battery-backed cartridges keep their save RAM at $6000-$7FFF. jsnes
  // stores it in cpu.mem and reports writes through onBatteryRamWrite.
  const SRAM_START = 0x6000;
  const SRAM_END = 0x8000;

  let sramTimer = 0;
  let sramSaver = null;

  function readSRAM() {
    return new Uint8Array(nes.cpu.mem.slice(SRAM_START, SRAM_END));
  }

  function scheduleSramSave() {
    if (!sramSaver || !nes.rom || !nes.rom.batteryRam) return;
    clearTimeout(sramTimer);
    sramTimer = setTimeout(() => sramSaver(readSRAM()), 750);
  }

  function loadSRAM(bytes) {
    if (!bytes) return;
    const n = Math.min(bytes.length, SRAM_END - SRAM_START);
    nes.cpu.mem.set(bytes.subarray(0, n), SRAM_START);
  }

  // ------------------------------------------------------------- timing ----
  // Simple, robust scheduler: run exactly one NES frame per animation frame,
  // throttled to the NTSC rate. Audio is generated per frame (~800 samples at
  // 48 kHz) so sound stays in sync even on 120 Hz displays.
  const FRAME_MS = 1000 / 60.098;
  let last = 0;
  let acc = 0;

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (!last) last = now;
    let delta = now - last;
    last = now;
    if (delta > 250) delta = FRAME_MS; // tab was backgrounded
    acc += delta;
    let steps = 0;
    try {
      while (acc >= FRAME_MS && steps < 3) {
        nes.frame();
        acc -= FRAME_MS;
        steps++;
        if (steps === 1) audio.flush();
      }
    } catch (e) {
      running = false;
      cancelAnimationFrame(raf);
      if (onError) onError(e);
      return;
    }
    if (acc > FRAME_MS * 4) acc = 0; // drop backlog instead of fast-forwarding
    screen.draw();
  }

  // -------------------------------------------------------------- input ----
  const pressed = new Set();
  const keyToBtn = { ...DEFAULT_KEYS };
  const handlers = [];
  function bind(userKeys) {
    Object.assign(keyToBtn, userKeys || {});
  }

  function press(btn) {
    if (pressed.has(btn)) return;
    pressed.add(btn);
    nes.buttonDown(1, btn);
  }
  function release(btn) {
    if (!pressed.has(btn)) return;
    pressed.delete(btn);
    nes.buttonUp(1, btn);
  }

  const onKeyDown = (e) => {
    if (e.repeat) return;
    if (e.code === "Escape") return;
    const btn = keyToBtn[e.code];
    if (btn === undefined) return;
    if ([" ", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    } else if (e.code === "Tab") e.preventDefault();
    press(btn);
  };
  const onKeyUp = (e) => {
    const btn = keyToBtn[e.code];
    if (btn === undefined) return;
    release(btn);
  };
  const onBlur = () => {
    for (const b of [...pressed]) release(b);
  };

  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // Gamepad support (standard mapping).
  let gpRaf = 0;
  const gamepadState = [];
  function pollGamepad() {
    gpRaf = requestAnimationFrame(pollGamepad);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (!pad) return;
    const map = [
      [0, BTN.B], [1, BTN.A], [2, BTN.B], [3, BTN.A],
      [9, BTN.START], [8, BTN.SELECT],
      [12, BTN.UP], [13, BTN.DOWN], [14, BTN.LEFT], [15, BTN.RIGHT],
    ];
    for (const [index, btn] of map) {
      const value = pad.buttons[index] ? pad.buttons[index].pressed : false;
      const was = gamepadState[index] || false;
      if (value && !was) press(btn);
      if (!value && was) release(btn);
      gamepadState[index] = value;
    }
    // Also honour the d-pad axes for pads without buttons.
    const [ax = 0, ay = 0] = pad.axes || [];
    if (ax < -0.5) press(BTN.LEFT);
    else if (pressed.has(BTN.LEFT) && ax >= -0.5) release(BTN.LEFT);
    if (ax > 0.5) press(BTN.RIGHT);
    else if (pressed.has(BTN.RIGHT) && ax <= 0.5) release(BTN.RIGHT);
    if (ay < -0.5) press(BTN.UP);
    else if (pressed.has(BTN.UP) && ay >= -0.5) release(BTN.UP);
    if (ay > 0.5) press(BTN.DOWN);
    else if (pressed.has(BTN.DOWN) && ay <= 0.5) release(BTN.DOWN);
  }

  // ------------------------------------------------------------- public ----
  return {
    async load(romBytes, { sram = null, saveSram = null } = {}) {
      const bytes =
        romBytes instanceof Uint8Array ? romBytes : new Uint8Array(romBytes);
      // jsnes accepts both a binary string and a typed array; the typed array
      // path avoids a second copy of a multi-MB file.
      nes.loadROM(bytes);
      sramSaver = saveSram;
      if (sram) loadSRAM(sram);
      screen.resize();
      screen.setFrame(nes.ppu.buffer);
      screen.draw();
    },

    async start() {
      await audio.start(nes.opts.sampleRate);
      if (!running) {
        running = true;
        last = 0;
        acc = 0;
        raf = requestAnimationFrame(tick);
      }
      if (!gpRaf) gpRaf = requestAnimationFrame(pollGamepad);
    },

    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },

    resume() {
      this.start();
    },

    stop() {
      running = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(gpRaf);
      gpRaf = 0;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },

    reset() {
      nes.reset();
    },

    setMuted(m) {
      audio.setMuted(m);
    },

    setKeys(keys) {
      bind(keys);
    },

    screenshot() {
      return screen.screenshot();
    },

    // ---- save states (memory only; the app decides where to persist) ----
    saveState() {
      return JSON.stringify(nes.toJSON());
    },

    loadState(json) {
      nes.fromJSON(typeof json === "string" ? JSON.parse(json) : json);
    },

    get fps() {
      return nes.getFPS();
    },

    get romInfo() {
      const rom = nes.rom;
      if (!rom) return null;
      return {
        mapper: rom.mapperType,
        supported: rom.mapperSupported(),
        prg: rom.romCount,
        chr: rom.vromCount,
        battery: rom.batteryRam,
      };
    },

    get SRAM() {
      return nes.rom && nes.rom.batteryRam ? readSRAM() : null;
    },

    press,
    release,
    BTN,
    screen,
  };
}

// Explicit global assignment (works for <script> tags and for test harnesses
// that evaluate the bundle in a sandboxed scope).
const api = { createPlayer, Screen, Audio, BTN, computeScreenSize };
if (typeof window !== "undefined") window.GunNacEmulator = api;
globalThis.GunNacEmulator = api;
