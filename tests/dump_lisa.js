/* Gera os resultados do motor JS do Moran local (LISA) em JSON, para comparação com tests/check_lisa.py */
const fs = require("fs"), path = require("path"), S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
global.window = { PPGCS: {} }; eval(fs.readFileSync(path.join(__dirname, "../js/spatial_data.js"), "utf8"));
const D = window.PPGCS.spatial_data, SEED = 2026, N = geo.length;
const nb = S.neighbors(geo, "queen"), W = S.rowStd(nb);
const out = { codigos: geo.map(f => f.properties.c), seed: SEED, nb: nb.nb, vars: {}, toy: {}, nasc: D.nasc };
for (const v of ["cob", "aband", "ruido"]) {
  const x = D[v], loc = S.localI(x, W), g = S.moranI(x, W), o = { x, I: loc.I, z: loc.z, wz: loc.wz, m2: loc.m2, quad: loc.quad, globalI: g.I, perm: {}, sims: {} };
  for (const M of [999, 1999, 9999]) {
    const r = S.lisa(x, W, M, SEED), fd = S.fdr(r.p, 0.05), bf = S.bonferroni(r.p, 0.05), Rup = [], Rlow = [];
    for (let i = 0; i < N; i++) { const t = S.condPerm(x, W, i, M, SEED, false, loc); Rup.push(t.Rup); Rlow.push(t.Rlow); }
    o.perm[M] = { R: r.R, p: r.p, upper: r.upper, Rup, Rlow, fdrK: fd.k, fdrSig: fd.sig, bonfLim: bf.lim, bonfSig: bf.sig };
  }
  for (const i of [0, 17, 57, 101]) o.sims[i] = S.condPerm(x, W, i, 999, SEED, true, loc).sims;
  out.vars[v] = o;
}
const toy = { x: [95, 92, 90, 80, 72, 70], nb: [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]] }, tw = S.rowStd(toy.nb), tl = S.localI(toy.x, tw), tg = S.moranI(toy.x, tw);
out.toy = { x: toy.x, nb: toy.nb, I: tl.I, z: tl.z, wz: tl.wz, m2: tl.m2, quad: tl.quad, globalI: tg.I, exact: toy.x.map((_, i) => S.exactCond(toy.x, tw, i)), globalExact: S.exactPerm(toy.x, tw) };
console.log(JSON.stringify(out));
