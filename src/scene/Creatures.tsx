import { game } from '../game/game';
import { Boss } from './Boss';
import { Flyer } from './Flyer';

/** Mounts a component for every live creature the director has released. */
export function Creatures() {
  const creatures = game.use((s) => s.creatures);
  return (
    <>
      {creatures.map((c) => (c.kind === 'boss' ? <Boss key={c.id} creature={c} /> : <Flyer key={c.id} creature={c} />))}
    </>
  );
}
