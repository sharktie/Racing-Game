# Custom Track Racer — Multiplayer

Real-time multiplayer top-down racing. Draw your own track and race friends online.

## How to Play

1. **Host** clicks **Create Room** → gets a 4-letter room code
2. **Guests** enter the code and click **Join**
3. Host clicks **Draw Track**, draws a loop, hits **Generate Track** then **Race!**
4. Everyone sees the same track and races live — ghost cars show all other players

Up to 4 players per room.

## Running Locally

```bash
npm install
node server.js
# Open http://localhost:3000
```

## Deploy to Render

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
5. Deploy — Render gives you a public URL to share

The `render.yaml` in this repo auto-configures all of the above if you use Render's Blueprint deploy.

## Controls

- **W / ↑** — Accelerate  
- **S / ↓** — Brake / Reverse  
- **A / ←** — Steer left  
- **D / →** — Steer right  

## Architecture

```
server.js          — Express + Socket.io server (rooms, relay)
src/System/Network.js  — Socket.io client singleton
src/Scenes/Lobby.js    — Room create/join UI
src/Scenes/DrawingPhase.js — Track drawing (host only)
src/Scenes/GameScene.js    — Race scene (all players)
src/Entities/GhostCar.js   — Interpolated remote player renderer
src/Track/CustomTrack.js   — Track geometry, 4 grid slots
```
