import { Mesh, Raycaster, Vector2, Vector3 } from 'three';

/**
 * Link between the left-forearm panel and the right hand. While the player looks at the panel
 * (`inUse`), the right hand shows a pointer instead of the blaster and the trigger presses buttons.
 */
export const wristUi = {
  panel: null as Mesh | null,
  /** True while the panel faces the eyes. */
  inUse: false,
  /** Panel UV under the pointer, or null. */
  hover: null as Vector2 | null,
  /** World point under the pointer, for the cursor dot. */
  hoverPoint: new Vector3(),
  /** Set by the panel: presses whatever button lies at this UV. */
  press: null as ((uv: Vector2) => void) | null,
};

if (import.meta.env.DEV) Object.assign(window, { __wristUi: wristUi });

const raycaster = new Raycaster();
raycaster.far = 2;

/** Returns the panel UV hit by the pointer ray (and stores the hit point), or null when not in use or missed. */
export function aimAtPanel(origin: Vector3, direction: Vector3): Vector2 | null {
  const panel = wristUi.panel;
  if (!wristUi.inUse || !panel) return null;
  raycaster.set(origin, direction);
  const hit = raycaster.intersectObject(panel, false)[0];
  if (!hit?.uv) return null;
  wristUi.hoverPoint.copy(hit.point);
  return hit.uv.clone();
}
