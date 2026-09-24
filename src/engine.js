/* ===== Звукоряд: движок ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = (x, d = 1) => (x == null || !isFinite(x)) ? '—' : Number(x).toFixed(d).replace('.', ',');
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mmss = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[clamp(Math.round((s.length - 1) * p), 0, s.length - 1)]; };
const sd = (a) => { if (a.length < 2) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; };
const NOTE = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си'];
const NOTE_L = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function noteName(hz) { if (!(hz > 0)) return '—'; const m = Math.round(69 + 12 * Math.log2(hz / 440)); return NOTE_L[(m % 12 + 12) % 12] + (Math.floor(m / 12) - 1); }
const st = (hz, ref) => 12 * Math.log2(hz / ref);

/* ---------- Хранилище (в браузере этого пользователя) ---------- */
const Store = (() => {
  const KEY = 'zvukoryad.v1';
  const blank = () => ({ v: 1, created: Date.now(), days: {}, done: {}, metrics: {}, best: {}, history: [], custom: [], program: null, plans: {}, settings: { sex: 'm', tts: false, basePitch: null } });
  let data = blank();
  try { const raw = localStorage.getItem(KEY); if (raw) data = Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* хранилище недоступно */ }
  data.settings = Object.assign(blank().settings, data.settings || {});
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };
  return {
    get d() { return data; },
    save,
    log(metric, v, note) {
      if (v == null || !isFinite(v)) return;
      (data.metrics[metric] ||= []).push({ t: Date.now(), v: +(+v).toFixed(3) });
      if (data.metrics[metric].length > 400) data.metrics[metric].shift();
      if (note) this.hist(note);
      save();
    },
    hist(text) { data.history.unshift({ t: Date.now(), text }); data.history = data.history.slice(0, 80); save(); },
    last(metric) { const a = data.metrics[metric]; return a && a.length ? a[a.length - 1].v : null; },
    first(metric) { const a = data.metrics[metric]; return a && a.length ? a[0].v : null; },
    best(key, v, higher = true) {
      const cur = data.best[key];
      if (v != null && (cur == null || (higher ? v > cur : v < cur))) { data.best[key] = v; save(); return true; }
      return false;
    },
    complete(exId, minutes) {
      const k = dayKey();
      data.days[k] = (data.days[k] || 0) + (minutes || 1);
      (data.done[k] ||= []);
      if (!data.done[k].includes(exId)) data.done[k].push(exId);
      save();
    },
    doneToday(exId) { return (data.done[dayKey()] || []).includes(exId); },
    streak() {
      let n = 0; const d = new Date();
      if (!data.days[dayKey(d)]) d.setDate(d.getDate() - 1);
      while (data.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    weekMinutes() { let s = 0; const d = new Date(); for (let i = 0; i < 7; i++) { s += data.days[dayKey(d)] || 0; d.setDate(d.getDate() - 1); } return Math.round(s); },
    dayIndex() { const a = new Date(data.created); a.setHours(12, 0, 0, 0); const b = new Date(); b.setHours(12, 0, 0, 0); return Math.max(0, Math.round((b - a) / 864e5)); },
    reset() { data = blank(); save(); },
    replace(d) { data = Object.assign(blank(), d); data.settings = Object.assign(blank().settings, d.settings || {}); save(); },
    basePitch() { return data.settings.basePitch || (data.settings.sex === 'f' ? 200 : 115); },
  };
})();

/* ---------- Звук: генераторы ---------- */
const Snd = (() => {
  let ctx = null;
  const get = () => { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; ctx = C ? new C() : null; } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; };
  function blip(freq = 1000, dur = 0.04, vol = 0.25, type = 'sine', when = 0) {
    const c = get(); if (!c) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    get,
    click(accent) { blip(accent ? 1560 : 1040, 0.035, accent ? 0.3 : 0.18, 'square'); },
    cue(up) { blip(up ? 520 : 390, 0.18, 0.12, 'sine'); },
    buzz() { blip(160, 0.16, 0.22, 'sawtooth'); },
    ok() { blip(660, 0.09, 0.14); blip(880, 0.14, 0.14, 'sine', 0.09); },
    /* проиграть контур высоты: fn(t) -> полутоны от base */
    contour(fn, dur, base) {
      const c = get(); if (!c) return () => {};
      const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + 0.05;
      o.type = 'triangle'; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.08);
      for (let t = 0; t <= dur; t += 0.02) o.frequency.setValueAtTime(base * Math.pow(2, fn(t) / 12), t0 + t);
      g.gain.setValueAtTime(0.16, t0 + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
      return () => { try { o.stop(); } catch (e) {} };
    },
  };
})();

/* ---------- Озвучка ---------- */
const TTS = {
  ok: 'speechSynthesis' in window,
  voice() { const v = speechSynthesis.getVoices(); return v.find((x) => /^ru/i.test(x.lang) && /google|natural|online/i.test(x.name)) || v.find((x) => /^ru/i.test(x.lang)); },
  say(text, rate = 1) {
    if (!this.ok) return false;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.rate = rate; const v = this.voice(); if (v) u.voice = v; speechSynthesis.speak(u); return true; } catch (e) { return false; }
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) {} },
};
if (TTS.ok) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch (e) {} }

/* ---------- Определение высоты тона (нормированная автокорреляция) ---------- */
function detectPitch(x, sr, fmin = 65, fmax = 900) {
  const minLag = Math.floor(sr / fmax), maxLag = Math.ceil(sr / fmin);
  const W = x.length - maxLag; if (W < 256) return { hz: 0, c: 0 };
  let e0 = 0; for (let i = 0; i < W; i++) e0 += x[i] * x[i];
  if (e0 < 1e-6) return { hz: 0, c: 0 };
  const r = new Float32Array(maxLag + 2);
  let eL = 0; for (let i = minLag; i < minLag + W; i++) eL += x[i] * x[i];
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let i = 0; i < W; i++) s += x[i] * x[i + lag];
    const v = s / Math.sqrt(e0 * eL + 1e-12); r[lag] = v; if (v > best) best = v;
    eL += x[lag + W] * x[lag + W] - x[lag] * x[lag];
  }
  if (best < 0.55) return { hz: 0, c: best };
  let pick = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (r[lag] >= 0.88 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { pick = lag; break; }
  }
  if (pick < 0) return { hz: 0, c: best };
  const a = r[pick - 1], b = r[pick], c = r[pick + 1], den = a - 2 * b + c;
  const shift = den ? 0.5 * (a - c) / den : 0;
  return { hz: sr / (pick + shift), c: best };
}
function decimate(x, f) { if (f <= 1) return x; const n = Math.floor(x.length / f), y = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k]; y[i] = s / f; } return y; }

/* ---------- Микрофон ---------- */
const Mic = (() => {
  let ctx, stream, an, buf, raf = 0, lastPitch = 0, frameNo = 0;
  const subs = new Set();
  const M = {
    state: 'off', // off | on | denied | unsupported
    error: '',
    floor: -62,
    frame: { db: -100, hz: 0, voiced: false, loud: false, t: 0 },
    get stream() { return stream; },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    async start() {
      if (M.state === 'on') return true;
      if (!navigator.mediaDevices?.getUserMedia) { M.state = 'unsupported'; M.error = 'Браузер не даёт доступ к микрофону.'; emitState(); return false; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) {
        M.state = 'denied';
        M.error = e && e.name === 'NotFoundError' ? 'Микрофон не найден.' : 'Доступ к микрофону запрещён.';
        emitState(); return false;
      }
      ctx = Snd.get();
      const src = ctx.createMediaStreamSource(stream);
      an = ctx.createAnalyser(); an.fftSize = 2048; buf = new Float32Array(an.fftSize);
      src.connect(an);
      M.state = 'on'; M.floor = -62; frameNo = 0; emitState(); loop();
      return true;
    },
    stop() {
      cancelAnimationFrame(raf); raf = 0;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null; M.state = 'off'; emitState();
    },
    thr(extra = 10) { return Math.max(M.floor + extra, -58); },
  };
  let smooth = -100;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!an) return;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const db = 10 * Math.log10(s / buf.length + 1e-12);
    frameNo++;
    smooth = frameNo < 3 ? db : smooth * 0.6 + db * 0.4;
    // адаптивный шумовой порог: быстро вниз, медленно вверх и только в тишине
    if (frameNo < 15) M.floor = frameNo === 1 ? smooth : Math.min(M.floor, smooth);
    else if (smooth < M.floor) M.floor = M.floor * 0.7 + smooth * 0.3;
    else if (smooth < M.floor + 12) M.floor += 0.012;
    else M.floor += 0.0006;
    M.floor = clamp(M.floor, -90, -35);
    const loud = smooth > M.thr(9);
    if (frameNo % 2 === 0) {
      if (loud) { const p = detectPitch(decimate(buf, 2), ctx.sampleRate / 2); lastPitch = p.hz; } else lastPitch = 0;
    }
    M.frame = { db: smooth, hz: lastPitch, voiced: loud && lastPitch > 0, loud, t: performance.now() / 1000 };
    subs.forEach((fn) => { try { fn(M.frame); } catch (e) { console.error(e); } });
  }
  const stateSubs = new Set();
  function emitState() { stateSubs.forEach((fn) => fn(M.state)); }
  M.onState = (fn) => { stateSubs.add(fn); return () => stateSubs.delete(fn); };
  return M;
})();

/* ---------- Запись ---------- */
function makeRecorder() {
  let mr = null, chunks = [];
  return {
    start() {
      if (!Mic.stream || !window.MediaRecorder) return false;
      chunks = [];
      try { mr = new MediaRecorder(Mic.stream); } catch (e) { return false; }
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.start(); return true;
    },
    stop() {
      return new Promise((res) => {
        if (!mr || mr.state === 'inactive') return res(null);
        mr.onstop = () => { const b = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); this.blob = b; res(URL.createObjectURL(b)); };
        mr.stop();
      });
    },
  };
}

/* ---------- Распознавание речи ---------- */
const ASR = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const A = { supported: !!SR, blocked: false, lastError: '' };
  A.listen = ({ onText } = {}) => {
    if (!SR || A.blocked) return null;
    let finals = [], interim = '', stopping = false, done, rec;
    const finished = new Promise((r) => (done = r));
    const make = () => {
      rec = new SR(); rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      let base = finals.length;
      rec.onresult = (e) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finals[base + i] = r[0].transcript; else interim += r[0].transcript;
        }
        onText && onText(text(), interim);
      };
      rec.onerror = (e) => {
        A.lastError = e.error;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { A.blocked = true; stopping = true; }
      };
      rec.onend = () => {
        if (!stopping) { try { make(); rec.start(); return; } catch (e) {} }
        if (interim) { finals.push(interim); interim = ''; }
        done(text());
      };
    };
    const text = () => finals.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    make();
    try { rec.start(); } catch (e) { return null; }
    return {
      get text() { return text(); },
      get interim() { return interim; },
      stop() { stopping = true; try { rec.stop(); } catch (e) { done(text()); } setTimeout(() => done(text() + (interim ? ' ' + interim : '')), 2500); return finished; },
      abort() { stopping = true; try { rec.abort(); } catch (e) {} done(''); },
    };
  };
  return A;
})();

/* ---------- Сравнение текста ---------- */
const normWords = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
/* выравнивание целевых слов с распознанными; возвращает статус для каждого целевого слова */
function alignWords(target, heard) {
  const T = target, H = heard, m = T.length, n = H.length;
  const S = Array.from({ length: m + 1 }, () => new Float32Array(n + 1));
  const score = (i, j) => { const s = sim(T[i], H[j]); return s >= 0.99 ? 2 : s >= 0.7 ? 1 : -1; };
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) S[i][j] = Math.max(S[i - 1][j], S[i][j - 1], S[i - 1][j - 1] + Math.max(score(i - 1, j - 1), -0.5));
  const st = new Array(m).fill('miss');
  let i = m, j = n;
  while (i > 0 && j > 0) {
    const sc = score(i - 1, j - 1);
    if (sc > 0 && S[i][j] === S[i - 1][j - 1] + sc) { st[i - 1] = sc === 2 ? 'ok' : 'near'; i--; j--; }
    else if (S[i][j] === S[i - 1][j]) i--;
    else j--;
  }
  const ok = st.filter((x) => x === 'ok').length, near = st.filter((x) => x === 'near').length;
  return { status: st, acc: m ? Math.round(((ok + near * 0.5) / m) * 100) : 0, ok, near, extra: Math.max(0, n - ok - near) };
}
const countVowels = (s) => (String(s).toLowerCase().match(/[аеёиоуыэюя]/g) || []).length;

/* ---------- Слова-паразиты ---------- */
function findFillers(text) {
  const w = normWords(text);
  const list = FILLERS.map((f) => normWords(f)).sort((a, b) => b.length - a.length);
  const marks = new Set(), by = {};
  for (let i = 0; i < w.length; i++) {
    if (marks.has(i)) continue;
    for (const f of list) {
      if (f.every((x, k) => w[i + k] === x)) {
        const key = f.join(' '); by[key] = (by[key] || 0) + 1;
        for (let k = 0; k < f.length; k++) marks.add(i + k);
        break;
      }
    }
  }
  return { words: w, marks, by, count: Object.values(by).reduce((a, b) => a + b, 0) };
}

/* ---------- Анализ кадров (живой или из файла) ---------- */
function makeTrack() {
  const fr = [];
  return {
    fr,
    push(f) { fr.push({ t: f.t, db: f.db, hz: f.hz, loud: f.loud }); },
    summary(floorThr) {
      const loud = fr.filter((f) => f.loud);
      if (!loud.length) return null;
      const t0 = loud[0].t, t1 = loud[loud.length - 1].t;
      const hz = fr.filter((f) => f.hz > 0).map((f) => f.hz);
      const med = median(hz);
      const sts = hz.map((x) => st(x, med)).filter((x) => Math.abs(x) < 12);
      // паузы
      const pauses = []; let gapStart = null;
      for (const f of fr) {
        if (f.t < t0 || f.t > t1) continue;
        if (!f.loud) { if (gapStart == null) gapStart = f.t; }
        else if (gapStart != null) { const g = f.t - gapStart; if (g >= 0.45) pauses.push(g); gapStart = null; }
      }
      const talk = t1 - t0;
      return {
        t0, t1, dur: talk, medHz: med, mono: sts.length > 10 ? sd(sts) : NaN,
        range: hz.length > 10 ? st(pct(hz, 0.95), pct(hz, 0.05)) : NaN,
        pauses, longPauses: pauses.filter((p) => p >= 2).length,
      };
    },
  };
}

/* ---------- Графики (SVG) ---------- */
function lineChart(points, { h = 140, band, unit = '', digits = 1, color = 'var(--accent)' } = {}) {
  if (!points.length) return '<div class="empty">Пока нет замеров</div>';
  const W = 520, H = h, L = 36, R = 12, T = 12, B = 22;
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]); }
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.12; lo -= padv; hi += padv;
  const x = (i) => points.length === 1 ? (L + W - R) / 2 : L + (i / (points.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${path}L${x(points.length - 1).toFixed(1)},${H - B}L${x(0).toFixed(1)},${H - B}Z`;
  const ticks = [lo + padv, (lo + hi) / 2, hi - padv];
  const d0 = new Date(points[0].t), d1 = new Date(points[points.length - 1].t);
  const dl = (d) => `${d.getDate()}.${pad2(d.getMonth() + 1)}`;
  const last = points[points.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="График">
    ${band ? `<rect x="${L}" y="${y(band[1]).toFixed(1)}" width="${W - L - R}" height="${Math.max(0, y(band[0]) - y(band[1])).toFixed(1)}" fill="var(--good)" opacity=".1"/>` : ''}
    ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line-2)" stroke-width="1"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--ink-3)" font-family="JetBrains Mono,monospace">${fmt(v, digits)}</text>`).join('')}
    <path d="${area}" fill="${color}" opacity=".1"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
    <text x="${L}" y="${H - 5}" font-size="10.5" fill="var(--ink-3)" font-family="JetBrains Mono,monospace">${dl(d0)}</text>
    <text x="${W - R}" y="${H - 5}" text-anchor="end" font-size="10.5" fill="var(--ink-3)" font-family="JetBrains Mono,monospace">${dl(d1)}</text>
  </svg>`;
}
function spark(points) {
  if (points.length < 2) return '';
  const vs = points.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs) || 1, W = 120, H = 26;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * W).toFixed(1)},${(H - 3 - ((p.v - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
/* агрегирование по дням */
function daily(metric, mode = 'max') {
  const a = Store.d.metrics[metric] || [], by = {};
  for (const p of a) { const k = dayKey(new Date(p.t)); (by[k] ||= []).push(p.v); }
  return Object.keys(by).sort().map((k) => {
    const v = by[k]; const val = mode === 'max' ? Math.max(...v) : mode === 'min' ? Math.min(...v) : v.reduce((x, y) => x + y, 0) / v.length;
    return { t: new Date(k + 'T12:00').getTime(), v: val };
  });
}

/* ---------- Canvas ---------- */
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w: r.width, h: r.height };
}
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

/* ---------- Интерфейс: мелочи ---------- */
function toast(msg, ms = 2400) {
  const t = h(`<div class="toast" role="status">${esc(msg)}</div>`); document.body.append(t); setTimeout(() => t.remove(), ms);
}
const ICONS = {
  home: '<path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/>',
  breath: '<path d="M12 4v7"/><path d="M12 11c-2 0-3 1-4 3s-3 5-4 5c-1 0-1-6 0-9s3-4 4-4"/><path d="M12 11c2 0 3 1 4 3s3 5 4 5c1 0 1-6 0-9s-3-4-4-4"/>',
  lips: '<path d="M3 12c3-4 6-5 9-3 3-2 6-1 9 3-3 4-6 6-9 6s-6-2-9-6z"/><path d="M3 12h18"/>',
  wave: '<path d="M3 12h2l2-5 3 10 3-14 3 12 2-6 1 3h2"/>',
  letters: '<path d="M4 18l4-12 4 12"/><path d="M5.5 14h5"/><path d="M15 6h4a2 2 0 010 4h-4v8h4.5a2 2 0 000-4H15"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  bubble: '<path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-8l-4 3v-3H5a1 1 0 01-1-1V6a1 1 0 011-1z"/><path d="M8 10h8M8 13h5"/>',
  gauge: '<path d="M4 16a8 8 0 1116 0"/><path d="M12 16l4-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 7h6"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 14l2 2 4-4"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
  next: '<path d="M9 5l7 7-7 7"/>', prev: '<path d="M15 5l-7 7 7 7"/>',
  shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3M14 9c1-1.3 2-2 3-2h3M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Числа словами и нормализация для сравнения ---------- */
const N_UNITS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const N_TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const N_HUND = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
function num3(n) {
  const w = [];
  if (n >= 100) { w.push(N_HUND[Math.floor(n / 100)]); n %= 100; }
  if (n >= 20) { w.push(N_TENS[Math.floor(n / 10)]); n %= 10; if (n) w.push(N_UNITS[n]); }
  else if (n > 0 || !w.length) w.push(N_UNITS[n]);
  return w;
}
function numToWords(n) {
  if (!(n >= 0) || n > 999999) return [String(n)];
  if (n === 0) return ['ноль'];
  const w = [], th = Math.floor(n / 1000), r = n % 1000;
  if (th) {
    if (th === 1) w.push('тысяча');
    else {
      const t = num3(th), last = t[t.length - 1];
      if (last === 'один') t[t.length - 1] = 'одна'; if (last === 'два') t[t.length - 1] = 'две';
      const m = th % 100, u = th % 10;
      w.push(...t, m > 10 && m < 20 ? 'тысяч' : u === 1 ? 'тысяча' : u >= 2 && u <= 4 ? 'тысячи' : 'тысяч');
    }
  }
  if (r) w.push(...num3(r));
  return w;
}
const WORD_EQ = { одна: 'один', одно: 'один', одни: 'один', две: 'два', ноль: 'нуль' };
/* слова для сравнения с эталоном: цифры → слова, род числительных не важен */
function cmpWords(s) {
  const t = String(s).replace(/(\d+)\s*-\s*(?=[а-яё])/gi, '$1 ').replace(/\d{1,6}/g, (m) => ' ' + numToWords(+m).join(' ') + ' ');
  return normWords(t).map((w) => WORD_EQ[w] || w);
}
/* выравнивание с подстановками: что прозвучало вместо пропущенных слов */
function alignDetail(targetText, heardText) {
  const T = cmpWords(targetText), H = cmpWords(heardText);
  const m = T.length, n = H.length;
  const score = (i, j) => { const s = sim(T[i], H[j]); return s >= 0.99 ? 2 : s >= 0.7 ? 1 : -1; };
  const S = Array.from({ length: m + 1 }, () => new Float32Array(n + 1));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) S[i][j] = Math.max(S[i - 1][j], S[i][j - 1], S[i - 1][j - 1] + Math.max(score(i - 1, j - 1), -0.5));
  const status = new Array(m).fill('miss'), map = new Array(m).fill(-1);
  let i = m, j = n;
  while (i > 0 && j > 0) {
    const sc = score(i - 1, j - 1);
    if (sc > 0 && S[i][j] === S[i - 1][j - 1] + sc) { status[i - 1] = sc === 2 ? 'ok' : 'near'; map[i - 1] = j - 1; i--; j--; }
    else if (S[i][j] === S[i - 1][j]) i--;
    else j--;
  }
  const issues = [];
  for (let k = 0; k < m; k++) {
    if (status[k] === 'ok') continue;
    if (status[k] === 'near') { issues.push({ word: T[k], heard: H[map[k]], kind: 'near' }); continue; }
    let p = -1; for (let a = k - 1; a >= 0; a--) if (map[a] >= 0) { p = map[a]; break; }
    let q = n; for (let a = k + 1; a < m; a++) if (map[a] >= 0) { q = map[a]; break; }
    const between = H.slice(p + 1, q).filter((_, idx) => !map.includes(p + 1 + idx));
    issues.push({ word: T[k], heard: between.join(' '), kind: 'miss' });
  }
  const ok = status.filter((x) => x === 'ok').length, near = status.filter((x) => x === 'near').length;
  return { T, H, status, issues, ok, near, acc: m ? Math.round(((ok + near * 0.5) / m) * 100) : 0, extra: Math.max(0, n - ok - near) };
}

/* ---------- Слоговые ядра и просодия ---------- */
function linfit(xs, ys) {
  const n = xs.length; if (n < 2) return { a: ys[0] || 0, b: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b };
}
/* пики огибающей громкости ≈ гласные */
function findNuclei(frames, t0, t1) {
  const fr = frames.filter((f) => f.t >= t0 - 0.05 && f.t <= t1 + 0.05);
  if (fr.length < 5) return [];
  const e = fr.map((f, i) => { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const g = fr[i + k]; if (g) { s += g.db; c++; } } return s / c; });
  const top = pct(e, 0.9), gate = top - 22;
  const peaks = [];
  for (let i = 1; i < e.length - 1; i++) {
    if (!(e[i] >= e[i - 1] && e[i] > e[i + 1] && e[i] > gate)) continue;
    const last = peaks[peaks.length - 1];
    // провал между пиками
    let dip = e[i]; if (last) for (let k = last.i; k <= i; k++) dip = Math.min(dip, e[k]);
    if (last && (fr[i].t - last.t < 0.09 || Math.min(e[i], last.e) - dip < 2)) { if (e[i] > last.e) { last.i = i; last.t = fr[i].t; last.e = e[i]; } continue; }
    peaks.push({ i, t: fr[i].t, e: e[i] });
  }
  return peaks.map((p) => {
    const near = fr.filter((f) => Math.abs(f.t - p.t) <= 0.05 && f.hz > 0).map((f) => f.hz);
    return { t: p.t, db: p.e, hz: near.length ? median(near) : 0 };
  });
}
/* выделенность каждого слова: высота над линией деклинации, громкость, длительность, пауза перед словом */
function wordProminence(frames, sum, words) {
  const vc = words.map((w) => countVowels(w));
  const V = vc.reduce((a, b) => a + b, 0);
  const nuc = findNuclei(frames, sum.t0, sum.t1);
  if (!V || nuc.length < 2) return null;
  // ядро → слог → слово
  const sylWord = []; vc.forEach((c, wi) => { for (let k = 0; k < c; k++) sylWord.push(wi); });
  const N = nuc.length;
  nuc.forEach((p, k) => { const s = N === V ? k : Math.round((k * (V - 1)) / Math.max(1, N - 1)); p.w = sylWord[clamp(s, 0, V - 1)]; });
  // деклинация высоты и громкости
  const voiced = frames.filter((f) => f.hz > 0 && f.t >= sum.t0 && f.t <= sum.t1);
  const med = median(voiced.map((f) => f.hz)) || 150;
  const pf = linfit(voiced.map((f) => f.t), voiced.map((f) => st(f.hz, med)));
  const ef = linfit(nuc.map((p) => p.t), nuc.map((p) => p.db));
  const feats = words.map((w, wi) => {
    const ps = nuc.filter((p) => p.w === wi);
    if (!ps.length || !vc[wi]) return null;
    const pitch = Math.max(...ps.map((p) => (p.hz > 0 ? st(p.hz, med) - (pf.a + pf.b * p.t) : -3)));
    const loud = Math.max(...ps.map((p) => p.db - (ef.a + ef.b * p.t)));
    const first = ps[0].t, lastT = ps[ps.length - 1].t;
    const nextP = nuc.find((p) => p.w > wi), prevP = [...nuc].reverse().find((p) => p.w < wi);
    const end = nextP ? nextP.t : Math.min(sum.t1, lastT + 0.2);
    const start = prevP ? prevP.t : Math.max(sum.t0, first - 0.15);
    const len = (end - first) / vc[wi];
    let gap = 0; if (prevP) { const q = frames.filter((f) => f.t > prevP.t && f.t < first); gap = q.filter((f) => !f.loud).length * (q.length ? (first - prevP.t) / q.length : 0); }
    return { wi, pitch, loud, len, gap, start };
  });
  return { feats, nuclei: N, syllables: V, med };
}
function scoreProminence(feats, base) {
  const on = feats.filter(Boolean);
  const val = (f, k) => { let v = f[k]; if (base && base[f.wi]) v -= base[f.wi][k]; return v; };
  const z = (k, floor) => { const xs = on.map((f) => val(f, k)); const m = xs.reduce((a, b) => a + b, 0) / xs.length; const s = Math.max(sd(xs), floor); return (f) => (val(f, k) - m) / s; };
  const zp = z('pitch', 0.8), ze = z('loud', 1.5), zl = z('len', 0.03), zg = z('gap', 0.05);
  return feats.map((f) => f ? { ...f, zp: zp(f), ze: ze(f), zl: zl(f), zg: zg(f), score: zp(f) * 1 + ze(f) * 0.8 + zl(f) * 0.5 + Math.max(0, zg(f)) * 0.4 } : null);
}
/* проседание громкости к концу фраз */
function phraseEnds(frames, t0, t1) {
  const segs = []; let cur = [];
  let silent = 0;
  for (const f of frames) {
    if (f.t < t0 || f.t > t1) continue;
    if (f.loud) { cur.push(f); silent = 0; }
    else { silent += 1; if (silent > 18 && cur.length) { segs.push(cur); cur = []; } }
  }
  if (cur.length) segs.push(cur);
  const drops = segs.filter((s) => s.length > 40).map((s) => {
    const n = s.length, head = s.slice(0, Math.floor(n * 0.6)), tail = s.slice(Math.floor(n * 0.8));
    return median(head.map((f) => f.db)) - median(tail.map((f) => f.db));
  });
  return { segments: segs.length, drop: drops.length ? median(drops) : NaN };
}

/* какие буквы слова потерялись или заменились */
function charIssues(word, heard) {
  const a = word, b = heard || '', m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const lost = []; let i = 0, j = 0;
  while (i < m) { if (j < n && a[i] === b[j]) { i++; j++; } else if (j < n && L[i][j + 1] >= L[i + 1][j]) j++; else { lost.push(i); i++; } }
  const cons = [...new Set(lost.map((k) => a[k]).filter((ch) => /[бвгджзйклмнпрстфхцчшщ]/.test(ch)))];
  const ending = lost.length > 0 && lost.every((k) => k >= m - 3);
  return { lost, cons, ending };
}
function issueText(it) {
  if (!it.heard) return `«${it.word}» — слово не прозвучало или проглочено целиком`;
  const d = charIssues(it.word, it.heard);
  let why = '';
  if (d.ending) why = 'смазано окончание';
  else if (d.cons.length) why = 'нечётко: ' + d.cons.map((c) => '«' + c.toUpperCase() + '»').join(', ');
  return `«${it.word}» → услышано «${it.heard}»${why ? ' — ' + why : ''}`;
}

/* запись → WAV 16 кГц моно (для Whisper) */
async function blobToWav16k(blob) {
  const ac = Snd.get(); const audio = await ac.decodeAudioData(await blob.arrayBuffer());
  const len = Math.max(1, Math.ceil(audio.duration * 16000));
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
  const x = (await off.startRendering()).getChannelData(0);
  const dv = new DataView(new ArrayBuffer(44 + x.length * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + x.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true);
  return new Blob([dv.buffer], { type: 'audio/wav' });
}
