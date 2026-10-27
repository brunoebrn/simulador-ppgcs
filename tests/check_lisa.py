"""Conferência independente do Moran local (LISA). Python: shapely e numpy, sem reutilizar código JS.
Uso: python3 tests/check_lisa.py lisa_js.json     (gerado por: node tests/dump_lisa.js > lisa_js.json)
Refaz: vizinhança rainha (shapely); I local, desvios, defasagem, quadrantes; média dos I_i = I global; fator (n-1)/n entre escalas;
permutação condicional com a MESMA semente (mulberry32 e sorteio parcial de Fisher-Yates reimplementados; semente do município = 2026*1000 + i)
para M = 999, 1999 e 9999 (as duas primeiras como prefixo da terceira); R, pseudo-p (R+1)/(M+1), lado usado (min das duas caudas);
Bonferroni (0,05/102) e FDR (passo ascendente: maior i com p(i) <= i*0,05/102), incluindo o M mínimo de Bonferroni (M+1 >= 2040);
exemplo A-F: I_i (1,095; 0,478; 0,203; -0,050; 0,955; 1,540), média 0,7035, p exatos por enumeração (itertools): 0,20; 0,10; 0,30; 0,50; 0,10; 0,20,
e o p global exato 4/720; bandeira de denominador < 1000; e uma verificação estatística tolerante com sorteios independentes (numpy):
  - p estimado com 10000 sorteios do numpy (cobertura e índice sem padrão) deve ficar a até 4 erros-padrão (+ 1/(M+1)) do pseudo-p do JS, município a município."""
import json, math, sys, os, itertools
import numpy as np
from shapely.geometry import shape

d = json.load(open(sys.argv[1]))
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
fc = json.load(open(os.path.join(raiz, "assets/geo/al_municipios.geojson"), encoding="utf-8"))
G = [shape(f["geometry"]) for f in fc["features"]]
n = len(G); bad = 0; tot = 0
ALFA = 0.05; TOL = 1e-12


def chk(nome, a, b, tol=1e-9):
    global bad, tot
    tot += 1
    ok = (a == b) if isinstance(a, (list, str, bool)) or isinstance(b, (list, str, bool)) else abs(float(a) - float(b)) <= tol
    if not ok:
        bad += 1
        print("DIVERGE", nome, a, b)


chk("códigos", [f["properties"]["c"] for f in fc["features"]], d["codigos"])

# ---- vizinhança rainha por geometria ----
Q = [[] for _ in G]
for i in range(n):
    for j in range(i + 1, n):
        if G[i].intersects(G[j]):
            Q[i].append(j); Q[j].append(i)
Q = [sorted(x) for x in Q]
chk("vizinhança rainha", Q, d["nb"])
chk("sem ilhas", min(len(l) for l in Q) > 0, True)


def Wmat(nb):
    m = len(nb); W = np.zeros((m, m))
    for i, l in enumerate(nb):
        for j in l:
            W[i, j] = 1.0 / len(l)
    return W


def quad(z, wz):
    return 0 if (z >= 0 and wz >= 0) else 3 if z >= 0 else 1 if wz >= 0 else 2


def mulberry32(seed):
    a = [seed & 0xFFFFFFFF]
    def f():
        a[0] = (a[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = a[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return f


def cond_sims(z, nbi, i, seed, M, m2):
    """M valores de I_i: z_i fixo; sorteio parcial de Fisher-Yates dos outros n-1 (lista não reinicia entre rodadas)."""
    rnd = mulberry32(seed); o = [t for t in range(len(z)) if t != i]; k = len(nbi); w = 1.0 / k; out = []
    zi = z[i]; zl = list(z); n1 = len(z) - 1
    for _ in range(M):
        lag = 0.0
        for t in range(k):
            j = t + int(math.floor(rnd() * (n1 - t)))
            o[t], o[j] = o[j], o[t]
            lag += w * zl[o[t]]
        out.append(zi * lag / m2)
    return out


def lado(sims, obs):
    up = sum(1 for s in sims if s >= obs - TOL); lo = sum(1 for s in sims if s <= obs + TOL)
    return up, lo


def fdr(p):
    m = len(p); ordem = sorted(range(m), key=lambda i: (p[i], i)); k = 0
    for j in range(m):
        if p[ordem[j]] <= (j + 1) * ALFA / m + 1e-15: k = j + 1
    sig = [False] * m
    for j in range(k): sig[ordem[j]] = True
    return k, sig


W = Wmat(Q)
NSTAT = 10000
rng_np = np.random.default_rng(20261027)
for vk, vo in d["vars"].items():
    x = np.array(vo["x"], float); z = x - x.mean(); wz = W @ z; m2 = float(z @ z) / n
    I = z * wz / m2; gI = float((n / W.sum()) * (z @ wz) / (z @ z))
    q = [quad(z[i], wz[i]) for i in range(n)]
    for i in range(n):
        chk(f"{vk} z {i}", z[i], vo["z"][i]); chk(f"{vk} wz {i}", wz[i], vo["wz"][i]); chk(f"{vk} I_i {i}", I[i], vo["I"][i])
    chk(f"{vk} m2", m2, vo["m2"], 1e-9); chk(f"{vk} quadrantes", q, vo["quad"])
    chk(f"{vk} média dos I_i = I global", I.mean(), gI); chk(f"{vk} I global (dump)", gI, vo["globalI"])
    # escala com variância de divisor n-1: todos os I_i multiplicados por (n-1)/n; quadrantes iguais
    I1 = z * wz / (float(z @ z) / (n - 1)); chk(f"{vk} razão (n-1)/n", float(np.max(np.abs(I1 / np.where(I == 0, 1, I) - (n - 1) / n)[I != 0])), 0.0, 1e-9)
    chk(f"{vk} quadrantes iguais nas duas escalas", [quad(z[i], wz[i]) for i in range(n)], q)
    sims = [cond_sims(list(z), Q[i], i, 2026 * 1000 + i, 9999, m2) for i in range(n)]
    for M in (999, 1999, 9999):
        R = []; P = []; UP = []; LO = []; UPPER = []
        for i in range(n):
            up, lo = lado(sims[i][:M], I[i]); r = min(up, lo); R.append(r); P.append((r + 1) / (M + 1)); UP.append(up); LO.append(lo); UPPER.append(up <= lo)
        pj = vo["perm"][str(M)]
        chk(f"{vk} M={M} Rup", UP, pj["Rup"]); chk(f"{vk} M={M} Rlow", LO, pj["Rlow"]); chk(f"{vk} M={M} R", R, pj["R"]); chk(f"{vk} M={M} lado", UPPER, pj["upper"])
        chk(f"{vk} M={M} p", max(abs(a - b) for a, b in zip(P, pj["p"])), 0.0, 1e-12); chk(f"{vk} M={M} p > 0", min(P) > 0, True)
        k, sg = fdr(P); lim = ALFA / n
        chk(f"{vk} M={M} FDR k", k, pj["fdrK"]); chk(f"{vk} M={M} FDR conjunto", sg, pj["fdrSig"])
        bsig = [p <= lim + 1e-15 for p in P]
        chk(f"{vk} M={M} Bonferroni limite", lim, pj["bonfLim"]); chk(f"{vk} M={M} Bonferroni conjunto", bsig, pj["bonfSig"])
        if 1 / (M + 1) > lim + 1e-15: chk(f"{vk} M={M} Bonferroni impossível (nenhum)", sum(bsig), 0)
        ncs = sum(1 for p in P if p <= ALFA)
        print(f"{vk} M={M}: p<=0,05: {ncs}; FDR: {k}; Bonferroni: {sum(bsig)}; menor p = {min(P):.5f}")
    # as 999 primeiras réplicas de uma semente conferem com as réplicas dumpadas do JS (municípios amostrados)
    for i_, sj in vo["sims"].items():
        i_ = int(i_); chk(f"{vk} réplicas do município {i_}", max(abs(a - b) for a, b in zip(sims[i_][:999], sj)), 0.0, 1e-9)
    # verificação estatística tolerante (sorteios independentes do numpy), cobertura e índice sem padrão
    if vk in ("cob", "ruido"):
        pj = vo["perm"]["9999"]["p"]; M = 9999; falhas = 0
        for i in range(n):
            k = len(Q[i]); outros = np.delete(z, i)
            idx = rng_np.random((NSTAT, n - 1)).argsort(axis=1)[:, :k]
            Is = z[i] * outros[idx].mean(axis=1) / m2
            up = int(np.sum(Is >= I[i] - TOL)); lo = int(np.sum(Is <= I[i] + TOL)); pn = (min(up, lo) + 1) / (NSTAT + 1)
            p = pj[i]; se = math.sqrt(max(p * (1 - p), 1e-6) * (1 / M + 1 / NSTAT))
            if abs(p - pn) > 4 * se + 1 / (M + 1): falhas += 1
        chk(f"{vk} estat.: municípios fora de 4 erros-padrão (de 102)", falhas <= 1, True)
        print(f"  verificação estatística {vk}: {falhas} município(s) fora da tolerância em 102 ({NSTAT} sorteios do numpy)")

# bandeira de denominador e M mínimo de Bonferroni
chk("denominador < 1000: 51 municípios", sum(1 for v in d["nasc"] if v < 1000), 51)
Mmin = next(M for M in range(1, 100000) if 1 / (M + 1) <= ALFA / n + 1e-15)
chk("M mínimo de Bonferroni = 2039 (M + 1 = 2040)", Mmin, 2039)

# ---- exemplo A-F ----
tx = np.array(d["toy"]["x"], float); tnb = d["toy"]["nb"]; Wt = Wmat(tnb)
tz = tx - tx.mean(); twz = Wt @ tz; tm2 = float(tz @ tz) / 6; tI = tz * twz / tm2
chk("toy média 83,1667", tx.mean(), 83 + 1 / 6); chk("toy soma z² = 572,833", round(float(tz @ tz), 3), 572.833); chk("toy m2 = 95,4722", round(tm2, 4), 95.4722)
for i, (a, b) in enumerate(zip(tI, [1.095, 0.478, 0.203, -0.050, 0.955, 1.540])):
    chk(f"toy I_i {'ABCDEF'[i]} = {b}", round(float(a), 3), b); chk(f"toy I_i {i} dump", a, d["toy"]["I"][i])
chk("toy média dos I_i = 0,7035", round(float(tI.mean()), 4), 0.7035)
chk("toy quadrantes", [quad(tz[i], twz[i]) for i in range(6)], d["toy"]["quad"]); chk("toy D baixo-alto", quad(tz[3], twz[3]), 1)
pe = []
for i in range(6):
    k = len(tnb[i]); outros = [j for j in range(6) if j != i]; up = lo = tot_ = 0
    for s in itertools.combinations(outros, k):
        Is = tz[i] * np.mean([tz[j] for j in s]) / tm2; tot_ += 1
        up += Is >= tI[i] - TOL; lo += Is <= tI[i] + TOL
    pe.append(min(up, lo) / tot_)
    chk(f"toy exato total {i}", tot_, d["toy"]["exact"][i]["total"]); chk(f"toy exato p {i}", min(up, lo) / tot_, d["toy"]["exact"][i]["p"])
for a, b in zip(pe, [0.20, 0.10, 0.30, 0.50, 0.10, 0.20]): chk("toy p exato = " + str(b), round(a, 4), b)
chk("toy nenhum local significativo", sum(1 for p in pe if p <= ALFA), 0)
c = sum(1 for p in itertools.permutations(tx) if (6 / Wt.sum()) * float((np.array(p) - tx.mean()) @ (Wt @ (np.array(p) - tx.mean()))) / float(tz @ tz) >= (6 / Wt.sum()) * float(tz @ twz) / float(tz @ tz) - 1e-12)
chk("toy global exato 4/720", c, 4); chk("toy global exato (dump)", c, d["toy"]["globalExact"]["count"])
print(f"exemplo A-F: I_i = {[round(float(a), 3) for a in tI]}; média = {tI.mean():.4f}; p exatos = {pe}; global exato {c}/720 = {c/720:.4f}")

print(f"{tot} comparações, {bad} divergências"); sys.exit(1 if bad else 0)
