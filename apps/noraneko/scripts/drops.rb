#!/usr/bin/env ruby
# drops.rb: **dl が配っているもの**から /drops/ と /drops/<uuid>/ を静的に組む(vite build の前に)。
#
#   ruby scripts/drops.rb                    → drops/index.html, drops/<uuid>/index.html
#   LOCAL_DIR=~/repos/noraneko-registry/_build   dl でなく手元の _build/<name>/ から組む
#                                               (判が押される前に見た目を見るとき)
#
# 材料は dl.f3liz.casa/drop/index.json 一枚と、そこが名指しした xpi。registry を clone しない:
#
# - **棚に並ぶのは、いま配れているものだけ。** index.json は判が通る drop しか出さないので、
#   main には有るがまだ配られていないもの、判が外れたものは、ここにも出ない。
#   押せないものが並んでいる棚は、棚として嘘になる。
# - **source は xpi の中の source/ から読む。** 前は registry の main の src/ を読んでいたので、
#   「配られている bytes」と「いま main にある字」がずれうる(publish から進んだぶん)。
#   いまは、読んでいる字が、入れたときに動く bytes と同じ組から出ている。
# - **registry へのリンクは、その drop が build された commit へ。** manifest の source が
#   覚えているので、main の頭ではなく、その版が出てきた木を指す。
require "erb"
require "json"
require "net/http"
require "tmpdir"
require "fileutils"
include ERB::Util
require "shellwords"

ROOT = File.expand_path("..", __dir__)
REGISTRY = "https://github.com/f3liz-casa/noraneko-registry"
DL = "https://dl.f3liz.casa/drop"
IDENTITY = "https://github.com/f3liz-casa/noraneko-registry/.github/workflows/verify-and-sign.yml@refs/heads/main"
TINTS = %w[sakura tamago sora wakaba fuji momo].freeze
UUID = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/
# 判が押される前に見た目を見るとき: registry の _build/ から組む
LOCAL = ENV["LOCAL_DIR"] && File.expand_path(ENV["LOCAL_DIR"])

def fetch_json(url)
  r = Net::HTTP.get_response(URI(url))
  r.code == "200" ? JSON.parse(r.body) : nil
rescue StandardError => e
  warn "#{url}: #{e.message}"
  nil
end

def fetch_bytes(url)
  r = Net::HTTP.get_response(URI(url))
  r.code == "200" ? r.body : nil
rescue StandardError => e
  warn "#{url}: #{e.message}"
  nil
end

# xpi の中の source/ を読む(zip は unzip に任せる。ruby の stdlib には zip が無い)。
# 読めない bytes(runtime の .wasm など)は中身を出さずに名前と大きさだけ言う —
# 出せない振りをするより、出せないと言うほうが正直だし、HTML に混ぜると壊れる。
def read_sources(xpi_path)
  names = `unzip -Z1 #{xpi_path.shellescape} 2>/dev/null`.lines.map(&:chomp)
  names.select { |n| n.start_with?("source/") && !n.end_with?("/") }.sort.map do |n|
    raw = `unzip -p #{xpi_path.shellescape} #{n.shellescape} 2>/dev/null`.b
    text = raw.dup.force_encoding("UTF-8")
    ok = text.valid_encoding? && !text.include?("\u0000")
    { path: n.sub("source/", ""), text: ok ? text : nil, bytes: raw.bytesize }
  end
end

# 設定画面(settings/src/lib/contact.ts)と同じ読みかた
def contact_href(c)
  case c
  when %r{\Agh/(.+)} then "https://github.com/#{$1}"
  when %r{\Amail/(.+)} then "mailto:#{$1}"
  when %r{\Asocial/@([^@]+)@(.+)} then "https://#{$2}/@#{$1}"
  when %r{\Ahttps?://} then c
  end
end

# 棚(dl の index.json)から、判が通っている drop を全部。source は、その drop の
# 一つ目の xpi の中の source/ から読む(= 入れたときに動く bytes と同じ組)。
def read_drops(work)
  shelf =
    if LOCAL
      Dir.glob(File.join(LOCAL, "*", "manifest.json")).sort.map { |f| shelf_row(JSON.parse(File.read(f))) }
    else
      (fetch_json("#{DL}/index.json") || {})["drops"] || []
    end
  shelf.filter_map do |row|
    uuid = row["uuid"].to_s
    next warn("#{row["name"]}: uuid が読めない。飛ばす") unless uuid.match?(UUID)
    entries = row["entries"] || []
    xpi = xpi_path(work, uuid, entries.first)
    {
      uuid: uuid,
      name: row["name"].to_s,
      note: row["note"].to_s,
      lib: row["lib"] == true,
      contact: (row["contact"] || []).select { |c| c.is_a?(String) },
      actors: entries.map { |e| e["name"] }.compact,
      icon: row["icon"],
      sources: xpi ? read_sources(xpi) : [],
      # 版と source は棚がそのまま持っている(template が manifest として読む形に合わせる)
      manifest: entries.empty? ? nil : { "entries" => entries, "source" => row["source"] },
      attestations: row["attestations"] || (LOCAL ? nil : fetch_json("#{DL}/#{uuid}/attestations.json")&.dig("attestations")),
    }
  end
end

# LOCAL_DIR のときは manifest.json をそのまま棚の一行の形に読み替える(判はまだ無い)
def shelf_row(m)
  {
    "uuid" => m["uuid"], "name" => m["name"], "note" => m["note"], "lib" => m["lib"] == true,
    "contact" => m["contact"], "entries" => m["entries"], "source" => m["source"], "icon" => m["icon"],
  }
end

# その drop の一つ目の xpi を手元に(dl から落とすか、_build から写すか)
def xpi_path(work, uuid, entry)
  file = entry && entry["file"]
  return nil unless file&.match?(/\A[A-Za-z0-9._-]+\z/)
  dst = File.join(work, "#{uuid}-#{file}")
  if LOCAL
    src = Dir.glob(File.join(LOCAL, "*", file)).find { |f| File.file?(f) && File.read(File.join(File.dirname(f), "manifest.json")).include?(uuid) }
    return nil unless src
    FileUtils.cp(src, dst)
  else
    bytes = fetch_bytes("#{DL}/#{uuid}/#{file}")
    return nil unless bytes
    File.binwrite(dst, bytes)
  end
  dst
end

def render(name, b)
  ERB.new(File.read(File.join(ROOT, "templates", name)), trim_mode: "-").result(b)
end

# 色をつけるのは node の shiki(scripts/highlight.mjs)。ここでは全部の source を
# 一度に渡して、返ってきた HTML を持ち帰るだけ。塗れなかったものは text のまま
# 出す(その場で読めるほうが、色がつくことより大事)。
def highlight(drops)
  files = drops.flat_map do |d|
    d[:sources].filter_map { |f| { key: "#{d[:uuid]}:#{f[:path]}", path: f[:path], text: f[:text] } if f[:text] }
  end
  return if files.empty?
  out = IO.popen([{ "NODE_NO_WARNINGS" => "1" }, "node", File.join(ROOT, "scripts", "highlight.mjs")], "r+") do |io|
    io.write(JSON.generate(files))
    io.close_write
    io.read
  end
  painted = JSON.parse(out)
  drops.each do |d|
    d[:sources].each { |f| f[:html] = painted["#{d[:uuid]}:#{f[:path]}"] }
  end
  puts "shiki: #{painted.size}/#{files.size} files"
rescue StandardError => e
  warn "shiki: #{e.message}(色なしで続ける)"
end

def build(work)
  # 入れるものが先、library はそのあと(直接入れるものではないので)
  drops = read_drops(work).sort_by { |d| [d[:lib] ? 1 : 0, d[:name]] }
  highlight(drops)
  built_at = Time.now.utc.strftime("%Y-%m-%d %H:%M UTC")
  out = File.join(ROOT, "drops")
  FileUtils.rm_rf(out)
  FileUtils.mkdir_p(out)
  File.write(File.join(out, "index.html"), render("drops.html.erb", binding))
  drops.each do |d|
    FileUtils.mkdir_p(File.join(out, d[:uuid]))
    File.write(File.join(out, d[:uuid], "index.html"), render("drop.html.erb", binding))
    puts "#{d[:uuid]}  #{d[:name]}  #{d[:sources].size} files#{d[:manifest] ? "" : "  (no entries)"}"
  end
  puts "→ drops/ (#{drops.size}#{LOCAL ? ", from #{LOCAL}" : ", from #{DL}/index.json"})"
end

Dir.mktmpdir("noraneko-drops-") { |tmp| build(tmp) }
