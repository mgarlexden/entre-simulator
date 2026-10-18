import sys, json
import pandas as pd

def rd(path, **kw):
    for enc in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc, **kw)
        except UnicodeDecodeError:
            pass
    raise SystemExit("encoding " + path)

D = sys.argv[1]
OUT = sys.argv[2]
DONGS = [("은평구", "구산동"), ("마포구", "서교동")]
IND = {"CS100001": "한식", "CS100010": "카페"}

area = rd(f"{D}/서울시 상권분석서비스(영역-상권).csv", dtype=str)
sales = rd(f"{D}/서울시 상권분석서비스(추정매출-상권).csv", dtype={"상권_코드": str, "서비스_업종_코드": str, "기준_년분기_코드": str})
stores = rd(f"{D}/서울시 상권분석서비스(점포-상권).csv", dtype={"상권_코드": str, "서비스_업종_코드": str, "기준_년분기_코드": str})
print("sales quarters", sorted(sales["기준_년분기_코드"].unique()))
print("store quarters", sorted(stores["기준_년분기_코드"].unique()))

def band(r):
    cols = {"아침(06~11)": "시간대_06~11_매출_금액", "점심(11~14)": "시간대_11~14_매출_금액", "오후(14~17)": "시간대_14~17_매출_금액",
            "저녁(17~21)": "시간대_17~21_매출_금액", "밤(21~24)": "시간대_21~24_매출_금액"}
    tot = sum(r[c] for c in cols.values())
    return {k: round(r[c] / tot, 3) if tot else None for k, c in cols.items()}

res = {}
for gu, dong in DONGS:
    codes = area[(area["자치구_코드_명"] == gu) & (area["행정동_코드_명"] == dong)]
    out = []
    for _, a in codes.iterrows():
        c = a["상권_코드"]
        row = {"code": c, "name": a["상권_코드_명"], "type": a["상권_구분_코드_명"], "area_m2": int(a["영역_면적"] or 0), "ind": {}}
        for ic, iname in IND.items():
            s = sales[(sales["상권_코드"] == c) & (sales["서비스_업종_코드"] == ic)].set_index("기준_년분기_코드")
            st = stores[(stores["상권_코드"] == c) & (stores["서비스_업종_코드"] == ic)].set_index("기준_년분기_코드")
            if "20262" not in st.index:
                continue
            st_now = st.loc["20262"]
            n = int(st_now["전체_점포_수"])
            d = {"stores": n, "franchise": int(st_now["프랜차이즈_점포_수"]),
                 "open_4q": int(st["개업_점포_수"].sum()), "close_4q": int(st["폐업_점포_수"].sum())}
            if "20262" in s.index:
                r = s.loc["20262"]
                d["sales_q"] = float(r["당월_매출_금액"])
                d["per_store_month_man"] = round(float(r["당월_매출_금액"]) / 3 / n / 1e4, 1) if n else None
                d["weekend"] = round(float(r["주말_매출_금액"]) / float(r["당월_매출_금액"]), 3) if r["당월_매출_금액"] else None
                d["band"] = band(r)
                ages = ["연령대_20_매출_금액", "연령대_30_매출_금액", "연령대_40_매출_금액", "연령대_50_매출_금액", "연령대_60_이상_매출_금액", "연령대_10_매출_금액"]
                at = sum(float(r[x]) for x in ages)
                d["age2030"] = round((float(r[ages[0]]) + float(r[ages[1]])) / at, 3) if at else None
                d["age4050"] = round((float(r[ages[2]]) + float(r[ages[3]])) / at, 3) if at else None
            if "20252" in s.index and "20262" in s.index and float(s.loc["20252"]["당월_매출_금액"]) > 0:
                d["yoy"] = round((float(s.loc["20262"]["당월_매출_금액"]) / float(s.loc["20252"]["당월_매출_금액"]) - 1) * 100, 1)
            row["ind"][iname] = d
        out.append(row)
    res[f"{gu} {dong}"] = out

# 서울 전체 상권 기준 분위 (점포 5곳 이상)
bench = {}
for ic, iname in IND.items():
    st = stores[(stores["서비스_업종_코드"] == ic) & (stores["기준_년분기_코드"] == "20262")][["상권_코드", "전체_점포_수"]]
    s = sales[(sales["서비스_업종_코드"] == ic) & (sales["기준_년분기_코드"] == "20262")][["상권_코드", "당월_매출_금액"]]
    m = st.merge(s, on="상권_코드")
    m = m[m["전체_점포_수"] >= 5]
    ps = m["당월_매출_금액"] / 3 / m["전체_점포_수"] / 1e4
    bench[iname] = {"n": int(len(m)), "per_store_q": [round(float(ps.quantile(q)), 1) for q in (0.25, 0.5, 0.75)]}
res["_bench"] = bench
json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1)[:12000])
