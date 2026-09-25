// Thin wrapper around the socket.io client. Scenes subscribe with net.on().
class Network {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.reset();
  }

  reset() {
    this.playerId = null;
    this.playerIndex = 0;
    this.playerName = '';
    this.hostId = null;
    this.players = new Map(); // id -> { id, index, name }, including us
  }

  get joined() { return this.playerId !== null; }
  get isHost() { return this.joined && this.playerId === this.hostId; }

  connect() {
    if (this.socket) return;
    const s = this.socket = io();

    s.on('player_joined', p => {
      this.players.set(p.id, p);
      this.emit('players');
    });
    s.on('player_left', id => {
      this.players.delete(id);
      this.emit('player_left', id);
      this.emit('players');
    });
    s.on('host_changed', id => {
      this.hostId = id;
      this.emit('host_changed');
      this.emit('players');
    });
    s.on('player_moved', m => this.emit('player_moved', m));
    s.on('track', t => this.emit('track', t));
    s.on('draw_stroke', d => this.emit('draw_stroke', d));
    s.on('draw_clear', () => this.emit('draw_clear'));

    // The server forgets us when the connection drops, even if socket.io
    // reconnects on its own, so start over.
    s.on('disconnect', () => {
      if (!this.joined) return;
      this.reset();
      this.emit('disconnected');
    });
  }

  join(name, done) {
    this.connect();
    this.socket.timeout(5000).emit('join', name, (err, res) => {
      if (err) return done({ error: 'NO CONNECTION' });
      if (res.error) return done(res);
      this.playerId = res.player.id;
      this.playerIndex = res.player.index;
      this.playerName = res.player.name;
      this.hostId = res.hostId;
      this.players = new Map(res.players.map(p => [p.id, p]));
      done(res);
    });
  }

  leave() {
    if (!this.joined) return;
    this.socket.emit('leave');
    this.reset();
  }

  sendMove(x, y, angle) {
    if (this.joined) this.socket.emit('move', { x, y, angle });
  }

  sendTrack(track) {
    if (this.isHost) this.socket.emit('track', track);
  }

  sendStroke(points, blocked) {
    if (this.isHost) this.socket.emit('draw_stroke', { points, blocked });
  }

  clearStroke() {
    if (this.isHost) this.socket.emit('draw_clear');
  }

  on(event, fn) {
    (this.handlers[event] ??= []).push(fn);
  }

  off(event, fn) {
    this.handlers[event] = (this.handlers[event] || []).filter(f => f !== fn);
  }

  emit(event, data) {
    (this.handlers[event] || []).forEach(fn => fn(data));
  }
}

export const net = new Network();
