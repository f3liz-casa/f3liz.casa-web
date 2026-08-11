#!/usr/bin/env julia
# learn.jl の続き。「バスのナンバーと時間による運行パターン」を学習できるか、
# 実際のデータで試す最初の一歩（2026-08-11、くろちゃんに頼まれて）。
#
# learn.jl は区間速度を rid×seg だけで見てる。band(時間帯)は cloud.db に
# 最初から貯まってるのに、一度も条件に使われていなかった。vno(車両ID)も、
# 連続観測から速度を出すためだけに使って、そのまま捨てていた。
#
# ここでやること（learn.jl と同じ検証の型 = モデル対ベースラインのRMSE比較）:
#   1. band条件つき区間速度 V[rid][seg][band] は、band無し(learn.jl と同じ)より
#      予測が当たるか？　当たるならband conditioningに意味がある、という証拠になる。
#   2. 車両ごとの「路線の中央値に対する相対速度」は、車両で系統的に違うか？
#      （運転の癖・車両の機械的な個体差の指紋になりうる）
#   3. 車両ごとに、いつも同じ (rid, band) の組で出てくるか？　＝ダイヤ/運用パターンの指紋
#
# model.json（collectorとdashboardが読む本番ファイル）には触らない。
# 出力は別ファイル patterns.json。既存パイプラインへの副作用ゼロ。
using JSON3, Statistics, Dates
include(joinpath(@__DIR__, "clouddb.jl"))
const CLOUD_CAP = parse(Int, get(ENV, "CLOUD_CAP", "100000"))

const DATADIR = get(ENV, "TAGO_DATA_DIR", @__DIR__)
const PROGDIR = joinpath(DATADIR, "progress")
const OUT = joinpath(DATADIR, "patterns.json")

bandname(h) = h < 0 ? "기존" : h < 5 ? "심야" : h < 7 ? "새벽" : h < 9 ? "출근" :
              h < 12 ? "오전" : h < 15 ? "낮" : h < 18 ? "오후" : h < 20 ? "퇴근" :
              h < 23 ? "밤" : "심야"   # server.js の bandName と揃える

metric(lat, lng, lat0) = (lng * cosd(lat0) * 111320.0, lat * 111320.0)

function geom(stopxy, nseg, lat0)
    seglen = zeros(nseg)
    for k in 1:nseg
        if haskey(stopxy, k) && haskey(stopxy, k + 1)
            ax, ay = metric(stopxy[k][1], stopxy[k][2], lat0)
            bx, by = metric(stopxy[k+1][1], stopxy[k+1][2], lat0)
            seglen[k] = hypot(bx - ax, by - ay)
        end
    end
    cum = zeros(nseg + 1)
    for k in 2:nseg+1
        cum[k] = cum[k-1] + (k - 1 <= length(seglen) ? seglen[k-1] : 0.0)
    end
    return seglen, cum
end
function arc(op, seglen, cum)
    k = floor(Int, op); t = op - k
    k < 1 && return 0.0
    base = k <= length(cum) ? cum[k] : (isempty(cum) ? 0.0 : cum[end])
    return base + t * (k <= length(seglen) ? seglen[k] : 0.0)
end

function main()
    isdir(PROGDIR) || (println("no progress dir"); return)
    files = filter(f -> endswith(f, ".json") && !startswith(f, "._"), readdir(PROGDIR))
    db = open_clouddb()

    # 検証: band条件つきモデル 対 band無しモデル（RMSE, 同じ pair で）
    rm2_blind = 0.0; rm2_band = 0.0; nval = 0
    # 車両の相対速度（route中央値に対する比）を、車両ごとに集める
    vspeed_ratio = Dict{String,Vector{Float64}}()
    # 車両ごとの (rid,band) 出現回数、と観測日数
    vsig = Dict{String,Dict{String,Int}}()
    vdates = Dict{String,Set{String}}()
    nroutes = 0

    for f in files
        s = try
            JSON3.read(read(joinpath(PROGDIR, f), String))
        catch
            continue
        end
        (haskey(s, :stops) && haskey(s, :nseg) && haskey(s, :rid)) || continue
        rid = String(s.rid); nseg = Int(s.nseg)
        nseg >= 1 || continue
        stopxy = Dict{Int,Tuple{Float64,Float64}}()
        for t in s.stops
            stopxy[Int(t[1])] = (Float64(t[2]), Float64(t[3]))
        end
        length(stopxy) < 2 && continue
        lat0 = mean(v[1] for v in values(stopxy))
        seglen, cum = geom(stopxy, nseg, lat0)

        tracks = Dict{String,Vector{Tuple{Float64,Float64,Int}}}()   # vno → (ts, op, band)
        for p in cloud_query(db, rid, CLOUD_CAP)
            length(p) >= 7 || continue
            vno = String(p[7]); ts = Float64(p[6]); band = Int(p[5])
            (isempty(vno) || ts <= 0) && continue
            push!(get!(tracks, vno, Tuple{Float64,Float64,Int}[]), (ts, Float64(p[1]), band))
        end
        isempty(tracks) && continue
        nroutes += 1

        # pair = (k0,k1,dt,darc,a1,a2,v,band,vno)
        pairs = Tuple{Int,Int,Float64,Float64,Float64,Float64,Float64,Int,String}[]
        for (vno, pts) in tracks
            length(pts) < 2 && continue
            sort!(pts, by = x -> x[1])
            for i in 2:length(pts)
                ts1, op1, _ = pts[i-1]; ts2, op2, band2 = pts[i]
                dt = ts2 - ts1
                (5.0 <= dt <= 900.0) || continue
                a1 = arc(op1, seglen, cum); a2 = arc(op2, seglen, cum)
                darc = a2 - a1
                (0.0 < darc <= 30.0 * dt) || continue
                k0 = clamp(floor(Int, op1), 1, nseg); k1 = clamp(floor(Int, op2), 1, nseg)
                push!(pairs, (k0, k1, dt, darc, a1, a2, darc / dt, band2, vno))
                d = kst_date(ts2)   # band は収集側でKST算出済み。日付もKSTで揃える(UTC境界のズレを避ける)
                push!(get!(vdates, vno, Set{String}()), d)
                bn = bandname(band2)
                m = get!(vsig, vno, Dict{String,Int}())
                key = "$rid|$bn"
                m[key] = get(m, key, 0) + 1
            end
        end
        isempty(pairs) && continue

        # band無し（learn.jlと同じ）区間速度表
        segspeeds = Dict{Int,Vector{Float64}}()
        for pr in pairs
            for k in pr[1]:pr[2]
                push!(get!(segspeeds, k, Float64[]), pr[7])
            end
        end
        segmed = Dict(k => median(vs) for (k, vs) in segspeeds)

        # band条件つき区間速度表
        segbandspeeds = Dict{Tuple{Int,Int},Vector{Float64}}()
        for pr in pairs
            for k in pr[1]:pr[2]
                push!(get!(segbandspeeds, (k, pr[8]), Float64[]), pr[7])
            end
        end
        segbandmed = Dict(kb => median(vs) for (kb, vs) in segbandspeeds)

        # 検証（同じpairで両モデルを予測→残差比較）＋ 車両の相対速度
        for pr in pairs
            k0, _, dt, darc, a1, _, v, band, vno = pr
            vb = get(segmed, k0, NaN)
            vc = get(segbandmed, (k0, band), NaN)
            if !isnan(vb)
                rm2_blind += (darc - vb * dt)^2
                push!(get!(vspeed_ratio, vno, Float64[]), v / vb)
            end
            if !isnan(vc)
                rm2_band += (darc - vc * dt)^2
            end
            (isnan(vb) || isnan(vc)) || (nval += 1)
        end
    end

    # 車両の相対速度シグネチャ（十分な観測がある車両だけ）
    vsummary = Dict{String,Any}()
    for (vno, rs) in vspeed_ratio
        length(rs) >= 20 || continue
        ndays = length(get(vdates, vno, Set{String}()))
        top = sort(collect(get(vsig, vno, Dict{String,Int}())), by = x -> -x[2])
        vsummary[vno] = Dict(
            "n" => length(rs), "speed_ratio_median" => median(rs), "speed_ratio_std" => std(rs; corrected = false),
            "distinct_days" => ndays, "top_rid_band" => first(top, min(3, length(top))),
        )
    end

    out = Dict(
        "n_routes_with_data" => nroutes,
        "n_val" => nval,
        "rmse_blind" => nval > 0 ? sqrt(rm2_blind / nval) : 0.0,
        "rmse_band" => nval > 0 ? sqrt(rm2_band / nval) : 0.0,
        "n_vehicles_summarized" => length(vsummary),
        "vehicles" => vsummary,
    )
    open(io -> JSON3.write(io, out), OUT, "w")
    improve = out["n_val"] > 0 ? round(100 * (1 - out["rmse_band"] / out["rmse_blind"]), digits=1) : 0.0
    println("patterns.json: $(nroutes)路線 / RMSE band無し $(round(out["rmse_blind"],digits=2))m vs band付き $(round(out["rmse_band"],digits=2))m (改善 $(improve)%, n=$(nval)) / 車両$(length(vsummary))台ぶんの署名 → $OUT")
end

kst_date(ts) = Dates.format(Dates.unix2datetime(ts) + Dates.Hour(9), "yyyy-mm-dd")

main()
