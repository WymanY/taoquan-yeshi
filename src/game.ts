import { clamp } from "./math.ts";
import { MIN_POWER, ROUND_SECONDS } from "./tune.ts";
import {
  landingFromAim,
  makeFlight,
  pickTarget,
  PRIZES,
  type Flight,
  type Point,
  type PrizeDef,
} from "./world.ts";

export interface Prize extends PrizeDef {
  flash: number;
}

export interface SettledRing {
  x: number;
  z: number;
  life: number;
  hit: boolean;
  spin: number;
}

export type Phase = "title" | "playing" | "results";

export interface GameState {
  phase: Phase;
  timeLeft: number;
  score: number;
  combo: number;
  bestCombo: number;
  ringed: number;
  throws: number;
  best: number;
  newRecord: boolean;
  reducedMotion: boolean;
  prizes: Prize[];
  aim: { aimX: number; power: number } | null;
  flight: Flight | null;
  settled: SettledRing[];
}

export type GameEvent =
  | { type: "start" }
  | { type: "throw"; power: number }
  | { type: "hit"; name: string; points: number; mult: number; x: number; z: number }
  | { type: "close"; x: number; z: number }
  | { type: "miss"; x: number; z: number }
  | { type: "tick" }
  | { type: "end"; best: boolean }
  | { type: "cancel" }
  | { type: "weak" }
  | { type: "banner"; text: string };

export interface Step {
  state: GameState;
  events: GameEvent[];
}

export function createGame(options?: { reducedMotion?: boolean; best?: number }): GameState {
  return blank({
    best: options?.best ?? 0,
    reducedMotion: options?.reducedMotion ?? false,
    phase: "title",
  });
}

export function startRound(state: GameState): Step {
  return { state: blank({ best: state.best, reducedMotion: state.reducedMotion, phase: "playing" }), events: [{ type: "start" }] };
}

export function showHelp(state: GameState): Step {
  const next = clone(state);
  next.phase = "title";
  next.aim = null;
  next.flight = null;
  return { state: next, events: [] };
}

export function setReducedMotion(state: GameState, reducedMotion: boolean): Step {
  const next = clone(state);
  next.reducedMotion = reducedMotion;
  return { state: next, events: [] };
}

export function beginAim(state: GameState): Step {
  if (!canAim(state) || state.aim) return { state, events: [] };
  const next = clone(state);
  next.aim = { aimX: 0, power: 0 };
  return { state: next, events: [] };
}

export function updateAim(state: GameState, aimX: number, power: number): Step {
  if (!state.aim || !canAim(state)) return { state, events: [] };
  const next = clone(state);
  next.aim = { aimX: clamp(aimX, -1, 1), power: clamp(power, 0, 1) };
  return { state: next, events: [] };
}

export function cancelAim(state: GameState): Step {
  if (!state.aim) return { state, events: [] };
  const next = clone(state);
  next.aim = null;
  return { state: next, events: [{ type: "cancel" }] };
}

export function release(state: GameState): Step {
  if (!state.aim || !canAim(state)) {
    if (!state.aim) return { state, events: [] };
    const next = clone(state);
    next.aim = null;
    return { state: next, events: [{ type: "cancel" }] };
  }
  const next = clone(state);
  const power = next.aim?.power ?? 0;
  const aimX = next.aim?.aimX ?? 0;
  next.aim = null;
  if (power < MIN_POWER) {
    return { state: next, events: [power > 0.02 ? { type: "weak" } : { type: "cancel" }] };
  }
  const landing = landingFromAim(aimX, power);
  next.flight = makeFlight(landing, power, next.reducedMotion);
  next.throws += 1;
  return { state: next, events: [{ type: "throw", power }] };
}

export function tick(state: GameState, dt: number): Step {
  if (!Number.isFinite(dt) || dt <= 0) return { state, events: [] };
  const step = Math.min(dt, 1);
  const next = clone(state);
  const events: GameEvent[] = [];
  decay(next, step);
  if (next.phase === "playing") {
    const previousShown = Math.ceil(Math.max(state.timeLeft, 0));
    next.timeLeft = Math.max(0, next.timeLeft - step);
    if (next.flight) {
      next.flight.elapsed += step;
      if (next.flight.elapsed >= next.flight.duration) resolveFlight(next, events);
    }
    const shown = next.timeLeft <= 0 ? 0 : Math.ceil(next.timeLeft);
    if (shown < previousShown && shown >= 1 && shown <= 5) events.push({ type: "tick" });
    if (next.timeLeft <= 0 && !next.flight) finishRound(next, events);
  }
  return { state: next, events };
}

export function aimedLanding(state: GameState): Point | null {
  if (!state.aim) return null;
  return landingFromAim(state.aim.aimX, state.aim.power);
}

function canAim(state: GameState): boolean {
  return state.phase === "playing" && !state.flight && state.timeLeft > 0;
}

function finishRound(state: GameState, events: GameEvent[]): void {
  state.aim = null;
  state.phase = "results";
  const record = state.score > state.best;
  if (record) state.best = state.score;
  state.newRecord = record;
  events.push({ type: "end", best: record });
}

function resolveFlight(state: GameState, events: GameEvent[]): void {
  const flight = state.flight;
  if (!flight) return;
  const landing = flight.landing;
  const picked = pickTarget(landing, state.prizes);
  state.flight = null;
  if (picked.hit) {
    const mult = Math.min(3, state.combo + 1);
    const gained = picked.hit.points * mult;
    state.score += gained;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.ringed += 1;
    const prize = state.prizes.find((item) => item.id === picked.hit?.id);
    if (prize) prize.flash = 0.7;
    state.settled.push({ x: picked.hit.x, z: picked.hit.z, life: 0.72, hit: true, spin: 0 });
    events.push({
      type: "hit",
      name: picked.hit.name,
      points: gained,
      mult,
      x: picked.hit.x,
      z: picked.hit.z,
    });
    if (state.combo === 3) events.push({ type: "banner", text: "手感来了" });
    if (state.combo === 5) events.push({ type: "banner", text: "停不下来" });
  } else {
    state.combo = 0;
    state.settled.push({
      x: landing.x,
      z: landing.z,
      life: 0.48,
      hit: false,
      spin: (state.throws * 1.3) % Math.PI,
    });
    events.push(picked.close ? { type: "close", x: landing.x, z: landing.z } : { type: "miss", x: landing.x, z: landing.z });
  }
  if (state.settled.length > 6) state.settled.splice(0, state.settled.length - 6);
}

function decay(state: GameState, dt: number): void {
  for (const prize of state.prizes) prize.flash = Math.max(0, prize.flash - dt);
  state.settled = state.settled
    .map((ring) => ({ ...ring, life: ring.life - dt }))
    .filter((ring) => ring.life > 0);
}

function blank(seed: { best: number; reducedMotion: boolean; phase: Phase }): GameState {
  return {
    phase: seed.phase,
    timeLeft: ROUND_SECONDS,
    score: 0,
    combo: 0,
    bestCombo: 0,
    ringed: 0,
    throws: 0,
    best: seed.best,
    newRecord: false,
    reducedMotion: seed.reducedMotion,
    prizes: PRIZES.map((prize) => ({ ...prize, flash: 0 })),
    aim: null,
    flight: null,
    settled: [],
  };
}

function clone(state: GameState): GameState {
  return {
    ...state,
    prizes: state.prizes.map((prize) => ({ ...prize })),
    aim: state.aim ? { ...state.aim } : null,
    flight: state.flight
      ? {
          ...state.flight,
          start: { ...state.flight.start },
          landing: { ...state.flight.landing },
        }
      : null,
    settled: state.settled.map((ring) => ({ ...ring })),
  };
}
