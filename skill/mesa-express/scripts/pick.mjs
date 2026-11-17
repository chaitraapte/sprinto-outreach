#!/usr/bin/env node
// Prints a short list of matching palettes and font pairings from library/taste/
// so the skill never has to read the whole JSON files.
//
//   node pick.mjs palettes <trade|tag>[,<trade|tag>...]   e.g. palettes saas,clinic
//   node pick.mjs fonts <kind|mood>[,<kind|mood>...]       e.g. fonts software,calm
//   node pick.mjs list                                      shows the trades, tags, kinds and moods
//
// Palette and font data: taste-skill by Leonxlnx (MIT), see library/taste/LICENSE.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "library", "taste");
const palettes = JSON.parse(readFileSync(join(dir, "palettes.json"), "utf8"));
const fonts = JSON.parse(readFileSync(join(dir, "type.json"), "utf8"));
const [cmd, arg = ""] = process.argv.slice(2);
const wants = arg.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const uniq = (a) => [...new Set(a)].sort().join(", ");

if (cmd === "list") {
  console.log("Palette trades:", uniq(palettes.flatMap((p) => p.trades || [])));
  console.log("Palette tags:  ", uniq(palettes.flatMap((p) => p.tags || [])));
  console.log("Font kinds:    ", uniq(fonts.flatMap((f) => Object.keys(f.kinds || {}))));
  console.log("Font moods:    ", uniq(fonts.flatMap((f) => f.moods || [])));
} else if (cmd === "palettes") {
  const hits = palettes.filter((p) => !wants.length || wants.some((w) => (p.trades || []).includes(w) || (p.tags || []).includes(w)));
  hits.slice(0, 12).forEach((p) => {
    console.log(`- ${p.name} [${p.id}] (${(p.tags || []).join("/")}) bg ${p.bg} surface ${p.surface} ink ${p.ink} muted ${p.muted} accent ${p.accent} on-accent ${p.accentInk}`);
    if (p.note) console.log(`  ${p.note.slice(0, 220)}${p.note.length > 220 ? "…" : ""}`);
  });
  console.log(`${hits.length} match(es)${hits.length > 12 ? ", first 12 shown" : ""}.`);
} else if (cmd === "fonts") {
  const score = (f) => wants.reduce((s, w) => s + ((f.kinds || {})[w] || 0) + ((f.moods || []).includes(w) ? 2 : 0), 0);
  const hits = fonts.map((f) => [score(f), f]).filter(([s]) => !wants.length || s > 0).sort((a, b) => b[0] - a[0]);
  hits.slice(0, 10).forEach(([, f]) => {
    const d = f.display || {}, t = f.text || {}, m = f.mono || {};
    console.log(`- ${f.id}: display ${d.family} ${JSON.stringify(d.w || [])}, text ${t.family || d.family}, mono ${m.family || "-"} (${(f.moods || []).join("/")})${f.suits ? " — " + String(f.suits).slice(0, 120) : ""}`);
  });
  console.log(`${hits.length} match(es)${hits.length > 10 ? ", first 10 shown" : ""}.`);
} else {
  console.error("Usage: node pick.mjs palettes <trade|tag,...> | fonts <kind|mood,...> | list");
  process.exit(1);
}
