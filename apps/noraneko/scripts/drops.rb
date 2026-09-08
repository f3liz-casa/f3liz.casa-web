#!/usr/bin/env ruby
# drops.rb: registry の main から /drops/ と /drops/<uuid>/ を静的に組む(vite build の前に)。
#
#   ruby scripts/drops.rb                    → drops/index.html, drops/<uuid>/index.html
#   REGISTRY_DIR=~/repos/noraneko-registry   手元の checkout で組む(clone しない。試すとき)
#   LOCAL_BUILD=1                            manifest を dl でなく REGISTRY_DIR/_build/<name>/ から読む(判が押される前に見た目を見るとき)
#
# 材料: registry の drops/<name>/drop.toml(uuid / name / note / contact / actors)と src/**/*.ts、
# それに dl.f3liz.casa/drop/<uuid>/manifest.json と attestations.json(まだ無ければ「not served yet」)。
require "erb"
require "json"
require "net/http"
require "tmpdir"
require "fileutils"
include ERB::Util

ROOT = File.expand_path("..", __dir__)
REGISTRY = "https://github.com/f3liz-casa/noraneko-registry"
DL = "https://dl.f3liz.casa/drop"
IDENTITY = "https://github.com/f3liz-casa/noraneko-registry/.github/workflows/verify-and-sign.yml@refs/heads/main"
TINTS = %w[sakura tamago sora wakaba fuji momo].freeze
UUID = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/

def fetch_json(url)
  r = Net::HTTP.get_response(URI(url))
  r.code == "200" ? JSON.parse(r.body) : nil
rescue StandardError => e
  warn "#{url}: #{e.message}"
  nil
end

def local_manifest(reg, name)
  f = File.join(reg, "_build", name, "manifest.json")
  File.file?(f) ? JSON.parse(File.read(f)) : nil
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

def read_drops(reg)
  Dir.glob(File.join(reg, "drops", "*", "drop.toml")).sort.filter_map do |t|
    dir = File.dirname(t)
    name = File.basename(dir)
    next if name.start_with?("_")
    toml = File.read(t)
    uuid = toml[/^uuid\s*=\s*"([^"]+)"/, 1]
    unless uuid&.match?(UUID)
      warn "#{t}: uuid が無い(古い形)。飛ばす"
      next
    end
    contact = toml[/^contact\s*=\s*(.+)$/, 1].to_s.scan(/"([^"]+)"/).flatten
    actors = toml[/^actors\s*=\s*\[(.*)\]/, 1].to_s.scan(/"([^"]+)"/).flatten
    # 「source, as it is」に出すもの。読めない bytes(runtime の .wasm など)は
    # 中身を出さずに、名前と大きさだけ言う — 出せない振りをするより、出せないと
    # 言うほうが正直だし、HTML に混ぜると壊れる
    sources = Dir.glob(File.join(dir, "src", "**", "*")).select { |f| File.file?(f) }.sort.map do |f|
      raw = File.binread(f).force_encoding("UTF-8")
      text = raw.valid_encoding? && !raw.include?("\u0000")
      { path: f.sub("#{dir}/", ""), text: text ? raw : nil, bytes: File.size(f) }
    end
    {
      uuid: uuid, name: name,
      note: toml[/^note\s*=\s*"([^"]*)"/, 1].to_s,
      # library drop: 直接入れるものではなく、要る drop に付いてくる(drop.toml の lib = true)
      lib: toml.match?(/^lib\s*=\s*true/),
      contact: contact, actors: actors, sources: sources,
      manifest: ENV["LOCAL_BUILD"] ? local_manifest(reg, name) : fetch_json("#{DL}/#{uuid}/manifest.json"),
      attestations: ENV["LOCAL_BUILD"] ? nil : fetch_json("#{DL}/#{uuid}/attestations.json"),
    }
  end
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

def build(reg)
  commit = `git -C #{reg} rev-parse HEAD`.strip
  # 入れるものが先、library はそのあと(直接入れるものではないので)
  drops = read_drops(reg).sort_by { |d| [d[:lib] ? 1 : 0, d[:name]] }
  highlight(drops)
  built_at = Time.now.utc.strftime("%Y-%m-%d %H:%M UTC")
  out = File.join(ROOT, "drops")
  FileUtils.rm_rf(out)
  FileUtils.mkdir_p(out)
  File.write(File.join(out, "index.html"), render("drops.html.erb", binding))
  drops.each do |d|
    FileUtils.mkdir_p(File.join(out, d[:uuid]))
    File.write(File.join(out, d[:uuid], "index.html"), render("drop.html.erb", binding))
    puts "#{d[:uuid]}  #{d[:name]}#{d[:manifest] ? "" : "  (not served yet)"}"
  end
  puts "→ drops/ (#{drops.size}, registry #{commit[0, 10]})"
end

if ENV["REGISTRY_DIR"]
  build(File.expand_path(ENV["REGISTRY_DIR"]))
else
  Dir.mktmpdir("noraneko-registry-") do |tmp|
    system("git", "clone", "-q", "--depth", "1", REGISTRY, tmp) or abort "clone failed: #{REGISTRY}"
    build(tmp)
  end
end
