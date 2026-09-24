---
name: Звукоряд
description: Спокойный тренер речи — каждый день один понятный следующий шаг и цифры голоса
colors:
  page: "#F4F4F1"
  surface: "#FFFFFF"
  control: "#EBEBE7"
  control-hover: "#E0E0DB"
  ink: "#17181A"
  ink-hover: "#2D2F33"
  ink-secondary: "#4A4D52"
  ink-tertiary: "#6B6F76"
  rule: "#E3E3DE"
  rule-soft: "#EDEDE9"
  record-red: "#D93036"
  record-red-wash: "#FDECEC"
  data-blue: "#2F5BEA"
  data-blue-wash: "#ECF1FE"
  norm-green: "#18794E"
  norm-green-wash: "#E7F4EC"
  caution: "#9A5B00"
  caution-wash: "#FFF3DC"
  error: "#C62A2F"
typography:
  display:
    fontFamily: "Golos Text, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(30px, 3.4vw, 40px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  readout:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "clamp(64px, 9vw, 104px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  title-lg:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  lead:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  ui:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  meta:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  micro:
    fontFamily: "Golos Text, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
rounded:
  hairline: "2px"
  sm: "8px"
  control: "10px"
  md: "12px"
  group: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-primary-big:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 22px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-recording:
    backgroundColor: "{colors.record-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 22px"
    height: "48px"
  chip:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.group}"
    padding: "{spacing.lg}"
  list-row:
    rounded: "{rounded.md}"
    padding: "14px 16px"
---

# Design System: Звукоряд

## Overview

**Creative North Star: "Спокойный тренер"**

Звукоряд выглядит как хорошо сделанное приложение-тренер, а не как дашборд. Планка — Yoodli и Speeko по ясности ежедневного сценария и Apple Health по тому, как показаны цифры. Главный экран отвечает на один вопрос: что сделать сейчас. Всё остальное спокойно ждёт в списках на один клик.

Мир светлый и тихий: светло-серая страница, на ней белые группы без рамок и теней, один шрифт Golos Text с табличными цифрами, чернильно-чёрные кнопки. Цвет почти не используется, поэтому каждый цвет что-то значит: красный — идёт запись, зелёный — норма достигнута, синий — ссылки и линии данных. Движение короткое и функциональное: запись «зажигается», тост поднимается на 8px, строки итога входят с шагом 60 мс.

Сознательно отвергнуто то, что делает интерфейс «нейрослопом»: эйбрау капсом над заголовками, одинаковые карточки, ряды статистики, теги-пилюли, сайдбар на пятнадцать пунктов, градиенты и неон, моноширинный шрифт как «технический» костюм.

**Key Characteristics:**
- Одна чёрная кнопка главного действия на экран; всё остальное — серые или без фона.
- Группы — белые поверхности 14px на сером фоне; внутри списки с тонкими разделителями.
- Цифры замеров крупные и табличные; единица мелко и серым рядом.
- Навигация — четыре вкладки словами: Сегодня, Упражнения, Прогресс, Программа.
- Одна светлая тема.

## Colors

Тёплая светло-серая база, чернила вместо цвета, три сигнальных цвета с бледными подложками.

### Primary
- **Чернила** (ink): текст, главная кнопка, выбранный чип, выбранный этап, активная вкладка, текущий шаг занятия, отметка «сейчас» на неделе.

### Secondary
- **Красный записи** (record-red): только микрофон и запись — кнопка «Стоп», рамка сцены и метка «Запись» во время записи, точка включённого микрофона, красная черта в логотипе.

### Tertiary
- **Синий данных** (data-blue): ссылки, фокус клавиатуры, выделение текста, линии графиков, полосы уровня навыка, живой индикатор громкости, текущее слово в скороговорке. Не для подписей, по которым нельзя нажать.
- **Зелёный нормы** (norm-green): норма достигнута, выполненный пункт плана, дни недели с занятием, полоса нормы на графиках, распознанное слово.
- **Охра** (caution) и **красный ошибки** (error): «почти» и «пропущено» в распознавании, предупреждения, ошибки, слова-паразиты.

### Neutral
- **Страница** (page): фон всего приложения; **поверхность** (surface): группы.
- **Элемент управления** (control / control-hover): фон второстепенных кнопок, чипов, select, пустых делений.
- **Чернила 2 и 3** (ink-secondary, ink-tertiary): пояснения и метаданные; ink-tertiary проходит AA и на белом (5,0:1), и на странице (4,6:1).
- **Линии** (rule, rule-soft): разделители строк и шапки.

### Named Rules
**The Quiet Color Rule.** Цвет появляется, только когда что-то значит. Украшающего цвета нет; основной ритм держат чернила и серые.

**The Red Means Recording Rule.** Красный — только запись. Прогресс занятия, текущий шаг и акценты — чернилами.

## Typography

**Display Font:** Golos Text (с system-ui)
**Body Font:** Golos Text
**Label/Mono Font:** нет — цифры набираются Golos Text с `font-variant-numeric: tabular-nums`

**Character:** Одна гарнитура, спроектированная для русского интерфейса. Иерархию делают размер и вес, а не смена шрифта. Подписи осей графиков и текст на холстах — тоже Golos Text.

### Hierarchy
- **Display** (700, clamp(30px, 3.4vw, 40px), 1.1): заголовок экрана.
- **Readout** (600, clamp(64px, 9vw, 104px), 1, tnum): табло замера в упражнении.
- **Title large** (700, 28px): название следующего упражнения на «Сегодня»; крупные значения метрик 28–32px весом 650.
- **Headline** (650, 20px): заголовок группы («План на сегодня», «Минуты по неделям»).
- **Title** (600, 16px): название строки, упражнения, навыка.
- **Lead** (400, 17px, ink-secondary): подводка под заголовком экрана, до 62ch.
- **Body** (400, 15px, 1.5): основной текст, до 72ch.
- **UI / Meta / Micro** (14 / 13 / 11px): элементы управления, метаданные строк, подписи делений.

### Named Rules
**The No Kicker Rule.** Над заголовком ничего не пишется. Дата, неделя, номер шага и фокус идут строкой под заголовком. Подпись группы допустима только над группой элементов управления («Сценарий», «Голос»), обычным регистром.

## Layout

Шапка 60px с вкладками, контент в колонке до 1120px по центру с полями 32px. «Сегодня» — сетка «основная колонка + 340px справа»: слева «Следующее» и план, справа неделя и фокус. Упражнение — сцена и справа инструкция 300px без коробки. Вертикальный ритм между блоками 32px, внутри групп 14–16px.

До 1040px правая колонка уходит под основную. До 760px вкладки становятся нижней панелью, шапка теряет название, поля 16px; инструкция упражнения идёт после сцены, ряд фильтров прокручивается с затуханием у края.

## Elevation & Depth

Плоско. Глубина — только тоном: серая страница → белая группа → серый элемент управления. Тень одна, у всплывающего тоста.

### Shadow Vocabulary
- **Toast** (`0 1px 2px rgba(23,24,26,.06), 0 8px 28px rgba(23,24,26,.10)`): только тост.

### Named Rules
**The No Border Rule.** У групп нет рамок и теней. Рамка появляется только как состояние: красное кольцо записи, чёрное кольцо текущего шага диагностики.

## Shapes

Скругления: группы 14px, списки и крупные кнопки 12px, обычные кнопки и select 10px, мелкие метки 8px, чипы и статусы — таблетки. Внутри групп строки списка отделяются разделителями, а не отдельными коробками.

## Components

### Buttons
- **Primary:** чернила, белый текст, 600; 40px, крупная 48px. Одна на экран.
- **Secondary:** серый элемент управления, чернильный текст.
- **Ghost:** без фона, ink-secondary; при наведении — серый фон.
- **Recording:** кнопка записи чёрная до старта; пока идёт запись — красная «Стоп».
- **Press:** `scale(0.97)` за 160ms `cubic-bezier(0.23, 1, 0.32, 1)`.

### Chips
- Таблетки на сером; выбранная — чернила с белым текстом. Только фильтры; длинные ряды прокручиваются одной строкой.

### Groups / Lists
- Белая группа 14px без рамки, отступ 24px. Строки — кнопки на всю ширину с разделителями rule-soft и серым ховером.

### Navigation
- Четыре вкладки словами, активная — чернилами с чертой 2px снизу; настройки — иконка справа. На телефоне — нижняя панель.

### Сцена записи (Signature)
Белая группа со сценой: название звука, табло Readout, живая полоса громкости на `transform: scaleX`, кнопка записи. Во время записи — красное кольцо 2px и метка «Запись» на верхней кромке, появляется за 180ms.

### План дня и занятие
Строки плана: кружок-отметка, название, мета, минуты справа. В занятии сверху — полоса делений: пройденные ink-tertiary, текущее чернилами, «Пропустить» и «Завершить» справа. Конец занятия — экран «Итог занятия» с замерами, изменением и целью недели.

### Показатели
Строка метрики: название, крупное значение, изменение с первого замера, зелёная «норма a–b», справа график с зелёной полосой нормы и ровными делениями оси. SVG графика рисуется в ширину колонки, без непропорционального растяжения.

## Do's and Don'ts

### Do:
- **Do** держать одну чёрную кнопку главного действия на экран.
- **Do** набирать все цифры с `tabular-nums` и единицей рядом серым.
- **Do** оставлять красный только за записью, синий — за ссылками и данными.
- **Do** писать дату, шаг и фокус строкой под заголовком.

### Don't:
- **Don't** ставить эйбрау или кикер над заголовком.
- **Don't** выстраивать одинаковые карточки в сетку и ряды статистики: цифры идут строками или фразой.
- **Don't** добавлять группам рамки или тени.
- **Don't** использовать теги-пилюли для метаданных: «5 мин · микрофон · ИИ» — обычный текст.
- **Don't** вводить второй шрифт, в том числе моноширинный для цифр.
