/* Gera os resultados do motor JS do método 7 (VIF, OLS, I de Moran dos resíduos e GWR) em JSON, para comparação com tests/check_gwr.py */
const fs = require("fs"), path = require("path"), S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
global.window = { PPGCS: {} }; eval(fs.readFileSync(path.join(__dirname, "../js/spatial_data.js"), "utf8"));
const D = window.PPGCS.spatial_data, SEED = 2026, N = geo.length, KMIN = 20, Y = D.gwr.cobertura;
const PL = S.planar(geo), ORD = S.scanOrder(PL), W = S.rowStd(S.neighbors(geo, "queen"));
const MODS = { 3: ["idhm", "analf", "esf"], 5: ["idhm", "ivs", "analf", "renda", "esf"] };
const out = { codigos: geo.map(f => f.properties.c), seed: SEED, n: N, kmin: KMIN, data: D.gwr, x: PL.x, y: PL.y, order: ORD.map(o => o.ord), mods: {}, toy: {}, normal: {} };
for (const m of [3, 5]) {
  const keys = MODS[m], cols = keys.map(k => S.zscore(D.gwr[k])), X = S.design(cols), o = S.ols(X, Y), q = X[0].length;
  const curve = S.gwrCurve(X, Y, ORD, KMIN, N), kb = curve.best.k, g = S.gwr(X, Y, ORD, kb, true);
  const crit0 = S.normCrit(0.05), critB = S.normCrit(0.05 / (N * q));
  const perm = {}; for (const M of [999, 9999]) { const p = S.permTest(o.resid, W, M, SEED); perm[M] = { I: p.I, EI: p.EI, R: p.R, p: p.p, upper: p.upper, sims: p.sims }; }
  const extra = {}; for (const k of [20, 35, 60, 102]) { const e = S.gwr(X, Y, ORD, k, true); extra[k] = { beta: e.beta, aicc: e.aicc, trS: e.trS, rss: e.rss, se: e.se, t: e.t, r2loc: e.r2loc, neff: e.neff, delta1: e.delta1 }; }
  const cnt = []; for (let a = 0; a < q; a++) cnt.push({ naive: g.t.filter(t => Math.abs(t[a]) > crit0).length, bonf: g.t.filter(t => Math.abs(t[a]) > critB).length });
  out.mods[m] = { keys, vif: S.vifs(cols), ols: { beta: o.beta, se: o.se, t: o.t, fit: o.fit, resid: o.resid, rss: o.rss, tss: o.tss, r2: o.r2, chk: o.chk, aicc: S.aicc(o.rss, N, q) }, perm,
    curve: curve.rows.map(r => ({ k: r.k, aicc: r.aicc, trS: r.trS, rss: r.rss })), kb, gw: { beta: g.beta, yhat: g.yhat, resid: g.resid, rss: g.rss, trS: g.trS, sdiag: g.sdiag, aicc: g.aicc, r2: g.r2, delta1: g.delta1, trSS: g.trSS, s2: g.s2, se: g.se, t: g.t, r2loc: g.r2loc, neff: g.neff },
    extra, crit0, critB, nTests: N * q, counts: cnt };
}
const t1 = [1, 2, 3, 4, 5, 6], t2 = [2, 1, 4, 3, 6, 5], tv = S.vifs([t1, t2]);
out.toy = { x1: t1, x2: t2, corr: S.corr(t1, t2), vif: tv.map(v => v.vif), r2: tv.map(v => v.r2) };
out.normal = { pts: [0.5, 1, 1.96, 2.5, 3, 3.84, 4.5, 5], sf: [0.5, 1, 1.96, 2.5, 3, 3.84, 4.5, 5].map(S.normSf), alphas: [0.05, 0.01, 0.05 / 408, 0.05 / 612], crit: [0.05, 0.01, 0.05 / 408, 0.05 / 612].map(S.normCrit) };
console.log(JSON.stringify(out));
