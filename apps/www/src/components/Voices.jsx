import { LANGS, htmlLang } from "../data/i18n";

// The line of voices this letter can be read in.
export function Voices({ lang, setLang, label }) {
  return (
    <ul className="voices" role="group" aria-label={label}>
      {LANGS.map((l) => (
        <li key={l.key}>
          <button
            type="button"
            className="voice"
            lang={htmlLang(l.key)}
            aria-pressed={lang === l.key}
            onClick={() => setLang(l.key)}
          >
            {l.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
