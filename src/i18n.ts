import { settings } from './state/settings';

export type Lang = 'ru' | 'en';

const STORAGE_KEY = 'apartment-monsters-lang';

/** Saved choice, else the browser language, else English. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** Switches the language and remembers it. */
export function setLang(lang: Lang): void {
  settings.set({ lang });
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}

const ru = {
  title: ['Квартирные', 'монстры'],
  eyebrow: 'MR-шутер для Meta Quest 3',
  protocol: [
    'В стенах твоей комнаты открываются разломы. Монстр вылезет только из одного — по треску слышно, из какого.',
    'Перед броском монстр замирает и дрожит. Успей выстрелить: каждый укус отнимает броню.',
    'На каждом третьем уровне из стены выходит босс.',
  ],
  enter: 'Войти в комнату',
  controls: 'Пистолет в правой руке, стреляет курок. Панель на левом предплечье: посмотри на неё, и пистолет сменится указкой.',
  credits: 'Авторы моделей',
  sessionFailed: 'Не получилось запустить игру в смешанной реальности. Обнови страницу и попробуй ещё раз.',
  noXr: 'Это устройство не поддерживает смешанную реальность. Открой страницу в браузере шлема Meta Quest 3.',
  xrDenied: 'Нет доступа к пространству комнаты. Разреши его, когда браузер шлема спросит, и нажми «Войти в комнату» ещё раз.',
  levelTitle: (n: number) => `Уровень ${n}`,
  levelGoal: (kills: number) => `Убей ${kills} тварей`,
  levelGoalBoss: (kills: number) => `Убей ${kills} тварей. В конце придёт босс`,
  bossTitle: 'Босс',
  bossSub: 'Что-то ломится сквозь стену',
  clearedTitle: (n: number) => `Уровень ${n} пройден`,
  clearedSub: 'Следующий уже близко',
  bossDownSub: 'Босс повержен',
  defeatTitle: 'Броня пробита',
  defeatSub: 'Уровень начнётся заново',
  panelLevel: 'УРОВЕНЬ',
  panelArmor: 'броня',
  panelBoss: 'БОСС',
  panelCreatures: 'Твари',
  pause: 'Пауза',
  resume: 'Дальше',
  restart: 'Заново',
  shadows: 'Тени',
  dimmer: 'Свет −',
  brighter: 'Свет +',
  occlusion: 'Окклюзия',
};

const en: typeof ru = {
  title: ['Apartment', 'monsters'],
  eyebrow: 'Mixed-reality shooter for Meta Quest 3',
  protocol: [
    'Rifts open in the walls of your room. Only one lets a monster through — the crack tells you which.',
    'Before it lunges, a monster freezes and shudders. Shoot first: every bite costs armor.',
    'Every third level, a boss walks out of the wall.',
  ],
  enter: 'Enter the room',
  controls: 'Blaster in your right hand, trigger to fire. Panel on your left forearm: look at it and the blaster turns into a pointer.',
  credits: 'Model credits',
  sessionFailed: 'Could not start the mixed-reality session. Reload the page and try again.',
  noXr: 'This device does not support mixed reality. Open this page in the Meta Quest 3 browser.',
  xrDenied: 'No access to your room. Allow it when the headset browser asks, then tap Enter the room again.',
  levelTitle: (n: number) => `Level ${n}`,
  levelGoal: (kills: number) => `Kill ${kills} creatures`,
  levelGoalBoss: (kills: number) => `Kill ${kills} creatures. Then the boss comes`,
  bossTitle: 'Boss',
  bossSub: 'Something is breaking through the wall',
  clearedTitle: (n: number) => `Level ${n} cleared`,
  clearedSub: 'The next one is close',
  bossDownSub: 'The boss is down',
  defeatTitle: 'Armor broken',
  defeatSub: 'The level starts over',
  panelLevel: 'LEVEL',
  panelArmor: 'armor',
  panelBoss: 'BOSS',
  panelCreatures: 'Creatures',
  pause: 'Pause',
  resume: 'Resume',
  restart: 'Restart',
  shadows: 'Shadows',
  dimmer: 'Light −',
  brighter: 'Light +',
  occlusion: 'Occlusion',
};

/** All player-facing strings for one language. */
export type Strings = typeof ru;
const strings: Record<Lang, Strings> = { ru, en };

/** Strings for the current language, for code outside React (canvas drawing). */
export function t(): Strings {
  return strings[settings.get().lang];
}

/** Strings for the current language; re-renders the component when the language changes. */
export function useStrings(): Strings {
  return strings[settings.use((s) => s.lang)];
}
