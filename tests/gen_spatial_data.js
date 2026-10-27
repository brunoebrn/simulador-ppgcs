/* Gera js/spatial_data.js: valores FICTÍCIOS e fixos por município (semente fixa). Uso: node tests/gen_spatial_data.js [semente]
   Padrão espacial inventado: dois bolsões de cobertura baixa e uma região alta, mais ruído que cresce quando o denominador fictício é pequeno. */
const fs = require("fs"), path = require("path");
const S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
const SEED = +(process.argv[2] || 20261027), rnd = S.rng(SEED);
const bb = [1e9, 1e9, -1e9, -1e9]; const C = geo.map(S.centroid);
C.forEach(c => { bb[0] = Math.min(bb[0], c[0]); bb[1] = Math.min(bb[1], c[1]); bb[2] = Math.max(bb[2], c[0]); bb[3] = Math.max(bb[3], c[1]); });
const gauss = (u, v, cu, cv, s) => Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / (2 * s * s));
const nasc = [], cob = [], ab = [];
C.forEach((c, i) => {
  const u = (c[0] - bb[0]) / (bb[2] - bb[0]), v = (c[1] - bb[1]) / (bb[3] - bb[1]);
  const n = Math.round(Math.min(14000, Math.max(70, Math.exp(6.9 + 0.95 * S.normal(rnd)))));
  const campo = -20 * gauss(u, v, 0.30, 0.55, 0.14) - 11 * gauss(u, v, 0.72, 0.18, 0.12) + 8 * gauss(u, v, 0.70, 0.68, 0.12);
  const dp = 2.2 + 6 * Math.sqrt(500 / n);
  let cv = 93 + campo + dp * S.normal(rnd);
  cv = Math.min(128, Math.max(38, cv));
  let a = 6.5 - 0.22 * (cv - 93) + 0.5 * campo * -0.3 + (1.2 + 3 * Math.sqrt(500 / n)) * S.normal(rnd) * 0.8;
  a = Math.max(-4, Math.min(30, a));
  nasc.push(n); cob.push(Math.round(cv * 10) / 10); ab.push(Math.round(a * 10) / 10);
});
const out = `/* Dados FICTÍCIOS e fixos por município de Alagoas (valores sorteados por semente fixa, sem relação com os municípios reais).
   Gerado por tests/gen_spatial_data.js (semente ${SEED}). Ordem = ordem de js/geo_al.js (código IBGE crescente).
   nasc = nascidos vivos fictícios (denominador); cob = cobertura vacinal fictícia (%); aband = taxa de abandono fictícia (%). */
(function () { var NS = (window.PPGCS = window.PPGCS || {});
NS.spatial_data = { semente: ${SEED}, codigos: ${JSON.stringify(geo.map(f => f.properties.c))},
nasc: ${JSON.stringify(nasc)},
cob: ${JSON.stringify(cob)},
aband: ${JSON.stringify(ab)} };
})();
`;
fs.writeFileSync(path.join(__dirname, "../js/spatial_data.js"), out);
const W = S.rowStd(S.neighbors(geo, "queen")), r = S.moranI(cob, W), ra = S.moranI(ab, W);
console.log("I cob", r.I.toFixed(3), "I aband", ra.I.toFixed(3), "pequenos (<1000):", nasc.filter(x => x < 1000).length, "min/max cob", Math.min(...cob), Math.max(...cob), ">100:", cob.filter(x => x > 100).length, "ab neg", ab.filter(x => x < 0).length);
