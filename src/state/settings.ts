import { createStore } from './createStore';

/** Player-tunable settings, changed from the title screen and the wrist panel. */
export interface Settings {
  shadows: boolean;
  occlusion: boolean;
  /** Multiplier for all scene lights, tuned to match the room. */
  brightness: number;
  fps: number;
  lang: 'ru' | 'en';
}

/** Settings store. The language is filled in at startup from the saved choice or the browser. */
export const settings = createStore<Settings>({ shadows: true, occlusion: true, brightness: 1, fps: 0, lang: 'en' });
