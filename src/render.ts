import { aimedLanding, type GameState } from "./game.ts";
import type { Fx } from "./fx.ts";
import { FORESHORTEN, HAND, RING_INNER_RATIO, TABLE } from "./tune.ts";
import {
  holeRadii,
  makeFlight,
  pickTarget,
  project,
  sampleFlight,
  winRadius,
  type PrizeId,
  type View,
} from "./world.ts";

const STARS = buildStars();

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: View,
  fx: Fx,
  time: number,
  debug: boolean,
): void {
  if (view.w < 2 || view.h < 2) return;
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.save();
  if (!state.reducedMotion && fx.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }
  drawSky(ctx, view);
  drawMoon(ctx, view);
  drawStars(ctx, view, time, state.reducedMotion);
  drawRoofs(ctx, view);
  drawLanternLine(ctx, view, time, state.reducedMotion);
  drawBackboard(ctx, view);
  drawSign(ctx, view);
  drawDeck(ctx, view);
  drawTable(ctx, view);
  const landing = state.aim && state.aim.power > 0.02 ? aimedLanding(state) : null;
  const picked = landing ? pickTarget(landing, state.prizes) : null;
  drawPrizes(ctx, state, view, time, picked?.hit?.id ?? null);
  if (debug) drawDebugZones(ctx, state, view);
  if (landing && state.aim) drawAim(ctx, state, view, picked);
  drawSettled(ctx, state, view);
  if (state.flight) drawFlight(ctx, state, view);
  else drawHeldRing(ctx, state, view, time);
  drawTray(ctx, view);
  drawParticles(ctx, fx);
  drawTexts(ctx, fx, view);
  if (state.aim) drawPower(ctx, view, state.aim.power);
  drawVignette(ctx, view);
  ctx.restore();
}

function drawSky(ctx: CanvasRenderingContext2D, view: View): void {
  const sky = ctx.createLinearGradient(0, 0, 0, view.h);
  sky.addColorStop(0, "#140c28");
  sky.addColorStop(0.38, "#3a1d55");
  sky.addColorStop(0.72, "#8a3450");
  sky.addColorStop(1, "#2a140f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.w, view.h);
}

function drawMoon(ctx: CanvasRenderingContext2D, view: View): void {
  const x = view.w * 0.8;
  const y = view.h * 0.065;
  const r = view.w * 0.055;
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
  glow.addColorStop(0, "rgba(255, 236, 196, 0.55)");
  glow.addColorStop(1, "rgba(255, 236, 196, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7e7c4";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D, view: View, time: number, reduced: boolean): void {
  for (const star of STARS) {
    const twinkle = reduced ? 0.75 : 0.45 + Math.abs(Math.sin(time * 1.6 + star.phase)) * 0.55;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = "#fff6e0";
    ctx.fillRect(star.x * view.w, star.y * view.h, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawRoofs(ctx: CanvasRenderingContext2D, view: View): void {
  const top = stallTop(view);
  ctx.fillStyle = "#24122c";
  ctx.beginPath();
  ctx.moveTo(0, top + 8);
  for (let i = 0; i <= 6; i += 1) {
    const x = (view.w / 6) * i;
    ctx.quadraticCurveTo(x - view.w / 12, top - 28, x, top + 4);
  }
  ctx.lineTo(view.w, top + view.h * 0.08);
  ctx.lineTo(0, top + view.h * 0.08);
  ctx.closePath();
  ctx.fill();
}

function drawLanternLine(ctx: CanvasRenderingContext2D, view: View, time: number, reduced: boolean): void {
  const y = Math.max(view.h * 0.09, stallTop(view) - view.w * 0.16);
  ctx.strokeStyle = "rgba(90, 48, 32, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, y);
  ctx.quadraticCurveTo(view.w / 2, y + 22, view.w - 8, y);
  ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    const t = (i + 0.5) / 6;
    const sag = Math.sin(t * Math.PI) * 16;
    const sway = reduced ? 0 : Math.sin(time * 1.25 + i) * 4;
    drawLantern(ctx, view.w * t + sway, y + sag, view.w * 0.045, i % 2 === 0 ? "#e23b45" : "#f0a020");
  }
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string): void {
  ctx.strokeStyle = "#5c3418";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.15);
  ctx.lineTo(x, y);
  ctx.stroke();
  roundRect(ctx, x - h * 0.28, y, h * 0.56, h * 0.18, 2);
  ctx.fillStyle = "#f0d48a";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.55, h * 0.34, h * 0.42, 0, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(x - h * 0.08, y + h * 0.4, 2, x, y + h * 0.55, h * 0.45);
  glow.addColorStop(0, "#fff1c9");
  glow.addColorStop(0.45, color);
  glow.addColorStop(1, "#7a1424");
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 236, 190, 0.7)";
  ctx.stroke();
  roundRect(ctx, x - h * 0.24, y + h * 0.9, h * 0.48, h * 0.12, 2);
  ctx.fillStyle = "#f0d48a";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 1.02);
  ctx.lineTo(x, y + h * 1.28);
  ctx.stroke();
}

function drawBackboard(ctx: CanvasRenderingContext2D, view: View): void {
  const far = project({ x: 0, z: TABLE.z1 }, view);
  const top = stallTop(view);
  const x = view.w * 0.05;
  const w = view.w * 0.9;
  const h = Math.max(20, far.sy - top + 8);
  const wood = ctx.createLinearGradient(x, top, x + w, top);
  wood.addColorStop(0, "#5c3822");
  wood.addColorStop(0.5, "#7a4e2e");
  wood.addColorStop(1, "#4e301c");
  ctx.fillStyle = wood;
  ctx.fillRect(x, top, w, h);
  ctx.strokeStyle = "rgba(42, 22, 12, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 7; i += 1) {
    const line = x + (w / 7) * i;
    ctx.beginPath();
    ctx.moveTo(line, top);
    ctx.lineTo(line, top + h);
    ctx.stroke();
  }
}

function drawSign(ctx: CanvasRenderingContext2D, view: View): void {
  const w = view.w * 0.58;
  const h = view.w * 0.135;
  const x = (view.w - w) / 2;
  const y = stallTop(view) + view.w * 0.04;
  ctx.strokeStyle = "#6b3e22";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 18, y);
  ctx.lineTo(x + 18, y - view.h * 0.03);
  ctx.moveTo(x + w - 18, y);
  ctx.lineTo(x + w - 18, y - view.h * 0.03);
  ctx.stroke();
  roundRect(ctx, x, y, w, h, 14);
  const board = ctx.createLinearGradient(x, y, x, y + h);
  board.addColorStop(0, "#c73745");
  board.addColorStop(1, "#8d1c2c");
  ctx.fillStyle = board;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#f0d48a";
  ctx.stroke();
  ctx.fillStyle = "#fff4d8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${Math.round(h * 0.48)}px RingDisplay, RingText, "WenQuanYi Micro Hei", sans-serif`;
  ctx.fillText("套圈夜市", x + w / 2, y + h * 0.54);
}

function drawDeck(ctx: CanvasRenderingContext2D, view: View): void {
  const front = project({ x: 0, z: TABLE.z0 }, view);
  const deck = ctx.createLinearGradient(0, front.sy, 0, view.h);
  deck.addColorStop(0, "#4a2c1c");
  deck.addColorStop(1, "#1a0e12");
  ctx.fillStyle = deck;
  ctx.fillRect(0, front.sy - 6, view.w, view.h - front.sy + 8);
}

function drawTable(ctx: CanvasRenderingContext2D, view: View): void {
  traceTable(ctx, view, 0);
  ctx.fillStyle = "#6a4124";
  ctx.fill();
  const near = project({ x: 0, z: TABLE.z0 }, view);
  const lip = ctx.createLinearGradient(0, near.sy - 8, 0, near.sy + 18);
  lip.addColorStop(0, "#8a5a34");
  lip.addColorStop(1, "#3e2416");
  ctx.fillStyle = lip;
  ctx.fillRect(view.w * 0.04, near.sy - 4, view.w * 0.92, 16);
  traceTable(ctx, view, 0.055);
  const cloth = ctx.createLinearGradient(0, project({ x: 0, z: TABLE.z1 }, view).sy, 0, near.sy);
  cloth.addColorStop(0, "#8e1d32");
  cloth.addColorStop(0.55, "#c43448");
  cloth.addColorStop(1, "#e15a62");
  ctx.fillStyle = cloth;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = "#fff6e4";
  ctx.lineWidth = 1;
  const far = project({ x: 0, z: TABLE.z1 }, view);
  for (let i = -8; i < 16; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 28, far.sy);
    ctx.lineTo(i * 28 + 160, near.sy);
    ctx.stroke();
  }
  ctx.restore();
  traceTable(ctx, view, 0.055);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(240, 212, 138, 0.85)";
  ctx.stroke();
  const glow = ctx.createRadialGradient(view.w / 2, (far.sy + near.sy) / 2, 10, view.w / 2, near.sy, view.w * 0.55);
  glow.addColorStop(0, "rgba(255, 220, 150, 0.16)");
  glow.addColorStop(1, "rgba(255, 220, 150, 0)");
  ctx.fillStyle = glow;
  ctx.fill();
}

function drawPrizes(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: View,
  time: number,
  targetId: string | null,
): void {
  const ordered = [...state.prizes].sort((a, b) => b.z - a.z);
  for (const [index, prize] of ordered.entries()) {
    const base = project(prize, view);
    const bob = state.reducedMotion ? 0 : Math.sin(time * 2 + index) * 3.5;
    const pop = 1 + prize.flash * 0.16;
    const icon = view.w * 0.125 * pop;
    ctx.fillStyle = "rgba(40, 10, 16, 0.28)";
    ctx.beginPath();
    ctx.ellipse(base.sx, base.sy + 5, icon * 0.28, icon * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    if (prize.id === targetId || prize.flash > 0) {
      ctx.fillStyle = prize.flash > 0 ? "rgba(255, 214, 120, 0.45)" : "rgba(80, 220, 170, 0.28)";
      ctx.beginPath();
      ctx.arc(base.sx, base.sy - icon * 0.42 - bob, icon * 0.46, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPeg(ctx, base.sx, base.sy, prize.peg * base.px);
    drawIcon(ctx, prize.id, base.sx, base.sy - bob, icon);
  }
}

function drawPeg(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number): void {
  const ry = rx * FORESHORTEN;
  ctx.fillStyle = "#6b3f22";
  ctx.fillRect(x - rx * 0.28, y - ry * 3.1, rx * 0.56, ry * 3.1);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#e0b072";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#5a3218";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.25, y - ry * 0.2, rx * 0.28, ry * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: View,
  picked: { hit: { id: string } | null; close: boolean } | null,
): void {
  const landing = aimedLanding(state);
  if (!landing || !state.aim) return;
  const flight = makeFlight(landing, state.aim.power, state.reducedMotion);
  ctx.beginPath();
  for (let i = 0; i <= 28; i += 1) {
    const point = project(sampleFlight(flight, i / 28), view);
    if (i === 0) ctx.moveTo(point.sx, point.sy);
    else ctx.lineTo(point.sx, point.sy);
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 220, 140, 0.75)";
  ctx.stroke();
  const ground = project({ ...landing, y: 0 }, view);
  const hole = holeRadii(view);
  const outerRx = hole.rx / RING_INNER_RATIO;
  const outerRy = hole.ry / RING_INNER_RATIO;
  const palette = picked?.hit
    ? { fill: "rgba(47, 206, 160, 0.28)", stroke: "#b9ffe8" }
    : picked?.close
      ? { fill: "rgba(255, 176, 32, 0.24)", stroke: "#ffd27a" }
      : { fill: "rgba(255, 246, 228, 0.12)", stroke: "#ffe3a3" };
  drawRing(ctx, ground.sx, ground.sy, outerRx, outerRy, 0.95, palette.fill, palette.stroke);
}

function drawFlight(ctx: CanvasRenderingContext2D, state: GameState, view: View): void {
  const flight = state.flight;
  if (!flight) return;
  const t = Math.min(1, flight.elapsed / flight.duration);
  const point = sampleFlight(flight, t);
  const shadow = project({ x: point.x, z: point.z, y: 0 }, view);
  const air = project(point, view);
  const height = Math.min(1, point.y / 0.8);
  const hole = holeRadii(view);
  ctx.globalAlpha = 0.28 * (1 - height * 0.55);
  ctx.fillStyle = "#1a0a10";
  ctx.beginPath();
  ctx.ellipse(shadow.sx, shadow.sy, hole.rx * (1.15 - height * 0.2), hole.ry * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const flat = t > 0.86 ? (t - 0.86) / 0.14 : 0;
  const rx = (hole.rx / RING_INNER_RATIO) * (1 + point.y * 0.18);
  const ry = rx * (1 - flat) + (hole.ry / RING_INNER_RATIO) * flat;
  ctx.save();
  ctx.translate(air.sx, air.sy);
  ctx.rotate(point.spin);
  drawRing(ctx, 0, 0, rx, ry, 1, "#e2263c", "#f8d78a");
  ctx.restore();
}

function drawHeldRing(ctx: CanvasRenderingContext2D, state: GameState, view: View, time: number): void {
  const bob = state.reducedMotion || state.aim ? 0 : Math.sin(time * 2.4) * 0.012;
  let x = HAND.x;
  let y = HAND.y + bob;
  if (state.aim && !state.reducedMotion) {
    const landing = aimedLanding(state);
    if (landing) x -= landing.x * 0.04;
    y -= state.aim.power * 0.03;
  }
  const pos = project({ x, z: HAND.z, y }, view);
  const hole = holeRadii(view);
  const scale = 1.22;
  drawRing(
    ctx,
    pos.sx,
    pos.sy,
    (hole.rx / RING_INNER_RATIO) * scale,
    (hole.rx / RING_INNER_RATIO) * scale * 0.92,
    1,
    "#e2263c",
    "#f8d78a",
  );
}

function drawSettled(ctx: CanvasRenderingContext2D, state: GameState, view: View): void {
  const hole = holeRadii(view);
  for (const ring of state.settled) {
    const pos = project(ring, view);
    const alpha = Math.min(1, ring.life / 0.28);
    ctx.save();
    ctx.translate(pos.sx, pos.sy);
    ctx.rotate(ring.spin);
    drawRing(
      ctx,
      0,
      0,
      hole.rx / RING_INNER_RATIO,
      hole.ry / RING_INNER_RATIO,
      alpha,
      ring.hit ? "#d3183a" : "#a32034",
      "#f0d48a",
    );
    ctx.restore();
  }
}

function drawTray(ctx: CanvasRenderingContext2D, view: View): void {
  const x = view.w * 0.5;
  const y = view.h * 0.925;
  const h = view.h * 0.032;
  roundRect(ctx, x - view.w * 0.22, y, view.w * 0.44, h, 12);
  ctx.fillStyle = "#5c351e";
  ctx.fill();
  ctx.strokeStyle = "#c89658";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const hole = holeRadii(view);
  for (const offset of [-0.12, 0.12]) {
    drawRing(
      ctx,
      x + view.w * offset,
      y + h * 0.55,
      hole.rx * 0.42,
      hole.rx * 0.3,
      0.95,
      "#b61d34",
      "#f0d48a",
    );
  }
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number,
  fill: string,
  stroke: string,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.ellipse(x, y, rx * RING_INNER_RATIO, ry * RING_INNER_RATIO, 0, 0, Math.PI * 2, true);
  const gradient = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  gradient.addColorStop(0, "#ff8b8b");
  gradient.addColorStop(0.45, fill);
  gradient.addColorStop(1, "#7c1020");
  ctx.fillStyle = gradient;
  ctx.fill("evenodd");
  ctx.lineWidth = Math.max(1.5, rx * 0.06);
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPower(ctx: CanvasRenderingContext2D, view: View, power: number): void {
  const x = view.w * 0.07;
  const h = view.h * 0.16;
  const y = view.h * 0.7;
  const w = 12;
  roundRect(ctx, x, y - h, w, h, 6);
  ctx.fillStyle = "rgba(20, 10, 16, 0.45)";
  ctx.fill();
  const fillH = h * power;
  roundRect(ctx, x, y - fillH, w, Math.max(fillH, 0), 6);
  ctx.fillStyle = power > 0.82 ? "#ff5d6c" : "#ffc857";
  ctx.fill();
  ctx.fillStyle = "#fff6e4";
  ctx.font = `700 ${Math.round(view.w * 0.03)}px RingText, "WenQuanYi Micro Hei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("力度", x + w / 2, y - h - 6);
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx): void {
  for (const particle of fx.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts(ctx: CanvasRenderingContext2D, fx: Fx, view: View): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const text of fx.texts) {
    const alpha = Math.max(0, text.life / text.max);
    ctx.globalAlpha = alpha;
    const scoreSize = Math.round(view.w * 0.07);
    ctx.font = `700 ${scoreSize}px RingText, "WenQuanYi Micro Hei", sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(48, 16, 20, 0.8)";
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillStyle = "#fff3cf";
    ctx.fillText(text.text, text.x, text.y);
    if (text.sub) {
      ctx.font = `700 ${Math.round(view.w * 0.04)}px RingText, "WenQuanYi Micro Hei", sans-serif`;
      const subY = text.y - scoreSize * 0.85;
      ctx.strokeText(text.sub, text.x, subY);
      ctx.fillStyle = "#ffe08a";
      ctx.fillText(text.sub, text.x, subY);
    }
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D, view: View): void {
  const vignette = ctx.createRadialGradient(
    view.w / 2,
    view.h * 0.45,
    view.w * 0.3,
    view.w / 2,
    view.h * 0.5,
    view.h * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, view.w, view.h);
}

function drawDebugZones(ctx: CanvasRenderingContext2D, state: GameState, view: View): void {
  ctx.save();
  ctx.strokeStyle = "rgba(80, 255, 190, 0.55)";
  ctx.lineWidth = 1;
  for (const prize of state.prizes) {
    const pos = project(prize, view);
    const radius = winRadius(prize.peg);
    ctx.beginPath();
    ctx.ellipse(pos.sx, pos.sy, radius * pos.px, radius * pos.px * FORESHORTEN, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, id: PrizeId, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  if (id === "tanghulu") iconTanghulu(ctx);
  else if (id === "pinwheel") iconPinwheel(ctx);
  else if (id === "rabbit") iconRabbit(ctx);
  else if (id === "knot") iconKnot(ctx);
  else if (id === "panda") iconPanda(ctx);
  else if (id === "lantern") iconLantern(ctx);
  else if (id === "koi") iconKoi(ctx);
  else iconIngot(ctx);
  ctx.restore();
}

function iconTanghulu(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#6b3e22";
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(0, 0.02);
  ctx.lineTo(0, -0.95);
  ctx.stroke();
  for (const cy of [-0.28, -0.55, -0.82]) {
    ctx.beginPath();
    ctx.arc(0, cy, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = cy === -0.55 ? "#ff4d5a" : "#d72538";
    ctx.fill();
    ctx.strokeStyle = "#7a1020";
    ctx.lineWidth = 0.02;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(-0.05, cy - 0.05, 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

function iconPinwheel(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#6b3e22";
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -0.42);
  ctx.stroke();
  const colors = ["#49c4d4", "#ffd15c", "#ff6b8a", "#7dE38a"];
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(0, -0.68);
    ctx.rotate((Math.PI / 2) * i);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0.22, -0.08, 0.02, -0.32);
    ctx.quadraticCurveTo(-0.02, -0.12, 0, 0);
    ctx.fillStyle = colors[i] ?? "#fff";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, -0.68, 0.06, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6e4";
  ctx.fill();
}

function iconRabbit(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#fff8f2";
  ctx.strokeStyle = "#6d5348";
  ctx.lineWidth = 0.02;
  ear(-0.1, ctx);
  ear(0.1, ctx);
  ctx.beginPath();
  ctx.ellipse(0, -0.32, 0.26, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff9eb5";
  ctx.beginPath();
  ctx.arc(-0.1, -0.3, 0.04, 0, Math.PI * 2);
  ctx.arc(0.1, -0.3, 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a241c";
  ctx.beginPath();
  ctx.arc(-0.08, -0.4, 0.025, 0, Math.PI * 2);
  ctx.arc(0.08, -0.4, 0.025, 0, Math.PI * 2);
  ctx.fill();
}

function ear(x: number, ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(x, -0.72, 0.07, 0.2, x > 0 ? 0.3 : -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#fff8f2";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, -0.72, 0.03, 0.12, x > 0 ? 0.3 : -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffb3c4";
  ctx.fill();
}

function iconKnot(ctx: CanvasRenderingContext2D): void {
  ctx.translate(0, -0.58);
  ctx.strokeStyle = "#d5162e";
  ctx.fillStyle = "#ff4b5c";
  ctx.lineWidth = 0.055;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(0, 0, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.14, -0.14);
  ctx.lineTo(0.14, 0.14);
  ctx.moveTo(0.14, -0.14);
  ctx.lineTo(-0.14, 0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 0.06, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.06, 0.18);
    ctx.lineTo(side * 0.08, 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 0.02, 0.42);
    ctx.lineTo(side * 0.08, 0.52);
    ctx.lineTo(side * 0.14, 0.42);
    ctx.closePath();
    ctx.fill();
  }
}

function iconPanda(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(-0.18, -0.78, 0.12, 0, Math.PI * 2);
  ctx.arc(0.18, -0.78, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -0.52, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf4";
  ctx.fill();
  ctx.strokeStyle = "#1c1c1c";
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.ellipse(-0.11, -0.54, 0.08, 0.1, -0.4, 0, Math.PI * 2);
  ctx.ellipse(0.11, -0.54, 0.08, 0.1, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-0.11, -0.56, 0.03, 0, Math.PI * 2);
  ctx.arc(0.11, -0.56, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(0, -0.42, 0.035, 0, Math.PI * 2);
  ctx.fill();
}

function iconLantern(ctx: CanvasRenderingContext2D): void {
  roundRect(ctx, -0.16, -0.92, 0.32, 0.1, 0.03);
  ctx.fillStyle = "#f0d48a";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.28, -0.78);
  ctx.quadraticCurveTo(-0.34, -0.45, -0.2, -0.22);
  ctx.lineTo(0.2, -0.22);
  ctx.quadraticCurveTo(0.34, -0.45, 0.28, -0.78);
  ctx.closePath();
  const body = ctx.createLinearGradient(-0.3, 0, 0.3, 0);
  body.addColorStop(0, "#ff6a6a");
  body.addColorStop(0.5, "#d5162e");
  body.addColorStop(1, "#8d1222");
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 230, 170, 0.7)";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.08, -0.78);
  ctx.lineTo(-0.05, -0.22);
  ctx.moveTo(0.08, -0.78);
  ctx.lineTo(0.05, -0.22);
  ctx.stroke();
  roundRect(ctx, -0.16, -0.22, 0.32, 0.08, 0.03);
  ctx.fillStyle = "#f0d48a";
  ctx.fill();
  ctx.strokeStyle = "#f0d48a";
  ctx.beginPath();
  ctx.moveTo(0, -0.14);
  ctx.lineTo(0, 0.02);
  ctx.stroke();
}

function iconKoi(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-0.34, -0.42);
  ctx.quadraticCurveTo(0.05, -0.85, 0.32, -0.48);
  ctx.quadraticCurveTo(0.1, -0.38, 0.32, -0.22);
  ctx.quadraticCurveTo(-0.05, -0.05, -0.34, -0.42);
  ctx.fillStyle = "#ff7a32";
  ctx.fill();
  ctx.strokeStyle = "#8a3414";
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.34, -0.42);
  ctx.lineTo(-0.5, -0.62);
  ctx.lineTo(-0.46, -0.4);
  ctx.lineTo(-0.52, -0.22);
  ctx.closePath();
  ctx.fillStyle = "#ffb15a";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0.16, -0.5, 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(0.17, -0.5, 0.016, 0, Math.PI * 2);
  ctx.fill();
}

function iconIngot(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-0.36, -0.22);
  ctx.quadraticCurveTo(-0.46, -0.62, -0.08, -0.5);
  ctx.quadraticCurveTo(0, -0.78, 0.08, -0.5);
  ctx.quadraticCurveTo(0.46, -0.62, 0.36, -0.22);
  ctx.quadraticCurveTo(0, -0.02, -0.36, -0.22);
  const gold = ctx.createLinearGradient(0, -0.7, 0, -0.05);
  gold.addColorStop(0, "#fff1b0");
  gold.addColorStop(0.45, "#f0c14b");
  gold.addColorStop(1, "#c4841c");
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = "#8a5a10";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-0.12, -0.48, 0.06, 0.03, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function stallTop(view: View): number {
  const far = project({ x: 0, z: TABLE.z1 }, view);
  return far.sy - view.w * 0.34;
}

function traceTable(ctx: CanvasRenderingContext2D, view: View, inset: number): void {
  const x = TABLE.x - inset;
  const z0 = TABLE.z0 + inset * 0.35;
  const z1 = TABLE.z1 - inset * 0.35;
  const corners = [
    project({ x: -x, z: z1 }, view),
    project({ x, z: z1 }, view),
    project({ x, z: z0 }, view),
    project({ x: -x, z: z0 }, view),
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0]?.sx ?? 0, corners[0]?.sy ?? 0);
  for (const corner of corners.slice(1)) ctx.lineTo(corner.sx, corner.sy);
  ctx.closePath();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function buildStars(): { x: number; y: number; size: number; phase: number }[] {
  const stars = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 32; i += 1) {
    stars.push({ x: rand(), y: rand() * 0.16, size: 1 + rand() * 1.8, phase: rand() * Math.PI * 2 });
  }
  return stars;
}
