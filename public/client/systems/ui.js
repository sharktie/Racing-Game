// Small helpers shared by the scenes: pixel text, keyboard menus, and the
// plain HTML screens (lobby, drawing) that sit on top of the game canvas.

export const FONT = '"Press Start 2P", monospace';

export const hex = n => '#' + n.toString(16).padStart(6, '0');

export function text(scene, x, y, str, size = 8, color = '#fff1e8') {
  return scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color });
}

export function blink(scene, obj, ms = 500) {
  scene.time.addEvent({ delay: ms, loop: true, callback: () => obj.setVisible(!obj.visible) });
  return obj;
}

// A column of options, picked with the arrow keys + Enter or with the mouse.
// Each item is { label, action }. The action gets the key event (or pointer).
export function menu(scene, x, y, items) {
  const KC = Phaser.Input.Keyboard.KeyCodes;
  const m = { enabled: true, selected: 0 };

  const rows = items.map((item, i) =>
    text(scene, x, y + i * 16, '')
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => m.enabled && select(i))
      .on('pointerdown', pointer => m.enabled && item.action(pointer)));

  function select(i) {
    m.selected = i;
    rows.forEach((row, j) => row
      .setText((j === i ? '> ' : '  ') + items[j].label)
      .setColor(j === i ? '#ffec27' : '#fff1e8'));
  }

  m.setLabel = (i, label) => {
    items[i].label = label;
    select(m.selected);
  };

  scene.input.keyboard.on('keydown', e => {
    if (!m.enabled) return;
    const n = items.length;
    if (e.keyCode === KC.UP) select((m.selected + n - 1) % n);
    else if (e.keyCode === KC.DOWN) select((m.selected + 1) % n);
    else if (e.keyCode === KC.ENTER || e.keyCode === KC.SPACE) items[m.selected].action(e);
  });

  select(0);
  return m;
}

// Show one of the HTML screens by id, or none (null) for the game canvas.
export function showScreen(id) {
  for (const name of ['lobby', 'draw']) {
    document.getElementById(name).hidden = name !== id;
  }
  fitCanvases();
}

// Scale the drawing canvases up to fill their box without stretching.
export function fitCanvases() {
  for (const canvas of document.querySelectorAll('.wrap canvas')) {
    const box = canvas.parentElement;
    const s = Math.min(box.clientWidth / canvas.width, box.clientHeight / canvas.height);
    if (!s) continue; // hidden
    canvas.style.width = `${canvas.width * s}px`;
    canvas.style.height = `${canvas.height * s}px`;
  }
}

window.addEventListener('resize', fitCanvases);

export function formatTime(seconds) {
  if (!isFinite(seconds)) return '-:--.--';
  const cs = Math.round(seconds * 100);
  const m = Math.floor(cs / 6000);
  const s = ((cs % 6000) / 100).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}
