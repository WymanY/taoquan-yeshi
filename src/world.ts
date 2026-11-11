import { clamp, lerp } from "./math.ts";
import {
  AIM_X_MAX,
  AIM_Z_FAR,
  AIM_Z_NEAR,
  CLOSE_MARGIN,
  FORESHORTEN,
  FORGIVENESS,
  HAND,
  HOLE_RADIUS,
  ORIGIN_Y_RATIO,
  POWER_EXP,
  WORLD_SPAN_X,
} from "./tune.ts";

export interface View {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  z: number;
}

export interface PrizeDef {
  id: PrizeId;
  name: string;
  points: number;
  x: number;
  z: number;
  peg: number;
}

export type PrizeId =
  | "tanghulu"
  | "pinwheel"
  | "rabbit"
  | "knot"
  | "panda"
  | "lantern"
  | "koi"
  | "ingot";

export const PRIZES: readonly PrizeDef[] = [
  { id: "tanghulu", name: "糖葫芦", points: 10, x: -0.56, z: 0.8, peg: 0.04 },
  { id: "pinwheel", name: "小风车", points: 20, x: 0.02, z: 0.74, peg: 0.04 },
  { id: "rabbit", name: "陶瓷兔", points: 30, x: 0.58, z: 0.82, peg: 0.044 },
  { id: "knot", name: "中国结", points: 25, x: -0.6, z: 1.16, peg: 0.04 },
  { id: "panda", name: "熊猫玩偶", points: 45, x: -0.02, z: 1.1, peg: 0.046 },
  { id: "lantern", name: "红灯笼", points: 60, x: 0.56, z: 1.18, peg: 0.042 },
  { id: "koi", name: "锦鲤", points: 80, x: -0.3, z: 1.52, peg: 0.044 },
  { id: "ingot", name: "金元宝", points: 120, x: 0.28, z: 1.6, peg: 0.05 },
];

export interface PegTarget {
  x: number;
  z: number;
  peg: number;
}

export function winRadius(peg: number): number {
  return HOLE_RADIUS - peg + FORGIVENESS;
}

export function pickTarget<T extends PegTarget>(
  landing: Point,
  targets: readonly T[],
): { hit: T | null; close: boolean } {
  let hit: T | null = null;
  let hitDist = Infinity;
  let close = false;
  for (const target of targets) {
    const dist = Math.hypot(target.x - landing.x, target.z - landing.z);
    const win = winRadius(target.peg);
    if (dist <= win && dist < hitDist) {
      hit = target;
      hitDist = dist;
    } else if (dist <= win + CLOSE_MARGIN) {
      close = true;
    }
  }
  if (hit) close = false;
  return { hit, close };
}

export function landingFromAim(aimX: number, power: number): Point {
  const aim = clamp(aimX, -1, 1);
  const charge = clamp(power, 0, 1);
  return {
    x: aim * AIM_X_MAX,
    z: AIM_Z_NEAR + (AIM_Z_FAR - AIM_Z_NEAR) * Math.pow(charge, POWER_EXP),
  };
}

export function aimForLanding(point: Point): { aimX: number; power: number } {
  const span = AIM_Z_FAR - AIM_Z_NEAR;
  const t = clamp((point.z - AIM_Z_NEAR) / span, 0, 1);
  return {
    aimX: clamp(point.x / AIM_X_MAX, -1, 1),
    power: Math.pow(t, 1 / POWER_EXP),
  };
}

export interface Flight {
  start: { x: number; z: number; y: number };
  landing: Point;
  power: number;
  elapsed: number;
  duration: number;
}

export function makeFlight(landing: Point, power: number, reducedMotion: boolean): Flight {
  const charge = clamp(power, 0, 1);
  return {
    start: { x: HAND.x, z: HAND.z, y: HAND.y },
    landing: { x: landing.x, z: landing.z },
    power: charge,
    elapsed: 0,
    duration: (reducedMotion ? 0.32 : 0.48) + charge * (reducedMotion ? 0.12 : 0.24),
  };
}

export function sampleFlight(flight: Flight, t: number): { x: number; z: number; y: number; spin: number } {
  const u = clamp(t, 0, 1);
  const peak = lerp(0.34, 0.78, flight.power);
  return {
    x: lerp(flight.start.x, flight.landing.x, u),
    z: lerp(flight.start.z, flight.landing.z, u),
    y: lerp(flight.start.y, 0, u) + Math.sin(u * Math.PI) * peak,
    spin: u * Math.PI * (1.2 + flight.power * 1.4),
  };
}

export function project(point: { x: number; z: number; y?: number }, view: View): { sx: number; sy: number; px: number } {
  const px = view.w / WORLD_SPAN_X;
  const y = point.y ?? 0;
  return {
    sx: view.w / 2 + point.x * px,
    sy: view.h * ORIGIN_Y_RATIO - point.z * px * FORESHORTEN - y * px,
    px,
  };
}

export function holeRadii(view: View): { rx: number; ry: number } {
  const px = view.w / WORLD_SPAN_X;
  return { rx: HOLE_RADIUS * px, ry: HOLE_RADIUS * px * FORESHORTEN };
}
