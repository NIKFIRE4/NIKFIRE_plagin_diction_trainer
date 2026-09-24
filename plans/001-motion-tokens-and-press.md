# 001 — Ввести токены движения и тактильное нажатие кнопок

- **Status**: TODO
- **Commit**: bfc29a5
- **Severity**: LOW
- **Category**: Cohesion & tokens · Physicality & origin
- **Estimated scope**: 1 файл (`src/style.css`), ~6 строк

## Problem

В проекте нет токенов движения: длительности .05/.06/.08/.15/.2/.25s и встроенные кривые набраны вручную в каждом правиле. Нажатие кнопки — сдвиг на 1px за 50ms, почти незаметно; отклик симметричный.

```css
/* src/style.css:1-9 — :root без токенов движения (последние строки блока) */
  --f-mono:'JetBrains Mono',ui-monospace,'SFMono-Regular',Consolas,monospace;
  --r:14px; --r-sm:9px;
}
```

```css
/* src/style.css:79 — current (конец правила) */
.btn{... ;transition:background .15s,border-color .15s,transform .05s;text-decoration:none;color:var(--ink)}
/* src/style.css:81 — current */
.btn:active{transform:translateY(1px)}
```

## Target

```css
/* в :root, сразу после строки `--r:14px; --r-sm:9px;` */
  --ease-out:cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out:cubic-bezier(0.77, 0, 0.175, 1);
  --dur-press:160ms; --dur-state:150ms; --dur-enter:200ms;
```

```css
/* .btn — в правиле строки 79 заменить только фрагмент transition */
transition:background var(--dur-state) ease,border-color var(--dur-state) ease,transform var(--dur-press) var(--ease-out)
/* строка 81 */
.btn:active{transform:scale(0.97)}
```

## Repo conventions to follow

- Все дизайн-токены живут в `:root` в начале `src/style.css` (`--r`, `--r-sm`, цвета). Тёмные темы переопределяют только цвета — токены движения туда НЕ добавлять.
- Короткая запись в одну строку, как у существующих токенов: `--r:14px; --r-sm:9px;`.

## Steps

1. В `src/style.css`, в первом блоке `:root{…}`, после строки `  --r:14px; --r-sm:9px;` добавить строки из Target (три строки токенов).
2. В правиле `.btn{…}` (строка 79) заменить `transition:background .15s,border-color .15s,transform .05s` на `transition:background var(--dur-state) ease,border-color var(--dur-state) ease,transform var(--dur-press) var(--ease-out)`.
3. Заменить строку `.btn:active{transform:translateY(1px)}` на `.btn:active{transform:scale(0.97)}`.

## Boundaries

- Не трогать другие правила и файлы — остальные переходы переводятся на токены в планах 002–007.
- Не трогать `.btn[disabled]`, `.btn.primary:hover`.
- Если строки не совпадают с приведёнными (дрейф с bfc29a5) — ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Mechanical**: `PYTHONIOENCODING=utf-8 python build.py` завершается строкой `dist/zvukoryad.html … КБ` без `SYNTAX ERROR`.
- **Feel check**: открыть `dist/zvukoryad.html`, нажать и удерживать любую кнопку — она едва заметно «вдавливается» (0.97), при отпускании возвращается за 160ms без рывка. В DevTools → Animations на 10% видно плавное сжатие из центра кнопки.
- **Done when**: в `:root` есть `--ease-out`, `--ease-in-out`, `--dur-press`, `--dur-state`, `--dur-enter`; `.btn:active` использует `scale(0.97)`.
