import { t } from "../data/i18n";
import { rooms } from "../data/rooms";

export function Rooms({ lang }) {
  return (
    <ul className="rows" role="list">
      {rooms.map((r) => (
        <li key={r.host} className="row row-wide">
          <a className="row-name" href={`https://${r.host}/`}>{r.host}</a>
          <span className="row-desc">{t(r.desc, lang)}</span>
        </li>
      ))}
    </ul>
  );
}
