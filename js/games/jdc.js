/* Dragongames – JDC Challenge (Junior Darts Corporation)
 * Teil 1: Shanghai 10–15 (3 Darts je Zahl), Teil 2: D1–D20 + Bull (1 Dart je Doppel, 50 Punkte, Bull 100),
 * Teil 3: Shanghai 15–20. Shanghai = Single + Double + Triple der Zahl in einer Aufnahme → +100 Bonus. */
'use strict';
(function () {
  const h = DG.h;

  function buildSteps() {
    const steps = [];
    for (let n = 10; n <= 15; n++) steps.push({ sec: 1, type: 'sh', n });
    const dbl = [];
    for (let i = 1; i <= 20; i++) dbl.push(i);
    dbl.push(25);
    for (let i = 0; i < dbl.length; i += 3) steps.push({ sec: 2, type: 'dbl', list: dbl.slice(i, i + 3) });
    for (let n = 15; n <= 20; n++) steps.push({ sec: 3, type: 'sh', n });
    return steps;
  }
  const LEVELS = [[850, 'Schwarz', '#000'], [700, 'Rot', '#e4173a'], [600, 'Blau', '#2563eb'], [450, 'Grün', '#00e028'],
    [300, 'Gelb', '#facc15'], [150, 'Lila', '#9333ea'], [0, 'Weiß', '#fff']];
  const level = pts => LEVELS.find(l => pts >= l[0]);
  const dLabel = t => t === 25 ? 'Bull' : 'D' + t;
  const stepLabel = st => st.type === 'sh' ? String(st.n) : st.list.length === 1 ? dLabel(st.list[0]) : dLabel(st.list[0]) + '–' + dLabel(st.list[st.list.length - 1]).replace('D', '');
  const SEC_NAME = { 1: 'Shanghai 10–15', 2: 'Doppel D1–D20 + Bull', 3: 'Shanghai 15–20' };

  function create(names, opts) {
    return {
      game: 'jdc', opts, inputMode: 'quick', steps: buildSteps(),
      players: names.map(name => ({ name, total: 0, sec: [0, 0, 0], hist: [], shanghais: 0, dblHits: 0, darts: 0 })),
      step: 0, cur: 0, visit: [], finished: false, winner: null,
    };
  }

  /** Ziel des nächsten Darts */
  const target = s => {
    const st = s.steps[s.step];
    return st.type === 'sh' ? st.n : st.list[Math.min(s.visit.length, st.list.length - 1)];
  };
  const dartsInStep = st => st.type === 'sh' ? 3 : st.list.length;

  function dartPoints(s, d) {
    const st = s.steps[s.step];
    if (st.type === 'sh') return d.m > 0 && d.n === st.n ? d.m * d.n : 0;
    const t = st.list[s.visit.length];
    if (t === 25) {
      if (d.n === 25 && d.m === 2) return 100;              // Bullseye: 50 + 50 Bonus
      if (d.n === 25 && d.m === 1 && s.opts.outerBull) return 50;
      return 0;
    }
    return d.m === 2 && d.n === t ? 50 : 0;
  }

  function applyDart(s, d) {
    const p = s.players[s.cur];
    const st = s.steps[s.step];
    const pts = dartPoints(s, d);
    p.darts++;
    if (st.type === 'dbl' && pts > 0) p.dblHits++;
    s.visit.push({ m: d.m, n: d.n, pts });
    if (s.visit.length >= dartsInStep(st)) endVisit(s);
  }

  function endVisit(s) {
    const p = s.players[s.cur];
    const st = s.steps[s.step];
    let pts = s.visit.reduce((a, v) => a + v.pts, 0);
    let shanghai = false;
    if (st.type === 'sh') {
      const ms = new Set(s.visit.filter(v => v.pts > 0).map(v => v.m));
      if (ms.has(1) && ms.has(2) && ms.has(3)) { shanghai = true; pts += 100; p.shanghais++; DG.toast('SHANGHAI! ' + p.name + ' +100', 'green'); }
    }
    p.total += pts;
    p.sec[st.sec - 1] += pts;
    p.hist.push({ pts, shanghai, darts: s.visit.map(v => v.pts > 0 ? '●' : '○').join('') });
    s.visit = [];
    s.cur++;
    if (s.cur >= s.players.length) {
      s.cur = 0; s.step++;
      if (s.step >= s.steps.length) {
        s.finished = true;
        let best = 0;
        s.players.forEach((q, i) => { if (q.total > s.players[best].total) best = i; });
        s.winner = best;
      }
    }
  }

  function throwDart(s, d, ctx) { if (!s.finished) ctx.commit(st => applyDart(st, d)); }
  function quick(s, m, ctx) {
    if (s.finished) return;
    const st = s.steps[s.step];
    const t = target(s);
    if (m === 0) return throwDart(s, { m: 0, n: 0 }, ctx);
    if (st.type === 'dbl') {
      if (t === 25 && m === 3) return;
      if (t === 25) return throwDart(s, { m: m === 1 ? 2 : 1, n: 25 }, ctx); // 1 = Bullseye, 2 = Außenbull
      return throwDart(s, { m: 2, n: t }, ctx);
    }
    throwDart(s, { m, n: t }, ctx);
  }
  function finishVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => { const need = dartsInStep(st.steps[st.step]) - st.visit.length; for (let i = 0; i < need && !st.finished; i++) applyDart(st, { m: 0, n: 0 }); });
  }

  function render(s, root, ctx) {
    const n = s.players.length, ui = ctx.ui;
    const st = s.steps[s.step];
    const t = target(s);

    root.appendChild(h('div', { class: 'togo-row' }, s.players.map((p, i) => {
      const lv = level(p.total);
      return h('div', { class: 'togo' + (i === s.cur ? ' active' : '') + (n > 2 ? ' compact' : '') },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'big' }, p.total),
        h('div', { class: 'checkout' }, i === s.cur ? 'Ziel ' + (st.type === 'sh' ? t : dLabel(t)) : ''),
        h('div', { class: 'sub' }, h('span', { class: 'shirt', style: 'background:' + lv[2] }), ' Stufe ' + lv[1] + ' · Shanghais ' + p.shanghais + ' · Doppel ' + p.dblHits + '/21'));
    })));

    const info = h('div', { class: 'info-row' },
      h('div', { class: 'info-pill' }, 'Teil ' + st.sec + ' · ' + SEC_NAME[st.sec]),
      h('div', { class: 'info-pill' }, st.type === 'sh'
        ? 'Zahl ' + st.n + ' · S/D/T zählen ×1/×2/×3 · Shanghai +100'
        : 'je 1 Dart: ' + st.list.map(dLabel).join(', ') + ' · Doppel 50, Bull 100'));

    const rows = s.steps.map((stp, r) => {
      if (r > s.step) return null;
      return h('tr', null, h('td', { class: 'dc', style: 'width:96px;white-space:nowrap' }, stepLabel(stp)), s.players.map((p, i) => {
        const e = p.hist[r];
        if (e) return h('td', { class: 'sc' }, e.shanghai ? h('span', { class: 'bubble' }, e.pts) : e.pts,
          h('span', { style: 'font-size:.5em;color:var(--muted);margin-left:.4em' }, e.darts));
        if (i === s.cur && r === s.step) return h('td', { class: 'sc cur' }, s.visit.map(v => v.pts > 0 ? '●' : '○').join(''));
        return h('td', { class: 'sc' }, '');
      }));
    });
    const sheet = h('div', { class: 'sheet' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Ziel'), s.players.map(p => h('th', { class: 'sc' }, p.name)))), h('tbody', null, rows)));

    const slots = [0, 1, 2].map(k => {
      const v = s.visit[k];
      if (k >= dartsInStep(st)) return h('div', { class: 'vdart', style: 'opacity:.25' }, '');
      if (v) return h('div', { class: 'vdart filled' + (v.pts ? ' hit' : '') }, v.pts ? DG.dartLabel(v) : '–');
      if (k === s.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
      return h('div', { class: 'vdart' }, st.type === 'dbl' ? dLabel(st.list[k]) : '');
    });

    let pad;
    if (s.inputMode === 'quick') {
      let btns;
      if (st.type === 'sh') btns = [
        h('button', { class: 'key big green', onclick: () => quick(s, 1, ctx) }, 'Single ' + t, h('span', { class: 'kbd' }, '1')),
        h('button', { class: 'key big green', onclick: () => quick(s, 2, ctx) }, 'Double', h('span', { class: 'kbd' }, '2')),
        h('button', { class: 'key big green', onclick: () => quick(s, 3, ctx) }, 'Triple', h('span', { class: 'kbd' }, '3')),
        h('button', { class: 'key big red', onclick: () => quick(s, 0, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))];
      else if (t === 25) btns = [
        h('button', { class: 'key big green' + (s.opts.outerBull ? '' : ' span2'), onclick: () => quick(s, 1, ctx) }, 'Bullseye', h('span', { class: 'kbd' }, '1')),
        s.opts.outerBull ? h('button', { class: 'key big green', onclick: () => quick(s, 2, ctx) }, 'Außenbull', h('span', { class: 'kbd' }, '2')) : null,
        h('button', { class: 'key big red span2', onclick: () => quick(s, 0, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))];
      else btns = [
        h('button', { class: 'key big green span2', onclick: () => quick(s, 1, ctx) }, 'Treffer ' + dLabel(t), h('span', { class: 'kbd' }, '1 / Leer')),
        h('button', { class: 'key big red span2', onclick: () => quick(s, 0, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))];
      pad = h('div', null, h('div', { class: 'pad wide' }, btns),
        h('div', { class: 'pad wide', style: 'margin-top:6px' }, h('button', { class: 'key small dim span2', onclick: () => finishVisit(s, ctx) }, 'Rest = daneben', h('span', { class: 'kbd' }, 'Enter'))));
    } else {
      pad = DG.dartPad(ui, { onDart: d => throwDart(s, d, ctx), onEnd: () => finishVisit(s, ctx), endLabel: 'Rest = daneben' }, () => ctx.rerender());
    }
    const inputBox = h('div', { class: 'inputbox' }, h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)), pad);

    root.appendChild(h('div', { class: 'game-main multi' },
      h('div', { class: 'col' }, info, sheet, inputBox),
      h('div', { class: 'col' }, DG.statTable(s.players, statRows(), s.cur))));
  }

  function statRows() {
    return [
      ['Gesamt', p => p.total],
      ['Teil 1 (10–15)', p => p.sec[0]],
      ['Teil 2 (Doppel)', p => p.sec[1]],
      ['Teil 3 (15–20)', p => p.sec[2]],
      ['Doppel getroffen', p => p.dblHits + ' / 21'],
      ['Shanghais', p => p.shanghais],
      ['Stufe', p => level(p.total)[1]],
    ];
  }

  function onKey(e, s, ctx) {
    if (s.inputMode === 'quick') {
      const k = e.key;
      if (k === '0') { quick(s, 0, ctx); return true; }
      if (k === '1' || k === ' ') { quick(s, 1, ctx); return true; }
      if (k === '2' || k === '3') { quick(s, +k, ctx); return true; }
      if (k === 'Enter') { finishVisit(s, ctx); return true; }
      return false;
    }
    return DG.dartKey(e, ctx.ui, d => throwDart(s, d, ctx), () => finishVisit(s, ctx), () => ctx.rerender());
  }

  function results(s) {
    const rows = statRows().map(([l, f]) => [l, ...s.players.map(p => f(p))]);
    return { headline: 'JDC Challenge – Sieger', winner: s.players[s.winner].name, cols: s.players.map(p => p.name), rows };
  }

  DG.register({
    id: 'jdc', title: 'JDC Challenge', sub: 'Shanghai · Doppel · Shanghai', icon: '🏅',
    inputModes: ['quick', 'single'], inputModeLabels: { quick: 'Schnell', single: 'Einzeldarts' },
    canToggleInput: () => true,
    options: [
      { key: 'outerBull', label: 'Außenbull (25) im Doppel-Teil', type: 'pills', choices: [[false, 'zählt nicht'], [true, 'zählt 50']], def: false },
    ],
    rulesText: 'Teil 1: je 3 Darts auf 10–15, Treffer zählen Single/Double/Triple ×1/×2/×3; Single+Double+Triple derselben Zahl in einer Aufnahme = Shanghai +100. Teil 2: je 1 Dart auf D1–D20 und Bull – jedes Doppel 50, Bullseye 100. Teil 3 wie Teil 1 auf 15–20. Stufen: Weiß, Lila ab 150, Gelb ab 300, Grün ab 450, Blau ab 600, Rot ab 700, Schwarz ab 850.',
    create, render, onKey, results,
  });
})();
