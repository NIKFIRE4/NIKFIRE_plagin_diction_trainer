# 005 — Возврат шара темпа при остановке: `ease-out`, а не `linear`

- **Status**: DONE
- **Commit**: bfc29a5
- **Severity**: LOW
- **Category**: Easing & duration
- **Estimated scope**: 1 файл (`src/views.js`), 2 строки

## Problem

Шар темпа дыхания двигается `linear` — это верно для фаз вдоха/выдоха (честный постоянный темп). Но при остановке шар за 0.6s линейно «сдувается» в исходное состояние — это вход в состояние покоя, ответ системы; `linear` здесь механический, а 600ms больше бюджета UI.

```css
/* src/style.css:236 — current (фрагмент) */
.pacer .orb{…;transform:scale(.45);transition:transform linear}
```

```js
// src/views.js:873 — фаза (не менять)
    ph.textContent = name; orb.style.transitionDuration = sec + 's'; orb.style.transform = `scale(${scale})`;
// src/views.js:891 — current
    orb.style.transitionDuration = '0.6s'; orb.style.transform = 'scale(.45)'; cnt.textContent = '';
```

## Target

```js
// src/views.js:873 — фаза: явно вернуть linear (т.к. стоп меняет кривую)
    ph.textContent = name; orb.style.transitionTimingFunction = 'linear'; orb.style.transitionDuration = sec + 's'; orb.style.transform = `scale(${scale})`;
// src/views.js:891 — стоп: 300ms, сильный ease-out
    orb.style.transitionTimingFunction = 'cubic-bezier(0.23, 1, 0.32, 1)'; orb.style.transitionDuration = '0.3s'; orb.style.transform = 'scale(.45)'; cnt.textContent = '';
```

## Repo conventions to follow

- JS меняет свойства шара прямо через `orb.style.*` — продолжать так же.
- Кривая совпадает с токеном `--ease-out` из плана 001 (`cubic-bezier(0.23, 1, 0.32, 1)`); в JS пишется литералом.

## Steps

1. `src/views.js:873`: вставить `orb.style.transitionTimingFunction = 'linear'; ` перед `orb.style.transitionDuration = sec + 's';`.
2. `src/views.js:891`: заменить `orb.style.transitionDuration = '0.6s';` на `orb.style.transitionTimingFunction = 'cubic-bezier(0.23, 1, 0.32, 1)'; orb.style.transitionDuration = '0.3s';`.

## Boundaries

- НЕ менять `src/style.css:236`.
- НЕ менять длительности фаз (они равны секундам вдоха/паузы/выдоха — это методика).

## Verification

- **Mechanical**: сборка без `SYNTAX ERROR`.
- **Feel check**: упражнение с темповым шаром («Дыхание» → упражнение с кнопкой «Начать» и шаром «Вдох/Выдох»): во время вдоха шар растёт равномерно; нажать «Остановить» посреди вдоха — шар быстро и мягко садится в малый размер (~300ms), без механического линейного сдувания. Повторный «Продолжить» — снова равномерный темп.
- **Done when**: фазы идут `linear`, стоп — `cubic-bezier(0.23, 1, 0.32, 1)` 0.3s.
