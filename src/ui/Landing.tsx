import { useEffect } from 'react';
import { setLang, useStrings, type Lang } from '../i18n';
import type { SessionError } from '../App';
import { settings } from '../state/settings';

/** Props for the title overlay. */
interface LandingProps {
  onEnter: () => void;
  error: SessionError | null;
}

const LANGS: Array<{ id: Lang; label: string; name: string }> = [
  { id: 'ru', label: 'RU', name: 'Русский' },
  { id: 'en', label: 'EN', name: 'English' },
];

/** Third-party models, CC BY 4.0: the license asks for the author and the source wherever the game is published. */
const CREDITS: Array<{ model: string; author: string; url: string }> = [
  { model: 'Prototype Pistol', author: 'vaportrash', url: 'https://sketchfab.com/3d-models/863482cf4d384e49a403b2963c7e7f8f' },
  { model: 'Three-Head Baby Mutant', author: 'LxNazarov', url: 'https://sketchfab.com/3d-models/a769a92a263d47488b8fb2136c2759fb' },
  { model: 'Flyning monster', author: 'Vladies', url: 'https://sketchfab.com/3d-models/8bccab10deb54ea090d99a6255a20195' },
  { model: 'Hoefnagel creature', author: 'silicat', url: 'https://sketchfab.com/3d-models/9a92596a121f412299dfbc61b1bb01aa' },
  { model: 'Realistic Skull with animation', author: 'theauditor', url: 'https://sketchfab.com/3d-models/f18b6609047d4183a4d7c72abca9e553' },
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
          <span className="title__word">{s.title[0]}</span>{' '}
          <span className="title__word title__word--second">{s.title[1]}</span>
          <svg className="title__crack" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 78 L70 70 L104 86 L150 61 L196 77 L240 55 L268 79 L318 64 L352 92 L404 66 L446 80 L492 57 L540 74 L600 66" />
          </svg>
        </h1>
        <ol className="title__protocol">
          {s.protocol.map((text, i) => (
            <li key={i}>
              <span className="title__n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>{' '}
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="title__enter" onClick={onEnter}>
          <span>{s.enter}</span>
        </button>
        {error && (
          <p className="title__error" role="alert">
            {s[error]}
          </p>
        )}
        <p className="title__controls">{s.controls}</p>
        <details className="title__credits">
          <summary>{s.credits} · CC BY 4.0</summary>
          <ul>
            {CREDITS.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.model}
                </a>{' '}
                — {c.author}
              </li>
            ))}
          </ul>
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            creativecommons.org/licenses/by/4.0
          </a>
        </details>
      </div>
    </main>
  );
}
