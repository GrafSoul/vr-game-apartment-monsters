import { createXRStore } from '@react-three/xr';
import { LeftWrist } from './input/LeftWrist';
import { RightBlaster } from './input/RightBlaster';

/**
 * The XR session for the game. The dev emulator is installed separately in `dev/emulator.ts`,
 * so the store never injects one itself.
 */
export const xrStore = createXRStore({
  emulate: false,
  controller: { left: LeftWrist, right: RightBlaster },
  frameRate: 'high',
});
