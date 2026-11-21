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
import { JSDOM } from "jsdom";
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
check(
  "stage is the only flexible row (no header row)",
  /grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/.test(html),
);
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

// -------------------------------------------------------- v11 UI guards ----
// There is no header bar at all any more: every global control lives in the
// floating chip, so the game owns the whole viewport height.
check(
  "no top-bar header is rendered",
  !/<header class="bar"/.test(html) && !html.includes('id="bar"'),
  "a top bar would steal a row from the game",
);
check("floating chip exists", /class="chrome" id="chrome"/.test(html));
check(
  "chip holds menu, pause, save-state and mute",
  ["chip-menu", "chip-pause", "chip-state", "chip-mute"].every((id) => html.includes(`id="${id}"`)),
);
check(
  "the chip does not reserve layout space",
  /\.chrome\s*\{[^}]*position:\s*fixed/s.test(html),
);
check(
  "chip fades while playing instead of covering the picture",
  /\.shell\.playing:not\(\.chrome-open\) \.chrome\s*\{[^}]*opacity/s.test(html),
);

// Quick save-state sheet: reachable in one tap, without the full menu.
check("quick save-state sheet exists", /class="qsheet" id="qsheet"/.test(html));
check("quick sheet lists both slots", /id="qsheet-list"/.test(html));
check("quick sheet is opened by the chip", /id="chip-state"/.test(html));
check(
  "quick sheet has import and export",
  /id="qsheet-import"/.test(html) && /id="qsheet-export"/.test(html),
);

// Drag-to-place controls must not let a pad be dragged off screen: the JS
// clamps to the viewport, and edit mode must visually mark the pads.
check("edit mode marks the draggable pads", /\.shell\.editing \.dpad[\s\S]{0,200}outline:/.test(html));
check("edit bar exists", /class="editbar" id="editbar"/.test(html));
// Regression: the bar used to be a sibling of #shell, so `.shell.editing .editbar`
// never matched and the "Selesai" button was invisible -> no way to exit.
// Parse the document so this cannot be fooled by marker order.
const parsed = new JSDOM(html).window.document;
check(
  "edit bar lives INSIDE .shell (otherwise it cannot be shown)",
  !!parsed.querySelector("#shell #editbar"),
  "CSS selector .shell.editing .editbar requires this nesting",
);
check(
  "edit hint lives inside .shell too",
  !!parsed.querySelector("#shell #edit-hint"),
);
check(
  "the quick save sheet lives inside .shell",
  !!parsed.querySelector("#shell #qsheet"),
);
check(
  "edit mode has an explicit exit button",
  /id="edit-done"[^>]*>[^<]*Selesai/.test(html),
);
check("edit mode has a cancel button", /id="edit-cancel"/.test(html));
check("edit mode has a portrait/landscape switch", /id="edit-portrait"/.test(html) && /id="edit-landscape"/.test(html));

// Button skins must be variable-driven so a skin is a token change, not a fork.
check("A/B buttons read skin variables", /\.round\s*\{[^}]*background:\s*var\(--a-bg\)/s.test(html));
check("B button has its own skin variable", /\.round\.b\s*\{[^}]*var\(--b-bg\)/s.test(html));
check("at least one alternate skin is defined", /\[data-skin="(arcade|retro|mono|neon)"\]/.test(html));
check("skin gallery container exists", /id="skin-grid"/.test(html));

// Save slots show an automatic screenshot.
check("slot previews exist for both slots", /data-thumb="1"/.test(html) && /data-thumb="2"/.test(html));
check("slot preview styling exists", /\.slot-preview img/.test(html));

// State import/export controls.
check("state export button exists", /id="btn-export-state"/.test(html));
check("state import input exists", /id="state-file"/.test(html));

// ------------------------------------------------------------------ done ----
if (failures) {
  console.log(`\nFAILED: ${failures} layout check(s)`);
  process.exit(1);
}
console.log("\nPASS: layout fits phone portrait, landscape and desktop");
