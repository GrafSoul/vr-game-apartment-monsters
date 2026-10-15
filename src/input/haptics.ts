/** Minimal shape of the Gamepad haptics API as Quest Browser exposes it. */
interface Pulsable {
  pulse?: (intensity: number, durationMs: number) => Promise<boolean>;
}

const sessions: { current: XRSession | null } = { current: null };

/** Remembers the active session so creatures can buzz controllers without React context. */
export function setHapticsSession(session: XRSession | null): void {
  sessions.current = session;
}

/** Vibrates one controller; silently does nothing where haptics are unsupported (desktop, emulator). */
export function pulse(source: XRInputSource | undefined, intensity: number, durationMs: number): void {
  const actuator = source?.gamepad?.hapticActuators?.[0] as Pulsable | undefined;
  actuator?.pulse?.(intensity, durationMs).catch(() => undefined);
}

/** Vibrates both controllers, e.g. when a creature lunges at the player. */
export function pulseBoth(intensity: number, durationMs: number): void {
  const session = sessions.current;
  if (!session) return;
  for (const source of session.inputSources) pulse(source, intensity, durationMs);
}
