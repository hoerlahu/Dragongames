/* Dragongames – Checkout-Training (121 / 170 und frei wählbar) */
'use strict';
(function () {
  const h = DG.h;

  function newAttempt(s) {
    const p = s.players[s.cur];
    s.att = { target: p.target, rest: p.target, used: 0, visit: [], visits: [] };
  }

  function create(names, opts) {
    const s = {
      game: 'checkout', opts, inputMode: 'total',
      players: names.map(name => ({ name, target: opts.start, tries: 0, ok: 0, hi: 0, coDarts: 0, log: [] })),
      cur: 0, finished: false, winner: null,
    };
    newAttempt(s);
    return s;
  }

  const dartsLeft = s => s.opts.darts - s.att.used;

  function endAttempt(s, success) {
    const p = s.players[s.cur];
    const a = s.att;
    p.tries++;
    p.log.push({ t: a.target, ok: success, d: a.used });
    if (success) {
      p.ok++; p.coDarts += a.used; p.hi = Math.max(p.hi, a.target);
      DG.toast('✓ ' + a.target + ' gecheckt mit ' + a.used + ' Darts', 'green');
      DG.say('Check');
      const step = s.opts.dir === 'down' ? -1 : 1;
      p.target = Math.max(2, Math.min(170, p.target + step));
    } else {
      if (s.opts.onFail === 'start') p.target = s.opts.start;
      else if (s.opts.onFail === 'back') p.target = Math.max(2, Math.min(170, p.target + (s.opts.dir === 'down' ? 1 : -1)));
    }
    // nächster Spieler mit offenen Versuchen
    const n = s.players.length;
    for (let k = 1; k <= n; k++) {
      const idx = (s.cur + k) % n;
      if (s.players[idx].tries < s.opts.tries) { s.cur = idx; newAttempt(s); return; }
    }
    s.finished = true;
    let best = 0;
    s.players.forEach((q, i) => {
      const b = s.players[best];
      if (q.ok > b.ok || (q.ok === b.ok && q.hi > b.hi)) best = i;
    });
    s.winner = best;
  }

  /** Aufnahme (Summe) verbuchen */
  function applyVisit(s, score, darts, bust, list) {
    const a = s.att;
    a.used += darts;
    if (!bust) a.rest -= score;
    a.visits.push({ s: score, b: bust, r: a.rest, d: list ? list.map(DG.dartLabel).join(' ') : null });
    a.visit = [];
    if (a.rest === 0) { endAttempt(s, true); return; }
    if (a.used >= s.opts.darts) endAttempt(s, false);
  }

  async function submitTotal(s, score, ctx) {
    if (s.finished) return;
    const a = s.att;
    const res = DG.evalTotal(a.rest, score, s.opts.outMode);
    if (res.error) { DG.toast(res.error); ctx.ui.typed = ''; ctx.rerender(); return; }
    if (res.finish) {
      const min = DG.minCheckoutDarts(a.rest, s.opts.outMode) || 3;
      const maxD = Math.min(3, dartsLeft(s));
      let darts = maxD;
      if (min < maxD) {
        const btns = [];
        for (let d = min; d <= maxD; d++) btns.push({ label: d + (d === 1 ? ' Dart' : ' Darts'), key: String(d), alt: 'F' + (9 + d), value: d, cls: 'bigbtn' });
        darts = await DG.modal('Checkout ' + a.rest + '!', 'Mit wie vielen Darts in dieser Aufnahme?', btns);
        if (!darts) { ctx.ui.typed = ''; ctx.rerender(); return; }
      }
      ctx.commit(st => applyVisit(st, score, darts, false));
      return;
    }
    ctx.commit(st => applyVisit(st, score, Math.min(3, dartsLeft(st)), !!res.bust));
  }

  function checkOpts(s, ctx) {
    return {
      rest: s.att.rest, outMode: s.opts.outMode, maxDarts: Math.min(3, dartsLeft(s)),
      onCheck: n => { if (!s.finished) ctx.commit(st => applyVisit(st, st.att.rest, n, false)); },
      onRest: v => submitTotal(s, s.att.rest - v, ctx),
    };
  }

  const visitSum = s => s.att.visit.reduce((x, d) => x + DG.dartValue(d), 0);
  function throwDart(s, dart, ctx) {
    if (s.finished) return;
    ctx.commit(st => {
      const a = st.att;
      const restNow = a.rest - visitSum(st);
      a.visit.push(dart);
      const res = DG.evalDart(restNow, dart, st.opts.outMode);
      const n = a.visit.length;
      if (res.bust) { applyVisit(st, visitSum(st), Math.min(3, dartsLeft(st)), true, a.visit); return; }
      if (res.finish) { applyVisit(st, visitSum(st), n, false, a.visit); return; }
      if (n === 3 || n >= dartsLeft(st)) applyVisit(st, visitSum(st), n, false, a.visit);
    });
  }
  function endVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => applyVisit(st, visitSum(st), Math.min(3, dartsLeft(st)), false, st.att.visit));
  }

  function render(s, root, ctx) {
    const n = s.players.length, ui = ctx.ui, a = s.att;
    const restShown = a.rest - (s.inputMode === 'single' ? visitSum(s) : 0);
    const inVisit = Math.min(3, dartsLeft(s)) - (s.inputMode === 'single' ? a.visit.length : 0);

    root.appendChild(h('div', { class: 'togo-row' }, s.players.map((p, i) => {
      const active = i === s.cur;
      return h('div', { class: 'togo' + (active ? ' active' : '') + (n > 2 ? ' compact' : '') + (p.tries >= s.opts.tries ? ' done' : '') },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'big' }, active ? restShown : p.target),
        h('div', { class: 'checkout' }, active ? DG.checkoutText(restShown, s.opts.outMode, Math.max(1, inVisit)) : ''),
        h('div', { class: 'sub' }, (active ? 'Ziel ' + a.target + ' · ' : 'nächstes Ziel · ') + 'Versuch ' + Math.min(p.tries + 1, s.opts.tries) + '/' + s.opts.tries + ' · ✓ ' + p.ok));
    })));

    const info = h('div', { class: 'info-row' },
      h('div', { class: 'info-pill' }, 'Ziel ' + a.target + ' · noch ' + dartsLeft(s) + ' von ' + s.opts.darts + ' Darts'),
      h('div', { class: 'info-pill' }, s.title + ' · ' + (s.opts.dir === 'down' ? 'abwärts' : 'aufwärts') + ' · ' + s.opts.outMode + ' out'));

    // Protokoll: Zeilen = Versuche
    const rows = [];
    for (let r = 0; r < s.opts.tries; r++) {
      rows.push(h('tr', null, h('td', { class: 'dc' }, r + 1), s.players.map((p, i) => {
        const e = p.log[r];
        if (e) return h('td', { class: 'sc' + (e.ok ? ' ton' : ' bust'), style: 'text-decoration:none' }, e.t + (e.ok ? ' ✓ ' + e.d + 'D' : ' ✗'));
        if (i === s.cur && r === p.tries) {
          const vs = a.visits.map(v => v.b ? 'Bust' : v.s).join(' · ');
          return h('td', { class: 'sc cur' }, a.target + (vs ? ' → ' + vs : '') + (s.inputMode === 'total' && ui.typed ? ' · ' + ui.typed : ''));
        }
        return h('td', { class: 'sc' }, '');
      })));
    }
    const sheet = h('div', { class: 'sheet' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, '#'), s.players.map(p => h('th', { class: 'sc' }, p.name)))),
      h('tbody', null, rows)));

    let inputBox;
    if (s.inputMode === 'total') {
      inputBox = h('div', { class: 'inputbox' },
        h('div', { class: 'input-head' }, h('div', { class: 'typed' + (ui.typed ? '' : ' empty') }, ui.typed || s.players[s.cur].name + ': Punkte der Aufnahme + Enter')),
        DG.totalPad(ui, sc => submitTotal(s, sc, ctx), () => ctx.rerender(), checkOpts(s, ctx)));
    } else {
      const slots = [0, 1, 2].map(k => {
        const d = a.visit[k];
        if (d) return h('div', { class: 'vdart filled' }, DG.dartLabel(d));
        if (k === a.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
        return h('div', { class: 'vdart' }, '');
      });
      inputBox = h('div', { class: 'inputbox' }, h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)),
        DG.dartPad(ui, { onDart: d => throwDart(s, d, ctx), onEnd: () => endVisit(s, ctx), endLabel: 'Rest = daneben' }, () => ctx.rerender()));
    }

    root.appendChild(h('div', { class: 'game-main multi' },
      h('div', { class: 'col' }, info, sheet, inputBox),
      h('div', { class: 'col' }, DG.statTable(s.players, statRows(s), s.cur))));
  }

  function statRows(s) {
    return [
      ['Erfolge', p => p.ok + ' / ' + p.tries],
      ['Quote', p => DG.fmt.pct(p.ok, p.tries)],
      ['Höchstes Ziel', p => p.hi || '–'],
      ['Ø Darts/Checkout', p => p.ok ? (p.coDarts / p.ok).toFixed(1) : '–'],
      ['Nächstes Ziel', p => p.tries >= s.opts.tries ? 'fertig' : p.target],
    ];
  }

  function onKey(e, s, ctx) {
    const ui = ctx.ui;
    if (s.inputMode === 'single') return DG.dartKey(e, ui, d => throwDart(s, d, ctx), () => endVisit(s, ctx), () => ctx.rerender());
    return DG.totalKey(e, ui, sc => submitTotal(s, sc, ctx), () => ctx.rerender(), checkOpts(s, ctx));
  }

  function results(s) {
    const rows = statRows(s).slice(0, 4).map(([l, f]) => [l, ...s.players.map(p => f(p))]);
    rows.push(['Verlauf', ...s.players.map(p => p.log.map(e => e.t + (e.ok ? '✓' : '✗')).join(' '))]);
    return { headline: s.title + ' – meiste Checkouts', winner: s.players.length > 1 ? s.players[s.winner].name : null, cols: s.players.map(p => p.name), rows };
  }

  function makeGame(id, title, sub, start, dir) {
    DG.register({
      id, title, sub, icon: '✓',
      inputModes: ['total', 'single'], inputModeLabels: { total: 'Aufnahme', single: 'Einzeldarts' },
      canToggleInput: s => s.att.visit.length === 0,
      options: [
        { key: 'start', label: 'Startziel (2–170)', type: 'number', min: 2, max: 170, def: start },
        { key: 'dir', label: 'Bei Erfolg', type: 'pills', choices: [['up', 'Ziel +1'], ['down', 'Ziel −1']], def: dir },
        { key: 'onFail', label: 'Bei Misserfolg', type: 'pills', choices: [['stay', 'Ziel bleibt'], ['back', 'eins zurück'], ['start', 'zurück auf Start']], def: 'stay' },
        { key: 'darts', label: 'Darts pro Versuch', type: 'pills', choices: [[3, '3'], [6, '6'], [9, '9'], [12, '12']], def: 9 },
        { key: 'tries', label: 'Versuche pro Spieler', type: 'pills', choices: [[5, '5'], [10, '10'], [15, '15'], [20, '20']], def: 10 },
        { key: 'outMode', label: 'Out', type: 'pills', choices: [['double', 'double out'], ['master', 'master out'], ['straight', 'straight out']], def: 'double' },
      ],
      rulesText: 'Jeder Spieler spielt seinen kompletten Versuch am Stück, dann ist der Nächste dran. Bust beendet nur die Aufnahme, nicht den Versuch. Wer die meisten Checkouts schafft, gewinnt.',
      create(names, opts) { const s = create(names, opts); s.title = title; return s; },
      render, onKey, results,
    });
  }

  makeGame('co121', '121', 'Checkout-Leiter ab 121', 121, 'up');
  makeGame('co170', '170', 'Checkout-Training ab 170', 170, 'down');
})();
