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
    this.socket.on('track_data',   ({ data }) => this._emit('track_data', data));
    this.socket.on('lap_completed', (d)       => this._emit('lap_completed', d));
    this.socket.on('host_changed',  ({ hostId }) => {
      this.hostId = hostId;
      this.isHost = hostId === this.playerId;
      this._emit('host_changed', hostId);
    });
  }

  joinLobby(name, cb) {
    this.socket.emit('join_lobby', { name });
    this.socket.once('lobby_joined', ({ playerId, playerIndex, isHost, players, trackData }) => {
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
      cb({ ok: false, message });
    });
  }

  sendTrack(data)             { this.socket.emit('track_ready',   { data }); }
  sendUpdate(state)           { this.socket.emit('player_update',  state);   }
  sendLapComplete(lap, time)  { this.socket.emit('lap_complete',  { lap, time }); }

  on(event, fn)  { (this._listeners[event] ??= []).push(fn); }
  off(event, fn) { this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn); }
  _emit(e, d)    { (this._listeners[e] || []).forEach(fn => fn(d)); }
}

export const net = new Network();
