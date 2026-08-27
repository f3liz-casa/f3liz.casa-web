import { useEffect, useState } from "preact/hooks";
import { locale, LANGS, htmlLang } from "./data/i18n";
import { Voices } from "./components/Voices";
import { Making } from "./components/Making";
import { Rooms } from "./components/Rooms";
import { Connect } from "./components/Connect";
import { Credits } from "./components/Credits";
import { NappingCat } from "./components/NappingCat";

const VALID_KEYS = new Set(LANGS.map((l) => l.key));
const MAJOR_LANGS = ["en", "ja", "ko"];

function detectMajorLang() {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const primary = tag.split("-")[0].toLowerCase();
    if (MAJOR_LANGS.includes(primary)) return primary;
  }
  return "en";
}

function getLangFromURL() {
  const param = new URLSearchParams(window.location.search).get("lang");
  return param && VALID_KEYS.has(param) ? param : detectMajorLang();
}

function Part({ id, title, note, children }) {
  return (
    <section className="part" aria-labelledby={id}>
      <h2 id={id} className="part-title">
        {title}
        {note && <span className="part-note"> — {note}</span>}
      </h2>
      {children}
    </section>
  );
}

export default function App() {
  const [lang, setLangState] = useState(getLangFromURL);
  const tr = locale(lang);

  useEffect(() => {
    document.documentElement.lang = htmlLang(lang);
  }, [lang]);

  function setLang(newLang) {
    history.replaceState(null, "", "?lang=" + newLang);
    setLangState(newLang);
  }

  return (
    <main className="letter">
      <header className="opening">
        <p className="eyebrow">{tr.eyebrow}</p>
        <h1 className="title">
          f3liz<span className="casa">.casa</span>
        </h1>
        <p className="felis">
          <span lang="la">/felis/</span> — {tr.felis}
        </p>
        {/* key={lang}: remount so the greeting fades in again in the new voice */}
        <p className="wish" key={lang}>{tr.wish}</p>
        <Voices lang={lang} setLang={setLang} label={tr.langAria} />
      </header>

      <Part id="making" title={tr.making}>
        <Making lang={lang} />
      </Part>

      <Part id="rooms" title={tr.rooms}>
        <Rooms lang={lang} />
      </Part>

      <Part id="connect" title={tr.connect}>
        <Connect tr={tr} />
      </Part>

      <Part id="voices" title={tr.voices} note={tr.voicesNote}>
        <Credits />
      </Part>

      <footer className="closing">
        <div>
          <p className="thanks">{tr.thanks}</p>
          <p className="signoff">
            <a href="https://github.com/nyanrus" target="_blank" rel="noreferrer">@nyanrus</a>
          </p>
        </div>
        <NappingCat />
      </footer>
    </main>
  );
}
