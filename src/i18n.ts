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
  eyebrow: 'контакт · твоя комната · Quest 3',
  protocol: [
    'Разломы открываются по три. Тварь лезет только из одного — слушай, откуда трещит.',
    'Задрожала — значит, сейчас бросится. Стреляй первым, укус снимает броню.',
    'Каждый третий уровень стена не выдерживает. Оттуда выходит он.',
  ],
  enter: 'Войти в комнату',
  controls: 'Правая рука — пистолет, курок стреляет. Левое предплечье — наручная панель: посмотри на неё, и в руке появится указка.',
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
  eyebrow: 'contact · your room · Quest 3',
  protocol: [
    'Rifts open three at a time. Only one lets a creature through — listen for the crack.',
    'If it shudders, it is about to lunge. Shoot first: a bite costs armor.',
    'Every third level the wall gives way. Something big walks out.',
  ],
  enter: 'Enter the room',
  controls: 'Right hand: the blaster, trigger fires. Left forearm: the wrist panel — look at it and your hand becomes a pointer.',
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
