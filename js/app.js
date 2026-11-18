/* Dragongames – App-Steuerung: Menü, Spiel-Setup, Spielablauf, Ergebnis */
'use strict';
(function () {
  const h = DG.h;
  const root = document.getElementById('app');

  const App = DG.app = {
    screen: 'home',
    gameId: null,
    playerCount: 2,
    names: ['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 4', 'Spieler 5', 'Spieler 6', 'Spieler 7', 'Spieler 8'],
    optsByGame: {},
    state: null,
    history: [],
    ui: { typed: '', dbuf: '', mult: 1, sel: null },
    padHidden: false,
  };

  const LOGO = '<img src="img/dartdragons.png" alt="Dartdragons Moosbach">';

  function topbar(extra) {
    return h('div', { class: 'topbar' },
      h('div', { class: 'logo', html: LOGO + '<span>Dragon<b>games</b></span>' }),
      h('div', { class: 'actions' },
        extra,
        h('button', { class: 'pillbtn' + (DG.speech.on ? ' on' : ''), title: 'Score-Ansage', onclick: toggleSpeech }, '🔊 Ansage', App.screen === 'game' ? null : h('span', { class: 'kbd' }, 'F7')),
        h('button', { class: 'pillbtn', title: 'Vollbild', onclick: toggleFullscreen }, '⛶', App.screen === 'game' ? null : h('span', { class: 'kbd' }, 'F8'))));
  }
  function toggleSpeech() { DG.speech.on = !DG.speech.on; DG.toast('Ansage ' + (DG.speech.on ? 'an' : 'aus')); render(); }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  }

  /* ---------- Home ---------- */
  function renderHome() {
    const tiles = DG.gameOrder.map((id, i) => {
      const g = DG.games[id];
      return h('button', { class: 'tile' + (i === 0 ? ' primary' : ''), onclick: () => openSetup(id) },
        h('span', { class: 'fkey' }, 'F' + (i + 1)),
        h('div', { class: 'icon' }, g.icon),
        h('h2', null, g.title),
        h('p', null, g.sub));
    });
    return [topbar(),
      h('div', { class: 'home' },
        h('div', { class: 'home-logo' }, h('img', { src: 'img/dartdragons.png', alt: 'Dartdragons Moosbach' }), h('div', { class: 'claim' }, 'Vereinstraining')),
        h('div', { class: 'tiles' }, tiles),
        h('div', { class: 'footer' }, 'Vereinstraining · alles läuft lokal im Browser · Tastatur: F1–F' + DG.gameOrder.length + ' Spiel wählen'))];
  }

  /* ---------- Setup ---------- */
  function openSetup(id) {
    App.gameId = id; App.screen = 'setup';
    const g = DG.games[id];
    if (!App.optsByGame[id]) {
      const o = {};
      for (const f of g.options) o[f.key] = f.def;
      App.optsByGame[id] = o;
    }
    render();
    setTimeout(() => document.querySelector('.bigbtn')?.focus(), 0);
  }

  function renderSetup() {
    const g = DG.games[App.gameId];
    const opts = App.optsByGame[App.gameId];
    const minP = g.minPlayers || 1;
    if (App.playerCount < minP) App.playerCount = minP;

    const countPills = h('div', { class: 'pills' }, [1, 2, 3, 4, 5, 6, 7, 8].map(n =>
      h('button', { class: 'pill circle' + (n === App.playerCount ? ' on' : ''), disabled: n < minP, onclick: () => { App.playerCount = n; render(); } }, n)));

    const nameRows = [];
    for (let i = 0; i < App.playerCount; i++) {
      nameRows.push(h('div', { class: 'row' },
        h('span', { class: 'pnum' }, i + 1),
        h('input', { class: 'input', value: App.names[i], maxlength: 20, oninput: e => { App.names[i] = e.target.value; } }),
        i > 0 ? h('button', { class: 'pill', title: 'nach oben', onclick: () => { [App.names[i - 1], App.names[i]] = [App.names[i], App.names[i - 1]]; render(); } }, '↑') : h('span', { style: 'width:42px' })));
    }

    const fields = g.options.filter(f => !f.showIf || f.showIf(opts)).map(f => {
      let ctl;
      if (f.type === 'pills') {
        ctl = h('div', { class: 'pills' }, f.choices.map(([v, l]) =>
          h('button', { class: 'pill' + (opts[f.key] === v ? ' on' : ''), onclick: () => { opts[f.key] = v; render(); } }, l)));
      } else if (f.type === 'number') {
        ctl = h('input', { class: 'input num', type: 'number', min: f.min, max: f.max, value: opts[f.key],
          onchange: e => { let v = parseInt(e.target.value, 10); if (isNaN(v)) v = f.def; v = Math.max(f.min, Math.min(f.max, v)); opts[f.key] = v; render(); } });
      }
      return h('div', { class: 'field' }, h('label', { class: 'title' }, f.label), ctl, f.hint ? h('div', { class: 'hint', style: 'margin-top:6px' }, f.hint(opts)) : null);
    });

    return [topbar(),
      h('div', { class: 'screen' },
        h('div', { class: 'screen-title' }, g.title),
        h('div', { class: 'setup' },
          h('div', { class: 'card' }, h('h3', null, 'Spieler'), h('div', { class: 'row' }, countPills), h('div', { class: 'hint', style: 'margin-bottom:10px' }, 'Reihenfolge = Wurfreihenfolge im ersten Leg'), nameRows),
          h('div', { class: 'card' }, h('h3', null, 'Spielformat'), fields, g.rulesText ? h('div', { class: 'hint', style: 'margin-top:8px' }, g.rulesText) : null)),
        h('div', { class: 'bottombar' },
          h('button', { class: 'bigbtn secondary', onclick: goHome }, 'Zurück', h('span', { class: 'kbd' }, 'Esc')),
          h('button', { class: 'bigbtn', onclick: startGame }, 'Spiel starten', h('span', { class: 'kbd' }, 'Enter'))))];
  }

  /* ---------- Spiel ---------- */
  function startGame() {
    const g = DG.games[App.gameId];
    const players = App.names.slice(0, App.playerCount).map((n, i) => (n || '').trim() || 'Spieler ' + (i + 1));
    App.state = g.create(players, { ...App.optsByGame[App.gameId] });
    App.history = [];
    resetUi();
    App.screen = 'game';
    render();
  }
  function resetUi() { App.ui.typed = ''; App.ui.dbuf = ''; App.ui.mult = 1; App.ui.sel = null; }

  const ctx = DG.ctx = {
    get ui() { return App.ui; },
    commit(fn) {
      App.history.push(JSON.stringify(App.state));
      if (App.history.length > 500) App.history.shift();
      fn(App.state);
      resetUi();
      if (App.state.finished) { App.screen = 'result'; }
      render();
    },
    rerender() { render(); },
    undo,
  };

  function undo() {
    if (App.ui.typed || App.ui.dbuf || App.ui.mult !== 1 || App.ui.sel) { resetUi(); render(); return; }
    if (!App.history.length) { DG.toast('Nichts zum Rückgängigmachen'); return; }
    App.state = JSON.parse(App.history.pop());
    resetUi();
    if (App.screen === 'result') App.screen = 'game';
    render();
  }

  async function leaveGame() {
    const v = await DG.modal('Spiel verlassen?', 'Der Spielstand geht verloren.', [
      { label: 'Weiterspielen', key: 'Escape', value: false },
      { label: 'Verlassen', key: 'Enter', value: true, cls: 'bigbtn' }]);
    if (v) goHome();
  }
  function goHome() { document.querySelectorAll('.toast').forEach(t => t.remove()); App.screen = 'home'; App.state = null; render(); }

  function renderGame() {
    const g = DG.games[App.gameId];
    const s = App.state;
    const modes = g.inputModes || [];
    const modeBtn = modes.length > 1
      ? h('button', { class: 'pillbtn', onclick: toggleInput }, 'Eingabe: ' + (g.inputModeLabels?.[s.inputMode] || s.inputMode), h('span', { class: 'kbd' }, 'M'))
      : null;
    const body = h('div', { class: 'game' + (App.padHidden ? ' nopad' : '') });
    g.render(s, body, ctx);
    // Bildschirm-Tastatur ein-/ausklappen (für reine Tastatur-Bedienung)
    body.querySelectorAll('.inputbox').forEach(box => {
      if (App.padHidden) box.classList.add('collapsed');
      box.querySelector('.input-head')?.appendChild(
        h('button', { class: 'padtoggle', title: 'Bildschirm-Tastatur ein-/ausblenden', onclick: togglePad },
          App.padHidden ? '▴ Tasten' : '▾ Tasten', h('span', { class: 'kbd' }, 'H')));
    });
    return [topbar([
        h('button', { class: 'pillbtn', onclick: leaveGame }, '⇦ Menü', h('span', { class: 'kbd' }, 'Esc')),
        h('button', { class: 'pillbtn', onclick: undo }, '↶ Zurück', h('span', { class: 'kbd' }, 'X')),
        modeBtn]),
      body];
  }
  function togglePad() { App.padHidden = !App.padHidden; render(); }

  function toggleInput() {
    const g = DG.games[App.gameId];
    const modes = g.inputModes || [];
    if (modes.length < 2) return;
    const s = App.state;
    if (g.canToggleInput && !g.canToggleInput(s)) { DG.toast('Erst die Aufnahme beenden'); return; }
    s.inputMode = modes[(modes.indexOf(s.inputMode) + 1) % modes.length];
    resetUi(); render();
  }

  /* ---------- Ergebnis ---------- */
  function renderResult() {
    const g = DG.games[App.gameId];
    const r = g.results(App.state);
    return [topbar(),
      h('div', { class: 'screen' },
        h('div', { class: 'screen-title' }, 'Ergebnis'),
        h('div', { class: 'result' },
          h('div', { class: 'winner' }, r.headline, r.winner ? h('b', null, '🏆 ' + r.winner) : null),
          h('div', { class: 'card' },
            h('table', { class: 'stattable' },
              h('thead', null, h('tr', null, h('th', null, ''), r.cols.map(c => h('th', null, c)))),
              h('tbody', null, r.rows.map(row => h('tr', null, row.map(c => h('td', null, c))))))))),
      h('div', { class: 'bottombar' },
        h('button', { class: 'bigbtn secondary', onclick: undo }, 'Letzten Wurf zurück', h('span', { class: 'kbd' }, 'X')),
        h('button', { class: 'bigbtn secondary', onclick: goHome }, 'Menü', h('span', { class: 'kbd' }, 'Esc')),
        h('button', { class: 'bigbtn', onclick: () => openSetup(App.gameId) }, 'Neues Spiel', h('span', { class: 'kbd' }, 'N')),
        h('button', { class: 'bigbtn', onclick: startGame }, 'Revanche', h('span', { class: 'kbd' }, 'Enter')))];
  }

  /* ---------- Render ---------- */
  function render() {
    root.innerHTML = '';
    let parts;
    if (App.screen === 'home') parts = renderHome();
    else if (App.screen === 'setup') parts = renderSetup();
    else if (App.screen === 'game') parts = renderGame();
    else parts = renderResult();
    parts.forEach(p => p && root.appendChild(p));
    // Wurfprotokoll immer ans Ende scrollen
    root.querySelectorAll('.sheet').forEach(e => {
      const cur = e.querySelector('.cur');
      if (!cur) { e.scrollTop = e.scrollHeight; return; }
      const head = e.querySelector('thead')?.offsetHeight || 0;
      const avail = e.clientHeight - head;
      const top = cur.getBoundingClientRect().top - e.getBoundingClientRect().top + e.scrollTop; // Position im Scrollbereich
      // aktuelle Zeile möglichst unten, damit die vorherigen Aufnahmen sichtbar bleiben
      const want = top - head - (avail - cur.offsetHeight);
      if (top - head < e.scrollTop || top + cur.offsetHeight > e.scrollTop + e.clientHeight) e.scrollTop = Math.max(0, want);
      else e.scrollTop = Math.max(0, Math.min(e.scrollTop, want > 0 ? want : 0));
    });
  }
  DG.render = render;

  /* ---------- Tastatur ---------- */
  document.addEventListener('keydown', e => {
    if (DG.modalOpen()) return;
    const inInput = e.target.tagName === 'INPUT';
    // Im Spiel gehören F1–F12 den Schnelleingaben (wie Darthelfer); F7/F8 nur außerhalb
    if (App.screen !== 'game') {
      if (e.key === 'F8') { e.preventDefault(); toggleFullscreen(); return; }
      if (e.key === 'F7') { e.preventDefault(); toggleSpeech(); return; }
    }

    if (App.screen === 'home') {
      const m = /^F(\d)$/.exec(e.key);
      if (m) { const id = DG.gameOrder[+m[1] - 1]; if (id) { e.preventDefault(); openSetup(id); } }
      return;
    }
    if (App.screen === 'setup') {
      if (e.key === 'Escape') { e.preventDefault(); goHome(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (inInput) e.target.blur(); startGame(); }
      else if (!inInput && /^[1-8]$/.test(e.key)) { App.playerCount = Math.max(+e.key, DG.games[App.gameId].minPlayers || 1); render(); }
      return;
    }
    if (App.screen === 'result') {
      if (e.key === 'Escape') { e.preventDefault(); goHome(); }
      else if (e.key === 'Enter') { e.preventDefault(); startGame(); }
      else if (e.key.toLowerCase() === 'n') { openSetup(App.gameId); }
      else if (e.key.toLowerCase() === 'x') { undo(); }
      return;
    }
    if (App.screen === 'game') {
      if (inInput) return;
      const g0 = DG.games[App.gameId];
      if (e.key === 'Escape') { e.preventDefault(); if (!(g0.onEscape && g0.onEscape(App.state, ctx))) leaveGame(); return; }
      const k = e.key.toLowerCase();
      if (k === 'x') { e.preventDefault(); undo(); return; }
      if (k === 'm') { e.preventDefault(); toggleInput(); return; }
      if (k === 'h') { e.preventDefault(); togglePad(); return; }
      const g = DG.games[App.gameId];
      if (g.onKey && g.onKey(e, App.state, ctx)) e.preventDefault();
      else if (/^F([1-9]|1[0-2])$/.test(e.key)) e.preventDefault(); // z.B. F5 darf das Spiel nicht neu laden
    }
  });

  window.addEventListener('beforeunload', e => {
    if (App.screen === 'game') { e.preventDefault(); e.returnValue = ''; }
  });

  document.addEventListener('DOMContentLoaded', render);
})();
