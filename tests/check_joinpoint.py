"""Conferência independente do motor Joinpoint (js/stats.js).
Implementação própria em numpy/scipy (lstsq, itertools). Só o gerador pseudoaleatório
(mulberry32) e o embaralhamento de Fisher-Yates são portados do JS, para reproduzir as mesmas permutações.
Divergências são REPORTADAS, nunca ajustadas à mão.
Uso: node tests/dump_js.js > /tmp/js.json && python3 tests/check_joinpoint.py /tmp/js.json
"""
import json, sys, itertools
import numpy as np
from scipy import stats

M = 0xFFFFFFFF
def imul(a, b): return (a * b) & M

def mulberry32(seed):
    st = {"a": seed & M}
    def f():
        st["a"] = (st["a"] + 0x6D2B79F5) & M
        t = st["a"]
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ (t + imul(t ^ (t >> 7), t | 61))) & M
        return ((t ^ (t >> 14)) & M) / 4294967296
    return f

def shuffle(arr, rng):
    for i in range(len(arr) - 1, 0, -1):
        j = int(np.floor(rng() * (i + 1)))
        arr[i], arr[j] = arr[j], arr[i]

def taus_list(n, k, fim=2, entre=2):
    if k == 0: return [()]
    return [c for c in itertools.combinations(range(n), k)
            if c[0] >= fim and c[-1] <= n - 1 - fim and all(b - a >= entre + 1 for a, b in zip(c, c[1:]))]

def design(n, taus):
    x = np.arange(n, dtype=float)
    cols = [np.ones(n), x] + [np.maximum(0, x - t) for t in taus]
    return np.column_stack(cols)

def fit(y, k):
    best = None
    for t in taus_list(len(y), k):
        X = design(len(y), t)
        b, *_ = np.linalg.lstsq(X, y, rcond=None)
        r = y - X @ b
        sse = float(r @ r)
        if best is None or sse < best[0] - 1e-15: best = (sse, t, b, X @ b, r)
    return best

def summary(cob, taus, alpha=0.05):
    y = np.log(np.array(cob) / 100); n = len(y)
    sse, t, b, fitted, r = fit(y, len(taus))
    slopes = [b[1]]
    for j in range(len(t)): slopes.append(slopes[-1] + b[2 + j])
    bounds = [0, *t, n - 1]
    res = {"apc": [(np.exp(s) - 1) * 100 for s in slopes]}
    # MQ não restrito por segmento, sem pontos sobre joinpoints
    parts, nstar, ss = [], 0, 0.0
    for s in range(len(t) + 1):
        idx = [i for i in range(bounds[s], bounds[s + 1] + 1) if i not in t]
        nstar += len(idx)
        if len(idx) >= 2:
            lr = stats.linregress(idx, y[idx])
            rr = y[idx] - (lr.intercept + lr.slope * np.array(idx))
            ss += float(rr @ rr)
            parts.append((lr.slope, float(np.sum((np.array(idx) - np.mean(idx)) ** 2))))
        else: parts.append((np.nan, np.nan))
    df = nstar - 2 * (len(t) + 1)
    res["df"], res["nStar"] = df, nstar
    L = [bounds[s + 1] - bounds[s] for s in range(len(t) + 1)]
    res["aapc"] = (np.exp(sum(l * s for l, s in zip(L, slopes)) / sum(L)) - 1) * 100
    if df > 0:
        sig2 = ss / df; tc = stats.t.ppf(1 - alpha / 2, df)
        se = [np.sqrt(sig2 / sxx) for _, sxx in parts]
        res["se"] = se
        res["p"] = [2 * (1 - stats.t.cdf(abs(sl / s), df)) for (sl, _), s in zip(parts, se)]
        res["lo"] = [(np.exp(sl - s * tc) - 1) * 100 for (sl, _), s in zip(parts, se)]
        res["hi"] = [(np.exp(sl + s * tc) - 1) * 100 for (sl, _), s in zip(parts, se)]
    return res, sse, t, b

def main(path):
    js = json.load(open(path)); fails = []; checks = 0
    def cmp(label, a, b, tol=1e-9):
        nonlocal checks; checks += 1
        a = np.atleast_1d(np.array(a, dtype=float)); b = np.atleast_1d(np.array(b, dtype=float))
        ok = a.shape == b.shape and np.all((np.abs(a - b) <= tol * np.maximum(1, np.abs(b))) | (np.isnan(a) & np.isnan(b)))
        if not ok: fails.append((label, a.tolist(), b.tolist()))
    series = {"serie5": [80, 85, 90, 70, 50],
              "serie25": [78, 80, 83, 85, 88, 90, 93, 95, 96, 97, 98, 99, 98, 97, 96, 96, 92, 88, 85, 83, 76, 74, 75, 78, 80]}
    for name, cob in series.items():
        y = np.log(np.array(cob) / 100)
        for f in js[name]["fits"]:
            k = f["k"]; sse, t, b, _, _ = fit(y, k)
            cmp(f"{name} k={k} sse", f["sse"], sse); cmp(f"{name} k={k} taus", f["taus"], list(t))
            cmp(f"{name} k={k} nConfigs", f["nConfigs"], len(taus_list(len(y), k)))
            sk = "sum" + str(k)
            if sk in js[name]:
                res, *_ = summary(cob, f["taus"])
                for key in ("apc", "aapc", "df", "nStar"): cmp(f"{name} k={k} {key}", js[name][sk][key], res[key])
                if "se" in res:
                    for key in ("se", "p", "lo", "hi"): cmp(f"{name} k={k} {key}", js[name][sk][key], res[key], 1e-7)
    # Valores esperados do guia corrigido (série didática)
    r5, *_ = summary(series["serie5"], [2])
    cmp("esperado APC1 serie5 (+6,8)", round(r5["apc"][0], 1), 6.8, 1e-12)
    cmp("esperado APC2 serie5 (-25,4)", round(r5["apc"][1], 1), -25.4, 1e-12)
    cmp("esperado AAPC serie5 (-10,7)", round(r5["aapc"], 1), -10.7, 1e-12)
    # Permutação: mesma semente, mesmos embaralhamentos
    y = np.log(np.array(series["serie25"]) / 100)
    for p in js["perm"]:
        ka, kb = p["ka"], p["kb"]
        sa, _, _, fa, ra = fit(y, ka); sb, *_ = fit(y, kb)
        cmp(f"perm {ka}x{kb} T obs", p["T"], sa / sb)
        rng = mulberry32(p["seed"]); pool = ra.copy(); Ts = []
        for _ in range(len(p["Ts"])):
            shuffle(pool, rng)
            yy = fa + pool
            Ts.append(fit(yy, ka)[0] / fit(yy, kb)[0])
        cmp(f"perm {ka}x{kb} Ts", p["Ts"], Ts, 1e-8)
        cmp(f"perm {ka}x{kb} exceed", p["exceed"], sum(1 for T in Ts if T >= p["T"]), 0)
    print(f"{checks} comparações, {len(fails)} divergências")
    for f in fails: print("DIVERGÊNCIA:", f)
    sys.exit(1 if fails else 0)

main(sys.argv[1])
