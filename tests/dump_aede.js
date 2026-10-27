/* Gera os resultados do motor JS da AEDE em JSON, para comparação com tests/check_aede.py */
const fs = require("fs"), path = require("path"), S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
global.window = { PPGCS: {} }; eval(fs.readFileSync(path.join(__dirname, "../js/spatial_data.js"), "utf8"));
const D = window.PPGCS.spatial_data, X = D.cob, SEED = 2026, M = 999;
const out = { codigos: geo.map(f => f.properties.c), cob: X, seed: SEED, M, nb: {}, I: {}, perm: {}, quant: {} };
const nbs = { queen: S.neighbors(geo, "queen"), rook: S.neighbors(geo, "rook"), knn5: S.knn(geo, 5) };
for (const k in nbs) {
  const r = nbs[k]; out.nb[k] = { nb: r.nb, pairs: r.pairs, links: r.links, islands: r.islands, meanDeg: r.meanDeg, minDeg: r.minDeg, maxDeg: r.maxDeg };
  const W = S.rowStd(r), m = S.moranI(X, W); out.I[k] = { I: m.I, EI: m.EI, S0: m.S0, wz: m.wz, lagX: S.lag(X, W) };
  const p = S.permTest(X, W, M, SEED); out.perm[k] = { R: p.R, p: p.p, sims: p.sims };
}
const WQ = S.rowStd(nbs.queen), zs = S.zscore(X), wzs = S.lag(zs, WQ);
out.zs = zs; out.wzs = wzs; out.quad = zs.map((z, i) => S.quadrant(z, wzs[i])); out.slope = S.slope(zs, wzs);
out.quant = { b4: S.quantileBreaks(X, 4), b5: S.quantileBreaks(X, 5), c4: X.map(v => S.classOf(v, S.quantileBreaks(X, 4))), c5: X.map(v => S.classOf(v, S.quantileBreaks(X, 5))) };
out.cent = geo.map(S.centroid);
const toy = { x: [95, 92, 90, 80, 72, 70], nb: [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]] }, tw = S.rowStd(toy.nb), tm = S.moranI(toy.x, tw);
out.toy = { I: tm.I, EI: tm.EI, wz: tm.wz, num: tm.num, den: tm.den };
const sh = X.slice(); S.shuffle(sh, S.rng(11)); out.shuf = { seed: 11, v: sh, I: S.moranI(sh, WQ).I };
console.log(JSON.stringify(out));
