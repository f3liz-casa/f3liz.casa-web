// SPDX-License-Identifier: MPL-2.0
// 棚(/drops/)。dl の index.json に並んでいるものを、そのまま並べる。

import { foot, h, iconImg, REGISTRY, TINTS, type Row } from "./html.ts";

export function shelfHtml(DL: string, drops: Row[], built: string): string {
  const rows = drops.map((d, i) => {
    const versions = (d.entries ?? []).map((e) => e.version).filter(Boolean).join(", ");
    return `    <li class="slip ${TINTS[i % TINTS.length]}">
      <a class="cover name" href="/drops/${h(d.uuid)}/">${iconImg(DL, d, 28)}${h(d.name)}</a>
      <span class="note">${h(d.note)}</span>
      <span class="meta">${h(versions)} · signed${d.lib ? " · library" : ""}</span>
    </li>`;
  }).join("\n");

  return `
  <h1 class="title">drops</h1>
  <p class="gloss">uuid ひとつで、機能が降ってくる。</p>
  <p class="wish">Every drop on the table, from <a href="${h(REGISTRY)}">the registry</a>. Press one to read it: who wrote it, what is served, and the source as it is. <a href="https://f3liz.casa/noraneko/drops/">What a drop is</a> is told at the house. The ones marked <i>library</i> are not installed on their own: they come with the drops that ask for them.</p>
  <p class="status">${drops.length} drop${drops.length === 1 ? "" : "s"} being served</p>

  <ul class="list">
${rows}
  </ul>
${foot(DL, built)}`;
}
