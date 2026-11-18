/* Dragongames – Random Double Challenge
 * Feste Anzahl Aufnahmen auf zufällige Doppel. Jeder Treffer = 1 Punkt und es geht zum nächsten
 * zufälligen Doppel; bei Fehlwurf bleibt das Doppel. Alle Spieler bekommen dieselbe Doppel-Folge. */
'use strict';
(function () {
  const h = DG.h;
  const dLabel = t => t === 25 ? 'Bull' : 'D' + t;

  function makeSequence(len, bull) {
    const pool = [];
    for (let i = 1; i <= 20; i++) pool.push(i);
    if (bull) pool.push(25);
    const seq = [];
    let last = null;
    while (seq.length < len) {
      const v = pool[Math.floor(Math.random() * pool.length)];
      if (v === last) continue;
      seq.push(v); last = v;
    }
    return seq;
  }

  function create(names, opts) {
    return {
      game: 'rnddouble', opts, inputMode: 'quick',
      seq: makeSequence(opts.visits * 3 + 1, opts.bull),
      players: names.map(name => ({ name, hits: 0, darts: 0, visits: [] })),
      cur: 0, visit: [], finished: false, winner: null,
    };
  }

  const target = (s, p) => s.seq[p.hits];

  function applyDart(s, hit) {
    const p = s.players[s.cur];
    const t = target(s, p);
    p.darts++;
    if (hit) p.hits++;
    s.visit.push({ t, hit });
    if (s.visit.length === 3) endVisit(s);
  }

  function endVisit(s) {
    const p = s.players[s.cur];
    p.visits.push(s.visit);
    s.visit = [];
    s.cur++;
    if (s.cur >= s.players.length) {
      s.cur = 0;
      if (s.players[0].visits.length >= s.opts.visits) {
        s.finished = true;
        let best = 0;
        s.players.forEach((q, i) => { if (q.hits > s.players[best].hits) best = i; });
        s.winner = best;
      }
    }
  }

  function hitDart(s, hit, ctx) { if (!s.finished) ctx.commit(st => applyDart(st, hit)); }
  function fieldDart(s, d, ctx) {
    const t = target(s, s.players[s.cur]);
    hitDart(s, d.m === 2 && d.n === t, ctx);
  }
  function finishVisit(s, ctx) {
    if (s.finished) return;
    ctx.commit(st => { const need = 3 - st.visit.length; for (let i = 0; i < need && !st.finished; i++) applyDart(st, false); });
  }

  function render(s, root, ctx) {
    const n = s.players.length, ui = ctx.ui;
    const cp = s.players[s.cur];
    const t = target(s, cp);

    root.appendChild(h('div', { class: 'togo-row' }, s.players.map((p, i) =>
      h('div', { class: 'togo' + (i === s.cur ? ' active' : '') + (n > 2 ? ' compact' : '') },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'big' }, p.hits),
        h('div', { class: 'checkout' }, i === s.cur ? 'Ziel ' + dLabel(t) : ''),
        h('div', { class: 'sub' }, 'Aufnahme ' + Math.min(p.visits.length + 1, s.opts.visits) + '/' + s.opts.visits + ' · Quote ' + DG.fmt.pct(p.hits, p.darts))))));

    const info = h('div', { class: 'info-row' },
      h('div', { class: 'info-pill' }, cp.name + ': Aufnahme ' + (cp.visits.length + 1) + ' von ' + s.opts.visits + ' · Ziel ' + dLabel(t)),
      h('div', { class: 'info-pill' }, 'Treffer = 1 Punkt + neues Doppel · daneben = Doppel bleibt'));

    const rows = [];
    for (let r = 0; r < s.opts.visits; r++) {
      if (r > cp.visits.length) break;
      rows.push(h('tr', null, h('td', { class: 'dc' }, r + 1), s.players.map((p, i) => {
        const v = p.visits[r];
        const show = list => list.map(d => h('span', { style: 'margin:0 .2em;' + (d.hit ? 'color:var(--accent)' : 'color:var(--muted);font-weight:500') }, dLabel(d.t) + (d.hit ? '✓' : '✗')));
        if (v) return h('td', { class: 'sc', style: 'font-size:clamp(14px, min(1.4vw, 2.6vh), 22px)' }, show(v));
        if (i === s.cur && r === p.visits.length) return h('td', { class: 'sc cur', style: 'font-size:clamp(14px, min(1.4vw, 2.6vh), 22px)' }, show(s.visit));
        return h('td', { class: 'sc' }, '');
      })));
    }
    const sheet = h('div', { class: 'sheet' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, '#'), s.players.map(p => h('th', { class: 'sc' }, p.name)))), h('tbody', null, rows)));

    const slots = [0, 1, 2].map(k => {
      const v = s.visit[k];
      if (v) return h('div', { class: 'vdart filled' + (v.hit ? ' hit' : '') }, dLabel(v.t) + (v.hit ? ' ✓' : ' ✗'));
      if (k === s.visit.length && (ui.dbuf || ui.mult > 1)) return h('div', { class: 'vdart filled', style: 'opacity:.6' }, DG.dartBufLabel(ui));
      return h('div', { class: 'vdart' }, '');
    });
    const pad = s.inputMode === 'quick'
      ? h('div', null,
        h('div', { class: 'pad wide' },
          h('button', { class: 'key big green span2', onclick: () => hitDart(s, true, ctx) }, 'Treffer ' + dLabel(t), h('span', { class: 'kbd' }, '1 / Leer')),
          h('button', { class: 'key big red span2', onclick: () => hitDart(s, false, ctx) }, 'Daneben', h('span', { class: 'kbd' }, '0'))),
        h('div', { class: 'pad wide', style: 'margin-top:6px' },
          h('button', { class: 'key small dim span2', onclick: () => finishVisit(s, ctx) }, 'Rest = daneben', h('span', { class: 'kbd' }, 'Enter'))))
      : DG.dartPad(ui, { onDart: d => fieldDart(s, d, ctx), onEnd: () => finishVisit(s, ctx), endLabel: 'Rest = daneben' }, () => ctx.rerender());
    const inputBox = h('div', { class: 'inputbox' }, h('div', { class: 'input-head' }, h('div', { class: 'visit-darts' }, slots)), pad);

    const statRows = [
      ['Punkte (Treffer)', p => p.hits],
      ['Darts', p => p.darts],
      ['Doppelquote', p => DG.fmt.pct(p.hits, p.darts)],
      ['Aufnahmen', p => p.visits.length + ' / ' + s.opts.visits],
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
    const order = s.players.map((p, i) => i).sort((a, b) => s.players[b].hits - s.players[a].hits);
    const rows = order.map((i, rank) => {
      const p = s.players[i];
      return [(rank + 1) + '. ' + p.name, p.hits, p.darts, DG.fmt.pct(p.hits, p.darts)];
    });
    return { headline: 'Random Double Challenge – Sieger', winner: s.players[s.winner].name, cols: ['Punkte', 'Darts', 'Doppelquote'], rows };
  }

  DG.register({
    id: 'rnddouble', title: 'Random Doubles', sub: 'zufällige Doppel – jeder Treffer zählt', icon: '🎲',
    inputModes: ['quick', 'single'], inputModeLabels: { quick: 'Treffer/Daneben', single: 'Einzeldarts' },
    canToggleInput: () => true,
    options: [
      { key: 'visits', label: 'Aufnahmen pro Spieler', type: 'pills', choices: [[5, '5'], [10, '10'], [15, '15'], [20, '20']], def: 10 },
      { key: 'bull', label: 'Bull als mögliches Ziel', type: 'pills', choices: [[false, 'nein'], [true, 'ja']], def: false },
    ],
    rulesText: 'Es wird ein zufälliges Doppel vorgegeben. Jeder Treffer zählt einen Punkt und es geht mit dem nächsten zufälligen Doppel weiter; bei einem Fehlwurf bleibt das Doppel. Alle Spieler bekommen dieselbe Doppel-Folge.',
    create, render, onKey, results,
  });
})();
