import { net } from '../systems/Network.js';

// ── Styles injected once ─────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Barlow+Condensed:wght@400;600;700&display=swap');

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --red:    #e03333;
  --gold:   #f5c518;
  --dark:   #0d0d0f;
  --panel:  #141416;
  --border: #252528;
  --text:   #e8e8ec;
  --muted:  #5a5a62;
}

body {
  background: var(--dark);
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  overflow: hidden;
  height: 100vh;
}

#lobby-phase {
  position: fixed; inset: 0; z-index: 100;
  display: none;
  align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 30%, #0f0f1e 0%, #0d0d0f 65%);
}

#lobby-inner {
  width: 100%; max-width: 460px; padding: 28px; text-align: center;
}

#lobby-back {
  display: flex; align-items: center; gap: 8px;
  background: none; border: none; cursor: pointer;
  color: var(--muted); font-family: 'Barlow Condensed', sans-serif;
  font-size: 14px; letter-spacing: 2px; text-transform: uppercase;
  padding: 0 0 20px 0; transition: color .15s;
}
#lobby-back:hover { color: var(--text); }
#lobby-back svg { width: 16px; height: 16px; }

#lobby-inner h1 {
  font-family: 'Rajdhani', sans-serif;
  font-size: 42px; letter-spacing: 5px;
  color: var(--red); text-transform: uppercase;
  margin-bottom: 4px;
}
.lobby-tagline {
  color: var(--muted); font-size: 14px;
  letter-spacing: 1.5px; margin-bottom: 32px;
}

#lobby-entry {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 10px; padding: 32px 28px;
  display: flex; flex-direction: column;
  align-items: stretch; gap: 14px;
}
#lobby-entry label {
  font-size: 12px; letter-spacing: 2.5px;
  color: var(--muted); text-align: left; text-transform: uppercase;
}
#name-input {
  background: #0a0a0c; border: 1px solid var(--border);
  border-radius: 5px; color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 24px; font-weight: 600; letter-spacing: 2px;
  padding: 12px 16px; outline: none;
  transition: border-color .15s;
}
#name-input:focus   { border-color: var(--red); }
#name-input:disabled { opacity: .4; }
.lobby-error {
  color: #ff6b6b; font-size: 14px;
  min-height: 18px; text-align: center;
}

#lobby-waiting { display: none; margin-top: 4px; }

.waiting-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 20px; letter-spacing: 2.5px;
  color: var(--gold); margin-bottom: 6px;
}
.waiting-sub {
  color: var(--muted); font-size: 14px;
  margin-bottom: 20px; min-height: 20px;
  letter-spacing: .5px;
}

#player-list {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 8px; padding: 14px; margin-bottom: 14px;
}
.player-pill {
  display: flex; align-items: center; justify-content: space-between;
  background: #0a0a0c; border-radius: 6px; padding: 9px 14px;
}
.pill-name  { font-size: 17px; color: var(--text); }
.pill-name em { color: var(--muted); font-style: normal; font-size: 13px; }
.pill-host {
  font-size: 11px; letter-spacing: 2px; font-weight: 700;
  color: var(--gold); background: #1a1400;
  border: 1px solid #3a3000; border-radius: 4px; padding: 2px 8px;
}
#player-count {
  font-size: 13px; color: var(--muted);
  letter-spacing: 1px; margin-bottom: 16px;
}

.btn {
  padding: 12px 28px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 19px; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase;
  border: none; border-radius: 5px; cursor: pointer;
  transition: opacity .15s, transform .1s; width: 100%;
}
.btn:hover   { opacity: .88; }
.btn:active  { transform: scale(.97); }
.btn:disabled { opacity: .3; cursor: default; }
.btn-red  { background: var(--red);  color: #fff; }
.btn-gold { background: var(--gold); color: #0d0d0f; }

#draw-phase { display: none; flex-direction: column; height: 100vh; }
#game-phase { position: fixed; inset: 0; display: block; }
#game-phase canvas { display: block; }
`;

// ── Helper ────────────────────────────────────────────────────────────────────
function mk(tag, attrs = {}, text = '') {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  });
  if (text) e.textContent = text;
  return e;
}

// ── Build lobby DOM (idempotent) ──────────────────────────────────────────────
function buildLobbyDOM() {
  if (document.getElementById('lobby-phase')) return;

  const style = document.createElement('style');
  style.id = 'lobby-styles';
  style.textContent = CSS;
  document.head.appendChild(style);

  const phase = mk('div', { id: 'lobby-phase' });
  const inner = mk('div', { id: 'lobby-inner' });
  phase.appendChild(inner);

  // Back button
  const backBtn = mk('button', { id: 'lobby-back' });
  backBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg> MENU`;
  inner.appendChild(backBtn);

  inner.appendChild(mk('h1', {}, '🏁 Track Racer'));
  inner.appendChild(mk('p', { class: 'lobby-tagline' }, 'Draw your track · Race your friends'));

  // Entry card
  const entry = mk('div', { id: 'lobby-entry' });
  entry.appendChild(mk('label', { for: 'name-input' }, 'Your Name'));
  entry.appendChild(mk('input', { id: 'name-input', maxlength: '16', placeholder: 'Driver', autocomplete: 'off' }));
  entry.appendChild(mk('p', { class: 'lobby-error', id: 'lobby-error' }));
  entry.appendChild(mk('button', { class: 'btn btn-red', id: 'btn-enter' }, 'Join Lobby'));
  inner.appendChild(entry);

  // Waiting room
  const waiting = mk('div', { id: 'lobby-waiting' });
  waiting.appendChild(mk('p', { class: 'waiting-title' }, 'LOBBY'));
  waiting.appendChild(mk('p', { class: 'waiting-sub', id: 'waiting-host-msg', style: { display: 'none' } }, "You're the host — draw the track when ready."));
  waiting.appendChild(mk('p', { class: 'waiting-sub', id: 'waiting-guest-msg', style: { display: 'none' } }, 'Waiting for the host to draw a track…'));
  waiting.appendChild(mk('div', { id: 'player-list' }));
  waiting.appendChild(mk('p',   { id: 'player-count' }, '0 / 4 players'));
  waiting.appendChild(mk('button', { class: 'btn btn-gold', id: 'btn-start-draw', style: { display: 'none' } }, '✏  Draw Track'));
  inner.appendChild(waiting);

  document.body.appendChild(phase);
}

// ═══════════════════════════════════════════════════════════════════════════════
export default class Lobby extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create() {
    buildLobbyDOM();
    net.connect();

    document.getElementById('lobby-phase').style.display  = 'flex';
    document.getElementById('game-phase').style.display   = 'block';
    document.getElementById('draw-phase').style.display   = 'none';

    // Reset to entry view each time scene starts
    document.getElementById('lobby-entry').style.display   = 'flex';
    document.getElementById('lobby-waiting').style.display = 'none';
    const joinBtn = document.getElementById('btn-enter');
    const nameIn  = document.getElementById('name-input');
    joinBtn.disabled = false;
    nameIn.disabled  = false;
    document.getElementById('lobby-error').textContent = '';

    // Wire events (clone-replace to avoid duplicate listeners across restarts)
    const rebind = id => {
      const old = document.getElementById(id);
      const fresh = old.cloneNode(true);
      old.parentNode.replaceChild(fresh, old);
      return fresh;
    };

    rebind('btn-enter').addEventListener('click',    () => this._enter());
    rebind('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') this._enter(); });
    rebind('btn-start-draw').addEventListener('click', () => this._goToDraw());
    rebind('lobby-back').addEventListener('click',     () => this._backToMenu());

    this._offList = [
      net.on('player_joined', () => this._refreshList()),
      net.on('player_left',   () => this._refreshList()),
      net.on('host_changed',  () => this._onHostChanged()),
    ];

    net.on('track_data', data => {
      this.registry.set('trackData', data);
      document.getElementById('lobby-phase').style.display = 'none';
      document.getElementById('game-phase').style.display  = 'block';
      this.scene.start('GameScene');
    });
  }

  _backToMenu() {
    document.getElementById('lobby-phase').style.display = 'none';
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
  }

  _enter() {
    const nameIn  = document.getElementById('name-input');
    const joinBtn = document.getElementById('btn-enter');
    const err     = document.getElementById('lobby-error');
    const name    = nameIn.value.trim() || 'Driver';

    err.textContent  = '';
    joinBtn.disabled = true;
    nameIn.disabled  = true;

    net.joinLobby(name, ({ ok, message, trackData }) => {
      if (!ok) {
        err.textContent  = message;
        joinBtn.disabled = false;
        nameIn.disabled  = false;
        return;
      }
      this._showWaiting();
      if (trackData) {
        this.registry.set('trackData', trackData);
        document.getElementById('lobby-phase').style.display = 'none';
        document.getElementById('game-phase').style.display  = 'block';
        this.scene.start('GameScene');
      }
    });
  }

  _showWaiting() {
    document.getElementById('lobby-entry').style.display   = 'none';
    document.getElementById('lobby-waiting').style.display = 'block';
    this._onHostChanged();
    this._refreshList();
  }

  _onHostChanged() {
    const isHost = net.isHost;
    document.getElementById('btn-start-draw').style.display   = isHost ? 'block' : 'none';
    document.getElementById('waiting-host-msg').style.display  = isHost ? 'block' : 'none';
    document.getElementById('waiting-guest-msg').style.display = isHost ? 'none'  : 'block';
  }

  _refreshList() {
    const listEl = document.getElementById('player-list');
    listEl.innerHTML = '';
    net.players.forEach(p => {
      const pill = document.createElement('div');
      pill.className = 'player-pill';
      const isYou  = p.id === net.playerId;
      const isHost = p.id === net.hostId;
      pill.innerHTML = `
        <span class="pill-name">${p.name}${isYou ? ' <em>(you)</em>' : ''}</span>
        ${isHost ? '<span class="pill-host">HOST</span>' : ''}
      `;
      listEl.appendChild(pill);
    });
    document.getElementById('player-count').textContent = `${net.players.size} / 4 players`;
  }

  _goToDraw() {
    document.getElementById('lobby-phase').style.display = 'none';
    document.getElementById('draw-phase').style.display  = 'flex';
    document.getElementById('game-phase').style.display  = 'none';
    this.scene.start('DrawingPhase');
  }
}
