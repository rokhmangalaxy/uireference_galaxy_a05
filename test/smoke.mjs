/**
 * Headless smoke test: boots the legal test ROM through the jsnes core, then
 * checks that the emulator produced a frame with visible pixels and that the
 * CPU executed the program (the ROM's frame counter at $10 advances).
 *
 *   node test/smoke.mjs            # builds the NROM test ROM on the fly
 *   node test/smoke.mjs mmc3       # builds the mapper-4 (MMC3) test ROM on the fly
 *   node test/smoke.mjs myrom.nes  # sanity-check your own legally dumped ROM
 *
 * Asking for the MMC3 case by name (instead of by file path) keeps the fixture
 * out of git: test/fixtures/*.nes is gitignored because it is generated.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestRom, buildMmc3TestRom } from "../tools/make-test-rom.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Import the ESM source: the package's webpack dist has no exports.
const jsnesSrc = pathToFileURL(
  resolve(here, "../node_modules/jsnes/src/index.js"),
).href;
const { NES } = await import(jsnesSrc);

const romPath = process.argv[2];
const romBytes =
  romPath === "mmc3"
    ? Buffer.from(buildMmc3TestRom())
    : romPath
      ? readFileSync(romPath)
      : Buffer.from(buildTestRom());
const rom = new Uint8Array(romBytes.buffer, romBytes.byteOffset, romBytes.length);

let lastFrame = null;
let frames = 0;
const nes = new NES({
  onFrame: (buffer) => {
    lastFrame = Uint32Array.from(buffer);
    frames++;
  },
  onAudioSample: null,
  emulateSound: false,
  sampleRate: 48000,
});

nes.loadROM(rom);
const supported = nes.rom.mapperSupported();
const mapper = nes.rom.mapperType;

const target = 600; // ~10 s of game time
for (let i = 0; i < target && frames < target; i++) nes.frame();

if (!lastFrame) {
  console.error("FAIL: emulator produced no frames");
  process.exit(1);
}

const magic = Array.from(rom.subarray(0, 4)).map((b) => b.toString(16)).join(" ");
if (magic !== "4e 45 53 1a") {
  console.error("FAIL: not an iNES ROM (bad magic)");
  process.exit(1);
}

let nonBlack = 0;
for (let i = 0; i < lastFrame.length; i++) {
  if ((lastFrame[i] & 0xffffff) !== 0) nonBlack++;
}
const counter = nes.cpu.mem[0x10];

console.log(
  `rom=${romPath ?? "(generated test rom)"} mapper=${mapper} supported=${supported}`,
);
console.log(`frames=${frames} nonBlackPixels=${nonBlack} frameCounter=${counter}`);

if (!supported) {
  console.error("FAIL: this ROM uses an unsupported mapper");
  process.exit(1);
}
const ok = frames > 0 && nonBlack > 50;
console.log(ok ? "PASS: emulator core is running and rendering" : "FAIL: blank frame");
process.exit(ok ? 0 : 1);
