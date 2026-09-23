#!/usr/bin/env node
/*
 * Звукоряд · мост к Claude CLI
 * Локальный сервер: раздаёт тренажёр по адресу http://localhost:8787 (там работает микрофон)
 * и передаёт запросы ИИ в ваш Claude CLI (`claude -p`), используя вашу подписку/вход.
 * Никаких зависимостей: нужен только Node.js 18+ и установленный Claude Code CLI.
 *
 *   node zvukoryad-bridge.mjs [--port 8787] [--claude <путь к claude>] [--model sonnet]
 *                             [--quick-model haiku] [--no-open] [--new-token]
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);

const PORT = +opt('port', process.env.ZV_PORT || 8787);
const HOST = opt('host', '127.0.0.1');
const MODEL = opt('model', process.env.ZV_MODEL || '');
const QUICK_MODEL = opt('quick-model', process.env.ZV_QUICK_MODEL || 'haiku');
const WIN = process.platform === 'win32';
const WORKDIR = path.join(os.tmpdir(), 'zvukoryad-bridge');
fs.mkdirSync(WORKDIR, { recursive: true });

/* ---------- ключ доступа (сохраняется между запусками) ---------- */
const CONF_DIR = path.join(os.homedir(), '.zvukoryad');
const TOKEN_FILE = path.join(CONF_DIR, 'bridge-token');
let TOKEN = '';
try { if (!flag('new-token')) TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch {}
if (!/^[a-z0-9]{16,}$/i.test(TOKEN)) {
  TOKEN = randomBytes(12).toString('hex');
  try { fs.mkdirSync(CONF_DIR, { recursive: true }); fs.writeFileSync(TOKEN_FILE, TOKEN, { mode: 0o600 }); } catch {}
}

/* ---------- запуск claude ---------- */
const qWin = (a) => '"' + String(a).replace(/"/g, '""') + '"';
/* без «размышлений» модель отвечает в 3–5 раз быстрее — для живого диалога это главное */
const NO_THINK = { ...process.env, MAX_THINKING_TOKENS: process.env.ZV_THINKING ? (process.env.MAX_THINKING_TOKENS || '') : '0' };
function spawnClaude(bin, args, env) {
  const e = env || NO_THINK;
  if (WIN) return spawn([qWin(bin), ...args.map(qWin)].join(' '), { shell: true, cwd: WORKDIR, windowsHide: true, env: e });
  return spawn(bin, args, { cwd: WORKDIR, env: e });
}
function exec(bin, args, input, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let out = '', err = '', child;
    try { child = spawnClaude(bin, args); } catch (e) { return resolve({ code: -1, out, err: String(e) }); }
    const t = setTimeout(() => { try { child.kill(); } catch {} }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
    child.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }); });
    if (input != null) child.stdin.end(input); else child.stdin.end();
  });
}
/* Claude Code из расширения редактора (VS Code, Cursor, Windsurf…): resources/native-binary/claude(.exe) */
function extensionBinaries() {
  const home = os.homedir(), out = [];
  const ver = (n) => (n.match(/(\d+)\.(\d+)\.(\d+)/) || [0, 0, 0, 0]).slice(1).map(Number);
  const cmp = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
  for (const dir of ['.vscode', '.vscode-insiders', '.cursor', '.windsurf', '.vscode-oss', '.trae', '.kiro']) {
    const ext = path.join(home, dir, 'extensions');
    let names = []; try { names = fs.readdirSync(ext); } catch { continue; }
    for (const n of names.filter((x) => /^anthropic\.claude-code-/i.test(x)).sort(cmp)) {
      const nb = path.join(ext, n, 'resources', 'native-binary');
      try { for (const f of fs.readdirSync(nb)) if (/^claude(\.exe)?$/i.test(f)) out.push(path.join(nb, f)); } catch {}
    }
  }
  return out;
}
const CONF_FILE = path.join(CONF_DIR, 'bridge-config.json');
const readConf = () => { try { return JSON.parse(fs.readFileSync(CONF_FILE, 'utf8')); } catch { return {}; } };
const writeConf = (c) => { try { fs.mkdirSync(CONF_DIR, { recursive: true }); fs.writeFileSync(CONF_FILE, JSON.stringify(c, null, 2)); } catch {} };
let TRIED = [];
async function tryBin(c) {
  const r = await exec(c, ['--version'], null, 30000);
  const ok = r.code === 0 && /\d+\.\d+/.test(r.out);
  TRIED.push({ bin: c, ok, info: ok ? '' : (r.err || r.out || 'код ' + r.code).trim().split('\n')[0].slice(0, 160) });
  return ok ? { bin: c, version: r.out.trim().split('\n')[0] } : null;
}
async function resolveClaude(extra) {
  const home = os.homedir(), la = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), ad = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const fixed = WIN
    ? [path.join(home, '.local', 'bin', 'claude.exe'), path.join(ad, 'npm', 'claude.cmd'), path.join(home, '.claude', 'local', 'claude.cmd'), path.join(home, '.claude', 'local', 'claude.exe'), path.join(la, 'Programs', 'claude', 'claude.exe'), path.join(home, 'scoop', 'shims', 'claude.exe')]
    : [path.join(home, '.local', 'bin', 'claude'), path.join(home, '.claude', 'local', 'claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude', path.join(home, '.npm-global', 'bin', 'claude'), path.join(home, '.bun', 'bin', 'claude')];
  const cands = [extra, opt('claude', ''), process.env.CLAUDE_BIN, readConf().claude, 'claude', ...fixed.filter(exists), ...extensionBinaries()].filter(Boolean);
  TRIED = [];
  for (const c of [...new Set(cands)]) {
    const r = await tryBin(c);
    if (r) { if (c !== 'claude') writeConf({ ...readConf(), claude: c }); return r; }
  }
  return null;
}

const FULL_ARGS = (model) => ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--tools', '', '--no-session-persistence', '--strict-mcp-config', ...(model ? ['--model', model] : [])];
const MIN_ARGS = (model) => ['-p', '--output-format', 'stream-json', '--verbose', ...(model ? ['--model', model] : [])];

let CLAUDE = null;
let active = 0;
const MAX_ACTIVE = 2;

/* ---------- постоянные сессии Claude (stream-json): без холодного старта на каждый ответ ---------- */
const SYS_DEFAULT = 'Ты — ИИ-помощник тренажёра техники речи «Звукоряд». Точно следуй инструкциям в сообщении пользователя. Отвечай по-русски.';
let sessSeq = 0;
class Session {
  constructor(model, system, think) {
    this.id = 's' + (++sessSeq) + randomBytes(4).toString('hex');
    this.model = model; this.used = Date.now(); this.dead = false; this.turn = null; this.buf = ''; this.err = '';
    const sf = path.join(WORKDIR, `sys-${this.id}.txt`);
    fs.writeFileSync(sf, system || SYS_DEFAULT, 'utf8'); this.sf = sf;
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt-file', sf, ...(model ? ['--model', model] : [])];
    this.child = spawnClaude(CLAUDE.bin, args, think ? process.env : NO_THINK);
    this.child.stdout.on('data', (d) => this.onData(d));
    this.child.stderr.on('data', (d) => { this.err += d; if (this.err.length > 4000) this.err = this.err.slice(-4000); });
    this.child.on('error', (e) => { this.err += String(e); });
    this.child.on('close', () => { this.dead = true; try { fs.unlinkSync(sf); } catch {} if (this.turn) { const t = this.turn; this.turn = null; t.reject(new Error((this.err || 'Claude CLI завершился').trim().split('\n').slice(-2).join(' ').slice(0, 400))); } });
  }
  onData(d) {
    this.buf += d; let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
      if (!line || !this.turn) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      const t = this.turn;
      if (m.type === 'stream_event' && m.event?.type === 'content_block_delta' && m.event.delta?.type === 'text_delta') { t.got = true; t.text += m.event.delta.text; t.onDelta(m.event.delta.text); }
      else if (m.type === 'assistant' && !t.got && Array.isArray(m.message?.content)) { const x = m.message.content.filter((c) => c.type === 'text').map((c) => c.text).join(''); if (x) { t.text += x; t.onDelta(x); } }
      else if (m.type === 'result') { this.turn = null; if (m.is_error) t.reject(new Error(typeof m.result === 'string' && m.result ? m.result : 'Claude CLI вернул ошибку')); else t.resolve(t.text || (typeof m.result === 'string' ? m.result : '')); }
    }
  }
  say(text, onDelta) {
    if (this.dead) return Promise.reject(new Error('сессия закрыта'));
    if (this.turn) return Promise.reject(new Error('busy'));
    this.used = Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (this.turn) { this.turn = null; reject(new Error('Claude не ответил за 3 минуты')); this.close(); } }, 180000);
      this.turn = { text: '', got: false, onDelta, resolve: (v) => { clearTimeout(timer); this.used = Date.now(); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } };
      try { this.child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n'); } catch (e) { this.turn = null; clearTimeout(timer); reject(e); }
    });
  }
  interrupt() { if (this.turn) { const t = this.turn; this.turn = null; t.reject(new Error('cancelled')); } this.close(); }
  close() { if (this.dead) return; this.dead = true; try { this.child.stdin.end(); } catch {} setTimeout(() => { try { this.child.kill(); } catch {} }, 3000); }
}
const CHATS = new Map();
/* «тёплые» процессы для разовых запросов: запускаются заранее, пока вы говорите */
const WARM = {};
function takeWarm(model) {
  let s = WARM[model || '-'];
  if (!s || s.dead || s.turn) s = new Session(model);
  WARM[model || '-'] = null;
  setTimeout(() => { if (CLAUDE && !WARM[model || '-']) WARM[model || '-'] = new Session(model); }, 500);
  return s;
}
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of CHATS) if (s.dead || now - s.used > 15 * 60000) { s.close(); CHATS.delete(id); }
  for (const k of Object.keys(WARM)) { const s = WARM[k]; if (s && now - s.used > 10 * 60000) { s.close(); WARM[k] = null; } }
}, 60000);
let SESSIONS_OK = true; // если CLI не поддерживает stream-json — откатываемся на разовые запуски

/* один запрос к claude: отдаём дельты текста строками NDJSON */
function ask(prompt, model, send, onChild) {
  const attempt = (args) => new Promise((resolve) => {
    const child = spawnClaude(CLAUDE.bin, args); onChild(child);
    let buf = '', err = '', emitted = false, gotDelta = false, finalText = '', isError = false;
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, 240000);
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.type === 'stream_event' && m.event?.type === 'content_block_delta' && m.event.delta?.type === 'text_delta') {
          gotDelta = true; emitted = true; send({ t: 'delta', text: m.event.delta.text });
        } else if (m.type === 'assistant' && !gotDelta && Array.isArray(m.message?.content)) {
          const txt = m.message.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
          if (txt) { emitted = true; send({ t: 'delta', text: txt }); }
        } else if (m.type === 'result') {
          finalText = typeof m.result === 'string' ? m.result : ''; isError = !!m.is_error;
        }
      }
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { err += String(e); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, err, emitted, finalText, isError }); });
    child.stdin.end(prompt);
  });
  return (async () => {
    let r = await attempt(FULL_ARGS(model));
    if (!r.emitted && r.code !== 0 && /unknown option|error: option|unexpected argument|too many arguments/i.test(r.err)) r = await attempt(MIN_ARGS(model));
    if (!r.emitted && r.code !== 0 && model) r = await attempt(FULL_ARGS(''));
    if (r.isError) return send({ t: 'error', message: r.finalText || 'Claude CLI вернул ошибку' });
    if (!r.emitted && r.code !== 0) return send({ t: 'error', message: (r.err || 'Claude CLI завершился с ошибкой').trim().slice(0, 600) });
    send({ t: 'done', text: r.finalText });
  })();
}

/* ---------- Whisper (whisper.cpp) — точное распознавание русской речи, локально ---------- */
const WH_DIR = path.join(CONF_DIR, 'whisper');
const WH_VER = 'v1.9.2';
const WH_MODELS = {
  turbo: { file: 'ggml-large-v3-turbo-q5_0.bin', mb: 574, title: 'Точная (large-v3-turbo)' },
  small: { file: 'ggml-small-q5_1.bin', mb: 190, title: 'Быстрая (small)' },
};
const WH = { job: null };
function findFile(dir, re, depth = 4) {
  let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const d of list) if (d.isFile() && re.test(d.name)) return path.join(dir, d.name);
  if (depth > 0) for (const d of list) if (d.isDirectory()) { const f = findFile(path.join(dir, d.name), re, depth - 1); if (f) return f; }
  return null;
}
function whisperBin() {
  if (process.env.ZV_WHISPER_BIN) return process.env.ZV_WHISPER_BIN;
  return findFile(path.join(WH_DIR, 'bin'), /^whisper-cli(\.exe)?$/i) || findFile(path.join(WH_DIR, 'bin'), /^main(\.exe)?$/i) || WH.pathBin || null;
}
function whisperModel() {
  const pref = readConf().whisperModel;
  const order = pref ? [pref, ...Object.keys(WH_MODELS).filter((k) => k !== pref)] : Object.keys(WH_MODELS);
  for (const k of order) { const f = path.join(WH_DIR, 'models', WH_MODELS[k].file); try { if (fs.statSync(f).size > 1e6) return { key: k, file: f }; } catch {} }
  return null;
}
function whisperStatus() {
  const bin = whisperBin(), model = whisperModel();
  return { ready: !!(bin && model), bin: bin ? path.basename(bin) : null, model: model ? model.key : null,
    models: Object.fromEntries(Object.entries(WH_MODELS).map(([k, m]) => [k, { title: m.title, mb: m.mb, present: fs.existsSync(path.join(WH_DIR, 'models', m.file)) }])),
    canInstallBin: WIN || process.platform === 'linux', job: WH.job, lastError: WS.lastError, loaded: !!(WS.proc && WS.ready) };
}
/* системный прокси Windows (VPN-клиенты вроде Clash/v2rayN ставят его в настройках IE) — Node сам его не видит */
async function winProxy() {
  const r = await exec('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'], null, 8000);
  if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(r.out)) return null;
  const m = r.out.match(/ProxyServer\s+REG_SZ\s+(\S+)/i); if (!m) return null;
  let v = m[1];
  if (v.includes('=')) { const mm = v.match(/https=([^;]+)/i) || v.match(/http=([^;]+)/i) || v.match(/socks=([^;]+)/i); v = mm ? (/socks=/i.test(mm[0]) ? 'socks5h://' : '') + mm[1] : v.split(';')[0].split('=').pop(); }
  return /^\w+:\/\//.test(v) ? v : 'http://' + v;
}
async function downloadExternal(u, tmp, onProgress, expected) {
  const iv = setInterval(() => { try { onProgress(fs.statSync(tmp).size, expected || 0); } catch {} }, 700);
  try {
    let r;
    if (WIN) {
      const px = await winProxy();
      const args = ['-sS', '-L', '--fail', '--retry', '2', '--ssl-no-revoke', '-o', tmp, u];
      if (px) args.unshift('--proxy', px);
      r = await exec('curl.exe', args, null, 3600000);
      if (r.code !== 0) r = await exec('powershell', ['-NoProfile', '-Command', `$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '${u}' -OutFile '${tmp}'`], null, 3600000);
    } else r = await exec('curl', ['-sS', '-L', '--fail', '--retry', '2', '-o', tmp, u], null, 3600000);
    if (r.code !== 0) throw new Error((r.err || 'код ' + r.code).trim().split('\n').slice(-1)[0].slice(0, 200));
    if (!fs.existsSync(tmp) || fs.statSync(tmp).size < 100) throw new Error('пустой файл');
  } finally { clearInterval(iv); }
}
async function download(urls, dest, onProgress, expected) {
  let lastErr;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  for (const u of urls) {
    try {
      const res = await fetch(u, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      const total = +res.headers.get('content-length') || expected || 0;
      const out = fs.createWriteStream(tmp);
      let got = 0;
      for await (const chunk of res.body) {
        got += chunk.length; onProgress(got, total);
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      }
      await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
      fs.renameSync(tmp, dest);
      return;
    } catch (e) { lastErr = e; }
  }
  // запасной путь: curl / PowerShell через системный прокси (VPN)
  log('Прямое соединение не удалось — пробую через системный прокси…');
  for (const u of urls) {
    try { await downloadExternal(u, tmp, onProgress, expected); fs.renameSync(tmp, dest); return; }
    catch (e) { lastErr = e; }
  }
  try { fs.unlinkSync(tmp); } catch {}
  throw lastErr || new Error('download failed');
}
/* ручная установка: пользователь скачал файлы браузером — ищем их в «Загрузках», на рабочем столе и рядом с мостом */
function manualList() {
  const out = [];
  if (!whisperBin() && (WIN || process.platform === 'linux')) out.push({ what: 'whisper.cpp', name: WIN ? 'whisper-bin-x64.zip' : 'whisper-bin-ubuntu-x64.tar.gz', url: `https://github.com/ggml-org/whisper.cpp/releases/download/${WH_VER}/${WIN ? 'whisper-bin-x64.zip' : 'whisper-bin-ubuntu-x64.tar.gz'}` });
  for (const [k, m] of Object.entries(WH_MODELS)) if (!fs.existsSync(path.join(WH_DIR, 'models', m.file))) out.push({ what: 'Whisper: ' + m.title, name: m.file, url: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${m.file}?download=true` });
  if (!piperBin()) { const a = WIN ? 'piper_windows_amd64.zip' : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'piper_macos_aarch64.tar.gz' : 'piper_macos_x64.tar.gz') : 'piper_linux_x86_64.tar.gz'; out.push({ what: 'Piper (программа)', name: a, url: `https://github.com/rhasspy/piper/releases/download/${PIPER_REL}/${a}` }); }
  for (const [v, info] of Object.entries(PIPER_VOICES)) {
    const f = voiceFile(v), base = `https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/${v}/medium/ru_RU-${v}-medium.onnx`;
    if (!fs.existsSync(f)) out.push({ what: 'Голос ' + info.title, name: path.basename(f), url: base + '?download=true' });
    if (!fs.existsSync(f + '.json')) out.push({ what: 'Голос ' + info.title + ' (настройки)', name: path.basename(f) + '.json', url: base + '.json?download=true' });
  }
  return out;
}
async function importDownloads() {
  const home = os.homedir(), dirs = [path.join(home, 'Downloads'), path.join(home, 'Загрузки'), path.join(home, 'Desktop'), HERE];
  const found = [];
  const look = (re) => { for (const d of dirs) { let l = []; try { l = fs.readdirSync(d); } catch { continue; } const n = l.find((x) => re.test(x)); if (n) return path.join(d, n); } return null; };
  const unpack = async (arc, dir) => { fs.mkdirSync(dir, { recursive: true }); let r = await exec('tar', ['-xf', arc, '-C', dir], null, 180000); if (r.code !== 0 && WIN) r = await exec('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${arc}' -DestinationPath '${dir}'`], null, 180000); return r.code === 0; };
  if (!whisperBin()) { const a = look(/^whisper-bin-(x64|ubuntu-x64)[^/]*\.(zip|tar\.gz)$/i); if (a && await unpack(a, path.join(WH_DIR, 'bin')) && whisperBin()) found.push('whisper.cpp'); }
  for (const m of Object.values(WH_MODELS)) { const dest = path.join(WH_DIR, 'models', m.file); if (fs.existsSync(dest)) continue; const stem = m.file.slice(0, -4).replace(/[.]/g, '\\.'); const f = look(new RegExp('^' + stem + '( \\(\\d+\\))?\\.bin$', 'i')); if (f && fs.statSync(f).size > 1e6) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(f, dest); found.push(m.title); } }
  if (!piperBin()) { const a = look(/^piper_(windows_amd64|linux_x86_64|macos_\w+)[^/]*\.(zip|tar\.gz)$/i); if (a && await unpack(a, path.join(TTS_DIR, 'bin')) && piperBin()) { if (!WIN) try { fs.chmodSync(piperBin(), 0o755); } catch {} found.push('Piper'); } }
  for (const [v, info] of Object.entries(PIPER_VOICES)) {
    const f = voiceFile(v); fs.mkdirSync(path.dirname(f), { recursive: true });
    const o = !fs.existsSync(f) && look(new RegExp(`^ru_RU-${v}-medium( \\(\\d+\\))?\\.onnx$`, 'i'));
    const j = !fs.existsSync(f + '.json') && look(new RegExp(`^ru_RU-${v}-medium(\\.onnx)?( \\(\\d+\\))?\\.json$`, 'i'));
    if (o) { fs.copyFileSync(o, f); found.push('голос ' + info.title); }
    if (j) fs.copyFileSync(j, f + '.json');
  }
  if (found.length) { if (whisperModel() && whisperBin()) startWhisperServer(); log('Импортировано из загрузок: ' + found.join(', ')); }
  return found;
}
async function installWhisper(modelKey) {
  const m = WH_MODELS[modelKey] || WH_MODELS.turbo;
  WH.job = { stage: 'start', got: 0, total: 0, error: null };
  try {
    if (!whisperBin()) {
      if (!(WIN || process.platform === 'linux')) throw new Error('На macOS установите whisper-cpp: brew install whisper-cpp');
      const asset = WIN ? 'whisper-bin-x64.zip' : 'whisper-bin-ubuntu-x64.tar.gz';
      const arc = path.join(WH_DIR, asset);
      WH.job.stage = 'bin';
      await download([`https://github.com/ggml-org/whisper.cpp/releases/download/${WH_VER}/${asset}`], arc, (g, t) => { WH.job.got = g; WH.job.total = t; });
      const binDir = path.join(WH_DIR, 'bin'); fs.mkdirSync(binDir, { recursive: true });
      WH.job.stage = 'unpack';
      let r = await exec('tar', ['-xf', arc, '-C', binDir], null, 120000);
      if (r.code !== 0 && WIN) r = await exec('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${arc}' -DestinationPath '${binDir}'`], null, 180000);
      if (!whisperBin()) throw new Error('Не удалось распаковать whisper.cpp: ' + (r.err || '').slice(0, 200));
      try { fs.unlinkSync(arc); } catch {}
      if (!WIN) try { fs.chmodSync(whisperBin(), 0o755); } catch {}
    }
    const dest = path.join(WH_DIR, 'models', m.file);
    if (!fs.existsSync(dest)) {
      WH.job.stage = 'model'; WH.job.got = 0; WH.job.total = m.mb * 1048576;
      await download([`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${m.file}`, `https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/${m.file}`], dest, (g, t) => { WH.job.got = g; WH.job.total = t || WH.job.total; }, m.mb * 1048576);
    }
    writeConf({ ...readConf(), whisperModel: modelKey });
    WH.job = { stage: 'done', got: 0, total: 0, error: null };
    log(`Whisper готов: ${m.title}`); startWhisperServer();
  } catch (e) {
    const msg = String(e.message || e);
    WH.job = { stage: 'error', got: 0, total: 0, error: /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|403|451/i.test(msg) ? 'не удалось скачать ни напрямую, ни через системный прокси. Скачайте файлы вручную по ссылкам ниже (браузером, можно с VPN) и нажмите «Найти скачанные файлы». (' + msg.slice(0, 100) + ')' : msg };
    log('Whisper: ошибка установки — ' + WH.job.error);
  }
}
/* типичные «галлюцинации» Whisper на тишине в русском */
const HALLU = /(субтитр\S*|продолжение следует|dimatorzok|редактор субтитров|корректор\S*|спасибо за просмотр\S*|подписывайтесь на канал|ставьте лайк\S*)[^.!?]*[.!?]?/gi;
let whBusy = 0;
/* whisper-server держит модель в памяти — расшифровка без загрузки 500 МБ на каждый запрос */
const WS = { proc: null, port: 0, ready: null, model: null, lastError: '' };
function serverBin() { const b = whisperBin(); if (!b) return null; const d = path.dirname(b); return findFile(d, /^whisper-server(\.exe)?$/i, 0); }
function startWhisperServer() {
  const model = whisperModel(), sb = serverBin();
  if (!model || !sb) return null;
  if (WS.proc && WS.model === model.file && !WS.proc.killed && WS.proc.exitCode == null) return WS.ready;
  stopWhisperServer();
  WS.port = 8791 + Math.floor(Math.random() * 200); WS.model = model.file;
  const threads = String(Math.max(2, Math.min(8, (os.cpus()?.length || 4) - 1)));
  const p = spawn(sb, ['-m', model.file, '--host', '127.0.0.1', '--port', String(WS.port), '-l', 'ru', '-t', threads, '-bs', '1', '-bo', '1'], { cwd: path.dirname(sb), windowsHide: true });
  WS.proc = p; let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 6000) err = err.slice(-6000); });
  p.stdout.on('data', () => {});
  p.on('close', (code) => { if (WS.proc === p) { WS.proc = null; WS.ready = null; WS.lastError = 'whisper-server остановился (код ' + code + '): ' + err.trim().split('\n').slice(-2).join(' ').slice(0, 300); log(WS.lastError); } });
  WS.ready = (async () => {
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (WS.proc !== p) return false;
      try { const r = await fetch(`http://127.0.0.1:${WS.port}/`); if (r.status < 500) { log(`Whisper загружен в память (${path.basename(model.file)})`); return true; } } catch {}
    }
    return false;
  })();
  return WS.ready;
}
function stopWhisperServer() { if (WS.proc) { try { WS.proc.kill(); } catch {} } WS.proc = null; WS.ready = null; }
process.on('exit', stopWhisperServer);
async function transcribeServer(wav) {
  const ready = startWhisperServer(); if (!ready || !(await ready)) throw new Error('whisper-server не запустился');
  const fd = new FormData();
  fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'rec.wav');
  fd.append('response_format', 'json'); fd.append('language', 'ru'); fd.append('temperature', '0.0');
  const r = await fetch(`http://127.0.0.1:${WS.port}/inference`, { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'whisper-server HTTP ' + r.status);
  return String(j.text || '');
}
const cleanWhisper = (t) => String(t).split(/\r?\n/).map((l) => l.replace(/^\s*\[[^\]]*\]\s*/, '').trim()).filter(Boolean).join(' ').replace(HALLU, '').replace(/\s+/g, ' ').trim();
async function transcribeBest(wav) {
  if (serverBin() && !process.env.ZV_WHISPER_BIN) {
    try { const text = cleanWhisper(await transcribeServer(wav)); WS.lastError = ''; return { text, model: whisperModel().key, via: 'server' }; }
    catch (e) { WS.lastError = String(e.message || e); log('Whisper-server: ' + WS.lastError + ' — пробую whisper-cli'); }
  }
  const r = await transcribe(wav); return { ...r, via: 'cli' };
}
function transcribe(wav) {
  return new Promise((resolve, reject) => {
    const bin = whisperBin(), model = whisperModel();
    if (!bin || !model) return reject(new Error('Whisper не установлен'));
    const f = path.join(WORKDIR, `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.wav`);
    fs.writeFileSync(f, wav);
    const threads = String(Math.max(2, Math.min(8, (os.cpus()?.length || 4) - 1)));
    const child = spawn(bin, ['-m', model.file, '-f', f, '-l', 'ru', '-nt', '-np', '-t', threads, '-bs', '1', '-bo', '1'], { cwd: path.dirname(bin), windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, 180000);
    child.stdout.on('data', (d) => (out += d)); child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); try { fs.unlinkSync(f); } catch {} reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer); try { fs.unlinkSync(f); } catch {}
      if (code !== 0) return reject(new Error((err || 'whisper завершился с кодом ' + code).trim().split('\n').slice(-2).join(' ').slice(0, 300)));
      resolve({ text: cleanWhisper(out), model: model.key });
    });
  });
}

/* ---------- Piper — живые нейросетевые голоса, локально ---------- */
const TTS_DIR = path.join(CONF_DIR, 'piper');
const PIPER_REL = '2023.11.14-2';
const PIPER_VOICES = {
  irina: { title: 'Ирина', sex: 'ж', mb: 63 },
  denis: { title: 'Денис', sex: 'м', mb: 63 },
  dmitri: { title: 'Дмитрий', sex: 'м', mb: 63 },
  ruslan: { title: 'Руслан', sex: 'м', mb: 63 },
};
const voiceFile = (v) => path.join(TTS_DIR, 'voices', `ru_RU-${v}-medium.onnx`);
const TT = { job: null, procs: new Map(), lastError: '' };
function piperBin() { return process.env.ZV_PIPER_BIN || findFile(path.join(TTS_DIR, 'bin'), /^piper(\.exe)?$/i); }
function ttsStatus() {
  const bin = piperBin();
  return { ready: !!bin && Object.keys(PIPER_VOICES).some((v) => fs.existsSync(voiceFile(v))), bin: !!bin,
    voices: Object.fromEntries(Object.entries(PIPER_VOICES).map(([k, v]) => [k, { ...v, present: fs.existsSync(voiceFile(k)) && fs.existsSync(voiceFile(k) + '.json') }])),
    job: TT.job, lastError: TT.lastError };
}
async function installPiper(voice) {
  const v = PIPER_VOICES[voice] ? voice : 'irina';
  TT.job = { stage: 'start', got: 0, total: 0, error: null };
  try {
    if (!piperBin()) {
      const asset = WIN ? 'piper_windows_amd64.zip' : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'piper_macos_aarch64.tar.gz' : 'piper_macos_x64.tar.gz') : 'piper_linux_x86_64.tar.gz';
      const arc = path.join(TTS_DIR, asset); TT.job.stage = 'bin';
      await download([`https://github.com/rhasspy/piper/releases/download/${PIPER_REL}/${asset}`], arc, (g, t) => { TT.job.got = g; TT.job.total = t; });
      const binDir = path.join(TTS_DIR, 'bin'); fs.mkdirSync(binDir, { recursive: true }); TT.job.stage = 'unpack';
      let r = await exec('tar', ['-xf', arc, '-C', binDir], null, 120000);
      if (r.code !== 0 && WIN) r = await exec('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${arc}' -DestinationPath '${binDir}'`], null, 180000);
      if (!piperBin()) throw new Error('Не удалось распаковать Piper: ' + (r.err || '').slice(0, 200));
      try { fs.unlinkSync(arc); } catch {}
      if (!WIN) try { fs.chmodSync(piperBin(), 0o755); } catch {}
    }
    const f = voiceFile(v);
    const base = (h) => `https://${h}/rhasspy/piper-voices/resolve/main/ru/ru_RU/${v}/medium/ru_RU-${v}-medium.onnx`;
    if (!fs.existsSync(f + '.json')) { TT.job.stage = 'voice'; await download([base('huggingface.co') + '.json', base('hf-mirror.com') + '.json'], f + '.json', () => {}); }
    if (!fs.existsSync(f)) { TT.job.stage = 'voice'; TT.job.total = PIPER_VOICES[v].mb * 1048576; await download([base('huggingface.co'), base('hf-mirror.com')], f, (g, t) => { TT.job.got = g; TT.job.total = t || TT.job.total; }, PIPER_VOICES[v].mb * 1048576); }
    TT.job = { stage: 'done', got: 0, total: 0, error: null };
    log(`Голос готов: ${PIPER_VOICES[v].title}`);
  } catch (e) {
    const msg = String(e.message || e);
    TT.job = { stage: 'error', got: 0, total: 0, error: /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|403|451/i.test(msg) ? 'не удалось скачать ни напрямую, ни через системный прокси. Скачайте файлы вручную по ссылкам ниже (браузером, можно с VPN) и нажмите «Найти скачанные файлы». (' + msg.slice(0, 100) + ')' : msg };
    log('Piper: ошибка установки — ' + TT.job.error);
  }
}
/* процесс Piper на голос: модель загружена один раз, фразы идут построчно (JSON), в ответ — путь к wav */
function piperProc(voice) {
  let p = TT.procs.get(voice);
  if (p && !p.dead) return p;
  const bin = piperBin(), f = voiceFile(voice);
  if (!bin || !fs.existsSync(f)) throw new Error('голос не установлен');
  const outDir = path.join(WORKDIR, 'tts'); fs.mkdirSync(outDir, { recursive: true });
  const child = spawn(bin, ['--model', f, '--output_dir', outDir, '--json-input', '--sentence_silence', '0.15'], { cwd: path.dirname(bin), windowsHide: true });
  p = { child, dead: false, queue: [], buf: '', err: '' };
  child.stdout.on('data', (d) => {
    p.buf += d; let i;
    while ((i = p.buf.indexOf('\n')) >= 0) {
      const line = p.buf.slice(0, i).trim(); p.buf = p.buf.slice(i + 1);
      if (!line || !/\.wav$/i.test(line)) continue;
      const job = p.queue.shift(); if (job) job.resolve(line);
    }
  });
  child.stderr.on('data', (d) => { p.err += d; if (p.err.length > 4000) p.err = p.err.slice(-4000); });
  child.on('close', (code) => { p.dead = true; TT.procs.delete(voice); const e = new Error('Piper остановился: ' + p.err.trim().split('\n').slice(-2).join(' ').slice(0, 300)); TT.lastError = e.message; p.queue.splice(0).forEach((j) => j.reject(e)); });
  child.on('error', (e) => { p.err += String(e); });
  TT.procs.set(voice, p);
  return p;
}
function piperSay(voice, text, speed) {
  const p = piperProc(voice);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { const i = p.queue.indexOf(job); if (i >= 0) p.queue.splice(i, 1); reject(new Error('Piper не ответил')); }, 30000);
    const job = { resolve: (f) => { clearTimeout(timer); resolve(f); }, reject: (e) => { clearTimeout(timer); reject(e); } };
    p.queue.push(job);
    const line = { text: String(text).replace(/\s+/g, ' ').trim().slice(0, 1500) };
    p.child.stdin.write(JSON.stringify(line) + '\n');
  });
}
process.on('exit', () => { for (const p of TT.procs.values()) try { p.child.kill(); } catch {} });

/* ---------- HTTP ---------- */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-zv-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
}
function readBody(req, limit = 256 * 1024, raw = false) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(raw ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function appHtml() {
  const file = path.join(HERE, 'zvukoryad.html');
  let html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '<!doctype html><meta charset="utf-8"><p>Положите zvukoryad.html рядом с мостом.</p>';
  const inject = `<script>window.ZV_BRIDGE=${JSON.stringify({ url: '', token: TOKEN })};</script>`;
  return html.includes('<head>') ? html.replace('<head>', '<head>\n' + inject) : inject + html;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/zvukoryad.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(appHtml());
  }
  if (url.pathname.startsWith('/api/')) {
    if (req.headers['x-zv-token'] !== TOKEN) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Неверный ключ моста' })); }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, cli: CLAUDE?.version || null, bin: CLAUDE?.bin || null, model: MODEL || 'по умолчанию', quickModel: QUICK_MODEL || null, tried: CLAUDE ? [] : TRIED, whisper: whisperStatus(), tts: ttsStatus(), bridgeVersion: 6, chat: SESSIONS_OK }));
    }
    if (req.method === 'GET' && url.pathname === '/api/whisper') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(whisperStatus()));
    }
    if (req.method === 'POST' && url.pathname === '/api/whisper/install') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      if (!WH.job || ['done', 'error'].includes(WH.job.stage)) installWhisper(body.model in WH_MODELS ? body.model : 'turbo');
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(whisperStatus()));
    }
    if (req.method === 'POST' && url.pathname === '/api/whisper/use') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      if (body.model in WH_MODELS && fs.existsSync(path.join(WH_DIR, 'models', WH_MODELS[body.model].file))) { writeConf({ ...readConf(), whisperModel: body.model }); stopWhisperServer(); startWhisperServer(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(whisperStatus()));
    }
    if (req.method === 'GET' && url.pathname === '/api/manual') {
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(manualList()));
    }
    if (req.method === 'POST' && url.pathname === '/api/import') {
      let found = []; try { found = await importDownloads(); } catch (e) { log('Импорт: ' + e.message); }
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ found, whisper: whisperStatus(), tts: ttsStatus() }));
    }
    if (req.method === 'GET' && url.pathname === '/api/tts/status') {
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(ttsStatus()));
    }
    if (req.method === 'POST' && url.pathname === '/api/tts/install') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      if (!TT.job || ['done', 'error'].includes(TT.job.stage)) installPiper(body.voice);
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(ttsStatus()));
    }
    if (req.method === 'POST' && url.pathname === '/api/tts') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      const v = PIPER_VOICES[body.voice] ? body.voice : 'irina';
      try {
        const f = await piperSay(v, String(body.text || ''), +body.speed || 1);
        const wav = fs.readFileSync(f); try { fs.unlinkSync(f); } catch {}
        TT.lastError = '';
        res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' }); return res.end(wav);
      } catch (e) { TT.lastError = String(e.message || e); res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: TT.lastError })); }
    }
    if (req.method === 'POST' && url.pathname === '/api/transcribe') {
      let wav; try { wav = await readBody(req, 60 * 1024 * 1024, true); } catch { res.writeHead(413); return res.end('too large'); }
      if (whBusy >= 2) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'busy' })); }
      whBusy++; const t0 = Date.now();
      try { const r = await transcribeBest(wav); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ...r, ms: Date.now() - t0 })); log(`Whisper (${r.via}): ${((Date.now() - t0) / 1000).toFixed(1)} с`); }
      catch (e) { WS.lastError = String(e.message || e); log('Whisper: ошибка — ' + WS.lastError); res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: WS.lastError })); }
      finally { whBusy--; }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/claude-path') {
      let body; try { body = JSON.parse(await readBody(req)); } catch { res.writeHead(400); return res.end('bad request'); }
      const p = String(body.path || '').trim().replace(/^"|"$/g, '');
      const found = await resolveClaude(p || null);
      if (found) { CLAUDE = found; log(`Claude CLI найден: ${found.bin}`); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: !!found, cli: found?.version || null, bin: found?.bin || null, tried: TRIED }));
    }
    if (req.method === 'POST' && url.pathname === '/api/chat/open') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      if (!CLAUDE) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Claude CLI не найден' })); }
      const s = new Session(body.tier === 'quick' ? QUICK_MODEL : MODEL, String(body.system || '').slice(0, 20000), body.tier !== 'quick' && !!body.think);
      CHATS.set(s.id, s);
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: s.id }));
    }
    if (req.method === 'POST' && url.pathname === '/api/chat/close') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      const s = CHATS.get(body.id); if (s) { s.close(); CHATS.delete(body.id); }
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}');
    }
    if (req.method === 'POST' && url.pathname === '/api/chat/say') {
      let body = {}; try { body = JSON.parse(await readBody(req)); } catch {}
      const s = CHATS.get(body.id);
      if (!s || s.dead) { res.writeHead(410, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'session gone' })); }
      res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      let closed = false; res.on('close', () => { closed = true; if (s.turn) s.interrupt(); });
      const send = (o) => { if (!closed) res.write(JSON.stringify(o) + '\n'); };
      const t0 = Date.now();
      try { const text = await s.say(String(body.text || '').slice(0, 20000), (d) => send({ t: 'delta', text: d })); send({ t: 'done', text }); }
      catch (e) { send({ t: 'error', message: String(e.message || e) }); }
      finally { if (!closed) res.end(); log(`реплика собеседника за ${((Date.now() - t0) / 1000).toFixed(1)} с`); }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/ask') {
      let body; try { body = JSON.parse(await readBody(req)); } catch { res.writeHead(400); return res.end('bad request'); }
      const prompt = String(body.prompt || '').slice(0, 64000);
      if (!prompt.trim()) { res.writeHead(400); return res.end('empty prompt'); }
      if (active >= MAX_ACTIVE) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Мост занят — подождите окончания предыдущего ответа' })); }
      active++;
      res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      let child = null, closed = false;
      res.on('close', () => { closed = true; if (child && child.exitCode == null) { try { child.kill(); } catch {} } });
      const send = (o) => { if (!closed) res.write(JSON.stringify(o) + '\n'); };
      const model = body.tier === 'quick' ? QUICK_MODEL : MODEL;
      const t0 = Date.now();
      let viaSession = false;
      try {
      if (SESSIONS_OK) {
        const sess = takeWarm(model); child = sess.child;
        try { const text = await sess.say(prompt, (d) => send({ t: 'delta', text: d })); send({ t: 'done', text }); viaSession = true; }
        catch (e) {
          if (closed) viaSession = true;
          else if (/unknown option|input-format|system-prompt-file/i.test(sess.err + ' ' + e.message)) { SESSIONS_OK = false; log('Сессии stream-json не поддерживаются этим CLI — обычный режим'); }
          else { send({ t: 'error', message: String(e.message || e) }); viaSession = true; }
        } finally { sess.close(); }
      }
      if (!viaSession) {
        try { await ask(prompt, model, send, (c) => (child = c)); }
        catch (e) { send({ t: 'error', message: String(e) }); }
      }
      } finally { active--; if (!closed) res.end(); log(`ответ за ${((Date.now() - t0) / 1000).toFixed(1)} с${model ? ' · ' + model : ''}`); }
      return;
    }
  }
  res.writeHead(404); res.end('not found');
});
const log = (s) => console.log(`[${new Date().toLocaleTimeString()}] ${s}`);
/* обновился файл моста — перезапуск (скрипты запуска перезапускают процесс по коду 75) */
const SELF = fileURLToPath(import.meta.url); let selfM = 0; try { selfM = fs.statSync(SELF).mtimeMs; } catch {}
if (process.env.ZV_LOOP) setInterval(() => { try { if (fs.statSync(SELF).mtimeMs !== selfM) { log('Мост обновлён — перезапускаю…'); server.close(); process.exit(75); } } catch {} }, 3000);

(async () => {
  console.log('\n  Звукоряд · мост к Claude CLI\n');
  CLAUDE = await resolveClaude();
  if (!CLAUDE) {
    console.log('  [!] Claude CLI не найден. Проверены пути:'); TRIED.forEach((t) => console.log('      - ' + t.bin + (t.info ? '  (' + t.info + ')' : '')));
    console.log('    Установите: npm install -g @anthropic-ai/claude-code   (или см. https://claude.com/claude-code)');
    console.log('    Затем один раз запустите `claude` и войдите в свой аккаунт.');
    console.log('    Или укажите путь к claude.exe в тренажёре: Настройки -> ИИ: Claude.\n');
    console.log('  Тренажёр всё равно откроется, но ИИ-функции будут недоступны.\n');
  } else console.log(`  [OK] Claude CLI ${CLAUDE.version}\n       ${CLAUDE.bin}`);
  const ws = whisperStatus();
  console.log(ws.ready ? `  [OK] Whisper: ${WH_MODELS[ws.model].title}` : '  [ ] Whisper не установлен — включить: Настройки -> Распознавание речи');
  if (ws.ready) startWhisperServer();
  const ts = ttsStatus();
  console.log(ts.ready ? `  [OK] Живые голоса Piper: ${Object.entries(ts.voices).filter(([, v]) => v.present).map(([, v]) => v.title).join(', ')}` : '  [ ] Живые голоса не установлены — включить: Настройки -> Озвучка');
  if (CLAUDE) { WARM['-'] = null; setTimeout(() => { try { WARM[QUICK_MODEL || '-'] = new Session(QUICK_MODEL); } catch {} }, 300); }
  process.on('SIGINT', () => { stopWhisperServer(); for (const s of CHATS.values()) s.close(); for (const s of Object.values(WARM)) s && s.close(); process.exit(0); });
  server.on('error', (e) => { console.log(`\n  [!] Не удалось открыть порт ${PORT}: ${e.code}. Попробуйте --port 8788\n`); process.exit(1); });
  server.listen(PORT, HOST, () => {
    const u = `http://localhost:${PORT}`;
    console.log(`\n  Откройте тренажёр:  ${u}`);
    console.log(`  Для другой копии тренажёра (файл или сайт): адрес ${u}, ключ ${TOKEN}`);
    console.log('  Остановить: Ctrl+C\n');
    if (!flag('no-open') && !process.env.ZV_RESTARTED) {
      const cmd = WIN ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}" >/dev/null 2>&1`;
      try { spawn(cmd, { shell: true, stdio: 'ignore', detached: true }).unref(); } catch {}
    }
  });
})();
