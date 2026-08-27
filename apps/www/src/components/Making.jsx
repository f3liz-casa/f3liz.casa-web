import { t } from "../data/i18n";
import { projects } from "../data/projects";

const external = (href) => /^https?:\/\//.test(href) && { target: "_blank", rel: "noreferrer" };

export function Making({ lang }) {
  return (
    <ul className="rows" role="list">
      {projects.map((p) => (
        <li key={p.name} className="row">
          <a className="row-name" href={p.href} {...external(p.href)}>{p.name}</a>
          <span className="row-desc">{t(p.desc, lang)}</span>
          <span className="row-tag">{p.lang}</span>
        </li>
      ))}
    </ul>
  );
}
