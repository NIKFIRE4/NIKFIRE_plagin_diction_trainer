# 006 — Лампа эфира зажигается, а не появляется рывком

- **Status**: DONE
- **Commit**: bfc29a5
- **Severity**: LOW (missed opportunity — главный «авторский момент» продукта)
- **Category**: Missed opportunities
- **Estimated scope**: 1 файл (`src/style.css`), 3 строки

## Problem

Во время записи панель сцены получает класс `.on-air` (ставит `MutationObserver` в `src/views.js`, функция `boot()`), а кнопка — `.is-live`. Рамка, метка «ЗАПИСЬ» и янтарная кнопка появляются в один кадр — центральный момент «студии» проходит незамеченным.

```css
/* src/style.css:100 — current */
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:22px}
/* src/style.css:451-453 — current */
.panel.on-air{position:relative;border-color:var(--tally)}
.panel.on-air::before{content:"Запись";position:absolute;top:-10px;left:18px;padding:0 8px 0 22px;line-height:20px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--warn);background:radial-gradient(circle at 12px 50%,var(--tally) 4px,transparent 4.5px),var(--surface)}
.btn.rec-btn.is-live{background:var(--tally);border-color:var(--tally);color:#1a1200}
```

## Target

- Рамка панели плавно меняет цвет: 180ms `var(--ease-out)`.
- Метка «ЗАПИСЬ» при появлении: из `opacity:0; transform:translateY(2px) scale(0.96)` в покой, 180ms `var(--ease-out)`, через `@starting-style` (псевдоэлемент появляется вместе с классом).
- Гаснет мгновенно (ответ системы на «Стоп» — быстрый; асимметрия намеренная).

```css
/* src/style.css:100 — дописать в конец правила .panel перед `}` */
;transition:border-color 180ms var(--ease-out)
/* src/style.css:452 — дописать в конец правила .panel.on-air::before перед `}` */
;transform-origin:left center;transition:opacity 180ms var(--ease-out),transform 180ms var(--ease-out)
/* новая строка сразу после 452 */
@starting-style{.panel.on-air::before{opacity:0;transform:translateY(2px) scale(0.96)}}
```

## Repo conventions to follow

- Токен `--ease-out` вводит план 001 — выполнить его первым.
- Кнопка `.btn` уже переходит по `background`/`border-color` (план 001) — `.is-live` получает переход цвета автоматически, отдельного правила не нужно.

## Steps

1. `src/style.css:100`: дописать `;transition:border-color 180ms var(--ease-out)` в правило `.panel` (итог: `…padding:22px;transition:border-color 180ms var(--ease-out)}`).
2. `src/style.css:452`: дописать `;transform-origin:left center;transition:opacity 180ms var(--ease-out),transform 180ms var(--ease-out)` в конец правила `.panel.on-air::before`.
3. Сразу после строки 452 добавить `@starting-style{.panel.on-air::before{opacity:0;transform:translateY(2px) scale(0.96)}}`.

## Boundaries

- НЕ менять JS наблюдателя и классы.
- НЕ добавлять пульсацию/бесконечные анимации лампы — метка должна гореть ровно, как настоящая лампа эфира.

## Verification

- **Mechanical**: сборка без ошибок.
- **Feel check**: браузер с `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, `#ex-long-s`, «Начать»: рамка теплеет, метка «ЗАПИСЬ» мягко проявляется (не прыгает), кнопка становится янтарной. «Стоп» — всё гаснет сразу. На 10% в Animations метка поднимается на 2px и доходит до полного размера без перелёта. В reduced-motion (план 003) метка появляется без сдвига и масштаба.
- **Done when**: у `.panel` есть переход `border-color`, у метки — `@starting-style`.
