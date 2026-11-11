import { clamp } from "./math.ts";
import { AIM_DRAG_FRACTION, MIN_POWER, POWER_DRAG_FRACTION } from "./tune.ts";

export interface DragRect {
  width: number;
  height: number;
}

export function pointerDeltaToAim(dx: number, dy: number, rect: DragRect): { aimX: number; power: number } {
  const up = Math.max(0, -dy);
  return {
    power: clamp(up / (rect.height * POWER_DRAG_FRACTION), 0, 1),
    aimX: clamp(dx / (rect.width * AIM_DRAG_FRACTION), -1, 1),
  };
}

export function deltaForAim(aimX: number, power: number, rect: DragRect): { dx: number; dy: number } {
  return {
    dx: clamp(aimX, -1, 1) * rect.width * AIM_DRAG_FRACTION,
    dy: -clamp(power, 0, 1) * rect.height * POWER_DRAG_FRACTION,
  };
}

export function canRelease(power: number): boolean {
  return power >= MIN_POWER;
}
