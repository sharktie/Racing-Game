/**
 * Leaderboard.js
 *
 * Post-race scene.  Receives race data via the Phaser registry:
 *   registry.set('raceResult', { playerName, totalTime, bestLap, lapTimes })
 *
 * Displays lap-by-lap breakdown and best lap highlight.
 * Persists personal best to localStorage and shows if beaten.
 */

const STORAGE_KEY = 'track_racer_pb';

function loadPB() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null; }
  catch (_) { return null; }
}
function savePB(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

function fmt(t) {
  if (!isFinite(t)) return '--:--.--';
  const m  = Math.floor(t / 60);
  const s  = (t % 60).toFixed(2).padStart(5, '0');
  return m > 0 ? `${m}:${s}` : `${s}s`;
}

export default class Leaderboard extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    const result = this.registry.get('raceResult') ?? {
      playerName: 'Driver',
      totalTime:  0,
      bestLap:    Infinity,
      lapTimes:   [],
    };

    // ── Personal best check ─────────────────────────────────────────────────
    const pb       = loadPB();
    const newPB    = !pb || result.bestLap < pb.bestLap;
    if (newPB && isFinite(result.bestLap)) {
      savePB({ bestLap: result.bestLap, totalTime: result.totalTime });
    }

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0e);

    // Subtle grid lines
    const gg = this.add.graphics().setAlpha(0.05);
    for (let y = 0; y < H; y += 32) {
      gg.lineStyle(1, 0xffffff, 1);
      gg.beginPath(); gg.moveTo(0, y); gg.lineTo(W, y); gg.strokePath();
    }

    // Chequered flag accent top bar
    const barH = 6;
    const segs  = Math.ceil(W / barH);
    const barG  = this.add.graphics();
    for (let i = 0; i < segs; i++) {
      barG.fillStyle(i % 2 === 0 ? 0xffffff : 0x000000, 0.7);
      barG.fillRect(i * barH, 0, barH, barH);
    }

    // ── Header ──────────────────────────────────────────────────────────────
    this.add.text(W / 2, 42, '🏁  RACE FINISHED', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '52px', fontStyle: 'bold',
      color: '#f5c518', letterSpacing: 6,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 98, result.playerName.toUpperCase(), {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '20px', color: '#888890', letterSpacing: 4,
    }).setOrigin(0.5);

    // ── Stats row ───────────────────────────────────────────────────────────
    const statY  = H * 0.24;
    const statW  = Math.min(W * 0.8, 600);
    const statBg = this.add.graphics();
    statBg.fillStyle(0x141416, 1);
    statBg.fillRoundedRect(W / 2 - statW / 2, statY - 30, statW, 72, 10);
    statBg.lineStyle(1, 0x252528);
    statBg.strokeRoundedRect(W / 2 - statW / 2, statY - 30, statW, 72, 10);

    this.add.text(W / 2 - statW * 0.28, statY, 'TOTAL TIME', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '12px', color: '#5a5a62', letterSpacing: 3,
    }).setOrigin(0.5, 1);

    this.add.text(W / 2 - statW * 0.28, statY + 6, fmt(result.totalTime), {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '30px', fontStyle: 'bold', color: '#e8e8ec',
    }).setOrigin(0.5, 0);

    const bestCol = newPB ? '#f5c518' : '#88aaff';
    this.add.text(W / 2 + statW * 0.22, statY, newPB ? '★ BEST LAP (NEW PB!)' : 'BEST LAP', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '12px', color: newPB ? '#f5c518' : '#5a5a62', letterSpacing: 3,
    }).setOrigin(0.5, 1);

    this.add.text(W / 2 + statW * 0.22, statY + 6, fmt(result.bestLap), {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '30px', fontStyle: 'bold', color: bestCol,
    }).setOrigin(0.5, 0);

    // ── Lap breakdown table ─────────────────────────────────────────────────
    const tableW = Math.min(W * 0.55, 420);
    const tableX = W / 2 - tableW / 2;
    const tableY = statY + 70;
    const rowH   = 42;

    // Header row
    const hdrBg = this.add.graphics();
    hdrBg.fillStyle(0x1e1e26, 1);
    hdrBg.fillRoundedRect(tableX, tableY, tableW, 32, { tl: 8, tr: 8, bl: 0, br: 0 });

    this.add.text(tableX + 28, tableY + 16, 'LAP', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '13px', color: '#5a5a62', letterSpacing: 3,
    }).setOrigin(0, 0.5);

    this.add.text(tableX + tableW - 24, tableY + 16, 'TIME', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '13px', color: '#5a5a62', letterSpacing: 3,
    }).setOrigin(1, 0.5);

    // Find best lap index
    const bestIdx = result.lapTimes.indexOf(Math.min(...result.lapTimes));

    result.lapTimes.forEach((t, i) => {
      const ry   = tableY + 32 + i * rowH;
      const isBest = i === bestIdx;

      const rowBg = this.add.graphics();
      rowBg.fillStyle(isBest ? 0x1a1a00 : i % 2 === 0 ? 0x141416 : 0x101012, 1);
      rowBg.fillRect(tableX, ry, tableW, rowH);

      if (isBest) {
        rowBg.lineStyle(1, 0xf5c518, 0.4);
        rowBg.strokeRect(tableX, ry, tableW, rowH);
      }

      // Lap number
      this.add.text(tableX + 28, ry + rowH / 2, `Lap ${i + 1}`, {
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '20px', color: isBest ? '#f5c518' : '#aaaaaa',
      }).setOrigin(0, 0.5);

      // Best star
      if (isBest) {
        this.add.text(tableX + 90, ry + rowH / 2, '★ FASTEST', {
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '12px', color: '#f5c518', letterSpacing: 2,
        }).setOrigin(0, 0.5);
      }

      // Lap time
      this.add.text(tableX + tableW - 24, ry + rowH / 2, fmt(t), {
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '22px', fontStyle: 'bold',
        color: isBest ? '#f5c518' : '#e8e8ec',
      }).setOrigin(1, 0.5);
    });

    // Table bottom border
    const tableBottom = this.add.graphics();
    const tH = result.lapTimes.length * rowH;
    tableBottom.lineStyle(1, 0x252528);
    tableBottom.strokeRect(tableX, tableY + 32, tableW, tH);
    tableBottom.fillStyle(0x141416);
    tableBottom.fillRoundedRect(tableX, tableY + 32 + tH, tableW, 8, { tl: 0, tr: 0, bl: 8, br: 8 });

    // Personal best record
    if (pb && !newPB) {
      this.add.text(W / 2, tableY + 32 + tH + 20, `Personal best: ${fmt(pb.bestLap)}`, {
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '14px', color: '#444450', letterSpacing: 2,
      }).setOrigin(0.5, 0);
    }

    // ── Buttons ──────────────────────────────────────────────────────────────
    const buttonsY = Math.max(tableY + 32 + tH + 60, H * 0.84);
    const gap = 16;
    const bW  = 200, bH = 50;

    // Play Again → DrawingPhase
    this._buildButton(W / 2 - bW / 2 - gap / 2, buttonsY, bW, bH,
      '✏  DRAW NEW TRACK', 0xe03333, () => {
        document.getElementById('draw-phase').style.display = 'flex';
        document.getElementById('game-phase').style.display = 'none';
        this.scene.start('DrawingPhase');
      });

    // Main Menu → MenuScene
    this._buildButton(W / 2 + gap / 2, buttonsY, bW, bH,
      '⌂  MAIN MENU', 0x1e1e28, () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
      }, 0x555566);

    // Fade in
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  _buildButton(x, y, w, h, label, fillColor, onClick, borderColor = null) {
    const bg = this.add.graphics();
    const paint = (hover) => {
      bg.clear();
      bg.fillStyle(hover ? Phaser.Display.Color.ValueToColor(fillColor).lighten(15).color : fillColor, 1);
      bg.fillRoundedRect(x, y, w, h, 7);
      if (borderColor) {
        bg.lineStyle(1.5, borderColor);
        bg.strokeRoundedRect(x, y, w, h, 7);
      }
    };
    paint(false);

    const txt = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '18px', fontStyle: 'bold',
      color: '#ffffff', letterSpacing: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    txt.on('pointerover',  () => paint(true));
    txt.on('pointerout',   () => paint(false));
    txt.on('pointerdown',  onClick);
  }
}
