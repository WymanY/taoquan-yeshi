import { describe, expect, it } from "vitest";
import { deltaForAim, pointerDeltaToAim } from "./aim.ts";
import { formatTime, rankFor } from "./format.ts";
import {
  beginAim,
  cancelAim,
  createGame,
  release,
  showHelp,
  startRound,
  tick,
  updateAim,
  type GameEvent,
  type GameState,
} from "./game.ts";
import { reducePointer, type PointerLike, type PointerSession } from "./pointer.ts";
import { HAND, HOLE_RADIUS, MIN_POWER } from "./tune.ts";
import {
  aimForLanding,
  holeRadii,
  landingFromAim,
  makeFlight,
  PRIZES,
  project,
  sampleFlight,
  winRadius,
  type View,
} from "./world.ts";

const PHONE: View = { w: 390, h: 844 };

describe("aim and flight", () => {
  it("lands farther and wider as the drag grows", () => {
    const soft = landingFromAim(0, 0.2);
    const hard = landingFromAim(0, 0.9);
    const left = landingFromAim(-1, 0.5);
    const right = landingFromAim(1, 0.5);
    expect(hard.z).toBeGreaterThan(soft.z);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(left.z).toBeCloseTo(right.z, 5);
  });

  it("round-trips a prize position through the drag", () => {
    for (const prize of PRIZES) {
      const aim = aimForLanding(prize);
      const back = landingFromAim(aim.aimX, aim.power);
      expect(back.x).toBeCloseTo(prize.x, 5);
      expect(back.z).toBeCloseTo(prize.z, 5);
    }
  });

  it("keeps the preview, the flight, and the landing on the same point", () => {
    const landing = landingFromAim(-0.35, 0.62);
    const flight = makeFlight(landing, 0.62, false);
    const end = sampleFlight(flight, 1);
    const mid = sampleFlight(flight, 0.5);
    expect(end.x).toBeCloseTo(landing.x, 5);
    expect(end.z).toBeCloseTo(landing.z, 5);
    expect(end.y).toBeCloseTo(0, 5);
    expect(mid.y).toBeGreaterThan(sampleFlight(flight, 0).y);
    expect(mid.y).toBeGreaterThan(end.y);
  });

  it("shortens the flight for reduced motion without moving the landing", () => {
    const landing = landingFromAim(0.2, 0.5);
    const full = makeFlight(landing, 0.5, false);
    const reduced = makeFlight(landing, 0.5, true);
    expect(reduced.duration).toBeLessThan(full.duration);
    expect(reduced.landing).toEqual(full.landing);
  });

  it("maps finger drag in both directions and back again", () => {
    const rect = { width: 390, height: 844 };
    const delta = deltaForAim(-0.4, 0.7, rect);
    expect(delta.dy).toBeLessThan(0);
    const aim = pointerDeltaToAim(delta.dx, delta.dy, rect);
    expect(aim.aimX).toBeCloseTo(-0.4, 5);
    expect(aim.power).toBeCloseTo(0.7, 5);
  });
});

describe("fair hits", () => {
  it("gives every prize a visible hole and a separated winning zone", () => {
    const hole = holeRadii(PHONE);
    expect(hole.rx).toBeGreaterThan(20);
    expect(hole.rx).toBeLessThan(32);
    for (let i = 0; i < PRIZES.length; i += 1) {
      const prize = PRIZES[i];
      if (!prize) continue;
      expect(winRadius(prize.peg)).toBeGreaterThan(0.08);
      expect(prize.peg * (PHONE.w / 2.15)).toBeGreaterThan(6);
      for (let j = i + 1; j < PRIZES.length; j += 1) {
        const other = PRIZES[j];
        if (!other) continue;
        const dist = Math.hypot(prize.x - other.x, prize.z - other.z);
        expect(dist).toBeGreaterThan(winRadius(prize.peg) + winRadius(other.peg) + 0.02);
      }
    }
  });

  it("does not score a tiny flick, and does score a circle aimed at a peg", () => {
    const weak = landingFromAim(0, MIN_POWER);
    for (const prize of PRIZES) {
      const dist = Math.hypot(prize.x - weak.x, prize.z - weak.z);
      expect(dist).toBeGreaterThan(winRadius(prize.peg));
    }
    let state = startRound(createGame()).state;
    for (const prize of PRIZES) {
      const aim = aimForLanding(prize);
      const played = play(freshRound(), aim.aimX, aim.power);
      expect(played.state.score).toBe(prize.points);
      expect(played.state.ringed).toBe(1);
      expect(played.events.some((event) => event.type === "hit" && event.name === prize.name)).toBe(true);
    }
    state = play(state, 1, 0.45).state;
    expect(state.score).toBe(0);
  });

  it("multiplies consecutive hits up to x3 and resets on a miss", () => {
    const prize = PRIZES.find((item) => item.id === "pinwheel");
    if (!prize) throw new Error("missing pinwheel");
    const aim = aimForLanding(prize);
    let state = play(freshRound(), aim.aimX, aim.power).state;
    state = play(state, aim.aimX, aim.power).state;
    state = play(state, aim.aimX, aim.power).state;
    state = play(state, aim.aimX, aim.power).state;
    expect(state.combo).toBe(4);
    expect(state.score).toBe(prize.points * 9);
    state = play(state, 1, 0.45).state;
    expect(state.combo).toBe(0);
    const before = state.score;
    state = play(state, aim.aimX, aim.power).state;
    expect(state.combo).toBe(1);
    expect(state.score).toBe(before + prize.points);
  });
});

describe("round flow", () => {
  it("lets an in-flight ring score after the clock hits zero", () => {
    const prize = PRIZES.find((item) => item.id === "ingot");
    if (!prize) throw new Error("missing ingot");
    const aim = aimForLanding(prize);
    let state = startRound(createGame()).state;
    state = { ...release(updateAim(beginAim(state).state, aim.aimX, aim.power).state).state, timeLeft: 0.05 };
    let step = tick(state, 0.05);
    expect(step.state.phase).toBe("playing");
    expect(step.state.flight).not.toBeNull();
    for (let i = 0; i < 40 && step.state.phase === "playing"; i += 1) step = tick(step.state, 0.05);
    expect(step.state.phase).toBe("results");
    expect(step.state.score).toBe(prize.points);
    expect(step.events.some((event) => event.type === "end")).toBe(true);
  });

  it("drops an unfinished aim when time runs out", () => {
    let state = updateAim(beginAim(freshRound()).state, 0.4, 0.8).state;
    state = { ...state, timeLeft: 0.01 };
    const done = tick(state, 0.05);
    expect(done.state.phase).toBe("results");
    expect(done.state.aim).toBeNull();
    expect(done.state.throws).toBe(0);
    expect(done.state.score).toBe(0);
  });

  it("restarts a finished round without erasing the best score", () => {
    const prize = PRIZES.find((item) => item.id === "ingot");
    if (!prize) throw new Error("missing ingot");
    const aim = aimForLanding(prize);
    let state = play(startRound(createGame({ best: 40 })).state, aim.aimX, aim.power).state;
    state = tick({ ...state, timeLeft: 0.01 }, 0.05).state;
    expect(state.phase).toBe("results");
    expect(state.newRecord).toBe(true);
    expect(state.best).toBe(prize.points);
    const again = startRound(state).state;
    expect(again.phase).toBe("playing");
    expect(again.score).toBe(0);
    expect(again.timeLeft).toBe(45);
    expect(again.combo).toBe(0);
    expect(again.best).toBe(prize.points);
    const ended = tick({ ...again, timeLeft: 0.01 }, 0.05).state;
    expect(ended.best).toBe(prize.points);
    expect(ended.newRecord).toBe(false);
  });

  it("returns to the instructions and can start cleanly", () => {
    const done = tick({ ...freshRound(), timeLeft: 0.01 }, 0.05).state;
    const help = showHelp(done).state;
    expect(help.phase).toBe("title");
    const next = startRound(help).state;
    expect(next.phase).toBe("playing");
    expect(next.score).toBe(0);
    expect(next.timeLeft).toBe(45);
  });

  it("ignores a second throw while a ring is in the air", () => {
    const flying = release(updateAim(beginAim(freshRound()).state, 0, 0.6).state).state;
    const again = release(updateAim(beginAim(flying).state, 0.2, 0.9).state);
    expect(again.state.throws).toBe(1);
    expect(again.state.flight?.power).toBeCloseTo(0.6, 5);
  });

  it("cancels a short drag and leaves a real aim untouched until release", () => {
    const started = freshRound();
    const aiming = updateAim(beginAim(started).state, 0.2, 0.4).state;
    expect(started.aim).toBeNull();
    const cancelled = cancelAim(aiming);
    expect(cancelled.state.throws).toBe(0);
    expect(cancelled.state.flight).toBeNull();
    expect(aiming.aim?.power).toBeCloseTo(0.4, 5);
    const weak = release(updateAim(beginAim(freshRound()).state, 0, 0.03).state);
    expect(weak.state.flight).toBeNull();
    expect(weak.events.map((event) => event.type)).toContain("weak");
  });
});

describe("pointer", () => {
  it("throws on release, and cancellation never throws", () => {
    const rect = { width: 390, height: 844 };
    const released = runPointer([
      pointer("pointerdown", 1, 180, 700),
      pointer("pointermove", 1, 210, 480),
      pointer("pointerup", 1, 210, 480),
    ], rect);
    expect(released.at(-1)?.type).toBe("throw");

    const cancelled = runPointer([
      pointer("pointerdown", 1, 180, 700),
      pointer("pointermove", 1, 220, 460),
      pointer("pointercancel", 1, 220, 460),
      pointer("pointerup", 1, 220, 460),
    ], rect);
    expect(cancelled.some((action) => action.type === "throw")).toBe(false);
    expect(cancelled.at(-1)?.type).toBe("cancel");
  });

  it("ignores a second finger and a right click", () => {
    const rect = { width: 200, height: 400 };
    const actions = runPointer([
      pointer("pointerdown", 1, 40, 300),
      pointer("pointerdown", 2, 80, 200),
      pointer("pointermove", 2, 90, 120),
    ], rect);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("aim");
    const rightClick = runPointer([
      { ...pointer("pointerdown", 4, 20, 20), button: 2, pointerType: "mouse" },
    ], rect);
    expect(rightClick).toHaveLength(0);
  });
});

describe("layout", () => {
  it("scales the same world point when the phone frame changes size", () => {
    const point = { x: 0.28, z: 1.15, y: 0.2 };
    const small = project(point, PHONE);
    const large = project(point, { w: 780, h: 1688 });
    expect(large.sx / 780).toBeCloseTo(small.sx / 390, 5);
    expect(large.sy / 1688).toBeCloseTo(small.sy / 844, 5);
  });

  it("keeps prizes and the hand on screen at phone sizes", () => {
    const views: View[] = [
      PHONE,
      { w: 320, h: 693 },
      { w: 360, h: 780 },
      { w: 480, h: 1040 },
      { w: 390, h: 700 },
    ];
    for (const view of views) {
      for (const prize of PRIZES) {
        const pos = project(prize, view);
        expect(pos.sx).toBeGreaterThan(view.w * 0.06);
        expect(pos.sx).toBeLessThan(view.w * 0.94);
        expect(pos.sy).toBeGreaterThan(view.h * 0.35);
        expect(pos.sy).toBeLessThan(view.h * 0.86);
      }
      const hand = project(HAND, view);
      expect(hand.sy).toBeGreaterThan(view.h * 0.7);
      expect(hand.sy).toBeLessThan(view.h * 0.96);
    }
  });

  it("formats the clock and the rank", () => {
    expect(formatTime(45)).toBe("00:45");
    expect(formatTime(4.2)).toBe("00:05");
    expect(formatTime(0)).toBe("00:00");
    expect(rankFor(0).title).toBe("路过看客");
    expect(rankFor(80).title).toBe("初窥门道");
    expect(rankFor(200).title).toBe("夜市熟客");
    expect(rankFor(400).title).toBe("套圈好手");
    expect(rankFor(800).title).toBe("庙会传奇");
    expect(HOLE_RADIUS).toBeGreaterThan(0);
  });
});

function freshRound(): GameState {
  return startRound(createGame()).state;
}

function play(state: GameState, aimX: number, power: number): { state: GameState; events: GameEvent[] } {
  let step = release(updateAim(beginAim(state).state, aimX, power).state);
  const events = [...step.events];
  let current = step.state;
  for (let i = 0; i < 8 && current.flight; i += 1) {
    step = tick(current, 1);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

function pointer(type: PointerLike["type"], pointerId: number, clientX: number, clientY: number): PointerLike {
  return { type, pointerId, clientX, clientY, button: 0, pointerType: "touch" };
}

function runPointer(events: PointerLike[], rect: { width: number; height: number }) {
  let session: PointerSession | null = null;
  const actions = [];
  for (const event of events) {
    const next = reducePointer(session, event, rect);
    session = next.session;
    if (next.action) actions.push(next.action);
  }
  return actions;
}
