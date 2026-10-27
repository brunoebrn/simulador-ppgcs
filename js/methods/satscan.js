/* Método 6: Varredura espacial de Kulldorff (SaTScan), modelo de Poisson, alto risco, puramente espacial.
   Núcleo numérico em js/spatial_core.js (S.planar, S.scanOrder, S.scanSetup, S.scanBest, S.scanAll, S.scanClusters, S.scanSampler, S.scanMC); mapa em js/charts.js (NS.charts.mapa).
   Geometria real dos 102 municípios de Alagoas (IBGE 2025); VALORES 100% fictícios (js/spatial_data.js), sem relação com os municípios reais. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var S = NS.spatial, C = NS.charts, clock = NS.clock, fmt = C.fmt, el = C.el;
  var G = NS.geo.features, D = NS.spatial_data, N = G.length, SEED = 2026, ALPHA = 0.05;
  var NAMES = G.map(function (f) { return f.properties.n; });
  /* Dados do scan: população = nascidos vivos fictícios; casos = crianças não vacinadas fictícias = arredondamento de nasc × (1 − cobertura limitada a 100%). */
  var POP = D.nasc, CASOS = D.nasc.map(function (n, i) { return Math.round(n * (1 - Math.min(D.cob[i], 100) / 100)); });
  var CT = S.sum(CASOS), PT = S.sum(POP), PL = S.planar(G), ORD = S.scanOrder(PL);
  var RISK = CASOS.map(function (c, i) { return 100 * c / POP[i]; }), RBR = S.quantileBreaks(RISK, 5);
  var MXS = [50, 25, 10];
  var cache = {};
  function TS(mx) { return cache["t" + mx] || (cache["t" + mx] = S.scanSetup(ORD, POP, mx / 100)); }
  function RS(mx) {
    var k = "r" + mx; if (cache[k]) return cache[k];
    var T = TS(mx), all = S.scanAll(T, CASOS), cl = S.scanClusters(T, all, 12);
    return (cache[k] = { T: T, all: all, cl: cl, best: cl[0] });
  }
  function MCR(mx, M) { var k = "m" + mx + "_" + M; return cache[k] || (cache[k] = S.scanMC(TS(mx), CASOS, M, SEED, RS(mx).best.llr)); }
  function putMC(mx, M, sims, R) { cache["m" + mx + "_" + M] = { M: M, seed: SEED, R: R, p: (R + 1) / (M + 1), sims: sims, obs: RS(mx).best.llr }; }
  function pOf(llr, mc) { var R = 0; for (var i = 0; i < mc.M; i++) if (mc.sims[i] >= llr) R++; return { R: R, p: (R + 1) / (mc.M + 1) }; }
  function winAt(T, ctr, k) { var o = T.ord[ctr], c = 0, i; for (i = 0; i < k; i++) c += CASOS[o[i]]; var pop = T.cum[ctr][k - 1], E = CT * pop / PT; return { ctr: ctr, k: k, c: c, pop: pop, E: E, llr: S.llrPoisson(c, E, CT) }; }

  function f0(x) { return fmt(x, 0); } function f1(x) { return fmt(x, 1); } function f2(x) { return fmt(x, 2); } function f3(x) { return fmt(x, 3); }
  function pdig(M) { return String(M + 1).length - 1; }
  function fp(p, M) { return fmt(p, pdig(M)); }
  function pform(R, M) { return "(" + R + " + 1) ÷ (" + M + " + 1) = " + fp((R + 1) / (M + 1), M); }
  function pc(x, d) { return fmt(100 * x, d == null ? 1 : d) + "%"; }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function aviso(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Valores sorteados, sem relação com os municípios reais. Só o desenho dos municípios é real. A população e os casos são fictícios."; stage.appendChild(p); }
  function avisoToy(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Sete municípios inventados para treinar a conta, sem relação com lugares reais."; stage.appendChild(p); }
  function legend(items) { var d = document.createElement("div"); d.className = "legend"; d.innerHTML = items.map(function (i) { return "<span><i class='sq " + i[0] + "'></i>" + i[1] + "</span>"; }).join(""); return d; }
  function info(stage) { var p = document.createElement("p"); p.className = "sum"; p.setAttribute("aria-live", "polite"); p.style.margin = "4px 6px"; stage.appendChild(p); return p; }
  function setCls(m, i, c) { m.paths[i].setAttribute("class", c); }
  function mapa(parent, o) { return C.mapa(parent, o); }
  function nice(range) { var raw = range / 4, s = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000], i; for (i = 0; i < s.length; i++) if (s[i] >= raw) return s[i]; return 10000; }
  function names(T, ctr, k) { return T.ord[ctr].slice(0, k).map(function (j) { return NAMES[j]; }); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function riskCls(i) { return "q" + S.classOf(RISK[i], RBR); }
  var LEGR = [["sw0", "menos não vacinadas"], ["sw2", "intermediário"], ["sw4", "mais não vacinadas"]];

  /* Círculo da janela sobre o mapa: centro no centroide, raio = distância (no plano) ao k-ésimo município × escala do mapa. */
  function winCircle(mp) {
    var c = el("circle", { r: 0, "class": "win", cx: 0, cy: 0 }, mp.g);
    return { set: function (T, ctr, k) { c.setAttribute("cx", mp.cs[ctr][0].toFixed(1)); c.setAttribute("cy", mp.cs[ctr][1].toFixed(1)); c.setAttribute("r", Math.max(3, T.dist[ctr][k - 1] * mp.P.scale).toFixed(1)); }, hide: function () { c.setAttribute("r", 0); } };
  }

  /* ---------- exemplo mínimo: sete municípios fictícios A a G, plano comum (distância em linha reta) ---------- */
  var LET = "ABCDEFG";
  var TOY = { xy: { x: [0.4, 1.3, 2.3, 1.9, 3.8, 4.7, 3.9], y: [1.8, 1.0, 1.4, 2.5, 0.6, 1.7, 2.7] }, pop: [400, 600, 500, 300, 700, 800, 500], cases: [20, 45, 40, 18, 14, 16, 12] };
  TOY.ord = S.scanOrder(TOY.xy); TOY.T = S.scanSetup(TOY.ord, TOY.pop, 0.5); TOY.C = S.sum(TOY.cases); TOY.P = S.sum(TOY.pop);
  TOY.all = S.scanAll(TOY.T, TOY.cases); TOY.cl = S.scanClusters(TOY.T, TOY.all, 5); TOY.best = TOY.cl[0];
  TOY.E = TOY.pop.map(function (p) { return TOY.C * p / TOY.P; });
  function tw(T, ctr, k) { var o = T.ord[ctr], c = 0, i; for (i = 0; i < k; i++) c += TOY.cases[o[i]]; var pop = T.cum[ctr][k - 1], E = TOY.C * pop / TOY.P; return { ctr: ctr, k: k, c: c, pop: pop, E: E, llr: S.llrPoisson(c, E, TOY.C) }; }
  function tl(ctr, k) { return TOY.T.ord[ctr].slice(0, k).map(function (j) { return LET[j]; }).join(", "); }
  var TOYB = 1; /* centro do exemplo de janela crescendo: B */

  /* Gráfico do exemplo: municípios como círculos, janelas como circunferências. */
  function toyFig(stage, k) {
    var w = Math.max(280, Math.min(460, C.width(stage))), s = (w - 36) / 4.8, h = Math.round(2.6 * s + 30), T = TOY.T;
    var X = function (x) { return 18 + (x - 0.1) * s; }, Y = function (y) { return h - 16 - (y - 0.3) * s; };
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Sete municípios fictícios, A a G, e as janelas circulares do exemplo" }, stage);
    function ring(ctr, kk, cls) { el("circle", { cx: X(TOY.xy.x[ctr]), cy: Y(TOY.xy.y[ctr]), r: T.dist[ctr][kk - 1] * s + 0.01, "class": cls, fill: "none" }, svg); }
    var inside = {};
    if (k === 2) { ring(TOYB, 2, "win"); tl(TOYB, 2).split(", ").forEach(function (q) { inside[LET.indexOf(q)] = 1; }); }
    if (k === 3) { for (var q = 2; q <= 5; q++) { var ok = q <= T.kmax[TOYB]; ring(TOYB, q, ok ? "win" : "win out"); } T.ord[TOYB].slice(0, T.kmax[TOYB]).forEach(function (j) { inside[j] = 1; }); }
    if (k >= 4) { var b = TOY.best; ring(b.ctr, b.k, "win"); b.members.forEach(function (j) { inside[j] = 1; }); }
    TOY.pop.forEach(function (p, i) {
      var cls = k >= 5 && inside[i] ? "qd0" : inside[i] ? "tin" : "tout";
      el("circle", { cx: X(TOY.xy.x[i]), cy: Y(TOY.xy.y[i]), r: 15, "class": cls, stroke: "var(--text)", "stroke-width": i === TOYB && k === 3 ? 3 : 1.4 }, svg);
      el("text", { x: X(TOY.xy.x[i]), y: Y(TOY.xy.y[i]) + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: cls === "qd0" ? "#fff" : "currentColor" }, svg, LET[i]);
      el("text", { x: X(TOY.xy.x[i]), y: Y(TOY.xy.y[i]) + 31, "text-anchor": "middle", "font-size": 11, "class": "muted" }, svg, TOY.cases[i] + "/" + TOY.pop[i]);
    });
    return svg;
  }

  /* Curva da LLR conforme a janela cresce (passo 3). */
  function llrCurve(parent, curve) {
    var w = C.width(parent), h = 230, m = { l: 48, r: 14, t: 24, b: 42 }, n = curve.length, ymax = Math.max.apply(null, curve) * 1.1 || 1, st = nice(ymax), top = Math.ceil(ymax / st) * st;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "LLR de cada janela conforme o círculo cresce ao redor do centro" }, parent);
    var X = function (k) { return m.l + (w - m.l - m.r) * (n === 1 ? .5 : (k - 1) / (n - 1)); }, Y = function (v) { return m.t + (h - m.t - m.b) * (1 - v / top); };
    var gA = el("g", { "class": "axis" }, svg), t;
    for (t = 0; t <= top + 1e-9; t += st) { el("line", { x1: m.l, x2: w - m.r, y1: Y(t), y2: Y(t), stroke: "var(--line)" }, gA); el("text", { x: m.l - 6, y: Y(t) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, f0(t)); }
    var ev = n > 30 ? 10 : n > 12 ? 5 : 1; for (t = 1; t <= n; t++) if (t === 1 || t % ev === 0 || t === n) el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, String(t));
    el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, "tamanho da janela (nº de municípios, k)");
    el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, gA, "LLR");
    var path = el("path", { d: "", fill: "none", stroke: "var(--drw)", "stroke-width": 2.4 }, svg), dot = el("circle", { r: 5, fill: "var(--drw)", stroke: "var(--bg)", "stroke-width": 1.5, cx: -10, cy: -10 }, svg), mx = el("circle", { r: 7, fill: "none", stroke: "var(--text)", "stroke-width": 2, cx: -10, cy: -10 }, svg);
    return { svg: svg, upTo: function (k, bestK) { var d = ""; for (var i = 1; i <= k; i++) d += (i > 1 ? "L" : "M") + X(i).toFixed(1) + " " + Y(curve[i - 1]).toFixed(1); path.setAttribute("d", d); dot.setAttribute("cx", X(k).toFixed(1)); dot.setAttribute("cy", Y(curve[k - 1]).toFixed(1)); if (bestK) { mx.setAttribute("cx", X(bestK).toFixed(1)); mx.setAttribute("cy", Y(curve[bestK - 1]).toFixed(1)); } } };
  }

  /* Histograma das LLR máximas das réplicas; o eixo cresce quando aparece valor maior. A LLR observada fica fora do gráfico se passar do limite. */
  function mcHist(parent, obs) {
    var w = C.width(parent), h = 230, m = { l: 46, r: 14, t: 24, b: 42 }, nb = 30, hi = 10, lo = 0, vals = [], ymax = 6, counts = new Array(nb).fill(0), rects = [];
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Histograma da LLR máxima de cada réplica do Monte Carlo, com a LLR observada" }, parent), gA = el("g", { "class": "axis" }, svg), gB = el("g", {}, svg), gO = el("g", {}, svg);
    var X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hi - lo); }, Y = function (c) { return m.t + (h - m.t - m.b) * (1 - c / ymax); };
    function bar(b) {
      var bw = (hi - lo) / nb; if (!rects[b]) rects[b] = el("rect", {}, gB);
      var r = rects[b]; r.setAttribute("class", lo + b * bw >= obs ? "bar-hit" : "bar"); r.setAttribute("x", (X(lo + b * bw) + 1).toFixed(1)); r.setAttribute("width", Math.max(1, X(lo + (b + 1) * bw) - X(lo + b * bw) - 2).toFixed(1));
      r.setAttribute("y", Y(counts[b]).toFixed(1)); r.setAttribute("height", (h - m.b - Y(counts[b])).toFixed(1));
    }
    function recount() { var bw = (hi - lo) / nb; counts.fill(0); vals.forEach(function (v) { counts[Math.min(nb - 1, Math.floor((v - lo) / bw))]++; }); }
    function draw() {
      var st = nice(hi - lo), t, b; gA.textContent = ""; gB.textContent = ""; gO.textContent = ""; rects = [];
      el("line", { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b }, gA); el("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b }, gA);
      for (t = 0; t <= hi + 1e-9; t += st) el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, f0(t));
      [0, ymax].forEach(function (c) { el("text", { x: m.l - 6, y: Y(c) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, String(c)); });
      el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, "maior LLR de cada réplica");
      el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, gA, "nº de réplicas");
      for (b = 0; b < nb; b++) if (counts[b]) bar(b);
      if (obs <= hi) { el("line", { x1: X(obs), x2: X(obs), y1: m.t, y2: h - m.b, "class": "obs" }, gO); el("text", { x: X(obs) - 6, y: m.t + 12, "text-anchor": "end", "font-size": 12, "font-weight": 700 }, gO, "LLR observada = " + f2(obs)); }
      else el("text", { x: w - m.r - 2, y: m.t + 12, "text-anchor": "end", "font-size": 12, "font-weight": 700 }, gO, "LLR observada = " + f1(obs) + " (fora do gráfico, à direita) →");
    }
    draw();
    return { svg: svg, add: function (v) {
      vals.push(v);
      if (v >= hi) { var top = v * 1.25, st = nice(top); hi = Math.ceil(top / st) * st; recount(); draw(); return; }
      var b = Math.min(nb - 1, Math.floor((v - lo) / ((hi - lo) / nb))); counts[b]++;
      if (counts[b] > ymax) { ymax = Math.ceil(counts[b] * 1.5); draw(); } else bar(b);
    } };
  }

  /* ---------- passos ---------- */
  var STEPS = [
    { t: "A pergunta: existe um grupo com risco maior que o de fora?",
      kid: "O Moran local (método 5) olha cada município e pergunta se ele se parece com os vizinhos. A varredura de Kulldorff faz outra pergunta: existe algum grupo de municípios vizinhos, dentro de um círculo, em que o risco é maior do que no resto do estado? Aqui o \"risco\" é a proporção de crianças não vacinadas. O computador testa círculos de todos os tamanhos ao redor de cada município e fica com o círculo que mais se destaca. Depois confere, com sorteios, se esse destaque é grande demais para ser acaso.",
      pc: function () { return "Para cada um dos 102 municípios, desenha um círculo que começa só com ele e vai incluindo o vizinho mais próximo, depois o seguinte, e assim por diante, até chegar a um tamanho máximo (passos 3 e 4). Em cada círculo compara o risco de dentro com o de fora. Fica com o círculo mais destacado e testa o resultado por sorteio (passo 5)."; },
      conta: function (s) {
        var rs = RS(s.mx), T = rs.T;
        return "<span class=eq>População (nascidos vivos fictícios): <b>" + f0(PT) + "</b>; casos (crianças não vacinadas fictícias): <b>" + f0(CT) + "</b></span><span class=eq>Risco geral = " + f0(CT) + " ÷ " + f0(PT) + " = <b>" + f2(100 * CT / PT) + " por 100</b> nascidos vivos</span><span class=eq>Círculos a testar com o limite de <b>" + s.mx + "%</b> da população: <b>" + f0(T.nWindows) + "</b> (102 centros)</span>" +
          "<div class=tbl-wrap><table><tr><th>Método</th><th>Pergunta</th></tr><tr><td>Moran local (método 5)</td><td>Cada município é parecido com seus vizinhos?</td></tr><tr><td>Varredura de Kulldorff (este)</td><td>Existe um grupo de locais com risco maior que fora?</td></tr></table></div>" +
          "<p>Os casos fictícios foram calculados assim: nascidos vivos × (1 − cobertura limitada a 100%), arredondado. O passo 7 mostra o que muda com o tamanho máximo.</p>";
      },
      tech: function () { return "<p>A estatística de varredura espacial (Kulldorff, 1997) usa janelas circulares centradas em cada centroide, com raio que cresce de zero até um máximo (recomendado e máximo: 50% da população em risco). Cada janela é uma candidata a aglomerado. A razão de verossimilhança (LLR) compara o risco dentro com o risco fora. No modelo de Poisson, o número esperado de casos é proporcional à população; no de Bernoulli há casos e controles. Este simulador usa Poisson, só aglomerados de risco alto, e a análise é puramente espacial (sem tempo). <b>Distância:</b> entre os centroides dos municípios, em um plano em que a longitude é multiplicada pelo cosseno da latitude média dos centroides (a mesma regra usada nos k vizinhos mais próximos do simulador). É uma aproximação do simulador; para as opções de coordenadas do SaTScan, consulte o guia do usuário.</p>"; },
      q: "Qual a diferença entre o Moran local e a varredura de Kulldorff?", a: "O Moran local compara cada município com seus vizinhos imediatos. A varredura procura um grupo circular, de qualquer tamanho até um limite, com risco maior do que o de fora. Os dois respondem a perguntas diferentes e podem apontar lugares diferentes.",
      viz: function (stage, ctl, state) {
        var rs = RS(state.mx), b = rs.best, mc = MCR(state.mx, 999), inB = {}; b.members.forEach(function (j) { inB[j] = 1; });
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), c = document.createElement("div"); grid.appendChild(a); grid.appendChild(c);
        a.innerHTML = "<p class=cap>Ponto de partida: crianças não vacinadas por 100 nascidos vivos (quintis)</p>"; c.innerHTML = "<p class=cap>Onde vamos chegar: o círculo mais destacado (limite " + state.mx + "%, 999 sorteios)</p>";
        mapa(a, { w: a.clientWidth, cls: riskCls, label: "Mapa de Alagoas com a proporção fictícia de crianças não vacinadas em cinco faixas", titles: function (i) { return f1(RISK[i]) + " por 100"; } });
        var mp = mapa(c, { w: c.clientWidth, cls: function (i) { return inB[i] ? "qd0" : "qe"; }, label: "Mapa com o aglomerado mais provável da varredura", titles: function (i) { return inB[i] ? "dentro do aglomerado mais provável" : ""; } });
        winCircle(mp).set(rs.T, b.ctr, b.k);
        stage.appendChild(legend(LEGR)); stage.appendChild(legend([["swq0", "dentro do aglomerado mais provável"], ["swqe", "fora"]])); aviso(stage);
        cap(stage, "À esquerda, o risco fictício de cada município. À direita, o resultado do método: o círculo tracejado e os municípios dentro dele. Valor p do aglomerado: " + fp(mc.p, 999) + " (999 sorteios).");
      } },

    { t: "A conta com sete municípios (A a G)",
      kid: "Fazemos a varredura à mão com sete municípios inventados. Cada um tem uma população e um número de casos. Primeiro calculamos quantos casos seriam esperados em cada lugar se o risco fosse igual em todo canto. Depois montamos um círculo, calculamos a razão de verossimilhança (LLR), que mede o quanto o círculo se destaca, e comparamos todos os círculos. A maior LLR vence.",
      pc: function () { return "Soma casos e população de cada círculo, calcula o esperado, compara o que aconteceu dentro com o esperado e calcula a LLR. Faz isso para todos os círculos (com limite de 50% da população) de todos os centros e guarda o de maior LLR."; },
      conta: function (s) {
        var k = s.sub, T = TOY.T, C0 = TOY.C, P0 = TOY.P, i, html = "", bw, best = TOY.best;
        if (k === 1) {
          var rows = TOY.pop.map(function (p, j) { return "<tr><td>" + LET[j] + "</td><td class=num>" + f0(p) + "</td><td class=num>" + TOY.cases[j] + "</td><td class=num>" + f2(100 * TOY.cases[j] / p) + "</td><td class=num>" + f2(TOY.E[j]) + "</td></tr>"; }).join("");
          return "<span class=eq>População total P = <b>" + f0(P0) + "</b>; casos totais C = <b>" + C0 + "</b></span><span class=eq>Risco geral = C ÷ P = " + C0 + " ÷ " + f0(P0) + " = <b>" + f2(100 * C0 / P0) + " por 100</b></span><span class=eq>Esperado em A = C × população de A ÷ P = " + C0 + " × " + TOY.pop[0] + " ÷ " + f0(P0) + " = <b>" + f2(TOY.E[0]) + "</b></span>" +
            "<div class=tbl-wrap><table><tr><th>Município</th><th class=num>População</th><th class=num>Casos</th><th class=num>Casos por 100</th><th class=num>Esperado</th></tr>" + rows + "</table></div><p>Esperado: quantos casos o município teria se o risco fosse o geral, " + f2(100 * C0 / P0) + " por 100, em todo lugar.</p>";
        }
        if (k === 2) {
          var w = tw(T, TOYB, 2), w0 = tw(T, 4, 2), ca = w.c * Math.log(w.c / w.E), cb = (C0 - w.c) * Math.log((C0 - w.c) / (C0 - w.E));
          return "<p><b>Círculo com B e C</b> (centro B, os dois mais próximos).</p><span class=eq>Dentro: população = " + TOY.pop[1] + " + " + TOY.pop[2] + " = <b>" + f0(w.pop) + "</b>; casos c = " + TOY.cases[1] + " + " + TOY.cases[2] + " = <b>" + w.c + "</b></span><span class=eq>Esperado dentro: E = " + C0 + " × " + f0(w.pop) + " ÷ " + f0(P0) + " = <b>" + f2(w.E) + "</b>. Como c = " + w.c + " é maior que E, o círculo tem risco acima do esperado</span>" +
            "<span class=eq>LLR = c · ln(c ÷ E) + (C − c) · ln((C − c) ÷ (C − E))</span><span class=eq>= " + w.c + " · ln(" + w.c + " ÷ " + f2(w.E) + ") + " + (C0 - w.c) + " · ln(" + (C0 - w.c) + " ÷ " + f2(C0 - w.E) + ")</span><span class=eq>= " + f3(ca) + " + (" + f3(cb) + ") = <b>" + f3(w.llr) + "</b></span>" +
            "<span class=eq>Risco relativo = (c ÷ população dentro) ÷ ((C − c) ÷ população fora) = (" + w.c + " ÷ " + f0(w.pop) + ") ÷ (" + (C0 - w.c) + " ÷ " + f0(P0 - w.pop) + ") = <b>" + f2(S.scanRR(w.c, w.pop, C0, P0)) + "</b></span>" +
            "<p><b>Círculo com E e F</b> (centro E): c = " + w0.c + ", E = " + f2(w0.E) + ". Como c não é maior que E, o risco de dentro não é maior que o geral e a LLR de alto risco vale <b>0</b>.</p>";
        }
        if (k === 3) {
          var rows3 = "", ord = T.ord[TOYB], cum = 0, cs = 0;
          for (i = 1; i <= 5; i++) {
            var okw = i <= T.kmax[TOYB], ww = tw(T, TOYB, Math.min(i, T.n));
            rows3 += "<tr><td class=num>" + i + "</td><td>" + tl(TOYB, i) + "</td><td class=num>" + f0(ww.pop) + "</td><td class=num>" + pc(ww.pop / P0, 0) + "</td>" + (okw ? "<td class=num>" + ww.c + "</td><td class=num>" + f2(ww.E) + "</td><td class=num>" + f3(ww.llr) + "</td>" : "<td colspan=3>fora do limite: " + f0(ww.pop) + " &gt; " + f0(0.5 * P0) + " (50% da população)</td>") + "</tr>";
          }
          return "<p>Centro em <b>B</b>. O círculo cresce incluindo o vizinho mais próximo de cada vez (a ordem é por distância).</p><div class=tbl-wrap><table><tr><th class=num>k</th><th>Municípios</th><th class=num>População</th><th class=num>% do total</th><th class=num>Casos</th><th class=num>Esperado</th><th class=num>LLR</th></tr>" + rows3 + "</table></div><p>O limite de 50% da população (" + f0(0.5 * P0) + ") barra os círculos maiores. Cada centro tem, assim, um número de círculos válidos: A " + T.kmax[0] + ", B " + T.kmax[1] + ", C " + T.kmax[2] + ", D " + T.kmax[3] + ", E " + T.kmax[4] + ", F " + T.kmax[5] + ", G " + T.kmax[6] + " (total " + T.nWindows + ").</p>";
        }
        if (k === 4) {
          var rows4 = TOY.all.byCtr.map(function (b, j) { return "<tr><td>" + LET[j] + "</td><td class=num>" + T.kmax[j] + "</td><td>" + (b.k ? tl(j, b.k) : "nenhum") + "</td><td class=num>" + f3(b.llr) + "</td></tr>"; }).join("");
          var same = TOY.all.byCtr.map(function (b, j) { return b.llr === best.llr || Math.abs(b.llr - best.llr) < 1e-9 ? LET[j] : ""; }).filter(Boolean);
          return "<div class=tbl-wrap><table><tr><th>Centro</th><th class=num>Círculos válidos</th><th>Melhor círculo do centro</th><th class=num>LLR</th></tr>" + rows4 + "</table></div><span class=eq>Maior LLR de todas: <b>" + f3(best.llr) + "</b>, círculo { " + best.members.map(function (j) { return LET[j]; }).join(", ") + " }</span>" +
            (same.length > 1 ? "<p>Os centros " + same.join(", ") + " chegam ao mesmo conjunto de municípios. Vale o primeiro centro na ordem (" + LET[best.ctr] + ").</p>" : "");
        }
        return "<span class=eq>Aglomerado mais provável: { <b>" + best.members.map(function (j) { return LET[j]; }).join(", ") + "</b> }, centro " + LET[best.ctr] + ", LLR = <b>" + f3(best.llr) + "</b></span><span class=eq>Casos dentro = " + best.c + " (esperado " + f2(best.E) + "); risco relativo = <b>" + f2(best.rr) + "</b></span>" +
          "<p>" + (TOY.cl.length > 1 ? "Aglomerados seguintes (sem municípios em comum): " + TOY.cl.slice(1).map(function (c) { return "{ " + c.members.map(function (j) { return LET[j]; }).join(", ") + " } com LLR " + f3(c.llr); }).join("; ") + "." : "Não há outro aglomerado: sobraram " + LET.split("").filter(function (_, j) { return best.members.indexOf(j) < 0; }).join(", ") + ", com risco abaixo do esperado, e a LLR de alto risco deles é 0.") + "</p><p>Quão raro seria esse LLR ao acaso? Isso o exemplo não responde: é o trabalho do teste por sorteio (Monte Carlo), no passo 5, com os 102 municípios.</p>";
      },
      tech: function () { return "<p>Por centro, os municípios são ordenados por distância (empate: menor posição na lista) e a janela de k municípios são os k primeiros. A janela vale se a população acumulada é no máximo 50% da população total. Para cada janela com população <i>p</i> e casos <i>c</i>: E = C · <i>p</i> / P, e, quando c &gt; E, LLR = c · ln(c / E) + (C − c) · ln((C − c) / (C − E)); caso contrário, 0 (alto risco apenas). Se c = C, o segundo termo vale 0. O risco relativo é o risco dentro dividido pelo risco fora. No exemplo as distâncias são em linha reta no plano do desenho (sem o fator do cosseno). Janelas de centros diferentes podem ter o mesmo conjunto de municípios.</p>"; },
      q: "Por que o círculo que mais se destaca não é o que tem mais casos?", a: "Porque o que conta é o excesso de casos em relação ao esperado para aquela população. Um círculo grande tem muitos casos só por ter muita gente. A LLR mede o excesso, não o total.",
      viz: function (stage, ctl, state) {
        var k = state.sub; toyFig(stage, k);
        stage.appendChild(legend(k >= 5 ? [["swq0", "aglomerado mais provável"]] : k >= 2 ? [["swn", "dentro do círculo"]] : []));
        cap(stage, k === 1 ? "Cada município mostra casos/população. As distâncias são as do desenho." : k === 2 ? "O círculo tem centro em B e vai até C, o mais próximo de B." : k === 3 ? "Círculos ao redor de B: cada anel inclui mais um vizinho. O anel cinza passa do limite de 50% da população." : k === 4 ? "O círculo de maior LLR entre todos os centros." : "O aglomerado mais provável do exemplo.");
        avisoToy(stage);
      } },

    { t: "Uma janela crescendo em um centro",
      kid: "Aqui vemos o círculo de um só município, crescendo. A cada passo ele inclui o vizinho mais próximo ainda de fora. O número LLR diz o quanto o círculo se destaca: sobe quando o círculo pega municípios com muito risco e cai quando pega municípios de risco baixo. O círculo para de crescer quando chega ao limite de população. Escolha o centro no mapa ou na lista.",
      pc: function () { return "Pega o município escolhido, ordena os outros por distância e vai aumentando o círculo um município por vez. Em cada tamanho, soma população e casos, calcula o esperado e a LLR. Quando chega ao limite de população, para e guarda o tamanho de maior LLR."; },
      conta: function (s) {
        var rs = RS(s.mx), T = rs.T, ctr = s.sel == null ? rs.best.ctr : s.sel, curve = [], i, km = T.kmax[ctr], bk = 1;
        for (i = 1; i <= km; i++) { var l = winAt(T, ctr, i).llr; curve.push(l); if (l > curve[bk - 1]) bk = i; }
        var k = (cache.live3 && cache.live3.key === ctr + "_" + s.mx) ? cache.live3.k : km, w = winAt(T, ctr, Math.min(k, km)), ca = w.c > w.E ? w.c * Math.log(w.c / w.E) : 0, cb = w.c > w.E && CT - w.c > 0 ? (CT - w.c) * Math.log((CT - w.c) / (CT - w.E)) : 0;
        return "<span class=eq>Centro: <b>" + NAMES[ctr] + "</b>; limite de tamanho: <b>" + s.mx + "%</b> da população (até " + km + " municípios neste centro)</span><span class=eq>Janela k = <b>" + w.k + "</b>: população <b>" + f0(w.pop) + "</b> (" + pc(w.pop / PT) + " do estado); casos c = <b>" + f0(w.c) + "</b></span><span class=eq>Esperado E = " + f0(CT) + " × " + f0(w.pop) + " ÷ " + f0(PT) + " = <b>" + f1(w.E) + "</b></span>" +
          (w.c > w.E ? "<span class=eq>LLR = " + f0(w.c) + " · ln(" + f0(w.c) + " ÷ " + f1(w.E) + ") + " + f0(CT - w.c) + " · ln(" + f0(CT - w.c) + " ÷ " + f1(CT - w.E) + ") = " + f1(ca) + " + (" + f1(cb) + ") = <b>" + f1(w.llr) + "</b></span><span class=eq>Risco relativo = <b>" + f2(S.scanRR(w.c, w.pop, CT, PT)) + "</b></span>" : "<span class=eq>c não é maior que E: o risco de dentro não passa do geral, LLR = <b>0</b></span>") +
          "<p>Maior LLR deste centro, entre os " + km + " tamanhos: <b>" + f1(curve[bk - 1]) + "</b>, com k = " + bk + ".</p>";
      },
      tech: function () { return "<p>O raio é a distância do centro ao k-ésimo município em ordem de distância; o círculo contém os k primeiros. Com o limite de tamanho, só valem os k tais que a população acumulada é no máximo a fração escolhida (50%, 25% ou 10%) da população total do estado. Observe que a LLR não cresce sempre: ela usa o excesso de casos em relação ao esperado, então entrar em um município de risco baixo a reduz. Como a LLR de alto risco é 0 quando c ≤ E, a curva pode começar em zero.</p>"; },
      q: "Por que o círculo para de crescer?", a: "Porque há um tamanho máximo, para que o círculo não acabe incluindo o estado inteiro. O recomendado e máximo é 50% da população; aqui é possível comparar com 25% e 10%.",
      viz: function (stage, ctl, state, root) {
        var rs = RS(state.mx), T = rs.T, ctr = state.sel == null ? (state.sel = rs.best.ctr) : state.sel, km = T.kmax[ctr], curve = [], i, bk = 1;
        for (i = 1; i <= km; i++) { curve.push(winAt(T, ctr, i).llr); if (curve[i - 1] > curve[bk - 1]) bk = i; }
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>O círculo ao redor de " + esc(NAMES[ctr]) + "</p>"; b.innerHTML = "<p class=cap>LLR conforme o círculo cresce</p>";
        var mp = mapa(a, { w: a.clientWidth, cls: function (j) { return j === ctr ? "drw focus" : "qe"; }, onSel: function (j) { state.sel = j; cache.live3 = null; ctl.redraw(); }, label: "Mapa de Alagoas com o círculo da janela ao redor do centro escolhido", titles: function (j) { return j === ctr ? "centro" : "clique para escolher como centro"; } });
        var wc = winCircle(mp), ch = llrCurve(b, curve), inf = info(stage), k = 0, prev = [];
        function show() {
          var cur = T.ord[ctr].slice(0, k), w = winAt(T, ctr, k);
          cur.forEach(function (j) { setCls(mp, j, "drw clk" + (j === ctr ? " focus" : "")); });
          wc.set(T, ctr, k); ch.upTo(k, null); cache.live3 = { key: ctr + "_" + state.mx, k: k };
          var cn = root.querySelector("[data-live=conta3]"); if (cn) cn.innerHTML = STEPS[2].conta(state);
          inf.textContent = "Círculo com " + k + " de até " + km + " municípios: " + f0(w.c) + " casos para " + f1(w.E) + " esperados; LLR = " + f1(w.llr) + ".";
        }
        function done() { return k >= km; }
        function one() { k++; show(); if (done()) { ch.upTo(k, bk); inf.textContent = "Pronto: o círculo chegou ao limite de " + state.mx + "% da população (" + km + " municípios). Maior LLR deste centro: " + f1(curve[bk - 1]) + ", com k = " + bk + "."; } }
        if (clock.reduced) { while (!done()) one(); } else clock.rateTask(8, one, done);
        stage.appendChild(legend([["swdrw", "dentro do círculo"], ["swqe", "fora"]])); aviso(stage);
        cap(stage, "Clique em outro município para trocá-lo de centro, ou use a lista. O círculo tracejado passa pelo centroide do município que acabou de entrar. Use os controles da animação para pausar, acelerar ou reiniciar.");
      } },

    { t: "Todas as janelas: o aglomerado mais provável",
      kid: "Agora repetimos a conta com todos os 102 municípios como centro, um depois do outro. Cada município recebe uma cor que mostra o quanto o melhor círculo centrado nele se destacou. No fim, o círculo de maior LLR entre todos é o aglomerado mais provável. Nesta etapa ainda não sabemos se ele é grande demais para ser acaso: isso é o passo seguinte.",
      pc: function () { return "Para cada centro, testa todos os círculos válidos e guarda o de maior LLR. Depois escolhe o maior entre os 102. Se dois círculos tiverem a mesma LLR, vale o do centro de menor posição na lista."; },
      conta: function (s) {
        var rs = RS(s.mx), b = rs.best, T = rs.T, w = winAt(T, b.ctr, b.k), pos = rs.all.byCtr.filter(function (x) { return x.llr > 0; }).length;
        return "<span class=eq>Limite: <b>" + s.mx + "%</b> da população; círculos válidos nos 102 centros: <b>" + f0(T.nWindows) + "</b>; com LLR maior que zero: <b>" + f0(rs.all.wins.length) + "</b></span><span class=eq>Centros com algum círculo de LLR positiva: <b>" + pos + "</b> de 102</span>" +
          "<span class=eq>Aglomerado mais provável: centro <b>" + NAMES[b.ctr] + "</b>, <b>" + b.k + "</b> municípios, população " + f0(b.pop) + " (" + pc(b.pop / PT) + " do estado)</span><span class=eq>Casos dentro = " + f0(b.c) + "; esperado = " + f1(b.E) + "; LLR = <b>" + f1(b.llr) + "</b>; risco relativo = <b>" + f2(b.rr) + "</b></span>" +
          "<p>Municípios: " + b.members.map(function (j) { return NAMES[j]; }).join(", ") + ".</p>";
      },
      tech: function () { return "<p>A estatística de varredura é a maior LLR entre todas as janelas de todos os centros. O mapa mostra, por centro, a maior LLR entre as janelas dele, em cinco faixas de tamanho igual (quintis) entre os centros com LLR positiva; centros sem janela de LLR positiva ficam em cinza. Como a maior entre muitas janelas, a LLR observada precisa ser comparada com a distribuição da maior LLR sob a hipótese de risco igual em todo lugar: é isso que o Monte Carlo faz, e por isso o valor p já considera o fato de que muitas janelas foram testadas.</p>"; },
      q: "O aglomerado mais provável é o único?", a: "Não. É só o de maior LLR. Outros círculos, sem municípios em comum com ele, podem ser listados como secundários (passo 6).",
      viz: function (stage, ctl, state, root) {
        var rs = RS(state.mx), T = rs.T, b = rs.best, pos = rs.all.byCtr.map(function (x) { return x.llr; }).filter(function (v) { return v > 0; }), br = S.quantileBreaks(pos, 5), inB = {}; b.members.forEach(function (j) { inB[j] = 1; });
        var inf = info(stage), idx = 0, topL = 0, topC = -1;
        var mp = mapa(stage, { w: stage.clientWidth, cls: function () { return "qe"; }, label: "Mapa com a maior LLR dos círculos centrados em cada município, preenchido centro a centro", titles: function (i) { return "LLR máxima do centro: " + f1(rs.all.byCtr[i].llr); } });
        var wc = winCircle(mp);
        function one() {
          var i = idx++, l = rs.all.byCtr[i].llr; setCls(mp, i, l > 0 ? "q" + S.classOf(l, br) : "qe");
          if (l > topL) { topL = l; topC = i; }
          inf.textContent = "Centro " + (i + 1) + " de " + N + " (" + NAMES[i] + "): melhor círculo com " + (rs.all.byCtr[i].k || 0) + " município(s) e LLR " + f1(l) + ". Maior até agora: " + f1(topL) + " (centro " + (topC >= 0 ? NAMES[topC] : "nenhum") + ").";
          if (done()) {
            b.members.forEach(function (j) { setCls(mp, j, mp.paths[j].getAttribute("class") + " focus"); }); wc.set(T, b.ctr, b.k);
            inf.textContent = "Pronto: aglomerado mais provável com centro em " + NAMES[b.ctr] + ", " + b.k + " municípios e LLR " + f1(b.llr) + ".";
          }
        }
        function done() { return idx >= N; }
        if (clock.reduced) { while (!done()) one(); } else clock.rateTask(12, one, done);
        stage.appendChild(legend([["sw0", "LLR do melhor círculo: menor"], ["sw2", "intermediária"], ["sw4", "maior"], ["swqe", "sem círculo de LLR positiva"]])); stage.appendChild(legend([["swfoc", "contorno e círculo tracejado: aglomerado mais provável"]])); aviso(stage);
        cap(stage, "Cada município ganha a cor da maior LLR entre os círculos centrados nele. No fim, o aglomerado mais provável fica contornado.");
      } },

    { t: "O teste de Monte Carlo",
      kid: "Para saber se o círculo mais destacado é grande demais para ser acaso, o computador refaz o estudo muitas vezes em um mundo em que o risco é igual em todo lugar. Ele pega o mesmo total de casos e sorteia onde cada caso cai, com mais chance onde há mais gente. Em cada sorteio, procura o círculo mais destacado e anota sua LLR. O gráfico acumula essas LLR máximas. Se quase nenhuma chega ao valor verdadeiro, o valor verdadeiro é difícil de explicar só pelo acaso.",
      pc: function () { return "Redistribui os " + "casos ao acaso entre os municípios, com chance proporcional à população (sorteio multinomial). Para cada sorteio, repete a varredura inteira e guarda a maior LLR. Conta R, o número de sorteios com LLR máxima igual ou maior que a verdadeira. O valor p é (R + 1) ÷ (M + 1), sem nunca ser zero."; },
      conta: function (s) {
        var rs = RS(s.mx), b = rs.best, M = s.M, lv = cache.live5 && cache.live5.key === s.mx + "_" + M ? cache.live5 : null;
        return "<span class=eq>Casos a redistribuir: C = <b>" + f0(CT) + "</b> (o total não muda); chance de cada caso cair em um município = população do município ÷ " + f0(PT) + "</span><span class=eq>LLR observada = <b>" + f1(b.llr) + "</b>; M = <b>" + f0(M) + "</b> sorteios; semente fixa " + SEED + "</span>" +
          (lv && lv.done ? "<span class=eq>R = sorteios com LLR máxima ≥ " + f1(b.llr) + " = <b>" + lv.R + "</b></span><span class=eq>p = " + pform(lv.R, M) + "</span>" + (lv.R === 0 ? "<p>Nenhum sorteio chegou ao valor verdadeiro. O menor p possível é 1 ÷ (M + 1) = " + fp(1 / (M + 1), M) + ": escreve-se p menor ou igual a esse valor, nunca p = 0. A maior LLR entre os sorteios foi " + f2(lv.max) + ".</p>" : "") : "<p>Fórmula: p = (R + 1) ÷ (M + 1), em que R conta os sorteios com LLR máxima maior ou igual à observada. O \"+ 1\" conta o próprio resultado verdadeiro como uma das M + 1 possibilidades.</p>") +
          "<p>Mesma semente, mesmo resultado. Com M = 999, o menor p possível é 0,001; com M = 9999, 0,0001.</p>";
      },
      tech: function () { return "<p>Sob a hipótese de risco igual em todo lugar, dado o total C de casos, a distribuição dos casos entre os municípios é multinomial com probabilidades proporcionais à população. Aqui cada caso escolhe um nascido vivo ao acaso entre os " + f0(PT) + " (índice = parte inteira de u × " + f0(PT) + ", com u do gerador mulberry32, semente " + SEED + "), o que dá a multinomial. O fluxo do gerador é contínuo entre as réplicas, então as 999 primeiras réplicas de 9999 são as mesmas de 999. Em cada réplica, a varredura completa dá a maior LLR. R conta as réplicas com maior LLR ≥ à observada; p = (R + 1)/(M + 1). Como a comparação é com a distribuição da <i>maior</i> LLR de todas as janelas, o valor p já é corrigido para as janelas múltiplas. Se o resultado observado for muito mais extremo que todas as réplicas, p fica no mínimo, 1/(M + 1), e isso é um limite do método, não um zero. Os casos deste simulador foram calculados a partir da cobertura fictícia, e não sorteados de um modelo de Poisson; por isso a LLR observada fica muito acima das réplicas.</p>"; },
      q: "Se nenhum sorteio chegou ao valor verdadeiro, o p é zero?", a: "Não. O p mínimo é 1 ÷ (M + 1): 0,001 com 999 sorteios e 0,0001 com 9999. O resultado verdadeiro conta como uma das possibilidades.",
      viz: function (stage, ctl, state, root) {
        var rs = RS(state.mx), T = rs.T, b = rs.best, M = state.M, grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), c = document.createElement("div"); grid.appendChild(a); grid.appendChild(c);
        a.innerHTML = "<p class=cap>Um sorteio: casos redistribuídos e o círculo mais destacado dele</p>"; c.innerHTML = "<p class=cap>LLR máxima de cada sorteio, acumulando</p>";
        var mp = mapa(a, { w: a.clientWidth, cls: function () { return "qe"; }, label: "Mapa com o risco do sorteio atual e o círculo de maior LLR dele", titles: function () { return ""; } });
        var wc = winCircle(mp), hist = mcHist(c, b.llr), inf = info(stage), smp = S.scanSampler(POP, CT, SEED), r = 0, R = 0, sims = new Float64Array(M), mxv = 0, prev = [];
        var rate = M <= 999 ? 60 : 600, stride = Math.max(1, Math.round(rate / 25));
        function done() { return r >= M; }
        function paint(cs, bb) {
          var cur = {}; if (bb.ctr >= 0) T.ord[bb.ctr].slice(0, bb.k).forEach(function (j) { cur[j] = 1; });
          for (var i = 0; i < N; i++) setCls(mp, i, "q" + S.classOf(100 * cs[i] / POP[i], RBR) + (cur[i] ? " focus" : ""));
          if (bb.ctr >= 0) wc.set(T, bb.ctr, bb.k); else wc.hide();
        }
        function one() {
          var cs = smp.next(), bb = S.scanBest(T, cs, CT); sims[r] = bb.llr; r++; if (bb.llr >= b.llr) R++; if (bb.llr > mxv) mxv = bb.llr; hist.add(bb.llr);
          if (r % stride === 0 || done()) paint(cs, bb);
          inf.textContent = "Sorteio " + r + " de " + f0(M) + ": LLR máxima = " + f2(bb.llr) + ". Até agora, " + R + " sorteio(s) com LLR máxima maior ou igual a " + f1(b.llr) + ".";
          if (done()) {
            putMC(state.mx, M, sims, R); cache.live5 = { key: state.mx + "_" + M, done: true, R: R, max: mxv };
            inf.textContent = "Pronto: M = " + f0(M) + ", R = " + R + ", p = " + pform(R, M) + (R === 0 ? " (nunca zero)." : ".");
            var cn = root.querySelector("[data-live=conta5]"); if (cn) cn.innerHTML = STEPS[4].conta(state);
          }
        }
        cache.live5 = null;
        if (clock.reduced) { while (!done()) one(); } else clock.rateTask(rate, one, done);
        stage.appendChild(legend(LEGR)); stage.appendChild(legend([["swfoc", "contorno e círculo tracejado: melhor círculo do sorteio"]])); aviso(stage);
        cap(stage, "Semente fixa: rodar de novo dá o mesmo resultado. O mapa mostra o risco do sorteio atual com as mesmas faixas do passo 1. Use os controles da animação para pausar, acelerar ou reiniciar.");
      } },

    { t: "Aglomerados secundários e risco relativo",
      kid: "Depois do aglomerado mais provável, o método pode listar outros círculos que se destacam, desde que não tenham nenhum município em comum com os já listados. Para cada um, vemos o risco relativo: quantas vezes o risco de dentro é maior que o de fora. Um risco relativo de 2 quer dizer que, dentro do círculo, a proporção de crianças não vacinadas é o dobro da de fora. Clique em um círculo no mapa para ler os números dele.",
      pc: function () { return "Ordena todos os círculos pela LLR e vai listando, do maior para o menor, só os que não repartem município com nenhum já listado. Para cada um calcula o risco relativo e o valor p, comparando a LLR dele com as mesmas LLR máximas dos sorteios do passo 5."; },
      conta: function (s) {
        var rs = RS(s.mx), mc = MCR(s.mx, s.M), M = s.M, T = rs.T;
        var rows = rs.cl.slice(0, 8).map(function (c, q) { var pp = pOf(c.llr, mc); return "<tr><td class=num>" + (q + 1) + "</td><td>" + esc(NAMES[c.ctr]) + "</td><td class=num>" + c.k + "</td><td class=num>" + f0(c.pop) + " (" + pc(c.pop / PT) + ")</td><td class=num>" + f0(c.c) + "</td><td class=num>" + f1(c.E) + "</td><td class=num>" + f1(c.llr) + "</td><td class=num>" + f2(c.rr) + "</td><td class=num>" + fp(pp.p, M) + "</td></tr>"; }).join("");
        return "<span class=eq>Limite: <b>" + s.mx + "%</b>; sorteios M = <b>" + f0(M) + "</b>; aglomerados sem município em comum encontrados: <b>" + rs.cl.length + "</b> (tabela mostra até 8)</span>" +
          "<div class=tbl-wrap><table><tr><th class=num>#</th><th>Centro</th><th class=num>Municípios</th><th class=num>População</th><th class=num>Casos</th><th class=num>Esperado</th><th class=num>LLR</th><th class=num>Risco relativo</th><th class=num>p</th></tr>" + rows + "</table></div>" +
          "<span class=eq>Risco relativo do nº 1 = (" + f0(rs.cl[0].c) + " ÷ " + f0(rs.cl[0].pop) + ") ÷ (" + f0(CT - rs.cl[0].c) + " ÷ " + f0(PT - rs.cl[0].pop) + ") = <b>" + f2(rs.cl[0].rr) + "</b></span>" +
          "<p>O p dos secundários não é ajustado pela presença de outros aglomerados. Aqui, o p de cada um compara a LLR dele com as LLR máximas dos mesmos " + f0(M) + " sorteios.</p>" + (rs.cl.slice(1).some(function (c) { return c.k === 1; }) ? "<p>Vários secundários têm só um município (k = 1): são municípios pequenos que, sozinhos, têm risco bem acima do geral.</p>" : "");
      },
      tech: function () { return "<p><b>Regra dos secundários.</b> Todas as janelas com LLR positiva são ordenadas da maior para a menor LLR (empate: centro e k menores); uma janela entra na lista se nenhum dos seus municípios já está em um aglomerado listado. <b>Risco relativo</b> = risco dentro ÷ risco fora = (c / população dentro) ÷ ((C − c) / (população fora)). <b>Valor p</b> do mais provável: (R + 1)/(M + 1) com R = sorteios com LLR máxima ≥ à observada. Para os secundários, a LLR de cada um é comparada com as mesmas LLR máximas dos sorteios; o p não é ajustado pelos demais aglomerados. Como cada secundário é o melhor círculo entre os que não repartem município com os anteriores, p pequeno em vários deles não quer dizer que sejam independentes. Para como o SaTScan trata esse ponto, consulte o guia do usuário.</p>"; },
      q: "Risco relativo 3 significa que o risco é triplicado por causa de algo?", a: "Não. Significa que, nos dados, a proporção dentro do círculo é cerca de 3 vezes a de fora. Não diz a causa, e vale para o círculo, não para cada município dentro dele.",
      viz: function (stage, ctl, state, root) {
        var rs = RS(state.mx), T = rs.T, mc = MCR(state.mx, state.M), M = state.M, own = {}, inf = info(stage), shown = rs.cl.slice(0, 8);
        shown.forEach(function (c, q) { var pp = pOf(c.llr, mc); c.members.forEach(function (j) { own[j] = { rank: q, sig: pp.p <= ALPHA, c: c }; }); });
        function cls(i) { var o = own[i]; return !o ? "qe" : o.rank === 0 ? "qd0" : o.sig ? "qd3" : "nbr"; }
        var mp = mapa(stage, { w: stage.clientWidth, onSel: function (i) { var o = own[i]; mp.paths.forEach(function (q, j) { q.setAttribute("class", cls(j) + " clk" + (o && own[j] && own[j].rank === o.rank ? " focus" : "")); }); wc.hide(); if (o) wc.set(T, o.c.ctr, o.c.k); inf.textContent = o ? ("Aglomerado nº " + (o.rank + 1) + ": centro " + NAMES[o.c.ctr] + ", " + o.c.k + " município(s), LLR " + f1(o.c.llr) + ", risco relativo " + f2(o.c.rr) + ", p = " + fp(pOf(o.c.llr, mc).p, M) + ".") : (NAMES[i] + ": fora dos aglomerados listados."); }, cls: cls, label: "Mapa com o aglomerado mais provável e os secundários", titles: function (i) { return own[i] ? "aglomerado nº " + (own[i].rank + 1) : ""; } });
        var wc = winCircle(mp);
        shown.forEach(function (c, q) { var t = el("text", { x: mp.cs[c.ctr][0].toFixed(1), y: (mp.cs[c.ctr][1] + 4).toFixed(1), "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "var(--text)", stroke: "var(--bg)", "stroke-width": 3, "paint-order": "stroke", "pointer-events": "none" }, mp.g, String(q + 1)); });
        inf.textContent = "Clique em um município colorido para ver o aglomerado dele.";
        stage.appendChild(legend([["swq0", "nº 1: mais provável"], ["swq3", "secundário com p ≤ 0,05"], ["swn", "secundário com p &gt; 0,05"], ["swqe", "fora dos listados"]])); aviso(stage);
        cap(stage, "Os números são a ordem dos aglomerados (de maior LLR para menor), no centro de cada um. Mostrados até oito. Critério e sorteios escolhidos acima.");
      } },

    { t: "Escolhas do pesquisador e o que o scan não prova",
      kid: "O resultado da varredura depende de escolhas feitas antes de olhar os dados. A mais fácil de ver é o tamanho máximo do círculo: os três mapas abaixo mostram o aglomerado mais provável com limite de 50%, 25% e 10% da população. Eles não coincidem. Por isso o limite deve ser escolhido antes, e não depois de ver qual resultado agrada. Abaixo do mapa há as outras escolhas, e o que a varredura não consegue provar.",
      pc: function () { return "Repete a varredura completa, com 999 sorteios, para cada tamanho máximo (50%, 25% e 10%) e mostra o aglomerado mais provável de cada um lado a lado."; },
      conta: function (s) {
        var rows = MXS.map(function (mx) { var rs = RS(mx), b = rs.best, mc = MCR(mx, 999); return "<tr><td>" + mx + "%</td><td class=num>" + f0(rs.T.nWindows) + "</td><td>" + esc(NAMES[b.ctr]) + "</td><td class=num>" + b.k + "</td><td class=num>" + pc(b.pop / PT) + "</td><td class=num>" + f1(b.llr) + "</td><td class=num>" + f2(b.rr) + "</td><td class=num>" + fp(mc.p, 999) + "</td></tr>"; }).join("");
        return "<div class=tbl-wrap><table><tr><th>Limite</th><th class=num>Círculos</th><th>Centro</th><th class=num>Municípios</th><th class=num>% da população</th><th class=num>LLR</th><th class=num>Risco relativo</th><th class=num>p (999)</th></tr>" + rows + "</table></div><p class=cap>Só para comparar, esta tabela usa 999 sorteios nos três limites.</p>" +
          "<p><b>Escolhas que o pesquisador faz</b> (o projeto ainda vai decidir, sem decisão aqui):</p><ul>" +
          "<li><b>Tamanho máximo:</b> o recomendado e máximo é 50% da população em risco. Mexer nele depois de ver os resultados gera viés de pré-seleção: defina antes.</li>" +
          "<li><b>Direção:</b> aqui só se procura risco alto (excesso de crianças não vacinadas). Procurar também risco baixo, ou ambos, é uma escolha à parte.</li>" +
          "<li><b>Sorteios:</b> 999 (mínimo) ou 9999. O menor p possível é 1 ÷ (M + 1).</li>" +
          "<li><b>Tendência temporal:</b> numa análise no tempo, uma tendência geral de subida ou queda, se não for ajustada, aparece como aglomerado no início ou no fim do período. Esta página é puramente espacial.</li>" +
          "<li><b>Centroides:</b> o município é representado por um ponto, e o círculo se guia pelos pontos, não pela forma dos municípios.</li></ul>" +
          "<p><b>O que a varredura não prova:</b> a causa do aglomerado; que todos os municípios dentro do círculo tenham risco alto; o contorno exato do aglomerado (o círculo não segue a forma dos municípios); nada sobre crianças individuais (a análise é por município).</p>";
      },
      tech: function () { return "<p>Os três tamanhos usam os mesmos dados e a mesma semente; cada limite define um conjunto diferente de janelas válidas, então a LLR máxima e o aglomerado mais provável podem mudar. Isso mostra a sensibilidade ao parâmetro, e não é um critério para escolher o limite a posteriori. O Poisson aproxima bem o Bernoulli quando os casos são menos de 10% da população; aqui os casos são " + f2(100 * CT / PT) + "% da população fictícia, perto do limite, o que também é uma escolha de modelo a registrar. Parâmetros e opções do SaTScan: consultar o guia do usuário (referências).</p>"; },
      q: "Posso testar vários tamanhos máximos e ficar com o melhor?", a: "Não é o recomendado. Mexer no tamanho máximo depois de ver os resultados gera viés de pré-seleção. O tamanho deve ser definido antes, e a comparação com outros tamanhos pode aparecer como análise de sensibilidade, declarada como tal.",
      viz: function (stage, ctl, state) {
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        MXS.forEach(function (mx) {
          var rs = RS(mx), b = rs.best, inB = {}, d = document.createElement("div"); b.members.forEach(function (j) { inB[j] = 1; }); grid.appendChild(d);
          d.innerHTML = "<p class=cap>Limite de " + mx + "%: " + b.k + " município(s), centro " + esc(NAMES[b.ctr]) + (mx === state.mx ? " (o limite escolhido acima)" : "") + "</p>";
          var mp = mapa(d, { w: d.clientWidth, cls: function (i) { return inB[i] ? "qd0" : "qe"; }, label: "Aglomerado mais provável com limite de " + mx + "% da população", titles: function (i) { return inB[i] ? "dentro do aglomerado" : ""; } });
          winCircle(mp).set(rs.T, b.ctr, b.k);
        });
        stage.appendChild(legend([["swq0", "dentro do aglomerado mais provável"], ["swqe", "fora"]])); aviso(stage);
        cap(stage, "Três limites de tamanho, mesmos dados e mesma semente.");
      } }
  ];
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
    var lb = document.createElement("label"); lb.textContent = "Centro:"; lb.style.marginRight = "4px"; lb.setAttribute("for", "sel-mun"); g.appendChild(lb);
    var s = document.createElement("select"); s.id = "sel-mun";
    NAMES.map(function (n, i) { return [n, i]; }).sort(function (a, b) { return a[0].localeCompare(b[0], "pt-BR"); }).forEach(function (e) { var o = document.createElement("option"); o.value = e[1]; o.textContent = e[0]; if (e[1] === state.sel) o.selected = true; s.appendChild(o); });
    s.addEventListener("change", function () { state.sel = +s.value; cache.live3 = null; onChange(); });
    g.appendChild(s); return g;
  }
  function renderPassos(root, app, state) {
    state.mx = state.mx || 50; state.M = state.M || 999; state.sub = state.sub || 1;
    var N_ = STEPS.length, idx = Math.max(0, Math.min(N_ - 1, (state.step || 1) - 1)), st = STEPS[idx];
    clock.clear(); root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "opts"; root.appendChild(ds);
    function redraw() { renderPassos(root, app, state); app.remount && app.remount(); }
    if (idx === 1) ds.appendChild(chips("Etapa", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], state.sub, function (v) { state.sub = v; redraw(); }));
    if (idx >= 2) ds.appendChild(chips("Tamanho máximo", [[50, "50%"], [25, "25%"], [10, "10%"]], state.mx, function (v) { state.mx = v; state.sel = null; cache.live3 = null; redraw(); }));
    if (idx === 2) { if (state.sel == null) state.sel = RS(state.mx).best.ctr; ds.appendChild(seletor(state, redraw)); }
    if (idx === 4 || idx === 5) ds.appendChild(chips("Sorteios", [[999, "999"], [9999, "9999"]], state.M, function (v) { state.M = v; redraw(); }));
    var head = document.createElement("div"); head.className = "stephead";
    var back = document.createElement("button"); back.className = "arrow"; back.innerHTML = ARW.prev; back.setAttribute("aria-label", "Passo anterior"); back.title = "Passo anterior"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "arrow"; nxt.innerHTML = ARW.next; nxt.setAttribute("aria-label", "Próximo passo"); nxt.title = "Próximo passo"; nxt.disabled = idx === N_ - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    var no = document.createElement("p"); no.className = "stepno"; no.textContent = "Passo " + (idx + 1) + " de " + N_;
    head.appendChild(back); head.appendChild(no); head.appendChild(nxt); root.appendChild(head);
    var pr = document.createElement("div"); pr.className = "progress"; pr.setAttribute("role", "progressbar"); pr.setAttribute("aria-valuemin", "1"); pr.setAttribute("aria-valuemax", String(N_)); pr.setAttribute("aria-valuenow", String(idx + 1)); pr.innerHTML = '<i style="width:' + ((idx + 1) / N_ * 100) + '%"></i>'; root.appendChild(pr);
    var h2 = document.createElement("h2"); h2.id = "step-h"; h2.tabIndex = -1; h2.textContent = (idx + 1) + ". " + st.t; root.appendChild(h2);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var body = document.createElement("div"); root.appendChild(body);
    if (idx === 2) cache.live3 = null;
    if (idx === 4) cache.live5 = null;
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
    return "<div class=card><h2>Qual pergunta este método responde?</h2><p>Existe, em Alagoas, algum grupo de municípios vizinhos em que a proporção de crianças não vacinadas é maior do que no resto do estado, e esse excesso é grande demais para ser acaso? A varredura espacial de Kulldorff (1997) testa círculos de vários tamanhos ao redor de cada município e fica com o de maior destaque.</p>" +
      "<p>Ela vem depois do Moran local (método 5), que pergunta se cada município é parecido com seus vizinhos. A varredura pergunta se existe um grupo, de forma circular, com risco maior do que o de fora. Os dois métodos podem apontar lugares diferentes.</p>" +
      "<h3>E o espaço-tempo?</h3><p>Na versão espaço-tempo, a janela deixa de ser um círculo e passa a ser um cilindro: a base é o círculo no espaço e a altura é um período de tempo. Assim o método procura grupos de locais que tiveram risco maior em um período específico. Esta página não simula essa versão: ela é puramente espacial. Para os detalhes do espaço-tempo e do modelo de Bernoulli (casos e controles), veja o guia do usuário do SaTScan, nas referências.</p></div>" +
      "<div class='callout alert'><b>Atenção</b>Os valores deste simulador são fictícios e sorteados, sem relação com os municípios reais. A população e os casos também são fictícios. Só o desenho dos municípios (malha do IBGE) é real.</div><p>A simulação está no topo desta página. As perguntas frequentes ficam no final.</p>";
  }
  function tabDados() {
    var rows = G.map(function (f, i) { return "<tr><td>" + NAMES[i] + "</td><td class=num>" + f0(POP[i]) + "</td><td class=num>" + f1(D.cob[i]) + "</td><td class=num>" + f0(CASOS[i]) + "</td><td class=num>" + f2(RISK[i]) + "</td></tr>"; }).join("");
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Variável</th><th>Papel</th><th>Origem aqui</th></tr><tr><td>Malha municipal</td><td>geometria e centroides</td><td>IBGE, 2025 (real)</td></tr><tr><td>População</td><td>população em risco: nascidos vivos fictícios</td><td>sorteada, semente fixa</td></tr><tr><td>Cobertura vacinal</td><td>só para calcular os casos fictícios</td><td>sorteada, com padrão espacial inventado</td></tr><tr><td>Casos</td><td>crianças não vacinadas fictícias</td><td>nascidos vivos × (1 − cobertura limitada a 100%), arredondado para inteiro</td></tr></table></div>" +
      "<p>Total: " + f0(PT) + " nascidos vivos fictícios e " + f0(CT) + " casos (" + f2(100 * CT / PT) + "% da população). Valores sorteados, sem relação com os municípios reais. O gerador está em <code>tests/gen_spatial_data.js</code>. Os casos não vêm de um sorteio de Poisson: são calculados a partir da cobertura fictícia, e municípios com cobertura acima de 100% ficam com zero caso. O Poisson aproxima bem o Bernoulli com casos em menos de 10% da população; aqui os casos são " + f2(100 * CT / PT) + "% da população" + (CT / PT < 0.1 ? ", um pouco abaixo desse valor, e isso é um ponto de atenção." : ", acima desse valor, e isso é um ponto de atenção.") + "</p></div>" +
      "<details class=tech><summary>Tabela dos 102 municípios (valores fictícios)</summary><div class=scroll-box><table><tr><th>Município</th><th class=num>Nascidos vivos</th><th class=num>Cobertura (%)</th><th class=num>Casos (não vacinadas)</th><th class=num>Por 100 nascidos</th></tr>" + rows + "</table></div></details>";
  }
  function tabResultado() {
    var rs = RS(50), b = rs.best, mc = MCR(50, 999);
    var rows = rs.cl.slice(0, 5).map(function (c, q) { return "<tr><td class=num>" + (q + 1) + "</td><td>" + esc(NAMES[c.ctr]) + "</td><td class=num>" + c.k + "</td><td class=num>" + f1(c.llr) + "</td><td class=num>" + f2(c.rr) + "</td><td class=num>" + fp(pOf(c.llr, mc).p, 999) + "</td></tr>"; }).join("");
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Uma lista de aglomerados, cada um com seus municípios, o risco relativo e o valor p, e um mapa com os círculos. O aglomerado mais provável é o de maior LLR; os secundários não repartem município com os anteriores.</p><ul><li><b>Pode concluir:</b> há um grupo de municípios, dentro de um círculo, com proporção de não vacinadas maior do que fora, mais do que o acaso explica, no modelo e no tamanho máximo escolhidos.</li><li><b>Não pode concluir:</b> a causa do aglomerado, o contorno exato dele, nem que todo município dentro do círculo tenha risco alto. O resultado depende do tamanho máximo, que deve ser escolhido antes de olhar os dados.</li></ul></div>" +
      "<div class=card><h3>Exemplo fictício (limite de 50%, 999 sorteios, semente " + SEED + ")</h3><p>Aglomerado mais provável: centro em " + esc(NAMES[b.ctr]) + ", " + b.k + " municípios, " + pc(b.pop / PT) + " da população, LLR " + f1(b.llr) + ", risco relativo " + f2(b.rr) + ", p = " + fp(mc.p, 999) + " " + (mc.R === 0 ? "(nenhum dos 999 sorteios chegou ao valor verdadeiro; o p é o menor possível)." : "(R = " + mc.R + " sorteios).") + "</p><div class=tbl-wrap><table><tr><th class=num>#</th><th>Centro</th><th class=num>Municípios</th><th class=num>LLR</th><th class=num>Risco relativo</th><th class=num>p</th></tr>" + rows + "</table></div>" +
      "<p>Sensibilidade ao tamanho máximo (mais provável, 999 sorteios): " + MXS.map(function (mx) { var r = RS(mx).best; return mx + "%: " + r.k + " município(s), LLR " + f1(r.llr); }).join("; ") + ". Exemplo A–G: aglomerado { " + TOY.best.members.map(function (j) { return LET[j]; }).join(", ") + " }, LLR " + f3(TOY.best.llr) + ", risco relativo " + f2(TOY.best.rr) + ".</p></div>";
  }
  function tabLimites() {
    var Ls = ["Os valores do simulador são fictícios; só a geometria é real. Os casos foram calculados da cobertura sorteada, não sorteados de um modelo, e por isso quase todo destaque aparece com p mínimo.", "O círculo não segue a forma dos municípios; o centroide representa o município inteiro.", "O resultado depende do tamanho máximo da janela, que não deve ser alterado depois de ver os resultados (viés de pré-seleção).", "O valor p do aglomerado mais provável já considera as muitas janelas testadas. O p dos secundários não é ajustado pela presença de outros aglomerados.", "O menor p possível é 1/(M + 1); com 999 sorteios é 0,001. O p nunca é zero.", "Na análise espaço-tempo, uma tendência temporal geral, se não for ajustada, aparece como aglomerado no início ou no fim do período; esta página é só espacial.", "O Poisson aproxima bem o Bernoulli quando os casos são menos de 10% da população; aqui os casos ficam perto desse limite.", "Municípios pequenos podem virar aglomerados sozinhos, por terem taxas instáveis.", "A análise é ecológica: descreve municípios, não crianças. O aglomerado não prova causa."];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + Ls.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var D1 = ["Escopo: 102 municípios de Alagoas, com cobertura vacinal e taxa de abandono.", "Cobertura sem teto na base, com bandeiras para acima de 100%, 110% e 120% e abaixo de 50%; o teto de 100% só vale em mapas e médias, com o valor bruto na legenda. Neste exemplo, o teto de 100% é usado só para calcular os casos fictícios.", "Denominador abaixo de 1.000 como bandeira; análise principal com o valor bruto e sensibilidade.", "Dispensa de submissão ao CEP mantida por ora."];
    var P = ["Modelo de probabilidade do scan (Poisson, Bernoulli ou outro) e definição de caso e população.", "Tamanho máximo da janela (50% é o recomendado e máximo; 25% e 10% são alternativas) e a regra de não alterá-lo depois de ver os resultados.", "Direção da busca: risco alto, baixo ou ambos.", "Número de sorteios (999 ou 9999) e semente.", "Ajuste por tendência temporal, se for feita análise no tempo.", "Definição dos centroides e da distância entre municípios.", "Como tratar a cobertura acima de 100% ao definir casos e população, e os municípios com denominador pequeno."];
    return "<div class=card><h2>O que o projeto definiu</h2><ul>" + D1.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>Escolhas que o projeto ainda vai definir</h2><p class=cap>Estas escolhas afetam o resultado e estão em aberto; aqui aparecem as alternativas, sem decisão.</p><ul>" + P.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabFontes() { var r = (NS.refs && NS.refs.satscan) || []; return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>"; }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>Entradas: uma tabela com, para cada município, o número de casos, a população e as coordenadas do centroide. O SaTScan é o programa de referência: os parâmetros (modelo de probabilidade, tamanho máximo da janela, número de sorteios, tipo de análise) e os formatos dos arquivos estão no guia do usuário. <b>Confira a documentação do SaTScan da versão instalada</b> (referências): opções e nomes mudam entre versões. Os números não serão idênticos aos deste simulador, porque o sorteio e a regra de distância podem ser diferentes.</p>" +
      "<h3>A lógica, em pseudocódigo próprio</h3><pre>C = soma dos casos; P = soma das populações\npara cada município i (centro):\n  ordene os municípios por distância ao centro i\n  pop = 0; casos = 0\n  para cada município j nessa ordem:\n    pop = pop + população de j; casos = casos + casos de j\n    se pop &gt; limite × P: pare\n    E = C × pop / P\n    se casos &gt; E:\n      LLR = casos·ln(casos/E) + (C − casos)·ln((C − casos)/(C − E))\n      guarde a janela se a LLR for a maior até agora\naglomerado mais provável = janela de maior LLR\n\npara cada réplica de 1 a M:\n  redistribua os C casos entre os municípios, com chance proporcional à população\n  repita a varredura e guarde a maior LLR da réplica\nR = nº de réplicas com maior LLR &gt;= LLR observada\np = (R + 1) / (M + 1)\n\nsecundários: ordene as janelas por LLR e liste as que não repartem município com as já listadas\nrisco relativo = (casos dentro / pop dentro) / ((C − casos dentro) / (P − pop dentro))</pre>" +
      "<h3>Conferência neste repositório</h3><p>O arquivo <code>tests/check_satscan.py</code> refaz em Python (shapely, numpy) os centroides, a ordem por distância, as janelas válidas, a LLR (duas formas algébricas), o aglomerado mais provável, os secundários, o risco relativo, o Monte Carlo com a mesma semente (mulberry32 e a redistribuição multinomial reimplementados) e uma verificação estatística tolerante com o gerador multinomial do numpy.</p><pre>node tests/dump_satscan.js &gt; satscan_js.json\npython3 tests/check_satscan.py satscan_js.json</pre></div>";
  }
  function tabFaq() { return "<div class=card>" + STEPS.map(function (x) { return "<h3>" + x.q + "</h3><p>" + x.a + "</p>"; }).join("") + "<h3>O que é “semente fixa”?</h3><p>É o ponto de partida do sorteio. Com a mesma semente, o sorteio sai igual toda vez, e por isso o resultado pode ser conferido e repetido.</p><h3>Por que o p nunca é zero?</h3><p>Porque o valor verdadeiro conta como uma das M + 1 possibilidades. O menor p possível é 1 ÷ (M + 1).</p><h3>Por que aparecem nomes de municípios reais?</h3><p>Para o mapa ser reconhecível. Os valores, porém, são sorteados e não têm relação com os municípios reais; nada aqui descreve a cobertura de um município.</p><h3>E o espaço-tempo?</h3><p>Está explicado em Contexto, sem simulação.</p></div>"; }

  NS.methods.satscan = {
    id: "satscan", n: 6, nome: "Varredura de Kulldorff", ready: true, steps: STEPS.length, count: function () { return STEPS.length; },
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
    }
  };
})();
