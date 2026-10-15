import { useEffect } from 'react';
import { setLang, useStrings, type Lang } from '../i18n';
import { settings } from '../state/settings';

/** Props for the title overlay. */
interface LandingProps {
  onEnter: () => void;
  error: string | null;
}

const LANGS: Array<{ id: Lang; label: string; name: string }> = [
  { id: 'ru', label: 'RU', name: 'Русский' },
  { id: 'en', label: 'EN', name: 'English' },
];

/** Title screen over the live 3D backdrop: the name, the rules as a field protocol, the way in, and the language. */
export function Landing({ onEnter, error }: LandingProps) {
  const s = useStrings();
  const lang = settings.use((st) => st.lang);

  useEffect(() => {
    const name = s.title.join(' ');
    document.title = name.charAt(0).toUpperCase() + name.slice(1);
    document.documentElement.lang = lang;
  }, [s, lang]);
  return (
    <main className="title" lang={lang}>
      <div className="title__grain" aria-hidden="true" />
      <div className="title__lang" role="group" aria-label="Language / Язык">
        {LANGS.map((l) => (
          <button key={l.id} type="button" aria-pressed={lang === l.id} aria-label={l.name} onClick={() => setLang(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="title__col">
        <p className="title__eyebrow">
          <span className="title__dot" aria-hidden="true" /> {s.eyebrow}
        </p>
        <h1 className="title__name">
          <span className="title__word">{s.title[0]}</span>
          <span className="title__word title__word--second">{s.title[1]}</span>
          <svg className="title__crack" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 78 L70 70 L104 86 L150 61 L196 77 L240 55 L268 79 L318 64 L352 92 L404 66 L446 80 L492 57 L540 74 L600 66" />
          </svg>
        </h1>
        <ol className="title__protocol">
          {s.protocol.map((text, i) => (
            <li key={i}>
              <span className="title__n">{String(i + 1).padStart(2, '0')}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="title__enter" onClick={onEnter}>
          <span>{s.enter}</span>
        </button>
        {error && <p className="title__error">{error}</p>}
        <p className="title__controls">{s.controls}</p>
      </div>
    </main>
  );
}
