---
name: Звукоряд
description: Тренажёр дикции, голоса и живой речи — студия, где главное звучит голос
colors:
  signal-blue: "#2A45D4"
  signal-blue-dark: "#8198FF"
  signal-blue-wash: "#E2E7FB"
  signal-blue-wash-dark: "#1D274A"
  on-air-amber: "#E48A00"
  on-air-amber-dark: "#F4A62A"
  on-air-amber-wash: "#FDF0DA"
  level-green: "#17744B"
  level-green-dark: "#48C38B"
  level-green-wash: "#DDF2E7"
  caution-ochre: "#8A5D00"
  clip-red: "#B03524"
  clip-red-dark: "#F07361"
  clip-red-wash: "#FBE3DF"
  booth-mist: "#EDF0F3"
  booth-night: "#0D1318"
  panel-white: "#FFFFFF"
  panel-night: "#141C23"
  panel-inset: "#F4F6F8"
  panel-inset-night: "#1A242D"
  ink: "#131C26"
  ink-night: "#E3E9EF"
  ink-secondary: "#48545F"
  ink-tertiary: "#5F6B76"
  ink-tertiary-night: "#85919C"
  rule: "#D7DDE3"
  rule-soft: "#E6EAEE"
typography:
  display:
    fontFamily: "Unbounded, Onest, system-ui, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 36px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Unbounded, Onest, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 500
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  ui:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  meta:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.1em"
  label-xs:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.09em"
  stat:
    fontFamily: "Unbounded, Onest, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  timer:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontSize: "44px"
    fontWeight: 500
  readout:
    fontFamily: "Unbounded, Onest, system-ui, sans-serif"
    fontSize: "clamp(52px, 9vw, 88px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.04em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  xs: "4px"
  sm: "9px"
  md: "12px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.panel-white}"
    rounded: "10px"
    padding: "8px 16px"
    height: "40px"
  button-primary-big:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "52px"
  button-record:
    backgroundColor: "{colors.on-air-amber}"
    textColor: "#1A1200"
    rounded: "10px"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink}"
    rounded: "10px"
    padding: "8px 16px"
    height: "40px"
  chip:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.booth-mist}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  panel:
    backgroundColor: "{colors.panel-white}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  nav-item-active:
    backgroundColor: "{colors.signal-blue-wash}"
    textColor: "{colors.signal-blue}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
---

# Design System: Звукоряд

## Overview

**Creative North Star: "Студия звукозаписи"**

Звукоряд — комната, в которой человек остаётся один на один со своим голосом. Как в студии, всё оборудование на виду, но молчит, пока не нужно: индикатор уровня, лампа «в эфире», крупное табло с цифрой замера. Интерфейс спокойный и точный: тонкие линии, ровные панели, почти без теней. Внимание получает только то, что сейчас звучит или измеряется.

Плотность средняя: план дня, прогноз и история читаются с одного экрана, но во время упражнения сцена упрощается до табло, графика высоты и расшифровки. Цвет работает как сигнальная система студии, а не как украшение: синий — действие и живой сигнал, янтарный — микрофон включён и идёт запись, зелёный — уровень в норме, красный — перегруз и ошибка.

Две равноправные темы. Светлая — «туманная будка» (холодный серо-голубой фон, белые панели), тёмная — «ночная аппаратная» (почти чёрный с синевой, панели на полтона светлее).

**Key Characteristics:**
- Крупные цифры замеров шрифтом Unbounded — главный визуальный герой.
- Цвет несёт смысл состояния, у каждого сигнального цвета есть бледная «подложка» (wash) для фона.
- Панели с границей в 1px вместо теней; глубина — за счёт тона.
- Моноширинные цифры везде, где значение меняется или сравнивается.
- Русский текст с `text-wrap: balance`/`pretty` для заголовков и крупных фраз.

## Colors

Холодная нейтральная база и четыре сигнальных цвета, у каждого — пара «сплошной + бледная подложка» для светлой и тёмной темы.

### Primary
- **Сигнальный синий** (signal-blue / signal-blue-dark): главное действие экрана, активный пункт навигации, живой прогресс (кольцо, метр, шкала), подсветка текущего слова, ИИ. В тёмной теме светлеет до барвинкового, и текст на нём становится тёмным.
- **Синяя подложка** (signal-blue-wash): фон активного пункта меню, текущего шага, блоков ИИ-разбора.

### Secondary
- **Лампа эфира** (on-air-amber / on-air-amber-dark): только микрофон и запись. Пока идёт запись, панель сцены получает янтарную рамку и метку «ЗАПИСЬ» на линии рамки, кнопка «Стоп» становится янтарной. Тег «микрофон», точка микрофона в шапке. Не для прогресса, метронома и слабых навыков.
- **Янтарная подложка** (on-air-amber-wash): фон тегов микрофона, «почти правильных» слов, мягких предупреждений.

### Tertiary
- **Зелёный уровень** (level-green): норма достигнута, лучшая попытка, распознанное слово, выполненный пункт плана, тепловая карта активности.
- **Охра** (caution-ochre): текст предупреждений.
- **Красный перегруз** (clip-red): слова-паразиты, пропущенные слова, ошибки, клиппинг индикатора.

### Neutral
- **Туманная будка / Ночная аппаратная** (booth-mist / booth-night): фон страницы.
- **Панель** (panel-white / panel-night): карточки, сайдбар, поля ввода.
- **Вкладка панели** (panel-inset / panel-inset-night): вложенные поверхности: расшифровка, холст графика, неактивные слоги, ховер строк.
- **Чернила** (ink → ink-secondary → ink-tertiary): три ступени текста: основной, пояснения, подписи и метаданные.
- **Линия** (rule / rule-soft): границы панелей и разделители строк.

### Named Rules
**The Signal Rule.** Каждый цвет, кроме нейтральных, означает состояние. Синий — «делай / живое», янтарный — «запись», зелёный — «норма», красный — «ошибка». Цвет не используется для украшения.

**The Wash Rule.** Цветной фон — всегда подложка (wash), а не сплошной сигнальный цвет. Сплошной цвет — только для кнопки главного действия, маркера на шкале и точки статуса.

## Typography

**Display Font:** Unbounded (с Onest, system-ui)
**Body Font:** Onest (с system-ui, -apple-system, Segoe UI)
**Label/Mono Font:** JetBrains Mono (с ui-monospace, Consolas)

**Character:** Широкий геометричный Unbounded звучит как табло и надпись на пульте. Он отвечает за заголовки и цифры. Onest — спокойный гротеск для русского текста. JetBrains Mono выравнивает цифры, чтобы значения не прыгали.

### Hierarchy
- **Display** (600, clamp(26px, 3.4vw, 36px), 1.12): заголовок экрана, один на страницу.
- **Readout** (500, clamp(52px, 9vw, 88px), 1): живое табло замера (секунды, счёт). Показатели в карточках — тот же шрифт 22–26px.
- **Headline** (Unbounded 500, 19px): заголовок панели («План дня», «Навыки»).
- **Title** (Onest 600, 16px): название упражнения, пункта, строки.
- **UI / Meta** (Onest, 14px / 13px): подписи элементов управления и метаданные строк. Шкала мелких размеров: 11 · 12 · 13 · 14 · 15 · 16 · 17px, без полупикселей.
- **Body** (Onest 400, 15px, 1.5): основной текст; пояснения не шире 62–70ch.
- **Lead** (17px, ink-secondary): подзаголовок экрана.
- **Label** (500, 12px, 0.1em, uppercase): эйбрау и подписи панелей («КАК ВЫПОЛНЯТЬ», «АКТИВНОСТЬ»).
- **Mono** (12–13px, tabular): счётчики, даты, единицы, номера шагов.

### Named Rules
**The Readout Rule.** Число замера всегда крупнее своей подписи минимум в полтора раза, единица измерения — мелким Onest серым рядом с числом.

## Layout

Оболочка — двухколоночная сетка: липкий сайдбар 232px и основная колонка с полупрозрачной липкой шапкой (размытие 10px), в которой статус ИИ и индикатор микрофона. Контент — колонка до 1080px по центру, отступы 28px, вертикальный ритм между блоками 26px.

Экран упражнения — сцена `1fr + 300px`: слева панель упражнения, справа липкая инструкция «Как выполнять». Сетки карточек — 2 или 3 колонки с зазором 16px.

До 980px сцена и главный экран складываются в одну колонку, инструкция встаёт над сценой. До 820px сайдбар превращается в горизонтальную прокручиваемую полосу разделов без иконок, отступы — 16px.

## Elevation & Depth

Система плоская. Глубина передаётся тоном: фон → панель → вложенная поверхность. Панели очерчены линией 1px, теней у панелей нет. Единственная тень — мягкая двухслойная `--shadow` у всплывающего тоста.

### Shadow Vocabulary
- **Ambient lift** (`0 1px 2px rgba(19,28,38,.06), 0 6px 24px rgba(19,28,38,.06)`; в тёмной теме плотнее): только тост.
- **Status halo** (`0 0 0 4px <wash>`): ореол вокруг точки статуса микрофона и ИИ, когда они активны.

### Named Rules
**The Flat Booth Rule.** Панели лежат на поверхности. Тень — исключение для всплывающего, а не способ выделить карточку.

## Shapes

Мягкие, но собранные формы. Панели — 14px, кнопки — 10px (крупные — 12px), вложенные блоки — 12px, мелкие элементы — 8–9px, подсветка слова — 4px. Чипы, теги, статусы и вердикты — полные «таблетки». Кольцо таймера и темповый шар — круги.

## Components

### Buttons
- **Shape:** мягкий прямоугольник (10px), высота 40px; крупная — 52px и 12px.
- **Primary:** сигнальный синий, белый текст (в тёмной теме — тёмный текст на барвинковом), вес 550.
- **Record:** лампа эфира, почти чёрный текст — только для записи.
- **Secondary:** панель с линией; при наведении линия темнеет до ink-tertiary.
- **Ghost:** без рамки, ink-secondary; при наведении — подложка panel-inset.
- **Hover / Active:** primary светлеет (`brightness(1.08)`), нажатие смещает кнопку на 1px вниз. Disabled — прозрачность 45%.

### Chips
- **Style:** таблетка с линией, ink-secondary, 13.5px.
- **State:** выбранный чип инвертируется: фон ink, текст цвета фона. Теги (`tag`) без рамки на подложке: янтарная — микрофон, синяя — ИИ.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** panel-white / panel-night.
- **Shadow Strategy:** без тени (см. Flat Booth Rule).
- **Border:** 1px rule.
- **Internal Padding:** 22px (16px на мобильном).
- **Stat grid:** ячейки разделены линией в 1px через `gap:1px` на фоне rule-soft.

### Inputs / Fields
- **Style:** панель, линия 1px, 12px (select — 9px), внутренний отступ 11–12px 14px.
- **Focus:** общий `focus-visible` — контур 2px сигнальным синим с отступом 2px.

### Navigation
- Onest 14.5px/500, ink-secondary, иконки 19px линией 1.7. Hover — подложка panel-inset. Активный пункт — синяя подложка и синий текст. Группы разделены метками 11px uppercase. На мобильном — горизонтальная полоса без иконок.

### Живое табло и сцена (Signature)
Табло замера (`big-num`), кольцо таймера 220px с синей дугой, индикатор уровня из вертикальных штрихов (зелёный → охра → красный), холст графика высоты на вложенной поверхности, карточка скороговорки крупным Unbounded с пословной подсветкой: зелёный — распознано, янтарная подложка — почти, красная подложка с волнистым подчёркиванием — пропущено, синий — слово звучит сейчас.

### Лампа эфира (Signature)
Состояние панели `.on-air`: рамка 1px лампой эфира, метка «ЗАПИСЬ» (12px, 600, uppercase, 0.08em, охра) с янтарной точкой разрывает верхнюю линию рамки, как легенда. Включается автоматически, пока кнопка `.rec-btn` показывает «Стоп». Пробел запускает и останавливает запись, если фокус не в поле ввода.

### План дня
Строка плана — одна кнопка на всю ширину: кружок-отметка, название 600 + мета 13px, минуты моноширинным справа. Пояснение «зачем» и цель — только у следующего невыполненного пункта. «Начать занятие» стоит в шапке панели, а не под списком.

### ИИ-разбор
Блок на синей подложке, смешанной с панелью, с синей линией 35% прозрачности. Заголовок с точкой статуса, текст 14.5px/1.6. Во время ожидания — пульсирующая надпись.

## Do's and Don'ts

### Do:
- **Do** показывать главную цифру экрана шрифтом Unbounded, единицу — мелким серым Onest рядом.
- **Do** использовать цвет только по Signal Rule; фоном — подложку (wash).
- **Do** держать один primary на экран; остальные действия — secondary или ghost.
- **Do** выравнивать меняющиеся числа моноширинным шрифтом с `tabular-nums`.
- **Do** проверять каждую правку в обеих темах: цвета заданы парами.

### Don't:
- **Don't** добавлять тени карточкам, чтобы выделить их; выделяйте тоном или линией.
- **Don't** красить янтарным что-то, кроме записи, микрофона и мягких предупреждений.
- **Don't** использовать Unbounded для абзацного текста и мелких подписей.
- **Don't** ставить эйбрау-кикер над заголовком экрана: дата, неделя, фокус идут в подводку под заголовком.
- **Don't** отвлекать во время упражнения: на сцене нет декоративных элементов и анимаций, не связанных с голосом.
