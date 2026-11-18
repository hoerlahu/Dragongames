/* Dragongames – Around the Clock */
'use strict';
(function () {
  const h = DG.h;
  const BOARD = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  function targetsFor(o) {
    let t = [];
    for (let i = 1; i <= 20; i++) t.push(i);
    if (o.order === 'desc') t.reverse();
    if (o.order === 'board') t = BOARD.slice();
    if (o.bull) t.push(25);
    return t;
  }

  function create(names, opts) {
    return {
      game: 'atc', opts, inputMode: 'quick', targets: targetsFor(opts),
      players: names.map(name => ({ name, idx: 0, darts: 0, hits: 0, done: false, fin: null, hist: [] })),
      cur: 0, visit: [], round: 1, finished: false, winner: null,
    };
  }

  const label = t => t === 25 ? 'Bull' : String(t);
  const modeTxt = { any: 'jedes Segment', double: 'nur Doubles', triple: 'nur Triples' };

  /** Prüft, ob Dart das aktuelle Ziel trifft – liefert Anzahl Felder, die vorgerückt wird */
  function advanceFor(s, p, dart) {
    const t = s.targets[p.idx];
    if (dart.m === 0 || dart.n !== t) return 0;
    const mode = s.opts.hit;
    if (mode === 'double' && dart.m !== 2) return 0;
    if (mode === 'triple' && !(dart.m === 3 || (t === 25 && dart.m === 2))) return 0;
    if (mode === 'any' && s.opts.skip) return dart.m;
    return 1;
  }

  function applyHit(s, adv, lbl) {
    const p = s.players[s.cur];
    p.darts++;
    if (adv > 0) { p.hits++; p.idx = Math.min(s.targets.length, p.idx + adv); }
    s.visit.push({ ok: adv > 0, l: lbl });
    if (p.idx >= s.targets.length) {
      p.done = true; p.fin = p.darts;
      DG.toast(p.name + ' ist durch – ' + p.darts + ' Darts', 'green');
      endVisit(s); return;
    }
    if (s.visit.length === 3) endVisit(s);
  }

  function endVisit(s) {
    const p = s.players[s.cur];
    p.hist.push(s.visit.map(v => v.ok ? '●' : '○').join(''));
    s.visit = [];
    const n = s.players.length;
    let next = -1;
    for (let k = 1; k <= n; k++) {
      const idx = (s.cur + k) % n;
      if (!s.players[idx].done) { next = idx; break; }
    }
    const roundEnds = next === -1 || next <= s.cur;
    const anyDone = s.players.some(q => q.done);
    if (next === -1 || (roundEnds && s.opts.end === 'first' && anyDone)) { finish(s); return; }
    if (roundEnds) s.round++;
    s.cur = next;
  }

  function finish(s) {
    s.finished = true;
    let best = -1;
    s.players.forEach((p, i) => {
      if (!p.done) return;
      if (best < 0 || p.fin < s.players[best].fin) best = i;
    });
    s.winner = best;
  }

  function quickHit(s, kind, ctx) {
    if (s.finished) return;
    const p = s.players[s.cur];
    const t = s.targets[p.idx];
    let adv = 0, lbl = '–';
    if (kind > 0) {
      if (s.opts.hit === 'any') { adv = s.opts.skip ? kind : 1; lbl = (kind === 3 ? 'T' : kind === 2 ? 'D' : '') + label(t); if (t === 25 && kind === 3) return; }
      else { adv = 1; lbl = (s.opts.hit === 'double' ? 'D' : 'T') + label(t); }
    }
    ctx.commit(st => applyHit(st, adv, lbl));
  }
  function dartHit(s, dart, ctx) {
    if (s.finished) return;
    const p = s.players[s.cur];
    ctx.commit(st => applyHit(st, advanceFor(st, p, dart), DG.dartLabel(dart)));
  }
  function finishVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => { const p = st.players[st.cur]; while (st.visit.length < 3) { p.darts++; st.visit.push({ ok: false, l: '–' }); } endVisit(st); });
  }

  function render(s, root, ctx) {
    const n = s.players.length, ui = ctx.ui;
    root.appendChild(h('div', { class: 'togo-row' }, s.players.map((p, i) => {
      const t = s.targets[p.idx];
      return h('div', { class: 'togo' + (i === s.cur ? ' active' : '') + (n > 2 ? ' compact' : '') + (p.done ? ' done' : '') },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'big' }, p.done ? '✓' : (s.opts.hit === 'double' ? 'D' : s.opts.hit === 'triple' && t !== 25 ? 'T' : '') + label(t)),
        h('div', { class: 'sub' }, 'Darts ' + p.darts + ' · Treffer ' + DG.fmt.pct(p.hits, p.darts)),
        h('div', { class: 'atc-track' }, s.targets.map((tt, k) => h('span', { class: k < p.idx ? 'ok' : k === p.idx ? 'now' : '' }, tt === 25 ? 'B' : tt))));
    })));

    const info = h('div', { class: 'info-row' },
      h('div', { class: 'info-pill' }, 'Runde ' + s.round),
      h('div', { class: 'info-pill' }, 'Around the Clock · ' + modeTxt[s.opts.hit] + (s.opts.hit === 'any' && s.opts.skip ? ' · D/T springen' : '') + ' · ' + { asc: '1→20', desc: '20→1', board: 'im Uhrzeigersinn' }[s.opts.order]));

    const maxR = Math.max(1, ...s.players.map(p => p.hist.length + 1));
    const rows = [];
    for (let r = 0; r < maxR; r++) {
      rows.push(h('tr', null, h('td', { class: 'dc' }, r + 1), s.players.map((p, i) => {
        if (p.hist[r]) return h('td', { class: 'sc' }, p.hist[r]);
        if (i === s.cur && r === p.hist.length) return h('td', { class: 'sc cur' }, s.visit.map(v => v.ok ? '●' : '○').join(''));
        return h('td', { class: 'sc' }, '');
      })));
    }
    const sheet = h('div', { class: 'sheet' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Rd'), s.players.map(p => h('th', { class: 'sc' }, p.name)))), h('tbody', null, rows)));

    const slots = [0, 1, 2].map(k => {
      const v = s.visit[k];
      if (v) return h('div', { class: 'vdart filled' + (v.ok ? ' hit' : '') }, v.l);
      if (k === s.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
      return h('div', { class: 'vdart' }, '');
    });
    let pad;
    if (s.inputMode === 'quick') {
      const cur = s.players[s.cur], t = s.targets[cur.idx];
      const btns = s.opts.hit === 'any'
        ? [h('button', { class: 'key big green', onclick: () => quickHit(s, 1, ctx) }, 'Single ' + label(t), h('span', { class: 'kbd' }, '1')),
          h('button', { class: 'key big green', onclick: () => quickHit(s, 2, ctx) }, 'Double', h('span', { class: 'kbd' }, '2')),
          h('button', { class: 'key big green', disabled: t === 25, onclick: () => quickHit(s, 3, ctx) }, 'Triple', h('span', { class: 'kbd' }, '3')),
          h('button', { class: 'key big red', onclick: () => quickHit(s, 0, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))]
        : [h('button', { class: 'key big green span2', onclick: () => quickHit(s, 1, ctx) }, 'Treffer', h('span', { class: 'kbd' }, '1 / Leer')),
          h('button', { class: 'key big red span2', onclick: () => quickHit(s, 0, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))];
      pad = h('div', null,
        h('div', { class: 'pad wide' }, btns),
        h('div', { class: 'pad wide', style: 'margin-top:6px' }, h('button', { class: 'key small dim span2', onclick: () => finishVisit(s, ctx) }, 'Rest = daneben', h('span', { class: 'kbd' }, 'Enter'))));
    } else {
      pad = DG.dartPad(ui, { onDart: d => dartHit(s, d, ctx), onEnd: () => finishVisit(s, ctx), endLabel: 'Rest = daneben' }, () => ctx.rerender());
    }
    const inputBox = h('div', { class: 'inputbox' }, h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)), pad);

    const statRows = [
      ['Fortschritt', p => p.idx + ' / ' + s.targets.length],
      ['Darts', p => p.darts],
      ['Trefferquote', p => DG.fmt.pct(p.hits, p.darts)],
      ['Fertig nach', p => p.fin ?? '–'],
    ];
    root.appendChild(h('div', { class: 'game-main multi' },
      h('div', { class: 'col' }, info, sheet, inputBox),
      h('div', { class: 'col' }, DG.statTable(s.players, statRows, s.cur))));
  }

  function onKey(e, s, ctx) {
    if (s.inputMode === 'quick') {
      const k = e.key;
      if (k === '0') { quickHit(s, 0, ctx); return true; }
      if (k === '1' || k === ' ') { quickHit(s, 1, ctx); return true; }
      if ((k === '2' || k === '3') && s.opts.hit === 'any') { quickHit(s, +k, ctx); return true; }
      if (k === 'Enter') { finishVisit(s, ctx); return true; }
      return false;
    }
    return DG.dartKey(e, ctx.ui, d => dartHit(s, d, ctx), () => finishVisit(s, ctx), () => ctx.rerender());
  }

  function results(s) {
    const order = s.players.map((p, i) => i).sort((a, b) => {
      const A = s.players[a], B = s.players[b];
      if (A.done !== B.done) return A.done ? -1 : 1;
      return A.done ? A.fin - B.fin : B.idx - A.idx;
    });
    const rows = order.map((i, rank) => {
      const p = s.players[i];
      return [(rank + 1) + '. ' + p.name, p.done ? p.fin + ' Darts' : 'bis ' + label(s.targets[p.idx]), p.darts, DG.fmt.pct(p.hits, p.darts)];
    });
    return { headline: 'Around the Clock – schnellster Spieler', winner: s.winner >= 0 ? s.players[s.winner].name : null,
      cols: ['Fertig nach', 'Darts', 'Trefferquote'], rows };
  }

  DG.register({
    id: 'atc', title: 'Around the Clock', sub: '1–20 (+ Bull) der Reihe nach', icon: '🕒',
    inputModes: ['quick', 'single'], inputModeLabels: { quick: 'Treffer/Daneben', single: 'Einzeldarts' },
    canToggleInput: () => true,
    options: [
      { key: 'hit', label: 'Zählt als Treffer', type: 'pills', choices: [['any', 'jedes Segment'], ['double', 'nur Doubles'], ['triple', 'nur Triples']], def: 'any' },
      { key: 'skip', label: 'Double/Triple springt 2/3 Felder weiter', type: 'pills', choices: [[false, 'nein'], [true, 'ja']], def: false, showIf: o => o.hit === 'any' },
      { key: 'order', label: 'Reihenfolge', type: 'pills', choices: [['asc', '1 → 20'], ['desc', '20 → 1'], ['board', 'im Uhrzeigersinn']], def: 'asc' },
      { key: 'bull', label: 'Bull am Ende', type: 'pills', choices: [[true, 'ja'], [false, 'nein']], def: true },
      { key: 'end', label: 'Spielende', type: 'pills', choices: [['first', 'erster fertig (Runde zu Ende)'], ['all', 'alle fertig']], def: 'first' },
    ],
    create, render, onKey, results,
  });
})();
