/* Dragongames – Bob's 27 (Doppel-Training nach Bob Anderson) */
'use strict';
(function () {
  const h = DG.h;
  const label = t => t === 25 ? 'Bull' : 'D' + t;
  const worth = t => t * 2; // Wert eines Treffers (Bull = 50)

  function create(names, opts) {
    const targets = [];
    for (let i = 1; i <= 20; i++) targets.push(i);
    if (opts.bull) targets.push(25);
    return {
      game: 'bobs27', opts, inputMode: 'quick', targets,
      players: names.map(name => ({ name, score: 27, best: 27, out: false, outAt: null, darts: 0, hits: 0, rounds: [] })),
      round: 0, cur: 0, visit: [], finished: false, winner: null,
    };
  }

  const alive = s => s.players.map((p, i) => i).filter(i => !s.players[i].out);

  function isOut(s, score) {
    if (s.opts.outRule === 'never') return false;
    return s.opts.outRule === 'zero' ? score <= 0 : score < 0;
  }

  function applyDart(s, hit) {
    const p = s.players[s.cur];
    p.darts++;
    if (hit) p.hits++;
    s.visit.push(hit);
    if (s.visit.length === 3) endVisit(s);
  }

  function endVisit(s) {
    const p = s.players[s.cur];
    const t = s.targets[s.round];
    const hits = s.visit.filter(Boolean).length;
    const delta = hits ? hits * worth(t) : -worth(t);
    p.score += delta;
    p.best = Math.max(p.best, p.score);
    p.rounds.push({ t, hits, delta, score: p.score });
    if (isOut(s, p.score)) { p.out = true; p.outAt = t; DG.toast(p.name + ' ist raus (' + p.score + ')'); }
    if (hits === 3) DG.toast(p.name + ': 3 Treffer auf ' + label(t) + '!', 'green');
    s.visit = [];
    // nächster aktiver Spieler in dieser Runde
    const n = s.players.length;
    for (let k = s.cur + 1; k < n; k++) if (!s.players[k].out) { s.cur = k; return; }
    // Runde vorbei
    s.round++;
    const left = alive(s);
    if (s.round >= s.targets.length || left.length === 0) { finish(s); return; }
    s.cur = left[0];
  }

  function finish(s) {
    s.finished = true;
    let best = 0;
    s.players.forEach((p, i) => { if (rankKey(p) > rankKey(s.players[best])) best = i; });
    s.winner = best;
  }
  // Rangfolge: wer durchkommt vor dem, der rausfliegt; dann Punkte
  const rankKey = p => (p.out ? 0 : 100000) + (p.out ? p.rounds.length * 1000 : 0) + p.score;

  function hitDart(s, hit, ctx) { if (!s.finished) ctx.commit(st => applyDart(st, hit)); }
  function fieldDart(s, d, ctx) {
    const t = s.targets[s.round];
    hitDart(s, d.m === 2 && d.n === t, ctx);
  }
  function finishVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => { const need = 3 - st.visit.length; for (let i = 0; i < need && !st.finished; i++) applyDart(st, false); });
  }

  function render(s, root, ctx) {
    const n = s.players.length, ui = ctx.ui;
    const t = s.targets[s.round];

    root.appendChild(h('div', { class: 'togo-row' }, s.players.map((p, i) =>
      h('div', { class: 'togo' + (i === s.cur ? ' active' : '') + (n > 2 ? ' compact' : '') + (p.out ? ' done' : '') },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'big' }, p.score),
        h('div', { class: 'checkout' }, i === s.cur ? 'Ziel ' + label(t) : (p.out ? 'raus bei ' + label(p.outAt) : '')),
        h('div', { class: 'sub' }, 'Doppelquote ' + DG.fmt.pct(p.hits, p.darts) + ' · Höchststand ' + p.best)))));

    const info = h('div', { class: 'info-row' },
      h('div', { class: 'info-pill' }, 'Runde ' + (s.round + 1) + ' / ' + s.targets.length + ' · Ziel ' + label(t)),
      h('div', { class: 'info-pill' }, 'Treffer +' + worth(t) + ' · keiner −' + worth(t)));

    // Protokoll: eine Zeile pro Doppel
    const rows = s.targets.slice(0, Math.min(s.targets.length, s.round + 1)).map((tt, r) =>
      h('tr', null, h('td', { class: 'dc' }, label(tt)), s.players.map((p, i) => {
        const e = p.rounds[r];
        if (e) return h('td', { class: 'sc' + (e.hits ? '' : ' bust'), style: 'text-decoration:none' },
          e.hits === 3 ? h('span', { class: 'bubble' }, e.score) : e.score,
          h('span', { style: 'font-size:.5em;color:var(--muted);margin-left:.4em' }, '●'.repeat(e.hits) + '○'.repeat(3 - e.hits)));
        if (i === s.cur && r === s.round) return h('td', { class: 'sc cur' }, s.visit.map(v => v ? '●' : '○').join(''));
        return h('td', { class: 'sc' }, '');
      })));
    const sheet = h('div', { class: 'sheet' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Ziel'), s.players.map(p => h('th', { class: 'sc' }, p.name)))), h('tbody', null, rows)));

    const slots = [0, 1, 2].map(k => {
      const v = s.visit[k];
      if (v !== undefined) return h('div', { class: 'vdart filled' + (v ? ' hit' : '') }, v ? label(t) : '–');
      if (k === s.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
      return h('div', { class: 'vdart' }, '');
    });
    const pad = s.inputMode === 'quick'
      ? h('div', null,
        h('div', { class: 'pad wide' },
          h('button', { class: 'key big green span2', onclick: () => hitDart(s, true, ctx) }, 'Treffer ' + label(t), h('span', { class: 'kbd' }, '1 / Leer')),
          h('button', { class: 'key big red span2', onclick: () => hitDart(s, false, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))),
        h('div', { class: 'pad wide', style: 'margin-top:6px' },
          h('button', { class: 'key small dim span2', onclick: () => finishVisit(s, ctx) }, 'Rest = daneben', h('span', { class: 'kbd' }, 'Enter'))))
      : DG.dartPad(ui, { onDart: d => fieldDart(s, d, ctx), onEnd: () => finishVisit(s, ctx), endLabel: 'Rest = daneben' }, () => ctx.rerender());
    const inputBox = h('div', { class: 'inputbox' }, h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)), pad);

    const statRows = [
      ['Punkte', p => p.score],
      ['Höchststand', p => p.best],
      ['Doppelquote', p => DG.fmt.pct(p.hits, p.darts)],
      ['Treffer / Darts', p => p.hits + ' / ' + p.darts],
      ['Status', p => p.out ? 'raus bei ' + label(p.outAt) : 'im Spiel'],
    ];
    root.appendChild(h('div', { class: 'game-main multi' },
      h('div', { class: 'col' }, info, sheet, inputBox),
      h('div', { class: 'col' }, DG.statTable(s.players, statRows, s.cur))));
  }

  function onKey(e, s, ctx) {
    if (s.inputMode === 'quick') {
      if (e.key === '1' || e.key === ' ') { hitDart(s, true, ctx); return true; }
      if (e.key === '0') { hitDart(s, false, ctx); return true; }
      if (e.key === 'Enter') { finishVisit(s, ctx); return true; }
      return false;
    }
    return DG.dartKey(e, ctx.ui, d => fieldDart(s, d, ctx), () => finishVisit(s, ctx), () => ctx.rerender());
  }

  function results(s) {
    const order = s.players.map((p, i) => i).sort((a, b) => rankKey(s.players[b]) - rankKey(s.players[a]));
    const rows = order.map((i, rank) => {
      const p = s.players[i];
      return [(rank + 1) + '. ' + p.name, p.score, p.best, DG.fmt.pct(p.hits, p.darts), p.out ? 'raus bei ' + label(p.outAt) : 'durchgespielt'];
    });
    return { headline: "Bob's 27 – Sieger", winner: s.players[s.winner].name, cols: ['Punkte', 'Höchststand', 'Doppelquote', 'Status'], rows };
  }

  DG.register({
    id: 'bobs27', title: "Bob's 27", sub: 'Doppel-Training D1–D20 + Bull', icon: '🎯',
    inputModes: ['quick', 'single'], inputModeLabels: { quick: 'Treffer/Daneben', single: 'Einzeldarts' },
    canToggleInput: () => true,
    options: [
      { key: 'bull', label: 'Bull als letztes Ziel', type: 'pills', choices: [[true, 'ja'], [false, 'nein']], def: true },
      { key: 'outRule', label: 'Raus, wenn der Punktestand …', type: 'pills', choices: [['below', 'unter 0 fällt'], ['zero', '0 oder weniger erreicht'], ['never', 'nie – weiterspielen']], def: 'below' },
    ],
    rulesText: 'Start mit 27 Punkten. Pro Runde 3 Darts auf das Doppel (D1, D2 … D20, Bull). Jeder Treffer bringt den Doppelwert, eine Runde ohne Treffer kostet den Doppelwert. Maximal 1437 Punkte (mit Bull).',
    create, render, onKey, results,
  });
})();
