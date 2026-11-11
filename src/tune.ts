/** Gameplay constants. World units are meters on the stall table. */

export const ROUND_SECONDS = 45;

/** Inner hole of the ring, in world meters. The drawn hole uses this radius. */
export const HOLE_RADIUS = 0.13;

/** Extra clearance so a peg visually inside the hole counts. */
export const FORGIVENESS = 0.015;

/** A miss this close to a winning radius shows “差一点”. */
export const CLOSE_MARGIN = 0.05;

/** How much of the ring's outer radius is the open hole. */
export const RING_INNER_RATIO = 0.62;

/** World width that maps across the screen. */
export const WORLD_SPAN_X = 2.15;

/** Vertical squash of ground depth. 1 would be pure top-down. */
export const FORESHORTEN = 0.92;

/** Screen Y, as a fraction of height, for world z = 0 and y = 0. */
export const ORIGIN_Y_RATIO = 0.8;

export const TABLE = {
  x: 1.02,
  z0: 0.46,
  z1: 1.88,
};

export const HAND = { x: 0, z: -0.04, y: 0.18 };

export const AIM_X_MAX = 0.82;
export const AIM_Z_NEAR = 0.52;
export const AIM_Z_FAR = 1.74;
export const POWER_EXP = 1.28;

export const MIN_POWER = 0.07;

/** Upward drag, as a fraction of view height, that reaches full power. */
export const POWER_DRAG_FRACTION = 0.26;

/** Sideways drag, as a fraction of view width, that reaches full aim. */
export const AIM_DRAG_FRACTION = 0.34;

export const BEST_KEY = "ring-toss-best";
export const MUTE_KEY = "ring-toss-muted";
