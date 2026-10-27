/* Motor do método Indicadores: dados 100% fictícios e fórmulas (PDF seção 3.3; S5y; S5r).
 * Browser: window.PPGCS.ind. Node: module.exports (usado em tests/dump_indicadores.js). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.PPGCS = root.PPGCS || {}; root.PPGCS.ind = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var META = 95, LIM110 = 110, LIM120 = 120, LIM50 = 50, PEQ = 1000;
  /* nv = nascidos vivos (denominador), d1 = 1ª dose, d3 = 3ª dose (dose final do esquema). Municípios inventados. */
  var municipios = [
    { nome: "Município A", nv: 2400, d1: 2350, d3: 2300 },
    { nome: "Município B", nv: 1800, d1: 1790, d3: 1700 },
    { nome: "Município C", nv: 950, d1: 1010, d3: 980 },
    { nome: "Município D", nv: 600, d1: 560, d3: 500 },
    { nome: "Município E", nv: 310, d1: 400, d3: 395 },
    { nome: "Município F", nv: 5200, d1: 5300, d3: 5150 },
    { nome: "Município G", nv: 120, d1: 150, d3: 155 },
    { nome: "Município H", nv: 700, d1: 640, d3: 600 },
    { nome: "Município I", nv: 1500, d1: 1480, d3: 1425 },
    { nome: "Município J", nv: 45, d1: 43, d3: 41 }
  ];
  function cv(doses, nv) { return doses * 100 / nv; }
  function ta(d1, d3) { return (d1 - d3) * 100 / d1; }
  function atinge(doses, nv) { return doses * 100 >= META * nv; } /* comparação em inteiros: 95,0 conta (≥) */
  function classeTA(x) { return x < 0 ? "negativa" : x < 5 ? "baixa" : x < 10 ? "média" : "alta"; } /* faixas 5 e 10: SECUNDÁRIO */
  function linha(m) {
    var c = cv(m.d3, m.nv), t = ta(m.d1, m.d3);
    return { nome: m.nome, nv: m.nv, d1: m.d1, d3: m.d3, cv: c, ta: t, classeTA: classeTA(t), atinge: atinge(m.d3, m.nv),
      gt100: c > 100, gt110: c > LIM110, gt120: c > LIM120, lt50: c < LIM50, pequeno: m.nv < PEQ };
  }
  function tudo(ms) {
    var L = (ms || municipios).map(linha), n = L.length, ok = L.filter(function (x) { return x.atinge; }).length;
    var acima = L.filter(function (x) { return x.gt120; }), valid = L.filter(function (x) { return !x.gt120; });
    var okValid = valid.filter(function (x) { return x.atinge; }).length;
    return { linhas: L, n: n, nAtinge: ok, homog: 100 * ok / n,
      sensSup: 100 * ok / n, sensInf: valid.length ? 100 * okValid / valid.length : null, nAcima120: acima.length, nValidos: valid.length, nAtingeValidos: okValid,
      nGt100: L.filter(function (x) { return x.gt100; }).length, nGt110: L.filter(function (x) { return x.gt110; }).length, nLt50: L.filter(function (x) { return x.lt50; }).length,
      nPequenos: L.filter(function (x) { return x.pequeno; }).length, nNegTA: L.filter(function (x) { return x.ta < 0; }).length };
  }
  return { META: META, PEQ: PEQ, municipios: municipios, cv: cv, ta: ta, atinge: atinge, classeTA: classeTA, linha: linha, tudo: tudo };
});
