"""Conferência independente (Python puro, frações exatas) dos Indicadores. Uso: python3 tests/check_indicadores.py ind_js.json"""
import json, sys
from fractions import Fraction as F
d = json.load(open(sys.argv[1])); ms = d["municipios"]; js = d["res"]; bad = 0; n = 0
def chk(nome, a, b, tol=1e-9):
    global bad, n; n += 1
    if a is None or b is None: ok = a == b
    elif isinstance(a, bool) or isinstance(b, bool): ok = a == b
    elif isinstance(a, str): ok = a == b
    else: ok = abs(float(a) - float(b)) <= tol
    if not ok: bad += 1; print("DIVERGE", nome, a, b)
def classe(t): return "negativa" if t < 0 else "baixa" if t < 5 else "média" if t < 10 else "alta"
L = []
for m in ms:
    cv = F(m["d3"] * 100, m["nv"]); ta = F((m["d1"] - m["d3"]) * 100, m["d1"]); L.append(dict(m, cv=cv, ta=ta, atinge=cv >= 95))
for x, j in zip(L, js["linhas"]):
    chk(x["nome"] + " cv", x["cv"], j["cv"]); chk(x["nome"] + " ta", x["ta"], j["ta"]); chk(x["nome"] + " atinge", x["atinge"], j["atinge"])
    chk(x["nome"] + " classe", classe(x["ta"]), j["classeTA"]); chk(x["nome"] + " gt100", x["cv"] > 100, j["gt100"]); chk(x["nome"] + " gt110", x["cv"] > 110, j["gt110"])
    chk(x["nome"] + " gt120", x["cv"] > 120, j["gt120"]); chk(x["nome"] + " lt50", x["cv"] < 50, j["lt50"]); chk(x["nome"] + " pequeno", x["nv"] < 1000, j["pequeno"])
N = len(L); ok = sum(x["atinge"] for x in L); val = [x for x in L if not x["cv"] > 120]; okv = sum(x["atinge"] for x in val)
chk("homog", F(100 * ok, N), js["homog"]); chk("sensSup", F(100 * ok, N), js["sensSup"]); chk("sensInf", F(100 * okv, len(val)), js["sensInf"])
chk("nAcima120", N - len(val), js["nAcima120"]); chk("nGt100", sum(x["cv"] > 100 for x in L), js["nGt100"]); chk("nGt110", sum(x["cv"] > 110 for x in L), js["nGt110"])
chk("nLt50", sum(x["cv"] < 50 for x in L), js["nLt50"]); chk("nPequenos", sum(x["nv"] < 1000 for x in L), js["nPequenos"]); chk("nNegTA", sum(x["ta"] < 0 for x in L), js["nNegTA"])
print(f"{n} comparações, {bad} divergências"); sys.exit(1 if bad else 0)
