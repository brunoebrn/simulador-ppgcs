/* Gera js/spatial_data.js: valores FICTÍCIOS e fixos por município (semente fixa). Uso: node tests/gen_spatial_data.js [semente]
   Padrão espacial inventado: dois bolsões de cobertura baixa e uma região alta, mais ruído que cresce quando o denominador fictício é pequeno. */
const fs = require("fs"), path = require("path");
const S = require("../js/spatial_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
const SEED = +(process.argv[2] || 20261027), rnd = S.rng(SEED);
const bb = [1e9, 1e9, -1e9, -1e9]; const C = geo.map(S.centroid);
C.forEach(c => { bb[0] = Math.min(bb[0], c[0]); bb[1] = Math.min(bb[1], c[1]); bb[2] = Math.max(bb[2], c[0]); bb[3] = Math.max(bb[3], c[1]); });
const gauss = (u, v, cu, cv, s) => Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / (2 * s * s));
const nasc = [], cob = [], ab = [], ruido = [], rnd2 = S.rng(SEED + 7);
C.forEach((c, i) => {
  const u = (c[0] - bb[0]) / (bb[2] - bb[0]), v = (c[1] - bb[1]) / (bb[3] - bb[1]);
  const n = Math.round(Math.min(14000, Math.max(70, Math.exp(6.9 + 0.95 * S.normal(rnd)))));
  const campo = -20 * gauss(u, v, 0.30, 0.55, 0.14) - 11 * gauss(u, v, 0.72, 0.18, 0.12) + 8 * gauss(u, v, 0.70, 0.68, 0.12);
  const dp = 2.2 + 6 * Math.sqrt(500 / n);
  let cv = 93 + campo + dp * S.normal(rnd);
  cv = Math.min(128, Math.max(38, cv));
  let a = 6.5 - 0.22 * (cv - 93) + 0.5 * campo * -0.3 + (1.2 + 3 * Math.sqrt(500 / n)) * S.normal(rnd) * 0.8;
  a = Math.max(-4, Math.min(30, a));
  ruido.push(Math.round((90 + 9 * S.normal(rnd2)) * 10) / 10);
  nasc.push(n); cob.push(Math.round(cv * 10) / 10); ab.push(Math.round(a * 10) / 10);
});

/* Bloco do método 7 (VIF, OLS e GWR): explicativas e resposta FICTÍCIAS, geradas por um sorteio à parte (semente SEED + 31), sem tocar nas séries acima.
   Um fator latente "desenvolvimento" (campo espacial suave + ruído) alimenta IDHM, IVS e renda, que ficam deliberadamente correlacionados.
   Analfabetismo e cobertura da ESF têm campos próprios. A resposta "cobertura" tem efeito da ESF que varia no espaço: forte no oeste, fraco no leste. */
const rg = S.rng(SEED + 31), z = a => { const m = S.mean(a), s = S.sd(a); return a.map(v => (v - m) / s); };
const UV = C.map(c => [(c[0] - bb[0]) / (bb[2] - bb[0]), (c[1] - bb[1]) / (bb[3] - bb[1])]);
const fld = (cs) => UV.map(([u, v]) => cs.reduce((a, [cu, cv, s, w]) => a + w * gauss(u, v, cu, cv, s), 0));
const campoL = fld([[0.80, 0.45, 0.22, 1.2], [0.20, 0.50, 0.25, -0.9], [0.55, 0.85, 0.20, 0.5]]);
const campoA = fld([[0.25, 0.30, 0.20, 1.0], [0.75, 0.75, 0.20, -0.6]]);
const campoE = fld([[0.50, 0.70, 0.22, 1.0], [0.85, 0.20, 0.20, -0.8]]);
const zL = z(campoL.map(v => v + 0.6 * S.normal(rg))), zA = z(campoA.map(v => v + 0.7 * S.normal(rg))), zE = z(campoE.map(v => v + 0.45 * S.normal(rg)));
const e = () => S.normal(rg);
const idhm = zL.map(v => 0.640 + 0.045 * v + 0.016 * e()), ivs = zL.map(v => 0.360 - 0.050 * v + 0.017 * e()), renda = zL.map(v => 620 + 190 * v + 70 * e());
const analf = zL.map((v, i) => Math.min(40, Math.max(3, 17 - 1.5 * v + 3.0 * zA[i]))), esf = zE.map(v => Math.min(100, Math.max(35, 82 + 11 * v)));
const zid = z(idhm), zan = z(analf), zes = z(esf);
const regiao = fld([[0.30, 0.25, 0.22, 10.0], [0.65, 0.75, 0.20, -9.0]]); /* efeito regional não medido (variável omitida): faz os resíduos do OLS terem padrão no mapa */
const cobert = UV.map(([u], i) => Math.min(125, Math.max(45, 90 + regiao[i] + 2.0 * zid[i] - 1.6 * zan[i] + (7.0 * (1 - u) + 0.3 * u) * zes[i] + 1.8 * e())));
const r1 = a => a.map(v => Math.round(v * 10) / 10), r3 = a => a.map(v => Math.round(v * 1000) / 1000);
const gwrD = { idhm: r3(idhm), ivs: r3(ivs), analf: r1(analf), renda: renda.map(v => Math.round(v)), esf: r1(esf), cobertura: r1(cobert) };
const out = `/* Dados FICTÍCIOS e fixos por município de Alagoas (valores sorteados por semente fixa, sem relação com os municípios reais).
   Gerado por tests/gen_spatial_data.js (semente ${SEED}). Ordem = ordem de js/geo_al.js (código IBGE crescente).
   nasc = nascidos vivos fictícios (denominador); cob = cobertura vacinal fictícia (%); aband = taxa de abandono fictícia (%);
   ruido = índice fictício SEM padrão espacial (sorteio independente por município, gerador próprio), usado para mostrar um caso sem autocorrelação.
   gwr = método 7 (VIF, OLS e GWR): idhm, ivs, analf (%), renda (R$), esf (%) e a resposta fictícia cobertura (%), com efeito da ESF variando no espaço (sorteio à parte, semente + 31). */
(function () { var NS = (window.PPGCS = window.PPGCS || {});
NS.spatial_data = { semente: ${SEED}, codigos: ${JSON.stringify(geo.map(f => f.properties.c))},
nasc: ${JSON.stringify(nasc)},
cob: ${JSON.stringify(cob)},
aband: ${JSON.stringify(ab)},
ruido: ${JSON.stringify(ruido)},
gwr: ${JSON.stringify(gwrD)} };
})();
`;
fs.writeFileSync(path.join(__dirname, "../js/spatial_data.js"), out);
const W = S.rowStd(S.neighbors(geo, "queen")), r = S.moranI(cob, W), ra = S.moranI(ab, W);
console.log("I cob", r.I.toFixed(3), "I aband", ra.I.toFixed(3), "pequenos (<1000):", nasc.filter(x => x < 1000).length, "min/max cob", Math.min(...cob), Math.max(...cob), ">100:", cob.filter(x => x > 100).length, "ab neg", ab.filter(x => x < 0).length);
