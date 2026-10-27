"""Conferência independente do I de Moran global (Python: shapely e numpy, sem reutilizar código JS).
Uso: python3 tests/check_moran.py moran_js.json     (gerado por: node tests/dump_moran.js > moran_js.json)
Refaz: vizinhança rainha/torre (shapely) e 5 vizinhos mais próximos; I, E[I], S0, soma dos produtos e da soma de quadrados;
permutação com a MESMA semente (mulberry32 e Fisher-Yates reimplementados) para M = 99, 999 e 9999 (rainha) e 999 (torre, 5 vizinhos);
contribuições por município (somam o I); exemplo A-F (I = 0,7035; E[I] = -0,2) e teste exato das 720 ordens (itertools);
tabuleiros 6x6; e uma verificação estatística tolerante com sorteios independentes (numpy), documentada abaixo:
  - p estimado com 20000 permutações do numpy deve ficar a até 4 erros-padrão (+ 1/(M+1)) do pseudo-p do JS;
  - média dos I embaralhados deve ficar a até 4 erros-padrão de E[I];
  - percentis 2,5% e 97,5% do JS (999 réplicas) devem ficar a até 0,03 dos do numpy (20000 réplicas)."""
import json, math, sys, os, itertools
import numpy as np
from shapely.geometry import shape
from shapely import affinity

d = json.load(open(sys.argv[1]))
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
fc = json.load(open(os.path.join(raiz, "assets/geo/al_municipios.geojson"), encoding="utf-8"))
G = [shape(f["geometry"]) for f in fc["features"]]
n = len(G); bad = 0; tot = 0


def chk(nome, a, b, tol=1e-9):
    global bad, tot
    tot += 1
    ok = (a == b) if isinstance(a, (list, str, bool)) or isinstance(b, (list, str, bool)) else abs(float(a) - float(b)) <= tol
    if not ok:
        bad += 1
        print("DIVERGE", nome, a, b)


chk("códigos", [f["properties"]["c"] for f in fc["features"]], d["codigos"])

# ---- vizinhança por geometria ----
Q = [[] for _ in G]; R_ = [[] for _ in G]
for i in range(n):
    for j in range(i + 1, n):
        if G[i].intersects(G[j]):
            Q[i].append(j); Q[j].append(i)
            if G[i].intersection(G[j]).length > 0:
                R_[i].append(j); R_[j].append(i)
Q = [sorted(x) for x in Q]; R_ = [sorted(x) for x in R_]


def centroide(g):
    ys = []
    for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]):
        ys += [c[1] for c in p.exterior.coords]
    kx = math.cos(math.radians(sum(ys) / len(ys)))
    c = affinity.scale(g, xfact=kx, yfact=1, origin=(0, 0)).centroid
    return c.x / kx, c.y


C = [centroide(g) for g in G]
kx = math.cos(math.radians(sum(c[1] for c in C) / n))
K = []
for i in range(n):
    dist = sorted((math.hypot((C[i][0] - C[j][0]) * kx, C[i][1] - C[j][1]), j) for j in range(n) if j != i)
    K.append(sorted(j for _, j in dist[:5]))
NB = {"queen": Q, "rook": R_, "knn5": K}
for k in NB:
    chk("vizinhança " + k, NB[k], d["nb"][k])


def Wmat(nb):
    m = len(nb); W = np.zeros((m, m))
    for i, l in enumerate(nb):
        for j in l:
            W[i, j] = 1.0 / len(l)
    return W


def moran(v, W):
    z = v - v.mean(); wz = W @ z
    return (len(v) / W.sum()) * (z @ wz) / (z @ z), z, wz


def mulberry32(seed):
    a = [seed & 0xFFFFFFFF]
    def f():
        a[0] = (a[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = a[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return f


def fisher_yates(v, rnd):
    for i in range(len(v) - 1, 0, -1):
        j = int(math.floor(rnd() * (i + 1)))
        v[i], v[j] = v[j], v[i]


W = {k: Wmat(NB[k]) for k in NB}
seed = d["seed"]
rng_np = np.random.default_rng(20261027)
NSTAT = 20000
for vk, vo in d["vars"].items():
    x = np.array(vo["x"], float)
    for k in NB:
        e = vo["kinds"][k]; I, z, wz = moran(x, W[k])
        chk(f"{vk} {k} I", I, e["I"]); chk(f"{vk} {k} E[I]", -1 / (n - 1), e["EI"]); chk(f"{vk} {k} S0", W[k].sum(), e["S0"])
        chk(f"{vk} {k} num", z @ wz, e["num"], 1e-7); chk(f"{vk} {k} den", z @ z, e["den"], 1e-7)
        chk(f"{vk} {k} soma das contribuições = I", float((len(x) / W[k].sum()) * np.sum(z * wz) / (z @ z)), e["contribSum"]); chk(f"{vk} {k} contribuições somam o I", e["contribSum"], I)
        for M_, pr in e["perm"].items():
            M = int(M_); rnd = mulberry32(seed); v = list(x); sims = []; Rr = 0; sup = I >= -1 / (n - 1)
            for _ in range(M):
                fisher_yates(v, rnd); Is = moran(np.array(v), W[k])[0]; sims.append(Is)
                if (Is >= I) if sup else (Is <= I): Rr += 1
            chk(f"{vk} {k} M={M} R", Rr, pr["R"]); chk(f"{vk} {k} M={M} p", (Rr + 1) / (M + 1), pr["p"]); chk(f"{vk} {k} M={M} p>0", pr["p"] > 0, True)
            chk(f"{vk} {k} M={M} sims", max(abs(a - b) for a, b in zip(sims, pr["sims"])), 0.0, 1e-12)
            if M == 999:
                s = np.sort(sims); chk(f"{vk} {k} q025", np.quantile(s, 0.025), pr["q025"], 1e-12); chk(f"{vk} {k} q975", np.quantile(s, 0.975), pr["q975"], 1e-12)
        print(f"{vk} {k}: I = {I:.4f}, E[I] = {-1/(n-1):.4f}, " + ", ".join(f"M={m}: R={p['R']}, p={p['p']:.4f}" for m, p in e["perm"].items()))
    # prefixo: as primeiras 99 réplicas da semente são as mesmas das 999
    q = vo["kinds"]["queen"]["perm"]
    chk(f"{vk} prefixo 99 de 999", q["99"]["sims"], q["999"]["sims"][:99]); chk(f"{vk} prefixo 999 de 9999", q["999"]["sims"], q["9999"]["sims"][:999])
    # verificação estatística tolerante (sorteios independentes do numpy)
    Wq = W["queen"]; I, z, wz = moran(x, Wq); sup = I >= -1 / (n - 1)
    sims = np.empty(NSTAT)
    for r in range(NSTAT):
        sims[r] = moran(rng_np.permutation(x), Wq)[0]
    Rn = int(np.sum(sims >= I) if sup else np.sum(sims <= I)); pn = (Rn + 1) / (NSTAT + 1)
    for M_, pr in vo["kinds"]["queen"]["perm"].items():
        M = int(M_); p = pr["p"]; se = math.sqrt(max(p * (1 - p), 1e-6) * (1 / M + 1 / NSTAT))
        chk(f"{vk} estat. p (M={M}) dentro de 4 EP", abs(p - pn) <= 4 * se + 1 / (M + 1), True)
    sd = sims.std(ddof=1); chk(f"{vk} estat. média dos I embaralhados ~ E[I]", abs(sims.mean() - (-1 / (n - 1))) <= 4 * sd / math.sqrt(NSTAT), True)
    p999 = vo["kinds"]["queen"]["perm"]["999"]
    chk(f"{vk} estat. q025 (JS 999 vs numpy {NSTAT})", abs(np.quantile(sims, 0.025) - p999["q025"]) <= 0.03, True); chk(f"{vk} estat. q975", abs(np.quantile(sims, 0.975) - p999["q975"]) <= 0.03, True)
    print(f"  verificação estatística {vk}: p numpy = {pn:.4f} ({NSTAT} réplicas), média dos I = {sims.mean():.4f}, dp = {sd:.4f}")

# ---- contribuições: ver acima. Exemplo A-F ----
tx = np.array(d["toy"]["x"], float); tnb = d["toy"]["nb"]; Wt = Wmat(tnb); tI, tz, twz = moran(tx, Wt)
chk("toy I", tI, d["toy"]["I"]); chk("toy I = 0,7035", round(tI, 4), 0.7035); chk("toy E[I] = -0,2", -1 / 5, d["toy"]["EI"]); chk("toy S0", Wt.sum(), d["toy"]["S0"])
for i in range(6):
    chk(f"toy z {i}", tz[i], d["toy"]["z"][i]); chk(f"toy wz {i}", twz[i], d["toy"]["wz"][i]); chk(f"toy produto {i}", tz[i] * twz[i], d["toy"]["prod"][i])
chk("toy soma produtos", tz @ twz, d["toy"]["num"]); chk("toy soma z²", tz @ tz, d["toy"]["den"]); chk("toy média", tx.mean(), 83 + 1 / 6, 1e-9); chk("toy soma z²= 572,833", round(tz @ tz, 3), 572.833)
c = sum(1 for p in itertools.permutations(tx) if moran(np.array(p), Wt)[0] >= tI - 1e-12)
chk("toy exato: arranjos", math.factorial(6), d["toy"]["exact"]["total"]); chk("toy exato: contagem", c, d["toy"]["exact"]["count"]); chk("toy exato = 4", c, 4); chk("toy exato p", c / 720, d["toy"]["exact"]["p"])
print(f"exemplo A-F: I = {tI:.4f}; E[I] = {-1/5:.2f}; exato {c}/720 = {c/720:.4f}")

# ---- tabuleiros 6x6 ----
gnb = []
for r in range(6):
    for cc in range(6):
        l = []
        if r > 0: l.append((r - 1) * 6 + cc)
        if cc > 0: l.append(r * 6 + cc - 1)
        if cc < 5: l.append(r * 6 + cc + 1)
        if r < 5: l.append((r + 1) * 6 + cc)
        gnb.append(sorted(l))
Wg = Wmat(gnb)
for g in d["grid"]:
    chk("tabuleiro " + g["t"], moran(np.array(g["v"], float), Wg)[0], g["I"])
chk("tabuleiro alternado = -1", round(d["grid"][2]["I"], 12), -1.0)

print(f"{tot} comparações, {bad} divergências"); sys.exit(1 if bad else 0)
