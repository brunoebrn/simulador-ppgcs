/* Motor estatístico do simulador (JavaScript puro, sem dependências).
 * Funciona no navegador (window.PPGCS.stats) e no Node (module.exports).
 * Fonte metodológica: fichamento S5ab (Help System do Joinpoint, NCI).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.PPGCS = root.PPGCS || {}; root.PPGCS.stats = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Gerador pseudoaleatório reproduzível (mulberry32) ---------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Fisher-Yates in situ, mesmo algoritmo portado no teste em Python */
  function shuffleInPlace(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- Distribuição t (para p-valor e IC do APC) ---------- */
  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    var MAXIT = 300, EPS = 3e-15, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; var del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function tCdf(t, df) {
    var x = df / (df + t * t);
    var p = 0.5 * betai(df / 2, 0.5, x);
    return t > 0 ? 1 - p : p;
  }
  function tQuantile(p, df) { /* bisseção, precisão ~1e-12 */
    var lo = -1e3, hi = 1e3;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      if (tCdf(mid, df) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- Álgebra mínima: QR por Gram-Schmidt modificado ---------- */
  function qrColumns(cols, n) { /* cols: array de Float64Array(n); devolve Q (colunas) e R */
    var p = cols.length, Q = [], R = [];
    for (var j = 0; j < p; j++) {
      var v = Float64Array.from(cols[j]);
      R.push(new Float64Array(p));
      for (var i = 0; i < j; i++) {
        var d = 0; for (var k = 0; k < n; k++) d += Q[i][k] * v[k];
        R[i][j] = d; for (k = 0; k < n; k++) v[k] -= d * Q[i][k];
      }
      /* segunda passada de reortogonalização (estabilidade) */
      for (i = 0; i < j; i++) {
        d = 0; for (k = 0; k < n; k++) d += Q[i][k] * v[k];
        R[i][j] += d; for (k = 0; k < n; k++) v[k] -= d * Q[i][k];
      }
      var nr = 0; for (k = 0; k < n; k++) nr += v[k] * v[k]; nr = Math.sqrt(nr);
      R[j][j] = nr; for (k = 0; k < n; k++) v[k] /= nr;
      Q.push(v);
    }
    return { Q: Q, R: R };
  }
  function backSolve(R, z) {
    var p = z.length, b = new Float64Array(p);
    for (var i = p - 1; i >= 0; i--) {
      var s = z[i]; for (var j = i + 1; j < p; j++) s -= R[i][j] * b[j];
      b[i] = s / R[i][i];
    }
    return b;
  }

  /* ---------- Modelo Joinpoint log-linear contínuo ---------- */
  /* x = índice 0..n-1 (anos consecutivos). Colunas: 1, x, (x - tau_j)+ */
  function designCols(n, taus) {
    var cols = [], c0 = new Float64Array(n), c1 = new Float64Array(n), i, j;
    for (i = 0; i < n; i++) { c0[i] = 1; c1[i] = i; }
    cols.push(c0, c1);
    for (j = 0; j < taus.length; j++) {
      var c = new Float64Array(n);
      for (i = 0; i < n; i++) c[i] = Math.max(0, i - taus[j]);
      cols.push(c);
    }
    return cols;
  }

  /* Posições permitidas: nunca a menos de `fim` pontos das pontas e com pelo menos
   * `entre` pontos entre dois joinpoints (S5ab afirmações 44 e 49; interpretação a
   * confirmar no software: ver método Joinpoint, seção de limites). */
  function enumerateTaus(n, k, fim, entre) {
    var out = [];
    if (k === 0) return [[]];
    var gap = entre + 1;
    (function rec(start, left, acc) {
      if (left === 0) { out.push(acc.slice()); return; }
      var maxPos = n - 1 - fim - (left - 1) * gap;
      for (var p = start; p <= maxPos; p++) { acc.push(p); rec(p + gap, left - 1, acc); acc.pop(); }
    })(fim, k, []);
    return out;
  }

  var cache = {};
  function configs(n, k, fim, entre) {
    var key = n + "|" + k + "|" + fim + "|" + entre;
    if (cache[key]) return cache[key];
    var list = enumerateTaus(n, k, fim, entre).map(function (taus) {
      var qr = qrColumns(designCols(n, taus), n);
      return { taus: taus, Q: qr.Q, R: qr.R };
    });
    cache[key] = list; return list;
  }

  function sseFromQ(Q, y, yy) {
    var s = 0;
    for (var j = 0; j < Q.length; j++) {
      var d = 0, q = Q[j]; for (var i = 0; i < y.length; i++) d += q[i] * y[i];
      s += d * d;
    }
    return yy - s;
  }

  /* Busca em grade: melhor configuração de k joinpoints (menor SSE) */
  function bestFit(y, k, opts) {
    opts = opts || {};
    var n = y.length, list = configs(n, k, opts.fim == null ? 2 : opts.fim, opts.entre == null ? 2 : opts.entre);
    var yy = 0; for (var i = 0; i < n; i++) yy += y[i] * y[i];
    var best = null, bestSSE = Infinity, all = [];
    for (var c = 0; c < list.length; c++) {
      var s = sseFromQ(list[c].Q, y, yy);
      if (opts.collect) all.push({ taus: list[c].taus, sse: s });
      if (s < bestSSE - 1e-15) { bestSSE = s; best = list[c]; }
    }
    if (!best) return null;
    var z = new Float64Array(best.Q.length);
    for (var j = 0; j < best.Q.length; j++) { var d = 0; for (i = 0; i < n; i++) d += best.Q[j][i] * y[i]; z[j] = d; }
    var beta = backSolve(best.R, z);
    var cols = designCols(n, best.taus), fitted = new Float64Array(n);
    for (i = 0; i < n; i++) { var f = 0; for (j = 0; j < beta.length; j++) f += beta[j] * cols[j][i]; fitted[i] = f; }
    var res = new Float64Array(n); for (i = 0; i < n; i++) res[i] = y[i] - fitted[i];
    return { k: k, taus: best.taus.slice(), sse: bestSSE, beta: beta, fitted: fitted, resid: res, nConfigs: list.length, all: all };
  }

  /* Ajuste com posições de dobra dadas (usado para mostrar cada candidato da busca em grade) */
  function fitAt(y, taus) {
    var n = y.length, qr = qrColumns(designCols(n, taus), n), z = new Float64Array(qr.Q.length), i, j, d;
    for (j = 0; j < qr.Q.length; j++) { d = 0; for (i = 0; i < n; i++) d += qr.Q[j][i] * y[i]; z[j] = d; }
    var beta = backSolve(qr.R, z), cols = designCols(n, taus), fitted = new Float64Array(n), sse = 0;
    for (i = 0; i < n; i++) { var f = 0; for (j = 0; j < beta.length; j++) f += beta[j] * cols[j][i]; fitted[i] = f; sse += (y[i] - f) * (y[i] - f); }
    return { taus: taus.slice(), beta: beta, fitted: fitted, sse: sse };
  }

  /* Inclinações por segmento (em escala log) a partir dos coeficientes contínuos */
  function segmentSlopes(beta, taus) {
    var s = [beta[1]], acc = beta[1];
    for (var j = 0; j < taus.length; j++) { acc += beta[2 + j]; s.push(acc); }
    return s;
  }

  /* Variância/EP das inclinações por MQ não restrito, condicionado aos joinpoints,
   * com as observações sobre os joinpoints removidas (S5ab afirmações 54 e 55). */
  function slopeInference(y, taus, alpha) {
    var n = y.length, k = taus.length, bounds = [0].concat(taus, [n - 1]);
    var segs = [], nStar = 0, sse = 0, i;
    for (var s = 0; s <= k; s++) {
      var a = bounds[s], b = bounds[s + 1], idx = [];
      for (i = a; i <= b; i++) {
        if (taus.indexOf(i) >= 0) continue;
        idx.push(i);
      }
      segs.push(idx); nStar += idx.length;
    }
    var df = nStar - 2 * (k + 1);
    var out = { nStar: nStar, df: df, segs: [], ok: df > 0 };
    var parts = segs.map(function (idx) {
      var m = idx.length, mx = 0, my = 0, j;
      if (m < 2) return { m: m, ok: false };
      for (j = 0; j < m; j++) { mx += idx[j]; my += y[idx[j]]; } mx /= m; my /= m;
      var sxx = 0, sxy = 0; for (j = 0; j < m; j++) { sxx += (idx[j] - mx) * (idx[j] - mx); sxy += (idx[j] - mx) * (y[idx[j]] - my); }
      var sl = sxy / sxx, ic = my - sl * mx, ss = 0;
      for (j = 0; j < m; j++) { var r = y[idx[j]] - (ic + sl * idx[j]); ss += r * r; }
      return { m: m, ok: true, sxx: sxx, ss: ss, slope: sl };
    });
    parts.forEach(function (p) { if (p.ok) sse += p.ss; });
    out.sseUnrestricted = sse;
    if (df > 0) {
      var sigma2 = sse / df, tcrit = tQuantile(1 - alpha / 2, df);
      out.sigma2 = sigma2; out.tcrit = tcrit;
      out.se = parts.map(function (p) { return p.ok ? Math.sqrt(sigma2 / p.sxx) : NaN; });
    } else { out.se = parts.map(function () { return NaN; }); }
    out.parts = parts; return out;
  }

  /* Resumo do modelo ajustado: APC por segmento, p (teste t), IC, AAPC */
  function summarize(yPct, years, fit, alpha) {
    alpha = alpha == null ? 0.05 : alpha;
    var n = yPct.length, k = fit.taus.length;
    var ylog = yPct.map(function (v) { return Math.log(v / 100); });
    var slopes = segmentSlopes(fit.beta, fit.taus);
    var inf = slopeInference(Float64Array.from(ylog), fit.taus, alpha);
    var bounds = [0].concat(fit.taus, [n - 1]);
    var segs = slopes.map(function (b, s) {
      var apc = (Math.exp(b) - 1) * 100, o = {
        de: years[bounds[s]], ate: years[bounds[s + 1]], slope: b, apc: apc, length: bounds[s + 1] - bounds[s],
        se: inf.se[s], t: NaN, p: NaN, lo: NaN, hi: NaN
      };
      if (inf.ok && isFinite(inf.se[s])) {
        var ts = inf.parts[s].slope / inf.se[s]; /* teste t usa a inclinação do MQ não restrito (S5ab afirmação 54) */
        o.slopeUnr = inf.parts[s].slope;
        o.t = ts; o.p = 2 * (1 - tCdf(Math.abs(ts), inf.df));
        o.lo = (Math.exp(inf.parts[s].slope - inf.se[s] * inf.tcrit) - 1) * 100;
        o.hi = (Math.exp(inf.parts[s].slope + inf.se[s] * inf.tcrit) - 1) * 100;
      }
      return o;
    });
    /* AAPC no intervalo completo: média das inclinações ponderada pelo comprimento do segmento */
    var wsum = 0, wb = 0; segs.forEach(function (sg) { wsum += sg.length; wb += sg.length * sg.slope; });
    var aapc = (Math.exp(wb / wsum) - 1) * 100, aapcCI = null;
    if (inf.ok && segs.every(function (sg) { return isFinite(sg.se); })) {
      var v = 0; segs.forEach(function (sg) { var w = sg.length / wsum; v += w * w * sg.se * sg.se; });
      var z = tQuantile(0.5 + (1 - alpha) / 2, 1e6), c = Math.log(aapc / 100 + 1), sd = Math.sqrt(v);
      aapcCI = { lo: (Math.exp(c - z * sd) - 1) * 100, hi: (Math.exp(c + z * sd) - 1) * 100, sd: sd };
    }
    return { segs: segs, aapc: aapc, aapcCI: aapcCI, inf: inf, years: years, taus: fit.taus.slice() };
  }

  /* Alfa por teste (v3.0 em diante): alfa/(MAX - ka) (S5ab afirmação 30) */
  function levelPerTest(alpha, max, ka) { return alpha / (max - ka); }

  /* ---------- Teste de permutação de resíduos, um teste ka x kb ---------- */
  function PermTest(y, ka, kb, opts) {
    opts = opts || {};
    this.y = Float64Array.from(y); this.n = y.length; this.ka = ka; this.kb = kb; this.opts = opts;
    this.seed = opts.seed == null ? 2026 : opts.seed;
    this.rng = mulberry32(this.seed);
    this.fa = bestFit(this.y, ka, opts); this.fb = bestFit(this.y, kb, opts);
    this.T = this.fa.sse / this.fb.sse;
    this.Ts = []; this.exceed = 0;
    this.base = Float64Array.from(this.fa.fitted);
    this.pool = Float64Array.from(this.fa.resid);
    this.buf = new Float64Array(this.n);
  }
  PermTest.prototype.step = function () {
    var n = this.n, i;
    shuffleInPlace(this.pool, this.rng);
    for (i = 0; i < n; i++) this.buf[i] = this.base[i] + this.pool[i];
    var a = bestFit(this.buf, this.ka, this.opts), b = bestFit(this.buf, this.kb, this.opts);
    var T = a.sse / b.sse;
    this.Ts.push(T); if (T >= this.T) this.exceed++;
    return { T: T, series: this.buf, fa: a, fb: b };
  };
  PermTest.prototype.run = function (m) { for (var i = 0; i < m; i++) this.step(); return this; };
  PermTest.prototype.pValue = function () { return this.Ts.length ? this.exceed / this.Ts.length : NaN; };

  /* ---------- Sequência completa de testes (S5ab afirmação 17 e 30) ---------- */
  function selectModel(y, opts) {
    opts = opts || {};
    var alpha = opts.alpha == null ? 0.05 : opts.alpha, min = opts.min || 0, max = opts.max, nPerm = opts.nPerm || 1000;
    var ka = min, kb = max, tests = [], seedBase = opts.seed == null ? 2026 : opts.seed, idx = 0;
    while (ka < kb) {
      var pt = new PermTest(y, ka, kb, { seed: seedBase + idx, fim: opts.fim, entre: opts.entre });
      pt.run(nPerm);
      var lvl = levelPerTest(alpha, max, ka), p = pt.pValue(), rej = p < lvl;
      tests.push({ ka: ka, kb: kb, T: pt.T, sseN: pt.fa.sse, sseA: pt.fb.sse, p: p, level: lvl, reject: rej, nPerm: nPerm });
      if (rej) ka++; else kb--;
      idx++;
    }
    return { k: ka, tests: tests };
  }

  return {
    mulberry32: mulberry32, shuffleInPlace: shuffleInPlace, tCdf: tCdf, tQuantile: tQuantile,
    enumerateTaus: enumerateTaus, configs: configs, bestFit: bestFit, fitAt: fitAt, segmentSlopes: segmentSlopes,
    slopeInference: slopeInference, summarize: summarize, levelPerTest: levelPerTest,
    PermTest: PermTest, selectModel: selectModel
  };
});
