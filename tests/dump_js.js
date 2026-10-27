/* Gera os resultados do motor JS em JSON, para comparação com tests/check_joinpoint.py */
const S = require("../js/stats.js"), D = require("../js/data.js");
const out = { serie5: {}, serie25: {}, perm: [] };
const opts = { fim: 2, entre: 2 };

function dump(name, ser, kmax) {
  const y = Float64Array.from(ser.cob.map(v => Math.log(v / 100)));
  out[name].fits = [];
  for (let k = 0; k <= kmax; k++) {
    const f = S.bestFit(y, k, opts);
    if (!f) continue;
    out[name].fits.push({ k, taus: f.taus, sse: f.sse, beta: Array.from(f.beta), nConfigs: f.nConfigs });
    if (f.taus.length > 0 || k === 0) {
      const s = S.summarize(ser.cob, ser.anos, f);
      out[name]["sum" + k] = {
        apc: s.segs.map(g => g.apc), se: s.segs.map(g => g.se), p: s.segs.map(g => g.p),
        lo: s.segs.map(g => g.lo), hi: s.segs.map(g => g.hi), aapc: s.aapc, df: s.inf.df, nStar: s.inf.nStar
      };
    }
  }
}
dump("serie5", D.serie5, 1);
dump("serie25", D.serie25, 3);

/* Testes de permutação: guarda as primeiras T e a contagem acima do observado */
const y25 = Float64Array.from(D.serie25.cob.map(v => Math.log(v / 100)));
[[0, 1, 11], [1, 2, 12], [0, 2, 13]].forEach(([ka, kb, seed]) => {
  const pt = new S.PermTest(y25, ka, kb, Object.assign({ seed }, opts));
  pt.run(200);
  out.perm.push({ ka, kb, seed, T: pt.T, Ts: pt.Ts.slice(0, 200), exceed: pt.exceed });
});
process.stdout.write(JSON.stringify(out));
