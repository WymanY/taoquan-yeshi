export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  sub: string;
  life: number;
  max: number;
}

export interface Fx {
  particles: Particle[];
  texts: FloatText[];
  shake: number;
}

export function createFx(): Fx {
  return { particles: [], texts: [], shake: 0 };
}

export function resetFx(fx: Fx): void {
  fx.particles.length = 0;
  fx.texts.length = 0;
  fx.shake = 0;
}

export function spawnHit(fx: Fx, x: number, y: number, reducedMotion: boolean): void {
  fx.shake = reducedMotion ? 0 : 8;
  if (reducedMotion) return;
  const colors = ["#ffe08a", "#ff5d6c", "#fff6e4", "#ffb703"];
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16 + 0.2;
    const speed = 70 + (i % 4) * 24;
    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.55,
      max: 0.55,
      color: colors[i % colors.length] ?? "#ffe08a",
      size: 3 + (i % 3),
    });
  }
  trim(fx);
}

export function spawnText(fx: Fx, x: number, y: number, text: string, sub: string): void {
  fx.texts.push({ x, y, text, sub, life: 0.95, max: 0.95 });
  if (fx.texts.length > 8) fx.texts.splice(0, fx.texts.length - 8);
}

export function updateFx(fx: Fx, dt: number): void {
  fx.shake = Math.max(0, fx.shake - dt * 30);
  for (const particle of fx.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 220 * dt;
    particle.life -= dt;
  }
  fx.particles = fx.particles.filter((particle) => particle.life > 0);
  for (const text of fx.texts) {
    text.y -= 42 * dt;
    text.life -= dt;
  }
  fx.texts = fx.texts.filter((text) => text.life > 0);
}

function trim(fx: Fx): void {
  if (fx.particles.length > 80) fx.particles.splice(0, fx.particles.length - 80);
}
