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
import type { Entry, Row, SourceFile } from "./html.ts";

/** 既定は本番。手元で見るときは wrangler dev --var DL:http://127.0.0.1:8765/drop */
const DL_DEFAULT = "https://dl.f3liz.casa/drop";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TTL = 300;

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  DL?: string;
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cf: { cacheTtl: 60 } } as RequestInit);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
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
