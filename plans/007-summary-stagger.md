# 007 — Итог занятия: строки замеров входят по очереди

- **Status**: DONE
- **Commit**: bfc29a5
- **Severity**: LOW (missed opportunity — редкий момент, где разрешена сдержанная выразительность)
- **Category**: Missed opportunities · Cohesion (stagger)
- **Estimated scope**: 2 файла (`src/style.css`, `src/views.js`), ~3 строки

## Problem

Экран «Итог занятия» (`viewSummary` в `src/views.js`) показывает все строки замеров одним кадром. Это конец 20-минутного ритуала — момент, который запоминается (peak-end), а он проходит «статично».

```css
/* src/style.css:143 — current */
.sum-row{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr);gap:8px 20px;align-items:center;padding:16px 0;border-top:1px solid var(--line-2)}
```

```js
// src/views.js, функция viewSummary — фрагмент разметки строки
<div class="sum-list">${rows.map((r) => `<div class="sum-row">…
```

## Target

Каждая строка: `opacity 0 → 1` и `translateY(6px) → 0`, 240ms `var(--ease-out)`, задержка `i × 60ms` (шаг 60ms — внутри диапазона 30–80ms). Вход через `@starting-style`, без блокировки кнопок: кнопки «На сегодня всё» не анимируются и доступны сразу.

```css
/* новая строка сразу после src/style.css:143 */
.sum-row{transition:opacity 240ms var(--ease-out),transform 240ms var(--ease-out);transition-delay:calc(var(--i,0) * 60ms)}
@starting-style{.sum-row{opacity:0;transform:translateY(6px)}}
```

```js
// src/views.js viewSummary: в rows.map передать индекс и выставить --i
<div class="sum-list">${rows.map((r, i) => `<div class="sum-row" style="--i:${i}">…
```

## Repo conventions to follow

- Токен `--ease-out` — из плана 001.
- Inline `style="--x:…"` для передачи значения в CSS уже используется в проекте (`style="width:…"` в `skillBar`), так что inline custom property — в духе кода.

## Steps

1. В `src/style.css` сразу после строки 143 (правило `.sum-row{display:grid;…}`) добавить две строки из CSS-блока Target.
2. В `src/views.js`, функция `viewSummary`: заменить `${rows.map((r) => \`<div class="sum-row">` на `${rows.map((r, i) => \`<div class="sum-row" style="--i:${i}">`.

## Boundaries

- НЕ анимировать заголовок, подводку и кнопки итога.
- НЕ менять логику расчёта `rows`.
- Если фрагмент в `viewSummary` не найден дословно — ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Mechanical**: сборка без `SYNTAX ERROR`.
- **Feel check**: пройти занятие с хотя бы двумя замерами (или использовать тестовый сценарий: «Начать занятие» → упражнение с замером → «Завершить») — на экране итога строки проявляются сверху вниз с шагом 60ms, всё завершается за < 0.5s; кнопку «На сегодня всё» можно нажать сразу. В reduced-motion (план 003) строки просто появляются.
- **Done when**: у `.sum-row` есть `@starting-style` и `transition-delay` через `--i`.
