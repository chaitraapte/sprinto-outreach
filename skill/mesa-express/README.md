# MESA Express

Give Claude a brief, and it builds the app with you. It explains what you're building, asks 4 to 5 quick questions, asks for your notes and design inspiration, then plans, builds and tests it.

## Install

**Claude Code (best: it can build, run and test the app)**
Unzip this folder into `~/.claude/skills/`, so you have `~/.claude/skills/mesa-express/SKILL.md`. Start a new session.

**Claude app or claude.ai (planning and design, plus code you copy out)**
Settings → Capabilities → Skills → upload `mesa-express.zip`. Turn it on.

## Use

1. Open a session in an empty project folder.
2. Paste your brief and say **"MESA Express"**.
3. Answer the questions (or say "defaults are fine"), share notes and inspiration, pick design A, B or C.
4. It builds phase by phase. Say **"add motion"**, **"change the look"** or **"where are we"** any time.

## Needs (all free)

- Node.js, for the colour checker, the palette picker and the design checker (`npx`).
- Everything else is fetched when needed; no accounts or paid tools.

Palette and font data in `library/taste/` is from taste-skill by Leonxlnx (MIT licence, see `library/taste/LICENSE`).
