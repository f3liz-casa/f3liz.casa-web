// SPDX-License-Identifier: MPL-2.0
// 色をつける(build のとき、一度だけ)。
//
//   echo '[{"key":"…","path":"a/b.ts","text":"…"}]' | node scripts/highlight.mjs
//   → {"…": "<pre class=shiki>…</pre>"}
//
// shiki は明暗ふたつの theme で塗って、色を CSS 変数(--shiki-light / --shiki-dark)
// で置いていく。ページ側は prefers-color-scheme でどちらを読むか決めるだけ
// (style.css)。紙の色の上に載せたいので、shiki 自身の背景は使わない。
//
// .tsubaki は julia として塗る。Julia の書き心地に寄せた言語なので、字面もほぼ
// そのまま読める(完全ではない。そう見えるように、とは言わない)。
import { createHighlighter } from "shiki";

const LANG = {
  ".ts": "typescript", ".tsx": "tsx", ".mts": "typescript", ".js": "javascript", ".mjs": "javascript",
  ".json": "json", ".css": "css", ".html": "html", ".toml": "toml", ".rb": "ruby", ".md": "markdown",
  ".tsubaki": "julia", ".jl": "julia",
};
const langOf = (path) => LANG[(path.match(/\.[^.]+$/) ?? [""])[0]] ?? null;

// 長すぎるもの・一行が長すぎるもの(build の産物の glue など)は塗らない:
// 読むためのものではないし、待たされるほうが困る
const TOO_BIG = 200_000;
const TOO_LONG_LINE = 2000;

const input = JSON.parse(await new Response(process.stdin).text());
const langs = [...new Set(input.map((f) => langOf(f.path)).filter(Boolean))];
const highlighter = await createHighlighter({ themes: ["vitesse-light", "vitesse-dark"], langs });

const out = {};
for (const file of input) {
  const lang = langOf(file.path);
  if (!lang) continue;
  if (file.text.length > TOO_BIG) continue;
  if (file.text.split("\n").some((line) => line.length > TOO_LONG_LINE)) continue;
  out[file.key] = highlighter.codeToHtml(file.text, {
    lang,
    themes: { light: "vitesse-light", dark: "vitesse-dark" },
    defaultColor: false,
  });
}
process.stdout.write(JSON.stringify(out));
