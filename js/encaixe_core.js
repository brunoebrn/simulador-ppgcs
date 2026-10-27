/* Valores-chave do método 8 (Como se encaixam): reúne, sem cálculo novo, os números fictícios dos métodos 1 a 7.
   Usa os mesmos motores, dados, sementes e configurações padrão dos módulos (Moran: queen, cobertura, 999; LISA: cobertura, 999, FDR;
   SaTScan: Poisson, 50%, 999; GWR: modelo de 3 explicativas). Browser: window.PPGCS.encaixe_core. Node: module.exports. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./stats.js"), require("./data.js"), require("./indicadores_core.js"), require("./spatial_core.js"));
  } else {
    var NS = (root.PPGCS = root.PPGCS || {});
    NS.encaixe_core = factory(NS.stats, NS.data, NS.ind, NS.spatial);
  }
})(typeof self !== "undefined" ? self : this, function (ST, D, IND, S) {
  "use strict";
  var SEED = 2026, ALPHA = 0.05, KMIN = 20, M = 999;
  var MODS3 = ["idhm", "analf", "esf"];

  function indicadores() {
    var R = IND.tudo();
    return { n: R.n, nAtinge: R.nAtinge, homog: R.homog, sensSup: R.sensSup, sensInf: R.sensInf };
  }
  function joinpoint() {
    var ser = D.serie25, y = Float64Array.from(ser.cob.map(function (v) { return Math.log(v / 100); }));
    var sel = ST.selectModel(y, { max: 4, fim: 2, entre: 2, nPerm: 1000, seed: SEED }), fit = ST.bestFit(y, sel.k, { fim: 2, entre: 2 }), sm = ST.summarize(ser.cob, ser.anos, fit);
    return { k: sel.k, tests: sel.tests.map(function (t) { return { ka: t.ka, kb: t.kb, p: t.p, level: t.level, reject: t.reject }; }),
      taus: fit.taus, segs: sm.segs.map(function (g) { return { de: g.de, ate: g.ate, apc: g.apc }; }), aapc: sm.aapc,
      apc: sm.segs.map(function (g) { return g.apc; }) };
  }
  function espacial(geo, SD) {
    var N = geo.length, W = S.rowStd(S.neighbors(geo, "queen")), x = SD.cob;
    var g = S.moranI(x, W), pt = S.permTest(x, W, M, SEED);
    var l = S.localI(x, W), lp = S.lisa(x, W, M, SEED), fd = S.fdr(lp.p, ALPHA), q = [0, 0, 0, 0], tot = 0;
    fd.sig.forEach(function (s, i) { if (s) { q[l.quad[i]]++; tot++; } });
    var pop = SD.nasc, cases = pop.map(function (n, i) { return Math.round(n * (1 - Math.min(SD.cob[i], 100) / 100)); }), C = S.sum(cases), PL = S.planar(geo), ORD = S.scanOrder(PL);
    var T = S.scanSetup(ORD, pop, 0.5), all = S.scanAll(T, cases), cl = S.scanClusters(T, all, 12), b = cl[0], mc = S.scanMC(T, cases, M, SEED, b.llr);
    var Y = SD.gwr.cobertura, cols = MODS3.map(function (k) { return S.zscore(SD.gwr[k]); }), X = S.design(cols), o = S.ols(X, Y), q3 = X[0].length;
    var vif = S.vifs(cols), curve = S.gwrCurve(X, Y, ORD, KMIN, N), kb = curve.best.k, gw = S.gwr(X, Y, ORD, kb, true);
    var pr = S.permTest(o.resid, W, M, SEED);
    return {
      n: N, moran: { I: g.I, EI: g.EI, R: pt.R, p: pt.p },
      lisa: { total: tot, hh: q[0], ll: q[2], lh: q[1], hl: q[3], fdrK: fd.k, quad: q },
      scan: { ctr: b.ctr, k: b.k, c: b.c, E: b.E, rr: b.rr, llr: b.llr, R: mc.R, p: mc.p, nSec: cl.length - 1, nomeIdx: b.ctr, members: b.members },
      reg: { vifMax: Math.max.apply(null, vif.map(function (v) { return v.vif; })), olsR2: o.r2, olsAicc: S.aicc(o.rss, N, q3), gwR2: gw.r2, gwAicc: gw.aicc, kb: kb, residI: pr.I, residP: pr.p }
    };
  }
  return { indicadores: indicadores, joinpoint: joinpoint, espacial: espacial, M: M, SEED: SEED };
});
