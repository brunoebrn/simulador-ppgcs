"""Conferência independente da varredura de Kulldorff (Poisson, alto risco, puramente espacial). Python: shapely e numpy, sem reutilizar código JS.
Uso: python3 tests/check_satscan.py satscan_js.json     (gerado por: node tests/dump_satscan.js > satscan_js.json)
Refaz: centroides (shapely) e plano das distâncias (x * cos(lat média dos centroides)); ordem dos municípios por distância a cada centro (empate: menor índice);
casos fictícios = round(nasc * (1 - min(cob, 100)/100)); janelas válidas (população acumulada <= fração * P) para 50%, 25% e 10%;
LLR de Poisson para alto risco em duas formas algébricas (c ln(c/E) + (C-c) ln((C-c)/(C-E)) e c ln(p_dentro/p0) + (C-c) ln(p_fora/p0)); melhor janela por centro e global;
aglomerados secundários sem município em comum; risco relativo; Monte Carlo com a MESMA semente (mulberry32 vetorizado por contador e redistribuição multinomial por
sorteio de nascido vivo reimplementados) para M = 999 e 9999 (999 é prefixo de 9999), R e p = (R+1)/(M+1);
e uma verificação estatística tolerante com o gerador multinomial do numpy (média e KS das LLR máximas, tolerância documentada abaixo);
exemplo mínimo A-G por enumeração própria (sorted/itertools)."""
import json, math, sys, os
import numpy as np
from shapely.geometry import shape

d = json.load(open(sys.argv[1]))
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
fc = json.load(open(os.path.join(raiz, "assets/geo/al_municipios.geojson"), encoding="utf-8"))
G = [shape(f["geometry"]) for f in fc["features"]]
n = len(G); bad = 0; tot = 0; SEED = d["seed"]; MASK = 0xFFFFFFFF


def chk(nome, a, b, tol=1e-9):
    global bad, tot
    tot += 1
    if isinstance(a, (list, str, bool)) or isinstance(b, (list, str, bool)):
        ok = (a == b)
    else:
        ok = abs(float(a) - float(b)) <= tol
    if not ok:
        bad += 1
        print("DIVERGE", nome, str(a)[:200], str(b)[:200])


chk("códigos", [f["properties"]["c"] for f in fc["features"]], d["codigos"])

# ---- plano das distâncias e ordem ----
cen = np.array([[g.centroid.x, g.centroid.y] for g in G])
kx = math.cos(cen[:, 1].mean() * math.pi / 180)
X = cen[:, 0] * kx; Y = cen[:, 1]
chk("kx", kx, d["kx"], 1e-12)
chk("x dos centroides", float(np.max(np.abs(X - np.array(d["x"])))), 0.0, 1e-9)
chk("y dos centroides", float(np.max(np.abs(Y - np.array(d["y"])))), 0.0, 1e-9)


def ordem(xs, ys):
    m = len(xs); O = np.zeros((m, m), dtype=np.int64); gap = 1e9
    for i in range(m):
        dist = np.sqrt((xs[i] - xs) ** 2 + (ys[i] - ys) ** 2)
        o = np.lexsort((np.arange(m), dist)); O[i] = o
        sd = np.sort(dist); gap = min(gap, float(np.min(np.diff(sd))))
    return O, gap


O, gap = ordem(X, Y)
chk("ordem por distância (matriz 102 x 102)", O.tolist(), d["order"])
chk("o centro é o primeiro de cada lista", all(O[i, 0] == i for i in range(n)), True)
print(f"menor diferença entre distâncias consecutivas (ordem robusta se >> 1e-12): {gap:.3e}")
chk("sem empates de distância", gap > 1e-9, True)

# ---- dados fictícios ----
pop = np.array(d["pop"], dtype=np.int64); cob = np.array(d["cob"], float)
cases = np.array([math.floor(pop[i] * (1 - min(cob[i], 100) / 100) + 0.5) for i in range(n)], dtype=np.int64)
chk("casos fictícios", cases.tolist(), d["cases"])
C = int(cases.sum()); P = int(pop.sum())
print(f"P = {P}; C = {C}; risco geral = {100*C/P:.4f} por 100")


def estrutura(O, pop, frac):
    CP = np.cumsum(pop[O], axis=1).astype(float); V = CP <= frac * pop.sum() + 1e-9
    return CP, V


def llr_forma_a(c, E, C):
    c = np.asarray(c, float); E = np.asarray(E, float); m = c > E
    cs = np.where(m, c, 1.0); Es = np.where(m, E, 1.0)
    t1 = np.where(m, cs * np.log(cs / Es), 0.0)
    rem = C - c; m2 = m & (rem > 0)
    t2 = np.where(m2, np.where(m2, rem, 1.0) * np.log(np.where(m2, rem, 1.0) / np.where(m, C - Es, 1.0)), 0.0)
    return t1 + t2, m


def llr_forma_b(c, popin, C, P):
    c = np.asarray(c, float); popin = np.asarray(popin, float); E = C * popin / P; m = c > E
    p0 = C / P; pin = np.where(m, c, 1.0) / popin; rem = C - c; pout = np.where(rem > 0, rem, 1.0) / (P - popin)
    t1 = np.where(m, c * np.log(pin / p0), 0.0)
    t2 = np.where(m & (rem > 0), rem * np.log(pout / p0), 0.0)
    return t1 + t2


def matriz(cs, O, CP, V, C, P):
    CC = np.cumsum(cs[O], axis=1).astype(float); E = C * CP / P
    L, m = llr_forma_a(CC, E, C)
    m = m & V
    return np.where(m, L, 0.0), m, CC


def secundarios(O, L, m, CC, CP, C, P, maxn):
    idx = np.argwhere(m); lista = [(-L[i, k], int(i), int(k) + 1) for i, k in idx]; lista.sort()
    usados = set(); out = []
    for nl, i, k in lista:
        mem = [int(j) for j in O[i, :k]]
        if any(j in usados for j in mem): continue
        usados.update(mem); c = float(CC[i, k - 1]); pp = float(CP[i, k - 1])
        out.append(dict(ctr=i, k=k, c=c, pop=pp, E=C * pp / P, llr=-nl, members=mem, rr=(c / pp) / ((C - c) / (P - pp))))
        if len(out) >= maxn: break
    return out


# ---- LLR: duas formas algébricas e um valor à mão ----
rng0 = np.random.default_rng(7)
cc = rng0.integers(1, 400, 2000).astype(float); pp = rng0.integers(200, 70000, 2000).astype(float)
La, ma = llr_forma_a(cc, C * pp / P, C); Lb = llr_forma_b(cc, pp, C, P)
chk("LLR forma A = forma B (2000 janelas aleatórias)", float(np.max(np.abs(La - Lb))), 0.0, 1e-8)
chk("LLR vale 0 quando c <= E", float(llr_forma_a([5.0], [9.0], 100)[0][0]), 0.0)
chk("LLR com c = C usa só o primeiro termo", float(llr_forma_a([100.0], [10.0], 100)[0][0]), 100 * math.log(10.0), 1e-12)

# ---- varredura: 50%, 25% e 10% ----
setups = {}
for mx in (50, 25, 10):
    CP, V = estrutura(O, pop, mx / 100); L, m, CC = matriz(cases, O, CP, V, C, P)
    setups[mx] = (CP, V)
    fr = d["fr"][str(mx)]
    chk(f"{mx}% nº de janelas válidas", int(V.sum()), fr["nWindows"]); chk(f"{mx}% kmax", V.sum(axis=1).tolist(), fr["kmax"])
    chk(f"{mx}% nº de janelas com c > E", int(m.sum()), fr["nPos"])
    # melhor por centro
    bl = L.max(axis=1); bk = [int(np.argmax(L[i])) + 1 if bl[i] > 0 else 0 for i in range(n)]
    chk(f"{mx}% LLR máxima por centro", float(np.max(np.abs(bl - np.array([b["llr"] for b in fr["byCtr"]])))), 0.0, 1e-8)
    chk(f"{mx}% k do melhor de cada centro", bk, [b["k"] for b in fr["byCtr"]])
    # melhor global: primeiro máximo na ordem (centro, k)
    fl = int(np.argmax(L)); gi, gk = divmod(fl, n); gl = float(L.flat[fl])
    b = fr["best"]; chk(f"{mx}% mais provável: centro", gi, b["ctr"]); chk(f"{mx}% mais provável: k", gk + 1, b["k"]); chk(f"{mx}% mais provável: LLR", gl, b["llr"], 1e-8)
    # força bruta independente do melhor global: percorre cada centro com sorted() e soma
    bf = (0.0, -1, 0)
    for i in range(n):
        s_pop = 0; s_c = 0
        for k in range(n):
            j = int(O[i, k]); s_pop += int(pop[j]); s_c += int(cases[j])
            if s_pop > mx / 100 * P + 1e-9: break
            E = C * s_pop / P
            if s_c > E:
                l = s_c * math.log(s_c / E) + ((C - s_c) * math.log((C - s_c) / (C - E)) if C - s_c > 0 else 0.0)
                if l > bf[0]: bf = (l, i, k + 1)
    chk(f"{mx}% força bruta = vetorizado (centro, k, LLR)", [bf[1], bf[2]], [gi, gk + 1]); chk(f"{mx}% força bruta LLR", bf[0], gl, 1e-8)
    # secundários e risco relativo
    cl = secundarios(O, L, m, CC, CP, C, P, 12); jcl = fr["cl"]
    chk(f"{mx}% nº de aglomerados listados", len(cl), len(jcl))
    for q, (a, bb) in enumerate(zip(cl, jcl)):
        chk(f"{mx}% aglomerado {q+1} centro/k", [a["ctr"], a["k"]], [bb["ctr"], bb["k"]]); chk(f"{mx}% aglomerado {q+1} membros", a["members"], bb["members"])
        chk(f"{mx}% aglomerado {q+1} c", a["c"], bb["c"]); chk(f"{mx}% aglomerado {q+1} pop", a["pop"], bb["pop"])
        chk(f"{mx}% aglomerado {q+1} E", a["E"], bb["E"], 1e-8); chk(f"{mx}% aglomerado {q+1} LLR", a["llr"], bb["llr"], 1e-8); chk(f"{mx}% aglomerado {q+1} risco relativo", a["rr"], bb["rr"], 1e-9)
    todos = [x for a in cl for x in a["members"]]
    chk(f"{mx}% secundários sem município em comum", len(todos), len(set(todos)))
    chk(f"{mx}% LLR dos aglomerados em ordem decrescente", all(cl[i]["llr"] >= cl[i + 1]["llr"] for i in range(len(cl) - 1)), True)
    # risco relativo: dentro / fora, em forma explícita
    a0 = cl[0]; fora_c = C - a0["c"]; fora_p = P - a0["pop"]
    chk(f"{mx}% risco relativo = (c/pop)/((C-c)/(P-pop))", (a0["c"] / a0["pop"]) / (fora_c / fora_p), a0["rr"], 1e-12)
    # LLR da melhor janela pela forma B
    chk(f"{mx}% LLR do mais provável pela forma B", float(llr_forma_b([a0["c"]], [a0["pop"]], C, P)[0]), a0["llr"], 1e-8)
    print(f"{mx}%: janelas {int(V.sum())}; mais provável: centro {gi}, k={gk+1}, LLR={gl:.3f}, RR={a0['rr']:.3f}; aglomerados listados: {len(cl)}")

# ---- gerador: mulberry32 vetorizado por contador (a saída k só depende de seed + k * 0x6D2B79F5) ----
U64 = np.uint64


def mb_bloco(seed, k0, cont):
    k = np.arange(k0 + 1, k0 + cont + 1, dtype=np.uint64)
    a = (U64(seed) + k * U64(0x6D2B79F5)) & U64(MASK)
    t = ((a ^ (a >> U64(15))) * (a | U64(1))) & U64(MASK)
    u = ((t ^ (t >> U64(7))) * (t | U64(61))) & U64(MASK)
    t = t ^ ((t + u) & U64(MASK))
    return ((t ^ (t >> U64(14))) & U64(MASK)).astype(np.float64) / 4294967296.0


def mb_escalar(seed):
    a = [seed & MASK]
    def f():
        a[0] = (a[0] + 0x6D2B79F5) & MASK; t = a[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & MASK
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & MASK)) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296
    return f


f_ = mb_escalar(SEED); esc = [f_() for _ in range(2000)]
chk("gerador vetorizado = escalar (2000 valores)", float(np.max(np.abs(np.array(esc) - mb_bloco(SEED, 0, 2000)))), 0.0, 0.0)

# ---- Monte Carlo com a mesma semente ----
tab = np.repeat(np.arange(n), pop)
M = 9999
simsP = {mx: np.zeros(M) for mx in (50, 25, 10)}
for r in range(M):
    u = mb_bloco(SEED, r * C, C)
    cs = np.bincount(tab[np.floor(u * P).astype(np.int64)], minlength=n)
    for mx in (50, 25, 10):
        CP, V = setups[mx]; Lr, _, _ = matriz(cs, O, CP, V, C, P); simsP[mx][r] = Lr.max()
for mx in (50, 25, 10):
    fr = d["fr"][str(mx)]; obs = fr["best"]["llr"]; sj = np.array(fr["mc9999"]["sims"]); sp = simsP[mx]
    chk(f"{mx}% MC 9999: LLR máxima de cada réplica (js x py)", float(np.max(np.abs(sj - sp))), 0.0, 1e-8)
    for MM, key in ((999, "mc999"), (9999, "mc9999")):
        R = int((sp[:MM] >= obs).sum()); p = (R + 1) / (MM + 1)
        chk(f"{mx}% MC {MM}: R", R, fr[key]["R"]); chk(f"{mx}% MC {MM}: p", p, fr[key]["p"], 1e-15); chk(f"{mx}% MC {MM}: p > 0", p > 0, True)
    chk(f"{mx}% 999 réplicas = prefixo de 9999 (js)", float(np.max(np.abs(np.array(fr["mc999"]["sims"]) - sj[:999]))), 0.0, 0.0)
    print(f"{mx}%: R(999) = {fr['mc999']['R']}, p = {fr['mc999']['p']}; R(9999) = {fr['mc9999']['R']}, p = {fr['mc9999']['p']}; maior LLR entre as réplicas = {sp.max():.3f}; LLR observada = {obs:.3f}")
    # p dos secundários pelo mesmo critério (comparar com as mesmas LLR máximas)
    for q, a in enumerate(fr["cl"][:5]):
        Rq = int((sp >= a["llr"]).sum()); assert 1 <= Rq + 1 <= M + 1
        if q < 2: print(f"   aglomerado {q+1}: LLR {a['llr']:.2f}; p(9999) = {(Rq+1)/(M+1):.4f}")

# ---- verificação estatística tolerante: gerador multinomial do numpy (sem reutilizar o fluxo mulberry32) ----
# Tolerância documentada: médias das LLR máximas até 5 erros-padrão; estatística KS abaixo de 1,95 * sqrt((n1 + n2)/(n1 n2)) (nível ~0,001).
rg = np.random.default_rng(20261027); NS_ = 1500; pr = pop / P
for mx in (50, 25, 10):
    CP, V = setups[mx]; sn = np.zeros(NS_)
    for r in range(NS_):
        Lr, _, _ = matriz(rg.multinomial(C, pr), O, CP, V, C, P); sn[r] = Lr.max()
    sj = np.array(d["fr"][str(mx)]["mc9999"]["sims"]); se = math.sqrt(sn.var(ddof=1) / NS_ + sj.var(ddof=1) / len(sj))
    chk(f"{mx}% estat.: médias das LLR máximas (numpy x mulberry) dentro de 5 EP", abs(sn.mean() - sj.mean()) <= 5 * se, True)
    a1 = np.sort(sn); a2 = np.sort(sj); allv = np.concatenate([a1, a2]); ks = float(np.max(np.abs(np.searchsorted(a1, allv, side="right") / NS_ - np.searchsorted(a2, allv, side="right") / len(a2))))
    crit = 1.95 * math.sqrt((NS_ + len(a2)) / (NS_ * len(a2)))
    chk(f"{mx}% estat.: KS entre as duas distribuições abaixo de {crit:.3f}", ks <= crit, True)
    print(f"verificação estatística {mx}%: média numpy {sn.mean():.3f} x mulberry {sj.mean():.3f}; KS = {ks:.4f} (limite {crit:.4f})")

# ---- exemplo mínimo A-G ----
t = d["toy"]; tx = np.array(t["x"]); ty = np.array(t["y"]); tp = np.array(t["pop"]); tcs = np.array(t["cases"]); tC = int(tcs.sum()); tP = int(tp.sum())
chk("toy C = 165 e P = 3800", [tC, tP], [165, 3800])
tO, _ = ordem(tx, ty); chk("toy ordem", tO.tolist(), t["order"])
tCP, tV = estrutura(tO, tp, 0.5); chk("toy janelas válidas (22)", int(tV.sum()), 22); chk("toy nWindows (js)", int(tV.sum()), t["nWindows"]); chk("toy kmax", tV.sum(axis=1).tolist(), t["kmax"])
tL, tm, tCC = matriz(tcs, tO, tCP, tV, tC, tP)
chk("toy nº de janelas com LLR > 0", int(tm.sum()), len(t["wins"]))
for w in t["wins"]:
    chk(f"toy janela {w['ctr']},{w['k']} LLR", tL[w["ctr"], w["k"] - 1], w["llr"], 1e-9); chk(f"toy janela {w['ctr']},{w['k']} E", tC * tCP[w["ctr"], w["k"] - 1] / tP, w["E"], 1e-9)
# valores à mão: janela B+C (c = 85, população 1100) e E+F (c = 30 < E)
E_bc = 165 * 1100 / 3800; ll_bc = 85 * math.log(85 / E_bc) + 80 * math.log(80 / (165 - E_bc))
chk("toy LLR de B+C = 18,420", round(ll_bc, 3), 18.420); chk("toy LLR de B+C (vetorizado)", tL[1, 1], ll_bc, 1e-12)
chk("toy E+F: c=30 não passa de E=65,13 e a LLR é 0", [int(tCC[4, 1]), round(165 * 1500 / 3800, 2), float(tL[4, 1])], [30, 65.13, 0.0])
chk("toy RR de B+C = 2,61 (dentro 85/1100, fora 80/2700)", round((85 / 1100) / (80 / 2700), 2), 2.61)
fl = int(np.argmax(tL)); gi, gk = divmod(fl, 7); tcl = secundarios(tO, tL, tm, tCC, tCP, tC, tP, 5)
chk("toy mais provável (centro, k) = (A, 4)", [gi, gk + 1], [0, 4]); chk("toy LLR máxima = 25,265", round(float(tL.max()), 3), 25.265)
chk("toy aglomerados (js x py)", [(a["ctr"], a["k"], a["members"]) for a in tcl], [(a["ctr"], a["k"], a["members"]) for a in t["cl"]])
chk("toy único aglomerado (E, F, G têm LLR 0)", len(tcl), 1)
chk("toy RR do mais provável", tcl[0]["rr"], t["cl"][0]["rr"], 1e-12)
# força bruta do toy com sorted() e itertools: todos os centros e todos os tamanhos
melhor = (0.0, None)
for i in range(7):
    ordi = sorted(range(7), key=lambda j: (math.hypot(tx[i] - tx[j], ty[i] - ty[j]), j))
    for k in range(1, 8):
        mem = ordi[:k]; pp = int(tp[mem].sum()); cc = int(tcs[mem].sum())
        if pp > 0.5 * tP: break
        E = tC * pp / tP
        if cc > E:
            l = cc * math.log(cc / E) + (tC - cc) * math.log((tC - cc) / (tC - E))
            if l > melhor[0]: melhor = (l, sorted(mem))
chk("toy força bruta = js", [round(melhor[0], 9), melhor[1]], [round(t["cl"][0]["llr"], 9), sorted(t["cl"][0]["members"])])
print(f"exemplo A-G: mais provável {melhor[1]} com LLR {melhor[0]:.4f}; RR {tcl[0]['rr']:.3f}")

print(f"{tot} comparações, {bad} divergências"); sys.exit(1 if bad else 0)
