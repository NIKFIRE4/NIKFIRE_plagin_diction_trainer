# 004 — Мягкий вход тоста

- **Status**: TODO
- **Commit**: bfc29a5
- **Severity**: MEDIUM
- **Category**: Missed opportunity · Easing & duration
- **Estimated scope**: 1 файл (`src/style.css`), 1 правило

## Problem

Тост появляется из ниоткуда в первом же кадре: нет начального состояния.

```css
/* src/style.css:333 — current */
.toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:12px;font-size:14px;z-index:50;box-shadow:var(--shadow)}
```

```js
// src/engine.js:393-395 — создание (JS не меняем)
function toast(msg, ms = 2400) {
  const t = h(`<div class="toast" role="status">${esc(msg)}</div>`); document.body.append(t); setTimeout(() => t.remove(), ms);
}
```

## Target

Вход через `@starting-style` (без JS): прозрачность 0 и сдвиг на 8px вниз → на место, 200ms `var(--ease-out)` (токены из плана 001). Переход, а не keyframes — несколько тостов подряд не перезапускаются с нуля.

```css
/* src/style.css:333 — дописать в конец правила .toast перед `}` */
;opacity:1;transition:opacity var(--dur-enter) var(--ease-out),transform var(--dur-enter) var(--ease-out)
```

```css
/* новая строка сразу после правила .toast */
@starting-style{.toast{opacity:0;transform:translate(-50%,8px)}}
```

## Repo conventions to follow

- Токены `--ease-out` и `--dur-enter` вводит план 001 — выполнить его первым.
- Правила пишутся в одну строку.

## Steps

1. В `src/style.css:333` дописать в правило `.toast` свойства из первого блока Target (итог: `…box-shadow:var(--shadow);opacity:1;transition:opacity var(--dur-enter) var(--ease-out),transform var(--dur-enter) var(--ease-out)}`).
2. Сразу после этой строки добавить строку `@starting-style{.toast{opacity:0;transform:translate(-50%,8px)}}`.

## Boundaries

- НЕ менять `src/engine.js` (выход тоста остаётся мгновенным: исчезновение системного сообщения — это «ответ системы», он должен быть быстрым).
- НЕ добавлять keyframes.

## Verification

- **Mechanical**: сборка `PYTHONIOENCODING=utf-8 python build.py` без ошибок.
- **Feel check**: на главном экране нажать «Пересобрать план» — тост «План пересобран…» поднимается на 8px и проявляется за 200ms, ровно по центру (не уезжает вбок). На 10% в Animations видно: сначала быстрое движение, затем плавная посадка (ease-out). В reduced-motion (план 003) тост просто появляется.
- **Done when**: у `.toast` есть `@starting-style` со смещением `translate(-50%,8px)` и `opacity:0`.
