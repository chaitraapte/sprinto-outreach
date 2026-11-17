#!/usr/bin/env node
// WCAG 2.1 contrast checker. Usage:
//   node contrast.mjs "#111111" "#F3EEE3"            -> one pair
//   node contrast.mjs "#111111,#F3EEE3" "#FFF,#2A3BF5" -> several pairs
// Prints the ratio and whether it passes for body text (4.5), large text/icons (3.0).

function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function ratio(a, b) {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node contrast.mjs "<text hex>[,<text hex>...]" "<background hex>[,...]"');
  process.exit(1);
}
const fgs = args[0].split(",");
const bgs = args[1].split(",");
if (fgs.length !== bgs.length) {
  console.error("Give the same number of text and background colours.");
  process.exit(1);
}
let failed = false;
fgs.forEach((fg, i) => {
  const r = ratio(fg, bgs[i]);
  const body = r >= 4.5 ? "PASS" : "FAIL";
  const large = r >= 3 ? "PASS" : "FAIL";
  if (body === "FAIL") failed = true;
  console.log(`${fg.trim()} on ${bgs[i].trim()}: ${r.toFixed(2)}:1  body text ${body}  large text/icons ${large}`);
});
process.exit(failed ? 2 : 0);
