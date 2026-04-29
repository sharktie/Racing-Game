import { net } from '../systems/Network.js';

export default class Lobby extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create() {
    this._injectStyles();
    net.connect();

    document.getElementById('lobby-phase').style.display = 'flex';
    document.getElementById('game-phase').style.display  = 'block';
    document.getElementById('draw-phase').style.display  = 'none';

    document.getElementById('btn-enter').addEventListener('click',  () => this._enter());
    document.getElementById('name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._enter();
    });
    document.getElementById('btn-start-draw').addEventListener('click', () => this._goToDraw());

    net.on('player_joined', () => this._refreshList());
    net.on('player_left',   () => this._refreshList());
    net.on('host_changed',  () => this._onHostChanged());

    // Guest receives track when host is done drawing
    net.on('track_data', (data) => {
      this.registry.set('trackData', data);
      document.getElementById('lobby-phase').style.display = 'none';
      document.getElementById('game-phase').style.display  = 'block';
      this.scene.start('GameScene');
    });
  }

  _enter() {
    const nameInput = document.getElementById('name-input');
    const name = nameInput.value.trim() || 'Driver';
    const err  = document.getElementById('lobby-error');
    err.textContent = '';

    document.getElementById('btn-enter').disabled = true;
    nameInput.disabled = true;

    net.joinLobby(name, ({ ok, message, trackData }) => {
      if (!ok) {
        err.textContent = message;
        document.getElementById('btn-enter').disabled = false;
        nameInput.disabled = false;
        return;
      }
      this._showWaiting();
      if (trackData) {
        // Track already drawn — jump straight to race
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
    document.getElementById('btn-start-draw').style.display  = isHost ? 'inline-block' : 'none';
    document.getElementById('waiting-guest-msg').style.display = isHost ? 'none' : 'block';
    document.getElementById('waiting-host-msg').style.display  = isHost ? 'block' : 'none';
  }

  _refreshList() {
    const el = document.getElementById('player-list');
    el.innerHTML = '';
    net.players.forEach(p => {
      const pill = document.createElement('div');
      pill.className = 'player-pill';
      const isYou  = p.id === net.playerId;
      const isHost = p.id === net.hostId;
      pill.innerHTML = `
        <span class="pill-name">${p.name}${isYou ? ' <em>(you)</em>' : ''}</span>
        ${isHost ? '<span class="pill-host">HOST</span>' : ''}
      `;
      el.appendChild(pill);
    });

    const count = net.players.size;
    document.getElementById('player-count').textContent = `${count} / 4 players`;
  }

  _goToDraw() {
    document.getElementById('lobby-phase').style.display = 'none';
    document.getElementById('draw-phase').style.display  = 'flex';
    document.getElementById('game-phase').style.display  = 'none';
    this.scene.start('DrawingPhase');
  }

  _injectStyles() {
    if (document.getElementById('lobby-styles')) return;
    const s = document.createElement('style');
    s.id = 'lobby-styles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Barlow+Condensed:wght@400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --red:#e8312a;--gold:#f5c518;--dark:#0d0d0f;
  --panel:#161618;--border:#2a2a2e;--text:#e8e8ec;--muted:#6b6b72;
}
body{background:var(--dark);color:var(--text);font-family:'Barlow Condensed',sans-serif;overflow:hidden;height:100vh}

/* ── Lobby overlay ── */
#lobby-phase{
  position:fixed;inset:0;z-index:100;
  display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 35%, #151528 0%, #0d0d0f 70%);
}
#lobby-inner{width:100%;max-width:440px;padding:24px;text-align:center}

#lobby-inner h1{
  font-family:'Rajdhani',sans-serif;font-size:44px;letter-spacing:4px;
  color:var(--red);text-transform:uppercase;margin-bottom:4px;
}
.lobby-tagline{color:var(--muted);font-size:15px;letter-spacing:1px;margin-bottom:28px}

/* ── Entry card ── */
#lobby-entry{
  background:var(--panel);border:1px solid var(--border);
  border-radius:10px;padding:32px 28px;
  display:flex;flex-direction:column;align-items:stretch;gap:14px;
}
#lobby-entry label{
  font-size:13px;letter-spacing:2px;color:var(--muted);text-align:left;
}
#name-input{
  background:#0d0d0f;border:1px solid var(--border);border-radius:5px;
  color:var(--text);font-family:'Barlow Condensed',sans-serif;
  font-size:24px;font-weight:600;letter-spacing:2px;
  padding:12px 16px;outline:none;transition:border-color .15s;
}
#name-input:focus{border-color:var(--red)}
#name-input:disabled{opacity:.5}
.lobby-error{color:#ff6b6b;font-size:14px;min-height:18px;text-align:center}

/* ── Waiting room ── */
#lobby-waiting{display:none;margin-top:4px}
.waiting-title{
  font-family:'Rajdhani',sans-serif;font-size:22px;letter-spacing:2px;
  color:var(--gold);margin-bottom:6px;
}
.waiting-sub{color:var(--muted);font-size:14px;margin-bottom:20px;min-height:20px}

#player-list{
  display:flex;flex-direction:column;gap:8px;
  background:var(--panel);border:1px solid var(--border);
  border-radius:8px;padding:14px;margin-bottom:14px;
}
.player-pill{
  display:flex;align-items:center;justify-content:space-between;
  background:#0d0d0f;border-radius:6px;padding:9px 14px;
}
.pill-name{font-size:17px;color:var(--text)}
.pill-name em{color:var(--muted);font-style:normal;font-size:13px}
.pill-host{
  font-size:11px;letter-spacing:2px;font-weight:700;
  color:var(--gold);background:#1a1500;
  border:1px solid #3a3000;border-radius:4px;padding:2px 8px;
}
#player-count{
  font-size:13px;color:var(--muted);letter-spacing:1px;margin-bottom:16px;
}

/* ── Buttons ── */
.btn{
  padding:11px 28px;font-family:'Rajdhani',sans-serif;
  font-size:19px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  border:none;border-radius:5px;cursor:pointer;
  transition:opacity .15s,transform .1s;width:100%;
}
.btn:hover{opacity:.88}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.35;cursor:default}
.btn-red{background:var(--red);color:#fff}
.btn-gold{background:var(--gold);color:#0d0d0f}

/* ── Game / draw divs ── */
#draw-phase{display:none;flex-direction:column;height:100vh}
#game-phase{position:fixed;inset:0;display:block}
#game-phase canvas{display:block}
    `;
    document.head.appendChild(s);
  }
}
