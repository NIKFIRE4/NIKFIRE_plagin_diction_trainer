# 002 — Живые индикаторы уровня: `width` → `transform: scaleX`

- **Status**: TODO
- **Commit**: bfc29a5
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 файла (`src/style.css`, `src/views.js`), ~12 правок

## Problem

Индикаторы уровня микрофона обновляются на каждом кадре (~60 раз/с) через `style.width` и анимируют `width` — это пересчёт раскладки во время записи, ровно тогда, когда человек смотрит на экран.

```css
/* src/style.css:195-196 — current */
.meter{position:relative;height:10px;border-radius:5px;background:var(--surface-2);overflow:hidden;width:100%}
.meter > i{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:5px;transition:width .08s}
```

```js
// src/views.js:906
    <div class="meter"><i class="sm" style="width:0"></i></div>
// src/views.js:924
    sm.style.width = clamp((f.db - Mic.floor) / 40, 0, 1) * 100 + '%';
// src/views.js:1152
      <div id="vbar" style="position:absolute;left:0;top:18px;height:20px;border-radius:0 6px 6px 0;background:var(--accent);width:0;transition:width .06s"></div></div>
// src/views.js:1153
    <div class="meter" style="height:6px"><i id="vhold" style="width:0;background:var(--good)"></i></div>
// src/views.js:1159 (фрагмент)
$('#vhold').style.width = '0';
// src/views.js:1174
        $('#vbar').style.width = clamp((f.db + 70) / 60, 0, 1) * 100 + '%';
// src/views.js:1176
        $('#vhold').style.width = clamp(calib.length / 90, 0, 1) * 100 + '%';
// src/views.js:1180
      $('#vbar').style.width = px(f.db) + '%';
// src/views.js:1183
      $('#vhold').style.width = clamp(holdT / 3, 0, 1) * 100 + '%';
// src/views.js:1875
      <div class="meter" style="height:6px"><i id="dLvl" style="width:0;background:var(--tally)"></i></div>
// src/views.js:1951 (фрагмент)
const l = $('#dLvl'); if (l) l.style.width = clamp((f.db - Mic.floor) / 40, 0, 1) * 100 + '%';
// src/views.js:2011 (фрагмент)
const l = $('#dLvl'); if (l) l.style.width = '0';
```

Внимание: `src/views.js:2334` использует `.meter > i` для прогресса скачивания со статичной `width:${pctv}%` — он должен продолжить работать.

## Target

Заливка живых индикаторов — полная ширина, масштабируется по X от левого края; контейнер `.meter` уже скругляет и обрезает (`overflow:hidden`), поэтому у заливки радиус 0 (иначе scaleX растягивает скругление).

```css
/* src/style.css:196 — target */
.meter > i{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:5px}
.meter > i.live{width:100%;border-radius:0;transform-origin:left center;transform:scaleX(0);transition:transform 80ms linear;will-change:transform}
```

```js
// значение уровня v ∈ [0,1] записывается так:
el.style.transform = `scaleX(${v})`;
```

## Repo conventions to follow

- Хелперы `$`, `clamp`, `px` уже есть; разметка экранов — строки-шаблоны в `src/views.js`.
- Постоянное движение (индикатор, прогресс) — `linear`, как у `.ring .fg` (`src/style.css:221`: `transition:stroke-dashoffset .25s linear`).

## Steps

1. `src/style.css:196`: заменить правило на две строки из Target (первая — без `transition`, вторая — новый класс `.live`).
2. `src/views.js:906`: `<i class="sm" style="width:0"></i>` → `<i class="sm live"></i>`.
3. `src/views.js:924`: `sm.style.width = clamp((f.db - Mic.floor) / 40, 0, 1) * 100 + '%';` → `sm.style.transform = \`scaleX(${clamp((f.db - Mic.floor) / 40, 0, 1)})\`;`
4. `src/views.js:1152`: в inline-стиле `#vbar` заменить `border-radius:0 6px 6px 0;` на `width:100%;transform-origin:left center;transform:scaleX(0);` и `width:0;transition:width .06s` на `transition:transform 60ms linear;will-change:transform`. Контейнер вокруг `#vbar` уже `overflow:hidden` со скруглением 12px.
5. `src/views.js:1174`: → `$('#vbar').style.transform = \`scaleX(${clamp((f.db + 70) / 60, 0, 1)})\`;`
6. `src/views.js:1180`: → `$('#vbar').style.transform = \`scaleX(${px(f.db) / 100})\`;`
7. `src/views.js:1153`: `<i id="vhold" style="width:0;background:var(--good)"></i>` → `<i id="vhold" class="live" style="background:var(--good)"></i>`.
8. `src/views.js:1159`, `1176`, `1183`: каждое `$('#vhold').style.width = X * 100 + '%'` / `= '0'` → `$('#vhold').style.transform = \`scaleX(${X})\`` / `= 'scaleX(0)'` (X — то же выражение `clamp(…)` без `* 100 + '%'`).
9. `src/views.js:1875`: `<i id="dLvl" style="width:0;background:var(--tally)"></i>` → `<i id="dLvl" class="live" style="background:var(--tally)"></i>`.
10. `src/views.js:1951`: `l.style.width = clamp((f.db - Mic.floor) / 40, 0, 1) * 100 + '%'` → `l.style.transform = \`scaleX(${clamp((f.db - Mic.floor) / 40, 0, 1)})\``.
11. `src/views.js:2011`: `l.style.width = '0'` → `l.style.transform = 'scaleX(0)'`.

## Boundaries

- НЕ трогать `src/views.js:2334` (прогресс скачивания) и `.sbar` — они статичны.
- НЕ менять `#vband` (`src/views.js:1151`, 1162) — он позиционируется, а не анимируется.
- Без новых зависимостей. Если строки не совпадают — ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Mechanical**: `PYTHONIOENCODING=utf-8 python build.py` без `SYNTAX ERROR`; `grep -n "style.width" src/views.js` не находит `sm`, `vbar`, `vhold`, `dLvl`.
- **Feel check**: запустить Chrome/Edge с `--use-fake-device-for-media-stream`, открыть `#ex-long-s`, нажать «Начать» — полоса под табло двигается плавно от левого края, без дрожи. В DevTools → Performance при записи нет фиолетовых блоков Layout на каждом кадре. Открыть `#ex-volume` (или упражнение с `#vbar`) — полоса громкости и полоса удержания работают так же, как раньше.
- **Done when**: все живые индикаторы обновляют `transform`, прогресс скачивания (`2334`) по-прежнему показывает процент шириной.
