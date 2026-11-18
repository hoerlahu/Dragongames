/* Dragongames – Cricket (Standard, Cut Throat, ohne Punkte) */
'use strict';
(function () {
  const h = DG.h;
  const TARGETS = [20, 19, 18, 17, 16, 15, 25];
  const MARK = ['', '╱', '✕', '⊗'];

  function emptyMarks() { const m = {}; TARGETS.forEach(t => { m[t] = 0; }); return m; }

  function startLeg(s) {
    s.players.forEach(p => { p.marks = emptyMarks(); p.pts = 0; p.legMarks = 0; p.legDarts = 0; });
    s.cur = s.legStarter; s.visit = []; s.round = 1; s.history = s.players.map(() => []);
  }

  function create(names, opts) {
    const s = {
      game: 'cricket', opts, inputMode: 'targets',
      players: names.map(name => ({ name, legs: 0, st: { marks: 0, darts: 0, legsWon: 0, t: 0, d: 0, best: null, nine: 0 } })),
      legStarter: 0, legNo: 1, finished: false, winner: null,
    };
    startLeg(s);
    return s;
  }

  const closedBy = (p, t) => p.marks[t] >= 3;
  const allClosed = p => TARGETS.every(t => closedBy(p, t));

  function applyDart(s, dart) {
    const p = s.players[s.cur];
    const mode = s.opts.mode;
    let marksAdded = 0;
    if (dart.m > 0 && TARGETS.includes(dart.n)) {
      const t = dart.n;
      for (let k = 0; k < dart.m; k++) {
        if (p.marks[t] < 3) { p.marks[t]++; marksAdded++; continue; }
        const openOpp = s.players.filter((o, i) => i !== s.cur && !closedBy(o, t));
        if (!openOpp.length || mode === 'noscore') continue;
        marksAdded++;
        if (mode === 'cutthroat') openOpp.forEach(o => { o.pts += t; });
        else p.pts += t;
      }
      if (dart.m === 3) p.st.t++;
      if (dart.m === 2) p.st.d++;
    }
    p.st.marks += marksAdded; p.st.darts++;
    p.legMarks += marksAdded; p.legDarts++;
    s.visit.push({ m: dart.m, n: dart.n, mk: marksAdded });
    if (checkWin(s, s.cur)) return;
    if (s.visit.length === 3) endVisit(s);
  }

  function checkWin(s, i) {
    const p = s.players[i];
    if (!allClosed(p)) return false;
    const others = s.players.filter((o, k) => k !== i);
    let ok = true;
    if (s.opts.mode === 'standard') ok = others.every(o => p.pts >= o.pts);
    if (s.opts.mode === 'cutthroat') ok = others.every(o => p.pts <= o.pts);
    if (ok) legWon(s, i);
    return ok;
  }

  function endVisit(s) {
    const p = s.players[s.cur];
    const mk = s.visit.reduce((a, d) => a + d.mk, 0);
    if (mk === 9) p.st.nine++;
    s.history[s.cur].push({ darts: s.visit.map(DG.dartLabel).join(' '), mk });
    s.visit = [];
    s.cur = (s.cur + 1) % s.players.length;
    if (s.cur === s.legStarter) {
      if (s.opts.roundLimit && s.round >= s.opts.roundLimit) { decideByLimit(s); return; }
      s.round++;
    }
  }

  function decideByLimit(s) {
    const score = p => s.opts.mode === 'cutthroat' ? -p.pts : p.pts;
    let best = 0;
    s.players.forEach((p, i) => {
      const b = s.players[best];
      if (score(p) > score(b) || (score(p) === score(b) && TARGETS.reduce((a, t) => a + p.marks[t], 0) > TARGETS.reduce((a, t) => a + b.marks[t], 0))) best = i;
    });
    DG.toast('Rundenlimit erreicht');
    legWon(s, best);
  }

  function legWon(s, i) {
    const p = s.players[i];
    p.legs++; p.st.legsWon++;
    p.st.best = p.st.best === null ? p.legDarts : Math.min(p.st.best, p.legDarts);
    if (p.legs >= DG.legsNeeded(s.opts.legMode, s.opts.legs)) { s.finished = true; s.winner = i; return; }
    DG.toast('Leg für ' + p.name, 'green');
    s.legNo++;
    s.legStarter = (s.legStarter + 1) % s.players.length;
    startLeg(s);
  }

  function throwDart(s, d, ctx) { if (!s.finished) ctx.commit(st => applyDart(st, d)); }
  function finishVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => {
      const need = 3 - st.visit.length; // feste Anzahl, da applyDart die Aufnahme beim 3. Dart zurücksetzt
      for (let i = 0; i < need && !st.finished; i++) applyDart(st, { m: 0, n: 0 });
    });
  }

  const mpr = st => st.darts ? (st.marks / st.darts * 3).toFixed(2) : '0';

  function render(s, root, ctx) {
    const n = s.players.length, two = n === 2, ui = ctx.ui;
    const modeTxt = { standard: 'Standard', cutthroat: 'Cut Throat', noscore: 'ohne Punkte' }[s.opts.mode];

    root.appendChild(h('div', { class: 'togo-row' }, s.players.map((p, i) =>
      h('div', { class: 'togo' + (i === s.cur ? ' active' : '') + (n > 2 ? ' compact' : '') },
        i === s.legStarter ? h('span', { class: 'dot' }) : null,
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'big' }, s.opts.mode === 'noscore' ? TARGETS.filter(t => closedBy(p, t)).length + '/7' : p.pts),
        h('div', { class: 'sub' }, 'Legs: ' + p.legs + ' · MPR ' + mpr(p.st))))));

    // Tafel
    const head = two
      ? [h('th', { class: s.cur === 0 ? 'act' : '' }, s.players[0].name), h('th', null, ''), h('th', { class: s.cur === 1 ? 'act' : '' }, s.players[1].name)]
      : [h('th', null, ''), ...s.players.map((p, i) => h('th', { class: i === s.cur ? 'act' : '' }, p.name))];
    const rows = TARGETS.map(t => {
      const closedAll = s.players.every(p => closedBy(p, t));
      const mc = p => h('td', { class: 'm' + p.marks[t] }, h('span', { class: 'mark' }, MARK[p.marks[t]]));
      const tc = h('td', { class: 'target' }, t === 25 ? 'Bull' : t);
      const cells = two ? [mc(s.players[0]), tc, mc(s.players[1])] : [tc, ...s.players.map(mc)];
      return h('tr', { class: closedAll ? 'closed' : '' }, cells);
    });
    const board = h('div', { class: 'cboard' }, h('table', null, h('thead', null, h('tr', null, head)), h('tbody', null, rows)));

    const info = h('div', { class: 'info-row' },
      h('div', { class: 'info-pill' }, 'Leg ' + s.legNo + ' · Runde ' + s.round + (s.opts.roundLimit ? ' / ' + s.opts.roundLimit : '')),
      h('div', { class: 'info-pill' }, 'Cricket ' + modeTxt + ' · ' + (s.opts.legMode === 'best' ? 'best of ' : 'first to ') + s.opts.legs + ' legs'));

    const slots = [0, 1, 2].map(k => {
      const d = s.visit[k];
      if (d) return h('div', { class: 'vdart filled' + (d.mk ? ' hit' : '') }, DG.dartLabel(d));
      if (k === s.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
      return h('div', { class: 'vdart' }, '');
    });
    const pad = DG.dartPad(ui, {
      allowed: s.inputMode === 'targets' ? new Set(TARGETS) : null,
      onDart: d => throwDart(s, d, ctx), onEnd: () => finishVisit(s, ctx), endLabel: 'Rest = daneben',
    }, () => ctx.rerender());
    const inputBox = h('div', { class: 'inputbox' }, h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)), pad);

    const statRows = [
      ['MPR', p => mpr(p.st)],
      ['Marks', p => p.st.marks],
      ['Triples', p => p.st.t],
      ['Doubles', p => p.st.d],
      ['9-Marker', p => p.st.nine],
      ['Best Leg', p => p.st.best ?? '–'],
    ];
    if (two) {
      const side = i => h('div', { class: 'col' }, DG.statList(statRows.map(([l, f]) => [l, f(s.players[i])])));
      root.appendChild(h('div', { class: 'game-main two' }, side(0), h('div', { class: 'col' }, info, board, inputBox), side(1)));
    } else {
      root.appendChild(h('div', { class: 'game-main multi' }, h('div', { class: 'col' }, info, board, inputBox), h('div', { class: 'col' }, DG.statTable(s.players, statRows, s.cur))));
    }
  }

  function onKey(e, s, ctx) {
    return DG.dartKey(e, ctx.ui, d => throwDart(s, d, ctx), () => finishVisit(s, ctx), () => ctx.rerender());
  }

  function results(s) {
    const cols = s.players.map(p => p.name);
    const rows = [
      ['Legs gewonnen', ...s.players.map(p => p.st.legsWon)],
      ['MPR', ...s.players.map(p => mpr(p.st))],
      ['Marks', ...s.players.map(p => p.st.marks)],
      ['Triples', ...s.players.map(p => p.st.t)],
      ['Doubles', ...s.players.map(p => p.st.d)],
      ['9-Marker', ...s.players.map(p => p.st.nine)],
      ['Best Leg (Darts)', ...s.players.map(p => p.st.best ?? '–')],
      ['Darts gesamt', ...s.players.map(p => p.st.darts)],
    ];
    return { headline: 'Cricket – Sieger', winner: s.players[s.winner].name, cols, rows };
  }

  DG.register({
    id: 'cricket', title: 'Cricket', sub: '15–20 & Bull schließen', icon: '✕',
    inputModes: ['targets', 'single'], inputModeLabels: { targets: 'Cricket-Felder', single: 'Alle Felder' },
    options: [
      { key: 'mode', label: 'Variante', type: 'pills', choices: [['standard', 'Standard'], ['cutthroat', 'Cut Throat'], ['noscore', 'Ohne Punkte']], def: 'standard',
        hint: o => ({ standard: 'Punkte auf offene Felder bekommst du selbst – gewinnt, wer alles zu hat und vorne liegt.',
          cutthroat: 'Punkte gehen an Gegner, die das Feld noch offen haben – wenigste Punkte gewinnt.',
          noscore: 'Nur schließen – wer zuerst alles zu hat, gewinnt.' })[o.mode] },
      { key: 'legMode', label: 'Legs', type: 'pills', choices: [['first', 'First to'], ['best', 'Best of']], def: 'first' },
      { key: 'legs', label: 'Anzahl Legs', type: 'number', min: 1, max: 15, def: 1 },
      { key: 'roundLimit', label: 'Rundenlimit', type: 'pills', choices: [[0, 'ohne'], [15, '15'], [20, '20'], [25, '25']], def: 20 },
    ],
    create, render, onKey, results,
  });
})();
