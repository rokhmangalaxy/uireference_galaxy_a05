// Build script: bundles jsnes + the app into two files under ./dist and the
// Android asset folder, then copies the static shell. Everything is local: the
// resulting app never touches the network.

import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/roms", { recursive: true });

// 1. Emulator bundle (jsnes core + our glue code).
await build({
  entryPoints: ["src/emulator.js"],
  bundle: true,
  format: "iife",
  outfile: "dist/emulator.js",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  banner: {
    js: `/*! Gun Nac Offline Player — emulator core.
 * jsnes (https://github.com/bfirsh/jsnes) is Apache-2.0 licensed.
 * This build contains no game data: load a ROM you are allowed to use.
 * Replace the notice above if you re-license your own changes. */`,
  },
});

// 2. App shell + PWA glue.
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "iife",
  outfile: "dist/app.js",
  target: ["es2020"],
  minify: true,
});

// 3. Static files.
for (const f of ["index.html", "manifest.webmanifest", "sw.js"]) {
  cpSync(f, `dist/${f}`);
}
cpSync("icons", "dist/icons", { recursive: true });
if (existsSync("assets")) cpSync("assets", "dist/assets", { recursive: true });
// ROMs are user-supplied and stay out of git; copy whatever is in roms/ on
// build, plus the generated test ROM so "Test ROM" works out of the box.
if (existsSync("roms")) {
  cpSync("roms", "dist/roms", {
    recursive: true,
    filter: (src) => !src.endsWith("README.md"),
  });
}
if (existsSync("test/fixtures/test.nes")) {
  cpSync("test/fixtures/test.nes", "dist/roms/test.nes");
}

// 4. A build stamp so the service worker cache name changes per deploy.
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const sw = readFileSync("dist/sw.js", "utf8").replace("__BUILD__", stamp);
writeFileSync("dist/sw.js", sw);

// 5. Mirror into the Android project so the WebView can load file:///android_asset.
const assetDir = "android/app/src/main/assets/web";
if (existsSync("android/app")) {
  rmSync(assetDir, { recursive: true, force: true });
  mkdirSync(assetDir, { recursive: true });
  cpSync("dist", assetDir, { recursive: true });
}

// 6. Optional single-file build for easy sharing (double-click to play).
const html = readFileSync("dist/index.html", "utf8");
const inline = html
  .replace(
    '<script src="app.js"></script>',
    `<script>\n${readFileSync("dist/app.js", "utf8")}\n</script>`,
  )
  .replace(
    '<script src="emulator.js"></script>',
    `<script>\n${readFileSync("dist/emulator.js", "utf8")}\n</script>`,
  );
writeFileSync("dist/gun-nac-offline.html", inline);

console.log(`Built dist/ (v${pkg.version}) — stamp ${stamp}`);
try {
  execFileSync("du", ["-sh", "dist"], { stdio: "inherit" });
} catch {}
