/* Gera os resultados do motor JS do I de Moran global em JSON, para comparação com tests/check_moran.py */
const fs = require("fs"), path = require("path"), S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
global.window = { PPGCS: {} }; eval(fs.readFileSync(path.join(__dirname, "../js/spatial_data.js"), "utf8"));
const D = window.PPGCS.spatial_data, SEED = 2026;
const nbs = { queen: S.neighbors(geo, "queen"), rook: S.neighbors(geo, "rook"), knn5: S.knn(geo, 5) };
const out = { codigos: geo.map(f => f.properties.c), seed: SEED, vars: {}, nb: {}, toy: {}, grid: [] };
for (const k in nbs) out.nb[k] = nbs[k].nb;
for (const v of ["cob", "aband", "ruido"]) {
  const x = D[v], o = { x, kinds: {} };
  for (const k in nbs) {
    const W = S.rowStd(nbs[k]), m = S.moranI(x, W), e = { I: m.I, EI: m.EI, S0: m.S0, num: m.num, den: m.den, contribSum: m.z.reduce((a, z, i) => a + z * m.wz[i], 0) * m.n / m.S0 / m.den, perm: {} };
    for (const M of (k === "queen" ? [99, 999, 9999] : [999])) {
      const p = S.permTest(x, W, M, SEED), s = p.sims.slice().sort((a, b) => a - b);
      e.perm[M] = { R: p.R, p: p.p, upper: p.upper, sims: p.sims, q025: S.quantile(s, 0.025), q975: S.quantile(s, 0.975) };
    }
    o.kinds[k] = e;
  }
  out.vars[v] = o;
}
const toy = { x: [95, 92, 90, 80, 72, 70], nb: [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]] }, tw = S.rowStd(toy.nb), tm = S.moranI(toy.x, tw), ex = S.exactPerm(toy.x, tw);
out.toy = { x: toy.x, nb: toy.nb, I: tm.I, EI: tm.EI, z: tm.z, wz: tm.wz, num: tm.num, den: tm.den, S0: tm.S0, prod: tm.z.map((z, i) => z * tm.wz[i]), exact: ex };
const nb = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const l = []; if (r > 0) l.push((r - 1) * 6 + c); if (c > 0) l.push(r * 6 + c - 1); if (c < 5) l.push(r * 6 + c + 1); if (r < 5) l.push((r + 1) * 6 + c); nb.push(l.sort((a, b) => a - b)); }
const GW = S.rowStd(nb), blk = [], chk = []; for (let i = 0; i < 36; i++) { blk.push(i % 6 < 3 ? 1 : 0); chk.push((Math.floor(i / 6) + i % 6) % 2); }
const rnd = blk.slice(); S.shuffle(rnd, S.rng(46));
out.grid = [["Agrupado", blk], ["Ao acaso", rnd], ["Alternado", chk]].map(([t, v]) => ({ t, v, I: S.moranI(v, GW).I }));
console.log(JSON.stringify(out));
