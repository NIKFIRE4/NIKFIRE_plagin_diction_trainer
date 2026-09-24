---
target: весь интерфейс Звукоряда (dist/zvukoryad.html)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\user\\Desktop\\zvukoryad-bridge\\github-upload\\dist\\zvukoryad.html"
target_fingerprint: "sha256:e0ddcdb068c017fc757a81b54fee87a96b619993c827418551cae9baa7295926"
target_path: "C:\\Users\\user\\Desktop\\zvukoryad-bridge\\github-upload\\dist\\zvukoryad.html"
timestamp: 2026-09-24T19-13-43Z
slug: dist-zvukoryad-html
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 27/40 (Acceptable, upper edge)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | No "on air" state on the stage; normal offline mode shown as red «ИИ недоступен» |
| 2 | Match System / Real World | 3 | «пт», «S/Z», «0% пути» unexplained on home |
| 3 | User Control and Freedom | 3 | Leaving a session without losing progress not obvious |
| 4 | Consistency and Standards | 2 | Two primaries per screen; recording buttons blue; one metric has 3 different goals |
| 5 | Error Prevention | 3 | Disabled «Начать разговор» contradicts the notice above it |
| 6 | Recognition Rather Than Recall | 3 | Week goal only on home |
| 7 | Flexibility and Efficiency | 2 | No shortcuts (Space), no skip-link, nav buttons not links |
| 8 | Aesthetic and Minimalist Design | 2 | Home plan is a wall of text; start button below the fold |
| 9 | Error Recovery | 3 | Toast duplicates mic notice |
| 10 | Help and Documentation | 3 | Method, how-to, why lines |

## Design Specificity Verdict
Stage (readout, ring, twister word highlighting) and weekly roadmap are authored; shell/home/sections are category-interchangeable. On-air amber never lights on the stage; amber misused on session bar and weak-skill bars.
Detector: 17 advisory DESIGN.md drift (CLI); browser 4–54/view. Real: --ink-3 contrast (3.4–3.9:1 light, 4.3:1 dark), .tag.mic 3.1:1, td.ok 3.9:1, line-length 130–150ch on program/progress, width transition on meter. False positives: em-dash-overuse (Russian grammar), gray-on-color on stage buttons, radius 8/10px, #1a1200.

## Priority Issues
- [P1] Home plan wall of text, start button below fold (views.js:597-599, style.css:389-393) → distill, layout
- [P1] Session end = praise toast instead of measurement summary (views.js:624, :940, :1445) → delight
- [P2] Studio signal system not wired to stage (.btn.rec unused; amber on .sessionbar .bar i, .sbar i.low; AI off shown red) → colorize
- [P2] Week goal lost between screens; contradictory goals (views.js:529 vs data.js:31; diag 2–3 weeks vs 7 days); norm band hidden in progress charts → clarify
- [P2] Keyboard + contrast (.shold pointer-only, no Space, no skip-link, no aria-live; --ink-3, .tag.mic, td.ok below AA) → harden, typeset

## Persona Red Flags
- Alex: scroll 7 items to start; no shortcuts; nav buttons not links; dialog setup 6+6 chips.
- Sam: hold timer mouse-only; 14+ tabs to content; readout not announced; word status by color only.
- Jordan: two equal primaries on first run; red «ИИ недоступен» looks broken.
- Interview-prep persona: dialog hidden in tools, not in plan; joke voice characters clash with tone.

## Minor Observations
.ai-off dot wraps alone; range overlay collides with C6 axis label; «Отметить выполненным» floats outside stage; progress heatmap stretched; «15 минут в день» vs 23–25 min plan; «в Настройках .»; long uppercase eyebrow and «Раздел» kicker; 2px border-left on .why; mobile: how-to and filters push twister ~1200px down.

## Questions to Consider
1. Why no voice number on home — a "board of the day" instead of a checklist?
2. Show the plan one item at a time?
3. Make the on-air lamp a real stage element?
