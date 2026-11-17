# Motion sources

Free places to get motion and animated components. Used by the design step and "add motion" in SKILL.md. Always check the licence on the component page at the time of use; terms change.

**Free only.** Never suggest a paid library, a paid "Pro" tier, or a component behind a paywall. If a source turns out to be paid, remove it from this file and offer a free alternative instead.

## How to add a source

When the user says "save this motion" or shares a motion site, add an entry: name, link, what it is good for, how components install, licence and attribution, stack, date added.

---

## Animated component libraries

### Skiper UI
- **Link:** https://skiper-ui.com
- **Good for:** hero sections, pricing pages, scroll effects, interactive components with a product feel.
- **Install:** shadcn CLI, for example `npx shadcn add @skiper-ui/skiper37` (each component page shows its command).
- **Stack:** React / Next.js, Tailwind, shadcn/ui.
- **Licence:** free components may be used and changed in personal and commercial projects, **but the free version requires attribution to Skiper UI**. The paid Pro version does not. Add the credit (for example in the footer) whenever a free component is used.

### Vengeance UI
- **Link:** https://www.vengenceui.com (note the spelling: "vengence")
- **Good for:** modern animated blocks: animated buttons, hero sections, perspective grids, light rays, interactive book effects.
- **Install:** shadcn CLI pointed at its registry, for example `npx shadcn@latest add https://www.vengenceui.com/r/animated-rays.json`. Code is copied into the project; no runtime package.
- **Stack:** React / Next.js, Tailwind, Radix UI.
- **Licence:** free to use; confirm on the site.

## Free replacements for Animmaster (removed: it is paid)

Animmaster Lib (animmasterlib.dev) was removed on 10 Nov 2026 because it is paid and has no stated licence. These free sources cover the same ground: scroll, text, hover, mouse, background and WebGL effects.

### React Bits
- **Link:** https://reactbits.dev (use the free library only; React Bits **Pro** at pro.reactbits.dev is paid, never suggest it)
- **Good for:** text animations (split, blur, scramble), scroll reveals, mouse and cursor effects, animated backgrounds (aurora, particles, WebGL), interactive cards.
- **Install:** copy the code from the component page, or its shadcn/jsrepo command.
- **Stack:** React, with plain CSS or Tailwind versions.
- **Licence:** MIT + Commons Clause per its GitHub repo: free for personal and commercial projects; you just cannot resell the components themselves. No attribution required.

### GSAP (with ScrollTrigger, SplitText and all plugins)
- **Link:** https://gsap.com
- **Good for:** scroll-driven animation, pinned sections, text splitting, page transitions, timelines: the engine behind most "expensive-looking" sites.
- **Install:** `npm install gsap` (plus `@gsap/react` for the `useGSAP` hook). All plugins are in the main package.
- **Licence:** 100% free since Webflow made it free in 2025, including former paid plugins and commercial use (standard "no charge" licence).

### Magic UI
- **Link:** https://magicui.design (use the free components; Magic UI Pro is paid, never suggest it)
- **Good for:** animated landing-page pieces: marquees, number tickers, animated beams, shimmer buttons, bento grids.
- **Install:** shadcn CLI, command on each component page.
- **Stack:** React / Next.js, Tailwind, Motion.
- **Licence:** open source (MIT per its GitHub repo); check the repo before commercial use.

## Community library

### 21st.dev
- **Link:** https://21st.dev
- **Good for:** a large community library of React + Tailwind components, many animated; good for finding several options for one moment quickly.
- **Install:** each component page gives a shadcn-style install command or code to copy.
- **Licence:** varies by author; check each component.

## Rules when using any source

- Restyle with DESIGN.md tokens; never keep the demo's colours.
- Add a `prefers-reduced-motion` fallback.
- Interface feedback 150–300 ms; long or WebGL motion only for one hero moment, and only if the phone test stays smooth.
- Note the licence and any attribution in DESIGN.md's Motion section.
