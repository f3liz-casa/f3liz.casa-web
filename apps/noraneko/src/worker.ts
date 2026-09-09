// SPDX-License-Identifier: MPL-2.0
// noraneko.f3liz.casa — 棚(/drops/)と、その一枚(/drops/<uuid>/)を、
// **dl が配れているものから、その場で**組む。
//
// 静的に組んでいたころは、材料が正しくても(dl から読む)組む瞬間が deploy のときの
// ままだった。新しい drop が配られても棚は古いし、棚だけ生かすと、まだ無い一枚への
// リンクが死ぬ。棚と一枚は同じ速さで動かないといけないので、両方その場で組む。
//
// 材料は三つ、どれも dl:
//
//   /drop/index.json            棚。判が通る drop だけが並ぶ
//   /drop/<uuid>/manifest.json  その一枚(entries の id と sha256 は、ここにしかない)
//   /drop/<uuid>/source.json    xpi の中の source/ と同じ中身、開かずに読める形
//
// source.json があるので zip を開かない。どれも dl が sha256 を照らしてから返す。
// それ以外(/, /style.css, …)は静的なまま assets へ。
//
// 頁そのものは shelf.ts と page.ts。ここは道順と、取ってくるところと、cache だけ。

import { pageHtml } from "./page.ts";
import { shelfHtml } from "./shelf.ts";
import { doneLoading, shell, type Entry, type Row, type SourceFile } from "./html.ts";

/** 既定は本番。手元で見るときは wrangler dev --var DL:http://127.0.0.1:8765/drop */
const DL_DEFAULT = "https://dl.f3liz.casa/drop";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TTL = 300;

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  DL?: string;
}

const HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${TTL}` };

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cf: { cacheTtl: 60 } } as RequestInit);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * 頁の上を先に流して、材料(dl)が揃ってから残りを流す。
 *
 * 組むのに待つのは主に dl の index.json ── 一件ごとに判を確かめて棚を作るので、
 * cache が切れているときは一秒を超える。それを白い画面で待たせない: 見出しと
 * 「読んでいます」の一行が先に出て、届いたら残りが下に続き、最後の `<style>` が
 * その一行を消す。**JS は使わない**(この site は使わない作りで通している)。
 *
 * 流し終えたら、組み上がった一枚をそのまま cache に置く ── 次の人は待たない。
 */
function streamed(top: string, rest: Promise<string>, ctx: ExecutionContext, cache: Cache, key: Request): Response {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const enc = new TextEncoder();
  void w.write(enc.encode(top));
  ctx.waitUntil((async () => {
    let body = "";
    try {
      body = (await rest) + doneLoading;
      await w.write(enc.encode(body));
    } catch (e) {
      await w.write(enc.encode(`<p class="msg">組めなかった: ${String(e)}</p>` + doneLoading));
      body = "";
    }
    await w.close();
    // 途中で落ちたものは置かない(半分の頁が 5 分居座るほうが困る)
    if (body) await cache.put(key, new Response(top + body, { headers: HEADERS }));
  })());
  return new Response(readable, { headers: HEADERS });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    const uuid = path.startsWith("/drops/") && path.length > 8 ? path.slice(7).replace(/\/$/, "") : null;
    const one = uuid !== null && UUID.test(uuid);
    if (uuid !== null && !one) return env.ASSETS.fetch(req); // uuid の形をしていない

    const crumb = one
      ? `<a href="/">noraneko</a> · <a href="/drops/">drops</a>`
      : `<a href="/">noraneko</a> · drops`;
    const top = shell(
      one ? "drops · noraneko" : "drops · noraneko",
      "Drops: features that fall into noraneko from a uuid. Built and signed by the registry from source you can read.",
      crumb,
      `${DL.replace(/^https?:\/\//, "")} を読んでいます`,
    );
    if (req.method === "HEAD") return new Response(null, { status: 200, headers: HEADERS });

    const rest = (async () => {
      const shelf = await json<{ at?: string; drops?: Row[] }>(`${DL}/index.json`);
      if (!shelf?.drops) throw new Error("dl の棚が読めない。しばらくしてもう一度");
      const built = shelf.at ?? "";
      if (one) {
        const row = shelf.drops.find((d) => d.uuid === uuid);
        if (!row) throw new Error(`${uuid} は、この registry からは配られていない`);
        const [m, s] = await Promise.all([
          json<{ entries?: Entry[] }>(`${DL}/${uuid}/manifest.json`),
          json<{ files?: SourceFile[] }>(`${DL}/${uuid}/source.json`),
        ]);
        return pageHtml(DL, row, m?.entries ?? row.entries ?? [], s?.files ?? [], built);
      }
      const drops = [...shelf.drops].sort((a, b) =>
        (a.lib === b.lib ? 0 : a.lib ? 1 : -1) || a.name.localeCompare(b.name));
      return shelfHtml(DL, drops, built);
    })();
    return streamed(top, rest, ctx, cache, key);
  },
};
