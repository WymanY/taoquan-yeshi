import { canRelease, pointerDeltaToAim, type DragRect } from "./aim.ts";

export interface PointerSession {
  pointerId: number;
  originX: number;
  originY: number;
}

export interface PointerLike {
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel";
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
  pointerType: string;
}

export type PointerAction =
  | { type: "aim"; aimX: number; power: number }
  | { type: "throw"; aimX: number; power: number }
  | { type: "cancel" };

export function reducePointer(
  session: PointerSession | null,
  event: PointerLike,
  rect: DragRect,
): { session: PointerSession | null; action: PointerAction | null } {
  if (event.type === "pointerdown") {
    if (session) return { session, action: null };
    if (event.pointerType === "mouse" && event.button !== 0) {
      return { session, action: null };
    }
    return {
      session: { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY },
      action: { type: "aim", aimX: 0, power: 0 },
    };
  }

  if (!session || event.pointerId !== session.pointerId) {
    return { session, action: null };
  }

  const aim = pointerDeltaToAim(event.clientX - session.originX, event.clientY - session.originY, rect);

  if (event.type === "pointermove") {
    return { session, action: { type: "aim", aimX: aim.aimX, power: aim.power } };
  }

  if (event.type === "pointercancel") {
    return { session: null, action: { type: "cancel" } };
  }

  if (event.type === "pointerup") {
    if (canRelease(aim.power)) {
      return { session: null, action: { type: "throw", aimX: aim.aimX, power: aim.power } };
    }
    return { session: null, action: { type: "cancel" } };
  }

  return { session, action: null };
}
