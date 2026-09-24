# 003 — Бережный `prefers-reduced-motion` вместо «выключить всё»

- **Status**: DONE
- **Commit**: bfc29a5
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 файл (`src/style.css`), 1 правило

## Problem

```css
/* src/style.css:359 — current */
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
```

Правило убивает любое движение, включая то, что несёт смысл: шар темпа дыхания (`.pacer .orb`, `src/style.css:236`, JS задаёт `transitionDuration` = длительность фазы) перестаёт показывать вдох/выдох и «прыгает»; пропадает пульс ожидания ИИ (`.ai-pulse`, `src/style.css:397`); цветовые переходы кнопок и подсветки слов становятся резкими. Reduced motion — это «меньше и мягче», а не ноль.

## Target

```css
/* src/style.css:359 — target (заменить строку целиком) */
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}
  .btn:active,.syl.on{transform:none}
  .flash{animation:none}
  .ai-pulse{animation:aipulse 2.4s ease-in-out infinite!important;animation-duration:2.4s!important;animation-iteration-count:infinite!important}
  .pacer .orb{transform:none!important}
  .toast,.panel.on-air::before,.sum-row{transition-property:opacity!important}
}
```

Последняя строка — для входов из планов 004, 006, 007: при reduced-motion они только проявляются по прозрачности, сдвиг/масштаб из `@starting-style` применяется мгновенно. Селекторы можно добавлять до выполнения этих планов — CSS не требует, чтобы элементы существовали.

И отдельное правило вне медиа-запроса не нужно: для шара дыхания в reduced-motion фаза показывается прозрачностью. Для этого JS не трогаем — вместо масштаба шар остаётся на месте, а его содержимое (текст фазы и счёт секунд в `.pacer .lbl`) продолжает меняться.

## Repo conventions to follow

- Медиа-запросы стоят рядом с концом `src/style.css`, в одну строку или компактным блоком (см. `@media (max-width:820px){…}` на строке ~340).
- Переходы цвета/фона (`transition:background …`) остаются работать — они не двигают элементы.

## Steps

1. В `src/style.css` заменить строку 359 целиком на блок из Target.
2. Больше ничего не менять.

## Boundaries

- НЕ трогать JS шара дыхания (`src/views.js` около 873 и 891).
- НЕ удалять `@keyframes flash` и `@keyframes aipulse`.
- Если строка 359 не совпадает — ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Mechanical**: `PYTHONIOENCODING=utf-8 python build.py` без ошибок.
- **Feel check**: DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce`.
  - Наведение на кнопку и чип по-прежнему плавно меняет цвет/рамку (переходы цвета сохранены).
  - Нажатие кнопки больше не сжимает её.
  - Упражнение с шаром темпа (`#ex-diaphragm` или раздел «Дыхание» → упражнение с «Вдох/Выдох»): шар не масштабируется, но надпись фазы и счёт секунд меняются.
  - Разбор ИИ в ожидании: надпись медленно пульсирует (2.4s), а не замирает.
  - Лампа эфира (план 006) появляется без движения.
- **Done when**: в reduced-motion нет ни одного перемещения/масштаба, но цветовые изменения и индикатор ожидания работают.
