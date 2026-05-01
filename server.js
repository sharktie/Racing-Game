/**
 * server.js — Racing Game Server
 *
 * Single global lobby, max 4 players. No room codes.
 * First player in becomes host and can draw the track.
 * If host leaves, next player is promoted.
 *
 * Events (client → server):
 *   join_lobby   { name }            — join the global lobby
 *   track_ready  { data }            — host sends finished track
 *   player_update { ... }            — position tick (~20Hz)
 *   lap_complete  { lap, time }
 *   draw_stroke  { points, blocked } — host streams live drawing
 *   draw_clear   {}                  — host cleared the canvas
 *
 * Events (server → client):
 *   lobby_joined   { playerId, playerIndex, players, isHost, trackData }
 *   lobby_full     { message }
 *   player_joined  { playerId, playerIndex, name }
 *   player_left    { playerId }
 *   host_changed   { hostId }
 *   track_data     { data }
 *   players_update { players }
 *   lap_completed  { playerId, lap, time }
 *   draw_stroke    { points, blocked }  — broadcast host drawing to guests
 *   draw_clear     {}                   — broadcast canvas clear to guests
 *   draw_preview   { points, blocked }  — sent to newly joined guests (current stroke)
 */

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(express.static(path.join(__dirname)));

// ── Single global lobby ────────────────────────────────────────────────────

const lobby = {
  hostId:          null,
  players:         new Map(),   // socketId → { id, index, name, x, y, angle, speed, lap }
  trackData:       null,
  currentStroke:   null,        // last draw_stroke payload — shown to late-joining guests
};

const MAX_PLAYERS = 4;

function nextIndex() {
  const used = new Set([...lobby.players.values()].map(p => p.index));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}

// ── Socket logic ───────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('join_lobby', ({ name }) => {
    if (lobby.players.size >= MAX_PLAYERS) {
      socket.emit('lobby_full', { message: 'The lobby is full — max 4 players. Try again later.' });
      return;
    }

    const idx = nextIndex();
    const safeName = String(name || 'Driver').slice(0, 16).trim() || 'Driver';

    lobby.players.set(socket.id, {
      id: socket.id, index: idx, name: safeName,
      x: 0, y: 0, angle: 0, speed: 0, lap: 1,
    });

    if (!lobby.hostId) lobby.hostId = socket.id;

    socket.join('lobby');

    const others = [...lobby.players.values()].filter(p => p.id !== socket.id);

    socket.emit('lobby_joined', {
      playerId:    socket.id,
      playerIndex: idx,
      isHost:      lobby.hostId === socket.id,
      players:     others,
      trackData:   lobby.trackData,
    });

    socket.to('lobby').emit('player_joined', {
      playerId: socket.id, playerIndex: idx, name: safeName,
    });

    // Send the host's current stroke to the new guest so they see it immediately
    if (lobby.currentStroke) {
      socket.emit('draw_preview', lobby.currentStroke);
    }

    console.log(`  ${safeName} joined (P${idx + 1}) — ${lobby.players.size}/${MAX_PLAYERS}`);
  });

  socket.on('track_ready', ({ data }) => {
    if (lobby.hostId !== socket.id) return;
    lobby.trackData    = data;
    lobby.currentStroke = null;   // drawing done — clear the preview buffer
    socket.to('lobby').emit('track_data', { data });
    console.log('  Track broadcast to lobby');
  });

  socket.on('player_update', (state) => {
    const player = lobby.players.get(socket.id);
    if (!player) return;
    Object.assign(player, state);
    io.to('lobby').emit('players_update', { players: [...lobby.players.values()] });
  });

  socket.on('lap_complete', ({ lap, time }) => {
    const player = lobby.players.get(socket.id);
    if (player) player.lap = lap;
    io.to('lobby').emit('lap_completed', { playerId: socket.id, lap, time });
  });

  // ── Live drawing preview ──────────────────────────────────────────────────

  socket.on('draw_stroke', ({ points, blocked }) => {
    if (lobby.hostId !== socket.id) return;
    lobby.currentStroke = { points, blocked };           // cache for late joiners
    socket.to('lobby').emit('draw_stroke', { points, blocked });
  });

  socket.on('draw_clear', () => {
    if (lobby.hostId !== socket.id) return;
    lobby.currentStroke = null;
    socket.to('lobby').emit('draw_clear');
  });

  // ── Disconnect ────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    const player = lobby.players.get(socket.id);
    if (!player) return;
    console.log(`[-] ${player.name} left — ${lobby.players.size - 1}/${MAX_PLAYERS}`);
    lobby.players.delete(socket.id);
    io.to('lobby').emit('player_left', { playerId: socket.id });

    if (lobby.hostId === socket.id) {
      if (lobby.players.size > 0) {
        lobby.hostId = lobby.players.values().next().value.id;
        io.to('lobby').emit('host_changed', { hostId: lobby.hostId });
        console.log(`  New host: ${lobby.players.get(lobby.hostId).name}`);
      } else {
        lobby.hostId        = null;
        lobby.trackData     = null;
        lobby.currentStroke = null;
        console.log('  Lobby empty — track cleared');
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
