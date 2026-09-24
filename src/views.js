/* ===== Звукоряд: экраны и упражнения ===== */
const App = { route: 'home', leave: [], session: null, sample: null, downloads: null, framed: (() => { try { return window.top !== window.self; } catch (e) { return true; } })() };
const view = () => $('#view');
const onLeave = (fn) => App.leave.push(fn);
const exById = (id) => EXERCISES.find((e) => e.id === id);

function go(route) {
  App.leave.splice(0).forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  TTS.stop(); Voice.cancel();
  App.route = route;
  try { history.replaceState(null, '', '#' + route); } catch (e) {}
  render();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]'); if (!b) return;
  e.preventDefault(); go(b.dataset.go);
});

/* ---------- навигация ---------- */
const NAV = [
  { r: 'home', t: 'Сегодня', i: 'home' },
  { r: 'program', t: 'Моя программа', i: 'target' },
  { r: 'diag', t: 'Диагностика', i: 'gauge' },
  { label: 'Тренировка' },
  ...SECTIONS.map((s) => ({ r: 'sec-' + s.id, t: s.title, i: s.icon })),
  { label: 'Инструменты' },
  { r: 'ex-dialog', t: 'Собеседник', i: 'speak' },
  { r: 'ex-coach', t: 'ИИ-коуч', i: 'bubble' },
  { r: 'ex-upload', t: 'Анализ записи', i: 'file' },
  { r: 'progress', t: 'Прогресс', i: 'chart' },
  { r: 'method', t: 'Методика', i: 'book' },
  { r: 'settings', t: 'Настройки', i: 'gear' },
];
function renderNav() {
  const cur = App.route.startsWith('ex-') ? (exById(App.route.slice(3))?.sec === 'tools' || App.route === 'ex-coach' || App.route === 'ex-dialog' ? App.route : 'sec-' + exById(App.route.slice(3))?.sec) : App.route;
  $('#nav').innerHTML = NAV.map((n) => n.label ? `<div class="nav-label">${n.label}</div>` : `<button data-go="${n.r}" ${cur === n.r ? 'aria-current="page"' : ''}>${ico(n.i)}<span>${n.t}</span></button>`).join('');
  const s = Store.streak();
  $('#streak').innerHTML = `<b>${s}</b> ${plural(s, 'день', 'дня', 'дней')} подряд`;
}

/* ---------- микрофон в шапке ---------- */
function initMicChip() {
  const chip = $('#micchip');
  chip.innerHTML = `<span class="mic-dot"></span><span class="vu" aria-hidden="true">${'<i></i>'.repeat(10)}</span><span class="mic-pitch" id="mpitch">—</span><button id="mtoggle">Включить микрофон</button>`;
  const bars = $$('.vu i', chip), pitchEl = $('#mpitch', chip), btn = $('#mtoggle', chip);
  const upd = (s) => {
    chip.dataset.state = s;
    btn.textContent = s === 'on' ? 'Выключить' : s === 'denied' || s === 'unsupported' ? 'Нет доступа' : 'Включить микрофон';
    if (s !== 'on') { bars.forEach((b) => (b.className = '')); pitchEl.textContent = '—'; }
  };
  Mic.onState(upd); upd(Mic.state);
  btn.onclick = async () => {
    if (Mic.state === 'on') Mic.stop();
    else if (!(await Mic.start())) { micBlocked(); return; }
    go(App.route);
  };
  Mic.on((f) => {
    const lvl = clamp((f.db + 60) / 55, 0, 1), n = Math.round(lvl * 10);
    bars.forEach((b, i) => (b.className = i < n ? ('on' + (i >= 7 ? ' hot' : '') + (i >= 9 ? ' clip' : '')) : ''));
    pitchEl.textContent = f.hz > 0 ? `${Math.round(f.hz)} Гц` : '—';
  });
}
async function needMic() {
  if (Mic.state === 'on') return true;
  const ok = await Mic.start();
  if (!ok) micBlocked();
  return ok;
}
function micBlocked() { toast(App.framed ? 'В этом окне микрофон недоступен — откройте полную версию.' : (Mic.error || 'Нет доступа к микрофону') + ' Разрешите доступ в адресной строке браузера.', 4200); go(App.route); }
function micNotice(compact) {
  const blockedEnv = App.framed && Mic.state !== 'on';
  if (!blockedEnv && Mic.state !== 'denied' && Mic.state !== 'unsupported') return '';
  const dl = App.downloads ? `<div class="stack" style="gap:6px;flex:none"><button class="btn primary" data-dlbridge>${ico('download')}С мостом к Claude CLI (.zip)</button><button class="btn" data-dl>Только тренажёр (.html)</button></div>` : '';
  return `<div class="notice">
    <div style="flex:1"><b>${blockedEnv ? 'В этом окне браузер не даёт доступ к микрофону.' : 'Нет доступа к микрофону.'}</b>
    ${blockedEnv ? 'Чтобы говорить с тренажёром — с распознаванием речи, графиком высоты и замерами — скачайте полную версию и откройте в Chrome или Edge. Лучше — архив с мостом: он откроет тренажёр по адресу localhost с микрофоном и подключит ИИ через ваш Claude CLI. Прогресс там ведётся отдельно.' : 'Разрешите доступ к микрофону в адресной строке браузера и обновите страницу. Распознавание речи работает в Chrome и Edge.'}
    ${blockedEnv ? '<br>Здесь уже работают гимнастика, дыхание, слоговые таблицы, ручные замеры, анализ аудиозаписи и ИИ-коуч.' : ''}</div>${dl}</div>`;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-dl]')) return;
  try {
    const res = await fetch('zvukoryad.html'); if (!res.ok) throw new Error('fetch');
    const text = await res.text();
    await App.downloads.save({ filename: 'zvukoryad.html', data: new Blob([text], { type: 'text/html' }) });
  } catch (err) { if (!err || err.code !== 'declined') toast('Не удалось сохранить файл. Полная версия есть в чате с Claude.'); }
});

/* ---------- общий рендер ---------- */
function render() {
  renderNav();
  const r = App.route, v = view();
  let crumb = 'Звукоряд';
  if (r === 'home') { crumb = 'Сегодня'; viewHome(v); }
  else if (r === 'program') { crumb = 'Моя программа'; viewProgram(v); }
  else if (r === 'diag') { crumb = 'Диагностика'; viewDiag(v); }
  else if (r === 'progress') { crumb = 'Прогресс'; viewProgress(v); }
  else if (r === 'method') { crumb = 'Методика'; viewMethod(v); }
  else if (r === 'settings') { crumb = 'Настройки'; viewSettings(v); }
  else if (r.startsWith('sec-')) { const s = SECTIONS.find((x) => x.id === r.slice(4)); if (!s) return go('home'); crumb = s.title; viewSection(v, s); }
  else if (r.startsWith('ex-')) { const ex = exById(r.slice(3)); if (!ex) return go('home'); const s = SECTIONS.find((x) => x.id === ex.sec); crumb = (s ? s.title + ' · ' : '') + ex.title; viewExercise(v, ex); }
  else return go('home');
  $('#crumb').textContent = crumb;
}

/* ---------- ИИ ---------- */
function aiErr(e) {
  const m = { not_granted: App.aiSource === 'cli' ? 'Мост отклонил ключ — переподключитесь в настройках ИИ.' : 'Доступ к Claude не разрешён.', rate_limited: 'Слишком много запросов — попробуйте через минуту.', cancelled: 'Остановлено.', offline: 'Мост к Claude CLI не отвечает — проверьте, что он запущен.', busy: 'Мост занят предыдущим ответом — подождите.' };
  if (e && e.code === 'bridge' && e.message) return 'Claude CLI: ' + e.message;
  return m[e && e.code] || 'Не удалось получить ответ. Попробуйте ещё раз.';
}
/* ---------- ИИ через локальный мост к Claude CLI ---------- */
function parseJSONLoose(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) {} }
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  throw { code: 'invalid_json', message: 'Ответ не в формате JSON', text: t };
}
function bridgeBase(cfg) { return (cfg.url || location.origin).replace(/\/+$/, ''); }
function cliSample(cfg) {
  const base = bridgeBase(cfg);
  const call = async (input, opts = {}) => {
    const prompt = typeof input === 'string' ? input
      : input.map((t, i) => (i === 0 && t.role === 'user' ? 'Инструкция:\n' + t.content : (t.role === 'user' ? 'Пользователь: ' : 'Коуч: ') + t.content)).join('\n\n') + '\n\nОтветь как коуч на последнее сообщение пользователя.';
    let res;
    try { res = await fetch(base + '/api/ask', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' }, body: JSON.stringify({ prompt, tier: opts.modelTier || 'default' }), signal: opts.signal }); }
    catch (e) { throw { code: e && e.name === 'AbortError' ? 'cancelled' : 'offline', message: String(e) }; }
    if (res.status === 401) throw { code: 'not_granted', message: 'bad token' };
    if (res.status === 429) throw { code: 'busy', message: 'busy' };
    if (!res.ok || !res.body) throw { code: 'bridge', message: 'HTTP ' + res.status };
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '';
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
          let m; try { m = JSON.parse(line); } catch (e) { continue; }
          if (m.t === 'delta') { text += m.text; opts.onText && opts.onText({ text, delta: m.text }); }
          else if (m.t === 'done' && !text && m.text) { text = m.text; opts.onText && opts.onText({ text, delta: m.text }); }
          else if (m.t === 'error') throw { code: 'bridge', message: m.message, text };
        }
      }
    } catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelled', text }; throw e; }
    if (!text) throw { code: 'bridge', message: 'пустой ответ' };
    return { text, truncated: false };
  };
  call.json = async (input, opts) => { const { text } = await call(input, opts); return parseJSONLoose(text); };
  return call;
}
/* постоянная сессия собеседника в Claude CLI: контекст держит сам CLI, ответ без холодного старта */
function canCliChat() { return App.aiSource === 'cli' && App.bridgeInfo && App.bridgeInfo.bridgeVersion >= 4 && App.bridgeInfo.chat !== false; }
function cliChat(system, tier) {
  const cfg = bridgeCfg(), base = bridgeBase(cfg), hdr = { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' };
  let closed = false;
  const idP = fetch(base + '/api/chat/open', { method: 'POST', headers: hdr, body: JSON.stringify({ system, tier }) }).then((r) => r.json()).then((j) => { if (!j.id) throw new Error(j.error || 'no session'); return j.id; });
  idP.catch(() => {});
  return {
    async say(text, { onText, signal } = {}) {
      const id = await idP;
      let res;
      try { res = await fetch(base + '/api/chat/say', { method: 'POST', headers: hdr, body: JSON.stringify({ id, text }), signal }); }
      catch (e) { throw { code: e && e.name === 'AbortError' ? 'cancelled' : 'offline', message: String(e) }; }
      if (res.status === 410) throw { code: 'gone', message: 'session gone' };
      if (!res.ok || !res.body) throw { code: 'bridge', message: 'HTTP ' + res.status };
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', out = '';
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true }); let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
            let m; try { m = JSON.parse(line); } catch (e) { continue; }
            if (m.t === 'delta') { out += m.text; onText && onText({ text: out }); }
            else if (m.t === 'done' && !out && m.text) { out = m.text; onText && onText({ text: out }); }
            else if (m.t === 'error') throw { code: m.message === 'cancelled' ? 'cancelled' : 'bridge', message: m.message, text: out };
          }
        }
      } catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled', text: out }; throw e; }
      return out;
    },
    close() { if (closed) return; closed = true; idP.then((id) => fetch(base + '/api/chat/close', { method: 'POST', headers: hdr, body: JSON.stringify({ id }), keepalive: true })).catch(() => {}); },
  };
}
function bridgeCfg() { return window.ZV_BRIDGE || Store.d.settings.bridge || null; }
async function connectBridge(cfg) {
  const r = await fetch(bridgeBase(cfg) + '/api/health', { headers: { 'x-zv-token': cfg.token || '' } });
  if (r.status === 401) throw new Error('Неверный ключ моста');
  if (!r.ok) throw new Error('Мост ответил ' + r.status);
  const info = await r.json();
  App.bridgeInfo = info; App.whisper = info.whisper || null; App.tts = info.tts || null;
  if (!info.cli) throw new Error('Мост запущен, но не нашёл Claude CLI');
  App.sample = cliSample(cfg); App.aiSource = 'cli'; App.cliInfo = info; setAi('ok');
  return info;
}
function aiPanel() {
  const cfg = Store.d.settings.bridge || {};
  if (App.aiSource === 'claude') return `<div class="stack"><div class="row"><span class="verdict good">Подключено</span><span class="small">ИИ работает через ваш аккаунт Claude в этом окне.</span></div>
    <p class="small muted">Для скачанной версии (с микрофоном) ИИ подключается через ваш Claude CLI — нужен небольшой мост.${App.downloads ? '' : ' Архив с мостом есть в чате с Claude.'}</p>
    ${App.downloads ? `<button class="btn" data-dlbridge style="align-self:flex-start">${ico('download')}Скачать тренажёр с мостом (.zip)</button>` : ''}</div>`;
  const on = App.aiSource === 'cli';
  const served = !!window.ZV_BRIDGE;
  return `<div class="stack">
    <div class="row">${on ? `<span class="verdict good">Подключено</span><span class="small">Claude CLI ${esc(App.cliInfo?.cli || '')} · модель: ${esc(App.cliInfo?.model || 'по умолчанию')}</span>` : '<span class="verdict warn">Не подключено</span><span class="small muted">ИИ-коуч и разборы работают через ваш собственный Claude CLI.</span>'}</div>
    ${App.bridgeInfo && !App.bridgeInfo.cli ? `<div class="notice bad"><div style="flex:1;display:flex;flex-direction:column;gap:8px"><b>Мост запущен, но не нашёл Claude CLI.</b>
      ${(App.bridgeInfo.tried || []).length ? `<span class="small">Проверены пути:</span><ul class="small" style="margin:0;padding-left:18px">${App.bridgeInfo.tried.map((t) => `<li><code>${esc(t.bin)}</code>${t.info ? ' — ' + esc(t.info) : ''}</li>`).join('')}</ul>` : ''}
      <span class="small">Укажите путь к <code>claude.exe</code> (или <code>claude.cmd</code>). Узнать его: в терминале <code>where claude</code> (Windows) или <code>which claude</code> (macOS/Linux). Если Claude Code стоит как расширение VS Code — путь вида <code>C:\\Users\\Имя\\.vscode\\extensions\\anthropic.claude-code-…\\resources\\native-binary\\claude.exe</code>.</span>
      <div class="row"><input id="brPath" placeholder="Путь к claude" style="flex:1;min-width:200px;border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--surface);font-family:var(--f-mono);font-size:13px"><button class="btn primary" id="brPathGo">Проверить</button><button class="btn ghost" id="brRescan">Искать снова</button></div>
      <span class="small" id="brPathSt"></span></div></div>` : ''}
    ${served ? '' : `<div class="grid2"><label class="stack small" style="gap:4px">Адрес моста<input id="brUrl" value="${esc(cfg.url || 'http://localhost:8787')}" style="border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--surface)"></label>
      <label class="stack small" style="gap:4px">Ключ (печатается при запуске моста)<input id="brTok" value="${esc(cfg.token || '')}" autocomplete="off" style="border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--surface);font-family:var(--f-mono)"></label></div>
    <div class="row"><button class="btn primary" id="brGo">Подключить</button>${on ? '<button class="btn ghost" id="brOff">Отключить</button>' : ''}<span class="small muted" id="brSt"></span></div>`}
    <details${on ? '' : ' open'}><summary class="small" style="cursor:pointer">Как подключить свой Claude CLI</summary>
      <ol class="small" style="margin:10px 0 0;padding-left:20px;color:var(--ink-2);display:flex;flex-direction:column;gap:6px">
        <li>Установите Node.js 18+ и Claude Code CLI: <code>npm install -g @anthropic-ai/claude-code</code>. Один раз запустите <code>claude</code> и войдите в свой аккаунт.</li>
        <li>Распакуйте архив «Звукоряд с мостом» в любую папку.</li>
        <li>Запустите мост: на Windows — двойной клик по <code>start-windows.cmd</code>; на macOS/Linux — <code>./start.sh</code> или <code>node zvukoryad-bridge.mjs</code>.</li>
        <li>Откроется <code>http://localhost:8787</code> — тренажёр с микрофоном и ИИ. Ничего вводить не нужно.</li>
        <li>Если открываете тренажёр иначе (файлом или с сайта) — впишите сюда адрес и ключ, которые мост печатает при запуске.</li>
      </ol>
      <p class="small muted" style="margin-top:8px">Каждый человек подключает свой CLI: запросы идут через его аккаунт и лимиты Claude. Мост слушает только этот компьютер (127.0.0.1) и отвечает лишь тем, у кого есть ключ.</p></details></div>`;
}
function bindAiPanel() {
  const setPath = async (pth) => {
    const cfg = bridgeCfg(); if (!cfg) return;
    $('#brPathSt').textContent = 'Проверяю… (до 30 секунд)';
    try {
      const r = await fetch(bridgeBase(cfg) + '/api/claude-path', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' }, body: JSON.stringify({ path: pth }) });
      const j = await r.json(); App.bridgeInfo = { ...(App.bridgeInfo || {}), tried: j.tried, cli: j.cli };
      if (j.ok) { await connectBridge(cfg); toast('Claude CLI подключён'); go(App.route); }
      else { go(App.route); }
    } catch (e) { $('#brPathSt').textContent = 'Мост не отвечает — перезапустите его.'; }
  };
  const pg = $('#brPathGo'); if (pg) pg.onclick = () => setPath($('#brPath').value.trim());
  const rs = $('#brRescan'); if (rs) rs.onclick = () => setPath('');
  const go_ = $('#brGo'); if (!go_) return;
  go_.onclick = async () => {
    const cfg = { url: $('#brUrl').value.trim() || 'http://localhost:8787', token: $('#brTok').value.trim() };
    $('#brSt').textContent = 'Проверяю…';
    try { await connectBridge(cfg); Store.d.settings.bridge = cfg; Store.save(); toast('Claude CLI подключён'); go(App.route); }
    catch (e) { $('#brSt').textContent = e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message) ? e.message : 'Мост не отвечает. Запущен ли он? Совпадает ли адрес?'; }
  };
  const off = $('#brOff'); if (off) off.onclick = () => { delete Store.d.settings.bridge; Store.save(); App.sample = null; App.aiSource = null; setAi('none', 'Claude CLI отключён в настройках'); go(App.route); };
}
/* сборка zip прямо в браузере (без сжатия) */
function makeZip(files) {
  const crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, c = crc(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint32(14, c, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 0x0314, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(38, ((f.exec ? 0o100755 : 0o100644) << 16) >>> 0, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((a, x) => a + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-dlbridge]'); if (!btn) return;
  btn.disabled = true;
  try {
    const get = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(p); return r.text(); };
    const [html, mjs, cmd, sh, readme] = await Promise.all(['zvukoryad.html', 'bridge/zvukoryad-bridge.mjs', 'bridge/start-windows.txt', 'bridge/start.txt', 'bridge/README.txt'].map(get));
    const zip = makeZip([
      { name: 'zvukoryad/zvukoryad.html', data: html }, { name: 'zvukoryad/zvukoryad-bridge.mjs', data: mjs },
      { name: 'zvukoryad/start-windows.cmd', data: cmd.replace(/\r?\n/g, '\r\n') }, { name: 'zvukoryad/start.sh', data: sh, exec: true },
      { name: 'zvukoryad/README.txt', data: readme.replace(/\r?\n/g, '\r\n') },
    ]);
    await App.downloads.save({ filename: 'zvukoryad-bridge.zip', data: zip });
  } catch (err) { if (!err || err.code !== 'declined') toast('Не удалось собрать архив. Он есть в чате с Claude.'); }
  btn.disabled = false;
});
/* ---------- состояние ИИ ---------- */
App.ai = { state: 'checking', reason: '' };
function setAi(state, reason) { App.ai = { state, reason: reason || '' }; renderAiChip(); }
function aiReasonFrom(e) {
  if (!e) return 'нет связи';
  if (e.code === 'offline') return 'мост к Claude CLI не отвечает — запустите start-windows.cmd';
  if (e.code === 'not_granted') return App.aiSource === 'cli' ? 'мост отклонил ключ' : 'доступ к Claude не разрешён';
  if (e.code === 'rate_limited') return 'лимит запросов, попробуйте позже';
  if (e.code === 'bridge') return 'Claude CLI: ' + (e.message || 'ошибка');
  return e.message || 'ошибка';
}
function renderAiChip() {
  const c = $('#aichip'); if (!c) return;
  const a = App.ai, on = a.state === 'ok';
  c.dataset.state = a.state;
  c.title = on ? (App.aiSource === 'cli' ? 'ИИ работает через ваш Claude CLI' : 'ИИ работает через Claude') : a.state === 'checking' ? 'Проверяю подключение ИИ…' : 'ИИ недоступен: ' + a.reason;
  c.innerHTML = `<span class="ai-dot"></span><span>ИИ</span><span class="ai-st">${on ? (App.aiSource === 'cli' ? 'Claude CLI' : 'Claude') : a.state === 'checking' ? 'проверка…' : 'недоступен'}</span>`;
}
let lastReconnect = 0;
async function ensureAi() {
  if (App.sample && App.ai.state === 'ok') return true;
  const cfg = bridgeCfg();
  if (!App.framed && cfg && Date.now() - lastReconnect > 8000) {
    lastReconnect = Date.now();
    try { await connectBridge(cfg); return true; } catch (e) { setAi('error', App.bridgeInfo && !App.bridgeInfo.cli ? 'мост запущен, но не нашёл Claude CLI' : 'мост к Claude CLI не запущен'); }
  }
  return !!App.sample && App.ai.state !== 'error';
}
/* мини-markdown: **жирный**, списки "- ", абзацы */
function mdLite(t) {
  const lines = esc(t).split(/\n/); let out = '', inList = false;
  const inl = (x) => x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  for (let l of lines) {
    const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inl(m[1])}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    const h = l.replace(/^#+\s*/, '');
    if (h.trim()) out += `<p>${inl(h)}</p>`;
  }
  if (inList) out += '</ul>';
  return out;
}
const COACH_RULES = () => `Ты — сильный, прямой и доброжелательный тренер по технике речи (дикция, дыхание, голос, интонация, ораторское мастерство). Ученик только что выполнил упражнение в тренажёре «Звукоряд»; ниже — данные его попытки.
Важно: текст получен автоматическим распознаванием речи в браузере. Расхождение распознанного с эталоном может быть и ошибкой распознавания — формулируй осторожно («вероятно, смазан звук…»), но конкретно: называй слова и звуки.
Пиши по-русски, без вступлений, без заголовков markdown, 60–140 слов. Формат:
**Итог:** одна фраза с честной оценкой.
Затем 2–4 пункта списком через "- ": что хорошо и что конкретно исправить (со ссылкой на слова, звуки, цифры).
Последний пункт — «**Сейчас:**» одно конкретное действие на следующую попытку.
Контекст ученика: ${profileSummary()}`;
function aiOffHTML() {
  const a = App.ai;
  const why = a.state === 'checking' ? 'подключение ещё проверяется' : a.reason || (App.framed ? 'нет доступа к Claude' : 'не подключён Claude CLI');
  return `<div class="ai-off"><span class="ai-dot"></span><span>ИИ-разбор недоступен: ${esc(why)}. Показаны только автоматические метрики.</span><button class="btn ghost" data-go="settings" style="min-height:0;padding:2px 8px;color:var(--accent)">Подключить</button></div>`;
}
/* блок обратной связи ИИ: запускается сам после результата */
async function aiFeedback(el, { prompt, tier = 'default', title = 'Разбор ИИ-коуча' }) {
  if (!el) return;
  el.hidden = false;
  if (!(await ensureAi())) { el.innerHTML = aiOffHTML(); return; }
  el.innerHTML = `<div class="ai-box"><div class="ai-head"><span class="ai-dot"></span><b>${esc(title)}</b><span class="small muted ai-wait">анализирую…</span><button class="btn ghost ai-stop" style="min-height:0;padding:2px 8px;margin-left:auto">Стоп</button></div><div class="ai-body"><span class="ai-pulse">Слушаю запись и готовлю разбор…</span></div></div>`;
  const body = $('.ai-body', el), wait = $('.ai-wait', el), stop = $('.ai-stop', el);
  const ctl = new AbortController(); onLeave(() => ctl.abort()); stop.onclick = () => ctl.abort();
  try {
    await App.sample(COACH_RULES() + '\n\n' + prompt, { signal: ctl.signal, modelTier: tier, cache: false, onText: ({ text }) => { body.innerHTML = mdLite(text); wait.textContent = 'пишет…'; } });
    wait.textContent = ''; stop.remove(); if (App.ai.state !== 'ok') setAi('ok');
  } catch (e) {
    wait.textContent = ''; stop.remove();
    if (e && e.code === 'cancelled') { if (!e.text) body.innerHTML = '<span class="muted">Остановлено.</span>'; return; }
    const reason = aiReasonFrom(e);
    if (['offline', 'not_granted', 'bridge'].includes(e && e.code)) setAi('error', reason);
    body.innerHTML = (e && e.text ? mdLite(e.text) : '') + `<div class="ai-off" style="margin-top:6px"><span class="ai-dot"></span><span>ИИ-разбор не получился: ${esc(reason)}.</span></div>`;
  }
}
/* ---------- Whisper через мост ---------- */
App.whisper = null;
function useWhisper() { return !App.framed && App.whisper && App.whisper.ready && Store.d.settings.stt !== 'browser' && bridgeCfg(); }
async function whisperTranscribe(blob) {
  const cfg = bridgeCfg(); const wav = await blobToWav16k(blob);
  const r = await fetch(bridgeBase(cfg) + '/api/transcribe', { method: 'POST', headers: { 'content-type': 'audio/wav', 'x-zv-token': cfg.token || '' }, body: wav });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
const engineLabel = (r) => r && r.engine === 'whisper' ? '<span class="tag" title="Расшифровка Whisper">Whisper</span>' : r && r.engine === 'browser' ? `<span class="tag" title="Распознавание браузера${r.whisperError ? '. Whisper: ' + esc(r.whisperError) : ''}">браузер${r.whisperError ? ' · Whisper: ошибка' : ''}</span>` : '';
function sttPanel() {
  if (App.framed) return '<p class="small muted">В окне Claude микрофон недоступен. Whisper работает в скачанной версии через мост.</p>';
  const cfg = bridgeCfg();
  if (!cfg) return '<p class="small muted">Сейчас используется распознавание браузера. Точное распознавание Whisper работает через мост — запустите его из архива.</p>';
  if (App.bridgeInfo && !App.bridgeInfo.whisper) return '<div class="notice"><div style="flex:1"><b>Мост нужно перезапустить.</b> Закройте чёрное окно моста и снова запустите <code>start-windows.cmd</code> — после этого здесь появится Whisper. Дальше мост будет обновляться сам.</div></div>';
  const w = App.whisper || {}, job = w.job, busy = job && !['done', 'error'].includes(job.stage);
  const pctv = job && job.total ? Math.round((job.got / job.total) * 100) : 0;
  const stageT = { start: 'подготовка', bin: 'скачиваю whisper.cpp', unpack: 'распаковываю', model: 'скачиваю модель' };
  const mode = Store.d.settings.stt === 'browser' ? 'browser' : 'auto';
  return `<div class="stack" style="gap:10px">
    <div class="chips" id="sttMode"><button class="chip" data-m="auto" aria-pressed="${mode === 'auto'}">Whisper, если установлен</button><button class="chip" data-m="browser" aria-pressed="${mode === 'browser'}">Только браузер</button></div>
    <div class="row small">${w.ready ? `<span class="verdict good">Whisper готов</span><span>модель: ${esc((w.models && w.models[w.model] && w.models[w.model].title) || w.model)}</span>` : '<span class="verdict warn">Whisper не установлен</span><span class="muted">сейчас работает распознавание браузера</span>'}</div>
    ${busy ? `<div class="stack" style="gap:6px"><span class="small">${stageT[job.stage] || job.stage}… ${job.total ? pctv + '% (' + Math.round(job.got / 1048576) + ' из ' + Math.round(job.total / 1048576) + ' МБ)' : ''}</span><div class="meter"><i style="width:${pctv}%"></i></div></div>` : ''}
    ${manualHelpHTML(job, 'whisper')}
    ${w.lastError ? `<p class="small bad">Последняя ошибка Whisper: ${esc(w.lastError)}</p>` : ''}
    ${w.ready ? `<p class="small muted">${w.loaded ? 'Модель загружена в память — расшифровка быстрая.' : 'Модель загрузится в память при первой расшифровке.'}</p>` : ''}
    ${!busy ? `<div class="row">${w.models ? Object.entries(w.models).map(([k, m]) => m.present ? (w.model !== k ? `<button class="btn" data-wuse="${k}">Использовать: ${esc(m.title)}</button>` : '') : `<button class="btn ${k === 'turbo' ? 'primary' : ''}" data-winst="${k}">${ico('download')}${w.ready ? 'Докачать' : 'Установить'}: ${esc(m.title)} · ${m.mb} МБ</button>`).join('') : ''}</div>` : ''}
    <p class="small muted">Whisper — нейросеть распознавания речи, работает прямо на вашем компьютере, без интернета после установки. Точная модель заметно лучше понимает русский, но расшифровка занимает несколько секунд. Браузерное распознавание остаётся для живого текста во время речи.</p></div>`;
}
let sttPoll = 0;
function bindSttPanel() {
  const box = $('#sttBox'); if (!box) return;
  const cfg = bridgeCfg();
  const refresh = async () => { try { const r = await fetch(bridgeBase(cfg) + '/api/whisper', { headers: { 'x-zv-token': cfg.token || '' } }); if (r.ok) { App.whisper = await r.json(); } } catch (e) {} const b = $('#sttBox'); if (b) { b.innerHTML = sttPanel(); bindSttPanel(); } };
  const m = $('#sttMode'); if (m) m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; Store.d.settings.stt = b.dataset.m; Store.save(); refresh(); };
  $$('[data-winst]', box).forEach((b) => (b.onclick = async () => { b.disabled = true; await fetch(bridgeBase(cfg) + '/api/whisper/install', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' }, body: JSON.stringify({ model: b.dataset.winst }) }).catch(() => {}); refresh(); }));
  $$('[data-wuse]', box).forEach((b) => (b.onclick = async () => { await fetch(bridgeBase(cfg) + '/api/whisper/use', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' }, body: JSON.stringify({ model: b.dataset.wuse }) }).catch(() => {}); refresh(); }));
  bindManualHelp(box, refresh);
  clearTimeout(sttPoll);
  const job = App.whisper && App.whisper.job;
  if (job && !['done', 'error'].includes(job.stage)) sttPoll = setTimeout(refresh, 1000);
}
const issuesForAi = (iss) => (iss || []).slice(0, 12).map((x) => `«${x.word}» → ${x.heard ? '«' + x.heard + '»' : 'не распознано'}${x.kind === 'near' ? ' (похоже)' : ''}`).join('; ') || 'нет';
function profileSummary() {
  const d = Store.d, L = (k) => Store.last(k);
  const parts = [];
  parts.push(`Пол для норм: ${d.settings.sex === 'f' ? 'женский' : 'мужской'}.`);
  if (L('mpt') != null) parts.push(`Время фонации: ${fmt(L('mpt'))} с (первый замер ${fmt(Store.first('mpt'))} с).`);
  if (L('sLen') != null) parts.push(`Выдох на «С»: ${fmt(L('sLen'))} с.`);
  if (L('sz') != null) parts.push(`Индекс S/Z: ${fmt(L('sz'), 2)}.`);
  if (L('range') != null) parts.push(`Диапазон: ${fmt(L('range'), 0)} полутонов.`);
  if (L('wpm') != null) parts.push(`Темп чтения: ${fmt(L('wpm'), 0)} слов/мин.`);
  if (L('acc') != null) parts.push(`Разборчивость (распознавание): ${fmt(L('acc'), 0)}%.`);
  if (L('mono') != null) parts.push(`Мелодика (разброс высоты): ${fmt(L('mono'))} пт.`);
  if (L('fillers') != null) parts.push(`Слова-паразиты: ${fmt(L('fillers'))} в минуту.`);
  parts.push(`Серия занятий: ${Store.streak()} дн., за неделю ${Store.weekMinutes()} мин.`);
  const P = d.program;
  if (P && P.focus && P.focus.length) parts.push(`Фокус программы на эту неделю: ${P.focus.map((id) => skillById(id).title).join(', ')}.`);
  return parts.join(' ');
}

/* ========== ПРОГРАММА: уровень навыков, прогноз, план дня ========== */
const WEEK = 7 * 864e5;
const skillById = (id) => SKILLS.find((s) => s.id === id);
const bySex = (x) => (x && typeof x === 'object' ? x[Store.d.settings.sex] : x);
const skillVal = (s, v) => `${fmt(v, s.dg)} ${s.unit}`;
const skillGoalText = (s) => (s.band ? `${s.band[0]}–${s.band[1]} ${s.unit}` : `${s.lower ? '≤ ' : ''}${fmt(bySex(s.good), s.dg)} ${s.unit}`);
const ruDate = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const weeksT = (n) => `${n} ${plural(n, 'неделя', 'недели', 'недель')}`;
/* уровень навыка: 0% — floor, 100% — хороший уровень; для темпа — расстояние до коридора нормы */
function skillScore(s, v) {
  if (v == null || !isFinite(v)) return null;
  if (s.band) { const [lo, hi] = s.band; return clamp(100 - (v < lo ? lo - v : v > hi ? v - hi : 0) * 2.5, 0, 100); }
  const g = bySex(s.good), f = bySex(s.floor);
  return clamp(((v - f) / (g - f)) * 100, 0, 100);
}
const skillReached = (s, v) => skillScore(s, v) >= 99.5;
/* неделя тренировки с темпом r (для паразитов r — в логарифмах: доля убывает в e^r раз) */
function skillStep(s, v, r) {
  if (s.band) { const [lo, hi] = s.band; return v < lo ? Math.min(lo, v + r) : v > hi ? Math.max(hi, v - r) : v; }
  const g = bySex(s.good);
  return s.lower ? Math.max(g, v * Math.exp(-r)) : Math.min(g, v + r);
}
const refRate = (s) => (s.lower ? -Math.log(1 - s.rate) : s.rate);
function rateText(s, r) {
  if (s.lower) return `−${Math.round((1 - Math.exp(-r)) * 100)}% в неделю`;
  return s.band ? `${fmt(r, s.dg || 1)} ${s.unit} в неделю к норме` : `+${fmt(r, s.dg || 1)} ${s.unit} в неделю`;
}
/* текущее состояние навыка по замерам */
function skillView(s) {
  const pts = daily(s.metric, s.agg);
  if (!pts.length) return { s, v: null, score: null, n: 0, eff: refRate(s), conf: 'none', reached: false };
  const tail = pts.slice(-3), v = tail.reduce((a, p) => a + p.v, 0) / tail.length;
  // личный темп — наклон дневных значений за 4 недели (нужно 3+ дня замеров на отрезке от 4 дней)
  const rec = pts.filter((p) => p.t >= Date.now() - 4 * WEEK);
  let trend = null;
  if (rec.length >= 3 && rec[rec.length - 1].t - rec[0].t >= 4 * 864e5) {
    const b = linfit(rec.map((p) => p.t / WEEK), rec.map((p) => (s.lower ? Math.log(Math.max(0.2, p.v)) : p.v))).b;
    trend = b * (s.lower ? -1 : s.band && v > s.band[1] ? -1 : 1);
  }
  const ref = refRate(s);
  const eff = trend == null ? ref : trend > 0 ? clamp(0.5 * ref + 0.5 * trend, 0.5 * ref, 2 * ref) : 0.75 * ref;
  return { s, v, score: skillScore(s, v), n: pts.length, first: pts[0].v, firstT: pts[0].t, trend, eff, conf: trend == null ? 'typical' : trend > 0 ? 'personal' : 'stall', reached: skillReached(s, v) };
}
/* симуляция по неделям: два самых слабых навыка в фокусе идут полным темпом, остальные — долей side */
function simulate(views, maxW = 52) {
  const cur = views.filter((x) => x.v != null).map((x) => ({ x, val: x.v, eta: x.reached ? 0 : null }));
  const rows = [];
  for (let w = 1; w <= maxW && cur.some((c) => c.eta == null); w++) {
    const open = cur.filter((c) => c.eta == null).sort((a, b) => skillScore(a.x.s, a.val) - skillScore(b.x.s, b.val));
    const focus = new Set(open.slice(0, 2).map((c) => c.x.s.id));
    cur.forEach((c) => { if (c.eta != null) return; c.val = skillStep(c.x.s, c.val, c.x.eff * (focus.has(c.x.s.id) ? 1 : c.x.s.side)); if (skillReached(c.x.s, c.val)) c.eta = w; });
    rows.push({ w, vals: Object.fromEntries(cur.map((c) => [c.x.s.id, c.val])), focus });
  }
  const eta = Object.fromEntries(cur.map((c) => [c.x.s.id, c.eta]));
  const all = cur.every((c) => c.eta != null);
  return { rows, eta, weeks: all ? Math.max(0, ...cur.map((c) => c.eta)) : null };
}
/* последний контрольный замер = диагностика */
function lastCheck() {
  const days = Object.keys(Store.d.done).filter((k) => Store.d.done[k].includes('diag')).sort();
  let t = days.length ? new Date(days[days.length - 1] + 'T12:00').getTime() : null;
  if (t == null) { const h = Store.d.history.find((x) => /^Диагностика:/.test(x.text) && !/без замеров/.test(x.text)); if (h) t = h.t; }
  const today = Store.doneToday('diag'), days_ = t == null ? null : Math.round((new Date().setHours(12, 0, 0, 0) - new Date(t).setHours(12, 0, 0, 0)) / 864e5);
  return { t, days: days_, today, due: t == null || days_ >= 7 };
}
/* сколько дней в неделю реально занимаетесь (за последние 2 недели) */
function trainingRhythm() {
  const span = Math.min(14, Store.dayIndex() + 1); let n = 0; const d = new Date();
  for (let i = 0; i < span; i++) { if (Store.d.days[dayKey(d)]) n++; d.setDate(d.getDate() - 1); }
  return { perWeek: (n / span) * 7, span };
}
/* состояние программы; фокус пересчитывается раз в 7 дней, после контрольного замера или когда фокусный навык достиг цели */
function program() {
  const d = Store.d;
  if (!d.program) d.program = { started: d.created, focus: [], focusAt: 0, base: {} };
  const P = d.program, views = SKILLS.map(skillView), V = (id) => views.find((x) => x.s.id === id);
  const measured = views.filter((x) => x.v != null);
  const ord = [...measured].sort((a, b) => a.score - b.score), open = ord.filter((x) => !x.reached);
  const need = !P.focus.length || Date.now() - P.focusAt >= WEEK || P.focus.some((id) => !V(id) || V(id).v == null || (V(id).reached && open.some((x) => !P.focus.includes(x.s.id))));
  if (need && measured.length) {
    P.focus = (open.length ? open : ord).slice(0, 2).map((x) => x.s.id);
    P.focusAt = Date.now();
    P.base = Object.fromEntries(measured.map((x) => [x.s.id, x.v]));
    Store.save();
  }
  const sim = simulate(views);
  const week = Math.floor((Date.now() - P.started) / WEEK) + 1;
  /* цель недели: где навык должен оказаться к концу текущего недельного цикла */
  const weekTarget = (x) => { if (x.v == null) return null; const base = P.base[x.s.id] ?? x.v; return skillStep(x.s, base, x.eff * (P.focus.includes(x.s.id) ? 1 : x.s.side)); };
  return { P, views, V, measured, sim, week, chk: lastCheck(), weekTarget, focus: P.focus.filter((id) => V(id) && V(id).v != null) };
}
/* план дня: разминка → замер (если пора) → фокус → поддержка → живая речь */
function buildPlan(pr) {
  const di = Store.dayIndex(), items = [], used = new Set(), { V, chk, focus, weekTarget } = pr;
  const yest = Store.d.done[dayKey(new Date(Date.now() - 864e5))] || [];
  const add = (id, o) => { if (!id || used.has(id) || (id !== 'diag' && !exById(id))) return false; used.add(id); items.push({ id, ...o }); return true; };
  const pick = (arr, k = 0) => {
    const ord = arr.map((_, j) => arr[(di + k + j) % arr.length]).filter((id) => !used.has(id));
    return ord.find((id) => !yest.includes(id)) || ord[0] || null;
  };
  const mins = () => items.reduce((a, it) => a + (it.id === 'diag' ? 4 : exById(it.id).min), 0);
  const goalLine = (x) => { const t = weekTarget(x); return x.reached ? `Держите уровень: ${skillVal(x.s, x.v)} (цель ${skillGoalText(x.s)})` : `Цель недели: ${x.s.band ? '' : x.s.lower ? '≤ ' : '≥ '}${skillVal(x.s, t)} · сейчас ${skillVal(x.s, x.v)} · хороший уровень ${skillGoalText(x.s)}`; };
  const pctT = (x) => `${Math.round(x.score)}% пути до хорошего уровня`;

  add(pick(WARMUPS), { block: 'Разминка', why: 'Разогреть дыхание и артикуляцию перед основной работой' });
  const checking = !chk.t || chk.due || chk.today;
  if (!chk.t) {
    add('diag', { block: 'Исходный замер', why: 'Без исходной точки нельзя посчитать уровень навыков и прогноз', goal: '5 замеров за 4 минуты: фонация, S/Z, диапазон, чтение, скороговорка' });
    add('long-s', { block: 'Первая тренировка', skill: 'breath', why: 'Дыхание — опора для всего остального: с него начинают все школы сценической речи', goal: 'Три попытки ровного «С-С-С», хороший результат — от 20 секунд' });
    add('twisters', { block: 'Первая тренировка', skill: 'diction', why: 'Распознавание покажет, какие звуки и слова у вас смазываются', goal: 'Этап «Медленно»: каждое слово должно подсветиться зелёным' });
  }
  else if (chk.due || chk.today) add('diag', { block: 'Контрольный замер недели', why: chk.today ? 'Замер сделан — фокус и прогноз пересчитаны' : `С прошлого замера прошло ${chk.days} ${plural(chk.days, 'день', 'дня', 'дней')} — пора сверить прогресс и пересчитать фокус`, goal: 'Те же 5 замеров — сравним с прошлой неделей' });

  focus.forEach((id, i) => {
    const x = V(id), s = x.s, pool = (x.score < 40 && s.trainLow) || s.train;
    if (i === 0 || checking) add(pick(pool, i), { block: i ? 'Второй фокус' : 'Фокус недели', skill: id, why: `${s.title}: ${pctT(x)} — ${i ? 'вторая' : 'главная'} зона роста`, goal: checking ? goalLine(x) : '' });
    if (!checking) add(s.measure, { block: 'Замер: ' + s.title.toLowerCase(), skill: id, why: 'Каждый замер в разные дни уточняет ваш личный темп и прогноз', goal: goalLine(x) });
  });
  // навыки без замеров: без них прогноз неполный (кроме чистоты речи — её меряет финал)
  if (chk.t) { const miss = pr.views.find((x) => x.v == null && x.s.id !== 'fluency'); if (miss) add(miss.s.measure, { block: 'Первый замер', skill: miss.s.id, why: `${miss.s.title}: ещё нет замера — навык не попадает в прогноз`, goal: miss.s.what }); }
  // поддержка — по кругу среди навыков вне фокуса
  const rest = pr.views.filter((x) => x.v != null && !focus.includes(x.s.id));
  if (rest.length && mins() <= 16) { const x = rest[di % rest.length]; add(pick(x.s.train, 1), { block: 'Поддержка', skill: x.s.id, why: `${x.s.title}: ${x.reached ? 'уже на хорошем уровне' : pctT(x)} — поддерживаем, чтобы не откатиться` }); }
  // финал — живая речь
  if (!items.some((it) => LIVE.includes(it.id))) {
    const fl = V('fluency'), pool = LIVE.filter((id) => id !== 'dialog' || App.ai.state === 'ok');
    add(fl.v == null ? 'nofill' : pick(pool, 2), { block: 'Живая речь', skill: 'fluency', why: fl.v == null ? 'Первый замер слов-паразитов — главного показателя живой речи' : 'Перенос в живую речь: навык освоен, когда работает без подготовки', goal: fl.v == null ? 'Говорите минуту на тему, вместо «ну» и «э-э» — пауза' : goalLine(fl) });
  }
  return items;
}
function todayPlan() {
  const pr = program(), k = dayKey();
  let p = Store.d.plans && Store.d.plans[k];
  if (!p || p.v !== 2 || p.focusAt !== pr.P.focusAt) { p = { v: 2, focusAt: pr.P.focusAt, items: buildPlan(pr) }; Store.d.plans = { [k]: p }; Store.save(); }
  return { pr, items: p.items };
}
const planRoute = (it) => (it.id === 'diag' ? 'diag' : 'ex-' + it.id);
const planTitle = (it) => (it.id === 'diag' ? (it.block === 'Исходный замер' ? 'Диагностика: исходная точка' : 'Контрольная диагностика') : exById(it.id).title);
const planMin = (it) => (it.id === 'diag' ? 4 : exById(it.id).min);
function skillBar(x) { return `<span class="sbar" title="${x.score == null ? 'нет замера' : Math.round(x.score) + '% пути до хорошего уровня'}"><i style="width:${x.score == null ? 0 : Math.max(3, x.score)}%" class="${x.score == null ? '' : x.reached ? 'good' : x.score < 40 ? 'low' : ''}"></i></span>`; }
function etaText(pr, x) {
  if (x.v == null) return 'нет замера';
  if (x.reached) return 'достигнуто ✓';
  const e = pr.sim.eta[x.s.id];
  return e == null ? 'больше года' : `≈ ${weeksT(e)}`;
}
function forecastHead(pr) {
  const n = pr.measured.length;
  if (n < 3) return null;
  const w = pr.sim.weeks, rh = trainingRhythm();
  const miss = pr.views.filter((x) => x.v == null).map((x) => x.s.title.toLowerCase());
  const slow = Store.dayIndex() >= 7 && rh.perWeek < 4.5 && w;
  return { w, date: w ? ruDate(Date.now() + w * WEEK) : null, miss, slow, rh, altW: slow ? Math.ceil((w * 5) / Math.max(1, rh.perWeek)) : null };
}
function forecastCard(pr) {
  const f = forecastHead(pr);
  if (!f) return `<section class="panel stack fc"><span class="eyebrow">Прогноз</span><p>Прогноз появится, когда будут замеры хотя бы по трём навыкам. Быстрее всего — диагностика: 4 минуты.</p><div><button class="btn primary" data-go="diag">Пройти диагностику</button></div></section>`;
  return `<section class="panel stack fc"><div class="row" style="justify-content:space-between"><span class="eyebrow">Прогноз · неделя ${pr.week}</span><button class="btn ghost" data-go="program" style="min-height:0;padding:2px 6px;color:var(--accent)">Вся программа →</button></div>
    ${f.w === 0 ? '<div class="fc-big">Цели достигнуты</div><p class="small muted">Все измеренные навыки на хорошем уровне. Держите форму и повышайте сложность.</p>'
      : f.w ? `<div class="fc-big">≈ ${weeksT(f.w)}</div><p class="small">до хорошего уровня по всем навыкам — <b>к ${f.date}</b>, если заниматься 5 дней в неделю.</p>`
      : '<div class="fc-big">Больше года</div><p class="small">при нынешнем темпе. Регулярные занятия ускорят рост.</p>'}
    ${f.slow ? `<p class="small warn-t">Сейчас вы занимаетесь ${fmt(f.rh.perWeek, 1)} ${plural(Math.round(f.rh.perWeek), 'день', 'дня', 'дней')} в неделю — в таком ритме ≈ ${weeksT(f.altW)}.</p>` : ''}
    <div class="skills-mini">${pr.views.map((x) => `<div class="${pr.focus.includes(x.s.id) ? 'focus' : ''}"><span class="n">${x.s.title}</span>${skillBar(x)}<span class="e">${etaText(pr, x)}</span></div>`).join('')}</div>
    ${f.miss.length ? `<p class="small muted">Без замера: ${f.miss.join(', ')} — они есть в плане.</p>` : ''}</section>`;
}
function viewHome(v) {
  const { pr, items } = todayPlan();
  const mins = items.reduce((a, it) => a + planMin(it), 0), done = items.filter((it) => Store.doneToday(it.id)).length;
  const wd = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const fT = pr.focus.map((id) => skillById(id).title.toLowerCase()).join(' и ');
  v.innerHTML = `
    ${micNotice()}
    <div class="sec-head"><span class="eyebrow">${esc(wd)} · неделя ${pr.week} программы</span><h1 class="h1">Тренировка на сегодня</h1>
      <p class="lead">${mins} минут. ${fT ? `Фокус недели — ${fT}: план собран по вашим замерам и меняется вместе с ними.` : 'Сначала — исходный замер: по нему план подстроится под ваши слабые места.'}</p></div>
    <div class="hero">
      <section class="panel lift plan">
        <div class="row" style="justify-content:space-between"><h2 class="h2">План дня</h2><span class="small muted num">${done} из ${items.length}</span></div>
        <ol class="plan-list">${items.map((it) => { const ex = exById(it.id); return `<li class="plan-item ${Store.doneToday(it.id) ? 'done' : ''}"><span class="check"></span><div><div class="t">${esc(planTitle(it))}</div><div class="s">${esc(it.block)} · ${planMin(it)} мин${it.id === 'diag' || (ex && ex.mic) ? ' · микрофон' : ''}</div>${it.why ? `<div class="why">${esc(it.why)}</div>` : ''}${it.goal ? `<div class="goal">${esc(it.goal)}</div>` : ''}</div><button class="open" data-go="${planRoute(it)}">Открыть</button></li>`; }).join('')}</ol>
        <div class="row"><button class="btn primary big" id="startSession">${ico('play')}${done === items.length ? 'Повторить занятие' : done ? 'Продолжить занятие' : 'Начать занятие'}</button>${done === items.length ? '<span class="verdict good">План на сегодня выполнен</span>' : ''}<button class="btn ghost" id="replan" style="margin-left:auto" title="Собрать план заново по свежим замерам">Пересобрать</button></div>
      </section>
      <section class="stack">
        ${forecastCard(pr)}
        <div class="stats">
          <div class="stat"><span class="k">Серия</span><span class="v">${Store.streak()}<small>${plural(Store.streak(), 'день', 'дня', 'дней')}</small></span><span class="d">занимайтесь 5+ дней в неделю</span></div>
          <div class="stat"><span class="k">За 7 дней</span><span class="v">${Store.weekMinutes()}<small>мин</small></span><span class="d">цель — 75+ минут</span></div>
        </div>
        <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="eyebrow">Активность</span><span class="small muted">12 недель</span></div>${heatmap()}</div>
      </section>
    </div>
    <section class="stack"><h2 class="h2">Разделы</h2>
      <div class="grid3">${SECTIONS.map((s) => `<button class="panel ex-row" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;border:1px solid var(--line)" data-go="sec-${s.id}"><span class="t">${s.title}</span><span class="g">${esc(s.lead)}</span><span class="small muted">${EXERCISES.filter((e) => e.sec === s.id).length} упражнений</span></button>`).join('')}</div>
    </section>`;
  $('#startSession').onclick = () => {
    const routes = items.map(planRoute), first = items.findIndex((it) => !Store.doneToday(it.id));
    App.session = { items: routes, idx: first < 0 ? 0 : first };
    go(routes[App.session.idx]);
  };
  $('#replan').onclick = () => { delete Store.d.plans[dayKey()]; Store.save(); go('home'); toast('План пересобран по свежим замерам'); };
}
/* ---------- занятие по плану: переход к следующему пункту ---------- */
function sessionNext(skip) {
  if (!App.session) return go('home');
  App.session.idx++;
  if (App.session.idx >= App.session.items.length) { App.session = null; if (!skip) toast('Занятие завершено. Отличная работа!'); go('home'); }
  else go(App.session.items[App.session.idx]);
}

/* ========== МОЯ ПРОГРАММА ========== */
function viewProgram(v) {
  const pr = program(), f = forecastHead(pr), s0 = Store.d.settings;
  const rows = pr.sim.rows, openIds = pr.views.filter((x) => x.v != null && !x.reached).map((x) => x.s.id);
  const shown = rows.slice(0, 12);
  const confT = (x) => x.conf === 'personal' ? `ваш темп: ${rateText(x.s, x.trend)}` : x.conf === 'stall' ? 'по замерам роста пока нет — прогноз осторожный' : x.v == null ? '' : `типичный темп; ваш — после 3 дней замеров`;
  const sz = Store.last('sz');
  v.innerHTML = `<div class="sec-head"><span class="eyebrow">Неделя ${pr.week}${pr.focus.length ? ' · фокус: ' + pr.focus.map((id) => skillById(id).title.toLowerCase()).join(' и ') : ''}</span><h1 class="h1">Моя программа</h1>
      <p class="lead">Шесть навыков, у каждого — измеримый показатель и цель «хороший уровень». План дня тренирует самые слабые, раз в неделю контрольный замер пересчитывает фокус и прогноз.</p></div>
    ${sz > 1.4 ? `<div class="notice bad"><div style="flex:1"><b>Индекс S/Z — ${fmt(sz, 2)}.</b> Выше 1,4 бывает, когда связки смыкаются неплотно. Если есть осиплость дольше двух недель — покажитесь фониатру. До этого не форсируйте громкость.</div></div>` : ''}
    <section class="panel lift stack">
      <div class="fc-row"><div class="stack" style="gap:4px">
        <span class="eyebrow">Когда будет хороший уровень</span>
        ${!f ? '<div class="fc-big">Нужны замеры</div><p class="small">Пройдите диагностику — по ней посчитаю уровень каждого навыка и срок.</p>'
          : f.w === 0 ? '<div class="fc-big">Цели достигнуты</div><p class="small">Все измеренные навыки на хорошем уровне.</p>'
          : f.w ? `<div class="fc-big">≈ ${weeksT(f.w)} · к ${f.date}</div><p class="small">При 5 занятиях в неделю по 15–20 минут.${f.slow ? ` В нынешнем ритме (${fmt(f.rh.perWeek, 1)} дн. в неделю) — ≈ ${weeksT(f.altW)}.` : ''}</p>`
          : '<div class="fc-big">Больше года</div><p class="small">по нынешним замерам.</p>'}
        ${f && f.miss.length ? `<p class="small muted">Пока без замера: ${f.miss.join(', ')} — срок уточнится.</p>` : ''}</div>
        <div class="row" style="align-self:center"><button class="btn primary" data-go="diag">${pr.chk.t ? 'Контрольный замер' : 'Пройти диагностику'}</button><button class="btn" id="pAiGo">Разбор ИИ-коуча</button></div></div>
      <p class="small muted">${pr.chk.t ? `Последний контрольный замер: ${pr.chk.days === 0 ? 'сегодня' : pr.chk.days + ' ' + plural(pr.chk.days, 'день', 'дня', 'дней') + ' назад'}${pr.chk.due ? ' — пора повторить' : ` · следующий через ${7 - pr.chk.days} ${plural(7 - pr.chk.days, 'день', 'дня', 'дней')}`}.` : 'Контрольных замеров ещё не было.'}</p>
      <div id="pAi"></div></section>
    <section class="panel stack"><h2 class="h2">Навыки</h2>
      <div class="skills">${pr.views.map((x) => `<div class="skill ${pr.focus.includes(x.s.id) ? 'focus' : ''}">
        <div class="stack" style="gap:2px"><span class="h3">${x.s.title}${pr.focus.includes(x.s.id) ? ' <span class="tag ai">фокус недели</span>' : ''}</span><span class="small muted">${esc(x.s.what)}</span></div>
        <div class="vals num">${x.v == null ? '<span class="muted">—</span>' : `${x.n > 1 ? `<span class="muted">${fmt(x.first, x.s.dg)} →</span> ` : ''}<b>${fmt(x.v, x.s.dg)}</b>`} <span class="small muted">/ ${skillGoalText(x.s)}</span></div>
        <div class="stack" style="gap:4px">${skillBar(x)}<span class="small muted">${x.v == null ? '' : Math.round(x.score) + '% · '}${esc(confT(x))}</span></div>
        <div class="eta">${x.v == null ? `<button class="btn" data-go="ex-${x.s.measure}">Замерить</button>` : `<b>${etaText(pr, x)}</b>${!x.reached && pr.sim.eta[x.s.id] ? `<span class="small muted">к ${ruDate(Date.now() + pr.sim.eta[x.s.id] * WEEK)}</span>` : ''}`}</div></div>`).join('')}</div>
      <p class="small muted">Текущее значение — среднее по трём последним дням замеров, так случайная удачная или неудачная попытка не сбивает план. Шкала: 0% — начальный уровень, 100% — хороший.</p></section>
    ${shown.length && openIds.length ? `<section class="panel stack"><h2 class="h2">Дорожная карта по неделям</h2><p class="small muted">Ожидаемые значения к концу каждой недели. Жирным — навыки в фокусе этой недели, зелёным — достигнутая цель.</p>
      <div class="road-wrap"><table class="road"><thead><tr><th>Неделя</th><th>К дате</th>${openIds.map((id) => `<th>${skillById(id).title}<br><span class="muted">${skillGoalText(skillById(id))}</span></th>`).join('')}</tr></thead><tbody>
        <tr class="now"><td>сейчас</td><td>${ruDate(Date.now())}</td>${openIds.map((id) => `<td>${fmt(pr.V(id).v, skillById(id).dg)}</td>`).join('')}</tr>
        ${shown.map((r) => `<tr><td>${r.w}</td><td>${ruDate(Date.now() + r.w * WEEK)}</td>${openIds.map((id) => { const s = skillById(id), ok = skillReached(s, r.vals[id]); return `<td class="${ok ? 'ok' : ''} ${r.focus.has(id) ? 'fo' : ''}">${fmt(r.vals[id], s.dg)}${ok ? ' ✓' : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>${rows.length > shown.length ? `<p class="small muted">…и ещё ${rows.length - shown.length} ${plural(rows.length - shown.length, 'неделя', 'недели', 'недель')}.</p>` : ''}</section>` : ''}
    <section class="panel stack"><h2 class="h2">Как устроена система</h2>
      <ol class="sys">
        <li><b>Исходная точка.</b> Диагностика за 4 минуты даёт показатель по каждому навыку. Уровень считается в процентах пути от начального до хорошего.</li>
        <li><b>Фокус недели — два самых слабых навыка.</b> На них уходит больше половины занятия. Так делают программы Speeko и логопеды: сначала то, что сильнее всего мешает.</li>
        <li><b>Занятие 15–20 минут:</b> разминка → тренировка фокуса → замер с целью недели → поддержка остальных навыков → живая речь. Упражнения меняются по кругу и не повторяют вчерашние.</li>
        <li><b>Контрольный замер раз в 7 дней.</b> Фокус, цели недели и прогноз пересчитываются. Навык достиг цели — он уходит в поддержку, в фокус встаёт следующий.</li>
        <li><b>Прогноз = разрыв до цели ÷ темп роста.</b> Пока замеров мало, темп берётся типичный — по исследованиям и практике тренеров. С трёх дней замеров навыка темп считается по вашему графику. Нет роста две недели — прогноз становится осторожнее, а навык остаётся в фокусе.</li>
      </ol></section>
    <section class="panel stack"><h2 class="h2">Цели и типичный темп</h2>
      <div class="road-wrap"><table class="hist"><tbody>${SKILLS.map((s) => `<tr><td style="font-family:var(--f-body);color:var(--ink)">${s.title}</td><td style="text-align:left;font-family:var(--f-body)">${esc(s.what)}</td><td>${skillGoalText(s)}</td><td>${rateText(s, refRate(s))}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Цели — «хороший уровень» для взрослого, а не рекорды. Нормы времени фонации зависят от пола (сейчас: ${s0.sex === 'f' ? 'женский' : 'мужской'}, меняется в Настройках). Это ориентиры для самостоятельных тренировок, не медицинская диагностика.</p>
      <ul class="small" style="margin:0;padding-left:18px;color:var(--ink-2);display:flex;flex-direction:column;gap:4px">
        <li><a href="https://onlinelibrary.wiley.com/doi/10.1111/coa.14019" target="_blank" rel="noopener">Время фонации как маркер эффективности голосовой терапии: сетевой метаанализ (Clinical Otolaryngology, 2023)</a> — в среднем +6 с после курса упражнений</li>
        <li><a href="https://pubmed.ncbi.nlm.nih.gov/37105793/" target="_blank" rel="noopener">Цель по времени фонации и эффективность Vocal Function Exercises (PubMed)</a> — рост за 6 недель; с явной целью результат лучше</li>
        <li><a href="https://journals.sagepub.com/doi/10.1177/10497315241301372" target="_blank" rel="noopener">Brief Habit Reversal против слов-паразитов (2025)</a> — у 6 из 9 участников −80% за 2,5–6 недель</li>
        <li><a href="https://journals.physiology.org/doi/full/10.1152/advan.00110.2022" target="_blank" rel="noopener">Слова-паразиты в научной речи (Advances in Physiology Education)</a> — осознанность, обратная связь, паузы вместо «э-э»</li>
        <li><a href="https://yoodli.ai/blog/orai-vs-speeko-what-to-know" target="_blank" rel="noopener">Orai и Speeko</a> — метрики темпа, паразитов и мелодики, персональные рекомендации по слабым местам</li></ul></section>`;
  $('#pAiGo').onclick = () => aiFeedback($('#pAi'), { title: 'Разбор программы', prompt: `Это не одна попытка, а обзор программы развития речи ученика (неделя ${pr.week}).
Навыки (текущее значение / цель / уровень / прогноз):
${pr.views.map((x) => `- ${x.s.title} (${x.s.what}): ${x.v == null ? 'нет замера' : `${skillVal(x.s, x.v)}, первый замер ${skillVal(x.s, x.first)}, цель ${skillGoalText(x.s)}, ${Math.round(x.score)}%, ${etaText(pr, x)}${x.conf === 'personal' ? ', личный темп ' + rateText(x.s, x.trend) : x.conf === 'stall' ? ', роста по замерам нет' : ''}`}`).join('\n')}
Фокус недели: ${pr.focus.map((id) => skillById(id).title).join(', ') || 'нет'}. Занятий в неделю: ${fmt(trainingRhythm().perWeek, 1)}.
Дай по-русски без markdown-заголовков, до 220 слов: 1) что растёт и что буксует; 2) почему буксующий навык может не расти и что поменять в технике; 3) один конкретный совет на эту неделю для каждого фокусного навыка; 4) реалистичен ли срок и что его сократит.` });
}
function heatmap() {
  const days = 84, d = new Date(); d.setDate(d.getDate() - days + 1);
  const shift = (d.getDay() + 6) % 7; d.setDate(d.getDate() - shift);
  let cells = '';
  const today = dayKey();
  for (let i = 0; i < days + shift; i++) {
    const k = dayKey(d), m = Store.d.days[k] || 0, l = m === 0 ? 0 : m < 6 ? 1 : m < 14 ? 2 : 3;
    cells += `<i data-l="${l}" class="${k === today ? 'today' : ''}" title="${k}: ${Math.round(m)} мин"></i>`;
    d.setDate(d.getDate() + 1);
  }
  return `<div class="heat">${cells}</div>`;
}

/* ========== РАЗДЕЛ ========== */
function exTags(ex) {
  return [`<span class="tag num">${ex.min} мин</span>`, ex.mic ? '<span class="tag mic">микрофон</span>' : '', ex.asr ? '<span class="tag mic">распознавание</span>' : '', ex.ai ? '<span class="tag ai">ИИ</span>' : ''].join('');
}
function bestLabel(ex) {
  const b = Store.d.best;
  if (ex.id === 'long-s' && b['sLen'] != null) return `рекорд ${fmt(b['sLen'])} с`;
  if (ex.id === 'candle' && b['candle'] != null) return `рекорд ${fmt(b['candle'])} с`;
  if (ex.id === 'count' && b['count'] != null) return `рекорд ${b['count']}`;
  if (ex.id === 'range' && b['range'] != null) return `${fmt(b['range'], 0)} пт`;
  if (Store.doneToday(ex.id)) return 'сегодня ✓';
  return '';
}
function viewSection(v, s) {
  const list = EXERCISES.filter((e) => e.sec === s.id);
  v.innerHTML = `${list.some((e) => e.mic) ? micNotice() : ''}
    <div class="sec-head"><span class="eyebrow">Раздел</span><h1 class="h1">${s.title}</h1><p class="lead">${esc(s.lead)}</p><p class="why">${esc(s.why)}</p></div>
    <div class="ex-list">${list.map((e) => `<button class="ex-row" data-go="ex-${e.id}"><div><div class="t">${esc(e.title)}</div><div class="g">${esc(e.goal)}</div></div><div class="meta"><span class="best">${bestLabel(e)}</span>${exTags(e)}</div></button>`).join('')}</div>`;
}

/* ========== УПРАЖНЕНИЕ ========== */
function viewExercise(v, ex) {
  const s = SECTIONS.find((x) => x.id === ex.sec);
  const inSession = App.session && App.session.items[App.session.idx] === 'ex-' + ex.id;
  const sessBar = inSession ? `<div class="sessionbar"><span>Занятие · ${App.session.idx + 1} из ${App.session.items.length}</span><span class="bar"><i style="width:${(App.session.idx / App.session.items.length) * 100}%"></i></span><button id="sSkip">Пропустить</button><button id="sEnd">Завершить</button></div>` : '';
  v.innerHTML = `${sessBar}
    <div class="ex-top"><button class="back" data-go="${s ? 'sec-' + s.id : 'home'}">${ico('prev').replace('<svg', '<svg width="14" height="14" style="stroke:currentColor;fill:none;stroke-width:2"')} ${s ? s.title : 'Сегодня'}</button>
      <h1 class="h1">${esc(ex.title)}</h1><p class="lead">${esc(ex.goal)}</p><div class="row">${exTags(ex)}</div></div>
    ${ex.mic ? micNotice() : ''}
    <div class="ex-layout"><div class="stage" id="stage"></div>
      <aside class="how panel"><span class="eyebrow">Как выполнять</span><ol>${ex.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></aside></div>
    ${ex.type === 'coach' || ex.type === 'upload' ? '' : `<div class="row" style="justify-content:flex-end;gap:12px"><span class="small muted" id="doneNote"></span><button class="btn ${inSession ? 'primary big' : ''}" id="doneBtn">${inSession ? (App.session.idx + 1 < App.session.items.length ? 'Готово — дальше' : 'Завершить занятие') : 'Отметить выполненным'}</button></div>`}`;
  let marked = false;
  const ctx = {
    ex,
    mark() { if (!marked) { Store.complete(ex.id, ex.min); marked = true; renderNav(); const n = $('#doneNote'); if (n) n.innerHTML = `<span class="verdict good">✓ Засчитано в план дня · +${ex.min} мин</span>`; } },
    next() {
      ctx.mark();
      if (inSession) sessionNext();
    },
  };
  if (Store.doneToday(ex.id)) { const n = $('#doneNote'); if (n) n.textContent = 'Сегодня уже выполнено'; }
  const enterT = performance.now(); let touched = false;
  v.addEventListener('pointerdown', () => (touched = true), { once: true });
  onLeave(() => { if (touched && (performance.now() - enterT) / 1000 >= Math.min(90, ex.min * 30)) ctx.mark(); });
  const db = $('#doneBtn'); if (db) db.onclick = () => { ctx.mark(); if (inSession) ctx.next(); else { db.textContent = 'Выполнено ✓'; db.disabled = true; } };
  if (inSession) {
    $('#sSkip').onclick = () => sessionNext(true);
    $('#sEnd').onclick = () => { App.session = null; go('home'); };
  }
  (W[ex.type] || (() => {}))($('#stage'), ex, ctx);
}

/* ========== ВИДЖЕТЫ ========== */
const W = {};

/* ---- пошаговое упражнение с таймером и метрономом ---- */
W.guided = (root, ex, ctx) => {
  const steps = ex.steps, C = 2 * Math.PI * 52;
  let i = 0, t = 0, running = false, lastBeat = -1, prev = 0, finished = false;
  const tts = Store.d.settings.tts && Voice.available();
  root.innerHTML = `<div class="panel lift center">
    <div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" id="gfg" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      <div class="inner"><span class="num" id="gsec">0</span><span class="small muted" id="gstep">шаг 1 из ${steps.length}</span></div></div>
    <div class="row" style="justify-content:center;min-height:16px"><span class="beat" id="gbeat"></span><span class="small muted num" id="gbpm"></span></div>
    <div class="step-now" id="gnow"></div>
    <div class="row" style="justify-content:center">
      <button class="btn" id="gprev" aria-label="Предыдущий шаг">${ico('prev')}</button>
      <button class="btn primary big" id="gplay">${ico('play')}Старт</button>
      <button class="btn" id="gnext" aria-label="Следующий шаг">${ico('next')}</button></div>
    ${Voice.available() ? `<label class="check small" style="justify-content:center"><input type="checkbox" id="gtts" ${tts ? 'checked' : ''}> Озвучивать шаги голосом</label>` : ''}
  </div>
  <div class="panel"><span class="eyebrow">Шаги</span><ol class="steps" id="gsteps" style="margin-top:10px">${steps.map((s) => `<li><span>${esc(s.t)}</span><span class="s">${s.s} с</span></li>`).join('')}</ol></div>`;
  const fg = $('#gfg'), secEl = $('#gsec'), beat = $('#gbeat'), now = $('#gnow'), play = $('#gplay');
  const tt = $('#gtts'); if (tt) tt.onchange = () => { Store.d.settings.tts = tt.checked; Store.save(); };
  const say = () => { if (tt && tt.checked) { Voice.cancel(); Voice.speak(steps[i].t); } };
  const paint = () => {
    const s = steps[i];
    now.textContent = finished ? 'Готово! Мышцы разогреты.' : s.t;
    secEl.textContent = finished ? '✓' : Math.ceil(s.s - t);
    $('#gstep').textContent = finished ? 'все шаги' : `шаг ${i + 1} из ${steps.length}`;
    fg.style.strokeDashoffset = finished ? 0 : C * (t / s.s);
    $('#gbpm').textContent = s.bpm ? (s.burst ? `${s.burst} × ${s.bpm} уд/мин, пауза ${s.rest} с` : `${s.bpm} уд/мин`) : '';
    $$('#gsteps li').forEach((li, k) => (li.className = finished || k < i ? 'done' : k === i ? 'cur' : ''));
    play.innerHTML = finished ? `${ico('play')}Ещё раз` : running ? `${ico('stop')}Пауза` : `${ico('play')}${t > 0 || i > 0 ? 'Продолжить' : 'Старт'}`;
  };
  const setStep = (k) => { i = clamp(k, 0, steps.length - 1); t = 0; lastBeat = -1; finished = false; paint(); if (running) { Snd.cue(true); say(); } };
  const tick = () => {
    const n = performance.now() / 1000, dt = n - prev; prev = n;
    if (!running) return;
    t += dt; const s = steps[i];
    if (!ctx._g70) { const tot = steps.reduce((a, x) => a + x.s, 0), el = steps.slice(0, i).reduce((a, x) => a + x.s, 0) + t; if (el / tot >= 0.7) { ctx._g70 = true; ctx.mark(); } }
    if (s.bpm) {
      const per = 60 / s.bpm; let b = -1, acc = false;
      if (s.burst) { const cyc = s.burst * per + s.rest, ph = t % cyc; if (ph < s.burst * per) { const k = Math.floor(ph / per); b = Math.floor(t / cyc) * s.burst + k; acc = k === 0; } }
      else { b = Math.floor(t / per); acc = b % 4 === 0; }
      if (b >= 0 && b !== lastBeat) { lastBeat = b; Snd.click(acc); beat.classList.add('on'); setTimeout(() => beat.classList.remove('on'), 90); }
    }
    if (t >= s.s) {
      if (i + 1 < steps.length) setStep(i + 1);
      else { running = false; finished = true; Snd.ok(); ctx.mark(); }
    }
    paint();
  };
  const iv = setInterval(tick, 20); onLeave(() => clearInterval(iv));
  play.onclick = () => {
    Snd.get();
    if (finished) { setStep(0); running = true; prev = performance.now() / 1000; say(); paint(); return; }
    running = !running; prev = performance.now() / 1000;
    if (running && t === 0) say();
    paint();
  };
  $('#gprev').onclick = () => setStep(i - 1);
  $('#gnext').onclick = () => setStep(i + 1);
  paint();
};

/* ---- дыхательный ритм ---- */
W.pace = (root, ex, ctx) => {
  const c = { ...ex.cfg };
  let running = false, timer = 0, cyc = 0;
  root.innerHTML = `<div class="panel lift center">
    <div class="pacer"><div class="orb" id="porb"></div><div class="lbl"><b id="pph">Готовы?</b><span class="num muted" id="pcnt"></span></div></div>
    <div class="small muted num" id="pcyc">Цикл 0 из ${c.cycles}</div>
    <button class="btn primary big" id="pgo">${ico('play')}Начать</button></div>
  <div class="panel stack"><span class="eyebrow">Ритм</span>
    ${[['inhale', 'Вдох', 2, 8], ['hold', 'Пауза', 0, 6], ['exhale', 'Выдох', 3, 16], ['cycles', 'Циклов', 3, 20]].map(([k, l, a, b]) => `<div class="slider-row"><label for="p_${k}">${l}</label><input type="range" id="p_${k}" min="${a}" max="${b}" step="1" value="${c[k]}"><span class="num" id="pv_${k}">${c[k]}${k === 'cycles' ? '' : ' с'}</span></div>`).join('')}
    <p class="small muted">Постепенно удлиняйте выдох: цель — выдох в 2–3 раза длиннее вдоха.</p></div>`;
  ['inhale', 'hold', 'exhale', 'cycles'].forEach((k) => { const el = $('#p_' + k); el.oninput = () => { c[k] = +el.value; $('#pv_' + k).textContent = c[k] + (k === 'cycles' ? '' : ' с'); $('#pcyc').textContent = `Цикл ${cyc} из ${c.cycles}`; }; });
  const orb = $('#porb'), ph = $('#pph'), cnt = $('#pcnt');
  let cd = 0;
  const phase = (name, sec, scale, next) => {
    ph.textContent = name; orb.style.transitionDuration = sec + 's'; orb.style.transform = `scale(${scale})`;
    let left = sec; cnt.textContent = left > 0 ? left : '';
    clearInterval(cd); cd = setInterval(() => { left--; cnt.textContent = left > 0 ? left : ''; }, 1000);
    timer = setTimeout(next, sec * 1000);
  };
  const cycle = () => {
    if (!running) return;
    if (cyc >= c.cycles) { stop(true); return; }
    cyc++; $('#pcyc').textContent = `Цикл ${cyc} из ${c.cycles}`;
    if (cyc > Math.ceil(c.cycles / 2)) ctx.mark();
    Snd.cue(true);
    phase('Вдох носом', c.inhale, 1, () => {
      const out = () => { Snd.cue(false); phase('Выдох', c.exhale, 0.45, cycle); };
      if (c.hold) phase('Пауза', c.hold, 1, out); else out();
    });
  };
  const stop = (done) => {
    running = false; clearTimeout(timer); clearInterval(cd);
    orb.style.transitionDuration = '0.6s'; orb.style.transform = 'scale(.45)'; cnt.textContent = '';
    ph.textContent = done ? 'Готово' : 'Пауза'; $('#pgo').innerHTML = `${ico('play')}${done ? 'Ещё раз' : 'Продолжить'}`;
    if (done) { Snd.ok(); ctx.mark(); cyc = 0; }
  };
  $('#pgo').onclick = () => { if (running) return stop(false); running = true; $('#pgo').innerHTML = `${ico('stop')}Остановить`; cycle(); };
  onLeave(() => stop(false));
};

/* ---- удержание звука (фонация, «С», мычание) ---- */
function makeSustain(el, { sound, pitch, onAttempt, max = 60 }) {
  el.innerHTML = `<div class="center">
    <div class="sound-label">Звук «${sound}»</div>
    <div class="big-num num"><span class="sv">0,0</span><small>с</small></div>
    <div class="small muted sst" style="min-height:1.5em">Нажмите «Начать», вдохните и тяните звук</div>
    ${pitch ? '<div class="num small sp" style="min-height:1.5em;color:var(--ink-2)">—</div>' : ''}
    <div class="meter"><i class="sm" style="width:0"></i></div>
    <div class="row" style="justify-content:center"><button class="btn primary big sgo">${ico('mic')}Начать</button>
    <button class="btn big shold" ${Mic.state === 'on' && !App.framed ? 'hidden' : ''}>Удерживайте, пока звучите</button></div>
    <div class="attempts satt"></div></div>`;
  const sv = $('.sv', el), sst = $('.sst', el), sm = $('.sm', el), sp = $('.sp', el), go_ = $('.sgo', el), hold = $('.shold', el), att = $('.satt', el);
  let armed = false, state = 'idle', above = 0, below = 0, start = 0, lastAbove = 0, hzs = [];
  const attempts = [];
  const addAttempt = (dur) => {
    if (dur < 1) { sst.textContent = 'Слишком коротко — попробуйте ещё раз'; return; }
    let medHz = NaN, sdSt = NaN;
    if (hzs.length > 8) { const cut = hzs.slice(Math.floor(hzs.length * 0.1), Math.ceil(hzs.length * 0.9)); medHz = median(cut); sdSt = sd(cut.map((x) => st(x, medHz)).filter((x) => Math.abs(x) < 6)); }
    const a = { dur, medHz, sdSt }; attempts.push(a);
    const best = Math.max(...attempts.map((x) => x.dur));
    att.innerHTML = attempts.map((x) => `<span class="attempt ${x.dur === best ? 'best' : ''}">${fmt(x.dur)} с</span>`).join('');
    sst.textContent = `Попытка ${attempts.length}: ${fmt(dur)} с${attempts.length > 1 && dur === best ? ' — лучший результат!' : ''}`;
    onAttempt && onAttempt(a, attempts);
  };
  const off = Mic.on((f) => {
    sm.style.width = clamp((f.db - Mic.floor) / 40, 0, 1) * 100 + '%';
    if (sp) sp.textContent = f.hz > 0 ? `${Math.round(f.hz)} Гц · ${noteName(f.hz)}` : '—';
    if (!armed) return;
    const on = f.db > Mic.thr(8);
    const n = f.t;
    if (state === 'idle') {
      if (on) { if (!above) above = n; if (n - above > 0.12) { state = 'run'; start = above; hzs = []; sst.textContent = 'Звучит… держите ровно'; } }
      else above = 0;
    } else {
      if (on) { lastAbove = n; below = 0; if (pitch && f.hz > 0) hzs.push(f.hz); }
      else if (!below) below = n;
      sv.textContent = fmt(Math.max(0, (on ? n : lastAbove) - start));
      if ((below && n - below > 0.45) || n - start > max) { state = 'idle'; above = 0; below = 0; addAttempt(lastAbove - start); }
    }
  });
  go_.onclick = async () => {
    if (armed) { armed = false; state = 'idle'; go_.innerHTML = `${ico('mic')}Начать`; sst.textContent = 'Остановлено'; return; }
    if (!(await needMic())) { hold.hidden = false; sst.textContent = 'Микрофон недоступен — засекайте вручную кнопкой ниже'; return; }
    armed = true; state = 'idle'; above = 0; go_.innerHTML = `${ico('stop')}Стоп`;
    sst.textContent = `Вдохните… и тяните «${sound}»`; sv.textContent = '0,0';
  };
  let ht = 0, hi = 0;
  const hdown = (e) => { e.preventDefault(); ht = performance.now(); hzs = []; hold.textContent = 'Звучу…'; hi = setInterval(() => (sv.textContent = fmt((performance.now() - ht) / 1000)), 100); };
  const hup = () => { if (!ht) return; clearInterval(hi); const d = (performance.now() - ht) / 1000; ht = 0; hold.textContent = 'Удерживайте, пока звучите'; addAttempt(d); };
  hold.addEventListener('pointerdown', hdown); hold.addEventListener('pointerup', hup); hold.addEventListener('pointerleave', hup);
  onLeave(() => { off(); clearInterval(hi); });
  return { attempts };
}
function normScale(metric, v) {
  const sex = Store.d.settings.sex;
  let max = 35, zones;
  if (metric === 'mpt') { const [lo] = NORMS.mpt[sex]; zones = [10, lo]; }
  else { zones = [12, 20]; }
  const p = (x) => clamp((x / max) * 100, 0, 100);
  return `<div class="scale" aria-label="Шкала нормы"><div class="track" style="background:linear-gradient(90deg,var(--bad) 0 ${p(zones[0])}%,var(--warn) ${p(zones[0])}% ${p(zones[1])}%,var(--good) ${p(zones[1])}% 100%)"></div>
    ${v != null ? `<div class="mark" style="left:${p(v)}%"></div>` : ''}
    ${[0, zones[0], zones[1], 30].map((x) => `<span class="lbl" style="left:${p(x)}%">${x}</span>`).join('')}</div>`;
}
function verdictMPT(v, metric = 'mpt') {
  const lo = metric === 'mpt' ? NORMS.mpt[Store.d.settings.sex][0] : 20;
  if (v >= lo) return ['good', 'В норме'];
  if (v >= (metric === 'mpt' ? 10 : 12)) return ['warn', 'Ниже нормы — тренируйте дыхание'];
  return ['bad', 'Мало. Дыхательные упражнения каждый день'];
}
W.sustain = (root, ex, ctx) => {
  const c = ex.cfg || {};
  const metric = c.metric;
  root.innerHTML = `<div class="panel lift" id="sbox"></div><div class="panel stack" id="sres" hidden></div>`;
  const res = $('#sres');
  let sessionBest = 0;
  makeSustain($('#sbox'), {
    sound: c.sound, pitch: !!c.pitch || !!ex.pitch,
    onAttempt: (a, all) => {
      res.hidden = false; ctx.mark();
      if (metric === 'mpt' || metric === 'sLen') {
        Store.log(metric, a.dur);
        const best = Math.max(...all.map((x) => x.dur)); const rec = Store.best(metric, best);
        const [cls, txt] = verdictMPT(best, metric);
        res.innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Результат</span><span class="verdict ${cls}">${txt}</span></div>
          ${normScale(metric, best)}
          <p class="small muted" style="margin-top:8px">Лучшее сегодня: <b class="num">${fmt(best)} с</b>${rec ? ' — новый личный рекорд!' : ` · рекорд: ${fmt(Store.d.best[metric])} с`}. ${metric === 'mpt' ? `Норма для взрослых: ${NORMS.mpt[Store.d.settings.sex].join('–')} с.` : 'Хороший результат — от 20 секунд, отличный — 30+.'}</p>`;
        if (best > sessionBest) { sessionBest = best; }
      } else if (metric === 'basePitch') {
        if (!(a.medHz > 0)) { res.innerHTML = '<p class="small">Не удалось определить высоту — тяните «М» чуть громче и дольше.</p>'; return; }
        const hz = Math.round(a.medHz);
        Store.d.settings.basePitch = hz; Store.save(); Store.log('basePitch', hz);
        res.innerHTML = `<span class="eyebrow">Ваша удобная высота</span><div class="row" style="align-items:baseline"><span class="big-num" style="font-size:48px">${hz}<small>Гц</small></span><span class="h2">${noteName(hz)}</span></div>
          <p class="small muted">Сохранено как опорная нота для упражнений «Лесенка», «Губная трель», «Сирена». Типичные значения: мужской голос 85–155 Гц, женский 165–255 Гц.</p>`;
      } else {
        const s = a.sdSt;
        const [cls, txt] = !(s >= 0) ? ['warn', 'Высота не определена'] : s < 0.35 ? ['good', 'Очень ровно'] : s < 0.7 ? ['good', 'Ровно'] : s < 1.2 ? ['warn', 'Немного плавает'] : ['bad', 'Высота плавает'];
        res.innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Ровность звука</span><span class="verdict ${cls}">${txt}</span></div>
          <div class="result"><div><span class="k">Длительность</span><span class="v">${fmt(a.dur)}<small>с</small></span></div><div><span class="k">Высота</span><span class="v">${a.medHz > 0 ? Math.round(a.medHz) : '—'}<small>Гц</small></span><span class="n muted">${noteName(a.medHz)}</span></div><div><span class="k">Колебания</span><span class="v">${fmt(s, 2)}<small>пт</small></span></div></div>
          <p class="small muted">Колебания — стандартное отклонение высоты в полутонах. Меньше 0,5 — ровный, опёртый звук.</p>`;
      }
    },
  });
  onLeave(() => { if (sessionBest && metric) Store.hist(`${ex.title}: ${fmt(sessionBest)} с`); });
};

/* ---- индекс S/Z ---- */
W.sz = (root, ex, ctx) => {
  root.innerHTML = `<div class="grid2"><div class="panel lift" id="zs"></div><div class="panel lift" id="zz"></div></div><div class="panel stack" id="zres"><span class="eyebrow">Индекс S/Z</span><p class="small muted">Сделайте по 2 попытки на каждый звук. Индекс — отношение лучшего «С» к лучшему «З».</p></div>`;
  let bs = 0, bz = 0;
  const upd = () => {
    if (!bs || !bz) return;
    const r = bs / bz;
    const [cls, txt] = r <= 1.25 && r >= 0.75 ? ['good', 'В норме'] : r > 1.4 ? ['bad', 'Выше нормы'] : ['warn', 'Пограничное значение'];
    $('#zres').innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Индекс S/Z</span><span class="verdict ${cls}">${txt}</span></div>
      <div class="result"><div><span class="k">«С»</span><span class="v">${fmt(bs)}<small>с</small></span></div><div><span class="k">«З»</span><span class="v">${fmt(bz)}<small>с</small></span></div><div><span class="k">S/Z</span><span class="v">${fmt(r, 2)}</span></div></div>
      <p class="small muted">Норма — около 1,0. «С» показывает запас дыхания, «З» — то же плюс работу связок. Если «З» заметно короче (индекс выше 1,4) и есть осиплость дольше двух недель — стоит показаться фониатру.</p>`;
    Store.log('sz', +r.toFixed(2)); ctx.mark(); ctx.onResult && ctx.onResult({ sz: r, s: bs });
  };
  makeSustain($('#zs'), { sound: 'С', onAttempt: (a, all) => { bs = Math.max(...all.map((x) => x.dur)); upd(); } });
  makeSustain($('#zz'), { sound: 'З', onAttempt: (a, all) => { bz = Math.max(...all.map((x) => x.dur)); upd(); } });
};

/* ---- диапазон ---- */
W.range = (root, ex, ctx) => {
  root.innerHTML = `<div class="panel lift stack"><div class="cv-wrap"><canvas id="rcv" style="height:220px"></canvas><span class="over" id="rover">готов к записи</span></div>
    <div class="row"><button class="btn primary big" id="rgo">${ico('mic')}Начать замер</button><span class="small muted" id="rst">До 12 секунд. Снизу вверх и обратно.</span></div></div>
    <div class="panel stack" id="rres" hidden></div>`;
  const cv = $('#rcv'); let pts = [], running = false, t0 = 0, off = null, raf = 0;
  const draw = () => {
    const { c, w, h: H } = fitCanvas(cv); c.clearRect(0, 0, w, H);
    const y = (hz) => H - 14 - (Math.log2(hz / 60) / Math.log2(1100 / 60)) * (H - 28);
    c.font = '11px JetBrains Mono, monospace'; c.fillStyle = css('--ink-3'); c.strokeStyle = css('--line');
    [65, 130, 260, 520, 1040].forEach((hz) => { c.beginPath(); c.moveTo(40, y(hz)); c.lineTo(w, y(hz)); c.stroke(); c.fillText(noteName(hz), 6, y(hz) + 4); });
    c.fillStyle = css('--accent');
    pts.forEach((p) => { const x = 40 + (p.t / 12) * (w - 50); c.beginPath(); c.arc(x, y(p.hz), 2.2, 0, 7); c.fill(); });
    if (running) raf = requestAnimationFrame(draw);
  };
  const finish = () => {
    running = false; off && off(); off = null; $('#rgo').innerHTML = `${ico('mic')}Ещё раз`;
    const hz = pts.map((p) => p.hz); if (hz.length < 20) { $('#rst').textContent = 'Мало данных — пойте чуть громче и дольше.'; return; }
    const lo = pct(hz, 0.03), hi = pct(hz, 0.97), r = st(hi, lo);
    const [cls, txt] = r >= 24 ? ['good', 'Широкий'] : r >= 15 ? ['good', 'Нормальный'] : ['warn', 'Узкий — расширяйте сиренами'];
    Store.log('range', +r.toFixed(1)); Store.best('range', r); ctx.mark(); ctx.onResult && ctx.onResult({ range: r });
    $('#rres').hidden = false;
    $('#rres').innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Диапазон</span><span class="verdict ${cls}">${txt}</span></div>
      <div class="result"><div><span class="k">Нижняя</span><span class="v">${Math.round(lo)}<small>Гц</small></span><span class="n muted">${noteName(lo)}</span></div><div><span class="k">Верхняя</span><span class="v">${Math.round(hi)}<small>Гц</small></span><span class="n muted">${noteName(hi)}</span></div><div><span class="k">Диапазон</span><span class="v">${fmt(r, 0)}<small>пт</small></span><span class="n muted">${fmt(r / 12, 1)} октавы</span></div></div>
      <p class="small muted">У нетренированного голоса обычно 1,5–2 октавы (18–24 полутона). Регулярные сирены и трели расширяют его на несколько полутонов за месяц.</p>`;
    Store.hist(`Диапазон: ${fmt(r, 0)} полутонов (${noteName(lo)}–${noteName(hi)})`);
  };
  $('#rgo').onclick = async () => {
    if (running) return finish();
    if (!(await needMic())) return;
    pts = []; running = true; t0 = performance.now() / 1000; $('#rgo').innerHTML = `${ico('stop')}Стоп`; $('#rres').hidden = true;
    off = Mic.on((f) => { const t = f.t - t0; $('#rover').textContent = `${fmt(Math.max(0, 12 - t), 0)} с · ${f.hz > 0 ? Math.round(f.hz) + ' Гц ' + noteName(f.hz) : '—'}`; if (f.hz > 55) pts.push({ t, hz: f.hz }); if (t >= 12) finish(); });
    draw();
  };
  draw();
  onLeave(() => { running = false; off && off(); cancelAnimationFrame(raf); });
};

/* ---- ведение голоса по линии ---- */
const PATTERNS = {
  slide: { fn: (t, d) => 7 * Math.sin((Math.PI * t) / d), lo: -4, hi: 11 },
  siren: { fn: (t, d) => -2 + 14 * Math.pow(Math.sin((Math.PI * t) / d), 2), lo: -5, hi: 15 },
  steps: { fn: (t) => [0, 2, 4, 5, 7, 5, 4, 2, 0][Math.min(8, Math.floor(t / 0.8))], lo: -4, hi: 10 },
};
W.pitch = (root, ex, ctx) => {
  const c = ex.cfg, P = PATTERNS[c.pattern], D = c.dur, REST = 1.4, LEAD = 1.5;
  const base = Store.basePitch();
  root.innerHTML = `<div class="panel lift stack">
    <div class="cv-wrap"><canvas id="pcv"></canvas><span class="over" id="pover">опорная нота ${base} Гц · ${noteName(base)}</span></div>
    <div class="row"><button class="btn primary big" id="pgo">${ico('mic')}Начать</button><button class="btn" id="plisten">${ico('speak')}Послушать образец</button>
    <span class="small muted" id="pst">${c.rounds} ${plural(c.rounds, 'раунд', 'раунда', 'раундов')} по ${fmt(D, 1)} с</span></div>
    <p class="small muted">Опорная нота — ${Store.d.settings.basePitch ? 'ваша удобная высота' : 'типичная для ' + (Store.d.settings.sex === 'f' ? 'женского' : 'мужского') + ' голоса'}. <button class="btn ghost small" data-go="ex-optimal" style="min-height:0;padding:2px 6px">Определить свою</button> Октавные ошибки не штрафуются: петь можно в любой октаве.</p></div>
    <div class="panel stack" id="pres" hidden></div>`;
  const cv = $('#pcv');
  let running = false, T0 = 0, off = null, raf = 0, trail = [], scores = [], hits = 0, tot = 0, round = -1;
  const total = LEAD + c.rounds * (D + REST);
  const target = (tg) => { const x = tg - LEAD; if (x < 0) return null; const r = Math.floor(x / (D + REST)), inR = x - r * (D + REST); if (r >= c.rounds || inR > D) return null; return { r, v: P.fn(inR, D) }; };
  const draw = () => {
    const { c: g, w, h: H } = fitCanvas(cv); g.clearRect(0, 0, w, H);
    const now = running ? performance.now() / 1000 - T0 : 0;
    const x = (t) => w * 0.3 + ((t - now) / 6) * w;
    const y = (s) => H - 18 - ((s - P.lo) / (P.hi - P.lo)) * (H - 36);
    g.font = '11px JetBrains Mono, monospace';
    for (let s = Math.ceil(P.lo); s <= P.hi; s++) {
      if (s % 2 && s !== 7) continue;
      g.strokeStyle = css('--line'); g.globalAlpha = s === 0 ? 0.9 : 0.45; g.beginPath(); g.moveTo(0, y(s)); g.lineTo(w, y(s)); g.stroke(); g.globalAlpha = 1;
      if (s === 0 || s === 7 || s === 12) { g.fillStyle = css('--ink-3'); g.fillText(noteName(base * Math.pow(2, s / 12)), w - 40, y(s) - 4); }
    }
    // целевая линия
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = css('--target'); g.lineWidth = Math.abs(y(0) - y(3)); g.beginPath();
    let pen = false;
    for (let t = Math.max(0, now - 2); t < now + 4.5; t += 0.03) { const tg = target(t); if (!tg) { pen = false; continue; } const X = x(t), Y = y(tg.v); if (!pen) { g.moveTo(X, Y); pen = true; } else g.lineTo(X, Y); }
    g.stroke();
    g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath(); pen = false;
    for (let t = Math.max(0, now - 2); t < now + 4.5; t += 0.03) { const tg = target(t); if (!tg) { pen = false; continue; } const X = x(t), Y = y(tg.v); if (!pen) { g.moveTo(X, Y); pen = true; } else g.lineTo(X, Y); }
    g.stroke();
    // курсор
    g.strokeStyle = css('--ink'); g.globalAlpha = 0.25; g.lineWidth = 1; g.beginPath(); g.moveTo(x(now), 0); g.lineTo(x(now), H); g.stroke(); g.globalAlpha = 1;
    // след
    for (const p of trail) { if (p.t < now - 2.2) continue; g.fillStyle = p.hit ? css('--good') : css('--bad'); g.beginPath(); g.arc(x(p.t), y(p.s), 3, 0, 7); g.fill(); }
    if (running && now < LEAD) { g.fillStyle = css('--ink'); g.font = '600 22px Onest, sans-serif'; g.textAlign = 'center'; g.fillText(Math.ceil(LEAD - now) + '', w / 2, 40); g.textAlign = 'left'; }
    if (running) raf = requestAnimationFrame(draw);
  };
  const endRound = () => { if (round >= 0 && tot > 5) { scores.push(Math.round((hits / tot) * 100)); ctx.mark(); } hits = 0; tot = 0; };
  const stop = (done) => {
    running = false; off && off(); off = null; cancelAnimationFrame(raf);
    $('#pgo').innerHTML = `${ico('mic')}${done ? 'Ещё раз' : 'Начать'}`;
    if (done) {
      endRound();
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const [cls, txt] = avg >= 70 ? ['good', 'Точно'] : avg >= 45 ? ['warn', 'Неплохо'] : ['bad', 'Нужна практика'];
      $('#pres').hidden = false;
      $('#pres').innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Попадание в линию</span><span class="verdict ${cls}">${txt}</span></div>
        <div class="result">${scores.map((s, i) => `<div><span class="k">Раунд ${i + 1}</span><span class="v">${s}<small>%</small></span></div>`).join('')}<div><span class="k">В среднем</span><span class="v">${avg}<small>%</small></span></div></div>
        <p class="small muted">Засчитываются моменты, когда голос в пределах полутора полутонов от линии. Паузы считаются промахом.</p>`;
      Store.hist(`${ex.title}: попадание ${avg}%`); ctx.mark(); Snd.ok();
    }
    draw();
  };
  $('#pgo').onclick = async () => {
    if (running) return stop(false);
    if (!(await needMic())) return;
    trail = []; scores = []; round = -1; hits = 0; tot = 0; running = true; T0 = performance.now() / 1000; $('#pres').hidden = true;
    $('#pgo').innerHTML = `${ico('stop')}Стоп`;
    off = Mic.on((f) => {
      const t = f.t - T0; if (t > total) return stop(true);
      const tg = target(t); if (!tg) return;
      if (tg.r !== round) { endRound(); round = tg.r; $('#pst').textContent = `Раунд ${round + 1} из ${c.rounds}`; }
      tot++;
      if (f.hz > 0) { let d = st(f.hz, base) - tg.v; d -= 12 * Math.round(d / 12); const hit = Math.abs(d) <= 1.5; if (hit) hits++; trail.push({ t, s: tg.v + d, hit }); }
    });
    draw();
  };
  let stopRef = null;
  $('#plisten').onclick = () => { stopRef && stopRef(); stopRef = Snd.contour((t) => P.fn(t, D), D, base); };
  onLeave(() => { stop(false); stopRef && stopRef(); });
  requestAnimationFrame(draw);
  const ro = new ResizeObserver(() => !running && draw()); ro.observe(cv); onLeave(() => ro.disconnect());
};

/* ---- проекция голоса ---- */
W.volume = (root, ex, ctx) => {
  const LEVELS = [{ n: 'Доверительно', d: -7 }, { n: 'Обычный разговор', d: 0 }, { n: 'Для группы', d: 5 }, { n: 'На зал', d: 9 }, { n: 'Снова тихо, но звонко', d: -5 }];
  root.innerHTML = `<div class="panel lift center">
    <div class="eyebrow" id="vstage">Шаг 1 · замер</div>
    <div class="sound-label" id="vname">Скажите обычным голосом: «Раз, два, три, четыре, пять»</div>
    <div style="width:100%;position:relative;height:56px;border-radius:12px;background:var(--surface-2);overflow:hidden">
      <div id="vband" style="position:absolute;top:0;bottom:0;background:var(--target);border-left:2px solid var(--accent);border-right:2px solid var(--accent);display:none"></div>
      <div id="vbar" style="position:absolute;left:0;top:18px;height:20px;border-radius:0 6px 6px 0;background:var(--accent);width:0;transition:width .06s"></div></div>
    <div class="meter" style="height:6px"><i id="vhold" style="width:0;background:var(--good)"></i></div>
    <div class="small muted" id="vst">Нажмите «Начать»</div>
    <button class="btn primary big" id="vgo">${ico('mic')}Начать</button></div>`;
  let running = false, off = null, stage = -1, calib = [], L0 = 0, holdT = 0, lastT = 0;
  const lo = () => L0 - 20, hi = () => L0 + 16, px = (db) => clamp((db - lo()) / (hi() - lo()), 0, 1) * 100;
  const setStage = (k) => {
    stage = k; holdT = 0; if (k >= 2) ctx.mark(); $('#vhold').style.width = '0';
    if (k >= LEVELS.length) { running = false; off && off(); $('#vname').textContent = 'Готово! Вы прошли все уровни громкости.'; $('#vstage').textContent = 'Финиш'; $('#vband').style.display = 'none'; $('#vgo').innerHTML = `${ico('mic')}Ещё раз`; Snd.ok(); ctx.mark(); Store.hist('Проекция голоса: все 5 уровней'); return; }
    const L = LEVELS[k]; $('#vstage').textContent = `Уровень ${k + 1} из ${LEVELS.length}`; $('#vname').textContent = L.n;
    const band = $('#vband'); band.style.display = 'block'; band.style.left = px(L0 + L.d - 3) + '%'; band.style.width = (px(L0 + L.d + 3) - px(L0 + L.d - 3)) + '%';
    $('#vst').textContent = 'Держите громкость в зоне 3 секунды — говорите счёт или тяните «А»';
  };
  $('#vgo').onclick = async () => {
    if (running) { running = false; off && off(); $('#vgo').innerHTML = `${ico('mic')}Начать`; return; }
    if (!(await needMic())) return;
    running = true; stage = -1; calib = []; $('#vgo').innerHTML = `${ico('stop')}Стоп`; $('#vband').style.display = 'none';
    $('#vstage').textContent = 'Шаг 1 · замер'; $('#vname').textContent = 'Скажите обычным голосом: «Раз, два, три, четыре, пять»'; $('#vst').textContent = 'Слушаю…';
    lastT = 0;
    off = Mic.on((f) => {
      const dt = lastT ? f.t - lastT : 0; lastT = f.t;
      if (stage < 0) {
        $('#vbar').style.width = clamp((f.db + 70) / 60, 0, 1) * 100 + '%';
        if (f.loud) calib.push(f.db);
        $('#vhold').style.width = clamp(calib.length / 90, 0, 1) * 100 + '%';
        if (calib.length >= 90) { L0 = pct(calib, 0.6); setStage(0); }
        return;
      }
      $('#vbar').style.width = px(f.db) + '%';
      const tgt = L0 + LEVELS[stage].d;
      if (f.loud && Math.abs(f.db - tgt) <= 3) holdT += dt;
      $('#vhold').style.width = clamp(holdT / 3, 0, 1) * 100 + '%';
      if (holdT >= 3) { Snd.ok(); setStage(stage + 1); }
    });
  };
  onLeave(() => { running = false; off && off(); });
};

/* ---- свеча ---- */
W.candle = (root, ex, ctx) => {
  root.innerHTML = `<div class="panel lift stack"><div class="cv-wrap"><canvas id="ccv" style="height:280px"></canvas><span class="over" id="cover"></span></div>
    <div class="row"><button class="btn primary big" id="cgo">${ico('mic')}Начать</button><span class="small muted" id="cst">Дуйте ровно, не гасите пламя</span></div>
    <div class="attempts" id="catt" style="justify-content:flex-start"></div></div><div class="panel stack" id="cres" hidden></div>`;
  const cv = $('#ccv'); let running = false, off = null, raf = 0, I = 0, flick = 0, state = 'idle', st0 = 0, below = 0, above = 0, samples = [], out = 0, outT = 0;
  const atts = [];
  const draw = () => {
    const { c, w, h: H } = fitCanvas(cv); c.clearRect(0, 0, w, H);
    const cx = w / 2, base = H - 70;
    c.fillStyle = css('--line'); c.fillRect(cx - 18, base, 36, 70);
    c.strokeStyle = css('--ink-3'); c.lineWidth = 2; c.beginPath(); c.moveTo(cx, base); c.lineTo(cx, base - 10); c.stroke();
    if (out > 0) { c.fillStyle = css('--ink-3'); c.font = '600 15px Onest, sans-serif'; c.textAlign = 'center'; c.fillText('Погасла — дуйте мягче', cx, 40); c.textAlign = 'left'; }
    else {
      const tilt = I * 1.1 + (Math.random() - 0.5) * flick * 0.8, len = 70 - I * 25 + (Math.random() - 0.5) * flick * 30, wid = 16 + I * 4;
      c.save(); c.translate(cx, base - 8); c.rotate(tilt);
      const g = c.createRadialGradient(0, -len * 0.3, 2, 0, -len * 0.3, len);
      g.addColorStop(0, '#FFF6D8'); g.addColorStop(0.35, '#FFC24A'); g.addColorStop(1, 'rgba(228,110,20,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(wid, -len * 0.2, wid * 0.4, -len * 0.8, 0, -len); c.bezierCurveTo(-wid * 0.4, -len * 0.8, -wid, -len * 0.2, 0, 0); c.fill();
      c.restore();
    }
    raf = requestAnimationFrame(draw);
  };
  const addAtt = (dur) => {
    if (dur < 1.5) return;
    const mid = samples.slice(Math.floor(samples.length * 0.15), Math.ceil(samples.length * 0.85));
    const m = mid.reduce((a, b) => a + b, 0) / (mid.length || 1), cv_ = sd(mid) / (m || 1);
    const steady = Math.round(clamp(100 - cv_ * 160, 0, 100));
    atts.push({ dur, steady });
    $('#catt').innerHTML = atts.map((a) => `<span class="attempt">${fmt(a.dur)} с · ровность ${a.steady}%</span>`).join('');
    Store.best('candle', dur); ctx.mark();
    const bd = Math.max(...atts.map((a) => a.dur)), bs = Math.max(...atts.map((a) => a.steady));
    $('#cres').hidden = false;
    $('#cres').innerHTML = `<span class="eyebrow">Лучшее сегодня</span><div class="result"><div><span class="k">Длительность</span><span class="v">${fmt(bd)}<small>с</small></span></div><div><span class="k">Ровность</span><span class="v">${bs}<small>%</small></span></div></div><p class="small muted">Цель — 20+ секунд с ровностью выше 70%. Ровность падает, если поток воздуха идёт толчками.</p>`;
  };
  $('#cgo').onclick = async () => {
    if (running) { running = false; off && off(); $('#cgo').innerHTML = `${ico('mic')}Начать`; return; }
    if (!(await needMic())) { $('#cst').textContent = 'Без микрофона: дуйте на воображаемую свечу 15–20 секунд, 5 раз.'; return; }
    running = true; $('#cgo').innerHTML = `${ico('stop')}Стоп`; let prevI = 0;
    off = Mic.on((f) => {
      const x = clamp((f.db - (Mic.floor + 6)) / 30, 0, 1); I = I * 0.7 + x * 0.3; flick = flick * 0.85 + Math.abs(I - prevI) * 4; prevI = I;
      if (out > 0 && f.t - outT > 1.5) out = 0;
      if (I > 0.88 && state === 'run' && f.t - st0 > 0.3) { out = 1; outT = f.t; state = 'idle'; $('#cst').textContent = 'Слишком сильно — пламя погасло'; addAtt(f.t - st0); samples = []; return; }
      if (state === 'idle') { if (I > 0.12) { if (!above) above = f.t; if (f.t - above > 0.15) { state = 'run'; st0 = above; samples = []; } } else above = 0; }
      else {
        samples.push(I); $('#cover').textContent = fmt(f.t - st0) + ' с';
        if (I < 0.08) { if (!below) below = f.t; if (f.t - below > 0.4) { state = 'idle'; above = 0; below = 0; addAtt(f.t - st0 - 0.4); } } else below = 0;
      }
    });
  };
  draw(); onLeave(() => { running = false; off && off(); cancelAnimationFrame(raf); });
};

/* ---- скороговорки / трудные слова / окончания ---- */
function tokensHTML(text, status, live) {
  let k = 0;
  return text.split(/\s+/).map((tok) => {
    const n = normWords(tok).length; const sts = status ? status.slice(k, k + n) : []; k += n;
    const cls = !status || !n ? '' : sts.includes('miss') ? 'miss' : sts.includes('near') ? 'near' : 'ok';
    return `<span class="w ${cls}${live ? ' live' : ''}">${esc(tok)}</span>`;
  }).join(' ');
}
W.twister = (root, ex, ctx) => {
  const c = ex.cfg || {};
  const custom = Store.d.custom || [];
  const pool = () => {
    if (c.set === 'hard') return HARD_WORDS.map((t) => ({ t, s: '', l: 2 }));
    if (c.set === 'endings') return ENDING_PHRASES.map((t) => ({ t, s: '', l: 2 }));
    if (c.single != null) return [TWISTERS[c.single]];
    let a = [...TWISTERS, ...custom];
    if (grp === 'mine') a = custom; else if (grp !== 'all') a = a.filter((x) => x.s === grp);
    if (lvl) a = a.filter((x) => x.l === lvl);
    return a.length ? a : TWISTERS;
  };
  let grp = 'all', lvl = 0, idx = 0, stage = c.single != null ? 2 : 0, take = null, url = null, timer = 0;
  const STAGES = [{ n: 'Медленно', d: 'утрированно', rate: 0.6, reps: 1 }, { n: 'Шёпотом', d: 'губы активны', rate: 0.8, reps: 1 }, { n: 'Обычно', d: 'в темпе речи', rate: 1, reps: 1 }, { n: 'Быстро ×3', d: 'три раза подряд', rate: 1.3, reps: 3 }];
  const lib = !c.set && c.single == null;
  root.innerHTML = `
    ${lib ? `<div class="stack"><div class="chips" id="tgrp">${[...TW_GROUPS, ...(custom.length ? [{ id: 'mine', label: 'Мои' }] : [])].map((g) => `<button class="chip" data-g="${g.id}" aria-pressed="${g.id === grp}">${g.label}</button>`).join('')}</div>
    <div class="chips" id="tlvl">${['Все уровни', 'Лёгкие', 'Средние', 'Сложные'].map((l, i) => `<button class="chip" data-l="${i}" aria-pressed="${i === lvl}">${l}</button>`).join('')}</div></div>` : ''}
    <div class="panel lift stack">
      <div class="row" style="justify-content:space-between"><span class="lvl" id="tpos"></span><div class="row" style="gap:4px">
        <button class="btn ghost" id="tprev" aria-label="Предыдущая">${ico('prev')}</button><button class="btn ghost" id="trand" aria-label="Случайная">${ico('shuffle')}</button><button class="btn ghost" id="tnext" aria-label="Следующая">${ico('next')}</button></div></div>
      <div class="tw-card" id="tcard"></div>
      ${c.single == null ? `<div class="stages" id="tstages">${STAGES.map((s, i) => `<button data-s="${i}" aria-pressed="${i === stage}"><b>${i + 1}. ${s.n}</b>${s.d}</button>`).join('')}</div>` : ''}
      <div class="row"><button class="btn primary big" id="tgo">${ico('mic')}Проверить</button>${Voice.available() ? `<button class="btn" id="tsay">${ico('speak')}Образец</button>` : ''}
        ${lib && App.sample ? `<button class="btn ghost" id="tai">Новая от ИИ</button>` : ''}<span class="small muted" id="tst"></span></div>
      <div class="heard" id="theard" hidden><b>Распознано</b><span id="ttext"></span></div>
      <audio id="taudio" controls hidden style="width:100%"></audio>
    </div>
    <div class="panel stack" id="tres" hidden></div>
    <div class="panel stack" id="tself" hidden><span class="eyebrow">Оценка на слух</span><div class="row"><button class="btn" data-r="3">Чисто</button><button class="btn" data-r="2">С запинками</button><button class="btn" data-r="1">Не вышло</button></div></div>`;
  const card = $('#tcard');
  const cur = () => pool()[idx % pool().length];
  const paint = (status) => {
    const p = pool(); idx = ((idx % p.length) + p.length) % p.length; const it = p[idx];
    const reps = STAGES[stage].reps;
    card.innerHTML = tokensHTML(it.t, status) + (reps > 1 ? ` <span class="lvl">×${reps}</span>` : '');
    $('#tpos').textContent = `${idx + 1} / ${p.length}${it.s ? ' · звук ' + it.s : ''}${it.l ? ' · ' + ['', 'лёгкая', 'средняя', 'сложная'][it.l] : ''}${Store.d.best['tw:' + it.t] != null ? ' · лучший результат ' + Store.d.best['tw:' + it.t] + '%' : ''}`;
  };
  const reset = () => { $('#tres').hidden = true; $('#theard').hidden = true; $('#taudio').hidden = true; paint(); };
  if (lib) {
    $('#tgrp').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; grp = b.dataset.g; idx = 0; $$('#tgrp .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); reset(); };
    $('#tlvl').onclick = (e) => { const b = e.target.closest('[data-l]'); if (!b) return; lvl = +b.dataset.l; idx = 0; $$('#tlvl .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); reset(); };
  }
  const nav = (d) => { if (take) return; idx = d === 'r' ? Math.floor(Math.random() * pool().length) : idx + d; reset(); };
  $('#tprev').onclick = () => nav(-1); $('#tnext').onclick = () => nav(1); $('#trand').onclick = () => nav('r');
  if ($('#tstages')) $('#tstages').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; stage = +b.dataset.s; $$('#tstages button').forEach((x) => x.setAttribute('aria-pressed', x === b)); reset(); };
  if ($('#tsay')) $('#tsay').onclick = () => { const s = STAGES[stage]; Voice.cancel(); Voice.speak(Array(s.reps).fill(cur().t).join(' '), { rate: s.rate }); };
  $('#tself').onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; const r = +b.dataset.r; ctx.mark(); Store.best('tw:' + cur().t, [0, 30, 65, 95][r]); toast(r === 3 ? 'Отлично! Переходите к следующему этапу.' : 'Повторите медленнее, затем снова в темпе.'); paint(); };
  const finish = async () => {
    if (!take) return; clearInterval(timer);
    $('#tgo').disabled = true; $('#tst').textContent = 'Обрабатываю…';
    const r = await take.stop((m) => ($('#tst').textContent = m)); take = null; $('#tgo').disabled = false; $('#tgo').innerHTML = `${ico('mic')}Проверить`;
    if (url) URL.revokeObjectURL(url); url = r.url; if (url) { const au = $('#taudio'); au.src = url; au.hidden = false; }
    const it = cur(), reps = STAGES[stage].reps, targetText = Array(reps).fill(it.t).join(' ');
    const dur = r.sum ? r.sum.dur : r.wall;
    const syl = dur > 0.5 ? (countVowels(targetText) / dur) : NaN;
    if (!r.text) {
      $('#theard').hidden = true; ctx.mark();
      $('#tst').textContent = ASR.supported && !ASR.blocked ? 'Речь не распознана — говорите громче или ближе к микрофону.' : 'Распознавание речи недоступно в этом браузере — оцените себя на слух.';
      $('#tself').hidden = false;
      if (r.sum) { $('#tres').hidden = false; $('#tres').innerHTML = `<div class="result"><div><span class="k">Время</span><span class="v">${fmt(dur)}<small>с</small></span></div><div><span class="k">Скорость</span><span class="v">${fmt(syl)}<small>слог/с</small></span></div></div>`; }
      return;
    }
    const al = alignDetail(targetText, r.text);
    const st0 = al.status.slice(0, normWords(it.t).length).map((_, i) => { const col = []; for (let k = 0; k < reps; k++) col.push(al.status[i + k * normWords(it.t).length]); return col.includes('miss') ? 'miss' : col.includes('near') ? 'near' : 'ok'; });
    paint(st0);
    $('#theard').hidden = false; $('#ttext').innerHTML = esc(r.text) + ' ' + engineLabel(r);
    const acc = al.acc; const rec = Store.best('tw:' + it.t, acc);
    if (!c.set) Store.log('acc', acc);
    ctx.mark(); ctx.onResult && ctx.onResult({ twAcc: acc, syl, twIssues: al.issues });
    const [cls, txt] = acc >= 90 ? ['good', 'Чисто'] : acc >= 70 ? ['warn', 'Почти'] : ['bad', 'Есть потери'];
    const tip = acc >= 90 ? (stage < 3 && c.single == null ? `Переходите к этапу ${stage + 2}: «${STAGES[stage + 1].n}».` : 'Отличный результат. Возьмите скороговорку посложнее.') : 'Замедлитесь на один этап и утрируйте согласные в отмеченных словах, затем снова в темпе.';
    const sylV = !isFinite(syl) ? '' : stage === 0 ? (syl > 4 ? 'для медленного этапа быстровато — растягивайте гласные' : 'хорошо: медленно и чётко') : syl < 3.5 ? 'медленнее разговорной — можно ускоряться' : syl <= 6 ? 'темп живой речи' : syl <= 7.5 ? 'быстро — чистота важнее скорости' : 'очень быстро';
    const issues = al.issues.slice(0, 8);
    const detail = `<div class="detail">
      <div><b>${al.ok} из ${al.T.length}</b> слов распознаны точно${al.near ? `, ${al.near} — с искажением` : ''}${al.extra ? `, лишних слов: ${al.extra}` : ''}.</div>
      ${issues.length ? `<ul>${issues.map((x) => `<li>${esc(issueText(x))}</li>`).join('')}</ul>` : '<div class="good">Все слова прозвучали чисто.</div>'}
      ${isFinite(syl) ? `<div>Скорость ${fmt(syl)} слога/с — ${sylV}.</div>` : ''}
    </div>`;
    $('#tres').hidden = false;
    $('#tres').innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Результат</span><span class="verdict ${cls}">${txt}</span></div>
      <div class="result"><div><span class="k">Разборчивость</span><span class="v">${acc}<small>%</small></span>${rec ? '<span class="n good">рекорд</span>' : ''}</div><div><span class="k">Время</span><span class="v">${fmt(dur)}<small>с</small></span></div><div><span class="k">Скорость</span><span class="v">${fmt(syl)}<small>слог/с</small></span><span class="n muted">разговорная ≈ 4–5</span></div></div>
      ${detail}
      <div id="tAi"></div>
      <p class="small muted">${tip}${stage === 1 ? ' Шёпот распознаётся хуже — ориентируйтесь на ощущения.' : ''} Распознавание иногда ошибается само — если уверены, что сказали чисто, повторите ещё раз.</p>`;
    $('#tst').textContent = '';
    Store.hist(`Скороговорка «${it.t.slice(0, 32)}${it.t.length > 32 ? '…' : ''}»: ${acc}%`);
    if (!ctx.onResult) aiFeedback($('#tAi'), { tier: 'quick', title: 'Совет коуча', prompt: `Упражнение: «${ex.title}», этап «${STAGES[stage].n}» (${STAGES[stage].d}).
Эталон: «${targetText}»
Распознано: «${r.text}»
Разборчивость ${acc}%, скорость ${fmt(syl)} слога/с (разговорная 4–5), время ${fmt(dur)} с.
Потери: ${issuesForAi(al.issues)}.
Если всё чисто — похвали коротко и скажи, переходить ли на следующий этап. Если есть потери — объясни артикуляцию проблемного звука (положение языка, губ) и как отработать. Ответ до 80 слов.` });
  };
  $('#tgo').onclick = async () => {
    if (take) return finish();
    Voice.cancel(); paint();
    let lastChange = performance.now(), lastLoud = performance.now(), startT = performance.now();
    take = await startTake({
      onText: (full, interim) => { lastChange = performance.now(); $('#theard').hidden = false; $('#ttext').innerHTML = esc(full) + (interim ? ` <span class="muted">${esc(interim)}</span>` : ''); },
      onFrame: (f) => { if (f.loud) lastLoud = performance.now(); },
    });
    if (!take) { $('#tself').hidden = false; $('#tst').textContent = 'Без микрофона: произнесите вслух и оцените себя.'; return; }
    $('#tgo').innerHTML = `${ico('stop')}Готово`; $('#tst').textContent = 'Говорите…'; $('#tres').hidden = true; $('#ttext').textContent = ''; $('#theard').hidden = !take.asr;
    if (!take.asr) $('#tst').textContent = 'Говорите… (распознавание недоступно — будет только время и запись)';
    timer = setInterval(() => {
      const n = performance.now(), got = take && take.asr && (take.asr.text || take.asr.interim);
      if ((got && n - lastChange > 1600 && n - lastLoud > 1100) || n - startT > 45000) finish();
    }, 200);
  };
  if ($('#tai')) $('#tai').onclick = async () => {
    const b = $('#tai'); b.disabled = true; b.textContent = 'Придумываю…';
    const snd = grp === 'all' || grp === 'mine' ? 'любой трудный звук' : `звук «${TW_GROUPS.find((g) => g.id === grp).label}»`;
    try {
      const r = await App.sample.json(`Придумай одну новую оригинальную русскую скороговорку на ${snd}. 8–16 слов, осмысленная и смешная, без повторов известных скороговорок. Ответь только JSON: {"t":"текст скороговорки"}`, { modelTier: 'quick', cache: false });
      if (r && typeof r.t === 'string' && r.t.length > 5) { const item = { t: r.t.trim(), s: grp === 'all' || grp === 'mine' ? 'М' : grp, l: 2, ai: true }; Store.d.custom.push(item); Store.save(); grp = 'mine'; lvl = 0; idx = Store.d.custom.length - 1; go(App.route); return; }
      toast('Не получилось — попробуйте ещё раз.');
    } catch (e) { toast(aiErr(e)); }
    b.disabled = false; b.textContent = 'Новая от ИИ';
  };
  paint();
  onLeave(() => { clearInterval(timer); take && take.abort(); if (url) URL.revokeObjectURL(url); });
};

/* запись «дубля»: микрофон + распознавание + запись + трек */
async function startTake({ onText, onFrame, asr = true, whisper = true } = {}) {
  if (!(await needMic())) return null;
  App.busy = true;
  const rec = makeRecorder(); rec.start();
  const track = makeTrack();
  const off = Mic.on((f) => { track.push(f); onFrame && onFrame(f); });
  const a = asr ? ASR.listen({ onText }) : null;
  const t0 = performance.now() / 1000;
  return {
    asr: a, track,
    async stop(onStage) {
      App.busy = false; off();
      const url = await rec.stop(); const asrText = ((a ? await a.stop() : '') || '').trim();
      const base = { url, text: asrText, asrText, engine: asrText ? 'browser' : null, sum: track.summary(), wall: performance.now() / 1000 - t0, frames: track.fr };
      if (asr && whisper && useWhisper() && rec.blob && base.sum) {
        onStage && onStage('Whisper уточняет расшифровку…');
        try { const w = await whisperTranscribe(rec.blob); if (w.text) { base.text = w.text; base.engine = 'whisper'; } else if (!asrText) base.engine = 'whisper'; }
        catch (e) { base.whisperError = e.message || String(e); }
      }
      return base;
    },
    abort() { App.busy = false; off(); rec.stop(); a && a.abort(); },
  };
}

/* ---- слоговые таблицы ---- */
W.syllables = (root, ex, ctx) => {
  let cons = 'П', mode = 'direct', bpm = 80, running = false, iv = 0, pos = -1, passes = 0, ramp = false, cluster = CLUSTERS[0];
  const MODES = [['direct', 'Прямые: ПА'], ['reverse', 'Обратные: АП'], ['pairs', 'Пары: ПА–БА'], ['clusters', 'Стечения: ПТКА']];
  const build = () => {
    if (mode === 'direct') return [...VOWELS_HARD, ...VOWELS_SOFT].map((v) => cons + v);
    if (mode === 'reverse') return VOWELS_HARD.map((v) => v + cons).concat(['И', 'Е', 'Я'].map((v) => v + cons));
    if (mode === 'pairs') return VOWELS_HARD.map((v) => `${cons}${v}–${PAIRS[cons]}${v}`);
    return VOWELS_HARD.map((v) => cluster + v).concat(VOWELS_HARD.map((v) => v + cluster));
  };
  root.innerHTML = `<div class="stack"><div class="chips" id="smode">${MODES.map(([k, l]) => `<button class="chip" data-m="${k}" aria-pressed="${k === mode}">${l}</button>`).join('')}</div>
    <div class="chips" id="scons"></div></div>
    <div class="panel lift stack center"><div class="syl-grid" id="sgrid"></div>
      <div class="slider-row" style="max-width:420px"><label for="sbpm">Темп</label><input type="range" id="sbpm" min="40" max="180" step="4" value="${bpm}"><span class="num" id="sbv">${bpm}</span></div>
      <div class="row" style="justify-content:center"><button class="btn primary big" id="sgo">${ico('play')}Старт</button>
      <label class="small row" style="gap:6px"><input type="checkbox" id="sramp"> Разгон: +8 уд/мин за круг</label></div>
      <span class="small muted num" id="spass">Кругов: 0</span></div>`;
  const drawCons = () => {
    const list = mode === 'clusters' ? CLUSTERS : CONSONANTS;
    $('#scons').innerHTML = list.map((k) => `<button class="chip" data-c="${k}" aria-pressed="${k === (mode === 'clusters' ? cluster : cons)}">${k}</button>`).join('');
  };
  const drawGrid = () => { $('#sgrid').innerHTML = build().map((s, i) => `<span class="syl ${i === pos ? 'on' : i < pos ? 'past' : ''}">${s}</span>`).join(''); };
  const schedule = () => { clearInterval(iv); if (running) iv = setInterval(step, 60000 / bpm); };
  const step = () => {
    const n = build().length; pos++;
    if (pos >= n) { pos = 0; passes++; $('#spass').textContent = `Кругов: ${passes}`; if (passes >= 2) ctx.mark(); if (ramp && bpm < 180) { bpm = Math.min(180, bpm + 8); $('#sbpm').value = bpm; $('#sbv').textContent = bpm; schedule(); } }
    Snd.click(pos === 0); drawGrid();
  };
  $('#smode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; pos = -1; $$('#smode .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); drawCons(); drawGrid(); };
  $('#scons').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; if (mode === 'clusters') cluster = b.dataset.c; else cons = b.dataset.c; pos = -1; drawCons(); drawGrid(); };
  $('#sbpm').oninput = (e) => { bpm = +e.target.value; $('#sbv').textContent = bpm; schedule(); };
  $('#sramp').onchange = (e) => (ramp = e.target.checked);
  $('#sgo').onclick = () => { Snd.get(); running = !running; $('#sgo').innerHTML = running ? `${ico('stop')}Стоп` : `${ico('play')}Старт`; if (!running) { pos = -1; drawGrid(); } schedule(); };
  drawCons(); drawGrid(); onLeave(() => clearInterval(iv));
};

/* ---- чтение текста ---- */
function readingMetricsHTML(r, textWords, mode, rawText) {
  const s = r.sum; const words = r.text ? normWords(r.text).length : textWords;
  const dur = s ? s.dur : r.wall;
  const wpm = dur > 2 ? (words / dur) * 60 : NaN;
  const al = r.text && mode !== 'count' ? alignDetail(rawText || r.targetWords.join(' '), r.text) : null;
  const mono = s ? s.mono : NaN;
  const syl = dur > 2 ? countVowels(rawText || '') / dur : NaN;
  const pe = s && r.frames ? phraseEnds(r.frames, s.t0, s.t1) : { drop: NaN };
  const sentences = rawText ? (rawText.match(/[.!?…]+/g) || []).length : 0;
  const wv = wpm > 170 ? ['warn', 'быстро'] : wpm < 95 ? ['warn', 'медленно'] : ['good', 'комфортно'];
  const mv = !(mono >= 0) ? ['', ''] : mono < 2 ? ['bad', 'монотонно'] : mono < 4 ? ['good', 'живо'] : ['good', 'очень выразительно'];
  const plus = [], minus = [];
  if (isFinite(wpm)) (wv[0] === 'good' ? plus : minus).push(wpm > 170 ? `Темп ${fmt(wpm, 0)} слов/мин — выше комфортного (110–150). Слушатель не успевает: добавьте паузы между мыслями.` : wpm < 95 ? `Темп ${fmt(wpm, 0)} слов/мин — медленнее комфортного. Читайте энергичнее, не растягивая паузы внутри фраз.` : `Темп ${fmt(wpm, 0)} слов/мин — комфортный для слушателя.`);
  if (al) (al.acc >= 90 ? plus : minus).push(al.acc >= 90 ? `Разборчивость ${al.acc}%: почти все слова распознаны точно.` : `Разборчивость ${al.acc}%: ${al.T.length - al.ok} из ${al.T.length} слов прозвучали нечётко или пропущены.`);
  if (isFinite(mono)) (mono >= 2 ? plus : minus).push(mono >= 2 ? `Мелодика ${fmt(mono)} пт — голос живо движется по высоте.` : `Мелодика ${fmt(mono)} пт — голос почти не меняет высоту. Поднимайте тон на ключевых словах и опускайте в конце утверждений.`);
  if (s && sentences > 1) { const p = s.pauses.length; (p >= sentences - 1 ? plus : minus).push(p >= sentences - 1 ? `Пауз ${p} при ${sentences} предложениях — текст разбит на смысловые куски.` : `Пауз всего ${p} на ${sentences} предложений — фразы сливаются. Делайте паузу хотя бы на каждой точке.`); }
  if (s && s.pauses.length) { const lp = Math.max(...s.pauses); if (lp > 2.2) minus.push(`Самая длинная пауза — ${fmt(lp)} с: похоже на запинку или потерю строки.`); }
  if (isFinite(pe.drop)) (pe.drop <= 6 ? plus : minus).push(pe.drop <= 6 ? `Концы фраз звучат ровно (спад ${fmt(pe.drop, 0)} дБ).` : `К концу фраз громкость падает на ${fmt(pe.drop, 0)} дБ — окончания «проглатываются». Договаривайте последний слог на опоре дыхания.`);
  const issues = al ? al.issues.slice(0, 10) : [];
  return {
    wpm, acc: al ? al.acc : null, mono, al,
    html: `<div class="result">
      <div><span class="k">Темп</span><span class="v">${fmt(wpm, 0)}<small>сл/мин</small></span><span class="n ${wv[0]}">${isFinite(wpm) ? wv[1] : ''}</span></div>
      ${al ? `<div><span class="k">Разборчивость</span><span class="v">${al.acc}<small>%</small></span><span class="n muted">${al.ok} из ${al.T.length} слов</span></div>` : ''}
      <div><span class="k">Мелодика</span><span class="v">${fmt(mono)}<small>пт</small></span><span class="n ${mv[0]}">${mv[1]}</span></div>
      <div><span class="k">Паузы</span><span class="v">${s ? s.pauses.length : '—'}</span><span class="n muted">${s && s.pauses.length ? 'в среднем ' + fmt(s.pauses.reduce((a, b) => a + b, 0) / s.pauses.length) + ' с' : ''}</span></div>
      <div><span class="k">Время</span><span class="v">${fmt(dur, 1)}<small>с</small></span><span class="n muted">${isFinite(syl) && syl > 0 ? fmt(syl) + ' слога/с' : ''}</span></div></div>
      ${plus.length || minus.length ? `<div class="split"><div class="plus"><h3>Что получилось</h3>${plus.length ? `<ul>${plus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span class="small muted">Пока нечего отметить — всё впереди.</span>'}</div><div class="minus"><h3>Над чем поработать</h3>${minus.length ? `<ul>${minus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span class="small muted">Замечаний нет.</span>'}</div></div>` : ''}
      ${issues.length ? `<div class="detail"><h4>Слова с потерями</h4><ul>${issues.map((x) => `<li>${esc(issueText(x))}</li>`).join('')}</ul><span class="small muted">Распознавание тоже ошибается — ориентируйтесь на повторяющиеся звуки.</span></div>` : ''}`,
  };
}
W.reading = (root, ex, ctx) => {
  const c = ex.cfg || {}, mode = c.mode;
  const raw = TEXTS[c.text] || '';
  const clean = raw.replace(/[|↑↓]/g, ' ');
  const targetWords = normWords(clean);
  let phase = 0, take = null, results = [], url = [], corkT = 0, corkIv = 0, liveIv = 0;
  const textHTML = (status) => {
    if (mode === 'count') return '<p class="read-text">Вдох — и вслух: «Один, два, три, четыре…»</p>';
    if (mode === 'pauses') return `<p class="read-text">${esc(raw).replace(/\|\|/g, '<span class="mk">||</span>').replace(/\|/g, '<span class="mk">|</span>').replace(/↑/g, '<span class="mk">↑</span>').replace(/↓/g, '<span class="mk">↓</span>')}</p>`;
    return `<p class="read-text">${tokensHTML(raw, status)}</p>`;
  };
  root.innerHTML = `<div class="panel lift stack">
    ${mode === 'cork' ? '<div class="phase-tabs" id="rph"><span>1. Без пробки</span><span>2. С пробкой, 2 мин</span><span>3. Снова без пробки</span></div>' : ''}
    <div id="rtext">${textHTML()}</div>
    ${mode === 'count' ? '<div class="center"><div class="big-num num" id="rcount">0</div><div class="small muted">досчитали до</div></div>' : ''}
    <div class="row"><button class="btn primary big" id="rgo">${ico('mic')}Читать</button><span class="timer-big num" id="rtime" hidden>0:00</span><span class="small muted" id="rst"></span></div>
    <div class="heard" id="rheard" hidden><b>Распознано</b><span id="rtxt"></span></div>
    ${mode === 'count' ? '<div class="row small"><label for="rman">Или введите вручную:</label><input id="rman" type="number" min="1" max="200" style="width:90px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--surface)"><button class="btn" id="rmanok">Сохранить</button></div>' : ''}
  </div><div class="panel stack" id="rres" hidden></div>`;
  const setPhase = () => { if (mode !== 'cork') return; $$('#rph span').forEach((s, i) => (s.className = i < phase ? 'done' : i === phase ? 'cur' : '')); $('#rgo').innerHTML = phase === 1 ? `${ico('play')}Старт: 2 минуты с пробкой` : `${ico('mic')}Читать`; };
  setPhase();
  const saveCount = (n) => { if (!(n > 0)) return; Store.log('count', n); const rec = Store.best('count', n); ctx.mark(); $('#rcount') && ($('#rcount').textContent = n); $('#rres').hidden = false; $('#rres').innerHTML = `<span class="eyebrow">Результат</span><p>Досчитали до <b class="num">${n}</b>${rec ? ' — новый рекорд!' : ` · рекорд: ${Store.d.best.count}`}. Норма — 20–30, хорошо — 35 и больше.</p>`; Store.hist(`Счёт на выдохе: ${n}`); };
  if (mode === 'count') $('#rmanok').onclick = () => saveCount(+$('#rman').value);
  const parseCount = (t) => {
    let mx = 0; const w = normWords(t);
    for (const x of w) { if (/^\d+$/.test(x)) mx = Math.max(mx, +x); else { const i = COUNT_WORDS.indexOf(x); if (i >= 0) mx = Math.max(mx, i < 20 ? i + 1 : [30, 40, 50, 60][i - 20]); } }
    const joined = t.match(/\d+/g); if (joined) joined.forEach((d) => { if (+d < 200) mx = Math.max(mx, +d); });
    return mx;
  };
  const stopTake = async () => {
    clearInterval(liveIv);
    $('#rgo').disabled = true; $('#rst').textContent = 'Обрабатываю…';
    const r = await take.stop((m) => ($('#rst').textContent = m)); take = null; $('#rgo').disabled = false; $('#rst').textContent = '';
    if (r.text) { $('#rheard').hidden = false; $('#rtxt').innerHTML = esc(r.text) + ' ' + engineLabel(r); }
    r.targetWords = targetWords; ctx.mark();
    if (mode === 'count') { $('#rgo').innerHTML = `${ico('mic')}Ещё раз`; const n = parseCount(r.text); if (n) saveCount(n); else $('#rst').textContent = 'Не удалось распознать счёт — введите число вручную.'; return; }
    const m = readingMetricsHTML(r, targetWords.length, mode, clean);
    if (m.al) $('#rtext').innerHTML = textHTML(m.al.status);
    if (!r.text) $('#rst').textContent = ASR.supported && !ASR.blocked ? 'Текст не распознан — темп посчитан по длине текста.' : 'Распознавание недоступно — темп посчитан по длине текста.';
    results[phase] = m; url[phase] = r.url;
    if (isFinite(m.wpm) && mode !== 'cork') Store.log('wpm', +m.wpm.toFixed(0));
    if (m.acc != null) Store.log('acc', m.acc);
    if (isFinite(m.mono)) Store.log('mono', +m.mono.toFixed(2));
    ctx.onResult && ctx.onResult({ wpm: m.wpm, acc: m.acc, mono: m.mono, readIssues: m.al ? m.al.issues : [], pauses: r.sum ? r.sum.pauses.length : null, drop: r.sum && r.frames ? phraseEnds(r.frames, r.sum.t0, r.sum.t1).drop : NaN });
    let extra = '';
    if (mode === 'cork') {
      if (phase === 0) { phase = 1; setPhase(); extra = '<p class="small">Теперь возьмите пробку и нажмите «Старт: 2 минуты с пробкой».</p>'; }
      else if (phase === 2) {
        const a = results[0], b = results[2];
        extra = `<span class="eyebrow">До и после пробки</span><div class="result"><div><span class="k">Разборчивость до</span><span class="v">${a && a.acc != null ? a.acc : '—'}<small>%</small></span></div><div><span class="k">После</span><span class="v">${b.acc != null ? b.acc : '—'}<small>%</small></span>${a && a.acc != null && b.acc != null ? `<span class="n ${b.acc >= a.acc ? 'good' : 'warn'}">${b.acc >= a.acc ? '+' : ''}${b.acc - a.acc} п.п.</span>` : ''}</div></div>
          <div class="grid2">${url[0] ? `<div class="stack"><span class="small muted">До</span><audio controls src="${url[0]}" style="width:100%"></audio></div>` : ''}${url[2] ? `<div class="stack"><span class="small muted">После</span><audio controls src="${url[2]}" style="width:100%"></audio></div>` : ''}</div>`;
        ctx.mark(); phase = 3; setPhase(); $('#rgo').innerHTML = `${ico('mic')}Сначала`;
        Store.hist(`Метод пробки: ${a && a.acc != null ? a.acc : '—'}% → ${b.acc != null ? b.acc : '—'}%`);
        if (b.acc != null) Store.log('acc', b.acc);
      }
    } else { ctx.mark(); $('#rgo').innerHTML = `${ico('mic')}Ещё раз`; Store.hist(`${ex.title}: ${fmt(m.wpm, 0)} сл/мин${m.acc != null ? ', разборчивость ' + m.acc + '%' : ''}${isFinite(m.mono) ? ', мелодика ' + fmt(m.mono) + ' пт' : ''}`); }
    $('#rres').hidden = false;
    $('#rres').innerHTML = `<span class="eyebrow">${mode === 'cork' ? ['Шаг 1 — без пробки', '', 'Шаг 3 — снова без пробки'][Math.min(phase === 3 ? 2 : 0, 2)] : 'Результат'}</span>${m.html}${r.url && mode !== 'cork' ? `<audio controls src="${r.url}" style="width:100%"></audio>` : ''}${extra}<div id="rAi"></div>`;
    const focus = { melody: 'выразительность и мелодику (разброс высоты)', pauses: 'соблюдение партитуры пауз и повышений/понижений тона', tempo: 'темп и его комфортность для слушателя', cork: 'разборчивость до и после работы с пробкой', diag: 'общую чёткость и подачу' }[mode] || 'чёткость и подачу';
    const aiNow = !ctx.onResult && (mode !== 'cork' || phase === 3);
    if (aiNow) {
      const corkCmp = mode === 'cork' ? `Разборчивость до пробки: ${results[0] && results[0].acc != null ? results[0].acc + '%' : 'н/д'}, после: ${results[2] && results[2].acc != null ? results[2].acc + '%' : 'н/д'}. Потери до: ${issuesForAi(results[0] && results[0].al && results[0].al.issues)}. ` : '';
      aiFeedback($('#rAi'), { title: 'Разбор чтения', prompt: `Упражнение: «${ex.title}». Главный фокус: ${focus}.
Эталонный текст: """${raw}"""
Распознано: """${r.text || '(распознавание недоступно)'}"""
${corkCmp}Метрики: темп ${fmt(m.wpm, 0)} слов/мин (норма 110–150), разборчивость ${m.acc != null ? m.acc + '%' : 'н/д'}, разброс высоты ${fmt(m.mono)} пт (меньше 2 — монотонно, 2–4 — живо), пауз ${r.sum ? r.sum.pauses.length : 'н/д'}${r.sum && r.sum.pauses.length ? ' (самая длинная ' + fmt(Math.max(...r.sum.pauses)) + ' с)' : ''}, спад громкости к концу фраз ${fmt(r.sum && r.frames ? phraseEnds(r.frames, r.sum.t0, r.sum.t1).drop : NaN, 0)} дБ (норма до 6).
Слова с потерями: ${issuesForAi(m.al && m.al.issues)}.
Определи по потерянным словам, какие звуки или позиции (окончания, стечения согласных) страдают.` });
    }
  };
  $('#rgo').onclick = async () => {
    if (take) return stopTake();
    if (mode === 'cork' && phase === 1) {
      corkT = 120; $('#rtime').hidden = false; $('#rgo').disabled = true; $('#rst').textContent = 'Читайте текст вслух с пробкой, утрированно чётко';
      corkIv = setInterval(() => { corkT--; $('#rtime').textContent = mmss(corkT); if (corkT <= 0) { clearInterval(corkIv); Snd.ok(); phase = 2; setPhase(); $('#rgo').disabled = false; $('#rtime').hidden = true; $('#rst').textContent = 'Уберите пробку и прочитайте текст снова'; } }, 1000);
      return;
    }
    if (mode === 'cork' && phase === 3) { phase = 0; results = []; setPhase(); $('#rres').hidden = true; $('#rtext').innerHTML = textHTML(); return; }
    $('#rtext').innerHTML = textHTML(); $('#rres').hidden = true;
    take = await startTake({ onText: (full, interim) => { $('#rheard').hidden = false; $('#rtxt').innerHTML = esc(full) + (interim ? ` <span class="muted">${esc(interim)}</span>` : ''); if (mode === 'count') $('#rcount').textContent = parseCount(full + ' ' + interim); } });
    if (!take) { $('#rst').textContent = mode === 'count' ? 'Без микрофона: считайте вслух и введите результат вручную.' : 'Без микрофона: читайте вслух, засекая время по часам.'; return; }
    $('#rgo').innerHTML = `${ico('stop')}Закончил`; $('#rtime').hidden = false; $('#rtxt').textContent = '';
    const t0 = performance.now(); liveIv = setInterval(() => ($('#rtime').textContent = mmss((performance.now() - t0) / 1000)), 250);
    if (!take.asr) $('#rst').textContent = 'Распознавание недоступно — будут метрики голоса и запись.';
  };
  onLeave(() => { clearInterval(corkIv); clearInterval(liveIv); take && take.abort(); });
};

/* ---- интонация ---- */
function contourSVG(frames, t0, t1, words) {
  const pts = frames.filter((f) => f.t >= t0 - 0.1 && f.t <= t1 + 0.1);
  if (pts.length < 5) return '';
  const hz = pts.filter((f) => f.hz > 0).map((f) => f.hz), med = median(hz);
  const W = 600, H = 160, span = Math.max(0.5, t1 - t0 + 0.2);
  const x = (t) => ((t - t0 + 0.1) / span) * W, y = (s) => H / 2 - s * 6, yd = (db) => H - 6 - clamp((db + 60) / 50, 0, 1) * 40;
  let d = '', pen = false;
  pts.forEach((f) => { if (f.hz > 0) { const s = clamp(st(f.hz, med), -12, 12); d += `${pen ? 'L' : 'M'}${x(f.t).toFixed(1)},${y(s).toFixed(1)}`; pen = true; } else pen = false; });
  const e = pts.map((f, i) => `${i ? 'L' : 'M'}${x(f.t).toFixed(1)},${yd(f.db).toFixed(1)}`).join('');
  const lbl = words ? words.map((w) => `<text x="${x(w.t).toFixed(1)}" y="${H + 14}" text-anchor="middle" font-size="12" fill="var(--ink-3)" font-family="Onest,sans-serif">${esc(w.w)}</text>`).join('') : '';
  return `<svg viewBox="0 0 ${W} ${H + 20}" style="width:100%;height:auto;display:block" role="img" aria-label="Контур высоты голоса">
    <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--line)" stroke-dasharray="3 4"/>
    <path d="${e}" fill="none" stroke="var(--ink-3)" stroke-width="1" opacity=".5"/>
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${lbl}</svg>`;
}
W.intonation = (root, ex, ctx) => {
  const stress = ex.cfg.mode === 'stress';
  let pi = 0, wi = 0, ei = 0, take = null, url = null, auto = 0, neutral = false;
  const takes = []; let aiInfo = '';
  Store.d.stressBase ||= {};
  const phrases = stress ? STRESS_PHRASES : EMO_PHRASES;
  const content = (i) => countVowels(phrases[pi].split(' ')[i]) > 0;
  root.innerHTML = `<div class="panel lift stack center">
    ${stress ? '<span class="small muted" id="imode"></span>' : '<span class="emo" id="iemo"></span>'}
    <div class="phrase" id="iphr"></div>
    <div class="row" style="justify-content:center"><button class="btn primary big" id="igo">${ico('mic')}Записать</button>
      ${stress ? '<button class="btn" id="ibase">Записать нейтрально</button>' : ''}
      <button class="btn" id="inext">${stress ? 'Следующее слово' : 'Другой смысл'}</button><button class="btn ghost" id="iphrase">Другая фраза</button></div>
    <span class="small muted" id="ist"></span></div>
    <div class="panel stack" id="ires" hidden></div>
    <div class="panel stack" id="ilog" hidden><span class="eyebrow">Ваши дубли</span><div class="attempts" id="itakes" style="justify-content:flex-start"></div></div>`;
  const paint = () => {
    const words = phrases[pi].split(' ');
    $('#iphr').innerHTML = words.map((w, i) => `<span class="${stress && i === wi && !neutral ? 'hl' : ''}">${esc(w)}</span>`).join('') + (stress ? '' : '<span>…</span>');
    if (!stress) $('#iemo').textContent = 'Скажите ' + EMOTIONS[ei];
    else $('#imode').textContent = neutral ? 'Эталон: скажите фразу ровно, ничего не выделяя' : Store.d.stressBase[phrases[pi]] ? 'Эталон записан — сравнение с ним точнее' : 'Совет: сначала запишите фразу нейтрально — так оценка будет точнее';
  };
  const nextWord = () => { const n = phrases[pi].split(' ').length; let k = wi; do { k = (k + 1) % n; } while (!content(k) && k !== wi); wi = k; };
  $('#inext').onclick = () => { neutral = false; if (stress) nextWord(); else ei = (ei + 1) % EMOTIONS.length; $('#ires').hidden = true; paint(); };
  $('#iphrase').onclick = () => { neutral = false; pi = (pi + 1) % phrases.length; wi = 0; if (stress && !content(0)) nextWord(); $('#ires').hidden = true; paint(); };
  const record = async () => {
    take = await startTake({ asr: false });
    if (!take) { $('#ist').textContent = 'Без микрофона: произносите вслух и слушайте себя. Хорошо помогает запись на диктофон и «Анализ записи».'; neutral = false; paint(); return; }
    $('#igo').innerHTML = `${ico('stop')}Стоп`; $('#ist').textContent = 'Говорите фразу…'; auto = setTimeout(() => take && finish(), 7000);
  };
  if (stress) $('#ibase').onclick = () => { if (take) return; neutral = true; paint(); record(); };
  const stressResult = (r) => {
    const s = r.sum, words = phrases[pi].split(' '), phrase = phrases[pi];
    const pr = wordProminence(r.frames, s, words);
    if (!pr) return `<p>Не удалось разобрать слоги. Скажите фразу чуть медленнее и громче.</p>`;
    const wordT = words.map((w, i) => { const f = pr.feats[i]; return { w, t: f ? f.start + 0.05 : NaN }; }).filter((x) => isFinite(x.t));
    if (neutral) {
      Store.d.stressBase[phrase] = pr.feats.map((f) => f && { pitch: f.pitch, loud: f.loud, len: f.len, gap: f.gap });
      Store.save(); neutral = false;
      return `<div class="row" style="justify-content:space-between"><span class="eyebrow">Эталон записан</span><span class="verdict good">Готово</span></div>
        <p class="small">Теперь выделяйте подсвеченное слово — тренажёр будет сравнивать каждое слово с этим нейтральным прочтением. Так оценка не путает естественное понижение тона к концу фразы с ударением.</p>
        ${contourSVG(r.frames, s.t0, s.t1, wordT)}`;
    }
    const base = Store.d.stressBase[phrase];
    const sc = scoreProminence(pr.feats, base);
    const on = sc.filter(Boolean).sort((a, b) => b.score - a.score);
    const top = on[0], second = on[1], tgt = sc[wi];
    const hit = top && top.wi === wi, margin = top && second ? top.score - second.score : 0;
    const [cls, txt] = !tgt ? ['warn', 'Слово не найдено в записи'] : hit && margin >= 0.6 ? ['good', 'Акцент на нужном слове'] : hit ? ['warn', 'На нужном слове, но слабо'] : ['bad', `Акцент ушёл на «${words[top.wi]}»`];
    takes.push({ w: words[wi], ok: hit });
    $('#ilog').hidden = false; $('#itakes').innerHTML = takes.map((t) => `<span class="attempt ${t.ok ? 'best' : ''}">${esc(t.w)} ${t.ok ? '✓' : '✗'}</span>`).join('');
    if (hit) Snd.ok();
    const mx = Math.max(...on.map((x) => x.score)), mn = Math.min(...on.map((x) => x.score));
    const bars = words.map((w, i) => { const f = sc[i]; if (!f) return ''; const hgt = 14 + ((f.score - mn) / (mx - mn || 1)) * 86; return `<div class="pbar ${f.wi === top.wi ? 'top' : ''} ${i === wi ? 'tgt' : ''}"><i style="height:${hgt.toFixed(0)}px"></i><span>${esc(w)}</span></div>`; }).join('');
    // чем выделено целевое слово по сравнению с остальными
    let how = '';
    if (tgt) {
      const others = sc.filter((f) => f && f.wi !== wi);
      const avg = (k) => others.reduce((a, f) => a + (base && base[f.wi] ? f[k] - base[f.wi][k] : f[k]), 0) / (others.length || 1);
      const own = (k) => base && base[wi] ? tgt[k] - base[wi][k] : tgt[k];
      const dP = own('pitch') - avg('pitch'), dE = own('loud') - avg('loud'), dL = avg('len') > 0 ? (own('len') / avg('len') - 1) * 100 : 0, gap = tgt.gap;
      const items = [
        [`Высота: ${dP >= 0 ? '+' : ''}${fmt(dP)} пт относительно других слов`, dP >= 1.5],
        [`Громкость: ${dE >= 0 ? '+' : ''}${fmt(dE, 0)} дБ`, dE >= 2],
        [`Длительность слога: ${dL >= 0 ? '+' : ''}${fmt(dL, 0)}%`, dL >= 12],
        [`Пауза перед словом: ${gap >= 0.12 ? fmt(gap) + ' с' : 'нет'}`, gap >= 0.12],
      ];
      const tips = [];
      if (dP < 1.5) tips.push('поднимите тон на ударном слоге слова');
      if (dE < 2) tips.push('дайте слову чуть больше голоса');
      if (dL < 12) tips.push('немного растяните ударный гласный');
      if (gap < 0.12 && wi > 0) tips.push('попробуйте микропаузу перед словом');
      how = `<div class="detail"><h4>Чем выделено «${esc(words[wi])}»</h4><ul>${items.map(([t, g]) => `<li class="${g ? 'good' : ''}">${t}${g ? ' ✓' : ''}</li>`).join('')}</ul>
        ${tips.length && !(hit && margin >= 0.6) ? `<div>Что попробовать: ${tips.slice(0, 2).join(', ')}.</div>` : ''}
        ${!hit ? `<div>Сильнее всего прозвучало «${esc(words[top.wi])}» — ослабьте его: произнесите ровнее и тише.</div>` : ''}</div>`;
    }
    if (tgt) {
      const oth = sc.filter((f) => f && f.wi !== wi), av = (k) => oth.reduce((a, f) => a + f[k], 0) / (oth.length || 1);
      aiInfo = `Упражнение: логическое ударение. Фраза: «${phrase}». Нужно выделить слово «${words[wi]}».
Результат анализа записи: сильнее всего выделено «${words[top.wi]}»${hit ? ' (верно)' : ' (неверно)'}, отрыв от следующего по силе слова ${fmt(margin)} (больше 0,6 — акцент чёткий, меньше — слабый). Вердикт тренажёра: ${!hit ? 'акцент не на том слове' : margin >= 0.6 ? 'акцент на нужном слове и выражен чётко — хвали' : 'акцент на нужном слове, но слабый'}.
Нужное слово относительно остальных: высота ${fmt(tgt.pitch - av('pitch'))} пт, громкость ${fmt(tgt.loud - av('loud'), 0)} дБ, длительность слога ${fmt(av('len') > 0 ? (tgt.len / av('len') - 1) * 100 : 0, 0)}%, пауза перед словом ${fmt(tgt.gap)} с.${base ? ' Есть нейтральный эталон для сравнения.' : ' Нейтрального эталона нет — оценка грубее.'}
Смысл фразы при таком ударении: объясни, что именно противопоставляется.`;
    }
    const reliab = Math.abs(pr.nuclei - pr.syllables) > 2 ? `<p class="small warn">Слоги выделились неточно (${pr.nuclei} из ${pr.syllables}) — оценка менее надёжна. Говорите чуть медленнее, без слияния слов.</p>` : '';
    return `<div class="row" style="justify-content:space-between"><span class="eyebrow">Выделенность слов</span><span class="verdict ${cls}">${txt}</span></div>
      <div class="pbars">${bars}</div>
      ${how}${reliab}
      ${contourSVG(r.frames, s.t0, s.t1, wordT)}
      <p class="small muted">Выделенность = высота тона над естественной линией понижения + громкость + длительность + пауза перед словом${base ? ', в сравнении с вашим нейтральным прочтением' : ''}. Синяя линия — высота голоса, серая — громкость.</p>`;
  };
  const emotionResult = (r) => {
    const s = r.sum;
    const hz = r.frames.filter((f) => f.hz > 0 && f.t >= s.t0 && f.t <= s.t1).map((f) => f.hz);
    const rangeSt = hz.length > 5 ? st(pct(hz, 0.92), pct(hz, 0.08)) : NaN;
    const [cls, txt] = rangeSt >= 7 ? ['good', 'Яркая интонация'] : rangeSt >= 4 ? ['good', 'Живо'] : ['warn', 'Ровно — добавьте красок'];
    takes.push({ w: EMOTIONS[ei], r: rangeSt });
    $('#ilog').hidden = false; $('#itakes').innerHTML = takes.map((t) => `<span class="attempt">${esc(t.w)} · ${fmt(t.r, 0)} пт</span>`).join('');
    const loud = r.frames.filter((f) => f.loud && f.t >= s.t0 && f.t <= s.t1).map((f) => f.db);
    const dyn = loud.length > 5 ? pct(loud, 0.95) - pct(loud, 0.2) : NaN;
    const same = takes.length > 1 ? takes.slice(0, -1).filter((t) => Math.abs(t.r - rangeSt) < 1.5).length : 0;
    aiInfo = `Упражнение: «Одна фраза — восемь смыслов». Фраза: «${EMO_PHRASES[pi]}…», задание — сказать ${EMOTIONS[ei]}.
Замер: размах высоты ${fmt(rangeSt, 0)} пт (живая речь 5–10), динамика громкости ${fmt(dyn, 0)} дБ, длительность ${fmt(s.dur)} с. Прошлые дубли: ${takes.slice(0, -1).map((t) => t.w + ' ' + fmt(t.r, 0) + ' пт').join(', ') || 'нет'}.
Опиши, как обычно звучит эта эмоция (мелодический рисунок, темп, тембр) и совпадают ли с этим цифры.`;
    return `<div class="row" style="justify-content:space-between"><span class="eyebrow">Интонационный размах</span><span class="verdict ${cls}">${txt}</span></div>
      <div class="result"><div><span class="k">Размах высоты</span><span class="v">${fmt(rangeSt, 0)}<small>пт</small></span><span class="n muted">живая речь ≈ 5–10</span></div><div><span class="k">Динамика громкости</span><span class="v">${fmt(dyn, 0)}<small>дБ</small></span></div><div><span class="k">Длительность</span><span class="v">${fmt(s.dur)}<small>с</small></span></div></div>
      <div class="detail">${rangeSt < 4 ? '<div>Голос почти не двигается по высоте — эмоция слышна слабо. Преувеличьте в 2 раза: сейчас это кажется слишком, для слушателя будет в самый раз.</div>' : '<div>Хороший размах: эмоция читается голосом.</div>'}
        ${same ? '<div>Рисунок похож на предыдущие дубли — попробуйте другой приём: темп, паузу, шёпот или растягивание ударного слога.</div>' : ''}</div>
      ${contourSVG(r.frames, s.t0, s.t1)}
      <p class="small muted">У разных смыслов — разный рисунок: удивление взлетает вверх, угроза стелется низко, ирония растягивает ударный слог. Сравните дубли на слух.</p>`;
  };
  const finish = async () => {
    clearTimeout(auto); const r = await take.stop(); take = null; $('#igo').innerHTML = `${ico('mic')}Записать`; $('#ist').textContent = '';
    if (url) URL.revokeObjectURL(url); url = r.url;
    if (!r.sum) { $('#ist').textContent = 'Голос не услышан — говорите ближе к микрофону.'; neutral = false; paint(); return; }
    aiInfo = '';
    const html = stress ? stressResult(r) : emotionResult(r);
    $('#ires').hidden = false; $('#ires').innerHTML = html + (url ? `<audio controls src="${url}" style="width:100%"></audio>` : '') + '<div id="iAi"></div>';
    ctx.mark(); paint();
    if (aiInfo) aiFeedback($('#iAi'), { tier: 'quick', title: 'Совет коуча', prompt: aiInfo + '\nДай совет по интонации: какими средствами (высота, громкость, растяжка ударного гласного, пауза) добиться нужного эффекта и что сделать в следующем дубле. До 90 слов.' });
  };
  $('#igo').onclick = async () => { if (take) return finish(); neutral = false; paint(); record(); };
  if (stress && !content(0)) nextWord();
  paint(); onLeave(() => { clearTimeout(auto); take && take.abort(); if (url) URL.revokeObjectURL(url); });
};

/* ---- живая речь ---- */
W.speech = (root, ex, ctx) => {
  const nofill = ex.cfg.mode === 'nofill';
  let topic = TOPICS[Math.floor(Math.random() * TOPICS.length)], dur = nofill ? 60 : 90, take = null, iv = 0, t0 = 0, seen = 0, url = null, lastFill = 0;
  root.innerHTML = `<div class="panel lift stack">
    <div class="row" style="justify-content:space-between"><span class="eyebrow">Тема</span><div class="row" style="gap:4px"><button class="btn ghost" id="snew">${ico('shuffle')}Другая</button>${App.sample ? '<button class="btn ghost" id="sai">Тема от ИИ</button>' : ''}</div></div>
    <div class="tw-card" id="stopic"></div>
    <div class="row"><div class="chips" id="sdur">${[60, 90, 120].map((d) => `<button class="chip" data-d="${d}" aria-pressed="${d === dur}">${d} с</button>`).join('')}</div>
      <span class="timer-big num" id="stime" style="margin-left:auto">${mmss(dur)}</span></div>
    <div class="row"><button class="btn primary big" id="sgo">${ico('mic')}Говорить</button><span class="small muted" id="sst"></span>
    ${nofill ? '<span class="verdict good" id="sscore" style="margin-left:auto">Паразитов: 0</span>' : ''}</div>
    <div class="transcript" id="strans"><span class="muted">Здесь появится текст вашей речи.</span></div>
  </div>
  <div class="panel stack" id="sres" hidden></div>
  <details class="panel" id="spaste"><summary class="small" style="cursor:pointer">Нет микрофона? Вставьте расшифровку текста для разбора</summary>
    <div class="stack" style="margin-top:12px"><textarea class="plain" id="sptext" placeholder="Вставьте текст выступления или расшифровку голосового сообщения"></textarea><button class="btn" id="spgo" style="align-self:flex-start">Разобрать текст</button></div></details>`;
  const paintTopic = () => ($('#stopic').textContent = topic);
  paintTopic();
  $('#snew').onclick = () => { if (take) return; topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]; paintTopic(); };
  if ($('#sai')) $('#sai').onclick = async () => {
    const b = $('#sai'); b.disabled = true;
    try { const r = await App.sample.json('Предложи одну интересную тему для 1–2-минутной импровизированной речи на русском (для тренировки ораторского навыка). Не банальную. Ответь только JSON: {"topic":"..."}', { modelTier: 'quick', cache: false }); if (r && r.topic) { topic = String(r.topic); paintTopic(); } }
    catch (e) { toast(aiErr(e)); }
    b.disabled = false;
  };
  $('#sdur').onclick = (e) => { const b = e.target.closest('[data-d]'); if (!b || take) return; dur = +b.dataset.d; $$('#sdur .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#stime').textContent = mmss(dur); };
  const markHTML = (text, interim) => {
    const f = findFillers(text); let i = 0;
    const out = text.split(/\s+/).filter(Boolean).map((tok) => { const n = normWords(tok).length; let hit = false; for (let k = 0; k < n; k++) if (f.marks.has(i + k)) hit = true; i += n; return hit ? `<span class="f">${esc(tok)}</span>` : esc(tok); }).join(' ');
    return { html: out + (interim ? ` <span class="interim">${esc(interim)}</span>` : ''), f };
  };
  const analyze = async (text, sum, wall, pasted, altText) => {
    let f = findFillers(text); const words = f.words.length;
    // Whisper иногда «вычищает» слова-паразиты — берём больший счёт из двух расшифровок
    if (altText && altText !== text) { const f2 = findFillers(altText); if (f2.count > f.count) f = { ...f, count: f2.count, by: f2.by }; }
    const talk = pasted ? (words / 130) * 60 : sum ? sum.dur : wall;
    const wpm = !pasted && talk > 5 && words ? (words / talk) * 60 : NaN, perMin = talk > 5 ? f.count / (talk / 60) : f.count;
    const fv = words < 20 ? ['warn', 'Мало речи для оценки'] : perMin < 1 ? ['good', 'Чисто'] : perMin < 3 ? ['warn', 'Заметно'] : ['bad', 'Много паразитов'];
    if (sum && isFinite(wpm)) Store.log('wpm', +wpm.toFixed(0));
    if (words > 20) Store.log('fillers', +perMin.toFixed(2));
    if (sum && isFinite(sum.mono)) Store.log('mono', +sum.mono.toFixed(2));
    ctx.mark();
    Store.hist(`${ex.title}: ${words} слов, паразитов ${f.count}${isFinite(wpm) ? ', ' + fmt(wpm, 0) + ' сл/мин' : ''}`);
    const top = Object.entries(f.by).sort((a, b) => b[1] - a[1]);
    $('#sres').hidden = false;
    $('#sres').innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Разбор</span><span class="verdict ${fv[0]}">${fv[1]}</span></div>
      <div class="result"><div><span class="k">Слов</span><span class="v">${words}</span></div><div><span class="k">Темп</span><span class="v">${fmt(wpm, 0)}<small>сл/мин</small></span></div>
      <div><span class="k">Паразиты</span><span class="v">${f.count}</span><span class="n muted">${fmt(perMin, 1)} в минуту</span></div>
      ${sum ? `<div><span class="k">Мелодика</span><span class="v">${fmt(sum.mono)}<small>пт</small></span><span class="n ${sum.mono < 2 ? 'bad' : 'good'}">${sum.mono < 2 ? 'монотонно' : isFinite(sum.mono) ? 'живо' : ''}</span></div><div><span class="k">Долгие паузы</span><span class="v">${sum.longPauses}</span><span class="n muted">дольше 2 с</span></div>` : ''}</div>
      ${words < 20 ? `<p class="small warn">Всего ${words} ${plural(words, 'слово', 'слова', 'слов')} — по такому объёму метрики ненадёжны. Говорите хотя бы 40–60 секунд.</p>` : ''}
      ${top.length ? `<div class="fill-list">${top.map(([k, n]) => `<span>${esc(k)}<b>${n}</b></span>`).join('')}</div>` : (words >= 20 ? '<p class="small good">Ни одного слова-паразита. Так держать!</p>' : '')}
      ${url ? `<audio controls src="${url}" style="width:100%"></audio>` : ''}
      <p class="small muted">«Вот», «ну», «значит» иногда уместны — считаются все вхождения, судите по контексту. Длинные паузы (дольше 2 с) обычно означают потерю мысли.</p>
      <div id="spAi"></div>`;
    if (words >= 5) aiFeedback($('#spAi'), { title: 'Разбор речи', prompt: `Упражнение: «${ex.title}» — импровизированная речь на тему «${topic}», лимит ${dur} с.
Метрики: ${pasted ? `${words} слов (текст вставлен вручную — темп и голос не измерялись)` : `${words} слов за ${fmt(talk, 0)} с, темп ${fmt(wpm, 0)} слов/мин`} (комфортно 110–150), слов-паразитов ${f.count}${pasted ? '' : ` (${fmt(perMin, 1)}/мин)`} ( ${top.map(([k, n]) => k + ' ×' + n).join(', ') || 'нет'}), разброс высоты голоса ${sum ? fmt(sum.mono) : 'н/д'} полутона (меньше 2 — монотонно), долгих пауз ${sum ? sum.longPauses : 'н/д'}.${words < 20 ? ' Речь очень короткая — отметь это и мотивируй говорить дольше.' : ''}
Расшифровка:
"""${text.slice(0, 6000)}"""
Оцени содержание (структура: тезис — пример — вывод, ясность мысли) и подачу. Если есть слабая фраза — покажи, как сказать сильнее. Предложи упражнение из списка: ${EXERCISES.filter((e) => e.sec !== 'tools').map((e) => e.title).join(', ')}.` });
  };
  const finish = async () => {
    clearInterval(iv); $('#sgo').disabled = true; const r = await take.stop((m) => ($('#sst').textContent = m)); take = null; $('#sgo').disabled = false; $('#sgo').innerHTML = `${ico('mic')}Ещё раз`; $('#sst').innerHTML = engineLabel(r);
    if (url) URL.revokeObjectURL(url); url = r.url;
    const text = r.text; $('#strans').innerHTML = text ? markHTML(text).html : '<span class="muted">Текст не распознан.</span>';
    if (!text) { $('#sst').textContent = ASR.supported && !ASR.blocked ? 'Речь не распознана.' : 'Распознавание речи недоступно — откройте в Chrome или Edge.'; }
    analyze(text, r.sum, r.wall, false, r.asrText);
  };
  $('#sgo').onclick = async () => {
    if (take) return finish();
    seen = 0; lastFill = 0; $('#sres').hidden = true;
    take = await startTake({
      onText: (full, interim) => {
        const m = markHTML(full, interim); $('#strans').innerHTML = m.html; $('#strans').scrollTop = 1e6;
        const live = findFillers(full + ' ' + interim).count;
        if (nofill && live > seen) { seen = live; if (performance.now() - lastFill > 300) { Snd.buzz(); lastFill = performance.now(); } const sc = $('#sscore'); sc.textContent = `Паразитов: ${live}`; sc.className = 'verdict ' + (live < 2 ? 'good' : live < 4 ? 'warn' : 'bad'); sc.classList.remove('flash'); void sc.offsetWidth; sc.classList.add('flash'); }
      },
    });
    if (!take) { $('#spaste').open = true; return; }
    if (!take.asr) $('#sst').textContent = 'Распознавание недоступно — будут метрики голоса и запись.';
    $('#sgo').innerHTML = `${ico('stop')}Закончить`; $('#strans').innerHTML = '<span class="muted">Слушаю…</span>';
    t0 = performance.now(); iv = setInterval(() => { const left = dur - (performance.now() - t0) / 1000; $('#stime').textContent = mmss(Math.max(0, left)); if (left <= 0) finish(); }, 250);
  };
  $('#spgo').onclick = () => { const t = $('#sptext').value.trim(); if (!t) return; $('#strans').innerHTML = markHTML(t).html; analyze(t, null, 0, true); };
  onLeave(() => { clearInterval(iv); take && take.abort(); if (url) URL.revokeObjectURL(url); });
};

/* ---- голосовой собеседник ---- */
/* голос собеседника: живой нейросетевой (Piper через мост) или системный синтезатор браузера */
App.tts = null;
const Voice = {
  q: [], playing: null, pending: 0, onIdle: null, gen: 0, idleIv: 0,
  ruVoices() { try { return speechSynthesis.getVoices().filter((v) => /^ru/i.test(v.lang)); } catch (e) { return []; } },
  cfg() { const s = Store.d.settings; return { name: s.voiceName || '', piper: s.piperVoice || 'irina', preset: VOICE_PRESETS.find((p) => p.id === s.voicePreset) || VOICE_PRESETS[0] }; },
  usePiper() { const t = App.tts, c = this.cfg(); return !App.framed && !!bridgeCfg() && Store.d.settings.ttsEngine !== 'browser' && !!t && !!t.voices && !!t.voices[c.piper] && t.voices[c.piper].present; },
  available() { return this.usePiper() || TTS.ok; },
  speak(text, opt = {}) {
    text = String(text || '').replace(/[*#_`~>]/g, '').trim(); if (!text) return;
    if (this.usePiper()) return this.piperSpeak(text, opt);
    if (!TTS.ok) return;
    const c = this.cfg(), u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU'; u.pitch = c.preset.pitch; u.rate = opt.rate || c.preset.rate;
    const v = this.ruVoices().find((x) => x.name === c.name) || TTS.voice(); if (v) u.voice = v;
    this.pending++; let fired = false;
    const done = () => { if (fired) return; fired = true; this.pending = Math.max(0, this.pending - 1); };
    u.onend = done; u.onerror = done;
    setTimeout(done, 4000 + (text.length / (11 * c.preset.rate)) * 1000);
    speechSynthesis.speak(u);
  },
  piperSpeak(text, opt = {}) {
    const cfg = bridgeCfg(), c = this.cfg(), gen = this.gen;
    const item = { text, rate: opt.rate, p: fetch(bridgeBase(cfg) + '/api/tts', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' }, body: JSON.stringify({ text, voice: c.piper }) }).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status); return r.blob(); }) };
    item.p.catch(() => {});
    this.pending++; this.q.push(item);
    if (!this.playing) this.next(gen);
  },
  async next(gen) {
    if (gen !== this.gen) return;
    const it = this.q.shift(); if (!it) { this.playing = null; return; }
    this.playing = it;
    let blob;
    try { blob = await it.p; } catch (e) {
      if (gen !== this.gen) return;
      if (App.tts) App.tts.lastError = e.message; this.pending = Math.max(0, this.pending - 1); this.playing = null;
      if (TTS.ok) { const save = Store.d.settings.ttsEngine; Store.d.settings.ttsEngine = 'browser'; this.speak(it.text); Store.d.settings.ttsEngine = save; }
      return this.next(gen);
    }
    if (gen !== this.gen) return;
    const url = URL.createObjectURL(blob), a = new Audio(url), pr = this.cfg().preset;
    a.preservesPitch = it.rate ? true : !pr.shift; a.playbackRate = it.rate || pr.prate || 1; it.audio = a;
    if (pr.robot) { try { const ac = Snd.get(), src = ac.createMediaElementSource(a), g = ac.createGain(), o = ac.createOscillator(); o.frequency.value = 55; g.gain.value = 0; o.connect(g.gain); src.connect(g).connect(ac.destination); o.start(); a.onpause = () => { try { o.stop(); } catch (e) {} }; } catch (e) {} }
    const fin = () => { if (it.done) return; it.done = true; URL.revokeObjectURL(url); this.pending = Math.max(0, this.pending - 1); this.playing = null; this.next(gen); };
    a.onended = fin; a.onerror = fin;
    a.play().catch(fin);
  },
  idle() { return !this.pending && !this.playing && !this.q.length && !(TTS.ok && speechSynthesis.speaking); },
  whenIdle(fn) {
    clearInterval(this.idleIv); this.onIdle = fn;
    this.idleIv = setInterval(() => { if (this.onIdle && this.idle()) { clearInterval(this.idleIv); const f = this.onIdle; this.onIdle = null; setTimeout(f, 450); } }, 120);
  },
  cancel() {
    this.gen++; clearInterval(this.idleIv); this.onIdle = null; this.pending = 0; this.q = [];
    if (this.playing && this.playing.audio) { try { this.playing.audio.pause(); } catch (e) {} }
    this.playing = null; try { speechSynthesis.cancel(); } catch (e) {}
  },
};
/* ассистент звучит из колонок и попадает в микрофон — вырезаем из реплики пользователя куски его же фразы */
function stripEcho(user, bot) {
  const toks = String(user).split(/\s+/).filter(Boolean), un = toks.map((w) => cmpWords(w).join(' ')), bn = cmpWords(bot || '');
  if (bn.length < 3 || !toks.length) return user;
  const grams = new Set(); for (let i = 0; i + 3 <= bn.length; i++) grams.add(bn.slice(i, i + 3).join(' '));
  const flat = []; un.forEach((w, ti) => w.split(' ').filter(Boolean).forEach((x) => flat.push({ x, ti })));
  const kill = new Set();
  for (let i = 0; i + 3 <= flat.length; i++) if (grams.has(flat.slice(i, i + 3).map((f) => f.x).join(' '))) for (let k = 0; k < 3; k++) kill.add(flat[i + k].ti);
  return toks.filter((_, i) => !kill.has(i)).join(' ').trim();
}
function refreshTts() {
  const cfg = bridgeCfg(); if (!cfg || App.framed) return Promise.resolve(null);
  return fetch(bridgeBase(cfg) + '/api/tts/status', { headers: { 'x-zv-token': cfg.token || '' } }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) App.tts = j; return j; }).catch(() => null);
}
W.dialog = (root, ex, ctx) => {
  const S = Store.d.settings;
  let scen = SCENARIOS.find((x) => x.id === S.dlgScen) || SCENARIOS[0], topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  let turns = [], running = false, phase = 'idle', take = null, poll = 0, ctl = null, handsFree = S.dlgHands !== false, deep = !!S.dlgDeep;
  const stats = [];
  root.innerHTML = `<div class="panel lift stack" id="dSetup">
      <div class="stack" style="gap:8px"><span class="eyebrow">Сценарий</span><div class="chips" id="dScen">${SCENARIOS.map((x) => `<button class="chip" data-s="${x.id}" aria-pressed="${x.id === scen.id}">${x.t}</button>`).join('')}</div>
        <div class="row small" id="dTopicRow"><span class="muted">Тема:</span><b id="dTopic"></b><button class="btn ghost" id="dTopicNew" style="min-height:0;padding:2px 8px">${ico('shuffle')}Другая</button></div></div>
      <div class="stack" style="gap:8px"><span class="eyebrow">Голос собеседника</span><div id="dVoiceBox"></div></div>
      <div class="stack" style="gap:6px"><span class="eyebrow">Режим</span><label class="check"><input type="checkbox" id="dHands" ${handsFree ? 'checked' : ''}> Отвечать без кнопок — собеседник слушает сразу после вопроса</label>
        <label class="check"><input type="checkbox" id="dDeep" ${deep ? 'checked' : ''}> Умнее, но медленнее</label>
        ${useWhisper() ? `<label class="check"><input type="checkbox" id="dWh" ${S.dlgWhisper !== false ? 'checked' : ''}> Точная расшифровка Whisper (+1–5 с на ответ)</label>` : ''}</div>
      <div id="dAiState"></div>
      <div class="row"><button class="btn primary big" id="dStart">${ico('play')}Начать разговор</button></div></div>
    <div class="panel lift stack" id="dTalk" hidden>
      <div class="row" style="justify-content:space-between"><span class="eyebrow" id="dTitle"></span><span class="verdict" id="dPhase"></span></div>
      <div class="chat" id="dChat" style="max-height:460px"></div>
      <div class="meter" style="height:6px"><i id="dLvl" style="width:0;background:var(--tally)"></i></div>
      <div class="row"><button class="btn primary" id="dMain">${ico('mic')}Говорить</button><button class="btn" id="dSkipTts" hidden>Перебить</button>
        <button class="btn ghost" id="dEnd" style="margin-left:auto">Завершить и разобрать</button></div>
      <form class="composer" id="dForm"><textarea id="dText" rows="1" placeholder="Или напишите ответ текстом…" aria-label="Ответ текстом"></textarea><button class="btn" type="submit">Отправить</button></form>
    </div>
    <div class="panel stack" id="dRes" hidden></div>`;
  const paintTopic = () => { $('#dTopic').textContent = topic; $('#dTopicRow').hidden = !/\{topic\}/.test(scen.p); };
  paintTopic();
  mountVoiceSettings($('#dVoiceBox'));
  $('#dScen').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; scen = SCENARIOS.find((x) => x.id === b.dataset.s); S.dlgScen = scen.id; Store.save(); $$('#dScen .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); paintTopic(); if (sess) openSess(); };
  $('#dTopicNew').onclick = () => { topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]; paintTopic(); if (sess) openSess(); };
  const dWh = $('#dWh'); if (dWh) dWh.onchange = (e) => { S.dlgWhisper = e.target.checked; Store.save(); };
  $('#dHands').onchange = (e) => { handsFree = e.target.checked; S.dlgHands = handsFree; Store.save(); };
  $('#dDeep').onchange = (e) => { deep = e.target.checked; S.dlgDeep = deep; Store.save(); if (sess) openSess(); };
  (async () => { if (!(await ensureAi())) { $('#dAiState').innerHTML = aiOffHTML(); $('#dStart').disabled = true; } else openSess(); })();

  const RULES = () => `${scen.p.replace('{topic}', topic)}
Ты — голосовой собеседник в тренажёре речи «Звукоряд»: твои реплики озвучивает синтезатор речи.
Правила: говори по-русски, живо и естественно, 1–3 коротких предложения (до 45 слов). Без списков, эмодзи, markdown, ремарок и звёздочек. Почти всегда заканчивай одним вопросом, чтобы собеседник говорил развёрнуто. Не исправляй его речь по ходу — разбор будет в конце. Его реплики получены распознаванием речи, возможны ошибки — не придирайся к ним. Обращайся на «ты», если он сам не перейдёт на «вы».`;
  let sess = null;
  const openSess = () => { if (sess) sess.close(); sess = canCliChat() ? cliChat(RULES(), deep ? 'default' : 'quick') : null; };
  onLeave(() => { if (sess) sess.close(); });
  const chat = () => $('#dChat');
  const setPhase = (p, txt) => { phase = p; const el = $('#dPhase'); if (!el) return; el.className = 'verdict ' + (p === 'listen' ? 'warn' : p === 'think' ? '' : 'good'); el.textContent = txt; const m = $('#dMain'); if (m) { m.innerHTML = p === 'listen' ? `${ico('stop')}Я закончил` : `${ico('mic')}Говорить`; m.disabled = p === 'think' || p === 'speak'; } const sk = $('#dSkipTts'); if (sk) sk.hidden = p !== 'speak'; };
  const bubble = (role, html) => { const b = h(`<div class="msg ${role === 'user' ? 'u' : 'a'}">${html}</div>`); chat().append(b); chat().scrollTop = 1e6; return b; };
  const markFill = (text) => { const f = findFillers(text); let i = 0; return text.split(/\s+/).filter(Boolean).map((tok) => { const n = normWords(tok).length; let hit = false; for (let k = 0; k < n; k++) if (f.marks.has(i + k)) hit = true; i += n; return hit ? `<span class="f">${esc(tok)}</span>` : esc(tok); }).join(' '); };

  const aiTurn = async () => {
    setPhase('think', 'думает…');
    const b = bubble('a', '<span class="ai-pulse">…</span>');
    const msgs = [{ role: 'user', content: RULES() + '\n\n' + (turns.length ? 'Разговор уже идёт.' : 'Начни разговор: коротко поздоровайся и задай первый вопрос.') }];
    turns.forEach((t, i) => { if (i === 0 && t.role === 'assistant') msgs.push(t); else if (t.role === 'user') msgs.push(t); else msgs.push(t); });
    // чередование ролей: объединяем подряд идущие реплики одного автора
    const fixed = []; for (const m of msgs) { const last = fixed[fixed.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else fixed.push({ ...m }); }
    if (fixed[fixed.length - 1].role !== 'user') fixed.push({ role: 'user', content: '(молчит — продолжи разговор новым вопросом)' });
    ctl = new AbortController();
    let spoken = 0, full = '';
    const flush = (final) => {
      const rest = full.slice(spoken);
      const m = final ? rest : (rest.match(/^[\s\S]*?[.!?…](?=\s|$)/) || [''])[0];
      if (m && m.trim()) { spoken += m.length; Voice.speak(m); if (phase !== 'speak') setPhase('speak', 'говорит'); }
      if (!final && m) flush(false);
    };
    const onText = ({ text }) => { full = text; b.textContent = text; chat().scrollTop = 1e6; flush(false); };
    const t0 = performance.now();
    try {
      let viaSess = false;
      if (sess) {
        const lastUser = [...turns].reverse().find((t) => t.role === 'user');
        const msg = !turns.length ? 'Начни разговор: коротко поздоровайся и задай первый вопрос.' : turns[turns.length - 1].role === 'user' ? lastUser.content : '(собеседник молчит — продолжи разговор новым вопросом)';
        try { full = await sess.say(msg, { onText, signal: ctl.signal }); viaSess = true; }
        catch (e) { if (e && e.code === 'cancelled') throw e; sess = null; full = ''; spoken = 0; }
      }
      if (!viaSess) await App.sample(fixed, { signal: ctl.signal, cache: false, modelTier: deep ? 'default' : 'quick', onText });
      flush(true);
      b.title = `ответ за ${fmt((performance.now() - t0) / 1000, 1)} с`;
      turns.push({ role: 'assistant', content: full.trim() });
      if (!Voice.available()) return afterSpeak();
      if (phase !== 'speak') setPhase('speak', 'говорит');
      Voice.whenIdle(afterSpeak);
    } catch (e) {
      if (e && e.code === 'cancelled') return;
      b.innerHTML = `<span class="bad">Собеседник не ответил: ${esc(aiReasonFrom(e))}.</span>`;
      if (['offline', 'not_granted', 'bridge'].includes(e && e.code)) setAi('error', aiReasonFrom(e));
      setPhase('idle', 'ошибка ИИ');
    }
  };
  const afterSpeak = () => { if (!running) return; if (handsFree) listen(); else setPhase('idle', 'ваша очередь'); };
  const listen = async () => {
    if (!running || take) return;
    if (!Voice.idle()) { Voice.whenIdle(listen); return; }
    const live = bubble('user', '<span class="muted">слушаю…</span>');
    let lastLoud = performance.now(), lastChange = performance.now(), heard = false, loudN = 0; const t0 = performance.now();
    take = await startTake({
      whisper: S.dlgWhisper !== false,
      onText: (full, interim) => { lastChange = performance.now(); heard = true; live.innerHTML = markFill(full) + (interim ? ` <span class="interim">${esc(interim)}</span>` : ''); chat().scrollTop = 1e6; },
      onFrame: (f) => { if (f.loud) { lastLoud = performance.now(); if (++loudN > 25) heard = true; } const l = $('#dLvl'); if (l) l.style.width = clamp((f.db - Mic.floor) / 40, 0, 1) * 100 + '%'; },
    });
    if (!take) { live.remove(); setPhase('idle', 'нет микрофона — пишите текстом'); return; }
    if (!take.asr && useWhisper()) live.innerHTML = '<span class="muted">слушаю… (текст появится после ответа — Whisper)</span>';
    else if (!take.asr) { live.innerHTML = '<span class="bad">Распознавание речи недоступно в этом браузере — отвечайте текстом.</span>'; take.abort(); take = null; setPhase('idle', 'текстом'); return; }
    setPhase('listen', 'слушает');
    clearInterval(poll);
    poll = setInterval(() => {
      const n = performance.now();
      if ((handsFree && heard && n - lastLoud > 1500 && n - lastChange > 900) || n - t0 > 120000) finishListen(live);
    }, 200);
  };
  /* ---- разбор каждой реплики в реальном времени (панель сбоку) ---- */
  let liveN = 0;
  const livePanel = () => {
    let el = $('#dLive');
    if (!el) { const how = document.querySelector('.how'); if (!how) return null; how.innerHTML = '<span class="eyebrow">Разбор по ходу</span><div class="small muted" id="dLiveHint">После каждой вашей реплики здесь появится разбор: что хорошо, что сжевали, паразиты, по теме ли ответ.</div><div id="dLive" class="stack" style="gap:10px"></div>'; el = $('#dLive'); }
    return el;
  };
  const analyzeTurn = (st, question, r) => {
    const el = livePanel(); if (!el) return;
    const hint = $('#dLiveHint'); if (hint) hint.remove();
    const n = ++liveN;
    // слова, в которых Whisper и браузер разошлись, — кандидаты на «сжёванные»
    let unclear = [];
    if (r && r.engine === 'whisper' && r.asrText) unclear = alignDetail(st.text, r.asrText).issues.filter((x) => x.word.length > 2).map((x) => x.word).slice(0, 6);
    const fl = Object.entries(st.by || {}).map(([k, c]) => k + (c > 1 ? ' ×' + c : ''));
    const card = h(`<div class="lcard"><div class="row" style="justify-content:space-between"><b>Реплика ${n}</b><span class="lscore muted small">анализ…</span></div>
      <div class="lchips"><span>${st.words} ${plural(st.words, 'слово', 'слова', 'слов')}</span>${isFinite(st.wpm) ? `<span class="${st.wpm > 170 ? 'warn' : st.wpm < 90 ? 'warn' : ''}">${fmt(st.wpm, 0)} сл/мин</span>` : ''}${st.fillers ? `<span class="bad">паразиты: ${esc(fl.join(', '))}</span>` : '<span class="good">без паразитов</span>'}${st.longPauses ? `<span class="warn">долгих пауз: ${st.longPauses}</span>` : ''}</div>
      ${unclear.length ? `<div class="lrow warn">Нечётко: ${unclear.map((w) => '«' + esc(w) + '»').join(', ')}</div>` : ''}
      <div class="lai small muted"><span class="ai-pulse">ИИ смотрит на смысл и подачу…</span></div></div>`);
    el.prepend(card);
    const ai = $('.lai', card), sc = $('.lscore', card);
    if (!App.sample) { ai.textContent = App.ai.reason ? 'ИИ недоступен: ' + App.ai.reason : ''; sc.textContent = ''; return; }
    App.sample.json(`Ты тренер по речи. Разбери ОДНУ реплику ученика в разговорной тренировке (сценарий «${scen.t}»${/\{topic\}/.test(scen.p) ? ', тема «' + topic + '»' : ''}).
Вопрос собеседника: «${(question || '').slice(0, 600)}»
Ответ ученика (точная расшифровка): «${st.text.slice(0, 1500)}»
${r && r.asrText && r.asrText !== st.text ? 'Вторая расшифровка (браузер): «' + r.asrText.slice(0, 1500) + '»' : ''}
${unclear.length ? 'Слова, где расшифровки разошлись (возможно, произнесены нечётко): ' + unclear.join(', ') : ''}
Метрики: ${st.words} слов, темп ${fmt(st.wpm, 0)} слов/мин, паразиты: ${fl.join(', ') || 'нет'}.
Оцени: ответил ли по существу вопроса или ушёл от смысла; ясность и структуру мысли; сжёванные/проглоченные слова (обрывки, бессмыслица в расшифровке); слова-паразиты; уверенность.
Ответь только JSON без пояснений: {"score": число 1-10, "good": ["до 2 коротких пунктов"], "fix": ["до 2 коротких конкретных пунктов"], "mumbled": ["слова, которые, похоже, сжёваны"], "on_topic": true/false, "topic_note": "если не по теме — чем именно ушёл, иначе пусто", "better": "одна фраза: как сказать этот ответ сильнее"}. Каждый пункт до 12 слов, только по-русски, без англицизмов.`, { modelTier: 'quick', cache: false })
      .then((j) => {
        if (!j || typeof j !== 'object') throw new Error('empty');
        const sco = +j.score;
        sc.textContent = isFinite(sco) ? sco + '/10' : ''; sc.className = 'lscore small ' + (sco >= 7 ? 'good' : sco >= 5 ? 'warn' : 'bad');
        const L = (a) => (Array.isArray(a) ? a : []).filter(Boolean).slice(0, 3);
        const mum = [...new Set([...unclear, ...L(j.mumbled).filter((w) => String(w).split(/\s+/).length <= 3)])].slice(0, 6);
        ai.className = 'lai';
        ai.innerHTML = `${j.on_topic === false ? `<div class="lrow bad">Ушёл от вопроса${j.topic_note ? ': ' + esc(j.topic_note) : ''}</div>` : '<div class="lrow good">По существу вопроса</div>'}
          ${L(j.good).map((x) => `<div class="lrow good">✓ ${esc(x)}</div>`).join('')}
          ${L(j.fix).map((x) => `<div class="lrow">✗ ${esc(x)}</div>`).join('')}
          ${mum.length && !unclear.length ? `<div class="lrow warn">Похоже, сжёвано: ${mum.map((w) => '«' + esc(w) + '»').join(', ')}</div>` : ''}
          ${j.better ? `<div class="lbetter">Сильнее: «${esc(String(j.better).replace(/^[«"']+|[»"']+$/g, ''))}»</div>` : ''}`;
        st.ai = j;
      })
      .catch((e) => { sc.textContent = ''; ai.textContent = 'ИИ-разбор не получился' + (e && e.code ? ': ' + aiReasonFrom(e) : ''); });
  };
  const finishListen = async (live) => {
    clearInterval(poll); if (!take) return;
    const tk = take; take = null; setPhase('think', useWhisper() && S.dlgWhisper !== false ? 'распознаёт…' : 'думает…'); const r = await tk.stop(); const l = $('#dLvl'); if (l) l.style.width = '0';
    const lastBot = [...turns].reverse().find((t) => t.role === 'assistant');
    const text = stripEcho((r.text || '').trim(), lastBot && lastBot.content);
    if (r.asrText && lastBot) r.asrText = stripEcho(r.asrText, lastBot.content);
    if (!text) { live.innerHTML = '<span class="muted">Не расслышал — повторите, пожалуйста.</span>'; if (running && handsFree) setTimeout(listen, 400); else setPhase('idle', 'ваша очередь'); return; }
    let f = findFillers(text); const words = f.words.length, dur = r.sum ? r.sum.dur : r.wall;
    if (r.asrText && r.asrText !== text) { const f2 = findFillers(r.asrText); if (f2.count > f.count) f = { ...f, count: f2.count, by: f2.by }; }
    const wpm = dur > 2 ? (words / dur) * 60 : NaN;
    const question = lastBot && lastBot.content;
    const stNow = { text, words, fillers: f.count, by: f.by, wpm, dur, mono: r.sum ? r.sum.mono : NaN, longPauses: r.sum ? r.sum.longPauses : 0 };
    stats.push(stNow);
    analyzeTurn(stNow, question, r);
    live.innerHTML = markFill(text) + `<div class="small" style="opacity:.75;margin-top:4px">${r.engine === 'whisper' ? 'Whisper · ' : r.whisperError ? `<span title="${esc(r.whisperError)}">браузер (Whisper: ошибка)</span> · ` : ''}${words} ${plural(words, 'слово', 'слова', 'слов')}${isFinite(wpm) ? ' · ' + fmt(wpm, 0) + ' сл/мин' : ''}${f.count ? ' · паразитов: ' + f.count : ''}</div>`;
    turns.push({ role: 'user', content: text });
    ctx.mark();
    aiTurn();
  };
  $('#dStart').onclick = async () => {
    if (!(await ensureAi())) { $('#dAiState').innerHTML = aiOffHTML(); return; }
    if (!sess) openSess();
    Snd.get(); if (TTS.ok) { try { speechSynthesis.cancel(); } catch (e) {} }
    running = true; $('#dSetup').hidden = true; $('#dTalk').hidden = false; $('#dRes').hidden = true;
    $('#dTitle').textContent = scen.t + (/\{topic\}/.test(scen.p) ? ' · ' + topic : '');
    aiTurn();
  };
  $('#dMain').onclick = () => { if (phase === 'listen') { const live = chat().lastElementChild; finishListen(live); } else if (phase === 'idle' || phase === 'speak') { Voice.cancel(); listen(); } };
  $('#dSkipTts').onclick = () => { Voice.cancel(); listen(); };
  $('#dForm').onsubmit = (e) => {
    e.preventDefault(); const t = $('#dText').value.trim(); if (!t || phase === 'think') return;
    Voice.cancel(); if (take) { clearInterval(poll); take.abort(); take = null; const last = chat().lastElementChild; if (last && /слушаю/.test(last.textContent)) last.remove(); }
    $('#dText').value = ''; bubble('user', markFill(t)); turns.push({ role: 'user', content: t }); const stT = { text: t, words: normWords(t).length, fillers: findFillers(t).count, by: findFillers(t).by, typed: true, wpm: NaN }; stats.push(stT); const lb = [...turns].reverse().find((x, i) => i > 0 && x.role === 'assistant'); analyzeTurn(stT, lb && lb.content, null); aiTurn();
  };
  $('#dText').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#dForm').requestSubmit(); } };
  $('#dEnd').onclick = () => {
    running = false; Voice.cancel(); clearInterval(poll); if (take) { take.abort(); take = null; } if (ctl) ctl.abort(); if (sess) { sess.close(); sess = null; }
    setPhase('idle', 'завершено');
    const spoken = stats.filter((x) => !x.typed), W_ = stats.reduce((a, x) => a + x.words, 0), F = stats.reduce((a, x) => a + x.fillers, 0);
    const T = spoken.reduce((a, x) => a + (x.dur || 0), 0), wpmAvg = T > 5 ? (spoken.reduce((a, x) => a + x.words, 0) / T) * 60 : NaN, perMin = T > 5 ? F / (T / 60) : NaN;
    const by = {}; stats.forEach((x) => Object.entries(x.by || {}).forEach(([k, n]) => (by[k] = (by[k] || 0) + n)));
    const avgLen = stats.length ? W_ / stats.length : 0;
    if (spoken.length && isFinite(perMin) && W_ > 20) Store.log('fillers', +perMin.toFixed(2));
    if (isFinite(wpmAvg)) Store.log('wpm', +wpmAvg.toFixed(0));
    Store.hist(`Разговор с ИИ (${scen.t}): ${stats.length} ${plural(stats.length, 'ответ', 'ответа', 'ответов')}, паразитов ${F}`);
    const res = $('#dRes'); res.hidden = false;
    res.innerHTML = `<span class="eyebrow">Итог разговора</span>
      <div class="result"><div><span class="k">Ваших ответов</span><span class="v">${stats.length}</span></div><div><span class="k">Средний ответ</span><span class="v">${fmt(avgLen, 0)}<small>слов</small></span><span class="n ${avgLen < 25 ? 'warn' : 'good'}">${avgLen < 25 ? 'коротко' : 'развёрнуто'}</span></div>
      <div><span class="k">Темп</span><span class="v">${fmt(wpmAvg, 0)}<small>сл/мин</small></span></div><div><span class="k">Паразиты</span><span class="v">${F}</span><span class="n muted">${isFinite(perMin) ? fmt(perMin, 1) + ' в минуту' : ''}</span></div></div>
      ${Object.keys(by).length ? `<div class="fill-list">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span>${esc(k)}<b>${n}</b></span>`).join('')}</div>` : ''}
      <div id="dAi"></div>
      <div class="row"><button class="btn primary" id="dAgain">${ico('play')}Новый разговор</button></div>`;
    $('#dAgain').onclick = () => go(App.route);
    if (stats.length) aiFeedback($('#dAi'), { title: 'Разбор разговора', prompt: `Упражнение: голосовой диалог с ИИ-собеседником, сценарий «${scen.t}»${/\{topic\}/.test(scen.p) ? ', тема «' + topic + '»' : ''}.
Статистика ученика: ${stats.length} ответов, в среднем ${fmt(avgLen, 0)} слов на ответ, темп ${fmt(wpmAvg, 0)} слов/мин, слов-паразитов ${F}${isFinite(perMin) ? ' (' + fmt(perMin, 1) + '/мин)' : ''}: ${Object.entries(by).map(([k, n]) => k + ' ×' + n).join(', ') || 'нет'}.
Оценки реплик по ходу: ${stats.map((x, i) => x.ai ? `#${i + 1}: ${x.ai.score}/10${x.ai.on_topic === false ? ' (не по теме)' : ''}` : '').filter(Boolean).join(', ') || 'нет'}.
Диалог (реплики ученика распознаны автоматически):
${turns.map((t) => (t.role === 'user' ? 'Ученик: ' : 'Собеседник: ') + t.content).join('\n').slice(0, 9000)}
Оцени, как ученик держит разговор: развёрнутость и структуру ответов, уверенность, конкретику и примеры, реакцию на неудобные вопросы, слова-паразиты. Приведи 1–2 цитаты его ответов и покажи, как сказать сильнее. До 200 слов.` });
  };
  onLeave(() => { running = false; Voice.cancel(); clearInterval(poll); if (take) take.abort(); if (ctl) ctl.abort(); });
};

/* ---- ИИ-коуч ---- */
W.coach = (root, ex) => {
  if (!App.sample) {
    root.innerHTML = `<div class="panel lift stack"><h2 class="h2">Подключите Claude</h2><p class="muted">Коуч, разборы речи и новые скороговорки работают через Claude: внутри приложения Claude — автоматически, в скачанной версии — через ваш Claude CLI.</p>${aiPanel()}</div>`;
    bindAiPanel();
    return;
  }
  const turns = [];
  const RULES = () => `Ты — ИИ-коуч по технике речи в тренажёре «Звукоряд»: дыхание, артикуляция, голос (резонанс, SOVT-упражнения), дикция, интонация, ораторская речь. Отвечай по-русски, коротко и практично, без markdown-заголовков и без лишних вступлений. Давай конкретные упражнения с дозировкой (сколько секунд/повторов). Если описываемые симптомы похожи на проблему со здоровьем (осиплость дольше 2 недель, боль при разговоре, потеря голоса), мягко посоветуй обратиться к фониатру или логопеду. Упражнения в тренажёре: ${EXERCISES.filter((e) => e.sec !== 'tools').map((e) => e.title).join(', ')} — ссылайся на них по названию. Данные пользователя из тренажёра: ${profileSummary()}`;
  root.innerHTML = `<div class="panel lift stack"><div class="chat" id="chat"><div class="msg a">Привет! Я вижу ваши замеры в тренажёре. Спросите о голосе и дикции — или выберите вопрос ниже.</div></div>
    <div class="chips" id="cq">${['Составь план на неделю под мои слабые места', 'Придумай 3 скороговорки на звук Р', 'Как говорить громче и не срывать голос?', 'Почему голос садится к вечеру?', 'Как перестать тараторить?', 'Упражнения против гнусавости'].map((q) => `<button class="chip">${q}</button>`).join('')}</div>
    <form class="composer" id="cform"><button class="btn" type="button" id="cmic" title="Сказать голосом">${ico('mic')}</button><textarea id="cin" rows="1" placeholder="Ваш вопрос… или нажмите микрофон" aria-label="Вопрос коучу"></textarea><button class="btn primary" id="csend" type="submit">Отправить</button></form>
    ${Voice.available() ? `<div class="row small" style="gap:10px"><label class="check"><input type="checkbox" id="cvoice" ${Store.d.settings.coachVoice ? 'checked' : ''}> Озвучивать ответы коуча</label><button class="btn ghost" data-go="settings" style="min-height:0;padding:2px 8px;color:var(--accent)">Выбрать голос</button></div>` : ''}</div>`;
  const chat = $('#chat'); let ctl = null, ctake = null;
  const cv = $('#cvoice'); if (cv) cv.onchange = () => { Store.d.settings.coachVoice = cv.checked; Store.save(); if (!cv.checked) Voice.cancel(); };
  $('#cmic').onclick = async () => {
    const b = $('#cmic');
    if (ctake) { const tk = ctake; ctake = null; b.innerHTML = '…'; const r = await tk.stop(); b.innerHTML = ico('mic'); b.classList.remove('rec'); if (r.text) { $('#cin').value = r.text; send(r.text); } else toast('Не расслышал — попробуйте ещё раз'); return; }
    Voice.cancel();
    ctake = await startTake({ onText: (full, interim) => { $('#cin').value = full + (interim ? ' ' + interim : ''); } });
    if (ctake) { b.innerHTML = ico('stop'); b.classList.add('rec'); }
  };
  const send = async (q) => {
    if (!q.trim() || ctl) return;
    chat.append(h(`<div class="msg u">${esc(q)}</div>`)); const bub = h('<div class="msg a">Думаю…</div>'); chat.append(bub); chat.scrollTop = 1e6;
    turns.push({ role: 'user', content: q }); $('#cin').value = '';
    ctl = new AbortController(); $('#csend').textContent = 'Стоп';
    try {
      const speak = Voice.available() && Store.d.settings.coachVoice; let spoken = 0;
      const flush = (all, final) => { if (!speak) return; const rest = all.slice(spoken).replace(/[*#`_]/g, ''); const m = final ? rest : (rest.match(/^[\s\S]*?[.!?…](?=\s|$)/) || [''])[0]; if (m && m.trim()) { spoken += m.length; Voice.speak(m); if (!final) flush(all, false); } };
      const { text } = await App.sample([{ role: 'user', content: RULES() }, { role: 'assistant', content: 'Понял. Готов помогать.' }, ...turns], { cache: false, signal: ctl.signal, onText: ({ text }) => { bub.innerHTML = mdLite(text); chat.scrollTop = 1e6; flush(text, false); } });
      flush(text, true);
      turns.push({ role: 'assistant', content: text });
    } catch (e) { bub.textContent = (e.text || '') + (e.text ? '\n\n' : '') + aiErr(e); turns.pop(); }
    ctl = null; $('#csend').textContent = 'Отправить';
  };
  $('#cform').onsubmit = (e) => { e.preventDefault(); if (ctl) { ctl.abort(); return; } send($('#cin').value); };
  $('#cin').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!ctl) send($('#cin').value); } };
  $('#cq').onclick = (e) => { const b = e.target.closest('.chip'); if (b) send(b.textContent); };
  onLeave(() => { ctl && ctl.abort(); ctake && ctake.abort(); Voice.cancel(); });
};

/* ---- анализ аудиофайла ---- */
W.upload = (root, ex) => {
  root.innerHTML = `<div class="panel lift stack"><label class="btn primary big" style="align-self:flex-start;position:relative">${ico('file')}Выбрать аудиофайл<input type="file" id="ufile" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm,.aac" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
    <span class="small muted" id="ust">Файл обрабатывается на вашем устройстве и никуда не отправляется.</span></div><div class="panel stack" id="ures" hidden></div>`;
  $('#ufile').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    $('#ust').textContent = 'Декодирую…'; $('#ures').hidden = true;
    try {
      const buf = await file.arrayBuffer(); const ac = Snd.get(); const audio = await ac.decodeAudioData(buf);
      let x = audio.getChannelData(0); let sr = audio.sampleRate;
      const f = Math.max(1, Math.round(sr / 22050)); x = decimate(x, f); sr = sr / f;
      const hop = Math.round(sr * 0.02), win = Math.round(sr * 0.046), frames = [];
      const maxDur = Math.min(x.length / sr, 300);
      // шумовой порог: 10-й перцентиль энергии
      const dbs = [];
      for (let i = 0; i + win < x.length && i / sr < maxDur; i += hop) { let s = 0; for (let k = 0; k < win; k++) s += x[i + k] * x[i + k]; dbs.push(10 * Math.log10(s / win + 1e-12)); }
      const floor = pct(dbs, 0.1), thr = Math.max(floor + 10, -60);
      let n = 0;
      for (let i = 0, j = 0; i + win < x.length && j < dbs.length; i += hop, j++) {
        const loud = dbs[j] > thr; let hz = 0;
        if (loud) { const p = detectPitch(x.subarray(i, i + win + Math.ceil(sr / 65)), sr); hz = p.hz; }
        frames.push({ t: i / sr, db: dbs[j], hz, loud });
        if (++n % 300 === 0) { $('#ust').textContent = `Анализирую… ${Math.round((i / sr / maxDur) * 100)}%`; await sleep(0); }
      }
      const tr = makeTrack(); frames.forEach((fr) => tr.push(fr)); const s = tr.summary();
      if (!s) { $('#ust').textContent = 'В записи не найден голос.'; return; }
      // самый длинный непрерывный звук
      let longest = 0, st0 = null, gap = 0;
      for (const fr of frames) { if (fr.loud) { if (st0 == null) st0 = fr.t; gap = 0; longest = Math.max(longest, fr.t - st0); } else if (st0 != null) { gap += 0.02; if (gap > 0.3) { st0 = null; gap = 0; } } }
      const voiced = frames.filter((fr) => fr.loud).length * 0.02;
      $('#ust').textContent = `${file.name} · ${fmt(audio.duration, 1)} с`;
      $('#ures').hidden = false;
      $('#ures').innerHTML = `<span class="eyebrow">Результат анализа</span>
        <div class="result"><div><span class="k">Длинный звук</span><span class="v">${fmt(longest)}<small>с</small></span><span class="n muted">кандидат во время фонации</span></div>
        <div><span class="k">Средняя высота</span><span class="v">${Math.round(s.medHz) || '—'}<small>Гц</small></span><span class="n muted">${noteName(s.medHz)}</span></div>
        <div><span class="k">Диапазон</span><span class="v">${fmt(s.range, 0)}<small>пт</small></span></div>
        <div><span class="k">Мелодика</span><span class="v">${fmt(s.mono)}<small>пт</small></span><span class="n ${s.mono < 2 ? 'bad' : 'good'}">${isFinite(s.mono) ? (s.mono < 2 ? 'монотонно' : 'живо') : ''}</span></div>
        <div><span class="k">Паузы</span><span class="v">${s.pauses.length}</span><span class="n muted">длинных: ${s.longPauses}</span></div>
        <div><span class="k">Звучание</span><span class="v">${Math.round((voiced / Math.max(0.1, audio.duration)) * 100)}<small>%</small></span><span class="n muted">времени записи</span></div></div>
        ${contourSVG(frames, s.t0, Math.min(s.t1, s.t0 + 60))}
        <div id="uAi"></div>
        <div class="row"><button class="btn" id="usmpt">Сохранить ${fmt(longest)} с как время фонации</button>${isFinite(s.mono) ? `<button class="btn" id="usmono">Сохранить мелодику</button>` : ''}</div>`;
      aiFeedback($('#uAi'), { tier: 'quick', title: 'Что говорят цифры', prompt: `Пользователь загрузил аудиозапись своего голоса (${fmt(audio.duration, 1)} с) для анализа. Замеры: самый длинный непрерывный звук ${fmt(longest)} с, средняя высота ${Math.round(s.medHz) || 'н/д'} Гц (${noteName(s.medHz)}), диапазон ${fmt(s.range, 0)} полутонов, разброс высоты ${fmt(s.mono)} пт (меньше 2 — монотонно), пауз ${s.pauses.length} (длинных ${s.longPauses}), звучание ${Math.round((voiced / Math.max(0.1, audio.duration)) * 100)}% времени. Пол для норм: ${Store.d.settings.sex === 'f' ? 'женский' : 'мужской'}.
Истолкуй эти цифры простым языком: что по ним видно о голосе, что в норме, что стоит тренировать. Не придумывай то, чего нельзя понять из цифр.` });
      $('#usmpt').onclick = (ev) => { Store.log('mpt', +longest.toFixed(1), `Время фонации (из записи): ${fmt(longest)} с`); Store.best('mpt', longest); ev.target.disabled = true; toast('Сохранено в прогресс'); };
      const um = $('#usmono'); if (um) um.onclick = (ev) => { Store.log('mono', +s.mono.toFixed(2), `Мелодика (из записи): ${fmt(s.mono)} пт`); ev.target.disabled = true; toast('Сохранено в прогресс'); };
    } catch (err) { console.error(err); $('#ust').textContent = 'Не удалось прочитать файл. Попробуйте формат .mp3, .m4a или .wav.'; }
  };
};

/* ========== ДИАГНОСТИКА ========== */
function viewDiag(v) {
  let i = 0; const res = {}, skipped = new Set();
  const draw = () => {
    App.leave.splice(0).forEach((f) => { try { f(); } catch (e) {} });
    const done = i >= DIAG_STEPS.length;
    v.innerHTML = `${micNotice()}<div class="sec-head"><span class="eyebrow">3–4 минуты</span><h1 class="h1">Диагностика голоса и речи</h1><p class="lead">Пять замеров, которые используют логопеды и тренеры речи. Повторяйте раз в 2–3 недели, чтобы видеть прогресс.</p></div>
      <div class="diag-steps">${DIAG_STEPS.map((s, k) => `<div class="${skipped.has(k) ? 'skip' : k < i ? 'done' : k === i ? 'cur' : ''}"><b>${s.title}</b>${skipped.has(k) ? 'пропущено' : s.sub}</div>`).join('')}</div>
      <div id="dstage"></div>`;
    if (done) return summary();
    const s = DIAG_STEPS[i];
    const exLike = { id: 'diag-' + s.id, title: s.title, cfg: s.cfg, type: s.type, how: [] };
    const st_ = $('#dstage');
    st_.innerHTML = `<div class="ex-layout"><div class="stage" id="dw"></div><aside class="how panel"><span class="eyebrow">Шаг ${i + 1} из ${DIAG_STEPS.length}</span><ol>${diagHow(s.id).map((x) => `<li>${x}</li>`).join('')}</ol><div class="row"><button class="btn primary" id="dnext">${i + 1 < DIAG_STEPS.length ? 'Дальше' : 'Итоги'}</button><button class="btn ghost" id="dskip">Пропустить</button></div></aside></div>`;
    const ctx = { mark() {}, onResult: (r) => Object.assign(res, r) };
    if (s.type === 'sustain') {
      $('#dw').innerHTML = '<div class="panel lift" id="dsus"></div><div class="panel" id="dsres" hidden></div>';
      makeSustain($('#dsus'), { sound: s.cfg.sound, onAttempt: (a, all) => { const b = Math.max(...all.map((x) => x.dur)); res.mpt = b; Store.log('mpt', a.dur); Store.best('mpt', b); const [cls, txt] = verdictMPT(b); $('#dsres').hidden = false; $('#dsres').innerHTML = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Лучшая попытка: ${fmt(b)} с</span><span class="verdict ${cls}">${txt}</span></div>${normScale('mpt', b)}`; } });
    } else W[s.type]($('#dw'), exLike, ctx);
    $('#dnext').onclick = () => { i++; draw(); window.scrollTo(0, 0); };
    $('#dskip').onclick = () => { skipped.add(i); i++; draw(); };
  };
  const summary = () => {
    const sex = Store.d.settings.sex, [mlo, mhi] = NORMS.mpt[sex];
    const cards = [], plus = [], minus = [], skipped = [];
    const add = (o) => { cards.push(o); (o.cls === 'good' ? plus : minus).push(o); };
    if (res.mpt) { const v = res.mpt, cls = v >= mlo ? 'good' : v >= 10 ? 'warn' : 'bad';
      add({ k: 'Время фонации', v: fmt(v), u: 'с', cls, verdict: cls === 'good' ? 'В норме' : cls === 'warn' ? 'Ниже нормы' : 'Мало', scale: normScale('mpt', v), short: cls === 'good' ? `Дыхания хватает надолго: ${fmt(v)} с на одном выдохе` : `Выдоха хватает на ${fmt(v)} с — фразы будут обрываться`,
        what: `Сколько секунд вы тянете гласный на одном выдохе. Показывает запас и экономность дыхания. Норма для ${sex === 'f' ? 'женщин' : 'мужчин'} — ${mlo}–${mhi} с.${v > mhi ? ' У вас выше нормы — отличный запас для длинных фраз.' : ''}`,
        todo: cls === 'good' ? 'Поддерживайте: долгий выдох на «С» 2–3 раза в неделю.' : 'Каждый день: диафрагмальное дыхание и долгий выдох на «С». Обычно +5 с за 2–3 недели.', link: 'ex-long-s', linkT: 'Долгий выдох' }); }
    else skipped.push('Время фонации');
    if (res.sz) { const v = res.sz, cls = v >= 0.75 && v <= 1.25 ? 'good' : v > 1.4 ? 'bad' : 'warn';
      add({ k: 'Индекс S/Z', v: fmt(v, 2), u: '', cls, verdict: cls === 'good' ? 'Норма' : 'Отклонение', short: cls === 'good' ? 'Связки смыкаются полноценно (S/Z ≈ 1)' : `S/Z = ${fmt(v, 2)}: «З» заметно короче «С»`,
        what: 'Отношение длительности «С» к «З». «С» — только дыхание, «З» — дыхание плюс работа связок. Около 1,0 — связки смыкаются полноценно.',
        todo: cls === 'good' ? '' : v > 1.4 ? 'Часть воздуха уходит через неплотно сомкнутые связки. Мычание и трели помогут; если есть осиплость дольше двух недель — покажитесь фониатру.' : 'Повторите замер на свежую голову: на результат влияет усталость.', link: 'ex-hum', linkT: 'Мычание' }); }
    else skipped.push('Индекс S/Z');
    if (res.range) { const v = res.range, cls = v >= 15 ? 'good' : 'warn';
      add({ k: 'Диапазон', v: fmt(v, 0), u: 'пт', cls, verdict: v >= 24 ? 'Широкий' : v >= 15 ? 'Норма' : 'Узкий', short: cls === 'good' ? `Диапазон ${fmt(v / 12, 1)} октавы — есть где развернуться интонации` : `Диапазон всего ${fmt(v, 0)} полутонов`,
        what: `Расстояние от самой низкой до самой высокой ноты. У нетренированного голоса обычно 18–24 полутона (1,5–2 октавы). У вас ${fmt(v / 12, 1)} октавы.`,
        todo: cls === 'good' ? 'Чтобы использовать диапазон в речи — упражнения на выразительность.' : 'Сирены через трубочку и губные трели по 3 минуты в день.', link: cls === 'good' ? 'ex-emotions' : 'ex-straw', linkT: cls === 'good' ? 'Восемь смыслов' : 'Сирена' }); }
    else skipped.push('Диапазон');
    if (res.wpm) { const v = res.wpm, cls = v > 170 || v < 95 ? 'warn' : 'good';
      add({ k: 'Темп чтения', v: fmt(v, 0), u: 'сл/мин', cls, verdict: v > 170 ? 'Быстро' : v < 95 ? 'Медленно' : 'Комфортно', short: v > 170 ? `Темп ${fmt(v, 0)} слов/мин — слушатель не успевает` : v < 95 ? `Темп ${fmt(v, 0)} слов/мин — медленно` : `Темп ${fmt(v, 0)} слов/мин — комфортно для слушателя`,
        what: `Комфортный для восприятия темп — 110–150 слов в минуту. ${res.pauses != null ? `Пауз в тексте: ${res.pauses}.` : ''}`,
        todo: v > 170 ? 'Партитура пауз: ставьте паузу на каждой точке и перед важным словом.' : v < 95 ? 'Читайте как рассказ другу, энергичнее, без пауз внутри фразы.' : '', link: 'ex-pauses', linkT: 'Партитура пауз' }); }
    else skipped.push('Чтение');
    if (res.acc != null) { const v = res.acc, cls = v >= 90 ? 'good' : v >= 75 ? 'warn' : 'bad', iss = (res.readIssues || []).slice(0, 5);
      add({ k: 'Разборчивость чтения', v: v, u: '%', cls, verdict: cls === 'good' ? 'Чётко' : cls === 'warn' ? 'Средне' : 'Нечётко', short: cls === 'good' ? `Речь разборчива: ${v}% слов распознано точно` : `${100 - v}% слов прозвучали нечётко`,
        what: 'Доля слов, которые система распознавания речи услышала точно. Если машина разобрала слово, человек разберёт тем более.' + (iss.length ? '<ul>' + iss.map((x) => `<li>${esc(issueText(x))}</li>`).join('') + '</ul>' : ''),
        todo: cls === 'good' ? '' : 'Скороговорки по этапам и метод пробки.', link: 'ex-cork', linkT: 'Метод пробки' }); }
    if (res.mono) { const v = res.mono, cls = v >= 2 ? 'good' : 'bad';
      add({ k: 'Мелодика', v: fmt(v), u: 'пт', cls, verdict: v >= 4 ? 'Очень живо' : v >= 2 ? 'Живо' : 'Монотонно', short: cls === 'good' ? 'Голос живо движется по высоте — чтение не звучит монотонно' : 'Голос почти не меняет высоту — звучит монотонно',
        what: 'Разброс высоты голоса при чтении (стандартное отклонение в полутонах). Меньше 2 — монотонно, 2–4 — живо, больше 4 — очень выразительно.',
        todo: cls === 'good' ? '' : 'Логическое ударение и «Одна фраза — восемь смыслов».', link: 'ex-stress', linkT: 'Логическое ударение' }); }
    if (isFinite(res.drop)) { const v = res.drop, cls = v <= 6 ? 'good' : 'warn';
      add({ k: 'Концы фраз', v: fmt(v, 0), u: 'дБ спад', cls, verdict: cls === 'good' ? 'Ровно' : 'Проседают', short: cls === 'good' ? 'Концы фраз звучат так же уверенно, как начало' : 'К концу фраз голос затихает — окончания теряются',
        what: 'Насколько падает громкость в последней четверти каждой фразы по сравнению с её началом. До 6 дБ — нормально.',
        todo: cls === 'good' ? '' : 'Договаривайте последний слог на опоре: упражнение «Окончания».', link: 'ex-endings', linkT: 'Окончания' }); }
    if (res.twAcc != null) { const v = res.twAcc, cls = v >= 90 ? 'good' : v >= 70 ? 'warn' : 'bad', iss = (res.twIssues || []).slice(0, 4);
      add({ k: 'Скороговорка', v: v, u: '%', cls, verdict: cls === 'good' ? 'Чисто' : cls === 'warn' ? 'Почти' : 'Есть потери', short: cls === 'good' ? `Скороговорка в темпе — чисто (${v}%)` : `В скороговорке ${100 - v}% потерь`,
        what: `Чёткость в темпе, где звуки начинают «наезжать» друг на друга.${isFinite(res.syl) ? ` Скорость ${fmt(res.syl)} слога/с (разговорная ≈ 4–5).` : ''}` + (iss.length ? '<ul>' + iss.map((x) => `<li>${esc(issueText(x))}</li>`).join('') + '</ul>' : ''),
        todo: cls === 'good' ? 'Берите скороговорки сложнее и этап «Быстро ×3».' : 'Начинайте с этапа «Медленно»: утрированно, каждый звук.', link: 'ex-twisters', linkT: 'Скороговорки' }); }
    else skipped.push('Скороговорка');
    const order = { bad: 0, warn: 1, good: 2 };
    minus.sort((a, b) => order[a.cls] - order[b.cls]);
    Store.hist(`Диагностика: ${cards.map((r) => r.k + ' ' + r.v + (r.u ? ' ' + r.u : '')).join(', ') || 'без замеров'}`);
    if (cards.length) { Store.complete('diag', 4); if (Store.d.program) Store.d.program.focusAt = 0; Store.save(); renderNav(); }
    const inSession = App.session && App.session.items[App.session.idx] === 'diag';
    const focus = minus.slice(0, 3);
    $('#dstage').innerHTML = `<section class="panel lift stack"><h2 class="h2">Итоги</h2>
      ${cards.length ? `<div class="split"><div class="plus"><h3>Сильные стороны</h3>${plus.length ? `<ul>${plus.map((c) => `<li>${esc(c.short)}</li>`).join('')}</ul>` : '<span class="small muted">Появятся по мере тренировок.</span>'}</div>
        <div class="minus"><h3>Зоны роста</h3>${minus.length ? `<ul>${minus.map((c) => `<li>${esc(c.short)}</li>`).join('')}</ul>` : '<span class="small muted">Всё в норме — держите форму.</span>'}</div></div>
        ${focus.length ? `<div class="notice info"><div style="flex:1"><b>Главные зоны роста:</b> ${focus.map((c) => `<button class="btn ghost" data-go="${c.link}" style="min-height:0;padding:0 4px;color:var(--accent)">${c.linkT}</button>`).join(' · ')}. План дня и прогноз уже пересчитаны под эти замеры.</div></div>` : ''}` : '<p class="muted">Замеров нет — все шаги пропущены.</p>'}
      ${skipped.length ? `<p class="small muted">Не измерено: ${skipped.join(', ')}. Можно пройти диагностику заново в любой момент.</p>` : ''}
      <div class="row">${inSession ? '<button class="btn primary" id="dcont">Дальше по плану</button>' : '<button class="btn primary" data-go="program">Моя программа и прогноз</button><button class="btn" data-go="home">К плану на сегодня</button>'}<button class="btn" data-go="diag">Пройти заново</button></div>
      <div id="daiOut"></div></section>
      ${cards.length ? `<section class="panel stack"><h2 class="h2">Подробно по каждому показателю</h2><div>${cards.map((c) => `<div class="mcard"><div class="stack" style="gap:6px"><span class="small muted">${c.k}</span><span class="val">${c.v}<small>${c.u}</small></span><span class="verdict ${c.cls}" style="align-self:flex-start">${c.verdict}</span></div>
        <div class="txt"><div>${c.what}</div>${c.scale || ''}${c.todo ? `<div><b>Что делать:</b> ${c.todo} <button class="btn ghost" data-go="${c.link}" style="min-height:0;padding:0 4px;font-size:13px;color:var(--accent)">${c.linkT} →</button></div>` : ''}</div></div>`).join('')}</div></section>` : ''}`;
    const dc = $('#dcont'); if (dc) dc.onclick = () => sessionNext();
    if (cards.length) aiFeedback($('#daiOut'), { title: 'Разбор диагностики', prompt: `Это не одна попытка, а итог диагностики. Результаты диагностики пользователя (${sex === 'f' ? 'женщина' : 'мужчина'}):
${cards.map((r) => `- ${r.k}: ${r.v} ${r.u} (${r.verdict})`).join('\n')}
${(res.readIssues || []).length ? 'Слова с потерями при чтении: ' + res.readIssues.slice(0, 8).map((x) => x.word + (x.heard ? '→' + x.heard : '')).join(', ') : ''}
${(res.twIssues || []).length ? 'Потери в скороговорке: ' + res.twIssues.slice(0, 6).map((x) => x.word + (x.heard ? '→' + x.heard : '')).join(', ') : ''}
Нормы: время фонации ${NORMS.mpt[sex].join('–')} с, S/Z ≈ 1,0, диапазон 18–24 полутона, темп 110–150 слов/мин, разборчивость 90%+, разброс высоты 2–4 полутона, спад громкости к концу фраз до 6 дБ.

Дай по-русски подробный, но компактный разбор без markdown-заголовков:
1) Общая картина в 2 предложениях.
2) Что уже хорошо и почему это важно.
3) Главные 2–3 проблемы: как они слышны со стороны и откуда берутся (по потерянным словам определи, какие звуки или позиции страдают).
4) План на 2 недели по 15 минут в день с упражнениями из списка: ${EXERCISES.filter((e) => e.sec !== 'tools').map((e) => e.title).join(', ')}. Для этого ответа можно до 250 слов.` });
  };
  draw();
}
function diagHow(id) {
  return {
    mpt: ['Встаньте или сядьте прямо, сделайте глубокий вдох животом.', 'Тяните «А» на удобной высоте и громкости так долго, как можете — ровно, без напряжения.', 'Сделайте 2–3 попытки, в зачёт идёт лучшая.'],
    sz: ['Тяните «С» так долго, как можете, затем «З» — тоже на одном выдохе.', 'По две попытки на каждый звук. Громкость — средняя.'],
    range: ['На звук «у» скользите от самой низкой удобной ноты до самой высокой и обратно.', 'Не форсируйте крайние ноты.'],
    read: ['Прочитайте текст вслух в своём обычном темпе, как рассказываете.', 'Тренажёр посчитает темп, разборчивость и мелодику.'],
    tw: ['Произнесите скороговорку в обычном темпе, один раз.', 'Распознавание проверит каждое слово.'],
  }[id] || [];
}

/* ========== ПРОГРЕСС ========== */
function viewProgress(v) {
  const s = Store.d.settings;
  const M = [
    ['mpt', 'Время фонации', 'с', 'max', NORMS.mpt[s.sex], 1, 'diag'],
    ['sLen', 'Выдох на «С»', 'с', 'max', [20, 35], 1, 'ex-long-s'],
    ['acc', 'Разборчивость', '%', 'avg', [90, 100], 0, 'ex-twisters'],
    ['wpm', 'Темп речи', 'сл/мин', 'avg', [110, 150], 0, 'ex-tempo'],
    ['mono', 'Мелодика', 'пт', 'avg', [2, 4], 1, 'ex-melody'],
    ['fillers', 'Слова-паразиты', 'в мин', 'min', [0, 1], 1, 'ex-impro'],
    ['range', 'Диапазон', 'пт', 'max', [18, 30], 0, 'ex-range'],
    ['sz', 'Индекс S/Z', '', 'avg', [0.8, 1.2], 2, 'diag'],
    ['count', 'Счёт на выдохе', '', 'max', [30, 45], 0, 'ex-count'],
  ];
  const withData = M.filter(([k]) => daily(k).length), empty = M.filter(([k]) => !daily(k).length);
  v.innerHTML = `<div class="sec-head"><span class="eyebrow">Все замеры по дням</span><h1 class="h1">Прогресс</h1><p class="lead">Зелёная полоса на графиках — ориентир нормы. Данные хранятся в этом браузере; перенести их в другую копию тренажёра можно в <button class="btn ghost" data-go="settings" style="min-height:0;padding:0 4px;color:var(--accent);font-size:inherit">Настройках</button>.</p></div>
    <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat"><span class="k">Серия</span><span class="v">${Store.streak()}<small>${plural(Store.streak(), 'день', 'дня', 'дней')}</small></span></div>
      <div class="stat"><span class="k">За 7 дней</span><span class="v">${Store.weekMinutes()}<small>мин</small></span></div>
      <div class="stat"><span class="k">Всего</span><span class="v">${Math.round(Object.values(Store.d.days).reduce((a, b) => a + b, 0))}<small>мин</small></span></div></div>
    <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="eyebrow">Активность</span><span class="small muted">12 недель</span></div>${heatmap()}</div>
    ${withData.length ? `<div class="grid2">${withData.map(([k, l, u, mode, band, dg]) => { const pts = daily(k, mode), last = pts[pts.length - 1].v, first = pts[0].v; return `<div class="panel chart-card"><div class="top"><span class="h3">${l}</span><span class="cur num">${fmt(last, dg)} <span class="small muted">${u}</span></span></div>${pts.length > 1 ? `<span class="small muted">с первого замера: ${last - first >= 0 ? '+' : ''}${fmt(last - first, dg)} ${u}</span>` : '<span class="small muted">первый замер — линия появится со второго дня</span>'}${lineChart(pts, { band, digits: dg })}</div>`; }).join('')}</div>` : ''}
    ${empty.length ? `<div class="panel stack"><span class="eyebrow">Ещё нет замеров</span><div class="chips">${empty.map(([k, l, , , , , r]) => `<button class="chip" data-go="${r}">${l} →</button>`).join('')}</div><p class="small muted">Графики появятся после первых попыток. Быстрее всего получить основные замеры — пройти диагностику.</p></div>` : ''}
    <section class="panel stack"><h2 class="h2">История</h2>${Store.d.history.length ? `<table class="hist"><tbody>${Store.d.history.slice(0, 30).map((x) => { const d = new Date(x.t); return `<tr><td>${d.getDate()}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}</td><td style="font-family:var(--f-body);text-align:left;font-size:13.5px">${esc(x.text)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">Пока пусто</div>'}</section>`;
}

/* ========== НАСТРОЙКИ ========== */
/* подсказка «скачать вручную» — когда мост не смог скачать сам (блокировки, прокси) */
function manualHelpHTML(job, filter) {
  if (!job || job.stage !== 'error') return '';
  return `<div class="notice bad" style="flex-direction:column;align-items:stretch;gap:8px"><div><b>Не получилось скачать.</b> ${esc(job.error || '')}</div>
    <div class="small" data-manual="${filter}">Загружаю список файлов…</div>
    <div class="row"><button class="btn primary" data-import>Найти скачанные файлы</button><span class="small muted" data-import-st></span></div></div>`;
}
async function bindManualHelp(root, after) {
  const box = root && root.querySelector('[data-manual]'); const cfg = bridgeCfg();
  if (box && cfg) {
    try {
      const list = await (await fetch(bridgeBase(cfg) + '/api/manual', { headers: { 'x-zv-token': cfg.token || '' } })).json();
      const re = box.dataset.manual === 'whisper' ? /whisper/i : /piper|голос/i;
      const items = list.filter((x) => re.test(x.what));
      box.innerHTML = items.length ? `Скачайте браузером (можно с включённым VPN) — файлы сохранятся в «Загрузки»:<ul style="margin:6px 0 0;padding-left:18px">${items.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.what)}</a> <span class="muted">${esc(x.name)}</span></li>`).join('')}</ul>` : 'Все файлы на месте.';
    } catch (e) { box.textContent = 'Мост не ответил.'; }
  }
  const b = root && root.querySelector('[data-import]');
  if (b) b.onclick = async () => {
    const st = root.querySelector('[data-import-st]'); b.disabled = true; st.textContent = 'Ищу в «Загрузках» и на рабочем столе…';
    try {
      const j = await (await fetch(bridgeBase(cfg) + '/api/import', { method: 'POST', headers: { 'x-zv-token': cfg.token || '' } })).json();
      App.whisper = j.whisper; App.tts = j.tts;
      st.textContent = j.found.length ? 'Установлено: ' + j.found.join(', ') : 'Не нашёл подходящих файлов — проверьте, что скачивание завершилось.';
      if (j.found.length) setTimeout(after || (() => go(App.route)), 800);
    } catch (e) { st.textContent = 'Мост не ответил.'; }
    b.disabled = false;
  };
}
/* озвучка: общий блок для Настроек и Собеседника */
function sysVoiceOpts() { const S = Store.d.settings, vs = Voice.ruVoices(); return vs.length ? vs.map((v) => `<option value="${esc(v.name)}" ${v.name === S.voiceName ? 'selected' : ''}>${esc(v.name.replace(/Microsoft |Google | - Russian.*| \(Russia\)/g, ''))}</option>`).join('') : '<option value="">голос по умолчанию</option>'; }
function voiceSettingsHTML() {
  const S = Store.d.settings;
  const bridge = !App.framed && !!bridgeCfg() && App.bridgeInfo && App.bridgeInfo.bridgeVersion >= 5;
  const t = App.tts || {}, eng = S.ttsEngine === 'browser' || !bridge ? 'browser' : 'piper', c = Voice.cfg();
  const job = t.job, busy = job && !['done', 'error'].includes(job.stage), pctv = job && job.total ? Math.round((job.got / job.total) * 100) : 0;
  return `<div class="stack" style="gap:10px">
    ${bridge ? `<div class="field"><span class="flabel">Движок</span><div class="chips" data-veng><button class="chip" data-e="piper" aria-pressed="${eng === 'piper'}">Живой (нейросеть Piper)</button><button class="chip" data-e="browser" aria-pressed="${eng === 'browser'}">Системный</button></div></div>`
      : !App.framed && bridgeCfg() ? '<p class="small muted">Живые голоса появятся, когда мост обновится (он перезапускается сам).</p>' : ''}
    ${eng === 'piper' ? `<div class="field"><span class="flabel">Голос</span><div class="chips" data-vpiper>${PIPER_LIST.map((v) => { const pr = t.voices && t.voices[v.id] && t.voices[v.id].present; return `<button class="chip" data-v="${v.id}" aria-pressed="${pr && v.id === c.piper}">${v.t}${pr ? '' : ' · скачать 63 МБ'}</button>`; }).join('')}</div></div>
      ${busy ? `<div class="stack" style="gap:4px"><span class="small">Скачиваю голос… ${pctv ? pctv + '%' : ''}</span><div class="meter"><i style="width:${pctv}%"></i></div></div>` : ''}
      ${manualHelpHTML(job, 'piper')}
      ${t.lastError && (!job || job.stage !== 'error') ? `<p class="small bad">Ошибка голоса: ${esc(t.lastError)} — пока звучит системный голос.</p>` : ''}
      ${!Voice.usePiper() && !busy && !(job && job.stage === 'error') ? '<p class="small muted">Выберите голос — он скачается один раз и дальше работает без интернета.</p>' : ''}`
    : TTS.ok ? `<div class="field"><span class="flabel">Голос</span><select data-vsys aria-label="Системный голос">${sysVoiceOpts()}</select></div><p class="small muted">Системные голоса звучат роботизированно. В Microsoft Edge здесь появятся естественные «Svetlana / Dmitry Online (Natural)».</p>` : '<p class="small warn">Браузер не умеет озвучивать текст.</p>'}
    <div class="field"><span class="flabel">Характер</span><div class="chips" data-vpreset>${VOICE_PRESETS.map((p) => `<button class="chip" data-p="${p.id}" aria-pressed="${p.id === c.preset.id}">${p.t}</button>`).join('')}</div></div>
    <div><button class="btn" data-vhear>${ico('speak')}Послушать</button></div></div>`;
}
let voicePollT = 0;
function mountVoiceSettings(el) {
  if (!el) return;
  const S = Store.d.settings;
  const paint = () => {
    el.innerHTML = voiceSettingsHTML();
    const q = (x) => el.querySelector(x);
    const E = q('[data-veng]'); if (E) E.onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; S.ttsEngine = b.dataset.e; Store.save(); paint(); };
    const P = q('[data-vpiper]'); if (P) P.onclick = async (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return; S.piperVoice = b.dataset.v; Store.save();
      const t = App.tts || {};
      if (!(t.voices && t.voices[b.dataset.v] && t.voices[b.dataset.v].present)) { const cfg = bridgeCfg(); await fetch(bridgeBase(cfg) + '/api/tts/install', { method: 'POST', headers: { 'content-type': 'application/json', 'x-zv-token': cfg.token || '' }, body: JSON.stringify({ voice: b.dataset.v }) }).catch(() => {}); poll(); }
      else { paint(); Voice.cancel(); Voice.speak('Привет! Вот так я звучу.'); }
    };
    const V = q('[data-vsys]'); if (V) V.onchange = (e) => { S.voiceName = e.target.value; Store.save(); };
    q('[data-vpreset]').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; S.voicePreset = b.dataset.p; Store.save(); paint(); Voice.cancel(); Voice.speak('Привет! Вот так я буду звучать.'); };
    q('[data-vhear]').onclick = () => { Voice.cancel(); Voice.speak('Привет! Давай поговорим. Расскажи, чем ты сегодня занимался?'); };
    bindManualHelp(el, () => { refreshTts().then(paint); });
  };
  const poll = async () => { await refreshTts(); if (!el.isConnected) return; paint(); const j = App.tts && App.tts.job; clearTimeout(voicePollT); if (j && !['done', 'error'].includes(j.stage)) voicePollT = setTimeout(poll, 1000); };
  paint(); refreshTts().then(() => el.isConnected && paint());
  try { speechSynthesis.onvoiceschanged = () => { const s2 = el.querySelector('[data-vsys]'); if (s2) s2.innerHTML = sysVoiceOpts(); }; } catch (e) {}
  onLeave(() => clearTimeout(voicePollT));
}
function viewSettings(v) {
  const s = Store.d.settings;
  v.innerHTML = `<div class="sec-head"><span class="eyebrow">Звукоряд</span><h1 class="h1">Настройки</h1></div>
    <div class="grid2" style="align-items:start">
      <div class="stack" style="gap:16px">
        <section class="panel stack"><h2 class="h2">Голос и нормы</h2>
          <div class="field"><span class="flabel">Нормы для голоса</span><div class="chips" id="psex"><button class="chip" data-s="m" aria-pressed="${s.sex === 'm'}">Мужской</button><button class="chip" data-s="f" aria-pressed="${s.sex === 'f'}">Женский</button></div></div>
          <div class="field"><span class="flabel">Удобная высота голоса</span><div class="row"><span class="num">${s.basePitch ? s.basePitch + ' Гц · ' + noteName(s.basePitch) : 'не определена (по умолчанию ' + Store.basePitch() + ' Гц)'}</span><button class="btn" data-go="ex-optimal">Определить</button></div></div></section>
        <section class="panel stack"><h2 class="h2">Озвучка</h2><p class="small muted">Этим голосом говорят собеседник, ИИ-коуч, образцы скороговорок и шаги гимнастики.</p>
          <div id="setVoice"></div>
          <label class="check"><input type="checkbox" id="ptts" ${s.tts ? 'checked' : ''}> Озвучивать шаги гимнастики</label>
          <label class="check"><input type="checkbox" id="pcoach" ${s.coachVoice ? 'checked' : ''}> Озвучивать ответы ИИ-коуча</label></section>
        <section class="panel stack"><h2 class="h2">Данные</h2><p class="small muted">Прогресс хранится в браузере отдельно для каждого адреса (файл, localhost, страница в Claude). Чтобы перенести его, скопируйте данные здесь и вставьте в другой копии тренажёра.</p>
          <div class="row"><button class="btn" id="dExp">Скопировать данные</button><button class="btn" id="dImpShow">Вставить данные</button></div>
          <div id="dImpBox" hidden class="stack"><textarea class="plain" id="dImpText" placeholder="Вставьте сюда скопированные данные"></textarea><div class="row"><button class="btn primary" id="dImpGo">Загрузить</button><span class="small muted" id="dImpSt"></span></div></div>
          <div class="row" id="preset"><button class="btn ghost" id="presetBtn" style="color:var(--bad)">Сбросить все данные</button></div></section>
      </div>
      <div class="stack" style="gap:16px">
        <section class="panel stack"><h2 class="h2">ИИ: Claude</h2>${aiPanel()}</section>
        <section class="panel stack"><h2 class="h2">Распознавание речи</h2><div id="sttBox">${sttPanel()}</div></section>
      </div></div>`;
  mountVoiceSettings($('#setVoice'));
  bindAiPanel(); bindSttPanel(); onLeave(() => clearTimeout(sttPoll));
  $('#psex').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; s.sex = b.dataset.s; Store.save(); go(App.route); };
  $('#ptts').onchange = (e) => { s.tts = e.target.checked; Store.save(); };
  $('#pcoach').onchange = (e) => { s.coachVoice = e.target.checked; Store.save(); };
  $('#dExp').onclick = async () => {
    const t = JSON.stringify({ app: 'zvukoryad', v: 1, exported: new Date().toISOString(), data: Store.d });
    try { await navigator.clipboard.writeText(t); toast('Данные скопированы — вставьте их в другой копии тренажёра'); }
    catch (e) { $('#dImpBox').hidden = false; $('#dImpText').value = t; $('#dImpText').select(); toast('Скопируйте выделенный текст вручную (Ctrl+C)'); }
  };
  $('#dImpShow').onclick = () => { $('#dImpBox').hidden = false; $('#dImpText').value = ''; $('#dImpText').focus(); };
  $('#dImpGo').onclick = () => {
    try { const j = JSON.parse($('#dImpText').value); if (j.app !== 'zvukoryad' || !j.data || !j.data.metrics) throw new Error('bad'); Store.replace(j.data); toast('Данные загружены'); go(App.route); }
    catch (e) { $('#dImpSt').textContent = 'Это не похоже на данные Звукоряда.'; }
  };
  $('#presetBtn').onclick = () => {
    $('#preset').innerHTML = '<span class="small">Удалить все замеры и историю?</span><button class="btn" id="pyes" style="color:var(--bad)">Да, удалить</button><button class="btn ghost" id="pno">Отмена</button>';
    $('#pyes').onclick = () => { Store.reset(); toast('Данные сброшены'); go(App.route); };
    $('#pno').onclick = () => go(App.route);
  };
}

/* ========== МЕТОДИКА ========== */
function viewMethod(v) {
  const methods = [
    ['Диафрагмальное дыхание', 'Основа постановки голоса во всех школах сценической речи. Нижнереберно-диафрагмальный тип дыхания даёт долгий управляемый выдох.', 'sec-breath'],
    ['Время фонации и индекс S/Z', 'Клинические показатели из фониатрии: сколько секунд человек тянет гласный на одном выдохе и соотношение «С» к «З». Используются как объективный замер прогресса.', 'diag'],
    ['Гимнастика Стрельниковой', 'Парадоксальная дыхательная гимнастика — короткий активный вдох носом. Популярна у певцов и актёров для тренировки дыхательной мускулатуры.', 'ex-strelnikova'],
    ['Артикуляционная гимнастика', 'Логопедический комплекс для губ, языка и челюсти: «Часики», «Качели», «Грибок», «Чашечка», «Маляр» и др. Делается перед зеркалом под метроном.', 'sec-artic'],
    ['SOVT: трели, трубочка, мычание', 'Упражнения с полузакрытым речевым трактом — одна из наиболее изученных техник вокальной терапии. Снижают нагрузку на связки, выравнивают звук, разогревают голос.', 'sec-voice'],
    ['Жевательный метод Фрешельса', 'Приём фонопедии: жевание со звуком снимает зажим гортани и возвращает естественную, свободную подачу.', 'ex-chew'],
    ['Слоговые таблицы Станиславского', 'Согласный в сочетании со всеми гласными, обратные слоги, пары звонкий–глухой и стечения согласных. Классика театральной педагогики.', 'ex-syllables'],
    ['Скороговорки по этапам', 'Медленно и утрированно → шёпотом → в темпе → быстро три раза. Проверка распознаванием речи показывает, какое слово «съедается».', 'ex-twisters'],
    ['Метод пробки', 'Чтение с зажатой в зубах пробкой заставляет мышцы работать с усилием; после — речь заметно чище. Тренажёр сравнивает разборчивость до и после.', 'ex-cork'],
    ['Логическое ударение и подтекст', 'Упражнения актёрского мастерства: одна фраза с разными смыслами, перенос акцента, партитура пауз.', 'sec-expr'],
    ['Импровизация с разбором', 'Формат приложений Orai, Yoodli, Speeko: говоришь — получаешь темп, слова-паразиты, паузы, мелодику и разбор ИИ.', 'sec-speech'],
  ];
  const analogs = [
    ['Orai', 'Запись речи и метрики: паразиты, темп, энергия, ясность. → Здесь: разбор импровизации, темп и паразиты.'],
    ['Yoodli', 'ИИ-разбор выступлений, ролевые сценарии. → Здесь: разбор речи и ИИ-коуч с учётом ваших замеров.'],
    ['Speeko', 'Структурированная программа уроков, темп и тон, рекомендации по слабым местам. → Здесь: «Моя программа» — фокус на слабых навыках, цели недели и прогноз.'],
    ['Vocal Image', 'Голосовые упражнения и оценка голоса. → Здесь: график высоты, диапазон, трели, сирены.'],
    ['ELSA / BoldVoice', 'Проверка произношения по звукам. → Здесь: проверка скороговорок распознаванием с подсветкой слов.'],
    ['Articulated', 'Короткие ежедневные дриллы и серии. → Здесь: серия дней, тепловая карта, «Минута без паразитов».'],
  ];
  v.innerHTML = `<div class="sec-head"><span class="eyebrow">На чём построен тренажёр</span><h1 class="h1">Методика</h1><p class="lead">Ежедневное занятие собирается по вашим замерам: разминка → два самых слабых навыка (тренировка и замер) → поддержка остальных → живая речь. 15–20 минут в день дают заметный результат за 3–4 недели, срок до хорошего уровня — в «Моей программе».</p></div>
    <section class="panel"><dl style="margin:0">${methods.map(([t, d, r]) => `<div class="method"><dt>${t}</dt><dd>${d} <button class="btn ghost" data-go="${r}" style="min-height:0;padding:0 4px;font-size:13px;color:var(--accent)">Открыть →</button></dd></div>`).join('')}</dl></section>
    <section class="stack"><h2 class="h2">Что взято у аналогов</h2><div class="analog">${analogs.map(([n, d]) => `<div><b>${n}</b>${d}</div>`).join('')}</div></section>
    <section class="panel stack"><h2 class="h2">Ориентиры</h2>
      <table class="hist"><tbody>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Время фонации</td><td>муж. 20–30 с · жен. 15–25 с · меньше 10 с — мало</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Индекс S/Z</td><td>≈ 1,0 · выше 1,4 — повод проверить связки</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Темп речи</td><td>110–150 слов/мин</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Мелодика</td><td>разброс высоты 2–4 полутона</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Слова-паразиты</td><td>меньше 1 в минуту</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Диапазон</td><td>18–24 полутона у нетренированного голоса</td></tr>
      </tbody></table>
      <p class="small muted">Это ориентиры для самостоятельных тренировок, не медицинская диагностика. Замеры через встроенный микрофон зависят от устройства — сравнивайте себя с собой на одном и том же устройстве.</p></section>
    <section class="panel stack"><h2 class="h2">Технологии</h2>
      <table class="hist"><tbody>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Анализ голоса</td><td style="text-align:left">высота тона, громкость, паузы, слоги — считаются прямо в браузере</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Распознавание речи</td><td style="text-align:left">браузер (живой текст) + Whisper large-v3-turbo локально через мост (точная расшифровка)</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Разборы и собеседник</td><td style="text-align:left">Claude — в приложении Claude или через ваш Claude CLI</td></tr>
        <tr><td style="font-family:var(--f-body);color:var(--ink)">Голос собеседника</td><td style="text-align:left">Piper (нейросетевые русские голоса, локально) или системный синтезатор</td></tr>
      </tbody></table>
      <p class="small muted">Записи голоса не отправляются в интернет: анализ, Whisper и Piper работают на вашем компьютере. В Claude уходит только текст расшифровки и цифры.</p></section>
    <section class="panel stack"><h2 class="h2">Гигиена голоса</h2>
      <ul class="small" style="margin:0;padding-left:18px;color:var(--ink-2);display:flex;flex-direction:column;gap:6px">
        <li>Разминайтесь перед долгим разговором или выступлением: 3 минуты трелей и мычания.</li>
        <li>Пейте воду в течение дня; сухой воздух и кофе сушат связки.</li>
        <li>Не шепчите долго и не кричите «горлом» — громкость берётся дыханием.</li>
        <li>Если осиплость держится дольше двух недель, больно говорить или голос пропадает — обратитесь к фониатру или ЛОРу.</li></ul></section>
    <section class="panel stack"><h2 class="h2">Источники</h2><ul class="small" style="margin:0;padding-left:18px;color:var(--ink-2);display:flex;flex-direction:column;gap:4px">
      <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8031921/" target="_blank" rel="noopener">Vocalization with semi-occluded airways is favorable for optimizing sound production (PMC)</a></li>
      <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11635114/" target="_blank" rel="noopener">Lip Trill Effects on Vocal Function (PMC)</a></li>
      <li><a href="https://pubmed.ncbi.nlm.nih.gov/24560003/" target="_blank" rel="noopener">Electroglottographic study of seven semi-occluded exercises (PubMed)</a></li>
      <li><a href="https://partacademy.ru/razvitie-diktcii-y-vzroslyh" target="_blank" rel="noopener">Развитие дикции у взрослых: система Станиславского</a></li>
      <li><a href="https://mel.fm/ucheba/fakultativ/8245716-10-uprazhneny-kotoryye-sdelayutrech-boleye-chetkoy-i-uverennoy" target="_blank" rel="noopener">Мел: упражнения для артикуляции, речи и дыхания</a></li>
      <li><a href="https://articulated.app/blog/best-speech-coaching-apps-2026" target="_blank" rel="noopener">Обзор приложений-тренеров речи 2026</a></li></ul></section>`;
}

/* ========== СТАРТ ========== */
function boot() {
  initMicChip(); renderAiChip();
  const hash = (location.hash || '').slice(1);
  App.route = hash && (NAV.some((n) => n.r === hash) || (hash.startsWith('ex-') && exById(hash.slice(3))) || hash.startsWith('sec-')) ? hash : 'home';
  render();
  const t0 = Date.now();
  const light = () => { if (Date.now() - t0 < 15000 && !App.busy) go(App.route); };
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('sample').then((s) => { if (s) { App.sample = s; App.aiSource = 'claude'; setAi('ok'); light(); } else setAi('none', 'Claude в этом окне недоступен'); }).catch(() => setAi('none', 'Claude в этом окне недоступен'));
    window.claude.use('downloads').then((d) => { if (d) { App.downloads = d; light(); } }).catch(() => {});
  }
  const cfg = bridgeCfg();
  if (cfg && !App.framed) connectBridge(cfg).then(light).catch(() => { setAi('error', App.bridgeInfo && !App.bridgeInfo.cli ? 'мост запущен, но не нашёл Claude CLI' : 'мост к Claude CLI не запущен'); if (App.bridgeInfo) light(); });
  else if (!window.claude) setAi('none', 'не подключён Claude CLI — запустите мост из архива');
  $('#aichip').onclick = () => go('settings');
  window.addEventListener('hashchange', () => { const hsh = (location.hash || '').slice(1); if (hsh && hsh !== App.route && (NAV.some((n) => n.r === hsh) || (hsh.startsWith('ex-') && exById(hsh.slice(3))) || hsh.startsWith('sec-'))) go(hsh); });
}
boot();
