/**
 * Network.js — Socket.io client singleton
 *
 * Usage: import { net } from '../systems/Network.js'
 *
 * net.connect()
 * net.joinLobby(name, cb)
 * net.sendTrack(data)
 * net.sendUpdate(state)
 * net.sendLapComplete(lap, time)
 * net.sendDrawStroke(points, blocked)   ← NEW: stream drawing to guests
 * net.sendDrawClear()                   ← NEW: clear guest preview
 * net.on(event, fn) / net.off(event, fn)
 */
class Network {
  constructor() {
    this.socket      = null;
    this.playerId    = null;
    this.playerIndex = 0;
    this.playerName  = '';
    this.isHost      = false;
    this.hostId      = null;
    this.players     = new Map();
    this._listeners  = {};
  }

  connect() {
    if (this.socket) return;
    this.socket = io();

    this.socket.on('players_update', ({ players }) => {
      players.forEach(p => this.players.set(p.id, p));
      this._emit('players_update', players);
    });
    this.socket.on('player_joined', (data) => {
      this.players.set(data.playerId, { id: data.playerId, ...data });
      this._emit('player_joined', data);
    });
    this.socket.on('player_left', ({ playerId }) => {
      this.players.delete(playerId);
      this._emit('player_left', playerId);
    });
    this.socket.on('track_data',    ({ data })     => this._emit('track_data', data));
    this.socket.on('lap_completed', (d)            => this._emit('lap_completed', d));
    this.socket.on('host_changed',  ({ hostId })   => {
      this.hostId = hostId;
      this.isHost = hostId === this.playerId;
      this._emit('host_changed', hostId);
    });

    // ── Live drawing preview (NEW) ─────────────────────────────────────────
    this.socket.on('draw_stroke', ({ points, blocked }) =>
      this._emit('draw_stroke', { points, blocked }));
    this.socket.on('draw_clear',  ()                    =>
      this._emit('draw_clear', null));
    this.socket.on('draw_preview', ({ points, blocked }) =>
      this._emit('draw_preview', { points, blocked }));
  }

  joinLobby(name, cb) {
    // FIX: Remove any stale one-time listeners from a previous attempt
    // before registering new ones, preventing them from firing on the
    // wrong response and causing crashes on retry.
    this.socket.off('lobby_joined');
    this.socket.off('lobby_full');

    this.socket.emit('join_lobby', { name });
    this.socket.once('lobby_joined', ({ playerId, playerIndex, isHost, players, trackData }) => {
      // FIX: Also clean up the lobby_full listener since we succeeded
      this.socket.off('lobby_full');

      this.playerId    = playerId;
      this.playerIndex = playerIndex;
      this.playerName  = name;
      this.isHost      = isHost;
      this.hostId      = isHost ? playerId : (players[0]?.id ?? null);
      players.forEach(p => this.players.set(p.id, p));
      this.players.set(playerId, { id: playerId, index: playerIndex, name });
      cb({ ok: true, trackData });
    });
    this.socket.once('lobby_full', ({ message }) => {
      // FIX: Also clean up the lobby_joined listener since we failed
      this.socket.off('lobby_joined');
      cb({ ok: false, message });
    });
  }

  sendTrack(data)             { this.socket.emit('track_ready',   { data }); }
  sendUpdate(state)           { this.socket.emit('player_update',  state);   }
  sendLapComplete(lap, time)  { this.socket.emit('lap_complete',  { lap, time }); }

  // ── Live drawing preview (NEW) ─────────────────────────────────────────
  sendDrawStroke(points, blocked) {
    if (this.socket && this.isHost) {
      this.socket.emit('draw_stroke', { points, blocked });
    }
  }
  sendDrawClear() {
    if (this.socket && this.isHost) {
      this.socket.emit('draw_clear');
    }
  }

  on(event, fn)  { (this._listeners[event] ??= []).push(fn); }
  off(event, fn) {
    if (fn) {
      this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn);
    } else {
      // off(event) with no fn clears all listeners for that event
      this._listeners[event] = [];
    }
  }
  _emit(e, d)    { (this._listeners[e] || []).forEach(fn => fn(d)); }
}

export const net = new Network();
