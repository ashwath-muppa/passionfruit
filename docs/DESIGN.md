# Passionfruit — Design System

> Companion to the codebase. Keep this file in sync with `tailwind.config.ts` and
> `components/`. It defines the visual language for the three core surfaces shipped in
> the design exploration (`Passionfruit Directions.dc.html`): the kid-facing **Project
> Paths** and **Weekly Plan**, and the **Parent Dashboard**.

---

## 1. Principles

1. **Warm, not corporate.** This is a mentor relationship, not a SaaS tool. Cream paper,
   soft cards, rounded geometry, a single confident accent. No cold grays, no harsh blue.
2. **The AI is a person, not a chatbot.** Every AI-authored moment is framed as *a note
   from a named mentor* ("Sol"), set in the serif voice, signed and warm. Never a bubble
   stream, never "As an AI…", never a typing cursor. See §6.
3. **Two audiences, one family.** The kid surface is first-person, encouraging, momentum-
   driven ("You're right on pace 🎉"). The parent surface is calm, legible, and reassuring
   — substance over résumé. Same palette, different density.
4. **The learner graph is the hero.** It is the moat made visible: a living constellation
   of interests → skills → projects that visibly grows. Give it room; never bury it.
5. **Earn every element.** No filler stats, no decorative icons. If a card has nothing to
   say this week, it says so plainly.

---

## 2. Direction — **A · Warm Paper** (chosen)

The design is locked to **Direction A**: editorial serif, cream paper, a single confident
coral. It balances kid-warmth and parent-trust and is the source of truth for everything
below. Directions B (Bright & Playful) and C (Calm Premium) were explored and set aside;
they remain in `Passionfruit Directions.dc.html` for reference only and are not part of
the spec.

| Theme | Feel | Display font | Accent | Status |
|---|---|---|---|---|
| **A · Warm Paper** | Thoughtful letter, editorial | Newsreader (serif) | Coral `#E8694A` | **Chosen** |
| B · Bright & Playful | Candy energy, kid-first | Bricolage Grotesque | Magenta `#D6437F` | Set aside |
| C · Calm Premium | Quiet, restrained, premium | Newsreader (serif) | Terracotta `#C0563A` | Set aside |

All tokens below are **Direction A** and are final.

---

## 3. Color tokens

```
/* Surface */
--paper        #FBF6EE   /* app background */
--card         #FFFFFF   /* cards, sheets */
--paper-sunk   #F4EDE2   /* track / inset / muted chip bg */
--line         #EFE5D6   /* hairline borders */
--line-soft    #EBDFCF   /* timeline rails, graph links */

/* Ink */
--ink          #2C2420   /* headings */
--ink-body     #3A2D27   /* body */
--ink-muted    #6F6258   /* secondary text */
--ink-faint    #A0917F   /* captions, metadata */

/* Accent (passionfruit) */
--accent       #E8694A   /* primary coral — CTAs, active, brand */
--accent-deep  #D4533A   /* gradient end, pressed */
--accent-ink   #C2492C   /* accent text on light */
--accent-wash  #FCE9E0   /* tinted chip / callout bg */
--accent-line  #F4D9CC   /* tinted border */

/* Secondary hues (share chroma; vary hue) — categorical only, never decorative */
--gold         #F2B23E   /* yellow seeds — secondary accent, avatars */
--berry        #D87BA0   /* magenta — third category */
```

Skill bars and graph nodes are the **only** places multiple hues appear together, and
each hue is a stable category (CS = coral, Biology = gold, Business = berry). Keep the
mapping consistent across the product.

### Tailwind

```ts
// tailwind.config.ts → theme.extend.colors
passionfruit: {
  paper: '#FBF6EE', card: '#FFFFFF', sunk: '#F4EDE2',
  line: '#EFE5D6', lineSoft: '#EBDFCF',
  ink: '#2C2420', body: '#3A2D27', muted: '#6F6258', faint: '#A0917F',
  accent: '#E8694A', accentDeep: '#D4533A', accentInk: '#C2492C',
  wash: '#FCE9E0', accentLine: '#F4D9CC',
  gold: '#F2B23E', berry: '#D87BA0',
}
```

---

## 4. Typography

```
--font-display : 'Newsreader', Georgia, serif;     /* headings, mentor voice, titles */
--font-sans    : 'Hanken Grotesk', system-ui, sans-serif;  /* UI, body, labels */
```

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Screen title | Newsreader 500/600 | 21–22px | Card & project titles |
| Mentor voice | Newsreader 500 | 15–18px / 1.42 | Quoted, warm; accent word inside |
| Body | Hanken Grotesk 400 | 13px / 1.45 | |
| Eyebrow / label | Hanken Grotesk 700 | 10–11px, `letter-spacing:1px`, UPPERCASE | `--ink-faint` |
| Metadata | Hanken Grotesk 500 | 11–12px | `--ink-faint` |

Rule: **display serif carries warmth and personality; sans carries the interface.** Never
set body copy in the serif beyond the mentor voice.

---

## 5. Primitives

- **Radius:** cards 18–22px · phone screen 36px · chips/pills 20px · skill bars 8px · graph nodes 9px (rounded square) or 50% (people).
- **Card:** `bg --card; border:1px solid --line; border-radius:18px; padding:17px`.
- **Elevated/sheet shadow:** `0 8px 22px -16px rgba(90,60,40,.4)`.
- **Frame shadow (phone/dashboard):** `0 30px 60px -28px rgba(60,40,30,.45)`.
- **Chip:** `--paper-sunk` bg, `--ink-muted` text, 5×10px, pill. Accent chip uses `--accent-wash` / `--accent-ink`.
- **Selected state:** 1.5px `--accent` border + optional `--accent-wash` fill + `★ best fit`.
- **Spacing scale:** 7 · 11 · 14 · 16 · 18 · 22px. Grid/flex `gap` — never margin chains.
- **Motion:** one ambient `float` (3s) on the *current* milestone marker only. Everything
  else is calm. No spinners on AI — use the mentor-note skeleton.

---

## 6. The mentor moment (most important component)

Anywhere the AI speaks, render a **Mentor Note**, not a chat:

```
┌─────────────────────────────────────────┐
│  🌱  A note from Sol                      │   ← avatar (gold→coral gradient) + name
│      your mentor                          │   ← role, --ink-faint
│                                           │
│  "Hi Maya — I found three paths that fit  │   ← serif, 1 accent phrase, addressed by name
│   how you think about soccer."            │
└─────────────────────────────────────────┘
```

Rules:
- Always **named + signed** (one consistent mentor persona per student).
- **Serif voice**, second person, references something specific from the learner graph.
- Exactly **one** accent-colored phrase for emphasis — the "spark."
- Parent version is the same component retitled *"A note for the \<family\> family"* and
  ends with **one concrete support action** (`Ask her to show you one graph.`).
- Loading = a soft skeleton of this card. **Never** a typing indicator or streaming bubble.

---

## 7. Screen specs

### 7a. Project Paths — kid app (390px)
Status bar → brand row (wordmark + student avatar) → **Mentor Note** → `YOUR PATHS · PICKED
FOR YOU` → 2–3 **path cards**. First card is the recommended fit (accent border, `★ best
fit`). Each card: deliverable eyebrow (`DATA STORY` / `SHIPPED APP` / `CREATIVE`), serif
title, one personalized why-line, meta chips (`~8 weeks`, skills). Research is one option,
never the frame.

### 7b. Weekly Plan — kid app (390px)
Status bar → **project header** (coral gradient card: deliverable eyebrow, title, progress
ring `38%`, `Week 3 of 8 · You're right on pace`) → `YOUR MILESTONES` → **vertical
timeline**. Marker states: done (filled accent + ✓), **this week** (hollow accent ring,
floats, expands into a coaching card), upcoming (sunk square, faint text), final (gold +
🏁). Each milestone = a real deliverable (course, dataset, shipped app, published story).

### 7c. Parent Dashboard — desktop (864px)
Header: brand · *Parent view* · student switcher (`Maya · Grade 7 ▾`) · summary period.
Body is a `296px / 1fr` grid:
- **Left:** Skills planner (categorical progress bars) + Mentor Note ("A note for the …").
- **Right:** **Learner graph hero** (constellation) on top; below it a 2-up row of Project
  timeline (horizontal milestone rail) + Up next (mentor check-in, opportunity window).

### 7d. Learner graph (hero)
Center = student node (accent gradient, name). Ring 1 = **interests** (tinted pills with
emoji: ⚽ Soccer, 📊 Stats, ✍️ Storytelling). Ring 2 = **skills** (dashed outline pills:
Python, Data viz). Leaf = **projects** (solid accent tag). Links are `--line-soft`. Caption:
*grows every week*. Build with absolutely-positioned pill `<div>`s over an `<svg>` line
layer; data-drive from the learner-graph schema. This is the switching-cost moat — treat it
as the centerpiece, animate growth when nodes are added.

---

## 8. Voice & copy

- Kid: warm, specific, momentum ("You're right on pace", "Pick the one that sparks
  something"). Encouragement is earned, never generic praise.
- Parent: calm, substantive, one clear action per surface. Lead with the *real thing built*;
  let the college payoff stay implied. Never "improve your child's admissions odds."
- Forbidden: "As an AI", chatbot framing, hype, fake urgency, résumé language.

---

## 9. Accessibility & safety surface

- Hit targets ≥ 44px on kid screens. Body text ≥ 13px; never below 11px even for metadata.
- Accent on paper meets AA for large text; use `--accent-ink` (`#C2492C`) for accent text
  at body size.
- Reserve a calm, non-alarming slot in the parent dashboard for the safety/escalation
  surface (COPPA/FERPA). Design it as reassurance, not a warning.

---

*Source of truth for visuals: Direction A in `Passionfruit Directions.dc.html`.
Update tokens here and in `tailwind.config.ts` together.*
