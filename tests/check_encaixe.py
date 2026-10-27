"""Conferência do método 8 (Como se encaixam): os valores exibidos devem bater com os dumps dos outros checks.
Sem estatística nova: gera os dumps (node), compara os valores de js/encaixe_core.js com os dumps dos métodos 1 a 7 e refaz em Python
o ajuste Joinpoint de 4 dobras (numpy) para APC e AAPC. Divergências são REPORTADAS, nunca ajustadas à mão.
Uso: python3 tests/check_encaixe.py"""
import json, os, subprocess, sys, tempfile, itertools
from fractions import Fraction as F
import numpy as np
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); tmp = tempfile.mkdtemp()
def dump(nome):
    out = subprocess.run(["node", os.path.join(raiz, "tests", "dump_%s.js" % nome)], capture_output=True, text=True, cwd=raiz, check=True).stdout
    return json.loads(out)
E_ = dump("encaixe"); ind = dump("indicadores")["res"]; mor = dump("moran"); lis = dump("lisa"); sat = dump("satscan"); gw = dump("gwr")
bad = 0; n = 0
def chk(nome, a, b, tol=1e-9):
    global bad, n; n += 1
    ok = (a == b) if isinstance(a, (bool, str)) or isinstance(b, (bool, str)) else abs(float(a) - float(b)) <= tol * max(1.0, abs(float(b)))
    if not ok: bad += 1; print("DIVERGE", nome, a, b)
# 1. Indicadores
e = E_["ind"]
for k in ["n", "nAtinge", "homog", "sensSup", "sensInf"]: chk("ind." + k, e[k], ind[k])
chk("ind.homog (fração)", e["homog"], float(F(100 * ind["nAtinge"], ind["n"])))
# 2. Joinpoint: refaz o melhor ajuste contínuo de 4 dobras (fim=2, entre=2) e os APC/AAPC
cob = [78, 80, 83, 85, 88, 90, 93, 95, 96, 97, 98, 99, 98, 97, 96, 96, 92, 88, 85, 83, 76, 74, 75, 78, 80]
y = np.log(np.array(cob) / 100); N = len(y); x = np.arange(N, dtype=float); K = E_["jp"]["k"]
chk("jp.k (4 = máximo testado)", K, 4)
best = None
for t in itertools.combinations(range(N), K):
    if t[0] < 2 or t[-1] > N - 3 or any(b - a < 3 for a, b in zip(t, t[1:])): continue
    X = np.column_stack([np.ones(N), x] + [np.maximum(0, x - s) for s in t]); b, *_ = np.linalg.lstsq(X, y, rcond=None); r = y - X @ b; sse = float(r @ r)
    if best is None or sse < best[0] - 1e-15: best = (sse, t, b)
sse, taus, beta = best; chk("jp.taus", list(taus) == E_["jp"]["taus"], True)
sl = np.cumsum(beta[1:]); bounds = [0] + list(taus) + [N - 1]; apc = (np.exp(sl) - 1) * 100; ln = np.diff(bounds)
for i, a in enumerate(apc): chk("jp.apc%d" % i, E_["jp"]["apc"][i], a, 1e-7)
chk("jp.aapc", E_["jp"]["aapc"], (np.exp((ln * sl).sum() / ln.sum()) - 1) * 100, 1e-7)
# 3. Moran global (queen, cobertura, 999)
m = mor["vars"]["cob"]["kinds"]["queen"]; pm = m["perm"]["999"]; e = E_["esp"]["moran"]
chk("moran.I", e["I"], m["I"]); chk("moran.EI", e["EI"], m["EI"]); chk("moran.EI (-1/(n-1))", e["EI"], -1 / (E_["esp"]["n"] - 1)); chk("moran.R", e["R"], pm["R"]); chk("moran.p", e["p"], pm["p"]); chk("moran.p (R+1)/(M+1)", e["p"], (pm["R"] + 1) / 1000)
# 4. LISA (cobertura, 999, FDR)
v = lis["vars"]["cob"]; pp = v["perm"]["999"]; q = [0, 0, 0, 0]
for s, qd in zip(pp["fdrSig"], v["quad"]):
    if s: q[qd] += 1
e = E_["esp"]["lisa"]; chk("lisa.total", e["total"], sum(pp["fdrSig"])); chk("lisa.fdrK", e["fdrK"], pp["fdrK"])
for nome, i in [("hh", 0), ("lh", 1), ("ll", 2), ("hl", 3)]: chk("lisa." + nome, e[nome], q[i])
chk("lisa.soma dos quadrantes", sum(q), e["total"])
# 5. SaTScan (Poisson, 50%, 999)
f = sat["fr"]["50"]; b = f["cl"][0]; mc = f["mc999"]; e = E_["esp"]["scan"]
for k in ["ctr", "k", "c", "E", "rr", "llr"]: chk("scan." + k, e[k], b[k])
chk("scan.R", e["R"], mc["R"]); chk("scan.p", e["p"], mc["p"]); chk("scan.p (R+1)/(M+1)", e["p"], (mc["R"] + 1) / 1000)
# 6. VIF, OLS, GWR (3 explicativas)
g = gw["mods"]["3"]; e = E_["esp"]["reg"]
chk("reg.vifMax", e["vifMax"], max(v_["vif"] for v_ in g["vif"])); chk("reg.olsR2", e["olsR2"], g["ols"]["r2"]); chk("reg.olsR2 (1-RSS/TSS)", e["olsR2"], 1 - g["ols"]["rss"] / g["ols"]["tss"])
chk("reg.olsAicc", e["olsAicc"], g["ols"]["aicc"]); chk("reg.gwR2", e["gwR2"], g["gw"]["r2"]); chk("reg.gwAicc", e["gwAicc"], g["gw"]["aicc"]); chk("reg.kb", e["kb"], g["kb"])
chk("reg.residI", e["residI"], g["perm"]["999"]["I"]); chk("reg.residP", e["residP"], g["perm"]["999"]["p"])
print("%d comparações, %d divergências" % (n, bad)); sys.exit(1 if bad else 0)
