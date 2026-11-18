/* Dragongames – Basisfunktionen: DOM-Helfer, Checkout-Rechner, Eingabe-Pads */
'use strict';

const DG = window.DG = { games: {}, gameOrder: [] };

/* ---------- DOM ---------- */
DG.h = function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
};

DG.register = function (game) { DG.games[game.id] = game; DG.gameOrder.push(game.id); };

DG.fmt = {
  avg(points, darts) { return darts ? (points / darts * 3).toFixed(2) : '0'; },
  pct(a, b) { return b ? Math.round(a / b * 100) + ' %' : '–'; },
};

/* ---------- Darts / Segmente ---------- */
// Ein Dart: { m: 0|1|2|3, n: 0..20|25 }  (m=0 → daneben)
DG.dartValue = d => d.m * d.n;
DG.dartLabel = d => {
  if (!d || d.m === 0) return '–';
  if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
  return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n;
};

const ALL_DARTS = (() => {
  const list = [];
  for (let n = 1; n <= 20; n++) for (let m = 1; m <= 3; m++) list.push({ m, n });
  list.push({ m: 1, n: 25 }, { m: 2, n: 25 });
  return list;
})();

// Unmögliche 3-Dart-Summen ermitteln
DG.possibleVisit = (() => {
  const vals = new Set([0]);
  const singles = [0, ...ALL_DARTS.map(DG.dartValue)];
  for (const a of singles) for (const b of singles) for (const c of singles) vals.add(a + b + c);
  return v => vals.has(v);
})();

/* ---------- Checkout-Rechner ---------- */
const FINISH_PREF = { 20: 0, 16: 1, 18: 2, 10: 3, 12: 4, 8: 5, 14: 6, 25: 7, 6: 8, 4: 9, 2: 10, 19: 11, 17: 12, 15: 13, 13: 14, 11: 15, 9: 16, 7: 17, 5: 18, 3: 19, 1: 20 };
function setupCost(d) {
  if (d.m === 3) return { 20: 0, 19: 1, 18: 2, 17: 3, 16: 4 }[d.n] ?? 6;
  if (d.m === 1) return d.n === 25 ? 7 : (d.n >= 10 ? 4 : 5);
  if (d.m === 2) return d.n === 25 ? 6 : 8;
  return 10;
}
function isFinishDart(d, outMode) {
  if (outMode === 'straight') return true;
  if (outMode === 'master') return d.m === 2 || d.m === 3;
  return d.m === 2; // double out
}
function finishCost(d) {
  const base = FINISH_PREF[d.n] ?? 20;
  return d.m === 2 ? base : d.m === 3 ? base + 5 : base + 25;
}
const coCache = new Map();
/** liefert beste Checkout-Route (Array von Darts) oder null */
DG.checkout = function (rest, outMode = 'double', maxDarts = 3) {
  if (rest <= 0 || rest > 180) return null;
  const key = rest + '|' + outMode + '|' + maxDarts;
  if (coCache.has(key)) return coCache.get(key);
  const finals = ALL_DARTS.filter(d => isFinishDart(d, outMode));
  let best = null, bestCost = Infinity;
  for (let n = 1; n <= maxDarts && !best; n++) {
    if (n === 1) {
      for (const f of finals) if (DG.dartValue(f) === rest) {
        const c = finishCost(f); if (c < bestCost) { bestCost = c; best = [f]; }
      }
    } else if (n === 2) {
      for (const a of ALL_DARTS) for (const f of finals) if (DG.dartValue(a) + DG.dartValue(f) === rest) {
        const c = setupCost(a) * 2 + finishCost(f); if (c < bestCost) { bestCost = c; best = [a, f]; }
      }
    } else {
      for (const a of ALL_DARTS) {
        const ra = rest - DG.dartValue(a); if (ra <= 0) continue;
        for (const b of ALL_DARTS) {
          const rb = ra - DG.dartValue(b); if (rb <= 0) continue;
          for (const f of finals) if (DG.dartValue(f) === rb) {
            const c = setupCost(a) * 2 + setupCost(b) * 1.5 + finishCost(f);
            if (c < bestCost) { bestCost = c; best = [a, b, f]; }
          }
        }
      }
    }
  }
  coCache.set(key, best);
  return best;
};
DG.checkoutText = (rest, outMode, maxDarts = 3) => {
  const r = DG.checkout(rest, outMode, maxDarts);
  return r ? r.map(DG.dartLabel).join('  ') : '';
};
DG.minCheckoutDarts = (rest, outMode) => {
  for (let n = 1; n <= 3; n++) if (DG.checkout(rest, outMode, n)) return n;
  return null;
};

/* ---------- X01-Kernlogik (wird von X01 und Checkout-Training genutzt) ---------- */
/** Prüft eine Aufnahme (Gesamtsumme). Rückgabe: {bust, finish, newRest} oder {error} */
DG.evalTotal = function (rest, score, outMode) {
  if (!Number.isInteger(score) || score < 0 || score > 180) return { error: 'Ungültige Punktzahl' };
  if (!DG.possibleVisit(score)) return { error: score + ' ist mit 3 Darts nicht möglich' };
  const nr = rest - score;
  if (nr < 0) return { bust: true, newRest: rest };
  if (nr === 0) {
    if (!DG.checkout(rest, outMode, 3)) return { bust: true, newRest: rest };
    return { finish: true, newRest: 0 };
  }
  if (nr === 1 && outMode !== 'straight') return { bust: true, newRest: rest };
  return { newRest: nr };
};
/** Prüft einen einzelnen Dart. rest = Rest vor diesem Dart */
DG.evalDart = function (rest, dart, outMode) {
  const v = DG.dartValue(dart);
  const nr = rest - v;
  if (nr < 0) return { bust: true };
  if (nr === 0) return isFinishDart(dart, outMode) && v > 0 ? { finish: true, newRest: 0 } : { bust: true };
  if (nr === 1 && outMode !== 'straight') return { bust: true };
  return { newRest: nr };
};
DG.isFinishDart = isFinishDart;

/* ---------- Sprachansage (optional) ---------- */
DG.speech = { on: false };
DG.say = function (text) {
  if (!DG.speech.on || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = 'de-DE'; u.rate = 1.05;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
};

/* ---------- Eingabe-Pads ---------- */
const h = DG.h;

/** Ziffernblock für Aufnahme-Summe. ui.typed wird bearbeitet. */
DG.totalPad = function (ui, onSubmit, rerender) {
  const press = k => {
    if (k === 'back') ui.typed = ui.typed.slice(0, -1);
    else if (k === 'ok') { onSubmit(ui.typed === '' ? 0 : parseInt(ui.typed, 10)); return; }
    else if (ui.typed.length < 3) ui.typed = (ui.typed === '0' ? '' : ui.typed) + k;
    rerender();
  };
  const quick = [26, 41, 45, 60, 81, 85, 100, 140, 180];
  return h('div', null,
    h('div', { class: 'pad quick' }, quick.map(q => h('button', { class: 'key small dim', onclick: () => onSubmit(q) }, q))),
    h('div', { class: 'pad total' },
      ['7', '8', '9'].map(k => h('button', { class: 'key', onclick: () => press(k) }, k)),
      h('button', { class: 'key dim', onclick: () => press('back') }, '⌫'),
      ['4', '5', '6'].map(k => h('button', { class: 'key', onclick: () => press(k) }, k)),
      h('button', { class: 'key red', onclick: () => onSubmit(0) }, '0 / Bust'),
      ['1', '2', '3'].map(k => h('button', { class: 'key', onclick: () => press(k) }, k)),
      h('button', { class: 'key', onclick: () => press('0') }, '0'),
      h('button', { class: 'key green span3', onclick: () => press('ok') }, 'OK ', h('span', { class: 'kbd' }, 'Enter')),
      h('button', { class: 'key dim', onclick: () => { ui.typed = ''; rerender(); } }, 'C'),
    ));
};

/** Feld-Pad für Einzeldarts. opts: {allowed:Set|null, onDart, onEnd, endLabel, noTriple} */
DG.dartPad = function (ui, opts, rerender) {
  ui.mult = ui.mult || 1;
  const allowed = opts.allowed;
  const setMult = m => { ui.mult = ui.mult === m ? 1 : m; rerender(); };
  const throwN = n => { const m = n === 25 ? Math.min(ui.mult, 2) : ui.mult; ui.mult = 1; opts.onDart({ m, n }); };
  const nums = [];
  for (let n = 1; n <= 20; n++) nums.push(n);
  nums.push(25);
  const order = allowed ? [...nums.filter(n => allowed.has(n) && n !== 25).reverse(), ...(allowed.has(25) ? [25] : [])] : nums;
  return h('div', null,
    h('div', { class: 'pad wide', style: 'margin-bottom:6px' },
      h('button', { class: 'key small' + (ui.mult === 2 ? ' on' : ''), onclick: () => setMult(2) }, 'Double', h('span', { class: 'kbd' }, 'D')),
      h('button', { class: 'key small' + (ui.mult === 3 ? ' on' : ''), onclick: () => setMult(3) }, 'Triple', h('span', { class: 'kbd' }, 'T')),
      h('button', { class: 'key small red', onclick: () => opts.onDart({ m: 0, n: 0 }) }, 'Daneben', h('span', { class: 'kbd' }, '0')),
      h('button', { class: 'key small green', onclick: () => opts.onEnd() }, opts.endLabel || 'Aufnahme fertig', h('span', { class: 'kbd' }, 'Enter')),
    ),
    h('div', { class: 'pad ' + (allowed ? 'wide' : 'darts') },
      order.map(n => h('button', {
        class: 'key' + (allowed ? ' big' : ''),
        disabled: n === 25 && ui.mult === 3,
        onclick: () => throwN(n)
      }, n === 25 ? (ui.mult === 2 ? 'Bull' : '25') : (ui.mult === 3 ? 'T' : ui.mult === 2 ? 'D' : '') + n))
    ));
};

/** Tastatur für Einzeldarts: "t20" Enter, "d16" Enter, "25", "0"; Enter ohne Eingabe → onEnd */
DG.dartKey = function (e, ui, onDart, onEnd, rerender) {
  const k = e.key.toLowerCase();
  ui.dbuf = ui.dbuf || '';
  if (k === 'd' || k === 't' || k === 's') { ui.mult = k === 'd' ? 2 : k === 't' ? 3 : 1; rerender(); return true; }
  if (/^[0-9]$/.test(k)) { if (ui.dbuf.length < 2) ui.dbuf += k; rerender(); return true; }
  if (k === 'backspace') { if (ui.dbuf) ui.dbuf = ui.dbuf.slice(0, -1); else ui.mult = 1; rerender(); return true; }
  if (k === 'enter' || k === ' ') {
    if (ui.dbuf === '') { onEnd(); return true; }
    const n = parseInt(ui.dbuf, 10);
    let m = ui.mult || 1;
    ui.dbuf = ''; ui.mult = 1;
    if (n === 0) { onDart({ m: 0, n: 0 }); return true; }
    if (n === 50) { onDart({ m: 2, n: 25 }); return true; }
    if ((n >= 1 && n <= 20) || n === 25) { if (n === 25 && m === 3) m = 2; onDart({ m, n }); return true; }
    rerender(); DG.toast('Ungültiges Feld: ' + n, 'red');
    return true;
  }
  return false;
};
DG.dartBufLabel = ui => {
  const p = ui.mult === 3 ? 'T' : ui.mult === 2 ? 'D' : '';
  return (p + (ui.dbuf || '')) || '';
};

/* ---------- Toast & Modal ---------- */
DG.toast = function (text, color) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast' + (color === 'green' ? ' green' : '') }, text);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
};
/** Modal mit Buttons [{label, key, value, cls}] → Promise(value|null) */
DG.modal = function (title, text, buttons) {
  return new Promise(resolve => {
    const close = v => { document.removeEventListener('keydown', onKey, true); bg.remove(); resolve(v); };
    const onKey = e => {
      const b = buttons.find(b => b.key && b.key.toLowerCase() === e.key.toLowerCase());
      if (b) { e.preventDefault(); e.stopPropagation(); close(b.value); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      else { e.stopPropagation(); }
    };
    const bg = h('div', { class: 'modal-bg' },
      h('div', { class: 'modal' },
        h('h3', null, title), text ? h('p', null, text) : null,
        h('div', { class: 'btns' }, buttons.map(b =>
          h('button', { class: b.cls || 'bigbtn secondary', onclick: () => close(b.value) }, b.label, b.key ? h('span', { class: 'kbd' }, b.key) : null)))));
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(bg);
  });
};
DG.modalOpen = () => !!document.querySelector('.modal-bg');

/** Gemeinsame Stat-Darstellung: für 2 Spieler Liste links/rechts, sonst Tabelle */
DG.statList = function (rows) {
  return h('div', { class: 'statlist' }, rows.map(([l, v]) => h('div', { class: 'line' }, h('span', null, l), h('b', null, v))));
};
DG.statTable = function (players, rowDefs, activeIdx) {
  return h('div', { class: 'statlist' },
    h('table', { class: 'stattable' },
      h('thead', null, h('tr', null, h('th', null, ''), players.map((p, i) => h('th', { style: i === activeIdx ? 'color:var(--yellow)' : '' }, p.name)))),
      h('tbody', null, rowDefs.map(([label, fn]) => h('tr', null, h('td', null, label), players.map((p, i) => h('td', null, fn(p, i))))))));
};

/** Legs-Ziel berechnen */
DG.legsNeeded = (mode, n) => mode === 'best' ? Math.floor(n / 2) + 1 : n;
