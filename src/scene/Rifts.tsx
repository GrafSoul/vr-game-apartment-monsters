import { Rift } from '../fx/Rift';
import { game } from '../game/game';

/** Draws every rift the director has opened (closed ones fade out). */
export function Rifts() {
  const rifts = game.use((s) => s.rifts);
  return (
    <>
      {rifts.map((r) => (
        <Rift
          key={r.id}
          position={r.position}
          normal={r.normal}
          open={r.open ? 1 : 0}
          width={r.size === 'boss' ? 1.3 : 0.75}
          height={r.size === 'boss' ? 2.1 : 1.1}
        />
      ))}
    </>
  );
}
