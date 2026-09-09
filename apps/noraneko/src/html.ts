// SPDX-License-Identifier: MPL-2.0
// 頁の共通部分。棚(shelf.ts)と一枚(page.ts)が同じ紙を使う。

export const REGISTRY = "https://github.com/f3liz-casa/noraneko-registry";
export const IDENTITY =
  "https://github.com/f3liz-casa/noraneko-registry/.github/workflows/verify-and-sign.yml@refs/heads/main";
export const TINTS = ["sakura", "tamago", "sora", "wakaba", "fuji", "momo"];

export interface Entry { name?: string; id?: string; version?: string; file?: string; size?: number; sha256?: string }
export interface Att { who?: string; rekor?: string; rekorUrl?: string; url?: string }
export interface Row {
  uuid: string; name: string; note?: string; contact?: string[]; lib?: boolean;
  icon?: { file?: string } | null; entries?: Entry[];
  source?: { repo?: string; commit?: string; commit_time?: string; path?: string };
  attestations?: Att[] | null;
}
export interface SourceFile { path: string; text: string | null; bytes: number }

export const h = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** 設定画面(settings/src/lib/contact.ts)と同じ読みかた */
export function contactHref(c: string): string | null {
  let m = /^gh\/(.+)$/.exec(c);
  if (m) return `https://github.com/${m[1]}`;
  m = /^mail\/(.+)$/.exec(c);
  if (m) return `mailto:${m[1]}`;
  m = /^social\/@([^@]+)@(.+)$/.exec(c);
  if (m) return `https://${m[2]}/@${m[1]}`;
  return /^https?:\/\//.test(c) ? c : null;
}

/**
 * 頁の上だけ。材料(dl)を待たずに、これだけ先に流す。
 * `loading` の一行は、あとから届く `<style>` が消す ── JS は使わない。
 */
export const shell = (title: string, description: string, crumb: string, waiting: string) =>
  `${head(title, description)}
  <p class="eyebrow">${crumb}</p>
  <p class="loading">${h(waiting)}</p>`;

/** 材料が揃って、残りを流し終えたところで。上のロードの行を消す */
export const doneLoading = `<style>.loading{display:none}</style>`;

export const head = (title: string, description: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${h(title)}</title>
<meta name="description" content="${h(description)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/style.css" />
</head>
<body>
<main class="table">`;

export const foot = (DL: string, built: string) => `
  <p class="closing">What a drop is, how it reaches you, and what it is not: <a href="https://f3liz.casa/noraneko/drops/">f3liz.casa/noraneko/drops/</a>. Served by <code>${h(DL)}</code>, signed by <code>${h(IDENTITY)}</code>.</p>
  <p class="closing">This page is built when you ask for it, out of what <code>${h(DL)}</code> is serving right now (${h(built)}). Drafted by Shiro, an AI assistant, sitting next to <a href="https://f3liz.casa/">nyanrus</a>.</p>
</main>
</body>
</html>
`;

/** その drop の絵(有れば)。棚でも一枚でも同じもの */
export const iconImg = (DL: string, d: Row, px: number) =>
  d.icon?.file ? `<img class="icon" src="${h(DL)}/${h(d.uuid)}/${h(d.icon.file)}" alt="" width="${px}" height="${px}" /> ` : "";
