"""Conferência independente da AEDE (Python: shapely e numpy, sem reutilizar código JS).
Uso: python3 tests/check_aede.py aede_js.json [pasta-com-AL_Municipios_2025.shp]
Refaz: vizinhança rainha/torre (shapely), 5 vizinhos mais próximos, defasagem, I de Moran, permutação com a mesma semente
(mulberry32 e Fisher-Yates reimplementados), quantis, quadrantes, exemplo A-F. Com a pasta do shapefile original,
também compara a vizinhança da malha simplificada com a da malha completa do IBGE."""
import json, math, sys, os
import numpy as np
from shapely.geometry import shape

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

# ---- vizinhança por geometria (shapely) ----
def vizinhos_geom(geoms):
    q = [[] for _ in geoms]; r = [[] for _ in geoms]
    for i in range(len(geoms)):
        for j in range(i + 1, len(geoms)):
            if geoms[i].intersects(geoms[j]):
                q[i].append(j); q[j].append(i)
                if geoms[i].intersection(geoms[j]).length > 0:
                    r[i].append(j); r[j].append(i)
    return [sorted(x) for x in q], [sorted(x) for x in r]

Q, R = vizinhos_geom(G)
def stats(nb):
    deg = [len(x) for x in nb]
    return sum(deg) / 2, [i for i, k in enumerate(deg) if k == 0], sum(deg) / n, min(deg), max(deg)

for nome, nb in (("queen", Q), ("rook", R)):
    chk(nome + " listas", nb, d["nb"][nome]["nb"])
    p, il, md, mn, mx = stats(nb)
    chk(nome + " pares", p, d["nb"][nome]["pairs"]); chk(nome + " ilhas", il, d["nb"][nome]["islands"])
    chk(nome + " grau médio", md, d["nb"][nome]["meanDeg"]); chk(nome + " mín", mn, d["nb"][nome]["minDeg"]); chk(nome + " máx", mx, d["nb"][nome]["maxDeg"])
    print(f"{nome}: {int(p)} pares, {len(il)} ilhas, grau médio {md:.3f} (de {mn} a {mx})")

# ---- centroides (projeção equiretangular) e k vizinhos mais próximos ----
lat_med = float(np.mean([g.centroid.y for g in G]))
# cada município escala x por cos(lat média de seus vértices exteriores) no JS; aqui usa shapely com a mesma ideia por município
def centroide(g):
    ys = []
    for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]):
        ys += [c[1] for c in p.exterior.coords]
    kx = math.cos(math.radians(sum(ys) / len(ys)))
    from shapely import affinity
    c = affinity.scale(g, xfact=kx, yfact=1, origin=(0, 0)).centroid
    return c.x / kx, c.y
C = [centroide(g) for g in G]
for i, c in enumerate(C):
    chk(f"centróide {i}", c[0], d["cent"][i][0], 1e-7); chk(f"centróide {i}y", c[1], d["cent"][i][1], 1e-7)
kx = math.cos(math.radians(sum(c[1] for c in C) / n))
K = []
for i in range(n):
    dist = sorted((math.hypot((C[i][0] - C[j][0]) * kx, C[i][1] - C[j][1]), j) for j in range(n) if j != i)
    K.append(sorted(j for _, j in dist[:5]))
chk("knn5 listas", K, d["nb"]["knn5"]["nb"])

# ---- W padronizada por linha, defasagem e I ----
x = np.array(d["cob"], float)

def Wmat(nb):
    m = len(nb); W = np.zeros((m, m))
    for i, l in enumerate(nb):
        for j in l:
            W[i, j] = 1.0 / len(l)
    return W

def moran(v, W):
    z = v - v.mean(); wz = W @ z
    return (len(v) / W.sum()) * (z @ wz) / (z @ z), wz

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
    v = list(v)
    for i in range(len(v) - 1, 0, -1):
        j = int(math.floor(rnd() * (i + 1)))
        v[i], v[j] = v[j], v[i]
    return v

for nome, nb in (("queen", Q), ("rook", R), ("knn5", K)):
    W = Wmat(nb); I, wz = moran(x, W)
    chk(nome + " I", I, d["I"][nome]["I"]); chk(nome + " E[I]", -1 / (n - 1), d["I"][nome]["EI"]); chk(nome + " S0", W.sum(), d["I"][nome]["S0"])
    for i in range(n):
        chk(f"{nome} lag {i}", (W @ x)[i], d["I"][nome]["lagX"][i]); chk(f"{nome} wz {i}", wz[i], d["I"][nome]["wz"][i])
    rnd = mulberry32(d["seed"]); v = list(x); sims = []; Rr = 0; sup = I >= -1 / (n - 1)
    for _ in range(d["M"]):
        v = fisher_yates(v, rnd); Is, _w = moran(np.array(v), W); sims.append(Is)
        if (Is >= I) if sup else (Is <= I): Rr += 1
    chk(nome + " R", Rr, d["perm"][nome]["R"]); chk(nome + " p", (Rr + 1) / (d["M"] + 1), d["perm"][nome]["p"])
    chk(nome + " sims", max(abs(a - b) for a, b in zip(sims, d["perm"][nome]["sims"])), 0.0, 1e-12)
    print(f"{nome}: I = {I:.4f}, E[I] = {-1/(n-1):.4f}, pseudo-p = {(Rr+1)/(d['M']+1):.4f} (R = {Rr}, M = {d['M']})")

# ---- z padronizado, quadrantes, inclinação ----
W = Wmat(Q); z = (x - x.mean()) / x.std(ddof=1); wzs = W @ z
for i in range(n):
    chk(f"zs {i}", z[i], d["zs"][i]); chk(f"wzs {i}", wzs[i], d["wzs"][i])
    q = (0 if wzs[i] >= 0 else 3) if z[i] >= 0 else (1 if wzs[i] >= 0 else 2)
    chk(f"quadrante {i}", q, d["quad"][i])
chk("inclinação = I", np.polyfit(z, wzs, 1)[0], d["slope"]); chk("inclinação = I (global)", np.polyfit(z, wzs, 1)[0], d["I"]["queen"]["I"])

# ---- quantis ----
for k in (4, 5):
    b = np.quantile(x, [j / k for j in range(1, k)])
    for j, v in enumerate(b): chk(f"corte {k}.{j}", v, d["quant"][f"b{k}"][j])
    chk(f"classes {k}", [int(sum(v > t for t in b)) for v in x], d["quant"][f"c{k}"])

# ---- exemplo mínimo A-F ----
tx = np.array([95, 92, 90, 80, 72, 70], float); tnb = [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]]
tI, twz = moran(tx, Wmat(tnb))
chk("toy I", tI, d["toy"]["I"]); chk("toy I = 0,7035", round(tI, 4), 0.7035); chk("toy E[I]", -1 / 5, d["toy"]["EI"])
for i in range(6): chk(f"toy wz {i}", twz[i], d["toy"]["wz"][i])
z0 = tx - tx.mean(); chk("toy soma z²", z0 @ z0, d["toy"]["den"]); print(f"exemplo A-F: I = {tI:.4f}")
# permutação exata (720 arranjos): quantos têm I >= observado
import itertools
Wt = Wmat(tnb); c = sum(1 for p in itertools.permutations(tx) if moran(np.array(p), Wt)[0] >= tI - 1e-12)
chk("toy permutação exata", c, 4); print(f"permutação exata: {c}/720 = {c/720:.4f}")

# ---- embaralhamento do passo 1 ----
rnd = mulberry32(d["shuf"]["seed"]); sh = fisher_yates(list(x), rnd)
chk("shuf valores", sh, d["shuf"]["v"]); chk("shuf I", moran(np.array(sh), Wmat(Q))[0], d["shuf"]["I"])

# ---- opcional: malha completa do IBGE ----
if len(sys.argv) > 2:
    import geopandas as gpd
    g = gpd.read_file(sys.argv[2]).sort_values("CD_MUN").reset_index(drop=True)
    Qo, Ro = vizinhos_geom(list(g.geometry))
    chk("malha completa: rainha igual à simplificada", Qo, Q); chk("malha completa: torre igual à simplificada", Ro, R)
    print("malha completa do IBGE: vizinhança idêntica à da malha simplificada" if Qo == Q and Ro == R else "malha completa difere")

print(f"{tot} comparações, {bad} divergências"); sys.exit(1 if bad else 0)
