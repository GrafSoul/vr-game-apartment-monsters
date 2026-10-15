import type { GameState } from '../game/game';
import { ARMOR_MAX } from '../game/rules';
import { t } from '../i18n';
import type { Settings } from '../state/settings';

/** Button ids on the wrist panel. */
export type WristButton = 'pause' | 'reset' | 'shadows' | 'dimmer' | 'brighter' | 'occlusion';

/** A button's rectangle in panel UV space (0..1, origin bottom-left, like the plane's UVs). */
export interface ButtonRect {
  id: WristButton;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export const PANEL_PX = { width: 768, height: 480 };

const PAD = 22;
const GAP = 14;
const ROWS = [
  { y: 196, h: 124 },
  { y: 334, h: 124 },
];
const LAYOUT: WristButton[][] = [
  ['pause', 'reset', 'shadows'],
  ['dimmer', 'brighter', 'occlusion'],
];

/** Layout of the six buttons; pressed with the pointer and the trigger. */
export const BUTTONS: ButtonRect[] = LAYOUT.flatMap((row, r) =>
  row.map((id, c) => {
    const w = (PANEL_PX.width - PAD * 2 - GAP * (row.length - 1)) / row.length;
    const x = PAD + c * (w + GAP);
    const { y, h } = ROWS[r];
    return { id, u0: x / PANEL_PX.width, u1: (x + w) / PANEL_PX.width, v0: 1 - (y + h) / PANEL_PX.height, v1: 1 - y / PANEL_PX.height };
  }),
);

const AMBER = '#ffb547';
const FG = '#e7ebee';
const MUTED = '#95a1ab';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function label(id: WristButton, g: GameState): string {
  const s = t();
  switch (id) {
    case 'pause':
      return g.paused ? s.resume : s.pause;
    case 'reset':
      return s.restart;
    case 'shadows':
      return s.shadows;
    case 'dimmer':
      return s.dimmer;
    case 'brighter':
      return s.brighter;
    case 'occlusion':
      return s.occlusion;
  }
}

function isOn(id: WristButton, g: GameState, s: Settings): boolean {
  return (id === 'shadows' && s.shadows) || (id === 'occlusion' && s.occlusion) || (id === 'pause' && g.paused);
}

/** Sets the largest font (down to 18 px) at which `text` fits in `maxWidth`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, weight: number): void {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px ${SANS}`;
    if (ctx.measureText(text).width <= maxWidth) return;
    px -= 2;
  } while (px > 18);
}

/**
 * Repaints the panel. `hovered` is the button under the pointer; `flash` makes it solid amber
 * for a moment after the trigger presses it.
 */
export function drawWristPanel(ctx: CanvasRenderingContext2D, g: GameState, s: Settings, hovered: WristButton | null, flash: boolean): void {
  const { width, height } = PANEL_PX;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(12,16,20,0.9)';
  ctx.strokeStyle = 'rgba(255,181,71,0.8)';
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, width - 4, height - 4, 28);
  ctx.fill();
  ctx.stroke();

  // Level and armor.
  ctx.fillStyle = FG;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 50px ${SANS}`;
  ctx.fillText(`${t().panelLevel} ${g.level}`, PAD + 6, 72);
  const pipW = 34;
  for (let i = 0; i < ARMOR_MAX; i++) {
    const x = width - PAD - (ARMOR_MAX - i) * (pipW + 8);
    ctx.fillStyle = i < g.armor ? AMBER : 'rgba(255,255,255,0.14)';
    roundRect(ctx, x, 36, pipW, 34, 7);
    ctx.fill();
  }
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${SANS}`;
  ctx.fillText(t().panelArmor, width - PAD - ARMOR_MAX * (pipW + 8), 104);

  // Progress: kills, or the boss's health.
  const boss = g.creatures.find((c) => c.kind === 'boss');
  if (boss) {
    ctx.fillStyle = '#ff6a45';
    ctx.font = `700 34px ${SANS}`;
    ctx.fillText(t().panelBoss, PAD + 6, 152);
    const barX = PAD + 120;
    const barW = width - barX - PAD - 6;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, 126, barW, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#ff6a45';
    roundRect(ctx, barX, 126, Math.max(8, (barW * boss.hp) / boss.maxHp), 26, 8);
    ctx.fill();
  } else {
    ctx.fillStyle = FG;
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText(`${t().panelCreatures}: ${Math.min(g.killed, g.target)} / ${g.target}`, PAD + 6, 152);
    ctx.fillStyle = MUTED;
    ctx.font = `500 24px ${SANS}`;
    const fps = `${s.fps} fps`;
    ctx.fillText(fps, width - PAD - 6 - ctx.measureText(fps).width, 152);
  }

  for (const b of BUTTONS) {
    const x = b.u0 * width;
    const y = (1 - b.v1) * height;
    const w = (b.u1 - b.u0) * width;
    const h = (b.v1 - b.v0) * height;
    const on = isOn(b.id, g, s);
    const aimed = hovered === b.id;
    ctx.fillStyle = aimed && flash ? AMBER : aimed ? 'rgba(255,255,255,0.24)' : on ? 'rgba(255,181,71,0.24)' : 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = aimed ? '#ffffff' : on ? AMBER : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = aimed ? 6 : 3;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.stroke();
    const text = label(b.id, g);
    fitFont(ctx, text, w - 24, 40, 650);
    ctx.fillStyle = aimed && flash ? '#0c1013' : FG;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + (w - ctx.measureText(text).width) / 2, y + h / 2 + 2);
    ctx.textBaseline = 'alphabetic';
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
