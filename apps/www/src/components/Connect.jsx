import { links } from "../data/links";

export function Connect({ tr }) {
  return (
    <>
      <ul className="inline-links" role="list">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              {...(/^https?:\/\//.test(l.href) && { target: "_blank", rel: "noreferrer" })}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="zulip-note">{tr.zulipNote}</p>
      <p className="milktea">
        <a
          href="https://buymeacoffee.com/nyanrus"
          target="_blank"
          rel="noreferrer"
          aria-label={tr.milkteaAria}
        >
          {tr.milktea}
        </a>
      </p>
    </>
  );
}
