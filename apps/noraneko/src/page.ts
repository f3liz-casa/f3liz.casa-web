// SPDX-License-Identifier: MPL-2.0
// 一枚(/drops/<uuid>/)。
//
// 紙は二次元に置く。上の四枚(install / who / what is served / in the registry)は
// もともと `.slips` の三列に並んでいたが、**source だけが一列の縦積み**だった ──
// 十七枚の file が上から下へ続くので、何が入っているのかは下まで巻かないと分からない。
//
// なので source も面に置く: file が一枚ずつの札になって、格子に並ぶ。名前と行数だけが
// 見えていて、**開いた一枚だけが横いっぱいに広がる**(`details[open]` が全列を取る)。
// 一覧としては二次元、読むときは一次元 ── 読む字は狭い桁に押し込めない。

import { contactHref, foot, h, iconImg, REGISTRY, type Att, type Entry, type Row, type SourceFile } from "./html.ts";

const slip = (tint: string, title: string, body: string, extra = "") =>
  `    <section class="slip ${tint}${extra ? " " + extra : ""}">
      <h2 class="slip-title">${h(title)}</h2>
${body}
    </section>`;

function whoBody(d: Row): string {
  const cs = d.contact ?? [];
  if (!cs.length) return `      <p class="fact">no contact written</p>`;
  return cs.map((c) => {
    const href = contactHref(c);
    return `      <span class="fact">${href ? `<a href="${h(href)}" target="_blank" rel="noreferrer">${h(c)}</a>` : h(c)}</span>`;
  }).join("\n");
}

function servedBody(DL: string, d: Row, entries: Entry[], stamps: Att[]): string {
  const src = d.source ?? {};
  const lines = entries.map((e) =>
    `      <span class="fact"><b>${h(e.name)}</b> · ${h(e.id)} · version <b>${h(e.version)}</b> · ${h(e.size)} bytes</span>
      <span class="fact">sha256 <span class="uuid">${h(e.sha256)}</span></span>`);
  lines.push(`      <span class="fact">built from <a href="${h(src.repo)}/tree/${h(src.commit)}/${h(src.path)}" target="_blank" rel="noreferrer">${h(src.path)} @ ${h(String(src.commit ?? "").slice(0, 10))}</a> (${h(src.commit_time)})</span>`);
  for (const a of stamps) {
    const link = a.rekorUrl
      ? `<a href="${h(a.rekorUrl)}" target="_blank" rel="noreferrer">Rekor ${h(a.rekor)}</a>`
      : a.url ? `<a href="${h(a.url)}" target="_blank" rel="noreferrer">run</a>` : "";
    lines.push(`      <span class="fact">${h(a.who)}: ${link}</span>`);
  }
  lines.push(`      <span class="fact">served at <a href="${h(DL)}/${h(d.uuid)}/manifest.json">${h(DL)}/${h(d.uuid)}/</a></span>`);
  return lines.join("\n");
}

/** file 一枚ずつの札。開いた一枚だけが横いっぱいになる(style.css の .filegrid) */
function fileCard(f: SourceFile): string {
  const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/") + 1) : "";
  const base = f.path.slice(dir.length);
  const head = `<summary><span class="k"><span class="dir">${h(dir)}</span>${h(base)}</span> · ${
    f.text === null ? `${h(f.bytes)} bytes` : `${f.text.split("\n").length} lines`}</summary>`;
  const body = f.text === null
    ? `        <p>Not text. It is in the xpi as it is here, and its sha256 is what the manifest above says for the whole file.</p>`
    : `        <pre><code>${h(f.text)}</code></pre>`;
  return `      <details>
        ${head}
${body}
      </details>`;
}

export function pageHtml(DL: string, d: Row, entries: Entry[], files: SourceFile[], built: string): string {
  const first = entries[0];
  const src = d.source ?? {};
  const source = files.length
    ? `      <div class="filegrid">
${files.map(fileCard).join("\n")}
      </div>`
    : `      <p class="fact">not served yet</p>`;

  return `
  <h1 class="title">${iconImg(DL, d, 32)}${h(d.name)}</h1>
  <p class="gloss">${h(d.note)}</p>
  <p class="status">uuid <span class="uuid">${h(d.uuid)}</span></p>

  <div class="slips">
${slip("wakaba", "install", `      <p>Press inside noraneko. It catches the link, opens its settings with this uuid, downloads the xpi, checks the sha256 and the registry's signature, and shows you everything below again before anything runs.</p>
      <div class="actions">
        <a class="btn" href="${h(DL)}/${h(d.uuid)}/${h(first?.file)}">install in noraneko</a>
        <span class="status">In another browser this is a plain link to the xpi. Stock Firefox will refuse it as unverified; paste the uuid into <code>about:nora:settings</code> in noraneko instead.</span>
      </div>`, "wide")}
${slip("sakura", "who", whoBody(d))}
${slip("sora", "what is served", servedBody(DL, d, entries, d.attestations ?? []), "wide")}
${slip("tamago", "in the registry", `      ${src.commit
      ? `<span class="fact"><a href="${h(REGISTRY)}/tree/${h(src.commit)}/drops/${h(d.name)}" target="_blank" rel="noreferrer">drops/${h(d.name)}/</a> @ ${h(String(src.commit).slice(0, 10))} — この版が出てきた木</span>`
      : `<span class="fact">drops/${h(d.name)}/</span>`}
      ${d.lib
      ? `<span class="fact">library: 直接入れるものではなく、これを <code>[deps]</code> に書いた drop に付いてくる</span>`
      : `<span class="fact">actors: <b>${h(entries.map((e) => e.name).filter(Boolean).join(", "))}</b></span>`}`)}
${slip("hai", "the source, as it is", `      <p>These come from <code>source.json</code> next to the manifest — the same text the xpi carries under <code>source/</code>, and dl checks its sha256 against the signed manifest before handing it over. Not a copy of the repository: what you read and what runs came out of the same build. ${files.length ? `<b>${files.length}</b> files; press one to open it.` : ""}</p>
${source}`, "full files")}
  </div>
${foot(DL, built)}`;
}
