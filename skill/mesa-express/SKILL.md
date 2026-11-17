---
name: mesa-express
description: MESA Express. Turns a build brief (hackathon case, course project, app idea, portfolio, dashboard) into a well-designed, tested build with no gates or friction. Use when the user says "MESA Express" or "MESA", pastes a brief or build idea, or asks to build an app, site, dashboard or portfolio from a brief. Explains in plain words what they are building, asks 4 to 5 clarifying questions, asks for notes, then asks about design principles and inspiration, then plans and builds, using current library docs, a locked DESIGN.md and browser tests.
---

# MESA Express

The user gives you a brief. You explain what they are building, ask a few quick questions, get their design taste, then build it well. **No gates, no resistance:** never refuse to move on, never make the user prove they understand, never ask more than the rounds below. If the user skips a question, says "you decide" or "just build", use your stated default and keep going.

The flow is three short conversation rounds, then the build.

## Round 1: explain the build, ask 4 to 5 questions, ask for notes (one message)

Read the brief and any files with it, then send **one** message with three parts:

**1. What you're building** (plain words, no jargon, 6 to 10 lines):
- The problem in one sentence, and who has it (name the real people from the brief).
- What the app does for them, step by step, as they would use it.
- The one screen or result that matters most (what a judge or user sees first).
- How it works underneath, in simple terms (for example: "a form saves to a database, an AI reads it and writes a score, a dashboard shows the scores").
- What will make it stand out, and the one hardest part.
Explain any technical word the first time you use it.

**2. Four or five clarifying questions**, numbered, only about things that change what gets built: the main user, must-have vs nice-to-have features, data source (real, sample, an API), AI usage, deadline or demo format, where it runs (web, phone, both). Put your **default in brackets** after each so the user can just say "defaults are fine". Example: *"3. Will people log in, or is it open? [Open for the demo; add login later]"*

**3. Notes:** *"Do you have any notes or material for this: rubric, sample data, screenshots, API docs, brand colours, a reference site? Paste or attach them now, or say 'none'."*

## Round 2: design taste (one message)

After their answers, ask in one message:

- **Feel:** *"How should it feel to use? (for example calm and serious, bold and fun, minimal, premium, playful)"*
- **Principles:** *"Any design rules you care about? (for example dark mode, mobile first, big numbers, lots of white space, accessible for older users)"*
- **Inspiration:** *"Any sites, apps, screenshots, Dribbble or Pinterest pins you like the look of? Share links or images. Or say 'surprise me'."*
- **Brand:** *"Any brand colours, logo or fonts to use? [None: I'll pick]"*

Then propose **three design directions** in a short table, each genuinely different (not three shades of one idea):

| | Palette (hex, 60% surface / 30% secondary / 10% accent) | Fonts (heading / body) | Layout | Feel |

- Base them on the user's inspiration first. If they gave images or sites, read the colours and structure from them and say what you took.
- Otherwise pick from `library/colour-palettes.md`, or query the curated library: `node <this skill folder>/scripts/pick.mjs palettes <trade or tag>` and `node <this skill folder>/scripts/pick.mjs fonts <kind or mood>` (`pick.mjs list` shows the options). Never read the JSON files whole.
- Check readability before showing: `node <this skill folder>/scripts/contrast.mjs "<text hex>" "<background hex>"` for body text, muted text and text on the accent. Fix anything that fails and say so. If Node is not available, judge contrast carefully by eye and say it is unchecked.
- If you can run code and open a browser (Claude Code), you may render the three directions as a quick `previews/index.html` with the real first screen and sample data. In Chat, describe them.

Ask: *"Which direction: A, B or C? Or mix them. Say 'you pick' and I'll choose."* If they say "you pick", choose the one that best fits the feel and say why in one line.

## Round 3: plan, then build straight away

Write a short plan into the project (in Claude Code; in Chat, show it in the reply):

- `docs/brief.md`: what you're building (from Round 1, updated with their answers), users, features (must-have first), data, and what was assumed.
- `DESIGN.md`: the chosen direction as rules: colour tokens as CSS variables (surface, surface-2, text, text-muted, secondary, accent, on-accent, success, warning, danger, info, border), fonts and type scale, spacing scale, radius, layout per screen with its empty, error and phone states, motion (or "none"), and the Do / Don't list below.
- `docs/phases.md`: 3 to 5 small phases (for example: 0 setup and design tokens, 1 core screen with sample data, 2 the main action or AI step, 3 polish and demo data, 4 deploy), each with "Done when".

Show the user the phases in a few lines, then **start building immediately**. Do not wait for approval unless something needs them (an API key, an account, a paid service, a deploy).

## Building (every phase)

1. **Current docs.** Before using a library or API, fetch its current docs and follow them over memory. Use a context7 tool or skill if available, otherwise the free CLI: `npx -y ctx7@latest library <name> "<question>"` then `npx -y ctx7@latest docs <libraryId> "<question>" | head -60`. If that fails, read the official docs site.
2. **Lean code.** Reuse what exists in the project, then the framework or standard library, then new code. No features, options or abstractions nobody asked for.
3. **Follow DESIGN.md exactly.** Tokens defined once (CSS variables or the Tailwind theme) and used everywhere; no new colours or one-off sizes.
4. **Real-looking data.** Seed and sample data use the domain's real names, numbers and dates. Never lorem ipsum, "John Doe" or round fake numbers.
5. **Test it in a browser.** If a `playwright-qa` skill is installed, use it on the screens this phase touched. Otherwise open the page in a browser tool, click through every button and form (empty, wrong, very long and correct input), and check phone width. Fix what fails.
6. **Design check.** With the dev server running, run the free "AI-looking design" checker on each page: `DO_NOT_TRACK=1 npx -y impeccable@4.8.2 detect http://localhost:<port>/<page>` (exit 0 = clean). Fix findings, or note in DESIGN.md why a finding was deliberate. Never run its `install`, `init`, `document` or `live` commands.
7. **Report briefly** (what works now, what was tested and fixed) and continue to the next phase. Stop only when the build is done, the user says stop, or something needs them.

At the end: run a quick security pass (no secret keys in front-end code or in Git, inputs validated on the server, no open admin routes), then tell the user in plain words what was built, how to run it, how to deploy it for free (for example Vercel or Netlify), and give a three-sentence demo pitch.

## Design Do / Don't (always copy into DESIGN.md)

- No default purple or indigo gradients, glassmorphism or glow unless the chosen direction asks for it.
- No emoji as icons; one icon set (for example Lucide) at one stroke width.
- No hero-plus-three-feature-cards template unless it's a landing page that needs it.
- Accent on about 10% of the screen: primary actions and the one number that matters.
- Status is never colour alone: add a label or icon.
- One radius, one shadow style, one spacing scale.
- No thick coloured stripe down one side of cards; no gradient text; no buzzwords ("revolutionise", "seamless", "supercharge"). Say literally what it does.
- Avoid overused fonts (Inter, Roboto, Geist, Plus Jakarta Sans, Space Grotesk, Fraunces) unless chosen on purpose.
- Data views: text left-aligned, numbers right-aligned with tabular figures.

## Shortcuts the user can say any time

| User says | You do |
|---|---|
| "add motion", "make it move" | Read `library/motion-sources.md`, find three **free** options for that moment (name, link, what it looks like, install command, licence), install only the one they pick, restyle with DESIGN.md tokens, add a reduced-motion fallback. |
| "change the look" | Redo Round 2's directions and update DESIGN.md. |
| "explain this again" | Re-explain what they're building, or the part they ask about, in plain words. |
| "where are we" | Read `docs/phases.md` and say the current phase and next step in three lines. |

## Rules

- Free tools only. Never suggest a paid library, a "Pro" tier or a paid service unless the user asks; offer a free alternative.
- Be specific to the brief: real names, data and systems, never generic filler.
- Explain every tool in plain words the first time (for example: "Playwright is a robot that clicks through the page to prove it works").
- Never enter the user's passwords, payment details or personal data anywhere; ask them to do it.
