# Track Racer

Draw a track with your mouse, then race it with up to three friends in the browser.

## How to play

1. Everyone opens the page, picks PLAY and enters a name. The first person in is the host.
2. The host picks DRAW TRACK and draws one closed loop. The other players watch it being drawn.
3. The host hits RACE and everyone lines up on the grid. Three laps.

Pass through every blue checkpoint before crossing the start line or the lap doesn't count.

## Controls

- W / Up: accelerate
- S / Down: brake, reverse
- A / Left, D / Right: steer
- R: back to the last checkpoint

WASD can be rebound under CONTROLS. The arrow keys always work.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3000.

`render.yaml` is set up for a Render web service if you want to put it online.

## Files

```
server.js                    lobby and message relay (Express + socket.io)
public/index.html            page, styles, and the HTML lobby/drawing screens
public/main.js               Phaser setup, network events that change screens
public/client/scenes/        title, controls, lobby, drawing, race, results
public/client/track/         track shape, checkpoints, starting grid
public/client/entities/      your car and the other players' cars
public/client/systems/       networking, input, HUD, drawing helpers
```
