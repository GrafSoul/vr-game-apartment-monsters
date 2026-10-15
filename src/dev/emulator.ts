import { DevUI } from '@iwer/devui';
import { SyntheticEnvironmentModule } from '@iwer/sem';
import { metaQuest3, XRDevice } from 'iwer';

/**
 * Dev-only Quest 3 emulator for testing on the Mac. Installed by hand (not via createXRStore's
 * `emulate`) because desktop Chromium already exposes a native `navigator.xr`, and IWER only
 * replaces it with `forceInstall`. Loads the synthetic living room so the couch flow can run.
 */
export function installEmulator(): void {
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true });
  device.installDevUI(DevUI);
  // @iwer/sem 0.2.5 typings predate iwer 2.6's optional depth hook; @pmndrs/xr passes the same module untyped.
  device.installSEM(SyntheticEnvironmentModule as unknown as Parameters<XRDevice['installSEM']>[0]);
  device.sem?.loadDefaultEnvironment('living_room');
  // Lets the headset and controllers be posed from the console while testing.
  Object.assign(window, { __iwer: device });
}
