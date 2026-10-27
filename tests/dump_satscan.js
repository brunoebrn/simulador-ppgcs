/* Gera os resultados do motor JS da varredura de Kulldorff (Poisson, alto risco, espacial) em JSON, para comparação com tests/check_satscan.py */
const fs = require("fs"), path = require("path"), S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
global.window = { PPGCS: {} }; eval(fs.readFileSync(path.join(__dirname, "../js/spatial_data.js"), "utf8"));
const D = window.PPGCS.spatial_data, SEED = 2026, N = geo.length;
const pop = D.nasc, cases = D.nasc.map((n, i) => Math.round(n * (1 - Math.min(D.cob[i], 100) / 100)));
const C = S.sum(cases), PL = S.planar(geo), ORD = S.scanOrder(PL);
const out = { codigos: geo.map(f => f.properties.c), seed: SEED, pop, cases, cob: D.cob, x: PL.x, y: PL.y, kx: PL.kx, order: ORD.map(o => o.ord), fr: {}, toy: {} };
for (const mx of [50, 25, 10]) {
  const T = S.scanSetup(ORD, pop, mx / 100), all = S.scanAll(T, cases), cl = S.scanClusters(T, all, 12), best = S.scanBest(T, cases, C);
  const b = cl[0], m999 = S.scanMC(T, cases, 999, SEED, b.llr), m9999 = S.scanMC(T, cases, 9999, SEED, b.llr);
  out.fr[mx] = { nWindows: T.nWindows, kmax: T.kmax, nPos: all.wins.length, byCtr: all.byCtr, best, cl, mc999: { R: m999.R, p: m999.p, sims: Array.from(m999.sims) }, mc9999: { R: m9999.R, p: m9999.p, sims: Array.from(m9999.sims) } };
}
const xy = { x: [0.4, 1.3, 2.3, 1.9, 3.8, 4.7, 3.9], y: [1.8, 1.0, 1.4, 2.5, 0.6, 1.7, 2.7] }, tp = [400, 600, 500, 300, 700, 800, 500], tc = [20, 45, 40, 18, 14, 16, 12];
const to = S.scanOrder(xy), tT = S.scanSetup(to, tp, 0.5), ta = S.scanAll(tT, tc), tcl = S.scanClusters(tT, ta, 5);
out.toy = { x: xy.x, y: xy.y, pop: tp, cases: tc, order: to.map(o => o.ord), kmax: tT.kmax, nWindows: tT.nWindows, wins: ta.wins, byCtr: ta.byCtr, cl: tcl };
console.log(JSON.stringify(out));
