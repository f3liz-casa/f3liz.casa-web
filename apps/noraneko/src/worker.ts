// noraneko.f3liz.casa — 棚(/drops/)と、その一枚(/drops/<uuid>/)を、
// **dl が配れているものから、その場で**組む。
//
// 前は build のときに一度組んで、静的な HTML を置いていた。材料は正しくなったが
// (dl から読む)、組む瞬間が deploy のときのままだったので、新しい drop が配られても
// 棚は deploy まで古いままだった ── しかも棚だけ生かすと、まだ無い一枚へのリンクが
// 死ぬ。棚と一枚は同じ速さで動かないといけない。
//
// 材料は三つ、どれも dl:
//
//   /drop/index.json            棚。判が通る drop だけが並ぶ
//   /drop/<uuid>/manifest.json  その一枚(entries の id と sha256 は、ここにしかない)
//   /drop/<uuid>/source.json    xpi の中の source/ と同じ中身、開かずに読める形
//
// source.json があるので zip を開かない。どれも dl が sha256 を照らしてから返す。
// それ以外(/, /style.css, …)は静的なまま assets へ。

/** 既定は本番。手元で見るときは wrangler dev --var DL:http://127.0.0.1:8765/drop */
const DL_DEFAULT = "https://dl.f3liz.casa/drop";
const REGISTRY = "https://github.com/f3liz-casa/noraneko-registry";
const IDENTITY = "https://github.com/f3liz-casa/noraneko-registry/.github/workflows/verify-and-sign.yml@refs/heads/main";
const TINTS = ["sakura", "tamago", "sora", "wakaba", "fuji", "momo"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TTL = 300;

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  DL?: string;
}

interface Entry { name?: string; id?: string; version?: string; file?: string; size?: number; sha256?: string }
interface Att { who?: string; rekor?: string; rekorUrl?: string; url?: string }
interface Row {
  uuid: string; name: string; note?: string; contact?: string[]; lib?: boolean;
  icon?: { file?: string } | null; entries?: Entry[];
  source?: { repo?: string; commit?: string; commit_time?: string; path?: string };
  attestations?: Att[] | null;
}
interface SourceFile { path: string; text: string | null; bytes: number }

const h = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cf: { cacheTtl: 60 } } as RequestInit);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** 設定画面(settings/src/lib/contact.ts)と同じ読みかた */
function contactHref(c: string): string | null {
  let m = /^gh\/(.+)$/.exec(c);
  if (m) return `https://github.com/${m[1]}`;
  m = /^mail\/(.+)$/.exec(c);
  if (m) return `mailto:${m[1]}`;
  m = /^social\/@([^@]+)@(.+)$/.exec(c);
  if (m) return `https://${m[2]}/@${m[1]}`;
  return /^https?:\/\//.test(c) ? c : null;
}

const head = (title: string, description: string) => `<!doctype html>
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

const foot = (DL: string, built: string) => `
  <p class="closing">What a drop is, how it reaches you, and what it is not: <a href="https://f3liz.casa/noraneko/drops/">f3liz.casa/noraneko/drops/</a>. Served by <code>${h(DL)}</code>, signed by <code>${h(IDENTITY)}</code>.</p>
  <p class="closing">This page is built when you ask for it, out of what <code>${h(DL)}</code> is serving right now (${h(built)}). Drafted by Shiro, an AI assistant, sitting next to <a href="https://f3liz.casa/">nyanrus</a>.</p>
</main>
</body>
</html>
`;

function shelfHtml(DL: string, drops: Row[], built: string): string {
  const rows = drops.map((d, i) => {
    const versions = (d.entries ?? []).map((e) => e.version).filter(Boolean).join(", ");
    const icon = d.icon?.file
      ? `<img class="icon" src="${h(DL)}/${h(d.uuid)}/${h(d.icon.file)}" alt="" width="28" height="28" /> `
      : "";
    return `    <li class="slip ${TINTS[i % TINTS.length]}">
      <a class="cover name" href="/drops/${h(d.uuid)}/">${icon}${h(d.name)}</a>
      <span class="note">${h(d.note)}</span>
      <span class="meta">${h(versions)} · signed${d.lib ? " · library" : ""}</span>
    </li>`;
  }).join("\n");
  return `${head("drops · noraneko", "Drops: features that fall into noraneko from a uuid. Built and signed by the registry from source you can read.")}
  <p class="eyebrow"><a href="/">noraneko</a> · drops</p>
  <h1 class="title">drops</h1>
  <p class="gloss">uuid ひとつで、機能が降ってくる。</p>
  <p class="wish">Every drop on the table, from <a href="${h(REGISTRY)}">the registry</a>. Press one to read it: who wrote it, what is served, and the source as it is. <a href="https://f3liz.casa/noraneko/drops/">What a drop is</a> is told at the house. The ones marked <i>library</i> are not installed on their own: they come with the drops that ask for them.</p>
  <p class="status">${drops.length} drop${drops.length === 1 ? "" : "s"} being served</p>

  <ul class="list">
${rows}
  </ul>
${foot(DL, built)}`;
}

function pageHtml(DL: string, d: Row, entries: Entry[], files: SourceFile[], built: string): string {
  const first = entries[0];
  const src = d.source ?? {};
  const icon = d.icon?.file
    ? `<img class="icon" src="${h(DL)}/${h(d.uuid)}/${h(d.icon.file)}" alt="" width="32" height="32" /> `
    : "";
  const contacts = (d.contact ?? []).length
    ? (d.contact ?? []).map((c) => {
        const href = contactHref(c);
        return `      <span class="fact">${href ? `<a href="${h(href)}" target="_blank" rel="noreferrer">${h(c)}</a>` : h(c)}</span>`;
      }).join("\n")
    : `      <p class="fact">no contact written</p>`;
  const served = entries.map((e) =>
    `      <span class="fact"><b>${h(e.name)}</b> · ${h(e.id)} · version <b>${h(e.version)}</b> · ${h(e.size)} bytes</span>
      <span class="fact">sha256 <span class="uuid">${h(e.sha256)}</span></span>`).join("\n");
  const stamps = (d.attestations ?? []).map((a) =>
    `      <span class="fact">${h(a.who)}: ${
      a.rekorUrl ? `<a href="${h(a.rekorUrl)}" target="_blank" rel="noreferrer">Rekor ${h(a.rekor)}</a>`
      : a.url ? `<a href="${h(a.url)}" target="_blank" rel="noreferrer">run</a>` : ""
    }</span>`).join("\n");
  const source = files.length
    ? files.map((f) =>
        f.text === null
          ? `      <details>
        <summary><span class="k">${h(f.path)}</span> · ${h(f.bytes)} bytes</summary>
        <p>Not text. It is in the xpi as it is here, and its sha256 is what the manifest above says for the whole file.</p>
      </details>`
          : `      <details${files.length === 1 ? " open" : ""}>
        <summary><span class="k">${h(f.path)}</span> · ${f.text.split("\n").length} lines</summary>
        <pre><code>${h(f.text)}</code></pre>
      </details>`).join("\n")
    : `      <p class="fact">not served yet</p>`;

  return `${head(`${d.name} · drops · noraneko`, d.note ?? "")}
  <p class="eyebrow"><a href="/">noraneko</a> · <a href="/drops/">drops</a></p>
  <h1 class="title">${icon}${h(d.name)}</h1>
  <p class="gloss">${h(d.note)}</p>
  <p class="status">uuid <span class="uuid">${h(d.uuid)}</span></p>

  <div class="slips">
    <section class="slip wakaba wide">
      <h2 class="slip-title">install</h2>
      <p>Press inside noraneko. It catches the link, opens its settings with this uuid, downloads the xpi, checks the sha256 and the registry's signature, and shows you everything below again before anything runs.</p>
      <div class="actions">
        <a class="btn" href="${h(DL)}/${h(d.uuid)}/${h(first?.file)}">install in noraneko</a>
        <span class="status">In another browser this is a plain link to the xpi. Stock Firefox will refuse it as unverified; paste the uuid into <code>about:nora:settings</code> in noraneko instead.</span>
      </div>
    </section>

    <section class="slip sakura">
      <h2 class="slip-title">who</h2>
${contacts}
    </section>

    <section class="slip sora wide">
      <h2 class="slip-title">what is served</h2>
${served}
      <span class="fact">built from <a href="${h(src.repo)}/tree/${h(src.commit)}/${h(src.path)}" target="_blank" rel="noreferrer">${h(src.path)} @ ${h(String(src.commit ?? "").slice(0, 10))}</a> (${h(src.commit_time)})</span>
${stamps}
      <span class="fact">served at <a href="${h(DL)}/${h(d.uuid)}/manifest.json">${h(DL)}/${h(d.uuid)}/</a></span>
    </section>

    <section class="slip tamago">
      <h2 class="slip-title">in the registry</h2>
      ${src.commit
        ? `<span class="fact"><a href="${h(REGISTRY)}/tree/${h(src.commit)}/drops/${h(d.name)}" target="_blank" rel="noreferrer">drops/${h(d.name)}/</a> @ ${h(String(src.commit).slice(0, 10))} — この版が出てきた木</span>`
        : `<span class="fact">drops/${h(d.name)}/</span>`}
      ${d.lib
        ? `<span class="fact">library: 直接入れるものではなく、これを <code>[deps]</code> に書いた drop に付いてくる</span>`
        : `<span class="fact">actors: <b>${h((entries.map((e) => e.name).filter(Boolean)).join(", "))}</b></span>`}
    </section>

    <section class="slip hai full files">
      <h2 class="slip-title">the source, as it is</h2>
      <p>These come from <code>source.json</code> next to the manifest — the same text the xpi carries under <code>source/</code>, and dl checks its sha256 against the signed manifest before handing it over. Not a copy of the repository: what you read and what runs came out of the same build.</p>
${source}
    </section>
  </div>
${foot(DL, built)}`;
}

const page = (body: string) =>
  new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${TTL}` },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const DL = env.DL ?? DL_DEFAULT;
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method !== "GET" && req.method !== "HEAD") return env.ASSETS.fetch(req);

    const wants = path === "/drops" || path === "/drops/" || /^\/drops\/[0-9a-f-]{36}\/?$/.test(path);
    if (!wants) return env.ASSETS.fetch(req);

    // 組んだ HTML を 5 分だけ持つ(dl の棚と同じ長さ)
    const cache = caches.default;
    const key = new Request(new URL(path.endsWith("/") ? path : path + "/", url).toString(), { method: "GET" });
    const hit = await cache.match(key);
    if (hit) return req.method === "HEAD" ? new Response(null, { status: 200, headers: hit.headers }) : hit;

    const shelf = await json<{ at?: string; drops?: Row[] }>(`${DL}/index.json`);
    if (!shelf?.drops) {
      return new Response("dl の棚が読めない。しばらくしてもう一度。\n", {
        status: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const built = shelf.at ?? "";
    let res: Response;
    if (path.startsWith("/drops/") && path.length > 8) {
      const uuid = path.slice(7).replace(/\/$/, "");
      const row = UUID.test(uuid) ? shelf.drops.find((d) => d.uuid === uuid) : undefined;
      if (!row) return env.ASSETS.fetch(req); // 配られていない uuid は、404 の頁へ
      const [m, s] = await Promise.all([
        json<{ entries?: Entry[] }>(`${DL}/${uuid}/manifest.json`),
        json<{ files?: SourceFile[] }>(`${DL}/${uuid}/source.json`),
      ]);
      res = page(pageHtml(DL, row, m?.entries ?? row.entries ?? [], s?.files ?? [], built));
    } else {
      const drops = [...shelf.drops].sort((a, b) =>
        (a.lib === b.lib ? 0 : a.lib ? 1 : -1) || a.name.localeCompare(b.name));
      res = page(shelfHtml(DL, drops, built));
    }
    await cache.put(key, res.clone());
    return req.method === "HEAD" ? new Response(null, { status: 200, headers: res.headers }) : res;
  },
};
