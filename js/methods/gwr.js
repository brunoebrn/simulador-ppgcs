/* Método 7: VIF, OLS e GWR (regressão geograficamente ponderada).
   Núcleo numérico em js/spatial_core.js (S.vifs, S.ols, S.inv, S.gwr, S.gwrCurve, S.aicc, S.normCrit, S.permTest); mapa em js/charts.js (NS.charts.mapa).
   Geometria real dos 102 municípios de Alagoas (IBGE 2025); VALORES 100% fictícios (js/spatial_data.js, bloco gwr), sem relação com os municípios reais. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var S = NS.spatial, C = NS.charts, clock = NS.clock, fmt = C.fmt, el = C.el;
  var G = NS.geo.features, D = NS.spatial_data, N = G.length, SEED = 2026, ALPHA = 0.05, KMIN = 20;
  var NAMES = G.map(function (f) { return f.properties.n; });
  var Y = D.gwr.cobertura, PL = S.planar(G), ORD = S.scanOrder(PL), WQ = S.rowStd(S.neighbors(G, "queen"));
  var MODS = { 3: ["idhm", "analf", "esf"], 5: ["idhm", "ivs", "analf", "renda", "esf"] };
  var LAB = { idhm: "IDHM", ivs: "IVS", analf: "Analfabetismo", renda: "Renda", esf: "Cobertura da ESF" };
  var UNI = { idhm: "índice", ivs: "índice", analf: "%", renda: "R$", esf: "%" };
  var cache = {};

  function f0(x) { return fmt(x, 0); } function f1(x) { return fmt(x, 1); } function f2(x) { return fmt(x, 2); } function f3(x) { return fmt(x, 3); } function f4(x) { return fmt(x, 4); }
  function sci(x) { var s = x.toExponential(1).replace(".", ","); return s.replace("-", "−"); }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function aviso(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Valores sorteados, sem relação com os municípios reais. Só o desenho dos municípios é real. A cobertura e as explicativas são fictícias."; stage.appendChild(p); }
  function avisoToy(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Seis municípios inventados para treinar a conta, sem relação com lugares reais."; stage.appendChild(p); }
  function legend(items) { var d = document.createElement("div"); d.className = "legend"; d.innerHTML = items.map(function (i) { return "<span><i class='sq " + i[0] + "'></i>" + i[1] + "</span>"; }).join(""); return d; }
  function info(stage) { var p = document.createElement("p"); p.className = "sum"; p.setAttribute("aria-live", "polite"); p.style.margin = "4px 6px"; stage.appendChild(p); return p; }
  function setCls(m, i, c) { m.paths[i].setAttribute("class", c); }
  function mapa(parent, o) { return C.mapa(parent, o); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function pc(x, d) { return fmt(100 * x, d == null ? 1 : d) + "%"; }
  function tbl(head, rows) { return "<div class=tbl-wrap><table><tr>" + head.map(function (h) { return "<th" + (h[1] ? " class=num" : "") + ">" + h[0] + "</th>"; }).join("") + "</tr>" + rows.join("") + "</table></div>"; }
  function td(x, num) { return "<td" + (num ? " class=num" : "") + ">" + x + "</td>"; }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return S.quantile(s, 0.5); }
  function zs(a) { return S.zscore(a); }

  /* ---------- modelos (3 ou 5 explicativas), calculados uma vez ---------- */
  function MD(m) {
    var key = "m" + m; if (cache[key]) return cache[key];
    var keys = MODS[m], cols = keys.map(function (k) { return zs(D.gwr[k]); }), X = S.design(cols), ols = S.ols(X, Y), q = X[0].length;
    var vif = S.vifs(cols), perm = {}, curve = S.gwrCurve(X, Y, ORD, KMIN, N), kb = curve.best.k;
    var md = { m: m, keys: keys, cols: cols, X: X, q: q, ols: ols, vif: vif, perm: perm, curve: curve, kb: kb, aiccOls: S.aicc(ols.rss, N, q), gw: {}, nTests: N * q };
    md.crit0 = S.normCrit(ALPHA); md.critB = S.normCrit(ALPHA / md.nTests);
    return (cache[key] = md);
  }
  function PERM(m, M) { var md = MD(m), k = "M" + M; return md.perm[k] || (md.perm[k] = S.permTest(md.ols.resid, WQ, M, SEED)); }
  function GW(m, k) { var md = MD(m), key = "k" + k; return md.gw[key] || (md.gw[key] = S.gwr(md.X, Y, ORD, k, true)); }
  function cname(md, a) { return a === 0 ? "Intercepto" : LAB[md.keys[a - 1]]; }
  /* Classes dos mapas: sinal e tamanho em relação ao limite thr (mediana do valor absoluto). */
  function signCls(v, thr) { return v >= 0 ? (Math.abs(v) >= thr ? "qd2" : "qd1") : (Math.abs(v) >= thr ? "qd0" : "qd3"); }
  var LEGS = [["swq2", "positivo, mais forte"], ["swq1", "positivo, mais fraco"], ["swq3", "negativo, mais fraco"], ["swq0", "negativo, mais forte"]];
  var YBR = S.quantileBreaks(Y, 5);
  function yCls(i) { return "q" + S.classOf(Y[i], YBR); }
  var LEGY = [["sw0", "menor cobertura"], ["sw2", "intermediária"], ["sw4", "maior cobertura"]];
  function bright(a) { var s = a.slice().sort(function (x, y) { return x - y; }), br = []; for (var j = 1; j < 5; j++) br.push(S.quantile(s, j / 5)); return br; }

  /* ---------- figuras pequenas ---------- */
  function axesBox(svg, w, h, m, xlab, ylab) {
    var gA = el("g", { "class": "axis" }, svg);
    el("line", { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b }, gA); el("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b }, gA);
    if (xlab) el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, xlab);
    if (ylab) el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, gA, ylab);
    return gA;
  }
  function ticks(gA, w, h, m, X, Y_, xs, ys, fx, fy) {
    xs.forEach(function (t) { el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, fx(t)); });
    ys.forEach(function (t) { el("line", { x1: m.l, x2: w - m.r, y1: Y_(t), y2: Y_(t), style: "stroke:var(--line);stroke-width:1" }, gA); el("text", { x: m.l - 6, y: Y_(t) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, fy(t)); });
  }
  /* Dispersão simples com linha opcional (a + b x). */
  function scatter(parent, xs, ys, o) {
    var w = C.width(parent), h = o.h || 250, m = { l: 48, r: 14, t: 22, b: 42 }, i;
    var lo = Math.min.apply(null, xs.concat(ys)), hi = Math.max.apply(null, xs.concat(ys)), pad = (hi - lo) * 0.05; if (o.same) { lo -= pad; hi += pad; }
    var xlo = o.same ? lo : Math.min.apply(null, xs) - 0.4, xhi = o.same ? hi : Math.max.apply(null, xs) + 0.4, ylo = o.same ? lo : Math.min.apply(null, ys) - 0.4, yhi = o.same ? hi : Math.max.apply(null, ys) + 0.4;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": o.label }, parent);
    var X = function (v) { return m.l + (w - m.l - m.r) * (v - xlo) / (xhi - xlo); }, Y_ = function (v) { return m.t + (h - m.t - m.b) * (1 - (v - ylo) / (yhi - ylo)); };
    var gA = axesBox(svg, w, h, m, o.xlab, o.ylab), xt = o.xt, yt = o.yt;
    if (o.same) { xt = []; for (var tv = Math.ceil(lo / 20) * 20; tv <= hi; tv += 20) xt.push(tv); yt = xt; }
    ticks(gA, w, h, m, X, Y_, xt, yt, o.fx || f0, o.fy || f0);
    if (o.diag) el("line", { x1: X(lo), y1: Y_(lo), x2: X(hi), y2: Y_(hi), stroke: "var(--muted)", "stroke-width": 1.6, "stroke-dasharray": "5 4" }, svg);
    if (o.line) el("line", { x1: X(xlo), y1: Y_(o.line[0] + o.line[1] * xlo), x2: X(xhi), y2: Y_(o.line[0] + o.line[1] * xhi), "class": "l-alt" }, svg);
    for (i = 0; i < xs.length; i++) {
      el("circle", { cx: X(xs[i]).toFixed(1), cy: Y_(ys[i]).toFixed(1), r: o.r || 4, "class": o.cls ? o.cls(i) : "pt" }, svg);
      if (o.lab) el("text", { x: X(xs[i]) + 7, y: Y_(ys[i]) - 6, "font-size": 12, "font-weight": 700 }, svg, o.lab[i]);
    }
    return svg;
  }
  /* Barras horizontais de VIF, com as linhas das regras de bolso em 5 e 10. */
  function vifBars(parent, names, vals) {
    var w = C.width(parent), n = vals.length, rh = 34, h = 40 + n * rh + 26, m = { l: 112, r: 18, t: 22, b: 32 }, mx = Math.max(12, Math.ceil(Math.max.apply(null, vals) + 1));
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "VIF de cada explicativa, com as linhas de referência em 5 e em 10" }, parent);
    var X = function (v) { return m.l + (w - m.l - m.r) * v / mx; }, gA = el("g", { "class": "axis" }, svg), t;
    el("line", { x1: m.l, x2: m.l, y1: m.t - 6, y2: h - m.b }, gA);
    for (t = 0; t <= mx; t += 2) el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, String(t));
    el("text", { x: (m.l + w - m.r) / 2, y: h - 2, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, "VIF");
    [5, 10].forEach(function (r) { el("line", { x1: X(r), x2: X(r), y1: m.t - 6, y2: h - m.b, stroke: "var(--muted)", "stroke-width": 1.6, "stroke-dasharray": "5 4" }, svg); el("text", { x: X(r) + 3, y: m.t - 8, "font-size": 12, "class": "muted" }, svg, String(r)); });
    vals.forEach(function (v, i) {
      var y = m.t + i * rh;
      el("text", { x: m.l - 8, y: y + 18, "text-anchor": "end", "font-size": 13 }, svg, names[i]);
      el("rect", { x: m.l + 1, y: y + 4, width: Math.max(1, X(v) - m.l - 1), height: 20, "class": v >= 10 ? "bar-hit" : v >= 5 ? "bar-warn" : "bar" }, svg);
      el("text", { x: X(v) + 5, y: y + 19, "font-size": 12, "font-weight": 700 }, svg, f2(v));
    });
    return svg;
  }
  /* Histograma estático das réplicas do I de Moran; barras à direita do observado (ou à esquerda, se negativo) em destaque. */
  function histI(parent, sims, obs, EI) {
    var w = C.width(parent), h = 230, m = { l: 46, r: 14, t: 24, b: 42 }, nb = 30, lo = Math.min(Math.min.apply(null, sims), obs) - 0.03, hi = Math.max(Math.max.apply(null, sims), obs) + 0.03, bw = (hi - lo) / nb, counts = new Array(nb).fill(0), i;
    sims.forEach(function (v) { counts[Math.min(nb - 1, Math.floor((v - lo) / bw))]++; });
    var ymax = Math.max.apply(null, counts), svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Histograma do I de Moran dos resíduos nos embaralhamentos, com o valor observado" }, parent);
    var X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hi - lo); }, Y_ = function (c) { return m.t + (h - m.t - m.b) * (1 - c / ymax); };
    var gA = axesBox(svg, w, h, m, "I de Moran dos resíduos embaralhados", "nº de embaralhamentos");
    for (var t = Math.ceil(lo * 5 - 1e-9) / 5; t <= hi + 1e-9; t += 0.2) el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, fmt(t, 1));
    [0, ymax].forEach(function (c) { el("text", { x: m.l - 6, y: Y_(c) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, String(c)); });
    for (i = 0; i < nb; i++) if (counts[i]) { var a = lo + i * bw, hit = obs >= EI ? a >= obs : a + bw <= obs; el("rect", { x: (X(a) + 1).toFixed(1), y: Y_(counts[i]).toFixed(1), width: Math.max(1, X(a + bw) - X(a) - 2).toFixed(1), height: (h - m.b - Y_(counts[i])).toFixed(1), "class": hit ? "bar-hit" : "bar" }, svg); }
    el("line", { x1: X(EI), x2: X(EI), y1: m.t, y2: h - m.b, stroke: "var(--muted)", "stroke-width": 2, "stroke-dasharray": "5 4" }, svg);
    el("text", { x: X(EI) + 4, y: m.t + 4, "font-size": 12, "class": "muted" }, svg, "E[I] = " + f2(EI));
    el("line", { x1: X(obs), x2: X(obs), y1: m.t, y2: h - m.b, "class": "obs" }, svg);
    var right = X(obs) > (w + m.l) / 2;
    el("text", { x: right ? X(obs) - 6 : X(obs) + 6, y: m.t + 18, "text-anchor": right ? "end" : "start", "font-size": 12, "font-weight": 700 }, svg, "I observado = " + f2(obs));
    return svg;
  }
  /* Curva do AICc conforme k, com a linha do OLS e a marca do menor. */
  function aiccCurve(parent, rows, best, ols, sel) {
    var w = C.width(parent), h = 250, m = { l: 52, r: 14, t: 24, b: 42 }, fin = rows.filter(function (r) { return isFinite(r.aicc); });
    var vmin = Math.min(best.aicc, ols), vmax = Math.max(Math.max.apply(null, fin.map(function (r) { return r.aicc; })), ols), lo = Math.floor((vmin - 6) / 10) * 10, hi = Math.ceil((Math.min(vmax, vmin + 160) + 4) / 10) * 10;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "AICc do GWR conforme o número de vizinhos k, com o AICc do OLS e o menor valor marcado" }, parent);
    var X = function (k) { return m.l + (w - m.l - m.r) * (k - KMIN) / (N - KMIN); }, Y_ = function (v) { return m.t + (h - m.t - m.b) * (1 - (Math.min(v, hi) - lo) / (hi - lo)); };
    var gA = axesBox(svg, w, h, m, "número de vizinhos k (tamanho da janela)", "AICc");
    ticks(gA, w, h, m, X, Y_, [20, 40, 60, 80, 100], [lo, lo + (hi - lo) / 2, hi].map(function (v) { return Math.round(v); }), f0, f0);
    el("line", { x1: m.l, x2: w - m.r, y1: Y_(ols), y2: Y_(ols), stroke: "var(--c3)", "stroke-width": 1.8, "stroke-dasharray": "6 4" }, svg);
    el("text", { x: w - m.r - 2, y: Y_(ols) - 6, "text-anchor": "end", "font-size": 12, "font-weight": 700, fill: "var(--c3)" }, svg, "OLS: " + f1(ols));
    var d = ""; fin.forEach(function (r, i) { d += (i ? "L" : "M") + X(r.k).toFixed(1) + " " + Y_(r.aicc).toFixed(1); });
    el("path", { d: d, fill: "none", stroke: "var(--drw)", "stroke-width": 2.4 }, svg);
    el("circle", { cx: X(best.k), cy: Y_(best.aicc), r: 7, fill: "none", stroke: "var(--text)", "stroke-width": 2 }, svg);
    el("text", { x: X(best.k) + 10, y: Y_(best.aicc) + 16, "font-size": 12, "font-weight": 700 }, svg, "menor: k = " + best.k + ", AICc " + f1(best.aicc));
    if (sel != null && sel !== best.k) { var rr = rows[sel - KMIN]; if (rr && isFinite(rr.aicc)) { el("circle", { cx: X(sel), cy: Y_(rr.aicc), r: 5, fill: "var(--c2)", stroke: "var(--text)", "stroke-width": 1.5 }, svg); } }
    return svg;
  }
  /* Curva do kernel (peso x distância) com os pontos dos municípios da janela. Devolve upTo(raio) que mostra os pontos até o raio. */
  function kernelPlot(parent, W, dists, b) {
    var w = C.width(parent), h = 230, m = { l: 48, r: 14, t: 24, b: 42 }, i;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Peso de cada município da janela conforme a distância ao centro (kernel bisquare)" }, parent);
    var X = function (d) { return m.l + (w - m.l - m.r) * d / b; }, Y_ = function (v) { return m.t + (h - m.t - m.b) * (1 - v); };
    var gA = axesBox(svg, w, h, m, "distância ao centro (fração da banda: 0 = centro, 1 = borda)", "peso");
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { el("text", { x: X(f * b), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, fmt(f, 2)); el("text", { x: m.l - 6, y: Y_(f) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, fmt(f, 2)); });
    var d = ""; for (i = 0; i <= 40; i++) { var u = i / 40; d += (i ? "L" : "M") + X(u * b).toFixed(1) + " " + Y_(S.bisq(u * b, b)).toFixed(1); }
    el("path", { d: d, fill: "none", stroke: "var(--muted)", "stroke-width": 1.6 }, svg);
    var dots = W.idx.map(function (j, t) { return el("circle", { cx: X(dists[t]).toFixed(1), cy: Y_(W.w[t]).toFixed(1), r: 4, "class": "pt", opacity: 0 }, svg); });
    return { svg: svg, upTo: function (r) { dots.forEach(function (c, t) { c.setAttribute("opacity", dists[t] <= r + 1e-12 ? 1 : 0); }); } };
  }
  /* Círculo da banda sobre o mapa (centro no centroide, raio em unidades do plano x escala do mapa). */
  function ring(mp) {
    var c = el("circle", { r: 0, "class": "win", cx: 0, cy: 0 }, mp.g);
    return { set: function (ctr, r) { c.setAttribute("cx", mp.cs[ctr][0].toFixed(1)); c.setAttribute("cy", mp.cs[ctr][1].toFixed(1)); c.setAttribute("r", Math.max(0, r * mp.P.scale).toFixed(1)); } };
  }

  /* ---------- exemplo mínimo do VIF: seis municípios fictícios, duas variáveis ---------- */
  var LET = "ABCDEF", TX1 = [1, 2, 3, 4, 5, 6], TX2 = [2, 1, 4, 3, 6, 5];
  var TOY = (function () {
    var m1 = S.mean(TX1), m2 = S.mean(TX2), d1 = TX1.map(function (v) { return v - m1; }), d2 = TX2.map(function (v) { return v - m2; }), s11 = 0, s22 = 0, s12 = 0;
    d1.forEach(function (v, i) { s11 += v * v; s22 += d2[i] * d2[i]; s12 += v * d2[i]; });
    var r = s12 / Math.sqrt(s11 * s22), r2 = r * r, aux = S.ols(S.design([TX2]), TX1);
    return { m1: m1, m2: m2, d1: d1, d2: d2, s11: s11, s22: s22, s12: s12, r: r, r2: r2, vif: 1 / (1 - r2), aux: aux, vifs: S.vifs([TX1, TX2]) };
  })();

  /* ---------- passos ---------- */
  function coefMap(md, g, a, corr, thr) {
    /* classe de cada município: significativo (|pseudo-t| > crítico) recebe cor por sinal e tamanho; o resto fica cinza. */
    var crit = corr === "bonf" ? md.critB : md.crit0, vals = g.beta.map(function (b) { return b[a]; }), mt = median(vals.map(Math.abs));
    return { crit: crit, vals: vals, t: g.t.map(function (t) { return t[a]; }), thr: mt, cls: function (i) { return Math.abs(g.t[i][a]) > crit ? signCls(vals[i], mt) : "qe"; } };
  }
  var STEPS = [
    { t: "A pergunta: o que explica a cobertura, e isso vale igual em todo o estado?",
      kid: "Queremos saber quais características dos municípios andam junto com a cobertura vacinal: o desenvolvimento (IDHM), a vulnerabilidade social (IVS), o analfabetismo, a renda e a cobertura da Estratégia Saúde da Família (ESF). Uma regressão comum dá uma resposta só para o estado inteiro, do tipo \"a cada ponto a mais de ESF, tantos pontos a mais de cobertura\". Mas será que isso é igual no oeste e no leste? A regressão geograficamente ponderada (GWR) refaz a conta em cada município, dando mais peso aos vizinhos próximos, e mostra onde o efeito é forte, fraco ou some. Antes dela, três cuidados: ver se as explicativas repetem a mesma informação (VIF), ver se o modelo único deixa sobra com padrão no mapa (Moran dos resíduos) e só então olhar o efeito local.",
      pc: function () { return "Ajusta uma regressão para o estado todo (OLS), confere se sobra padrão no mapa, e depois ajusta 102 regressões, uma por município, com mais peso para os vizinhos próximos. Escolhe quantos vizinhos usar comparando modelos (AICc) e desenha os mapas dos efeitos locais (passos 2 a 7)."; },
      conta: function (s) {
        var md = MD(s.mod), mean = S.mean(Y);
        return "<span class=eq>Municípios: <b>" + N + "</b>; resposta fictícia: cobertura vacinal (média <b>" + f1(mean) + "%</b>, de " + f1(Math.min.apply(null, Y)) + "% a " + f1(Math.max.apply(null, Y)) + "%)</span><span class=eq>Explicativas fictícias no modelo: <b>" + md.keys.map(function (k) { return LAB[k]; }).join(", ") + "</b></span>" +
          tbl([["Passo"], ["Pergunta"], ["Ferramenta"]], [["2", "As explicativas se repetem?", "VIF"], ["3", "Qual a relação média no estado?", "OLS"], ["4", "Sobra padrão no mapa?", "I de Moran dos resíduos"], ["5 e 6", "E se cada município tiver a sua conta?", "GWR e escolha da banda"], ["7", "Onde o efeito é forte, fraco ou some?", "Mapas dos coeficientes locais"], ["8", "O que o resultado não prova?", "Cuidados"]].map(function (r) { return "<tr>" + td(r[0]) + td(r[1]) + td(r[2]) + "</tr>"; }));
      },
      tech: function () { return "<p>Modelo global (OLS): y = Xβ + ε, com um β para o estado todo. GWR (Brunsdon, Fotheringham e Charlton, 1996): um β(i) para cada município i, estimado por mínimos quadrados ponderados em que o peso de cada município j cai com a distância até i. A não estacionariedade espacial é a ideia de que a relação entre y e as explicativas muda de lugar para lugar. As saídas são coeficientes locais, estatísticas t locais aproximadas (neste simulador, pseudo-t) e R² local. As explicativas entram padronizadas (média 0, desvio-padrão 1), então cada coeficiente é a mudança na cobertura, em pontos percentuais, para +1 desvio-padrão da explicativa.</p>"; },
      q: "O que o GWR faz que a regressão comum não faz?", a: "A regressão comum dá um coeficiente só para o estado inteiro. O GWR dá um coeficiente para cada município, calculado com mais peso nos vizinhos próximos. Assim dá para ver se a relação muda de uma região para outra. Não prova a causa de nenhuma relação.",
      viz: function (stage, ctl, state) {
        var md = MD(state.mod), g = GW(state.mod, md.kb), a = md.keys.indexOf("esf") + 1, cm = coefMap(md, g, a, "none");
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var p1 = document.createElement("div"), p2 = document.createElement("div"); grid.appendChild(p1); grid.appendChild(p2);
        p1.innerHTML = "<p class=cap>Ponto de partida: cobertura vacinal fictícia (quintis)</p>"; p2.innerHTML = "<p class=cap>Onde vamos chegar: efeito local da ESF (GWR)</p>";
        mapa(p1, { w: p1.clientWidth, cls: yCls, label: "Mapa de Alagoas com a cobertura vacinal fictícia em cinco faixas", titles: function (i) { return f1(Y[i]) + "%"; } });
        mapa(p2, { w: p2.clientWidth, cls: cm.cls, label: "Mapa com o efeito local fictício da cobertura da ESF sobre a cobertura vacinal", titles: function (i) { return "efeito " + f2(cm.vals[i]) + " pp, pseudo-t " + f2(cm.t[i]); } });
        stage.appendChild(legend(LEGY)); stage.appendChild(legend(LEGS.concat([["swqe", "efeito não destacado"]]))); aviso(stage);
        cap(stage, "À esquerda, a cobertura fictícia. À direita, o efeito local da ESF: onde a cor aparece, o pseudo-t passa de 1,96 (sem correção para testes múltiplos, passo 7). Os valores foram sorteados com um efeito de ESF que varia de oeste para leste, para o GWR ter o que mostrar.");
      } },

    { t: "VIF: as explicativas se repetem?",
      kid: "Se duas explicativas contam quase a mesma história, a regressão não consegue separar o efeito de cada uma, e os coeficientes ficam instáveis. O VIF mede isso: para cada explicativa, tentamos prevê-la com as outras. Se as outras a preveem muito bem (R² alto), o VIF é grande. A conta é VIF = 1 ÷ (1 − R²). Regras de bolso: VIF acima de 5 pede atenção e acima de 10 pede mais atenção ainda. São regras de bolso, não testes: não há um valor que decida sozinho.",
      pc: function () { return "Para cada explicativa, ajusta uma regressão dela contra todas as outras, pega o R² dessa regressão e calcula VIF = 1 ÷ (1 − R²). Mostra o resultado numa barra e compara com as linhas de 5 e 10."; },
      conta: function (s) {
        var k = s.sub, md = MD(5), md3 = MD(3), i, html = "";
        if (k === 1) {
          var rows = TX1.map(function (v, i2) { return "<tr>" + td(LET[i2]) + td(v, 1) + td(TX2[i2], 1) + td(f2(TOY.d1[i2]), 1) + td(f2(TOY.d2[i2]), 1) + td(f2(TOY.d1[i2] * TOY.d2[i2]), 1) + "</tr>"; });
          return "<div class=tbl-wrap><table><tr><th>Município</th><th class=num>X1</th><th class=num>X2</th><th class=num>X1 − média</th><th class=num>X2 − média</th><th class=num>produto</th></tr>" + rows.join("") + "</table></div>" +
            "<span class=eq>Médias: X1 = " + f2(TOY.m1) + "; X2 = " + f2(TOY.m2) + "</span><span class=eq>Soma dos produtos = <b>" + f2(TOY.s12) + "</b>; soma dos quadrados de X1 = " + f2(TOY.s11) + "; de X2 = " + f2(TOY.s22) + "</span>" +
            "<span class=eq>Correlação r = " + f2(TOY.s12) + " ÷ √(" + f2(TOY.s11) + " × " + f2(TOY.s22) + ") = <b>" + f4(TOY.r) + "</b></span><span class=eq>Com duas variáveis, o R² de prever uma pela outra é r² = " + f4(TOY.r) + "² = <b>" + f4(TOY.r2) + "</b></span><span class=eq>VIF = 1 ÷ (1 − R²) = 1 ÷ (1 − " + f4(TOY.r2) + ") = <b>" + f2(TOY.vif) + "</b></span><span class=eq>Tolerância = 1 − R² = <b>" + f4(1 - TOY.r2) + "</b> (é o inverso do VIF)</span>" +
            "<p>Leitura: o erro-padrão do coeficiente de cada variável fica aumentado por um fator que cresce com o VIF. É daí que vem o nome: fator de inflação da variância. O VIF de " + f2(TOY.vif) + " está abaixo de 5.</p>";
        }
        var m = k === 2 ? md : md3, names = k === 2 ? ["IDHM", "IVS", "Analfabetismo", "Renda", "Cobertura da ESF"] : ["IDHM", "Analfabetismo", "Cobertura da ESF"];
        var rws = m.vif.map(function (v, j) { return "<tr>" + td(names[j]) + td(f3(v.r2), 1) + td(f2(v.vif), 1) + td(f3(v.tol), 1) + td(v.vif >= 10 ? "acima de 10" : v.vif >= 5 ? "entre 5 e 10: atenção" : "abaixo de 5") + "</tr>"; });
        html = tbl([["Explicativa"], ["R² contra as outras", 1], ["VIF", 1], ["Tolerância", 1], ["Leitura pela regra de bolso"]], rws);
        if (k === 2) {
          var ks = MODS[5], cr = ks.map(function (a) { return "<tr>" + td(LAB[a]) + ks.map(function (b) { return td(a === b ? "1,00" : f2(S.corr(D.gwr[a], D.gwr[b])), 1); }).join("") + "</tr>"; });
          html += "<p>As três que contam parecido (IDHM, IVS e renda) são as de VIF mais alto. Correlações entre as explicativas:</p>" + tbl([[""]].concat(ks.map(function (a) { return [LAB[a], 1]; })), cr) +
            "<p>Nenhuma passa de 10, mas três ficam entre 5 e 10. As regras de bolso não decidem: quem decide é o pesquisador, antes de olhar o resultado.</p>";
        } else {
          html += "<p><b>Exemplo de decisão feita antes de rodar o modelo:</b> das três que contam parecido (IDHM, IVS e renda), manter só o IDHM. Com isso os VIF caem para perto de 1. Este é um exemplo didático; no projeto, a escolha de qual manter ainda será definida.</p>";
        }
        return html;
      },
      tech: function () { return "<p>O VIF da explicativa k é 1 / (1 − R²_k), em que R²_k vem da regressão de k sobre as demais explicativas (com intercepto). A tolerância é 1 − R²_k = 1 / VIF. Como os dados entram padronizados, o VIF não muda com a escala. As regras de bolso (5 e 10) são apenas referências. Cada R²_k aqui é calculado por uma regressão auxiliar resolvida pelas equações normais, e o código Python independente refaz as mesmas regressões.</p>"; },
      q: "O que fazer quando duas explicativas têm VIF alto?", a: "Decidir, antes de olhar o resultado, qual delas manter (ou se vale combiná-las). As regras de 5 e de 10 são regras de bolso, não testes. Retirar variáveis olhando o resultado que sai é um caminho ruim, porque a escolha passa a depender do que se quer ver.",
      viz: function (stage, ctl, state) {
        var k = state.sub, md = MD(5), md3 = MD(3);
        if (k === 1) {
          scatter(stage, TX2, TX1, { label: "Dispersão de X1 por X2 nos seis municípios fictícios A a F, com a reta de ajuste", line: [TOY.aux.beta[0], TOY.aux.beta[1]], lab: LET.split(""), xlab: "X2", ylab: "X1", xt: [1, 2, 3, 4, 5, 6], yt: [1, 2, 3, 4, 5, 6], r: 11 });
          cap(stage, "Seis municípios inventados. X1 é prevista por X2: a reta mostra o quanto X2 explica de X1 (R² = " + f2(TOY.r2) + ").");
          avisoToy(stage);
        } else {
          var m = k === 2 ? md : md3;
          vifBars(stage, k === 2 ? ["IDHM", "IVS", "Analfabetismo", "Renda", "ESF"] : ["IDHM", "Analfabetismo", "ESF"], m.vif.map(function (v) { return v.vif; }));
          stage.appendChild(legend([["swref", "referências: 5 e 10 (tracejadas)"]])); aviso(stage);
          cap(stage, k === 2 ? "VIF das cinco explicativas fictícias. As barras alaranjadas passam de 5." : "VIF depois de manter só o IDHM entre as três que se parecem.");
        }
      } },

    { t: "OLS global: um modelo para o estado inteiro",
      kid: "Antes do GWR, ajustamos a regressão comum: uma única reta (na verdade um plano) para os 102 municípios. O computador acha os coeficientes que deixam a soma dos erros ao quadrado a menor possível. Cada coeficiente diz quantos pontos de cobertura mudam quando a explicativa sobe 1 desvio-padrão. O que sobra, a diferença entre a cobertura real e a prevista, é o resíduo. Pintando o resíduo no mapa, vemos onde o modelo erra para mais ou para menos.",
      pc: function () { return "Monta a tabela com uma coluna de 1 (intercepto) e as explicativas padronizadas, resolve as equações normais (X'X) b = X'y com um solver próprio, calcula os valores previstos, os resíduos, o R² e os erros-padrão, e confere que os resíduos não têm sobra em nenhuma coluna."; },
      conta: function (s) {
        var md = MD(s.mod), o = md.ols, rows = o.beta.map(function (b, a) { return "<tr>" + td(cname(md, a)) + td(f2(b), 1) + td(f2(o.se[a]), 1) + td(f2(o.t[a]), 1) + "</tr>"; });
        return "<span class=eq>cobertura = b0 + " + md.keys.map(function (k, a) { return "b" + (a + 1) + " · " + LAB[k]; }).join(" + ") + " + resíduo</span><span class=eq>Equações normais: (X'X) b = X'y, com X de " + N + " linhas e " + md.q + " colunas</span>" +
          tbl([["Coeficiente"], ["Estimativa (pp)", 1], ["Erro-padrão", 1], ["t", 1]], rows) +
          "<span class=eq>R² = 1 − RSS ÷ TSS = 1 − " + f1(o.rss) + " ÷ " + f1(o.tss) + " = <b>" + f3(o.r2) + "</b></span><span class=eq>Conferência do solver: maior |X'e| = <b>" + sci(o.chk) + "</b> (deve ser zero a menos de arredondamento)</span><span class=eq>AICc do OLS (passo 6) = <b>" + f2(md.aiccOls) + "</b></span>" +
          "<p>O intercepto é a cobertura média (" + f2(S.mean(Y)) + "%), porque as explicativas estão centradas. O t aqui é a estimativa dividida pelo erro-padrão; |t| perto de 2 ou mais costuma ser lido como \"destacado\", mas isso é só uma leitura rápida.</p>";
      },
      tech: function () { return "<p>Com X (n × q, primeira coluna de 1), β̂ = (X'X)⁻¹ X'y. O simulador resolve o sistema com um eliminador de Gauss-Jordan com pivô parcial, escrito no próprio núcleo, e confere que X'e é zero (a menos de arredondamento). Erro-padrão: raiz de s² · [(X'X)⁻¹]_jj, com s² = RSS / (n − q). O OLS supõe erros independentes e de variância constante; se os resíduos têm padrão no mapa (passo 4), a suposição de independência está em dúvida. O código Python independente refaz o ajuste com mínimos quadrados do numpy.</p>"; },
      q: "O que são os resíduos e por que olhá-los no mapa?", a: "O resíduo é a cobertura real menos a prevista pelo modelo. Se os erros fossem sorteio puro, as cores se espalhariam sem padrão. Se ficam juntas (várias vermelhas perto umas das outras), o modelo está deixando de explicar algo que tem forma geográfica.",
      viz: function (stage, ctl, state) {
        var md = MD(state.mod), o = md.ols, thr = median(o.resid.map(Math.abs));
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var p1 = document.createElement("div"), p2 = document.createElement("div"); grid.appendChild(p1); grid.appendChild(p2);
        p1.innerHTML = "<p class=cap>Cobertura real e prevista pelo OLS</p>"; p2.innerHTML = "<p class=cap>Resíduo de cada município</p>";
        scatter(p1, o.fit, Y, { label: "Cobertura real contra a cobertura prevista pelo OLS, com a diagonal", same: true, diag: true, xlab: "prevista pelo OLS (%)", ylab: "real (%)", r: 3.2 });
        mapa(p2, { w: p2.clientWidth, cls: function (i) { return signCls(o.resid[i], thr); }, label: "Mapa com o resíduo do OLS em cada município", titles: function (i) { return "resíduo " + f2(o.resid[i]) + " pp"; } });
        stage.appendChild(legend([["swq2", "real acima do previsto"], ["swq1", "um pouco acima"], ["swq3", "um pouco abaixo"], ["swq0", "real abaixo do previsto"]])); aviso(stage);
        cap(stage, "No mapa, azul = o modelo previu menos do que o real; vermelho = previu mais. A intensidade separa os resíduos acima e abaixo da mediana do valor absoluto (" + f2(thr) + " pp).");
      } },

    { t: "I de Moran dos resíduos: sobrou padrão no mapa?",
      kid: "Se o modelo único tivesse captado tudo, os resíduos seriam como sorteio: sem padrão no mapa. O I de Moran (método 4), aplicado aos resíduos, mede isso. Embaralhamos os resíduos entre os municípios muitas vezes; se o valor verdadeiro for mais extremo que quase todos os embaralhados, o padrão no mapa é grande demais para ser acaso. Atenção: um resultado destacado diz que o modelo único deixa sobra com forma geográfica. Não diz, sozinho, que o GWR é a solução.",
      pc: function () { return "Calcula o I de Moran dos resíduos com vizinhança rainha (pesos iguais, somando 1 por linha). Embaralha os resíduos M vezes (semente fixa), recalcula o I a cada vez e conta quantas vezes o embaralhado é tão extremo quanto o verdadeiro: p = (R + 1) ÷ (M + 1)."; },
      conta: function (s) {
        var md = MD(s.mod), pm = PERM(s.mod, s.M), I = pm.I;
        return "<span class=eq>I de Moran dos resíduos = <b>" + f3(I) + "</b>; E[I] = −1 ÷ (n − 1) = <b>" + f3(pm.EI) + "</b></span><span class=eq>Embaralhamentos M = <b>" + f0(s.M) + "</b> (semente " + SEED + "); R = <b>" + pm.R + "</b> embaralhamentos " + (pm.upper ? "com I ≥" : "com I ≤") + " " + f3(I) + "</span><span class=eq>p = (R + 1) ÷ (M + 1) = (" + pm.R + " + 1) ÷ (" + f0(s.M) + " + 1) = <b>" + fmt(pm.p, String(s.M + 1).length - 1) + "</b></span>" +
          "<p>" + (pm.p <= ALPHA ? "O padrão dos resíduos no mapa é mais forte do que o esperado por acaso. " : "Neste modelo, o padrão dos resíduos não passa do que o acaso costuma dar. ") + "<b>O que isso não decide:</b> um I destacado indica variável omitida, forma errada da relação ou dependência espacial; o GWR é uma das respostas possíveis, não a única. Também existem testes específicos (LM de erro e de defasagem e as versões robustas), que esta página não simula.</p>";
      },
      tech: function () { return "<p>I = (n / S0) · Σ_i Σ_j w_ij e_i e_j / Σ e_i², com e = resíduo (média zero no OLS com intercepto) e W com pesos iguais por linha (S0 = n). E[I] = −1/(n − 1). O teste por permutação embaralha os valores dos resíduos entre os municípios, como se fossem valores comuns, e usa o pseudo-p (R + 1)/(M + 1), com R contado do lado do I observado em relação a E[I]. O embaralhamento é uma aproximação, porque os resíduos de uma regressão não são valores livres: eles obedecem às equações normais. A matriz de vizinhança (rainha, aqui) e o número de embaralhamentos ainda são escolhas do projeto.</p>"; },
      q: "Se o I de Moran dos resíduos for significativo, devo usar o GWR?", a: "Não necessariamente. O resultado mostra que sobrou padrão geográfico. As causas possíveis incluem variável omitida, forma errada da relação e dependência espacial. O GWR é um caminho; há outros, e a escolha depende da pergunta.",
      viz: function (stage, ctl, state) {
        var md = MD(state.mod), o = md.ols, pm = PERM(state.mod, state.M), thr = median(o.resid.map(Math.abs));
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var p1 = document.createElement("div"), p2 = document.createElement("div"); grid.appendChild(p1); grid.appendChild(p2);
        p1.innerHTML = "<p class=cap>Resíduos do OLS no mapa</p>"; p2.innerHTML = "<p class=cap>I de Moran dos resíduos contra os embaralhados (" + f0(state.M) + ")</p>";
        mapa(p1, { w: p1.clientWidth, cls: function (i) { return signCls(o.resid[i], thr); }, label: "Mapa com os resíduos do OLS", titles: function (i) { return "resíduo " + f2(o.resid[i]) + " pp"; } });
        histI(p2, Array.prototype.slice.call(pm.sims), pm.I, pm.EI);
        stage.appendChild(legend([["swq2", "real acima do previsto"], ["swq3", "real abaixo do previsto"]])); aviso(stage);
        cap(stage, "Barras vermelhas: embaralhamentos tão extremos quanto o I verdadeiro. A linha tracejada é E[I].");
      } },

    { t: "GWR: um modelo para cada município",
      kid: "Aqui está a ideia do GWR. Escolha um município. O computador desenha ao redor dele uma janela com os k vizinhos mais próximos e dá a cada vizinho um peso: 1 para o próprio município, caindo até 0 na borda da janela. Depois faz a regressão de novo só com esses pesos. O resultado vale para o município escolhido. Repetindo para os 102, sai um conjunto de coeficientes, um por local. Use os botões para trocar o tamanho da janela e veja a conta mudar.",
      pc: function () { return "Ordena os municípios por distância ao escolhido, define a banda como a distância ao k-ésimo mais próximo, calcula os pesos do kernel bisquare, monta a regressão ponderada e resolve para os coeficientes daquele município. A animação mostra o círculo crescendo até a banda e os pesos aparecendo."; },
      conta: function (s) {
        var md = MD(s.mod), k = s.kk === "best" ? md.kb : s.kk, g = GW(s.mod, k), i = s.sel, W = g.wt[i], sw = 0, sw2 = 0, t;
        W.w.forEach(function (w) { sw += w; sw2 += w * w; });
        var o = ORD[i], j1 = o.ord[1], d1 = o.dist[1], u1 = d1 / W.b, w1 = S.bisq(d1, W.b), kmv = W.b * 111.2;
        var rows = g.beta[i].map(function (b, a) { return "<tr>" + td(cname(md, a)) + td(f2(b), 1) + td(f2(g.t[i][a]), 1) + td(f2(md.ols.beta[a]), 1) + "</tr>"; });
        return "<span class=eq>Município escolhido: <b>" + esc(NAMES[i]) + "</b>; janela de k = <b>" + k + "</b> vizinhos (o próprio conta como o 1º)" + (s.kk === "best" ? ", o k de menor AICc (passo 6)" : "") + "</span>" +
          "<span class=eq>Banda b = distância ao " + k + "º mais próximo = <b>" + f3(W.b) + "</b> (em graus de latitude; 1° ≈ 111 km, então ≈ " + f0(kmv) + " km)</span>" +
          "<span class=eq>Peso = (1 − (d ÷ b)²)². O vizinho mais próximo, " + esc(NAMES[j1]) + ", fica a d = " + f3(d1) + ": peso = (1 − (" + f3(d1) + " ÷ " + f3(W.b) + ")²)² = (1 − " + f3(u1 * u1) + ")² = <b>" + f3(w1) + "</b></span>" +
          "<span class=eq>Municípios com peso maior que zero: <b>" + W.idx.length + "</b>; soma dos pesos = " + f2(sw) + "; tamanho efetivo (soma)² ÷ (soma dos quadrados) = <b>" + f1(sw * sw / sw2) + "</b></span>" +
          tbl([["Coeficiente"], ["Local (pp)", 1], ["pseudo-t local", 1], ["OLS global (pp)", 1]], rows) +
          "<span class=eq>R² local = <b>" + f3(g.r2loc[i]) + "</b></span><p>O pseudo-t é uma aproximação (passo 7). Compare a coluna local com a global: onde diferem muito, a relação neste município não é a média do estado.</p>";
      },
      tech: function () { return "<p>Para o município i: β(i) = (X'W_iX)⁻¹ X'W_i y, com W_i diagonal e w_ij = (1 − (d_ij / b_i)²)² se d_ij &lt; b_i, senão 0 (kernel bisquare). A banda é adaptativa: b_i é a distância de i ao k-ésimo município mais próximo (i é o 1º, a distância zero); por isso o k-ésimo tem peso zero, e a janela efetiva tem até k − 1 municípios com peso positivo. Distância: entre centroides, num plano em que a longitude é multiplicada pelo cosseno da latitude média (a mesma regra dos métodos 5 e 6). O tamanho efetivo local (Σw)² / Σw² diz quantos municípios \"de peso cheio\" a janela equivale. Pacotes de GWR podem usar outra regra de distância, outro kernel ou outra rotina de busca da banda: confira a documentação.</p>"; },
      q: "Por que o peso cai até zero na borda da janela?", a: "Para que a janela não tenha uma borda dura: um município que está logo dentro pesa quase nada, e a passagem para fora é suave. Isso evita que um município mude os coeficientes de repente só por cruzar a linha.",
      viz: function (stage, ctl, state, root) {
        var md = MD(state.mod), k = state.kk === "best" ? md.kb : state.kk, g = GW(state.mod, k), i = state.sel, W = g.wt[i], o = ORD[i];
        var dists = W.idx.map(function (j) { return PL_dist(i, j); });
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>A janela ao redor de " + esc(NAMES[i]) + " (" + k + " vizinhos)</p>"; b.innerHTML = "<p class=cap>Peso de cada município da janela</p>";
        var mp = mapa(a, { w: a.clientWidth, cls: function (j) { return j === i ? "drw focus" : "qe"; }, onSel: function (j) { state.sel = j; ctl.redraw(); }, label: "Mapa de Alagoas com a janela do GWR ao redor do município escolhido", titles: function (j) { return j === i ? "município escolhido" : "clique para escolher"; } });
        var rg = ring(mp), kp = kernelPlot(b, W, dists, W.b), inf = info(stage);
        var pos = {}; W.idx.forEach(function (j, t) { pos[j] = t; });
        function wcls(w) { return w > 0.75 ? "q4" : w > 0.5 ? "q3" : w > 0.25 ? "q2" : "q1"; }
        function show(p) {
          var r = p * W.b, cnt = 0;
          W.idx.forEach(function (j, t) { if (j === i) return; var inn = dists[t] <= r + 1e-12; if (inn) cnt++; setCls(mp, j, inn ? wcls(W.w[t]) + " clk" : "qe clk"); });
          rg.set(i, r); kp.upTo(r);
          inf.textContent = p >= 1 ? "Pronto: a janela chegou à banda e " + W.idx.length + " municípios têm peso maior que zero." : "Raio com " + cnt + " municípios dentro (de até " + (W.idx.length - 1) + " além do escolhido).";
        }
        if (clock.reduced) show(1); else clock.tween(Math.max(2.5, k * 0.06), show);
        stage.appendChild(legend([["swdrw", "município escolhido"], ["sw4", "peso alto"], ["sw2", "peso médio"], ["sw1", "peso baixo"], ["swqe", "peso zero"]])); aviso(stage);
        cap(stage, "Clique em outro município para trocá-lo, ou use a lista. A cor mostra o peso (quanto mais escuro, mais pesa). O círculo tracejado cresce até a banda. Use os controles da animação para pausar, acelerar ou reiniciar.");
      } },

    { t: "A banda: quantos vizinhos?",
      kid: "A janela pequena demais deixa o modelo nervoso (poucos dados em cada conta); a janela grande demais apaga as diferenças entre lugares. Escolher o tamanho certo é a parte delicada do GWR. Aqui usamos o AICc, uma nota que premia o modelo que erra pouco e castiga o que usa flexibilidade demais. Testamos cada k de 20 a 102 e ficamos com a menor nota. Depois comparamos com a nota do modelo global (OLS): a menor vence.",
      pc: function () { return "Para cada k de 20 a 102, ajusta o GWR nos 102 municípios, soma os erros ao quadrado (RSS) e o traço da matriz de projeção (tr S, uma medida de quantos parâmetros o modelo realmente usa) e calcula o AICc. Fica com o k de menor AICc e compara com o AICc do OLS."; },
      conta: function (s) {
        var md = MD(s.mod), g = GW(s.mod, md.kb), n = N, sg = Math.sqrt(g.rss / n), t1 = 2 * n * Math.log(sg), t2 = n * Math.log(2 * Math.PI), t3 = n * (n + g.trS) / (n - 2 - g.trS), o = md.ols, so = Math.sqrt(o.rss / n);
        var show = [20, 30, md.kb, 60, 80, 102].filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (x, y) { return x - y; });
        var rows = show.map(function (k) { var r = md.curve.rows[k - KMIN]; return "<tr>" + td(k + (k === md.kb ? " (menor)" : ""), 1) + td(f1(r.rss), 1) + td(f2(r.trS), 1) + td(f2(r.aicc), 1) + "</tr>"; });
        return "<span class=eq>AICc = 2 n ln(σ̂) + n ln(2π) + n (n + tr S) ÷ (n − 2 − tr S), com σ̂ = √(RSS ÷ n)</span>" +
          "<span class=eq>GWR com k = " + md.kb + ": RSS = " + f1(g.rss) + "; σ̂ = √(" + f1(g.rss) + " ÷ " + n + ") = " + f3(sg) + "; tr S = " + f2(g.trS) + "</span><span class=eq>= " + f2(t1) + " + " + f2(t2) + " + " + f2(t3) + " = <b>" + f2(g.aicc) + "</b></span>" +
          "<span class=eq>OLS (tr S = " + md.q + " parâmetros): RSS = " + f1(o.rss) + "; σ̂ = " + f3(so) + "; AICc = <b>" + f2(md.aiccOls) + "</b></span>" +
          tbl([["k", 1], ["RSS", 1], ["tr S", 1], ["AICc", 1]], rows) +
          "<p>O GWR com k = " + md.kb + " tem AICc " + f2(g.aicc) + ", contra " + f2(md.aiccOls) + " do OLS: " + (g.aicc < md.aiccOls ? "menor, então o GWR é preferido por este critério neste exemplo" : "maior, então o OLS é preferido por este critério neste exemplo") + ". A diferença é uma comparação entre dois números, sem um limite de corte. Com k = 102 os pesos ainda caem com a distância, então esse GWR não é igual ao OLS.</p>";
      },
      tech: function () { return "<p>tr S é a soma de S_ii, em que S_ii = x_i' (X'W_iX)⁻¹ x_i (o peso do próprio município é 1). Ele faz o papel do número de parâmetros efetivos: janelas pequenas gastam mais (tr S maior). O AICc usa σ̂ = √(RSS / n) e a correção n (n + tr S) / (n − 2 − tr S); se n − 2 − tr S ≤ 0 o AICc não é definido (aqui, tratado como infinito). Este simulador varre todos os k inteiros de " + KMIN + " a " + N + "; pacotes costumam usar uma busca automática (por exemplo, seção áurea), que pode parar em outro k. A validação cruzada é outro critério possível para a banda, e a escolha do critério ainda é do projeto. O AICc do OLS usa tr S = número de coeficientes (" + MD(3).q + " ou " + MD(5).q + ", conforme o modelo).</p>"; },
      q: "Por que não escolher a banda que dá o maior R²?", a: "Porque janelas pequenas sempre se ajustam melhor aos dados que já temos, até decorar o ruído. O AICc desconta a flexibilidade usada (tr S), e por isso é um critério mais justo para comparar janelas e para comparar com o OLS.",
      viz: function (stage, ctl, state) {
        var md = MD(state.mod), g = GW(state.mod, md.kb);
        aiccCurve(stage, md.curve.rows, md.curve.best, md.aiccOls, null);
        stage.appendChild(legend([["swdrw", "AICc do GWR em cada k"], ["swc3", "AICc do OLS (tracejada)"]])); aviso(stage);
        cap(stage, "Quanto menor o AICc, melhor. O círculo marca o menor valor do GWR (k = " + md.kb + ": AICc " + f1(g.aicc) + "); a linha tracejada é o OLS (" + f1(md.aiccOls) + ").");
      } },

    { t: "Mapas dos coeficientes locais e do R² local",
      kid: "Agora vemos o resultado: um mapa para cada coeficiente. Cada município tem o seu coeficiente local e o seu pseudo-t, que é o coeficiente dividido pelo erro-padrão local. Colorimos só os municípios cujo |pseudo-t| passa de um valor de corte; o resto fica cinza. Há um cuidado: são 102 municípios vezes todos os coeficientes, ou seja, centenas de testes ao mesmo tempo. Com tantos testes, algum \"passa\" por acaso. O corte sem correção deixa passar muito acaso; o de Bonferroni é o mais rigoroso. O R² local mostra onde o modelo explica mais ou menos.",
      pc: function () { return "Para cada município calcula o coeficiente local, o erro-padrão local, o pseudo-t e o R² local (pesado pelos mesmos pesos). Compara o |pseudo-t| com o valor de corte escolhido, pinta de azul ou vermelho conforme o sinal e a força e deixa em cinza o que não passa."; },
      conta: function (s) {
        var md = MD(s.mod), g = GW(s.mod, md.kb), q = md.q, a = s.coef, cm, html;
        var head = "<span class=eq>Número de testes: " + N + " municípios × " + q + " coeficientes = <b>" + f0(md.nTests) + "</b></span>";
        if (a === "r2") {
          return head + "<span class=eq>R² local: mínimo <b>" + f2(Math.min.apply(null, g.r2loc)) + "</b>, mediana <b>" + f2(median(g.r2loc)) + "</b>, máximo <b>" + f2(Math.max.apply(null, g.r2loc)) + "</b>; R² do OLS: " + f2(md.ols.r2) + "</span><p>O R² local é calculado com os pesos de cada município: mostra onde o modelo explica bem a cobertura e onde explica pouco.</p>";
        }
        cm = coefMap(md, g, a, s.corr);
        var n0 = 0, nb = 0, nn = 0, pos = 0, neg = 0; g.t.forEach(function (t) { var v = Math.abs(t[a]); if (v > md.crit0) n0++; if (v > md.critB) nb++; });
        cm.cls && cm.vals.forEach(function (v, i) { if (Math.abs(g.t[i][a]) > cm.crit) { if (v > 0) pos++; else neg++; } else nn++; });
        return head + "<span class=eq>Coeficiente: <b>" + cname(md, a) + "</b>; OLS global = " + f2(md.ols.beta[a]) + " pp; local de " + f2(Math.min.apply(null, cm.vals)) + " a " + f2(Math.max.apply(null, cm.vals)) + " pp</span>" +
          "<span class=eq>Corte do |pseudo-t|: sem correção = <b>" + f2(md.crit0) + "</b>; Bonferroni ingênuo = 0,05 ÷ " + f0(md.nTests) + " = " + fmt(ALPHA / md.nTests, 6) + " por teste, que equivale a <b>" + f2(md.critB) + "</b></span>" +
          "<span class=eq>Municípios acima do corte: sem correção <b>" + n0 + "</b> de " + N + "; Bonferroni <b>" + nb + "</b> de " + N + "</span>" +
          "<p>Mostrando agora: " + (s.corr === "bonf" ? "corte de Bonferroni" : "sem correção") + ": " + pos + " positivos, " + neg + " negativos, " + nn + " em cinza.</p>" +
          "<p><b>Sobre a correção:</b> o Bonferroni aqui é só uma referência de rigor. Ele supõe testes independentes e por isso é conservador demais para o GWR, em que os testes de municípios vizinhos usam quase os mesmos dados. O ajuste usado na prática é menos conservador e vem do pacote de GWR; este simulador não o implementa. Confira a documentação do pacote que for usar.</p>";
      },
      tech: function () { return "<p>Erro-padrão local do coeficiente j em i: raiz de σ̂² · [A_i⁻¹ B_i A_i⁻¹]_jj, com A_i = X'W_iX, B_i = X'W_i²X e σ̂² = RSS / (n − 2 tr S + tr(S'S)), em que S é a matriz de projeção do GWR (ŷ = S y). O \"pseudo-t\" = β_j(i) / erro-padrão. Ele não segue exatamente uma distribuição t: as 102 regressões usam os mesmos dados, as janelas se sobrepõem e a banda foi escolhida olhando os mesmos dados. Por isso o corte vem da normal padrão como aproximação (1,96 para 5% sem correção) e deve ser lido como uma referência, não como um valor p. R² local = 1 − Σ w (y − ŷ)² / Σ w (y − ȳ_w)², somas ponderadas pelos pesos do município. Intensidade das cores: a metade acima da mediana do |coeficiente| é \"mais forte\". </p>"; },
      q: "Posso concluir que o efeito é forte onde o mapa está colorido?", a: "Só que, nesse modelo e com esse corte, o coeficiente local é destacado em relação ao erro-padrão aproximado. É uma pista para formular hipóteses, não uma prova. E com tantos testes ao mesmo tempo, alguns municípios aparecem coloridos só por acaso.",
      viz: function (stage, ctl, state) {
        var md = MD(state.mod), g = GW(state.mod, md.kb), a = state.coef, i, mp, inf = info(stage);
        if (a === "r2") {
          var br = bright(g.r2loc);
          mp = mapa(stage, { w: stage.clientWidth, cls: function (j) { return "q" + S.classOf(g.r2loc[j], br); }, onSel: function (j) { inf.textContent = NAMES[j] + ": R² local " + f2(g.r2loc[j]) + "."; }, label: "Mapa do R² local do GWR", titles: function (j) { return "R² local " + f2(g.r2loc[j]); } });
          stage.appendChild(legend([["sw0", "R² local menor"], ["sw2", "intermediário"], ["sw4", "R² local maior"]]));
        } else {
          var cm = coefMap(md, g, a, state.corr);
          mp = mapa(stage, { w: stage.clientWidth, cls: cm.cls, onSel: function (j) { inf.textContent = NAMES[j] + ": coeficiente local " + f2(cm.vals[j]) + " pp, pseudo-t " + f2(cm.t[j]) + (Math.abs(cm.t[j]) > cm.crit ? " (acima do corte)." : " (abaixo do corte, em cinza)."); }, label: "Mapa do coeficiente local " + cname(md, a) + " com os municípios acima do corte do pseudo-t", titles: function (j) { return "coef. " + f2(cm.vals[j]) + " pp, pseudo-t " + f2(cm.t[j]); } });
          stage.appendChild(legend(LEGS.concat([["swqe", "abaixo do corte do |pseudo-t|"]])));
        }
        inf.textContent = "Clique em um município para ler os números dele."; aviso(stage);
        cap(stage, a === "r2" ? "R² local em cinco faixas (quintis). Valores sorteados, sem relação com os municípios reais." : "Só são coloridos os municípios com |pseudo-t| acima do corte. As cores indicam sinal e tamanho do coeficiente local (pontos percentuais por +1 desvio-padrão).");
      } },

    { t: "Cuidados: o que o GWR não prova",
      kid: "O GWR é uma ferramenta de exploração. Com 102 municípios, cada conta local usa poucos vizinhos de verdade (veja no mapa o tamanho efetivo da janela). A cobertura tem limite natural de 0 a 100%, e valores acima de 100% (que aparecem nos dados reais) ainda não têm tratamento decidido. A análise é feita por município, não por criança, então é ecológica. E um mapa de coeficientes sugere onde olhar melhor: não prova que uma coisa causa a outra.",
      pc: function () { return "Calcula, para cada município, o tamanho efetivo da janela, e conta os valores de cobertura acima de 100%. Não corrige nada: mostra onde a leitura exige mais cautela."; },
      conta: function (s) {
        var md = MD(s.mod), g = GW(s.mod, md.kb), ne = g.neff, over = Y.filter(function (v) { return v > 100; }).length;
        return "<span class=eq>Municípios: <b>" + N + "</b> (amostra pequena para um modelo com " + md.q + " coeficientes locais e a escolha da banda sobre os mesmos dados)</span>" +
          "<span class=eq>Tamanho efetivo da janela (k = " + md.kb + "): mínimo <b>" + f1(Math.min.apply(null, ne)) + "</b>, mediana <b>" + f1(median(ne)) + "</b>, máximo <b>" + f1(Math.max.apply(null, ne)) + "</b></span>" +
          "<span class=eq>Parâmetros efetivos do GWR: tr S = <b>" + f1(g.trS) + "</b> (o OLS usa " + md.q + ")</span>" +
          "<span class=eq>Cobertura fictícia acima de 100%: <b>" + over + "</b> de " + N + " municípios (resposta limitada: decisão aberta)</span>" +
          "<ul><li><b>Colinearidade local:</b> o VIF do passo 2 é global. Dentro de uma janela pequena, as explicativas podem ficar mais parecidas entre si do que no estado todo, e os coeficientes locais ficam instáveis.</li><li><b>Resposta limitada:</b> a cobertura só vai de 0 a 100% na teoria, mas há valores acima de 100% na base. O projeto ainda não definiu como tratar isso no modelo.</li><li><b>Análise ecológica:</b> cada ponto é um município; o resultado não vale para crianças individuais.</li><li><b>Sem causalidade:</b> os mapas sugerem hipóteses; não provam que mudar uma explicativa muda a cobertura.</li><li><b>Exploratório:</b> com n = 102, trate o GWR como uma forma de olhar os dados, não como estimativa final.</li></ul>";
      },
      tech: function () { return "<p>O tamanho efetivo local é (Σw)² / Σw², com w os pesos da janela do município. Valores pequenos indicam que poucos municípios dominam o ajuste local. A banda é escolhida e o modelo é avaliado nos mesmos dados, e os pseudo-t não consideram essa escolha. Cobertura acima de 100% (numerador e denominador de fontes diferentes) e proporções de municípios pequenos (variância instável) ainda não têm tratamento fichado para este modelo: ficam como limitação aberta, apresentada com as alternativas na seção Decisões do projeto.</p>"; },
      q: "O GWR vale para municípios pequenos?", a: "É preciso cuidado. Municípios pequenos têm taxas instáveis, e cada conta local usa poucos vizinhos efetivos. O projeto ainda vai definir como tratar isso.",
      viz: function (stage, ctl, state) {
        var md = MD(state.mod), g = GW(state.mod, md.kb), br = bright(g.neff);
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var p1 = document.createElement("div"), p2 = document.createElement("div"); grid.appendChild(p1); grid.appendChild(p2);
        p1.innerHTML = "<p class=cap>Tamanho efetivo da janela de cada município</p>"; p2.innerHTML = "<p class=cap>Cobertura fictícia acima de 100%</p>";
        mapa(p1, { w: p1.clientWidth, cls: function (i) { return "q" + S.classOf(g.neff[i], br); }, label: "Mapa do tamanho efetivo da janela do GWR em cinco faixas", titles: function (i) { return "tamanho efetivo " + f1(g.neff[i]); } });
        mapa(p2, { w: p2.clientWidth, cls: function (i) { return Y[i] > 100 ? "nbr" : "qe"; }, label: "Mapa dos municípios com cobertura fictícia acima de 100%", titles: function (i) { return f1(Y[i]) + "%"; } });
        stage.appendChild(legend([["sw0", "janela efetiva menor"], ["sw4", "janela efetiva maior"], ["swn", "cobertura acima de 100%"], ["swqe", "até 100%"]])); aviso(stage);
        cap(stage, "À esquerda, onde a conta local tem menos municípios \"de peso cheio\". À direita, os municípios fictícios com cobertura acima de 100%.");
      } }
  ];
  /* distância no plano entre os centroides de i e j (a mesma usada na ordenação). */
  function PL_dist(i, j) { var dx = PL.x[i] - PL.x[j], dy = PL.y[i] - PL.y[j]; return Math.sqrt(dx * dx + dy * dy); }
  STEPS.forEach(function (s) { var p = s.pc, c = s.conta, t = s.tech; s.pc = function () { return typeof p === "function" ? p() : p; }; s.conta = function (st) { return c(st); }; s.tech = function () { return t(); }; });

  var ARW = { prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' };
  function chips(label, opts, cur, onPick) {
    var g = document.createElement("span"); g.className = "grp"; g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
    var l = document.createElement("span"); l.textContent = label + ":"; g.appendChild(l);
    opts.forEach(function (o) { var b = document.createElement("button"); b.type = "button"; b.textContent = o[1]; b.setAttribute("aria-pressed", String(o[0] === cur)); b.addEventListener("click", function () { onPick(o[0]); }); g.appendChild(b); });
    return g;
  }
  function seletor(state, onChange) {
    var g = document.createElement("span"); g.className = "grp";
    var lb = document.createElement("label"); lb.textContent = "Município:"; lb.style.marginRight = "4px"; lb.setAttribute("for", "sel-mun"); g.appendChild(lb);
    var s = document.createElement("select"); s.id = "sel-mun";
    NAMES.map(function (n, i) { return [n, i]; }).sort(function (a, b) { return a[0].localeCompare(b[0], "pt-BR"); }).forEach(function (e) { var o = document.createElement("option"); o.value = e[1]; o.textContent = e[0]; if (e[1] === state.sel) o.selected = true; s.appendChild(o); });
    s.addEventListener("change", function () { state.sel = +s.value; onChange(); });
    g.appendChild(s); return g;
  }
  function renderPassos(root, app, state) {
    state.mod = state.mod || 3; state.M = state.M || 999; state.sub = state.sub || 1; state.kk = state.kk || "best"; state.corr = state.corr || "none";
    var N_ = STEPS.length, idx = Math.max(0, Math.min(N_ - 1, (state.step || 1) - 1)), st = STEPS[idx], md = MD(state.mod);
    if (state.coef == null || (state.coef !== "r2" && state.coef >= md.q)) state.coef = md.keys.indexOf("esf") + 1;
    if (state.sel == null) { var g0 = GW(state.mod, md.kb), a0 = md.keys.indexOf("esf") + 1, bi = 0; g0.beta.forEach(function (b, i) { if (b[a0] > g0.beta[bi][a0]) bi = i; }); state.sel = bi; }
    clock.clear(); root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "opts"; root.appendChild(ds);
    function redraw() { renderPassos(root, app, state); app.remount && app.remount(); }
    if (idx === 1) ds.appendChild(chips("Etapa", [[1, "1: à mão"], [2, "2: cinco explicativas"], [3, "3: depois da escolha"]], state.sub, function (v) { state.sub = v; redraw(); }));
    if (idx >= 2) ds.appendChild(chips("Modelo", [[3, "3 explicativas"], [5, "5 explicativas"]], state.mod, function (v) { state.mod = v; state.coef = null; redraw(); }));
    if (idx === 3) ds.appendChild(chips("Embaralhamentos", [[999, "999"], [9999, "9999"]], state.M, function (v) { state.M = v; redraw(); }));
    if (idx === 4) { ds.appendChild(seletor(state, redraw)); ds.appendChild(chips("Vizinhos k", [[20, "20"], ["best", "k ótimo (" + md.kb + ")"], [60, "60"], [102, "102"]], state.kk, function (v) { state.kk = v; redraw(); })); }
    if (idx === 6) {
      ds.appendChild(chips("Mapa", md.keys.map(function (k, a) { return [a + 1, LAB[k]]; }).concat([[0, "Intercepto"], ["r2", "R² local"]]), state.coef, function (v) { state.coef = v; redraw(); }));
      if (state.coef !== "r2") ds.appendChild(chips("Correção", [["none", "sem correção"], ["bonf", "Bonferroni"]], state.corr, function (v) { state.corr = v; redraw(); }));
    }
    var head = document.createElement("div"); head.className = "stephead";
    var back = document.createElement("button"); back.className = "arrow"; back.innerHTML = ARW.prev; back.setAttribute("aria-label", "Passo anterior"); back.title = "Passo anterior"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "arrow"; nxt.innerHTML = ARW.next; nxt.setAttribute("aria-label", "Próximo passo"); nxt.title = "Próximo passo"; nxt.disabled = idx === N_ - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    var no = document.createElement("p"); no.className = "stepno"; no.textContent = "Passo " + (idx + 1) + " de " + N_;
    head.appendChild(back); head.appendChild(no); head.appendChild(nxt); root.appendChild(head);
    var pr = document.createElement("div"); pr.className = "progress"; pr.setAttribute("role", "progressbar"); pr.setAttribute("aria-valuemin", "1"); pr.setAttribute("aria-valuemax", String(N_)); pr.setAttribute("aria-valuenow", String(idx + 1)); pr.innerHTML = '<i style="width:' + ((idx + 1) / N_ * 100) + '%"></i>'; root.appendChild(pr);
    var h2 = document.createElement("h2"); h2.id = "step-h"; h2.tabIndex = -1; h2.textContent = (idx + 1) + ". " + st.t; root.appendChild(h2);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var body = document.createElement("div"); root.appendChild(body);
    body.innerHTML =
      "<div class='callout kid'><b>Explicação simplificada</b>" + st.kid + "</div>" +
      "<div class=card><span class=lbl>O que o computador faz</span>" + st.pc() + "</div>" +
      "<div class='card conta'><span class=lbl>Conta na tela</span><div data-live=conta" + (idx + 1) + ">" + st.conta(state) + "</div></div>" +
      "<details class=tech" + (app.tech() ? " open" : "") + "><summary>Ver a versão técnica</summary>" + st.tech() + "</details>";
    st.viz(stage, { redraw: redraw }, state, root);
    var h = root.querySelector("#step-h"); if (state.focus && h) h.focus({ preventScroll: false });
  }

  /* ---------- seções "Saiba mais" ---------- */
  function tabContexto() {
    return "<div class=card><h2>Qual pergunta este método responde?</h2><p>Quais características dos municípios de Alagoas andam junto com a cobertura vacinal, e essa relação é a mesma em todo o estado? Primeiro se confere se as explicativas se repetem entre si (VIF). Depois se ajusta um modelo único (OLS) e se olha se os resíduos têm padrão no mapa (I de Moran). Por fim, a regressão geograficamente ponderada (GWR; Brunsdon, Fotheringham e Charlton, 1996) ajusta um modelo por município, com mais peso para os vizinhos próximos.</p>" +
      "<p>Ele vem depois da varredura de Kulldorff (método 6). Os métodos anteriores descrevem onde há padrão e grupos de risco; este pergunta que fatores se associam à cobertura e se essa associação muda de lugar para lugar.</p></div>" +
      "<div class='callout alert'><b>Atenção</b>Os valores deste simulador são fictícios e sorteados, sem relação com os municípios reais. A resposta (cobertura) e as explicativas (IDHM, IVS, analfabetismo, renda e cobertura da ESF) foram geradas para o exemplo; o efeito da ESF foi construído para variar de oeste para leste, de modo que o GWR tenha algo a mostrar. Só o desenho dos municípios (malha do IBGE) é real.</div><p>A simulação está no topo desta página. As perguntas frequentes ficam no final.</p>";
  }
  function tabDados() {
    var rows = G.map(function (f, i) { return "<tr><td>" + NAMES[i] + "</td><td class=num>" + f1(Y[i]) + "</td><td class=num>" + f3(D.gwr.idhm[i]) + "</td><td class=num>" + f3(D.gwr.ivs[i]) + "</td><td class=num>" + f1(D.gwr.analf[i]) + "</td><td class=num>" + f0(D.gwr.renda[i]) + "</td><td class=num>" + f1(D.gwr.esf[i]) + "</td></tr>"; }).join("");
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Variável</th><th>Papel</th><th>Origem aqui</th></tr><tr><td>Malha municipal</td><td>geometria, centroides e vizinhança</td><td>IBGE, 2025 (real)</td></tr><tr><td>Cobertura vacinal</td><td>resposta</td><td>sorteada, com efeito de ESF que varia de oeste para leste</td></tr><tr><td>IDHM</td><td>explicativa</td><td>sorteada, ligada a um fator comum com IVS e renda</td></tr><tr><td>IVS</td><td>explicativa</td><td>sorteada, ligada ao mesmo fator (correlação negativa com o IDHM)</td></tr><tr><td>Analfabetismo (%)</td><td>explicativa</td><td>sorteada, com campo próprio</td></tr><tr><td>Renda (R$)</td><td>explicativa</td><td>sorteada, ligada ao mesmo fator do IDHM</td></tr><tr><td>Cobertura da ESF (%)</td><td>explicativa</td><td>sorteada, com campo próprio</td></tr></table></div>" +
      "<p>IDHM, IVS e renda foram feitos de propósito para andarem juntos, para o VIF ter o que detectar. A cobertura vacinal inclui um efeito regional não medido, para o OLS deixar sobra no mapa, e os valores acima de 100% não são cortados. As explicativas entram nos modelos padronizadas (média 0, desvio-padrão 1). O gerador, com semente fixa, está em <code>tests/gen_spatial_data.js</code> (bloco do método 7, que não altera as séries dos outros métodos). Valores sorteados, sem relação com os municípios reais.</p></div>" +
      "<details class=tech><summary>Tabela dos 102 municípios (valores fictícios)</summary><div class=scroll-box><table><tr><th>Município</th><th class=num>Cobertura (%)</th><th class=num>IDHM</th><th class=num>IVS</th><th class=num>Analfabetismo (%)</th><th class=num>Renda (R$)</th><th class=num>ESF (%)</th></tr>" + rows + "</table></div></details>";
  }
  function tabResultado() {
    var md = MD(3), g = GW(3, md.kb), pm = PERM(3, 999), o = md.ols, md5 = MD(5);
    var rows = [0, 1, 2, 3].map(function (a) {
      var t = g.t.map(function (r) { return Math.abs(r[a]); }), b = g.beta.map(function (r) { return r[a]; });
      return "<tr>" + td(cname(md, a)) + td(f2(o.beta[a]), 1) + td(f2(Math.min.apply(null, b)) + " a " + f2(Math.max.apply(null, b)), 1) + td(String(t.filter(function (v) { return v > md.crit0; }).length), 1) + td(String(t.filter(function (v) { return v > md.critB; }).length), 1) + "</tr>";
    });
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Uma tabela de VIF, o ajuste global (OLS) com o mapa dos resíduos e o I de Moran deles, a escolha da banda do GWR, e mapas dos coeficientes locais e do R² local. Cada passo responde a uma pergunta.</p><ul><li><b>Pode concluir:</b> se as explicativas se repetem; se o modelo único deixa sobra com padrão no mapa; se o GWR ajusta melhor que o OLS pelo AICc; e onde, neste modelo, os coeficientes locais são destacados em relação ao erro-padrão aproximado.</li><li><b>Não pode concluir:</b> que uma explicativa causa a cobertura; que o efeito vale para crianças individuais; nem que todo município colorido tenha efeito real, por causa dos muitos testes ao mesmo tempo.</li></ul></div>" +
      "<div class=card><h3>Exemplo fictício (3 explicativas, semente " + SEED + ")</h3><p>VIF: " + md.vif.map(function (v, j) { return LAB[md.keys[j]] + " " + f2(v.vif); }).join("; ") + ". OLS: R² = " + f3(o.r2) + ", AICc = " + f2(md.aiccOls) + ". I de Moran dos resíduos = " + f3(pm.I) + " (p = " + fmt(pm.p, 3) + " com 999 embaralhamentos). GWR: k = " + md.kb + ", AICc = " + f2(g.aicc) + ", R² = " + f3(g.r2) + ", tr S = " + f1(g.trS) + ".</p>" +
      tbl([["Coeficiente"], ["OLS (pp)", 1], ["GWR: mínimo a máximo (pp)", 1], ["Municípios com |pseudo-t| > " + f2(md.crit0), 1], ["Municípios com |pseudo-t| > " + f2(md.critB) + " (Bonferroni)", 1]], rows) +
      "<p>Com as 5 explicativas, o AICc do GWR é " + f2(md5.curve.best.aicc) + " (k = " + md5.kb + ") contra " + f2(md5.aiccOls) + " do OLS, e o VIF mais alto é " + f2(Math.max.apply(null, md5.vif.map(function (v) { return v.vif; }))) + ".</p></div>";
  }
  function tabLimites() {
    var Ls = ["Os valores do simulador são fictícios; só a geometria é real. O efeito da ESF foi construído para variar no espaço, então o GWR \"encontra\" o que foi colocado.", "n = 102 é pequeno para um modelo com vários coeficientes locais. O GWR aqui é exploratório.", "Os pseudo-t são aproximados: os 102 modelos usam os mesmos dados, as janelas se sobrepõem e a banda é escolhida nos mesmos dados.", "Com " + MD(3).nTests + " testes (modelo de 3 explicativas), alguns municípios aparecem destacados por acaso. O Bonferroni mostrado é só referência de rigor; o ajuste usado na prática é menos conservador e vem do pacote, e não é implementado aqui.", "Colinearidade local: o VIF é global; dentro de uma janela pequena as explicativas podem ficar mais parecidas.", "Resposta limitada de 0 a 100% e cobertura acima de 100%: sem tratamento decidido; os valores acima de 100% não são cortados aqui.", "Análise ecológica: o resultado é por município, não por criança.", "Os mapas de coeficientes sugerem hipóteses; não provam causalidade.", "O centroide representa o município; municípios no limite do estado têm vizinhos só de um lado.", "O I de Moran dos resíduos por permutação é uma aproximação, e a matriz de vizinhança e o número de embaralhamentos são escolhas em aberto."];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + Ls.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var D1 = ["Escopo: 102 municípios de Alagoas, com cobertura vacinal e taxa de abandono como respostas possíveis.", "Cobertura sem teto na base, com bandeiras para acima de 100%, 110% e 120% e abaixo de 50%; o teto de 100% só vale em mapas e médias, com o valor bruto na legenda. Aqui, os valores acima de 100% não são cortados.", "Análise principal com o valor bruto e análise de sensibilidade; denominador abaixo de 1.000 como bandeira.", "Dispensa de submissão ao CEP mantida por ora."];
    var P = ["Quais explicativas manter entre IDHM, IVS e renda (decidir antes de olhar o resultado) e se desempenho da APS e implantação do PEC/CDS entram.", "Qual resposta modelar (cobertura ou taxa de abandono) e como tratar a cobertura acima de 100% e a faixa de 0 a 100%.", "Kernel e critério da banda (AICc ou validação cruzada), e se a banda é adaptativa ou fixa.", "Correção para múltiplos testes nos mapas locais (nenhuma, Bonferroni ou o ajuste do pacote de GWR).", "Matriz de vizinhança e número de embaralhamentos no I de Moran dos resíduos.", "Como tratar municípios com denominador pequeno (por exemplo, ponderar ou agrupar).", "Se, diante de resíduos com padrão, o caminho será o GWR ou outro modelo espacial."];
    return "<div class=card><h2>O que o projeto definiu</h2><ul>" + D1.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>Escolhas que o projeto ainda vai definir</h2><p class=cap>Estas escolhas afetam o resultado e estão em aberto; aqui aparecem as alternativas, sem decisão.</p><ul>" + P.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabFontes() { var r = (NS.refs && NS.refs.gwr) || []; return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>"; }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>Entradas: uma tabela com a resposta e as explicativas de cada município, as coordenadas dos centroides e a malha. Existem pacotes de regressão geograficamente ponderada em Python e em R. <b>Confira a documentação do pacote e da versão que for usar</b>: nomes de funções, kernels, regra de distância, busca da banda e ajuste de múltiplos testes mudam entre versões. Os números não serão idênticos aos deste simulador.</p>" +
      "<h3>A lógica, em pseudocódigo próprio</h3><pre>padronize cada explicativa (média 0, desvio-padrão 1); X = [1, explicativas]\n\nVIF: para cada explicativa k:\n  R2_k = R² da regressão de k contra as outras explicativas\n  VIF_k = 1 / (1 − R2_k)\n\nOLS: resolva (X'X) b = X'y\n  resíduo e = y − X b; RSS = soma de e²\n  I de Moran dos resíduos; p por permutação = (R + 1) / (M + 1)\n\nGWR, para um k dado:\n  para cada município i:\n    ordene os municípios por distância a i (x multiplicado por cos(lat média))\n    b_i = distância ao k-ésimo mais próximo (i é o 1º)\n    w_ij = (1 − (d_ij / b_i)²)² se d_ij &lt; b_i; senão 0\n    A = soma_j w_ij x_j x_j'; r = soma_j w_ij x_j y_j\n    beta_i = solução de A beta_i = r\n    S_ii = x_i' A⁻¹ x_i\n  RSS = soma_i (y_i − x_i beta_i)²; trS = soma_i S_ii\n  AICc = 2 n ln(√(RSS / n)) + n ln(2π) + n (n + trS) / (n − 2 − trS)\nescolha o k de menor AICc (varra k de 20 a n)\n\npseudo-t_ij = beta_ij / erro-padrão local\n  variância residual = RSS / (n − 2 trS + tr(S'S))\n  corte sem correção: 1,96; Bonferroni ingênuo: normal com 0,05 / (n × nº de coeficientes)</pre>" +
      "<h3>Conferência neste repositório</h3><p>O arquivo <code>tests/check_gwr.py</code> refaz em Python (shapely, numpy e scipy) os centroides e o plano das distâncias, os VIF por regressões auxiliares, o OLS (mínimos quadrados do numpy), os resíduos, o I de Moran dos resíduos com a mesma semente, o GWR completo (pesos bisquare adaptativos, coeficientes, tr S, erros-padrão, pseudo-t, R² local), o AICc de cada k, a escolha da banda e os cortes de significância.</p><pre>node tests/dump_gwr.js &gt; gwr_js.json\npython3 tests/check_gwr.py gwr_js.json</pre></div>";
  }
  function tabFaq() { return "<div class=card>" + STEPS.map(function (x) { return "<h3>" + x.q + "</h3><p>" + x.a + "</p>"; }).join("") + "<h3>O que é “semente fixa”?</h3><p>É o ponto de partida do sorteio. Com a mesma semente, o sorteio sai igual toda vez, e por isso o resultado pode ser conferido e repetido.</p><h3>O que é o pseudo-t?</h3><p>É o coeficiente local dividido pelo erro-padrão local. Ele não segue exatamente a distribuição t por causa da sobreposição das janelas e da escolha da banda nos mesmos dados; por isso é lido como referência.</p><h3>Por que aparecem nomes de municípios reais?</h3><p>Para o mapa ser reconhecível. Os valores, porém, são sorteados e não têm relação com os municípios reais; nada aqui descreve a cobertura de um município.</p><h3>Por que não usar só o GWR?</h3><p>Porque o GWR gasta muita flexibilidade com poucos municípios. O passo 6 compara o ganho com esse custo (AICc), e o passo 8 lista os cuidados.</p></div>"; }

  NS.methods.gwr = {
    id: "gwr", n: 7, nome: "VIF, OLS e GWR", ready: true, steps: STEPS.length, count: function () { return STEPS.length; },
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
    }
  };
})();
