/**
 * Layout regression test.
 *
 * The first APK that actually ran a game had a broken layout: the 256x240
 * canvas was sized from the stage height only, so it overflowed narrow and
 * landscape viewports and the page became horizontally scrollable ("layar
 * overflow ke samping kiri, harus scroll kiri"). In landscape the pads sat in
 * a 3-column grid whose middle "1fr" column pushed B/A into the centre of the
 * screen.
 *
 * jsdom cannot lay out CSS, so this test checks the two things that caused the
 * bug and that we can verify deterministically:
 *
 *   1. computeScreenSize() never returns a box larger than the room given to
 *      it -- that is the exact invariant the old code broke (it forced a
 *      minimum 1x scale).
 *   2. index.html carries the guards that stop a WebView from panning
 *      sideways, and the landscape rules no longer create a middle column.
 *
 *   node test/layout.test.mjs
 */
import { readFileSync } from "node:fs";
import { computeScreenSize } from "../src/emulator.js";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

// ---------------------------------------------------------------- sizing ----
const boxes = [
  // label,                       availW, availH, in portrait phone / landscape
  ["portrait 412x600 stage", 388, 600],
  ["portrait 360x420 stage", 336, 420],
  ["landscape 915x300 stage", 891, 300],
  ["landscape 640x200 stage", 616, 200],
  ["landscape 915x150 stage", 891, 150],
  ["tiny 200x300", 200, 300],
  ["single pixel", 1, 1],
  ["fractional 383.7x359.4", 383.7, 359.4],
  ["desktop 1120x700", 1096, 700],
];
for (const [label, w, h] of boxes) {
  const s = computeScreenSize(w, h);
  check(
    `${label}: ${s.width}x${s.height} fits in ${w}x${h}`,
    s.width <= w + 0.001 && s.height <= h + 0.001,
    `overflowed by ${Math.round(s.width - w)}x${Math.round(s.height - h)}`,
  );
  // A 1x1 box is the one case where the aspect cannot be kept.
  if (w >= 4 && h >= 4) {
    check(
      `${label}: keeps the 256:240 aspect`,
      Math.abs(s.width / s.height - 256 / 240) < 0.02,
      `got ${(s.width / s.height).toFixed(3)}`,
    );
  }
  check(
    `${label}: never degenerates to 0`,
    s.width >= 1 && s.height >= 1,
    `${s.width}x${s.height}`,
  );
}

// Big screens get whole-pixel upscales so the picture stays crisp.
const desktop = computeScreenSize(1096, 700);
check("desktop scale is integral", desktop.width % 256 === 0 || desktop.width === 1024, `${desktop.width}`);

// The reported symptom: tall-ish stage, narrow-ish width. Old code used the
// height only and produced a canvas wider than the phone.
const portrait = computeScreenSize(388, 620);
check("portrait canvas is narrower than the stage", portrait.width <= 388, `${portrait.width}`);

// Landscape: short stage must shrink the canvas, not overflow it.
const landscape = computeScreenSize(891, 260);
check("landscape canvas is shorter than the stage", landscape.height <= 260, `${landscape.height}`);

// ---------------------------------------------------------------- markup ----
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

check("html clips sideways overflow", /html\s*\{[^}]*overflow-x:\s*hidden/.test(html));
check("body clips sideways overflow", /body\s*\{[^}]*overflow-x:\s*hidden/s.test(html));
check("stage rows use minmax(0,1fr)", /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/.test(html));
check("canvas is capped by its container", /#screen\s*\{[^}]*max-width:\s*100%/s.test(html));
check("canvas is capped vertically", /#screen\s*\{[^}]*max-height:\s*100%/s.test(html));

// The landscape controls must not reintroduce a middle column for the pads.
const landscapeBlock = html.match(
  /@media \(orientation: landscape\)[^{]*\{[\s\S]*?\n  \}\n/,
)?.[0] ?? "";
check("landscape media query exists", landscapeBlock.length > 0);
check(
  "landscape pads are not in a 3-column grid",
  !/grid-template-columns:\s*auto\s+1fr\s+auto/.test(landscapeBlock),
  "the middle 1fr column was what put B/A in the centre",
);
check(
  "landscape pads are anchored to the edges",
  /justify-content:\s*space-between/.test(landscapeBlock),
);

// Controls in the normal (portrait) layout keep the D-pad left / buttons right.
check(
  "portrait controls keep the D-pad left, buttons right",
  /\.controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s.test(html),
);
// The page must never size its column from the canvas's min-content.
check(
  "shell column cannot grow past the viewport",
  /\.shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s.test(html),
);

// ------------------------------------------------------------------ done ----
if (failures) {
  console.log(`\nFAILED: ${failures} layout check(s)`);
  process.exit(1);
}
console.log("\nPASS: layout fits phone portrait, landscape and desktop");
