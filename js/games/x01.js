/* Dragongames – X01 (501, 301, …) */
'use strict';
(function () {
  const h = DG.h;

  const OUT_LABEL = { double: 'double out', straight: 'straight out', master: 'master out' };

  function startLeg(s) {
    const n = s.players.length;
    s.rest = Array(n).fill(s.opts.start);
    s.opened = Array(n).fill(s.opts.inMode !== 'double');
    s.visits = Array.from({ length: n }, () => []);
    s.legDarts = Array(n).fill(0);
    s.cur = s.legStarter;
    s.visit = [];
  }

  function create(names, opts) {
    const s = {
      game: 'x01', opts, inputMode: 'total',
      players: names.map(name => ({
        name, legs: 0, sets: 0,
        st: { pts: 0, darts: 0, f9pts: 0, f9darts: 0, c100: 0, c140: 0, c171: 0, c180: 0, best: null, hiCo: 0, legsWon: 0, coHit: 0, coTry: 0 },
      })),
      legStarter: 0, legNo: 1, setNo: 1, finished: false, winner: null,
    };
    startLeg(s);
    return s;
  }

  function nextPlayer(s) { s.cur = (s.cur + 1) % s.players.length; s.visit = []; }

  /** Aufnahme verbuchen */
  function recordVisit(s, score, darts, bust, dartList) {
    const p = s.cur, pl = s.players[p], st = pl.st;
    const isF9 = s.visits[p].length < 3;
    const counted = bust ? 0 : score;
    st.pts += counted; st.darts += darts; s.legDarts[p] += darts;
    if (isF9) { st.f9pts += counted; st.f9darts += darts; }
    if (!bust) {
      if (score === 180) st.c180++;
      else if (score >= 171) st.c171++;
      else if (score >= 140) st.c140++;
      else if (score >= 100) st.c100++;
    }
    if (!bust) s.rest[p] -= score;
    s.visits[p].push({ s: score, r: s.rest[p], b: bust, d: dartList ? dartList.map(DG.dartLabel).join(' ') : null });
    DG.say(bust ? 'No Score' : score === 0 ? 'No Score' : score);
    if (s.rest[p] === 0) { legWon(s, score); return; }
    nextPlayer(s);
  }

  function legWon(s, finishScore) {
    const p = s.cur, pl = s.players[p], st = pl.st;
    st.legsWon++;
    st.hiCo = Math.max(st.hiCo, finishScore);
    st.best = st.best === null ? s.legDarts[p] : Math.min(st.best, s.legDarts[p]);
    pl.legs++;
    const needLegs = DG.legsNeeded(s.opts.legMode, s.opts.legs);
    let msg = 'Leg für ' + pl.name + ' (' + s.legDarts[p] + ' Darts)';
    if (pl.legs >= needLegs) {
      if (s.opts.sets > 1) {
        pl.sets++;
        s.players.forEach(x => { x.legs = 0; });
        s.setNo++;
        msg = 'Set für ' + pl.name;
        if (pl.sets >= s.opts.sets) { s.finished = true; s.winner = p; }
      } else { s.finished = true; s.winner = p; }
    }
    if (s.finished) return;
    DG.toast(msg, 'green');
    DG.say('Game shot');
    s.legNo++;
    s.legStarter = (s.legStarter + 1) % s.players.length;
    startLeg(s);
  }

  /* ---------- Eingabe: Aufnahme-Summe ---------- */
  async function submitTotal(s, score, ctx) {
    if (s.finished) return;
    const p = s.cur;
    const r = s.rest[p];
    const res = DG.evalTotal(r, score, s.opts.outMode);
    if (res.error) { DG.toast(res.error); ctx.ui.typed = ''; ctx.rerender(); return; }
    if (res.finish) {
      const min = DG.minCheckoutDarts(r, s.opts.outMode) || 3;
      let darts = 3;
      if (min < 3) {
        const btns = [];
        for (let d = min; d <= 3; d++) btns.push({ label: d + (d === 1 ? ' Dart' : ' Darts'), key: String(d), value: d, cls: 'bigbtn' });
        darts = await DG.modal('Checkout ' + r + '!', 'Mit wie vielen Darts?', btns);
        if (!darts) { ctx.ui.typed = ''; ctx.rerender(); return; }
      }
      ctx.commit(st => { st.opened[p] = true; recordVisit(st, score, darts, false); });
      return;
    }
    ctx.commit(st => {
      if (!st.opened[p] && score > 0) st.opened[p] = true;
      recordVisit(st, score, 3, !!res.bust);
    });
  }

  /* ---------- Eingabe: Einzeldarts ---------- */
  function visitSum(s) { return s.visit.reduce((a, d) => a + d.v, 0); }

  function throwDart(s, dart, ctx) {
    if (s.finished) return;
    ctx.commit(st => {
      const p = st.cur;
      if (!st.opened[p] && dart.m === 2) st.opened[p] = true; // Double In
      const opened = st.opened[p];
      const v = opened ? DG.dartValue(dart) : 0;
      const restNow = st.rest[p] - visitSum(st);
      // Checkout-Versuch zählen (Rest ist mit einem Dart finishbar)
      if (opened && DG.checkout(restNow, st.opts.outMode, 1)) st.players[p].st.coTry++;
      st.visit.push({ m: dart.m, n: dart.n, v });
      const res = opened ? DG.evalDart(restNow, { m: dart.m, n: dart.n }, st.opts.outMode) : { newRest: restNow };
      const list = st.visit.map(d => ({ m: d.m, n: d.n }));
      if (res.bust) { recordVisit(st, visitSum(st), 3, true, list); return; }
      if (res.finish) { st.players[p].st.coHit++; recordVisit(st, visitSum(st), st.visit.length, false, list); return; }
      if (st.visit.length === 3) recordVisit(st, visitSum(st), 3, false, list);
    });
  }
  function endVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => {
      const list = st.visit.map(d => ({ m: d.m, n: d.n }));
      while (list.length < 3) list.push({ m: 0, n: 0 });
      recordVisit(st, visitSum(st), 3, false, list);
    });
  }

  /* ---------- Darstellung ---------- */
  function statRows() {
    return [
      ['Average', p => DG.fmt.avg(p.st.pts, p.st.darts)],
      ['First 9', p => DG.fmt.avg(p.st.f9pts, p.st.f9darts)],
      ['100+', p => p.st.c100],
      ['140+', p => p.st.c140],
      ['171+', p => p.st.c171],
      ['180', p => p.st.c180],
      ['Best Leg', p => p.st.best ?? '–'],
      ['High Finish', p => p.st.hiCo || '–'],
      ['Doppelquote', p => p.st.coTry ? DG.fmt.pct(p.st.coHit, p.st.coTry) : '–'],
    ];
  }

  function render(s, root, ctx) {
    const n = s.players.length;
    const two = n === 2;
    const ui = ctx.ui;
    const out = s.opts.outMode;

    // To-Go-Karten
    const cards = s.players.map((pl, i) => {
      const active = i === s.cur;
      let rest = s.rest[i];
      let dartsLeft = 3;
      if (active && s.inputMode === 'single') { rest -= visitSum(s); dartsLeft = 3 - s.visit.length; }
      const co = rest <= 170 && s.opened[i] ? DG.checkoutText(rest, out, dartsLeft) : '';
      const setTxt = s.opts.sets > 1 ? ' · Sets: ' + pl.sets : '';
      return h('div', { class: 'togo' + (active ? ' active' : '') + (n > 2 ? ' compact' : '') },
        i === s.legStarter ? h('span', { class: 'dot', title: 'Anwurf' }) : null,
        h('div', { class: 'name' }, pl.name),
        h('div', { class: 'big' }, rest),
        h('div', { class: 'checkout' }, active ? co : ''),
        h('div', { class: 'sub' }, 'Legs: ' + pl.legs + setTxt + ' · Ø ' + DG.fmt.avg(pl.st.pts, pl.st.darts) + (s.opened[i] ? '' : ' · noch nicht eröffnet')));
    });
    root.appendChild(h('div', { class: 'togo-row' }, cards));

    // Info / Anwurf
    const legsTxt = (s.opts.legMode === 'best' ? 'best of ' : 'first to ') + s.opts.legs + ' legs' + (s.opts.sets > 1 ? ', first to ' + s.opts.sets + ' sets' : '');
    const canChangeStarter = n > 1 && s.visits.every(v => v.length === 0) && s.visit.length === 0;
    const changeStarter = d => ctx.commit(st => { st.legStarter = (st.legStarter + d + n) % n; st.cur = st.legStarter; });
    const info = h('div', { class: 'info-row' },
      canChangeStarter ? h('button', { class: 'info-pill', onclick: () => changeStarter(1) }, '‹ Anwurf ändern ›') : h('div', { class: 'info-pill' }, 'Leg ' + s.legNo + (s.opts.sets > 1 ? ' · Set ' + s.setNo : '')),
      h('div', { class: 'info-pill' }, s.opts.start + ' · ' + legsTxt + ' · ' + (s.opts.inMode === 'double' ? 'double in · ' : '') + OUT_LABEL[out]));

    // Wurfprotokoll
    const maxRows = Math.max(...s.visits.map(v => v.length)) + 1;
    const head = [];
    const dcAfter = two ? 0 : -1;
    if (dcAfter === -1) head.push(h('th', null, 'Darts'));
    s.players.forEach((pl, i) => {
      head.push(h('th', { class: 'sc' }, two ? 'Scored' : pl.name), h('th', null, two ? 'To go' : 'Rest'));
      if (i === dcAfter) head.push(h('th', null, ''));
    });
    const rows = [];
    for (let r = 0; r < maxRows; r++) {
      const cells = [];
      const dc = h('td', { class: 'dc' }, (r + 1) * 3);
      if (dcAfter === -1) cells.push(dc);
      s.players.forEach((pl, i) => {
        const v = s.visits[i][r];
        if (v) {
          cells.push(h('td', { class: 'sc' + (v.b ? ' bust' : v.s >= 100 ? ' ton' : ''), title: v.d || '' }, v.s), h('td', null, v.r));
        } else if (i === s.cur && r === s.visits[i].length) {
          const shown = s.inputMode === 'total' ? ui.typed : (s.visit.length ? visitSum(s) : '');
          cells.push(h('td', { class: 'sc cur' }, shown), h('td', { style: 'color:var(--muted)' }, r === 0 ? s.opts.start : ''));
        } else if (r === 0 && s.visits[i].length === 0) {
          cells.push(h('td', { class: 'sc' }, ''), h('td', null, s.opts.start));
        } else cells.push(h('td', { class: 'sc' }, ''), h('td', null, ''));
        if (i === dcAfter) cells.push(dc);
      });
      rows.push(h('tr', null, cells));
    }
    const sheet = h('div', { class: 'sheet' }, h('table', null, h('thead', null, h('tr', null, head)), h('tbody', null, rows)));

    // Eingabe
    const rerender = () => ctx.rerender();
    let inputBox;
    if (s.inputMode === 'total') {
      inputBox = h('div', { class: 'inputbox' },
        h('div', { class: 'input-head' },
          h('div', { class: 'typed' + (ui.typed ? '' : ' empty') }, ui.typed || s.players[s.cur].name + ': Punkte eintippen + Enter')),
        DG.totalPad(ui, sc => submitTotal(s, sc, ctx), rerender));
    } else {
      const slots = [0, 1, 2].map(k => {
        const d = s.visit[k];
        if (d) return h('div', { class: 'vdart filled' }, DG.dartLabel(d));
        if (k === s.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
        return h('div', { class: 'vdart' }, '');
      });
      inputBox = h('div', { class: 'inputbox' },
        h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)),
        DG.dartPad(ui, { onDart: d => throwDart(s, d, ctx), onEnd: () => endVisit(s, ctx), endLabel: 'Rest = daneben' }, rerender));
    }

    const center = h('div', { class: 'col' }, info, sheet, inputBox);
    if (two) {
      const side = i => h('div', { class: 'col' }, DG.statList(statRows().map(([l, f]) => [l, f(s.players[i])])));
      root.appendChild(h('div', { class: 'game-main two' }, side(0), center, side(1)));
    } else {
      root.appendChild(h('div', { class: 'game-main multi' }, center, h('div', { class: 'col' }, DG.statTable(s.players, statRows(), s.cur))));
    }
  }

  function onKey(e, s, ctx) {
    const ui = ctx.ui;
    if (s.inputMode === 'single') return DG.dartKey(e, ui, d => throwDart(s, d, ctx), () => endVisit(s, ctx), () => ctx.rerender());
    if (/^[0-9]$/.test(e.key)) { if (ui.typed.length < 3) { ui.typed = (ui.typed === '0' ? '' : ui.typed) + e.key; ctx.rerender(); } return true; }
    if (e.key === 'Backspace') { ui.typed = ui.typed.slice(0, -1); ctx.rerender(); return true; }
    if (e.key === 'Enter') { submitTotal(s, ui.typed === '' ? 0 : parseInt(ui.typed, 10), ctx); return true; }
    return false;
  }

  function results(s) {
    const rows = statRows().map(([l, f]) => [l, ...s.players.map(p => f(p))]);
    rows.unshift(['Legs gewonnen', ...s.players.map(p => p.st.legsWon)]);
    if (s.opts.sets > 1) rows.unshift(['Sets', ...s.players.map(p => p.sets)]);
    rows.push(['Darts gesamt', ...s.players.map(p => p.st.darts)]);
    return { headline: s.opts.start + ' – Sieger', winner: s.players[s.winner].name, cols: s.players.map(p => p.name), rows };
  }

  DG.register({
    id: 'x01', title: 'X01', sub: '501 · 301 · frei wählbar', icon: '🎯',
    inputModes: ['total', 'single'], inputModeLabels: { total: 'Aufnahme', single: 'Einzeldarts' },
    canToggleInput: s => s.visit.length === 0,
    options: [
      { key: 'start', label: 'Startpunkte', type: 'pills', choices: [[101, '101'], [170, '170'], [301, '301'], [501, '501'], [701, '701'], [901, '901']], def: 501 },
      { key: 'inMode', label: 'In', type: 'pills', choices: [['straight', 'straight in'], ['double', 'double in']], def: 'straight',
        hint: o => o.inMode === 'double' ? 'Double In wird bei Einzeldart-Eingabe geprüft; bei Aufnahme-Eingabe 0 eintippen, solange nicht eröffnet.' : '' },
      { key: 'outMode', label: 'Out', type: 'pills', choices: [['straight', 'straight out'], ['double', 'double out'], ['master', 'master out']], def: 'double' },
      { key: 'legMode', label: 'Legs', type: 'pills', choices: [['first', 'First to'], ['best', 'Best of']], def: 'first' },
      { key: 'legs', label: 'Anzahl Legs', type: 'number', min: 1, max: 21, def: 3 },
      { key: 'sets', label: 'Sets (1 = ohne Sets)', type: 'number', min: 1, max: 9, def: 1 },
    ],
    create, render, onKey, results,
  });
})();
