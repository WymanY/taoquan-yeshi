import { deltaForAim } from "./aim.ts";
import { Sfx } from "./audio.ts";
import {
  beginAim,
  cancelAim,
  createGame,
  release,
  setReducedMotion,
  showHelp,
  startRound,
  tick,
  updateAim,
  type GameEvent,
  type GameState,
  type Step,
} from "./game.ts";
import { createFx, resetFx, spawnHit, spawnText, updateFx, type Fx } from "./fx.ts";
import { formatTime, rankFor, readNumber, shownSeconds } from "./format.ts";
import { reducePointer, type PointerAction, type PointerLike, type PointerSession } from "./pointer.ts";
import { render } from "./render.ts";
import { BEST_KEY, MUTE_KEY } from "./tune.ts";
import { aimForLanding, project, type View } from "./world.ts";
import "./style.css";

interface RingDebug {
  snapshot: () => {
    phase: GameState["phase"];
    score: number;
    timeLeft: number;
    combo: number;
    bestCombo: number;
    ringed: number;
    throws: number;
    best: number;
    newRecord: boolean;
    aiming: boolean;
    flying: boolean;
    paused: boolean;
    reducedMotion: boolean;
    aimPower: number;
  };
  setTimeLeft: (seconds: number) => void;
  setPaused: (value: boolean) => void;
  dragDeltaFor: (x: number, z: number) => { dx: number; dy: number };
  prizes: () => { id: string; name: string; x: number; z: number; points: number }[];
}

declare global {
  interface Window {
    __RING_TOSS__?: RingDebug;
  }
}

const frame = must<HTMLElement>("#frame");
const canvas = must<HTMLCanvasElement>("#game");
const ctx = canvas.getContext("2d");
const errorEl = must<HTMLElement>("#boot-error");
if (!ctx) {
  errorEl.hidden = false;
  throw new Error("无法创建画布");
}
const context = ctx;

const scoreEl = must<HTMLElement>("#score");
const timerEl = must<HTMLElement>("#timer");
const comboEl = must<HTMLElement>("#combo");
const hintEl = must<HTMLElement>("#hint");
const bannerEl = must<HTMLElement>("#banner");
const pauseEl = must<HTMLElement>("#pause");
const liveEl = must<HTMLElement>("#live");
const bestEl = must<HTMLElement>("#best");
const finalScoreEl = must<HTMLElement>("#final-score");
const detailEl = must<HTMLElement>("#detail");
const rankEl = must<HTMLElement>("#rank");
const rankLineEl = must<HTMLElement>("#rank-line");
const recordEl = must<HTMLElement>("#record");
const muteBtn = must<HTMLButtonElement>("#mute");
const startBtn = must<HTMLButtonElement>("#start");
const restartBtn = must<HTMLButtonElement>("#restart");
const helpBtn = must<HTMLButtonElement>("#help");

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const sfx = new Sfx(readMuted());
const fx: Fx = createFx();
const view: View = { w: 1, h: 1 };
let state = createGame({ reducedMotion: motionQuery.matches, best: readBest() });
let paused = document.hidden;
let anim = 0;
let bannerTimer = 0;
let lastLive = "";
const params = new URLSearchParams(location.search);
const debug = params.has("debug");
const showZones = params.has("zones");

bindPointer(canvas, onPointer);
startBtn.addEventListener("click", () => apply(startRound(state)));
restartBtn.addEventListener("click", () => apply(startRound(state)));
helpBtn.addEventListener("click", () => apply(showHelp(state)));
muteBtn.addEventListener("click", () => {
  sfx.muted = !sfx.muted;
  writeMuted(sfx.muted);
  syncDom();
});
motionQuery.addEventListener("change", () => {
  apply(setReducedMotion(state, motionQuery.matches));
});
document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
  syncDom();
});

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const bufferW = Math.round(width * dpr);
  const bufferH = Math.round(height * dpr);
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.w = width;
  view.h = height;
};
resize();
const observer = new ResizeObserver(() => resize());
observer.observe(canvas);
window.addEventListener("resize", resize);

if (debug) {
  window.__RING_TOSS__ = {
    snapshot: () => ({
      phase: state.phase,
      score: state.score,
      timeLeft: state.timeLeft,
      combo: state.combo,
      bestCombo: state.bestCombo,
      ringed: state.ringed,
      throws: state.throws,
      best: state.best,
      newRecord: state.newRecord,
      aiming: Boolean(state.aim),
      flying: Boolean(state.flight),
      paused,
      reducedMotion: state.reducedMotion,
      aimPower: state.aim?.power ?? 0,
    }),
    setTimeLeft: (seconds: number) => {
      state = { ...state, timeLeft: seconds };
      syncDom();
    },
    setPaused: (value: boolean) => {
      paused = value;
      syncDom();
    },
    dragDeltaFor: (x: number, z: number) => {
      const aim = aimForLanding({ x, z });
      const rect = canvas.getBoundingClientRect();
      return deltaForAim(aim.aimX, aim.power, rect);
    },
    prizes: () => state.prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      x: prize.x,
      z: prize.z,
      points: prize.points,
    })),
  };
}

void document.fonts.load("16px RingText").catch(() => undefined);
void document.fonts.load("16px RingDisplay").catch(() => undefined);

syncDom();
let last = performance.now();
requestAnimationFrame(function frame(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!paused) {
    anim += dt;
    apply(tick(state, dt));
    updateFx(fx, dt);
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.hidden = true;
    }
  }
  render(context, state, view, fx, anim, showZones);
  requestAnimationFrame(frame);
});

function onPointer(action: PointerAction): void {
  if (state.phase !== "playing") return;
  if (action.type === "aim") {
    const began = state.aim ? state : beginAim(state).state;
    if (!began.aim) return;
    apply(updateAim(began, action.aimX, action.power));
    return;
  }
  if (action.type === "throw") {
    const began = state.aim ? state : beginAim(state).state;
    apply(release(updateAim(began, action.aimX, action.power).state));
    return;
  }
  apply(cancelAim(state));
}

function apply(step: Step): void {
  state = step.state;
  for (const event of step.events) handleEvent(event);
  syncDom();
}

function handleEvent(event: GameEvent): void {
  switch (event.type) {
    case "start":
      resetFx(fx);
      sfx.start();
      break;
    case "throw":
      sfx.toss();
      break;
    case "hit": {
      sfx.hit(event.mult);
      const spot = floatAnchor(event.x, event.z);
      spawnHit(fx, spot.sx, spot.sy, state.reducedMotion);
      spawnText(
        fx,
        spot.sx,
        spot.sy,
        `+${event.points}`,
        event.mult > 1 ? `${event.name} ×${event.mult}` : event.name,
      );
      break;
    }
    case "close": {
      sfx.close();
      const spot = floatAnchor(event.x, event.z);
      spawnText(fx, spot.sx, spot.sy, "差一点！", "");
      break;
    }
    case "miss":
      sfx.miss();
      break;
    case "tick":
      sfx.tick();
      break;
    case "end":
      sfx.end();
      if (event.best) writeBest(state.best);
      break;
    case "weak":
      showBanner("再向上拖一点");
      break;
    case "banner":
      showBanner(event.text);
      break;
    case "cancel":
      break;
    default: {
      const neverEvent: never = event;
      return neverEvent;
    }
  }
}

function floatAnchor(x: number, z: number): { sx: number; sy: number } {
  const peg = project({ x, z, y: 0 }, view);
  const lifted = peg.sy - view.w * 0.18;
  return {
    sx: peg.sx,
    sy: Math.min(peg.sy - 28, Math.max(lifted, view.h * 0.42)),
  };
}

function showBanner(text: string): void {
  bannerEl.textContent = text;
  bannerEl.hidden = false;
  bannerTimer = 1.15;
}

function syncDom(): void {
  frame.dataset.phase = state.phase;
  scoreEl.textContent = String(state.score);
  timerEl.textContent = formatTime(state.timeLeft);
  const seconds = shownSeconds(state.timeLeft);
  timerEl.classList.toggle("urgent", state.phase === "playing" && seconds > 0 && seconds <= 5);
  if (state.combo >= 2) {
    comboEl.hidden = false;
    comboEl.textContent = `连击 ×${state.combo}`;
  } else {
    comboEl.hidden = true;
  }
  hintEl.hidden = state.phase !== "playing";
  pauseEl.hidden = !(paused && state.phase === "playing");
  bestEl.hidden = state.best <= 0;
  bestEl.textContent = state.best > 0 ? `最高分 ${state.best}` : "";
  if (state.phase === "results") {
    const rank = rankFor(state.score);
    finalScoreEl.textContent = String(state.score);
    detailEl.textContent = `套中 ${state.ringed} 件 · 最高连击 ×${state.bestCombo}`;
    rankEl.textContent = rank.title;
    rankLineEl.textContent = rank.line;
    recordEl.hidden = false;
    recordEl.textContent = state.newRecord ? "新纪录！" : state.best > 0 ? `最高分 ${state.best}` : "再试一次就有感觉";
  }
  muteBtn.setAttribute("aria-pressed", sfx.muted ? "true" : "false");
  muteBtn.textContent = sfx.muted ? "音效关" : "音效开";
  const live = state.phase === "playing"
    ? `得分 ${state.score}，剩余 ${formatTime(state.timeLeft)}`
    : state.phase === "results"
      ? `时间到，得分 ${state.score}`
      : "";
  if (live && live !== lastLive) {
    liveEl.textContent = live;
    lastLive = live;
  }
}

function bindPointer(target: HTMLCanvasElement, onAction: (action: PointerAction) => void): void {
  let session: PointerSession | null = null;
  const handler = (event: PointerEvent) => {
    if (event.type === "pointerdown") event.preventDefault();
    const rect = target.getBoundingClientRect();
    const next = reducePointer(
      session,
      {
        type: event.type as PointerLike["type"],
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        pointerType: event.pointerType,
      },
      { width: rect.width, height: rect.height },
    );
    session = next.session;
    if (event.type === "pointerdown" && next.action) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events and a few mobile browsers reject capture.
      }
    }
    if (next.action) onAction(next.action);
  };
  target.addEventListener("pointerdown", handler);
  target.addEventListener("pointermove", handler);
  target.addEventListener("pointerup", handler);
  target.addEventListener("pointercancel", handler);
  target.addEventListener("contextmenu", (event) => event.preventDefault());
}

function readBest(): number {
  try {
    return readNumber(localStorage.getItem(BEST_KEY));
  } catch {
    return 0;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(value)));
  } catch {
    // Storage can throw in private mode.
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage can throw in private mode.
  }
}

function must<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`缺少 ${selector}`);
  return element as T;
}
