# Tradon · Brand Spec — Field Green

> Settled: 2026-05-16 · Greenfield (no external assets; self-brand)
> Source of truth for all UI. Implementation maps these tokens 1:1 into the
> Tailwind theme — never hand-pick a hex in a component.
> Preview: `design/brand-exploration/Tradon Brand — Field Green.html`

## 🎯 Core identity

- **Logo:** wordmark only for now — `Tradon` in the display face, weight 700,
  letter-spacing −0.03em, with a single ochre period: `Tradon` + `.` (the dot
  is `signal #C9742B`). No icon mark yet (greenfield; can be added later).
- **Essence:** trustworthy, money/growth, operational. Warm — not sterile SaaS.
- **Anti-goal:** must not read as generic African agritech. Differentiation
  comes from execution (warm paper ground, rationed ochre, typographic
  discipline), not from the hue.

## 🎨 Color tokens

### Brand green ramp
| Token | Hex | Role |
|---|---|---|
| `green-50`  | `#ECF3EE` | tint surface, hover wash |
| `green-100` | `#D7E6DC` | subtle fills, chips |
| `green-200` | `#AECDBA` | borders on green, chart "other" |
| `green-400` | `#4F9168` | secondary marks |
| **`green-600`** ★ | **`#1B5E3A`** | **PRIMARY** — actions, brand, links |
| `green-700` | `#14422C` | active nav, primary hover/pressed |
| `green-900` | `#0F3322` | sidebar, AI banner, deepest ground |

### Warm neutral ramp
| Token | Hex | Role |
|---|---|---|
| `paper` | `#F4F2EC` | app background (deliberately not white) |
| `surface` | `#FFFFFF` | cards, panels |
| `surface-2` | `#FAF8F2` | inputs, wells |
| `border` | `#E4E1D6` | hairlines (single weight) |
| `border-strong` | `#D5D1C2` | outer frame, emphasis dividers |
| `muted` | `#6C7A6F` | secondary text |
| `text` | `#2C3A30` | body text |
| `ink` | `#16241B` | headings, strongest text |

### Semantic + accent
| Token | Hex | Role |
|---|---|---|
| `positive` | `#2F9E5E` | gains, ▲ deltas, healthy states |
| `negative` | `#C0492F` | overdue, ▼ deltas, risk/alert |
| **`signal`** ★ | **`#C9742B`** | the single warm accent |
| `on-primary` | `#F2F6EF` | text/icons on green-600/900 |
| `on-deep` | `#DCE8DD` | body text on green-900 |

**Accent discipline (hard rule):** `signal #C9742B` is the *only* warm color
and appears **once or twice per screen** — logo dot, one CTA, one attention
nudge. Never a fill, never a theme, never a gradient.

## ✍️ Typography

| Face | Stack | Use |
|---|---|---|
| Display | `'Schibsted Grotesk'`, ui-sans-serif, system-ui | headlines, KPI numbers, buttons, wordmark |
| Body | `'IBM Plex Sans'`, system-ui, -apple-system, 'Segoe UI' | all readable text |
| Mono | `'IBM Plex Mono'`, ui-monospace, Menlo | figures, deltas, IDs, timestamps (tabular) |

Scale: display-xl 34 / display 23 / heading 15 / body 14 / small 12 /
data-mono 15. Display letter-spacing −0.02em (−0.03em ≥30px). Mono is reserved
for data that must align in columns (finance/distribution) — not decoration.

## 📐 Foundations

- **Radius:** card 12px · control 8px · pill 999px
- **Elevation:** one soft card shadow
  `0 1px 2px rgba(15,51,34,.04), 0 8px 24px -16px rgba(15,51,34,.18)`
- **Borders:** one hairline weight (`border`); whitespace over dividers
- **Gradients:** none, except the single chart-area fade (primary → transparent)
- **Icons:** line only, 1.6 stroke, 24px grid (Lucide-style); functional only —
  no decorative per-heading icons

## 🧩 Tailwind mapping (implementation contract)

At implementation, expose every token as a CSS custom property on `:root` and
reference it from `tailwind.config` `theme.extend.colors` (and
`fontFamily`/`borderRadius`/`boxShadow`). Components use semantic class names
(`bg-primary`, `text-muted`, `border-hairline`, `bg-paper`) — **never raw hex,
never `green-[#1B5E3A]`**. Changing the brand = editing this file + the token
layer, nothing else.

## 🚫 Don'ts

- No pure-white app background — `paper` is the ground.
- No second accent color; no purple/blue "tech" gradients; no emoji icons.
- No inventing intermediate greens — use the ramp steps.
- Ochre never exceeds ~2 placements per screen.

## Keywords

trustworthy · operational · warm · grounded · money-confident
