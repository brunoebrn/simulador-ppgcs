"""Conferência independente do método 7 (VIF, OLS, I de Moran dos resíduos e GWR). Python: shapely, numpy e scipy, sem reutilizar código JS.
Uso: python3 tests/check_gwr.py gwr_js.json     (gerado por: node tests/dump_gwr.js > gwr_js.json)
Refaz: centroides (shapely) e plano das distâncias (x * cos(lat média dos centroides)); ordem dos municípios por distância (empate: menor índice);
explicativas padronizadas (média 0, dp amostral); VIF por regressões auxiliares com numpy (lstsq) e pela fórmula 1/(1-R²); o exemplo mínimo de seis municípios;
OLS por lstsq (coeficientes, valores ajustados, resíduos, RSS, R², erros-padrão e t); AICc pela fórmula
AICc = 2 n ln(sigma) + n ln(2 pi) + n (n + trS)/(n - 2 - trS), sigma = sqrt(RSS/n); I de Moran dos resíduos (vizinhança rainha por shapely, pesos por linha)
com permutação de MESMA semente (mulberry32 e Fisher-Yates reimplementados) para M = 999 e 9999; cauda e quantis da normal (scipy);
GWR completo com a matriz de projeção S montada por inteiro (kernel bisquare adaptativo, banda = distância ao k-ésimo mais próximo, o próprio município é o 1º):
RSS, tr S e AICc de cada k de 20 a 102, escolha da banda, coeficientes locais, erros-padrão pela forma C C' (independente da forma A^-1 B A^-1 do JS), pseudo-t,
R² local, tamanho efetivo, contagem de municípios acima dos cortes (sem correção e Bonferroni ingênuo) e, como autoverificação da fórmula, o GWR com pesos todos iguais a 1 (= OLS)."""
import json, math, sys, os
import numpy as np
from scipy import stats
from shapely.geometry import shape

d = json.load(open(sys.argv[1]))
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
fc = json.load(open(os.path.join(raiz, "assets/geo/al_municipios.geojson"), encoding="utf-8"))
G = [shape(f["geometry"]) for f in fc["features"]]
n = len(G); bad = 0; tot = 0; SEED = d["seed"]; KMIN = d["kmin"]


def chk(nome, a, b, tol=1e-9):
    global bad, tot
    tot += 1
    if isinstance(a, (list, str, bool)) or isinstance(b, (list, str, bool)):
        ok = (a == b)
    else:
        ok = abs(float(a) - float(b)) <= tol * max(1.0, abs(float(b)))
    if not ok:
        bad += 1
        print("DIVERGE", nome, str(a)[:200], str(b)[:200])


def chkv(nome, a, b, tol=1e-9):
    """compara vetores/matrizes pelo maior desvio relativo à escala"""
    global bad, tot
    tot += 1
    a = np.asarray(a, float); b = np.asarray(b, float)
    esc = max(1.0, float(np.max(np.abs(b))))
    dev = float(np.max(np.abs(a - b))) / esc
    if not (dev <= tol):
        bad += 1
        print("DIVERGE", nome, "desvio relativo máximo", dev)


chk("códigos", [f["properties"]["c"] for f in fc["features"]], d["codigos"])
chk("n", n, d["n"])

# ---- plano das distâncias e ordem ----
cen = np.array([[g.centroid.x, g.centroid.y] for g in G])
kx = math.cos(cen[:, 1].mean() * math.pi / 180)
X0 = cen[:, 0] * kx; Y0 = cen[:, 1]
chkv("x dos centroides", X0, d["x"]); chkv("y dos centroides", Y0, d["y"])
DIST = np.sqrt((X0[:, None] - X0[None, :]) ** 2 + (Y0[:, None] - Y0[None, :]) ** 2)
O = np.zeros((n, n), dtype=np.int64)
for i in range(n):
    O[i] = np.lexsort((np.arange(n), DIST[i]))
chk("ordem por distância", O.tolist(), d["order"])
chk("o centro é o primeiro de cada lista", all(O[i, 0] == i for i in range(n)), True)

# ---- vizinhança rainha e função do I de Moran ----
Q = [[] for _ in G]
for i in range(n):
    for j in range(i + 1, n):
        if G[i].intersects(G[j]):
            Q[i].append(j); Q[j].append(i)
Wm = np.zeros((n, n))
for i, l in enumerate(Q):
    for j in l:
        Wm[i, j] = 1.0 / len(l)


def moran(v):
    z = v - v.mean(); wz = Wm @ z
    return (len(v) / Wm.sum()) * (z @ wz) / (z @ z)


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


def aicc(rss, nn, trs):
    return 2 * nn * math.log(math.sqrt(rss / nn)) + nn * math.log(2 * math.pi) + nn * (nn + trs) / (nn - 2 - trs)


# ---- normal ----
for p_, s_ in zip(d["normal"]["pts"], d["normal"]["sf"]):
    chk(f"normSf({p_})", stats.norm.sf(p_), s_, 1e-9)
for a_, c_ in zip(d["normal"]["alphas"], d["normal"]["crit"]):
    chk(f"normCrit({a_})", stats.norm.isf(a_ / 2), c_, 1e-9)

# ---- exemplo mínimo do VIF (seis municípios, duas variáveis) ----
t1 = np.array(d["toy"]["x1"], float); t2 = np.array(d["toy"]["x2"], float)
r = np.corrcoef(t1, t2)[0, 1]
chk("toy r", r, d["toy"]["corr"]); chk("toy r = 29/35", r, 29 / 35)
chk("toy VIF = 1225/384", 1 / (1 - r * r), 1225 / 384); chk("toy VIF JS x1", d["toy"]["vif"][0], 1225 / 384); chk("toy VIF JS x2", d["toy"]["vif"][1], 1225 / 384)
chk("toy VIF = 3,19", round(1 / (1 - r * r), 2), 3.19)
chk("toy soma dos produtos = 14,5", float(((t1 - t1.mean()) * (t2 - t2.mean())).sum()), 14.5)

rng_np = np.random.default_rng(20261027)
for m_, mo in d["mods"].items():
    m = int(m_); keys = mo["keys"]; Y = np.array(d["data"]["cobertura"], float)
    cols = []
    for k in keys:
        v = np.array(d["data"][k], float); cols.append((v - v.mean()) / v.std(ddof=1))
    X = np.column_stack([np.ones(n)] + cols); q = X.shape[1]; tag = f"[{m} explicativas]"
    # VIF por regressão auxiliar (lstsq) e por inversa da matriz de correlação (identidade independente)
    Rm = np.corrcoef(np.column_stack(cols).T); vif_inv = np.diag(np.linalg.inv(Rm))
    for j in range(len(keys)):
        others = np.column_stack([np.ones(n)] + [cols[t] for t in range(len(keys)) if t != j])
        b = np.linalg.lstsq(others, cols[j], rcond=None)[0]; res = cols[j] - others @ b
        r2 = 1 - (res @ res) / (((cols[j] - cols[j].mean()) ** 2).sum()); vif = 1 / (1 - r2)
        chk(f"{tag} R² auxiliar {keys[j]}", r2, mo["vif"][j]["r2"]); chk(f"{tag} VIF {keys[j]}", vif, mo["vif"][j]["vif"]); chk(f"{tag} tolerância {keys[j]}", 1 - r2, mo["vif"][j]["tol"])
        chk(f"{tag} VIF pela inversa da matriz de correlação {keys[j]}", vif_inv[j], mo["vif"][j]["vif"], 1e-8)
    # OLS
    beta = np.linalg.lstsq(X, Y, rcond=None)[0]; fit = X @ beta; res = Y - fit; rss = float(res @ res); tss = float(((Y - Y.mean()) ** 2).sum())
    s2 = rss / (n - q); se = np.sqrt(s2 * np.diag(np.linalg.inv(X.T @ X)))
    o = mo["ols"]
    chkv(f"{tag} OLS beta", beta, o["beta"]); chkv(f"{tag} OLS ajustados", fit, o["fit"]); chkv(f"{tag} OLS resíduos", res, o["resid"], 1e-8)
    chk(f"{tag} OLS RSS", rss, o["rss"]); chk(f"{tag} OLS TSS", tss, o["tss"]); chk(f"{tag} OLS R²", 1 - rss / tss, o["r2"]); chkv(f"{tag} OLS erro-padrão", se, o["se"]); chkv(f"{tag} OLS t", beta / se, o["t"], 1e-8)
    chk(f"{tag} OLS AICc", aicc(rss, n, q), o["aicc"]); chk(f"{tag} OLS conferência X'e do JS é ~0", o["chk"] < 1e-8, True)
    chk(f"{tag} X'e ~ 0 em Python", float(np.max(np.abs(X.T @ res))) < 1e-8, True)
    chk(f"{tag} intercepto = média da cobertura", beta[0], Y.mean())
    # I de Moran dos resíduos: permutação com a mesma semente
    I = moran(res); EI = -1 / (n - 1)
    for M_, pr in mo["perm"].items():
        M = int(M_); rnd = mulberry32(SEED); v = list(res); sims = []; R = 0; sup = I >= EI
        for _ in range(M):
            fisher_yates(v, rnd); Is = moran(np.array(v)); sims.append(Is)
            if (Is >= I) if sup else (Is <= I): R += 1
        chk(f"{tag} Moran resíduos I", I, pr["I"]); chk(f"{tag} Moran resíduos E[I]", EI, pr["EI"])
        chk(f"{tag} Moran resíduos M={M} R", R, pr["R"]); chk(f"{tag} Moran resíduos M={M} p", (R + 1) / (M + 1), pr["p"]); chk(f"{tag} p>0", pr["p"] > 0, True)
        chkv(f"{tag} Moran resíduos M={M} sims", sims, pr["sims"], 1e-12)
        if M == 999:
            sims_np = np.array([moran(rng_np.permutation(res)) for _ in range(20000)])
            Rn = int((sims_np >= I).sum() if sup else (sims_np <= I).sum()); pn = (Rn + 1) / (20001); se_p = math.sqrt(max(pn * (1 - pn), 1e-4) / 20000)
            chk(f"{tag} p do numpy (20000) ~ p do JS", abs(pn - pr["p"]) <= 4 * math.sqrt(max(pn * (1 - pn), 1e-4) / 999) + 1 / 1000, True)
            print(f"  {tag} I dos resíduos = {I:.4f}; p JS = {pr['p']:.4f}; p numpy independente = {pn:.4f}")

    # GWR completo
    def gwr(k, ones=False):
        yhat = np.zeros(n); S = np.zeros((n, n)); Cs = []; Wl = []
        for i in range(n):
            ds = DIST[i, O[i]]; b = ds[k - 1]
            w = np.zeros(n)
            if ones:
                w[:] = 1.0
            else:
                for pos in range(k):
                    j = O[i, pos]; dd = ds[pos]
                    w[j] = (1 - (dd / b) ** 2) ** 2 if dd < b else 0.0
            A = X.T @ (X * w[:, None]); Ai = np.linalg.inv(A); Cm = Ai @ (X.T * w[None, :])
            S[i] = X[i] @ Cm; Cs.append(Cm); Wl.append(w)
        beta_l = np.array([C_ @ Y for C_ in Cs]); yhat = S @ Y
        return beta_l, yhat, S, Cs, Wl

    rows = {r_["k"]: r_ for r_ in mo["curve"]}
    best = None
    for k in range(KMIN, n + 1):
        bl, yh, S_, Cs, Wl = gwr(k); rs = float(((Y - yh) ** 2).sum()); ts = float(np.trace(S_)); ac = aicc(rs, n, ts) if n - 2 - ts > 0 else math.inf
        rj = rows[k]
        chk(f"{tag} k={k} RSS", rs, rj["rss"]); chk(f"{tag} k={k} trS", ts, rj["trS"]); chk(f"{tag} k={k} AICc", ac, rj["aicc"] if rj["aicc"] is not None else math.inf, 1e-9)
        if best is None or ac < best[1]: best = (k, ac)
    chk(f"{tag} banda escolhida (menor AICc)", best[0], mo["kb"]); chk(f"{tag} AICc da banda escolhida", best[1], mo["gw"]["aicc"])
    kb = mo["kb"]; bl, yh, S_, Cs, Wl = gwr(kb); g = mo["gw"]
    rs = float(((Y - yh) ** 2).sum()); ts = float(np.trace(S_)); trss = float((S_ ** 2).sum()); dl = n - 2 * ts + trss; sg2 = rs / dl
    chkv(f"{tag} GWR coeficientes locais", bl, g["beta"]); chkv(f"{tag} GWR ajustados", yh, g["yhat"]); chkv(f"{tag} GWR resíduos", Y - yh, g["resid"], 1e-8)
    chk(f"{tag} GWR RSS", rs, g["rss"]); chk(f"{tag} GWR tr S", ts, g["trS"]); chkv(f"{tag} GWR diagonal de S", np.diag(S_), g["sdiag"]); chk(f"{tag} GWR tr(S'S)", trss, g["trSS"]); chk(f"{tag} GWR delta1", dl, g["delta1"]); chk(f"{tag} GWR sigma² residual", sg2, g["s2"])
    se_l = np.array([np.sqrt(sg2 * np.diag(C_ @ C_.T)) for C_ in Cs]); t_l = bl / se_l
    chkv(f"{tag} GWR erros-padrão locais (forma C C')", se_l, g["se"], 1e-7); chkv(f"{tag} GWR pseudo-t", t_l, g["t"], 1e-8)
    r2l = []; neff = []
    for i in range(n):
        w = Wl[i]; yb = (w * Y).sum() / w.sum(); num = (w * (Y - X @ bl[i]) ** 2).sum(); den = (w * (Y - yb) ** 2).sum()
        r2l.append(1 - num / den); neff.append(w.sum() ** 2 / (w ** 2).sum())
    chkv(f"{tag} GWR R² local", r2l, g["r2loc"], 1e-8); chkv(f"{tag} GWR tamanho efetivo", neff, g["neff"], 1e-8)
    chk(f"{tag} GWR R² global", 1 - rs / tss, g["r2"])
    # contagens acima dos cortes
    crit0 = stats.norm.isf(0.05 / 2); critB = stats.norm.isf(0.05 / (n * q) / 2)
    chk(f"{tag} corte sem correção", crit0, mo["crit0"]); chk(f"{tag} corte Bonferroni ingênuo", critB, mo["critB"]); chk(f"{tag} nº de testes", n * q, mo["nTests"])
    for a in range(q):
        chk(f"{tag} coef {a}: acima do corte sem correção", int((np.abs(t_l[:, a]) > crit0).sum()), mo["counts"][a]["naive"])
        chk(f"{tag} coef {a}: acima do corte de Bonferroni", int((np.abs(t_l[:, a]) > critB).sum()), mo["counts"][a]["bonf"])
    # outros valores de k (detalhe)
    for k_, e in mo["extra"].items():
        k = int(k_); bl2, yh2, S2, Cs2, Wl2 = gwr(k); rs2 = float(((Y - yh2) ** 2).sum()); ts2 = float(np.trace(S2)); dl2 = n - 2 * ts2 + float((S2 ** 2).sum()); s22 = rs2 / dl2
        chkv(f"{tag} k={k} coeficientes", bl2, e["beta"]); chk(f"{tag} k={k} AICc", aicc(rs2, n, ts2), e["aicc"]); chk(f"{tag} k={k} delta1", dl2, e["delta1"])
        chkv(f"{tag} k={k} pseudo-t", bl2 / np.array([np.sqrt(s22 * np.diag(C_ @ C_.T)) for C_ in Cs2]), e["t"], 1e-8)
    # autoverificação da fórmula: pesos todos iguais a 1 reproduzem o OLS (beta, RSS, tr S = q, AICc)
    blo, yho, So, _, _ = gwr(n, ones=True)
    chk(f"{tag} autoverificação: GWR com pesos 1, RSS = RSS do OLS", float(((Y - yho) ** 2).sum()), rss); chk(f"{tag} autoverificação: tr S = {q}", float(np.trace(So)), q)
    chk(f"{tag} autoverificação: AICc com pesos 1 = AICc do OLS", aicc(float(((Y - yho) ** 2).sum()), n, float(np.trace(So))), o["aicc"])
    chkv(f"{tag} autoverificação: coeficientes com pesos 1 = OLS", blo, np.tile(beta, (n, 1)))
    print(f"  {tag} k ótimo = {kb}; AICc GWR = {g['aicc']:.2f} contra OLS = {o['aicc']:.2f}; tr S = {ts:.2f}; R² GWR = {1-rs/tss:.3f}; contagens (sem correção / Bonferroni): "
          + ", ".join(f"{mo['counts'][a]['naive']}/{mo['counts'][a]['bonf']}" for a in range(q)))

print(f"{tot} comparações, {bad} divergências"); sys.exit(1 if bad else 0)
