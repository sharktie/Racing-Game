// One shared lobby of up to four players. The first player in is the host and
// draws the track. If the host leaves, the next player takes over.

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const MAX_PLAYERS = 4;
const players = new Map(); // socket id -> { id, index, name }
let hostId = null;
let track = null;  // last track the host raced, sent to anyone who joins later
let stroke = null; // host's drawing in progress, same reason

function freeIndex() {
  const used = new Set([...players.values()].map(p => p.index));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}

function leave(socket) {
  const player = players.get(socket.id);
  if (!player) return;

  players.delete(socket.id);
  socket.leave('lobby');
  io.to('lobby').emit('player_left', socket.id);
  console.log(`${player.name} left (${players.size}/${MAX_PLAYERS})`);

  if (socket.id !== hostId) return;

  hostId = players.size ? players.keys().next().value : null;
  if (hostId) {
    io.to('lobby').emit('host_changed', hostId);
    // The old host's half-finished drawing is gone for good.
    if (stroke) {
      stroke = null;
      io.to('lobby').emit('draw_clear');
    }
  } else {
    track = null;
    stroke = null;
  }
}

io.on('connection', socket => {
  const isHost = () => socket.id === hostId;

  socket.on('join', (name, reply) => {
    if (typeof reply !== 'function') return;
    leave(socket);
    if (players.size >= MAX_PLAYERS) return reply({ error: 'LOBBY IS FULL' });

    const player = {
      id: socket.id,
      index: freeIndex(),
      name: String(name || '').trim().slice(0, 16).toUpperCase() || 'DRIVER',
    };
    players.set(socket.id, player);
    if (!hostId) hostId = socket.id;
    socket.join('lobby');
    socket.to('lobby').emit('player_joined', player);
    console.log(`${player.name} joined (${players.size}/${MAX_PLAYERS})`);

    reply({ player, hostId, players: [...players.values()], track });
    if (stroke) socket.emit('draw_stroke', stroke);
  });

  socket.on('leave', () => leave(socket));
  socket.on('disconnect', () => leave(socket));

  socket.on('move', ({ x, y, angle } = {}) => {
    if (!players.has(socket.id)) return;
    socket.volatile.to('lobby').emit('player_moved', { id: socket.id, x, y, angle });
  });

  socket.on('track', data => {
    if (!isHost() || !Array.isArray(data?.centerline)) return;
    track = data;
    stroke = null;
    socket.to('lobby').emit('track', data);
  });

  socket.on('draw_stroke', data => {
    if (!isHost()) return;
    stroke = data;
    socket.to('lobby').emit('draw_stroke', data);
  });

  socket.on('draw_clear', () => {
    if (!isHost()) return;
    stroke = null;
    socket.to('lobby').emit('draw_clear');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
