/* Núcleo espacial compartilhado (AEDE, I de Moran, LISA, SaTScan, GWR). Sem rede, sem dependências.
   Funciona no navegador (window.PPGCS.spatial) e no Node (module.exports) para os testes.
   Entrada geométrica: features GeoJSON (Polygon/MultiPolygon, lon/lat) de js/geo_al.js (NS.geo.features).
   Convenção: municípios na ordem do array de features (ordem do código IBGE); todas as listas por município usam esse índice. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.PPGCS = root.PPGCS || {}; root.PPGCS.spatial = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var S = {};

  /* ---------- aleatório reprodutível ---------- */
  /* mulberry32: devolve função que gera números em [0,1). */
  S.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /* Fisher-Yates in place: i de n-1 a 1, j = floor(rnd() * (i+1)). */
  S.shuffle = function (arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  S.normal = function (rnd) { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  /* ---------- geometria ---------- */
  /* Todos os anéis (exteriores e furos) de uma feature, como listas de [lon, lat]. */
  S.rings = function (f) {
    var g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates, out = [];
    polys.forEach(function (p) { p.forEach(function (r) { out.push(r); }); });
    return out;
  };
  function vkey(c) { return Math.round(c[0] * 1e4) + "," + Math.round(c[1] * 1e4); }

  /* Vizinhança por geometria. kind: "queen" (vértice ou aresta compartilhados) ou "rook" (aresta compartilhada).
     Devolve { kind, n, nb (listas ordenadas), deg, islands, meanDeg, pairs }. */
  S.neighbors = function (features, kind) {
    var n = features.length, map = Object.create(null), nbs = [], i;
    features.forEach(function (f, idx) {
      S.rings(f).forEach(function (r) {
        for (var k = 0; k < r.length - 1; k++) {
          var key;
          if (kind === "rook") { var a = vkey(r[k]), b = vkey(r[k + 1]); key = a < b ? a + "|" + b : b + "|" + a; }
          else key = vkey(r[k]);
          (map[key] = map[key] || []).push(idx);
        }
      });
    });
    var sets = []; for (i = 0; i < n; i++) sets.push(Object.create(null));
    Object.keys(map).forEach(function (k) {
      var l = map[k]; if (l.length < 2) return;
      for (var a = 0; a < l.length; a++) for (var b = 0; b < l.length; b++) if (l[a] !== l[b]) sets[l[a]][l[b]] = 1;
    });
    for (i = 0; i < n; i++) nbs.push(Object.keys(sets[i]).map(Number).sort(function (a, b) { return a - b; }));
    return S.describeNb(nbs, kind);
  };
  S.describeNb = function (nbs, kind) {
    var deg = nbs.map(function (l) { return l.length; }), tot = deg.reduce(function (a, b) { return a + b; }, 0);
    var islands = []; deg.forEach(function (d, i) { if (d === 0) islands.push(i); });
    return { kind: kind, n: nbs.length, nb: nbs, deg: deg, islands: islands, meanDeg: tot / nbs.length, pairs: tot / 2, links: tot,
      minDeg: Math.min.apply(null, deg), maxDeg: Math.max.apply(null, deg) };
  };

  /* Projeção equiretangular simples para SVG: x = (lon - lon0) * cos(lat0), y = -(lat - lat0).
     projector(features, largura, altura|0, margem) -> P com P.x(lon), P.y(lat), P.path(feature) (atributo d do SVG), P.centroid(i) (pixels), P.height. */
  S.projector = function (features, w, h, pad) {
    pad = pad == null ? 6 : pad;
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    features.forEach(function (f) { S.rings(f).forEach(function (r) { r.forEach(function (c) { if (c[0] < minx) minx = c[0]; if (c[0] > maxx) maxx = c[0]; if (c[1] < miny) miny = c[1]; if (c[1] > maxy) maxy = c[1]; }); }); });
    var lat0 = (miny + maxy) / 2, kx = Math.cos(lat0 * Math.PI / 180), gw = (maxx - minx) * kx, gh = maxy - miny;
    if (!h) h = gh * (w - 2 * pad) / gw + 2 * pad; /* sem altura: calcula pela proporção do estado */
    var sc = Math.min((w - 2 * pad) / gw, (h - 2 * pad) / gh);
    var ox = (w - gw * sc) / 2, oy = (h - gh * sc) / 2;
    var P = { w: w, h: h, scale: sc, kx: kx, lat0: lat0, bbox: [minx, miny, maxx, maxy] };
    P.x = function (lon) { return ox + (lon - minx) * kx * sc; };
    P.y = function (lat) { return oy + (maxy - lat) * sc; };
    P.height = gh * sc + 2 * oy;
    P.path = function (f) {
      var d = ""; S.rings(f).forEach(function (r) { r.forEach(function (c, k) { d += (k ? "L" : "M") + P.x(c[0]).toFixed(1) + " " + P.y(c[1]).toFixed(1); }); d += "Z"; });
      return d;
    };
    P.centroid = function (i) { var c = S.centroid(features[i]); return [P.x(c[0]), P.y(c[1])]; };
    return P;
  };
  /* Centroide (área-ponderado, anéis exteriores somam e furos subtraem), em lon/lat. Escala x por cos(lat) antes, como a projeção. */
  S.centroid = function (f) {
    var g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates, A = 0, cx = 0, cy = 0;
    var lat = 0, cnt = 0; polys.forEach(function (p) { p[0].forEach(function (c) { lat += c[1]; cnt++; }); });
    var kx = Math.cos(lat / cnt * Math.PI / 180);
    polys.forEach(function (p) {
      p.forEach(function (r, ri) {
        var a = 0, x = 0, y = 0;
        for (var k = 0; k < r.length - 1; k++) {
          var x0 = r[k][0] * kx, y0 = r[k][1], x1 = r[k + 1][0] * kx, y1 = r[k + 1][1], cr = x0 * y1 - x1 * y0;
          a += cr; x += (x0 + x1) * cr; y += (y0 + y1) * cr;
        }
        a /= 2; if (a === 0) return;
        var sg = ri === 0 ? 1 : -1, sa = Math.abs(a), Cx = x / (6 * a), Cy = y / (6 * a);
        A += sg * sa; cx += sg * sa * Cx; cy += sg * sa * Cy;
      });
    });
    return [cx / A / kx, cy / A];
  };
  /* k vizinhos mais próximos pela distância entre centroides (x escalado por cos(lat) médio). Assimétrica. */
  S.knn = function (features, k) {
    var c = features.map(S.centroid), lat = 0; c.forEach(function (p) { lat += p[1]; }); var kx = Math.cos(lat / c.length * Math.PI / 180);
    var nbs = c.map(function (p, i) {
      var d = c.map(function (q, j) { return [Math.hypot((p[0] - q[0]) * kx, p[1] - q[1]), j]; }).filter(function (e) { return e[1] !== i; });
      d.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      return d.slice(0, k).map(function (e) { return e[1]; }).sort(function (a, b) { return a - b; });
    });
    return S.describeNb(nbs, "knn" + k);
  };

  /* ---------- pesos, defasagem, I de Moran ---------- */
  /* W padronizada por linha (esparsa): w[i][t] = 1/k_i para cada vizinho; linha de ilha fica vazia (soma 0). */
  S.rowStd = function (nbs) {
    var nb = nbs.nb || nbs;
    return { n: nb.length, nb: nb, w: nb.map(function (l) { return l.map(function () { return 1 / l.length; }); }) };
  };
  /* Matriz binária (esparsa, pesos 1). */
  S.binary = function (nbs) { var nb = nbs.nb || nbs; return { n: nb.length, nb: nb, w: nb.map(function (l) { return l.map(function () { return 1; }); }) }; };
  S.sumW = function (W) { var s = 0; W.w.forEach(function (r) { r.forEach(function (v) { s += v; }); }); return s; };
  S.mean = function (x) { var s = 0; x.forEach(function (v) { s += v; }); return s / x.length; };
  S.sd = function (x) { var m = S.mean(x), s = 0; x.forEach(function (v) { s += (v - m) * (v - m); }); return Math.sqrt(s / (x.length - 1)); };
  /* Desvios da média (z = x - média) e escores padronizados (média 0, dp 1, dp amostral). */
  S.dev = function (x) { var m = S.mean(x); return x.map(function (v) { return v - m; }); };
  S.zscore = function (x) { var m = S.mean(x), s = S.sd(x); return x.map(function (v) { return (v - m) / s; }); };
  /* Defasagem espacial: (Wz)_i = soma_j w_ij z_j. */
  S.lag = function (z, W) { return W.nb.map(function (l, i) { var s = 0; for (var t = 0; t < l.length; t++) s += W.w[i][t] * z[l[t]]; return s; }); };
  /* I de Moran global. I = (n/S0) * soma_i z_i (Wz)_i / soma z_i². Devolve também z, Wz, S0 e E[I] = -1/(n-1). */
  S.moranI = function (x, W) {
    var n = x.length, z = S.dev(x), wz = S.lag(z, W), S0 = S.sumW(W), num = 0, den = 0;
    for (var i = 0; i < n; i++) { num += z[i] * wz[i]; den += z[i] * z[i]; }
    return { I: (n / S0) * num / den, EI: -1 / (n - 1), n: n, S0: S0, z: z, wz: wz, num: num, den: den };
  };
  /* Teste por permutação: embaralha x (Fisher-Yates, semente fixa), M réplicas; R = réplicas tão ou mais extremas
     (no lado de I observado em relação a E[I]); pseudo-p = (R + 1) / (M + 1). */
  S.permTest = function (x, W, M, seed) {
    var obs = S.moranI(x, W), rnd = S.rng(seed), v = x.slice(), sims = new Array(M), R = 0, upper = obs.I >= obs.EI;
    for (var r = 0; r < M; r++) {
      S.shuffle(v, rnd); var I = S.moranI(v, W).I; sims[r] = I;
      if (upper ? I >= obs.I : I <= obs.I) R++;
    }
    return { I: obs.I, EI: obs.EI, M: M, R: R, p: (R + 1) / (M + 1), sims: sims, upper: upper, seed: seed };
  };

  /* Teste exato por enumeração (só para n pequeno, até 8): percorre as n! permutações dos valores e conta as com I >= I observado
     (ou <= , se o observado estiver abaixo de E[I]). Devolve { total, count, p = count/total, I }. A permutação identidade conta como uma delas. */
  S.exactPerm = function (x, W) {
    var obs = S.moranI(x, W), n = x.length, a = x.slice(), total = 0, count = 0, upper = obs.I >= obs.EI, tol = 1e-12;
    (function rec(k) {
      if (k === n) { total++; var I = S.moranI(a, W).I; if (upper ? I >= obs.I - tol : I <= obs.I + tol) count++; return; }
      for (var i = k; i < n; i++) { var t = a[k]; a[k] = a[i]; a[i] = t; rec(k + 1); t = a[k]; a[k] = a[i]; a[i] = t; }
    })(0);
    return { I: obs.I, total: total, count: count, p: count / total, upper: upper };
  };
  /* Pseudo-p a partir de R e M, e rótulo de exibição: R = 0 nunca mostra p = 0. */
  S.pseudoP = function (R, M) { return (R + 1) / (M + 1); };

  /* ---------- classificação ---------- */
  /* Quantil linear (tipo 7, igual ao padrão do numpy). */
  S.quantile = function (sorted, p) { var h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]); };
  /* Pontos de corte dos k quantis (k-1 valores) e classe de cada valor: classe = nº de cortes estritamente menores que v. */
  S.quantileBreaks = function (x, k) { var s = x.slice().sort(function (a, b) { return a - b; }), b = []; for (var j = 1; j < k; j++) b.push(S.quantile(s, j / k)); return b; };
  S.classOf = function (v, breaks) { var c = 0; for (var j = 0; j < breaks.length; j++) if (v > breaks[j]) c++; return c; };
  /* Quadrante do diagrama de Moran: 0 alto-alto, 1 baixo-alto, 2 baixo-baixo, 3 alto-baixo (z >= 0 conta como alto). */
  S.QUAD = ["alto-alto", "baixo-alto", "baixo-baixo", "alto-baixo"];
  S.quadrant = function (z, wz) { return z >= 0 ? (wz >= 0 ? 0 : 3) : (wz >= 0 ? 1 : 2); };
  /* Inclinação da reta de mínimos quadrados de y sobre x (com intercepto). */
  S.slope = function (x, y) { var mx = S.mean(x), my = S.mean(y), a = 0, b = 0; for (var i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) * (x[i] - mx); } return a / b; };

  return S;
});
