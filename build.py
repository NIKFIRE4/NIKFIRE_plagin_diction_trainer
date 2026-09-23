#!/usr/bin/env python3
"""Сборка Звукоряда.

Склеивает src/ в один HTML и собирает архив с мостом:
  dist/zvukoryad.html        — самостоятельная страница (открыть файлом или через мост)
  dist/index.html            — тот же тренажёр без <html>/<head> (для публикации как артефакт Claude)
  dist/zvukoryad-bridge.zip  — тренажёр + мост к Claude CLI для раздачи
  dist/bridge/               — файлы моста как отдельные файлы (для артефакта)

Нужны Python 3.8+ и Node.js (для проверки синтаксиса).
"""
import pathlib, subprocess, tempfile, zipfile

ROOT = pathlib.Path(__file__).resolve().parent
SRC, BRIDGE, OUT = ROOT / 'src', ROOT / 'bridge', ROOT / 'dist'
rd = lambda p: p.read_text(encoding='utf-8')


def build():
    OUT.mkdir(exist_ok=True)
    js = "(function(){'use strict';\n" + '\n'.join(rd(SRC / f) for f in ['data.js', 'engine.js', 'views.js']) + '\n})();'
    # проверка синтаксиса — чтобы сломанная сборка не ушла пользователям
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js)
    r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit('SYNTAX ERROR:\n' + r.stderr)
    page = rd(SRC / 'shell.html').replace('/*CSS*/', rd(SRC / 'style.css')).replace('/*JS*/', js)
    (OUT / 'index.html').write_text(page, encoding='utf-8')

    i = page.index('<div class="app">')
    full = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + page[:i] + '<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n</head>\n<body>\n'
            + page[i:] + '\n</body>\n</html>\n')
    (OUT / 'zvukoryad.html').write_text(full, encoding='utf-8')

    with zipfile.ZipFile(OUT / 'zvukoryad-bridge.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        def add(name, data, mode=0o644):
            zi = zipfile.ZipInfo('zvukoryad/' + name)
            zi.external_attr = (0o100000 | mode) << 16
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data)
        add('zvukoryad.html', full)
        add('zvukoryad-bridge.mjs', rd(BRIDGE / 'zvukoryad-bridge.mjs'))
        add('start-windows.cmd', rd(BRIDGE / 'start-windows.cmd').replace('\r\n', '\n').replace('\n', '\r\n'))
        add('start.sh', rd(BRIDGE / 'start.sh'), 0o755)
        add('README.txt', rd(BRIDGE / 'README.txt').replace('\r\n', '\n').replace('\n', '\r\n'))

    bd = OUT / 'bridge'
    bd.mkdir(exist_ok=True)
    (bd / 'zvukoryad-bridge.mjs').write_text(rd(BRIDGE / 'zvukoryad-bridge.mjs'), encoding='utf-8')
    (bd / 'start-windows.txt').write_text(rd(BRIDGE / 'start-windows.cmd'), encoding='utf-8')
    (bd / 'start.txt').write_text(rd(BRIDGE / 'start.sh'), encoding='utf-8')
    (bd / 'README.txt').write_text(rd(BRIDGE / 'README.txt'), encoding='utf-8')
    print(f"dist/zvukoryad.html {len(full) // 1024} КБ · dist/zvukoryad-bridge.zip {(OUT / 'zvukoryad-bridge.zip').stat().st_size // 1024} КБ")


if __name__ == '__main__':
    build()
