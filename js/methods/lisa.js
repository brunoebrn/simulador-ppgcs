/* Método 5: Moran Local (LISA). Núcleo numérico em js/spatial_core.js (S.localI, S.condPerm, S.lisa, S.fdr, S.bonferroni); mapa em js/charts.js (NS.charts.mapa).
   Geometria real dos 102 municípios de Alagoas (IBGE 2025); VALORES 100% fictícios (js/spatial_data.js), sem relação com os municípios reais. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var S = NS.spatial, C = NS.charts, clock = NS.clock, fmt = C.fmt, el = C.el;
  var G = NS.geo.features, D = NS.spatial_data, N = G.length, SEED = 2026, ALPHA = 0.05;
  var NAMES = G.map(function (f) { return f.properties.n; });
  var NBQ = S.neighbors(G, "queen"), W = S.rowStd(NBQ);
  var PEQ = D.nasc.map(function (v) { return v < 1000; }), NPEQ = PEQ.filter(Boolean).length;
  var VAR = {
    cob: { x: D.cob, nome: "cobertura vacinal fictícia (%)", curto: "Cobertura", un: "%" },
    aband: { x: D.aband, nome: "taxa de abandono fictícia (%)", curto: "Abandono", un: "%" },
    ruido: { x: D.ruido, nome: "índice fictício sem padrão espacial", curto: "Sem padrão", un: "" }
  };
  var CRIT = { nc: "Sem correção", fdr: "FDR", bonf: "Bonferroni" };
  var cache = {};
  function LI(v) { return cache["l" + v] || (cache["l" + v] = S.localI(VAR[v].x, W)); }
  function LS(v, M) { var k = "s" + v + M; return cache[k] || (cache[k] = S.lisa(VAR[v].x, W, M, SEED)); }
  function GI(v) { return cache["g" + v] || (cache["g" + v] = S.moranI(VAR[v].x, W)); }
  function bonfOK(M) { return 1 / (M + 1) <= ALPHA / N + 1e-15; }
  /* Quem é significativo em cada critério (vetor booleano). */
  function sigOf(v, M, crit) {
    var k = "g" + v + M + crit; if (cache[k]) return cache[k];
    var p = LS(v, M).p;
    return (cache[k] = crit === "nc" ? p.map(function (q) { return q <= ALPHA; }) : crit === "fdr" ? S.fdr(p, ALPHA).sig : S.bonferroni(p, ALPHA).sig);
  }
  function clsOf(v, M, crit) { var sg = sigOf(v, M, crit), q = LI(v).quad; return function (i) { return S.clusterClass(q[i], sg[i]); }; }
  function counts(v, M, crit) {
    var sg = sigOf(v, M, crit), q = LI(v).quad, c = [0, 0, 0, 0], t = 0, pq = 0;
    sg.forEach(function (s, i) { if (s) { c[q[i]]++; t++; if (PEQ[i]) pq++; } });
    return { total: t, q: c, small: pq };
  }
  function topI(v) { var l = LI(v), b = 0; l.I.forEach(function (a, i) { if (a > l.I[b]) b = i; }); return b; }

  /* Exemplo mínimo A–F (taxas 95, 92, 90, 80, 72, 70; vizinhos A–B, B–C, B–D, C–D, D–E, E–F). */
  var TOY = { x: [95, 92, 90, 80, 72, 70], nb: [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]] };
  TOY.W = S.rowStd(TOY.nb); TOY.g = S.moranI(TOY.x, TOY.W); TOY.l = S.localI(TOY.x, TOY.W); TOY.mean = S.mean(TOY.x);
  TOY.ex = TOY.x.map(function (v, i) { return S.exactCond(TOY.x, TOY.W, i); }); TOY.gex = S.exactPerm(TOY.x, TOY.W);
  var LET = "ABCDEF";

  function f1(x) { return fmt(x, 1); } function f2(x) { return fmt(x, 2); } function f3(x) { return fmt(x, 3); } function f4(x) { return fmt(x, 4); }
  function pdig(M) { return String(M + 1).length - 1; }
  function fp(p, M) { return fmt(p, pdig(M)); }
  function pform(R, M) { return "(" + R + " + 1) ÷ (" + M + " + 1) = " + fp(S.pseudoP(R, M), M); }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function aviso(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Valores sorteados, sem relação com os municípios reais. Só o desenho dos municípios e as vizinhanças são reais."; stage.appendChild(p); }
  function legend(items) { var d = document.createElement("div"); d.className = "legend"; d.innerHTML = items.map(function (i) { return "<span><i class='sq " + i[0] + "'></i>" + i[1] + "</span>"; }).join(""); return d; }
  function info(stage) { var p = document.createElement("p"); p.className = "sum"; p.setAttribute("aria-live", "polite"); p.style.margin = "4px 6px"; stage.appendChild(p); return p; }
  function setCls(m, i, c) { m.paths[i].setAttribute("class", c); }
  function mapa(parent, o) { return C.mapa(parent, o); }
  function two(x, m) { return function (i) { return x[i] >= m ? "q3" : "q0"; }; }
  function sgn(v) { return (v > 0 ? "+" : "") + f2(v); }
  function nice(range) { var raw = range / 4, s = [0.5, 1, 2, 5, 10, 20, 50]; for (var i = 0; i < s.length; i++) if (s[i] >= raw) return s[i]; return 100; }
  var LEG5 = [["swq0", "alto-alto (vermelho escuro)"], ["swq2", "baixo-baixo (azul escuro)"], ["swq1", "baixo-alto (azul claro)"], ["swq3", "alto-baixo (vermelho claro)"], ["swqe", "não significativo (cinza)"]];

  /* Hachura sobre os municípios com denominador menor que 1.000 (bandeira do projeto). */
  function hachura(mp, flags) {
    var defs = el("defs", {}, mp.svg), pat = el("pattern", { id: "hat-lisa", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "var(--text)", "stroke-width": 1.1, opacity: .55 }, pat);
    flags.forEach(function (f, i) { if (f) el("path", { d: mp.paths[i].getAttribute("d"), fill: "url(#hat-lisa)", stroke: "none", "pointer-events": "none" }, mp.g); });
  }

  /* Histograma que acumula as réplicas do I_i; a cauda do lado usado no teste fica em vermelho. */
  function localHist(parent, o) {
    var w = C.width(parent), h = o.h || 230, m = { l: 46, r: 14, t: 24, b: 42 }, nb = 30, lo = o.lo, hi = o.hi, bw = (hi - lo) / nb, counts = new Array(nb).fill(0), ymax = o.ymax || 6, st = nice(hi - lo);
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": o.label }, parent), gA = el("g", { "class": "axis" }, svg), gB = el("g", {}, svg), gO = el("g", {}, svg), rects = [];
    var X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hi - lo); }, Y = function (c) { return m.t + (h - m.t - m.b) * (1 - c / ymax); };
    function axes() {
      gA.textContent = ""; el("line", { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b }, gA); el("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b }, gA);
      for (var t = Math.ceil(lo / st - 1e-9) * st; t <= hi + 1e-9; t += st) el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, fmt(t, st < 1 ? 1 : 0));
      [0, ymax].forEach(function (c) { el("text", { x: m.l - 6, y: Y(c) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, String(c)); });
      el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, o.xlabel);
      el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, gA, "nº de rodadas");
    }
    function bar(b) { var hit = o.upper ? lo + b * bw >= o.obs : lo + (b + 1) * bw <= o.obs; if (!rects[b]) rects[b] = el("rect", { "class": "bar" }, gB); rects[b].setAttribute("class", hit ? "bar-hit" : "bar"); rects[b].setAttribute("x", (X(lo + b * bw) + 1).toFixed(1)); rects[b].setAttribute("width", Math.max(1, X(lo + (b + 1) * bw) - X(lo + b * bw) - 2).toFixed(1)); rects[b].setAttribute("y", Y(counts[b]).toFixed(1)); rects[b].setAttribute("height", (h - m.b - Y(counts[b])).toFixed(1)); }
    function all() { axes(); for (var b = 0; b < nb; b++) if (counts[b]) bar(b); }
    all();
    el("line", { x1: X(o.obs), x2: X(o.obs), y1: m.t, y2: h - m.b, "class": "obs" }, gO);
    var right = X(o.obs) > (w + m.l) / 2;
    el("text", { x: right ? X(o.obs) - 6 : X(o.obs) + 6, y: m.t + 14, "text-anchor": right ? "end" : "start", "font-size": 12, "font-weight": 700 }, gO, "I do município = " + f2(o.obs));
    return { add: function (v) { var b = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw))); counts[b]++; if (counts[b] > ymax) { ymax = Math.ceil(counts[b] * 1.5); all(); } else bar(b); }, svg: svg };
  }

  /* Diagrama de dispersão de Moran em desvios (pontos), colorido pelo quadrante. onSel(i). */
  function diagrama(parent, v, state, onSel) {
    var l = LI(v), w = Math.max(280, Math.min(520, C.width(parent))), h = Math.round(w * .82), m = { l: 40, r: 10, t: 14, b: 36 };
    var mx = Math.max.apply(null, l.z.concat(l.wz).map(Math.abs)), st = nice(mx * 1.15), lim = Math.ceil(mx * 1.1 / st) * st;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Diagrama de dispersão de Moran: desvio do município contra a média dos desvios dos vizinhos, colorido pelo quadrante" }, parent);
    var X_ = function (a) { return m.l + (w - m.l - m.r) * (a + lim) / (2 * lim); }, Y_ = function (a) { return m.t + (h - m.t - m.b) * (1 - (a + lim) / (2 * lim)); };
    for (var t = -lim; t <= lim + 1e-9; t += st) {
      el("line", { x1: X_(t), x2: X_(t), y1: m.t, y2: h - m.b, stroke: "var(--line)" }, svg); el("line", { x1: m.l, x2: w - m.r, y1: Y_(t), y2: Y_(t), stroke: "var(--line)" }, svg);
      el("text", { x: X_(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, fmt(t, st < 1 ? 1 : 0)); el("text", { x: m.l - 6, y: Y_(t) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg, fmt(t, st < 1 ? 1 : 0));
    }
    el("line", { x1: X_(0), x2: X_(0), y1: m.t, y2: h - m.b, stroke: "currentColor", "stroke-width": 1.4 }, svg); el("line", { x1: m.l, x2: w - m.r, y1: Y_(0), y2: Y_(0), stroke: "currentColor", "stroke-width": 1.4 }, svg);
    [["baixo-alto", m.l + 4, m.t + 12, "start"], ["alto-alto", w - m.r - 4, m.t + 12, "end"], ["baixo-baixo", m.l + 4, h - m.b - 6, "start"], ["alto-baixo", w - m.r - 4, h - m.b - 6, "end"]].forEach(function (q) { el("text", { x: q[1], y: q[2], "text-anchor": q[3], "font-size": 12, "font-weight": 700, "class": "muted" }, svg, q[0]); });
    el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, "desvio do município (z)");
    el("text", { x: 4, y: 11, "font-size": 12, "class": "muted" }, svg, "média dos desvios dos vizinhos (Wz)");
    var pts = l.z.map(function (z, i) { var c = el("circle", { cx: X_(z), cy: Y_(l.wz[i]), r: 4, "class": "qd" + l.quad[i], stroke: "var(--bg)", "stroke-width": 1 }, svg); el("title", {}, c, NAMES[i]); c.style.cursor = "pointer"; c.addEventListener("click", function () { onSel(i); }); return c; });
    return { svg: svg, mark: function (i) { pts.forEach(function (p, j) { p.setAttribute("r", j === i ? 6.5 : 4); p.setAttribute("stroke", j === i ? "currentColor" : "var(--bg)"); p.setAttribute("stroke-width", j === i ? 2.5 : 1); }); pts[i].parentNode.appendChild(pts[i]); } };
  }

  /* p ordenados contra os limites: sem correção (0,05), FDR (i · 0,05 ÷ 102) e Bonferroni (0,05 ÷ 102). */
  function pChart(parent, v, M, crit) {
    var p = LS(v, M).p, order = p.map(function (a, i) { return i; }).sort(function (a, b) { return p[a] - p[b] || a - b; }), sg = sigOf(v, M, crit);
    var w = C.width(parent), h = 200, m = { l: 48, r: 12, t: 16, b: 38 }, ym = 0.06;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Valores de p em ordem crescente contra os limites de cada critério" }, parent);
    var X = function (r) { return m.l + (w - m.l - m.r) * (r - 1) / (N - 1); }, Y = function (a) { return m.t + (h - m.t - m.b) * (1 - a / ym); };
    [0, 0.02, 0.04, 0.06].forEach(function (a) { el("line", { x1: m.l, x2: w - m.r, y1: Y(a), y2: Y(a), stroke: "var(--line)" }, svg); el("text", { x: m.l - 6, y: Y(a) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg, fmt(a, 2)); });
    [1, 25, 50, 75, 102].forEach(function (r) { el("text", { x: X(r), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, String(r)); });
    el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, "posição do município na lista de p em ordem crescente (i)");
    el("text", { x: 4, y: 11, "font-size": 12, "class": "muted" }, svg, "pseudo-p");
    el("line", { x1: m.l, x2: w - m.r, y1: Y(ALPHA), y2: Y(ALPHA), stroke: "var(--muted)", "stroke-width": 1.6, "stroke-dasharray": "5 4" }, svg);
    el("line", { x1: X(1), y1: Y(ALPHA / N), x2: X(N), y2: Y(ALPHA), stroke: "var(--c3)", "stroke-width": 1.8 }, svg);
    el("line", { x1: m.l, x2: w - m.r, y1: Y(ALPHA / N), y2: Y(ALPHA / N), stroke: "var(--text)", "stroke-width": 1.6 }, svg);
    order.forEach(function (i, r) { if (p[i] <= ym) el("circle", { cx: X(r + 1), cy: Y(p[i]), r: 3.2, fill: sg[i] ? "var(--hh)" : "var(--qe)", stroke: "var(--muted)", "stroke-width": .6 }, svg); });
    el("text", { x: w - m.r - 2, y: Y(ALPHA) - 5, "text-anchor": "end", "font-size": 11, "class": "muted" }, svg, "sem correção: 0,05");
    el("text", { x: X(N * .62), y: Y(ALPHA * .62) + 14, "text-anchor": "middle", "font-size": 11, fill: "var(--c3)", "font-weight": 700 }, svg, "FDR: i · 0,05 ÷ 102");
    el("text", { x: w - m.r - 2, y: Y(ALPHA / N) - 5, "text-anchor": "end", "font-size": 11, "class": "muted" }, svg, "Bonferroni: 0,05 ÷ 102");
    return svg;
  }

  /* ---------- passos ---------- */
  var STEPS = [
    { t: "A pergunta: onde estão os aglomerados?",
      kid: "O método anterior (I de Moran global) dá um número só para os 102 municípios. Agora queremos saber onde. O Moran local calcula um número para cada município: ele compara o município com a média dos vizinhos e diz se os dois estão do mesmo lado da média (alto com vizinhos altos, baixo com vizinhos baixos) ou de lados opostos (um ponto fora da curva). Depois, um teste por município separa o que pode ser acaso do que parece padrão.",
      pc: function () { return "Para cada um dos 102 municípios, calcula o desvio da média, o desvio médio dos vizinhos e um índice local I_i que junta os dois. Depois sorteia valores para testar cada município (passo 4) e corrige o fato de serem 102 testes ao mesmo tempo (passo 5). No fim, pinta o mapa de aglomerados."; },
      conta: function (s) {
        var v = s.v, g = GI(v), l = LI(v), mean = S.mean(l.I), c = [0, 0, 0, 0]; l.quad.forEach(function (q) { c[q]++; });
        return "<span class=eq>Variável: <b>" + VAR[v].nome + "</b>; vizinhança: rainha</span><span class=eq>I de Moran global (método 4) = <b>" + f3(g.I) + "</b>: um número para o estado inteiro</span><span class=eq>Moran local: <b>102</b> números I_i, um por município; média dos I_i = <b>" + f3(mean) + "</b>, igual ao I global</span>" +
          "<div class=tbl-wrap><table><tr><th>Quadrante do município</th><th class=num>Municípios</th></tr>" + [0, 2, 1, 3].map(function (j) { return "<tr><td>" + S.QUAD[j] + "</td><td class=num>" + c[j] + "</td></tr>"; }).join("") + "</table></div><p>Os quadrantes ainda são só descrição. O passo 5 diz quais deles passam no teste.</p>";
      },
      tech: function () { return "<p>O Moran local (LISA, Anselin, 1995) decompõe o I global em uma contribuição por município: I<sub>i</sub> = z<sub>i</sub> · Σ<sub>j</sub> w<sub>ij</sub> z<sub>j</sub> / (Σ z² / n), com z o desvio da média e W padronizada por linha. Com pesos padronizados por linha, S0 = n e a média dos I<sub>i</sub> é o I global. <b>Escala:</b> o divisor (Σ z² / n) usa a variância com divisor n; implementações que usam n − 1 produzem I<sub>i</sub> menores por um fator comum (n − 1)/n. Esse fator multiplica todos os I<sub>i</sub> igualmente, não muda o quadrante, os p-valores por permutação nem o mapa de clusters; só muda a escala dos números. Aqui n = 102, então (n − 1)/n = 0,990.</p>"; },
      q: "Qual a diferença entre o I global e o Moran local?", a: "O I global é um número só para o conjunto. O Moran local é um número para cada município, com um teste para cada um, e por isso pode ser desenhado num mapa. A média dos I locais é o I global.",
      viz: function (stage, ctl, state) {
        var v = state.v, x = VAR[v].x, mean = S.mean(x), grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>Ponto de partida: " + VAR[v].curto + " acima ou abaixo da média</p>"; b.innerHTML = "<p class=cap>Onde vamos chegar: mapa de aglomerados (FDR, 999 sorteios)</p>";
        mapa(a, { w: a.clientWidth, cls: two(x, mean), label: "Mapa de Alagoas com a variável fictícia acima ou abaixo da média", titles: function (i) { return f1(x[i]) + VAR[v].un; } });
        mapa(b, { w: b.clientWidth, cls: clsOf(v, 999, "fdr"), label: "Mapa de aglomerados do Moran local com correção FDR", titles: function (i) { return S.QUAD[LI(v).quad[i]]; } });
        stage.appendChild(legend([["sw3", "acima da média"], ["sw0", "abaixo da média"]])); stage.appendChild(legend(LEG5)); aviso(stage);
        cap(stage, "À esquerda, só acima ou abaixo da média. À direita, o resultado final do método: só ficam coloridos os municípios cujo padrão local passou no teste.");
      } },

    { t: "A conta com seis municípios (A a F)",
      kid: "Fazemos o Moran local à mão com os mesmos seis municípios fictícios do método anterior. B é vizinho de A, C e D; D também de E; E de F. Cada etapa acrescenta uma coluna: desvio, desvio dos vizinhos, índice, e por fim o teste. A última etapa traz uma lição importante sobre testar município por município.",
      pc: function () { return "Faz com seis municípios a mesma conta que fará com 102. Nos testes, como são só seis valores, lista todas as possibilidades em vez de sortear, e conta quantas dão um I_i tão alto quanto o observado."; },
      conta: function (s) {
        var k = s.sub, l = TOY.l, g = TOY.g, i, head, rows, txt;
        var th = "<th>Município</th><th class=num>Taxa</th><th class=num>z = taxa − média</th>" + (k >= 2 ? "<th>Vizinhos</th><th class=num>Wz</th>" : "") + (k >= 3 ? "<th class=num>I_i</th><th>Quadrante</th>" : "") + (k >= 5 ? "<th class=num>Possibilidades</th><th class=num>Com I_i ≥ observado</th><th class=num>p exato</th>" : "");
        if (k === 1) th = "<th>Município</th><th class=num>Taxa</th><th class=num>z = taxa − média</th>";
        head = "<tr>" + th + "</tr>";
        rows = TOY.x.map(function (vv, j) {
          var ex = TOY.ex[j];
          return "<tr><td>" + LET[j] + "</td><td class=num>" + vv + "</td><td class=num>" + f4(l.z[j]) + "</td>" + (k >= 2 ? "<td>" + TOY.nb[j].map(function (q) { return LET[q]; }).join(", ") + "</td><td class=num>" + f4(l.wz[j]) + "</td>" : "") + (k >= 3 ? "<td class=num>" + f3(l.I[j]) + "</td><td>" + S.QUAD[l.quad[j]] + "</td>" : "") + (k >= 5 ? "<td class=num>" + ex.total + "</td><td class=num>" + ex.count + "</td><td class=num>" + f2(ex.p) + "</td>" : "") + "</tr>";
        }).join("");
        var sumI = l.I.reduce(function (a, b) { return a + b; }, 0);
        if (k === 1) txt = "<span class=eq>Média = 499 ÷ 6 = <b>" + f4(TOY.mean) + "</b>; z de A = 95 − " + f4(TOY.mean) + " = <b>" + f4(l.z[0]) + "</b></span><span class=eq>Σ z² = <b>" + f2(g.den) + "</b>; Σ z² ÷ n = " + f2(g.den) + " ÷ 6 = <b>" + f4(l.m2) + "</b> (o divisor de todos os I_i)</span>";
        else if (k === 2) txt = "<span class=eq>Wz de B (vizinhos A, C e D) = (" + f4(l.z[0]) + " + " + f4(l.z[2]) + " + (" + f4(l.z[3]) + ")) ÷ 3 = <b>" + f4(l.wz[1]) + "</b></span><span class=eq>Wz de A (só B) = <b>" + f4(l.wz[0]) + "</b></span>";
        else if (k === 3) txt = "<span class=eq>I de A = z · Wz ÷ (Σ z² ÷ n) = " + f4(l.z[0]) + " × " + f4(l.wz[0]) + " ÷ " + f4(l.m2) + " = <b>" + f3(l.I[0]) + "</b></span><span class=eq>D está abaixo da média (z negativo) e seus vizinhos acima (Wz positivo): I_i = <b>" + f3(l.I[3]) + "</b>, quadrante baixo-alto</span>";
        else if (k === 4) txt = "<span class=eq>Soma dos seis I_i = " + f4(sumI) + "; média = " + f4(sumI) + " ÷ 6 = <b>" + f4(sumI / 6) + "</b></span><span class=eq>I de Moran global do método 4 = <b>" + f4(g.I) + "</b>: a média dos I_i é o I global</span>";
        else if (k === 5) {
          var oth = [0, 1, 2, 3, 4, 5].filter(function (j) { return j !== 0; }), a = oth.map(function (j) { var I = l.z[0] * l.z[j] / l.m2; return "<tr><td>" + LET[j] + " (taxa " + TOY.x[j] + ")</td><td class=num>" + f4(l.z[j]) + "</td><td class=num>" + f3(I) + "</td><td>" + (I >= l.I[0] - 1e-12 ? "sim" : "não") + "</td></tr>"; }).join("");
          txt = "<p><b>Exemplo com A.</b> A tem um vizinho (B). Se os valores dos outros cinco municípios fossem trocados ao acaso, qualquer um dos cinco poderia ficar no lugar de B. São 5 possibilidades, todas igualmente prováveis:</p><div class=tbl-wrap><table><tr><th>Quem ficaria no lugar de B</th><th class=num>Wz</th><th class=num>I_i de A</th><th>≥ I_i observado (" + f3(l.I[0]) + ")?</th></tr>" + a + "</table></div><span class=eq>Só uma das 5 chega ao observado (a verdadeira): p exato = 1 ÷ 5 = <b>" + f2(TOY.ex[0].p) + "</b></span><p>Para os demais, o raciocínio é o mesmo, escolhendo quais valores dos outros cinco vão para os vizinhos (B tem 3 vizinhos: 10 escolhas possíveis). Usa-se o lado do I_i em que o observado está mais isolado.</p>";
        } else txt = "<span class=eq>Teste global (método 4): p exato = " + TOY.gex.count + " ÷ " + TOY.gex.total + " = <b>" + f4(TOY.gex.p) + "</b></span><span class=eq>Testes locais: p exato = <b>" + TOY.ex.map(function (e) { return f2(e.p); }).join("; ") + "</b> (A a F)</span><span class=eq>Nenhum município chega a 0,05, embora o global chegue.</span><p><b>Lição.</b> Cada município só tem 5 ou 10 possibilidades (por exemplo, 1 ÷ 5 = 0,20 ou 1 ÷ 10 = 0,10). O menor p que cada teste pode dar é 0,20 (A e F) ou 0,10 (B, C, D e E), e esses valores já estão acima de 0,05. Com seis municípios, nenhum teste local consegue mostrar significância. Isso vale para este exemplo pequeno: com 102 municípios, o sorteio permite p bem menores (passo 4).</p>";
        return txt + "<div class=tbl-wrap><table>" + head + rows + "</table></div><p class=cap>Valores arredondados na tela; o cálculo usa todas as casas.</p>";
      },
      tech: function () { return "<p>Etapas: (1) média, desvios z e m2 = Σ z² / n; (2) defasagem (Wz)<sub>i</sub> = Σ<sub>j</sub> w<sub>ij</sub> z<sub>j</sub>, com W padronizada por linha; (3) I<sub>i</sub> = z<sub>i</sub> (Wz)<sub>i</sub> / m2, e quadrante pelos sinais de z e Wz (zero conta como alto); (4) a média dos I<sub>i</sub> é o I global, pois S0 = n; (5) teste local exato: fixa z<sub>i</sub> e considera as C(5, k<sub>i</sub>) escolhas de quais valores dos outros cinco vão para os k<sub>i</sub> vizinhos (todas igualmente prováveis sob a hipótese de troca ao acaso). O p é a razão entre as escolhas com I<sub>i</sub> tão extremo quanto o observado, no lado de menor contagem (≥ ou ≤), e o total. O observado é uma das possibilidades, o que impede p = 0. Com n = 102, C(101, k) é grande demais para listar, e se usa o sorteio (permutação condicional).</p>"; },
      q: "Por que nenhum município é significativo no exemplo, se o global é?", a: "Porque, com seis municípios, cada teste local tem só 5 ou 10 possibilidades, e o menor p que ele pode dar (0,10 ou 0,20) já passa de 0,05. O exemplo serve para treinar a conta, não para concluir algo.",
      viz: function (stage, ctl, state) {
        var k = state.sub, l = TOY.l, w = Math.max(280, Math.min(420, C.width(stage))), h = 130, sx = w / 400;
        var P = [[34, 70], [110, 70], [184, 30], [184, 110], [258, 110], [334, 110]];
        var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Seis municípios fictícios, A a F, ligados por vizinhança" }, stage);
        TOY.nb.forEach(function (ln, i) { ln.forEach(function (j) { if (j > i) el("line", { x1: P[i][0] * sx, y1: P[i][1], x2: P[j][0] * sx, y2: P[j][1], stroke: "var(--text)", "stroke-width": 2, opacity: .6 }, svg); }); });
        P.forEach(function (p, i) {
          el("circle", { cx: p[0] * sx, cy: p[1], r: 17, "class": k >= 3 ? "qd" + l.quad[i] : "", fill: k >= 3 ? "" : "var(--panel2)", stroke: "var(--text)", "stroke-width": 1.5 }, svg);
          el("text", { x: p[0] * sx, y: p[1] + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: k >= 3 ? "#fff" : "currentColor" }, svg, LET[i]);
          var lab = k >= 5 ? "p = " + f2(TOY.ex[i].p) : k >= 3 ? "I = " + f2(l.I[i]) : k >= 2 ? "Wz = " + f2(l.wz[i]) : k === 1 ? "z = " + f2(l.z[i]) : String(TOY.x[i]);
          el("text", { x: p[0] * sx, y: p[1] + (i === 2 ? -23 : 35), "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, lab);
        });
        if (k >= 3) stage.appendChild(legend([["swq0", "alto-alto"], ["swq2", "baixo-baixo"], ["swq1", "baixo-alto"], ["swq3", "alto-baixo"]]));
        cap(stage, k >= 6 ? "Nenhum círculo ganha destaque: nenhum município passou no teste (p ≤ 0,05)." : k >= 3 ? "A cor é o quadrante: A, B e C acima da média com vizinhos acima; D abaixo com vizinhos acima; E e F abaixo com vizinhos abaixo." : "Os seis municípios fictícios e quem é vizinho de quem.");
        aviso(stage);
      } },

    { t: "O I local nos 102 municípios",
      kid: "A mesma conta, agora com Alagoas inteira. À esquerda, o mapa mostra o I local de cada município: quanto mais azul-escuro, maior. À direita, o diagrama de Moran coloca cada município em um gráfico: para a direita, quanto ele está acima da média; para cima, quanto os vizinhos estão acima da média. Clique em um município (no mapa ou no gráfico) para ver os números dele.",
      pc: function () { return "Calcula, para cada município, o desvio z, o desvio médio dos vizinhos Wz e o I local. Coloca cada município em um dos quatro quadrantes conforme os sinais de z e Wz. Ainda não faz teste nenhum: o quadrante é só descrição."; },
      conta: function (s) {
        var v = s.v, l = LI(v), i = s.sel == null ? topI(v) : s.sel, x = VAR[v].x, mean = S.mean(x), un = VAR[v].un ? " p.p." : "";
        return "<span class=eq><b>" + NAMES[i] + "</b>: valor " + f1(x[i]) + VAR[v].un + "; média do estado " + f1(mean) + "</span><span class=eq>z = " + f1(x[i]) + " − " + f1(mean) + " = <b>" + sgn(l.z[i]) + "</b>" + un + "</span><span class=eq>Wz = média dos z dos " + NBQ.nb[i].length + " vizinhos = <b>" + sgn(l.wz[i]) + "</b>" + un + "</span><span class=eq>I_i = z · Wz ÷ (Σ z² ÷ n) = " + f2(l.z[i]) + " × " + f2(l.wz[i]) + " ÷ " + f2(l.m2) + " = <b>" + f3(l.I[i]) + "</b></span><span class=eq>Quadrante: <b>" + S.QUAD[l.quad[i]] + "</b> (sem teste ainda)</span>" +
          "<p>Média dos 102 I_i = " + f3(S.mean(l.I)) + " (I global = " + f3(GI(v).I) + "). Clique em outro município para trocar.</p>";
      },
      tech: function () { return "<p>I<sub>i</sub> = z<sub>i</sub> (Wz)<sub>i</sub> / (Σ z² / n). I<sub>i</sub> positivo: o município e a média dos vizinhos estão do mesmo lado da média (alto-alto ou baixo-baixo). I<sub>i</sub> negativo: lados opostos (baixo-alto ou alto-baixo), um ponto fora da curva espacial. O valor de I<sub>i</sub> depende da escala escolhida para o denominador (variância com divisor n ou n − 1; fator (n − 1)/n entre as duas), mas o quadrante e o mapa de clusters, depois do teste, não mudam. Este I<sub>i</sub> é uma descrição: sozinho, não diz se o município é incomum. O desvio z aqui está na unidade original (pontos percentuais); os quadrantes são os mesmos do diagrama de Moran da AEDE, que usava escores padronizados.</p>"; },
      q: "Um I local alto já significa aglomerado?", a: "Não. Ele diz que o município e os vizinhos estão do mesmo lado da média, mas com 102 municípios é de se esperar que alguns tenham I local alto só por acaso. Quem decide é o teste dos passos seguintes.",
      viz: function (stage, ctl, state, root) {
        var v = state.v, l = LI(v), grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>Quadrante de cada município</p>"; b.innerHTML = "<p class=cap>Diagrama de Moran</p>";
        var br = S.quantileBreaks(l.I, 5), PAL = [0, 1, 2, 3, 4];
        if (state.sel == null) state.sel = topI(v);
        var dg = null, mp = null;
        function pick(i) { state.sel = i; if (dg) dg.mark(i); if (mp) mp.paths.forEach(function (q, j) { q.setAttribute("class", "qd" + l.quad[j] + " clk" + (j === i ? " focus" : "")); }); var c = root.querySelector("[data-live=conta3]"); if (c) c.innerHTML = STEPS[2].conta(state); }
        mp = mapa(a, { w: a.clientWidth, onSel: pick, cls: function (i) { return "qd" + l.quad[i]; }, label: "Mapa de Alagoas colorido pelo quadrante de cada município", titles: function (i) { return S.QUAD[l.quad[i]] + "; I local = " + f2(l.I[i]); } });
        dg = diagrama(b, v, state, pick);
        stage.appendChild(legend([["swq0", "alto-alto"], ["swq2", "baixo-baixo"], ["swq1", "baixo-alto"], ["swq3", "alto-baixo"]])); aviso(stage);
        cap(stage, "A cor é o quadrante do município, a mesma do diagrama. O valor do I local fica ao passar o mouse ou na conta abaixo: alto-alto e baixo-baixo têm I local positivo (parecido com os vizinhos), baixo-alto e alto-baixo têm I local negativo (diferente dos vizinhos). Este mapa ainda não diz se o resultado é significativo; isso vem nos passos seguintes. Clique em um município para destacá-lo nos dois.");
        pick(state.sel);
      } },

    { t: "O teste: permutação condicional",
      kid: "Para saber se o I local de um município é grande para o acaso, mantemos o valor dele no lugar e sorteamos, entre os outros 101, quais valores caem nos vizinhos dele. A cada rodada calculamos o I local de novo. Cada rodada vira um ponto no gráfico. Se poucas rodadas chegam ao valor verdadeiro, ele é difícil de explicar só pelo acaso. Escolha um município e acompanhe.",
      pc: function () { return "Fixa o valor do município escolhido. A cada rodada, sorteia sem repetição, entre os outros 101 municípios, tantos valores quantos são os vizinhos dele, calcula o I local com esses valores e conta. R é o número de rodadas com I local igual ou mais extremo que o verdadeiro, no lado de menos rodadas. O pseudo-p é (R + 1) ÷ (M + 1), e nunca é zero."; },
      conta: function (s) {
        var v = s.v, M = s.M, i = s.sel == null ? topI(v) : s.sel, pt = cond(v, i, M), l = LI(v), k = NBQ.nb[i].length;
        return "<span class=eq>Município: <b>" + NAMES[i] + "</b>; " + k + " vizinhos; quadrante " + S.QUAD[l.quad[i]] + "</span><span class=eq>I local verdadeiro = <b>" + f3(pt.I) + "</b>; M = <b>" + M + "</b> rodadas</span><span class=eq>Rodadas com I ≥ verdadeiro: <b>" + pt.Rup + "</b>; com I ≤ verdadeiro: <b>" + pt.Rlow + "</b></span><span class=eq>Lado usado: " + (pt.upper ? "alto (≥)" : "baixo (≤)") + "; R = <b>" + pt.R + "</b></span><span class=eq>pseudo-p = " + pform(pt.R, M) + "</span>" +
          (pt.R === 0 ? "<p>Nenhuma rodada chegou ao valor verdadeiro. O menor p possível é 1 ÷ (M + 1) = " + fp(1 / (M + 1), M) + ": escreve-se p menor ou igual a esse valor, nunca p = 0.</p>" : "") +
          "<p>Mesma semente, mesmo resultado. Com M = 999 o menor p possível é 0,001; com M = 9999, 0,0001.</p>";
      },
      tech: function () { return "<p>Permutação condicional: z<sub>i</sub> fica fixo e os outros n − 1 valores são permutados entre os outros n − 1 municípios. Como I<sub>i</sub> só depende do valor de i e dos k<sub>i</sub> valores que caem nos vizinhos, basta um sorteio parcial de Fisher–Yates de k<sub>i</sub> posições da lista dos outros municípios (gerador mulberry32). A lista não volta ao início entre as rodadas, e cada município tem sua semente: 2026 · 1000 + posição do município (0 a 101); por isso as primeiras 999 rodadas de 9999 são as mesmas de 999. R<sub>alto</sub> conta rodadas com I<sub>i</sub> ≥ observado e R<sub>baixo</sub> as com I<sub>i</sub> ≤ observado (empates entram nos dois, com tolerância de 10<sup>−12</sup>); usa-se R = min(R<sub>alto</sub>, R<sub>baixo</sub>), o lado em que o observado está mais isolado, e pseudo-p = (R + 1)/(M + 1). É um teste unilateral nesse lado, sem dobrar o p. Hipótese de troca: valores de municípios de tamanhos muito diferentes são tratados como intercambiáveis, o que é discutível para taxas (passo 6).</p>"; },
      q: "Por que não permutar todos os 102 valores, como no global?", a: "Porque aqui a pergunta é sobre um município específico, com o valor dele como é. Por isso o valor dele fica fixo e só os outros são trocados.",
      viz: function (stage, ctl, state, root) {
        var v = state.v, M = state.M, i = state.sel == null ? (state.sel = topI(v)) : state.sel, l = LI(v), pt = cond(v, i, M, true);
        var all = pt.sims, mn = Math.min.apply(null, all.concat([pt.I])), mx = Math.max.apply(null, all.concat([pt.I])), pad = (mx - mn) * 0.05 + 0.02;
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        b.innerHTML = "<p class=cap>Rodada atual: quem recebeu os valores dos vizinhos</p>";
        var hist = localHist(a, { lo: mn - pad, hi: mx + pad, obs: pt.I, upper: pt.upper, ymax: Math.max(5, Math.round(M / 12)), label: "Histograma do I local do município nas rodadas de permutação condicional", xlabel: "I local de cada rodada" });
        var real = {}; NBQ.nb[i].forEach(function (j) { real[j] = 1; });
        function base(j) { return j === i ? "qd" + l.quad[i] + " focus" : real[j] ? "nbr" : "qe"; }
        var mp = mapa(b, { w: b.clientWidth, cls: base, label: "Mapa com o município escolhido, seus vizinhos de verdade e os municípios sorteados na rodada", titles: function (j) { return j === i ? "município escolhido" : real[j] ? "vizinho de verdade" : ""; } });
        var inf = info(stage), smp = S.condSampler(l.z, W, i, S.lisaSeed(SEED, i), l.m2), r = 0, up = 0, lo = 0, prev = [], rate = M <= 999 ? 30 : M <= 1999 ? 80 : 400, un = VAR[v].un ? " p.p." : "";
        function done() { return r >= M; }
        function one() {
          var t = smp.next(); r++; if (t.I >= pt.I - 1e-12) up++; if (t.I <= pt.I + 1e-12) lo++; hist.add(t.I);
          prev.forEach(function (j) { setCls(mp, j, base(j)); }); prev = t.idx.slice(); prev.forEach(function (j) { setCls(mp, j, "drw"); });
          inf.textContent = "Rodada " + r + " de " + M + ": Wz sorteado = " + sgn(t.lag) + un + "; I local = " + f3(t.I) + ". Até agora: " + up + " com I ≥ verdadeiro e " + lo + " com I ≤ verdadeiro.";
          if (done()) {
            var R = pt.upper ? up : lo;
            if (up !== pt.Rup || lo !== pt.Rlow) console.error("Inconsistência no teste de permutação condicional");
            prev.forEach(function (j) { setCls(mp, j, base(j)); });
            inf.textContent = "Pronto: M = " + M + ", R = " + R + " (lado " + (pt.upper ? "alto" : "baixo") + "), pseudo-p = " + pform(R, M) + (R === 0 ? " (nunca zero)." : ".");
          }
        }
        if (clock.reduced) { while (!done()) one(); } else clock.rateTask(rate, one, done);
        stage.appendChild(legend([["swqe", "outros municípios"], ["swn", "vizinhos de verdade"], ["swdrw", "sorteados nesta rodada"], ["swq" + l.quad[i], "município escolhido"]])); aviso(stage);
        cap(stage, "Semente fixa: rodar de novo dá o mesmo resultado. Barras em vermelho: rodadas que chegaram ao I local verdadeiro ou passaram dele. Use os controles da animação para pausar, acelerar ou reiniciar.");
      } },

    { t: "Significância e mapa de aglomerados",
      kid: "Agora o teste foi feito nos 102 municípios. Mas 102 testes de uma vez dão chance de alguns passarem só por sorte. Por isso há três critérios: sem correção (p até 0,05), FDR (mais exigente) e Bonferroni (o mais exigente). Só os municípios que passam são coloridos pelo quadrante; o resto fica cinza. Troque o critério e veja quantos municípios viram aglomerado.",
      pc: function () { return "Roda o teste do passo 4 em cada município (999 a 9999 sorteios, semente própria de cada um). Aplica o critério escolhido sobre os 102 p-valores e pinta o mapa: alto-alto em vermelho escuro, baixo-baixo em azul escuro, baixo-alto em azul claro, alto-baixo em vermelho claro e não significativo em cinza."; },
      conta: function (s) {
        var v = s.v, M = s.M, pr = LS(v, M), fd = S.fdr(pr.p, ALPHA), bf = S.bonferroni(pr.p, ALPHA), rows = ["nc", "fdr", "bonf"].map(function (c) {
          var ct = counts(v, M, c), imp = c === "bonf" && !bonfOK(M);
          return "<tr><td>" + CRIT[c] + "</td><td>" + (c === "nc" ? "p ≤ 0,05" : c === "fdr" ? "p(i) ≤ i · 0,05 ÷ 102" : "p ≤ 0,05 ÷ 102 = " + fmt(bf.lim, 5)) + "</td><td class=num>" + ct.total + (imp ? " *" : "") + "</td><td class=num>" + ct.q[0] + "</td><td class=num>" + ct.q[2] + "</td><td class=num>" + ct.q[1] + "</td><td class=num>" + ct.q[3] + "</td></tr>";
        }).join("");
        return "<span class=eq>Variável: <b>" + VAR[v].nome + "</b>; M = <b>" + M + "</b>; menor p possível = 1 ÷ " + (M + 1) + " = " + fp(1 / (M + 1), M) + "</span><div class=tbl-wrap><table><tr><th>Critério</th><th>Regra</th><th class=num>Municípios</th><th class=num>Alto-alto</th><th class=num>Baixo-baixo</th><th class=num>Baixo-alto</th><th class=num>Alto-baixo</th></tr>" + rows + "</table></div>" +
          (bonfOK(M) ? "" : "<p>* Com M = " + M + " o menor p possível é " + fp(1 / (M + 1), M) + ", acima do limite de Bonferroni (" + fmt(bf.lim, 5) + "). O resultado zero é do método, não dos dados: Bonferroni exige pelo menos cerca de 2.040 sorteios (M + 1 ≥ 102 ÷ 0,05 = 2.040). Use M = 9999.</p>") +
          "<span class=eq>FDR: maior posição i com p(i) ≤ i · 0,05 ÷ 102 é i = <b>" + fd.k + "</b>" + (fd.k ? " (p(i) = " + fp(fd.cut, M) + ")" : "") + "</span>" +
          (v === "ruido" ? "<p>Este índice foi sorteado sem padrão espacial. Se os 102 testes fossem independentes e não houvesse padrão, esperaríamos cerca de 0,05 × 102 ≈ 5 municípios com p ≤ 0,05; aqui foram " + counts(v, M, "nc").total + " sem correção.</p>" : "");
      },
      tech: function () { return "<p><b>Comparações múltiplas.</b> São 102 testes, e eles não são independentes (municípios vizinhos compartilham valores). <b>Bonferroni:</b> significativo se p ≤ α / m = 0,05 / 102 ≈ 0,00049; como o menor p do sorteio é 1/(M + 1), é preciso M + 1 ≥ 2.040 (M ≥ 2.039). <b>FDR:</b> ordenam-se os p, p(1) ≤ … ≤ p(102); acha-se o maior i com p(i) ≤ i · α / m; todos os municípios até a posição i são significativos. É menos rígido que Bonferroni. <b>Mapa de clusters:</b> município significativo recebe a cor do seu quadrante (S.quadrant, pelos sinais de z e Wz); os demais, cinza. A escolha do critério (e do M) para o projeto ainda será definida; mostrar os três faz parte do método. O gráfico mostra os p em ordem contra os três limites; só aparecem p ≤ 0,06.</p>"; },
      q: "Qual critério usar?", a: "Não há um certo em si: sem correção aponta mais municípios, com mais chance de falsos achados; Bonferroni aponta poucos, com mais chance de deixar passar padrões reais. A escolha do projeto ainda será definida.",
      viz: function (stage, ctl, state, root) {
        var v = state.v, M = state.M, crit = state.crit, l = LI(v), pr = LS(v, M), inf = info(stage), cl = clsOf(v, M, crit);
        function msg(i) { return NAMES[i] + ": " + S.QUAD[l.quad[i]] + "; I local = " + f3(l.I[i]) + "; R = " + pr.R[i] + "; p = " + fp(pr.p[i], M) + ". Passa em: " + ["nc", "fdr", "bonf"].filter(function (c) { return sigOf(v, M, c)[i]; }).map(function (c) { return CRIT[c].toLowerCase(); }).join(", ") + (["nc", "fdr", "bonf"].some(function (c) { return sigOf(v, M, c)[i]; }) ? "." : "nenhum critério."); }
        var ini = topI(v), mp = mapa(stage, { w: stage.clientWidth, onSel: function (i) { mp.paths.forEach(function (q, j) { q.setAttribute("class", cl(j) + " clk" + (j === i ? " focus" : "")); }); inf.textContent = msg(i); }, cls: cl, label: "Mapa de aglomerados do Moran local, critério " + CRIT[crit], titles: function (i) { return S.QUAD[l.quad[i]] + "; p = " + fp(pr.p[i], M); } });
        var ct = counts(v, M, crit);
        inf.textContent = "Critério " + CRIT[crit] + ": " + ct.total + " de 102 municípios viram aglomerado ou ponto fora da curva" + (crit === "bonf" && !bonfOK(M) ? ". Com M = " + M + ", Bonferroni é inalcançável: use M = 9999." : ". Clique em um município para ver o p.");
        stage.appendChild(legend(LEG5)); aviso(stage);
        if (crit === "bonf" && !bonfOK(M)) { var al = document.createElement("div"); al.className = "callout alert"; al.innerHTML = "<b>Atenção: M insuficiente</b>Bonferroni exige pelo menos cerca de 2.040 sorteios (menor p possível 1 ÷ (M + 1) tem de ficar abaixo de 0,05 ÷ 102 = 0,00049). Com M = " + M + " nenhum município pode passar. Use 9999."; stage.appendChild(al); }
        var cp = document.createElement("p"); cp.className = "cap"; cp.textContent = "Os p em ordem crescente contra os três limites. Pontos vermelhos: significativos no critério escolhido."; stage.appendChild(cp);
        pChart(stage, v, M, crit);
      } },

    { t: "Como ler: núcleo do aglomerado e taxas instáveis",
      kid: "O município colorido é o centro (núcleo) do aglomerado, não o aglomerado inteiro: seus vizinhos fazem parte da leitura, mesmo quando não passam no teste. Há ainda um cuidado com municípios pequenos: com poucos nascidos vivos, a taxa balança muito de um ano para outro, e isso pode produzir um I local alto à toa. As listras no mapa marcam os municípios com menos de 1.000 nascidos vivos. Clique em um município colorido para ver o entorno dele.",
      pc: function () { return "Pinta o mapa de aglomerados e põe listras nos municípios com denominador menor que 1.000 (bandeira do projeto). Ao clicar em um município significativo, destaca seus vizinhos e conta quantos têm a mesma cor. Também conta quantos municípios coloridos têm denominador pequeno."; },
      conta: function (s) {
        var v = s.v, M = s.M, crit = s.crit, ct = counts(v, M, crit), nsig = ct.total, big = nsig - ct.small, sg = sigOf(v, M, crit);
        var sd = [300, 1000, 3000, 12000].map(function (n) { return "<tr><td class=num>" + n.toLocaleString("pt-BR") + "</td><td class=num>" + fmt(Math.sqrt(0.9 * 0.1 / n) * 100, 2) + " p.p.</td></tr>"; }).join("");
        return "<span class=eq>Critério " + CRIT[crit] + ", M = " + M + ": <b>" + nsig + "</b> municípios coloridos; <b>" + ct.small + "</b> têm denominador menor que 1.000 e <b>" + big + "</b> têm 1.000 ou mais</span><span class=eq>Municípios com denominador menor que 1.000 no estado: <b>" + NPEQ + "</b> de 102</span>" +
          "<p><b>Por que o denominador importa.</b> Ordem de grandeza com um modelo simples: se a cobertura verdadeira fosse 90% e cada criança fosse vacinada ou não ao acaso, a oscilação típica da taxa por acaso (desvio padrão binomial, √(0,9 × 0,1 ÷ n)) seria:</p><div class=tbl-wrap><table><tr><th class=num>Nascidos vivos (n)</th><th class=num>Oscilação típica</th></tr>" + sd + "</table></div>" +
          "<p>Quanto menor o município, maior a oscilação, e valores extremos aparecem mais por sorte. O teste de permutação trata todos os municípios como trocáveis e não corrige isso.</p>" +
          "<p><b>Alternativa: Bayes empírico.</b> Em vez de usar a taxa bruta, calcula-se uma taxa suavizada: a taxa de cada município é puxada para uma média de referência, e mais ainda quanto menor for o município. Exige a contagem de eventos e a população de cada município; a base fictícia deste simulador só tem a taxa e o número de nascidos vivos, e por isso a suavização não é aplicada aqui. O projeto ainda vai decidir entre taxa bruta e suavizada.</p>";
      },
      tech: function () { return "<p><b>Núcleo.</b> O teste local é feito em cada município, comparando-o com a média dos seus vizinhos. Um município significativo indica que ele e o entorno imediato formam um arranjo pouco provável ao acaso; o aglomerado como região é lido juntando o núcleo e os vizinhos, e isso depende da matriz W. <b>Taxas instáveis.</b> A variância de uma taxa diminui com o denominador (no modelo binomial, p(1 − p)/n). A hipótese de troca do teste ignora isso. O que se faz: marcar os municípios com denominador pequeno (aqui, n &lt; 1.000, bandeira do projeto), reportar a sensibilidade (com e sem eles) e considerar taxas suavizadas por Bayes empírico, que exige contagens e populações. Nada disso foi decidido: ver Decisões do projeto. A tabela de oscilação é uma ilustração aritmética, não uma medida dos dados.</p>"; },
      q: "Posso ignorar os municípios pequenos?", a: "Não por conta própria. O projeto marca os municípios com denominador menor que 1.000 e mostra o resultado com e sem eles; como tratá-los na análise principal ainda será definido.",
      viz: function (stage, ctl, state, root) {
        var v = state.v, M = state.M, crit = state.crit, l = LI(v), pr = LS(v, M), cl = clsOf(v, M, crit), sg = sigOf(v, M, crit), inf = info(stage);
        var sel = -1, nbset = {};
        function msg(i) {
          if (!sg[i]) return NAMES[i] + (PEQ[i] ? " (denominador menor que 1.000)" : "") + ": não significativo neste critério (p = " + fp(pr.p[i], M) + ").";
          var same = 0, n = NBQ.nb[i].length; var sigN = 0; NBQ.nb[i].forEach(function (j) { if (sg[j]) sigN++; }); NBQ.nb[i].forEach(function (j) { if (sg[j] && l.quad[j] === l.quad[i]) same++; });
          return NAMES[i] + ": núcleo " + S.QUAD[l.quad[i]] + (PEQ[i] ? " (denominador menor que 1.000)" : "") + ". Dos " + n + " vizinhos, " + sigN + " passaram no teste (mantêm a cor; " + same + " da mesma cor do núcleo) e " + (n - sigN) + " não passaram (em âmbar).";
        }
        var mp = mapa(stage, { w: stage.clientWidth, onSel: function (i) { sel = i; nbset = {}; if (sg[i]) NBQ.nb[i].forEach(function (j) { nbset[j] = 1; }); mp.paths.forEach(function (q, j) { q.setAttribute("class", (nbset[j] && !sg[j] ? "nbr" : cl(j)) + " clk" + (j === i ? " focus" : "")); }); inf.textContent = msg(i); }, cls: cl, label: "Mapa de aglomerados do Moran local com hachura nos municípios com denominador menor que 1.000", titles: function (i) { return S.QUAD[l.quad[i]] + "; " + D.nasc[i].toLocaleString("pt-BR") + " nascidos vivos (fictícios)"; } });
        hachura(mp, PEQ);
        inf.textContent = "Clique em um município colorido (não cinza) para ver o entorno dele.";
        stage.appendChild(legend(LEG5)); stage.appendChild(legend([["swhat", "listras: menos de 1.000 nascidos vivos (fictícios)"], ["swn", "vizinhos do município clicado que não passaram no teste"]])); aviso(stage);
        cap(stage, "Mapa do critério e do número de sorteios escolhidos acima. Os números de nascidos vivos também são fictícios.");
      } }
  ];
  STEPS.forEach(function (s) { var p = s.pc, c = s.conta, t = s.tech; s.pc = function () { return typeof p === "function" ? p() : p; }; s.conta = function (st) { return c(st); }; s.tech = function () { return t(); }; });

  function cond(v, i, M, keep) { var k = "c" + v + i + M + (keep ? "k" : ""); return cache[k] || (cache[k] = S.condPerm(VAR[v].x, W, i, M, SEED, !!keep, LI(v))); }

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
    state.v = state.v || "cob"; state.M = state.M || 999; state.sub = state.sub || 1; state.crit = state.crit || "fdr";
    var N_ = STEPS.length, idx = Math.max(0, Math.min(N_ - 1, (state.step || 1) - 1)), st = STEPS[idx];
    clock.clear(); root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "opts"; root.appendChild(ds);
    function redraw() { renderPassos(root, app, state); app.remount && app.remount(); }
    if (idx !== 1) ds.appendChild(chips("Variável", [["cob", "cobertura"], ["aband", "abandono"], ["ruido", "sem padrão"]], state.v, function (v) { state.v = v; state.sel = null; redraw(); }));
    if (idx === 1) ds.appendChild(chips("Etapa", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]], state.sub, function (v) { state.sub = v; redraw(); }));
    if (idx === 3) { if (state.sel == null) state.sel = topI(state.v); ds.appendChild(seletor(state, redraw)); }
    if (idx >= 3 && idx <= 5) ds.appendChild(chips("Sorteios", [[999, "999"], [1999, "1999"], [9999, "9999"]], state.M, function (v) { state.M = v; redraw(); }));
    if (idx >= 4) ds.appendChild(chips("Critério", [["nc", "sem correção"], ["fdr", "FDR"], ["bonf", "Bonferroni"]], state.crit, function (v) { state.crit = v; redraw(); }));
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
    return "<div class=card><h2>Qual pergunta este método responde?</h2><p>Onde, em Alagoas, estão os municípios que formam aglomerados de cobertura vacinal alta ou baixa, e quais destoam do entorno? O Moran local (LISA, Anselin, 1995) responde isso município a município, com um teste para cada um.</p>" +
      "<p>Ele vem depois do I de Moran global (Moran, 1950), que só diz se há padrão no conjunto. Aqui o resultado vira um mapa de aglomerados: alto-alto (vermelho escuro), baixo-baixo (azul escuro), baixo-alto (azul claro), alto-baixo (vermelho claro) e não significativo (cinza). Há estudos de análise espacial da cobertura vacinal no Nordeste e na Paraíba (Cunha e colaboradores, 2022 e 2023).</p></div>" +
      "<div class='callout alert'><b>Atenção</b>Os valores deste simulador são fictícios e sorteados, sem relação com os municípios reais. Só o desenho dos municípios (malha do IBGE) e as relações de vizinhança são reais.</div><p>A simulação está no topo desta página. As perguntas frequentes ficam no final.</p>";
  }
  function tabDados() {
    var rows = G.map(function (f, i) { return "<tr><td>" + NAMES[i] + "</td><td class=num>" + f1(D.cob[i]) + "</td><td class=num>" + f1(D.aband[i]) + "</td><td class=num>" + f1(D.ruido[i]) + "</td><td class=num>" + D.nasc[i].toLocaleString("pt-BR") + "</td></tr>"; }).join("");
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Variável</th><th>Papel</th><th>Unidade</th><th>Origem aqui</th></tr><tr><td>Malha municipal</td><td>geometria e vizinhança</td><td>102 polígonos</td><td>IBGE, 2025 (real)</td></tr><tr><td>Cobertura vacinal</td><td>variável analisada</td><td>%</td><td>sorteada, semente fixa, com padrão espacial inventado</td></tr><tr><td>Taxa de abandono</td><td>variável analisada</td><td>%</td><td>sorteada, semente fixa, ligada à cobertura</td></tr><tr><td>Índice sem padrão</td><td>caso de contraste</td><td>sem unidade</td><td>sorteio independente por município</td></tr><tr><td>Nascidos vivos</td><td>denominador; bandeira abaixo de 1.000</td><td>pessoas</td><td>sorteados, sem relação com os reais</td></tr></table></div>" +
      "<p>Valores sorteados, sem relação com os municípios reais. O gerador está em <code>tests/gen_spatial_data.js</code>. Vizinhança: rainha, padronizada por linha, calculada no navegador a partir da malha.</p></div>" +
      "<details class=tech><summary>Tabela dos 102 municípios (valores fictícios)</summary><div class=scroll-box><table><tr><th>Município</th><th class=num>Cobertura (%)</th><th class=num>Abandono (%)</th><th class=num>Índice sem padrão</th><th class=num>Nascidos vivos</th></tr>" + rows + "</table></div></details>";
  }
  function tabResultado() {
    var M = 9999, rows = ["cob", "aband", "ruido"].map(function (v) { var a = counts(v, M, "nc"), b = counts(v, M, "fdr"), c = counts(v, M, "bonf"); return "<tr><td>" + VAR[v].curto + "</td><td class=num>" + a.total + "</td><td class=num>" + b.total + "</td><td class=num>" + c.total + "</td></tr>"; }).join("");
    var cb = counts("cob", M, "fdr");
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Um mapa de aglomerados e uma tabela com a contagem por quadrante, para um critério de significância e um número de sorteios definidos. O mapa mostra onde estão os núcleos de aglomerados e os pontos fora da curva.</p><ul><li><b>Pode concluir:</b> quais municípios formam, com seus vizinhos, um arranjo pouco provável ao acaso, e de que tipo (alto-alto, baixo-baixo, baixo-alto ou alto-baixo), no critério escolhido.</li><li><b>Não pode concluir:</b> a causa do padrão, nem o tamanho ou limite exato do aglomerado, nem nada sobre um município isolado com denominador pequeno sem examinar a estabilidade da taxa.</li></ul></div>" +
      "<div class=card><h3>Exemplo fictício (rainha, 9999 sorteios, semente " + SEED + ")</h3><p>Municípios coloridos em cada critério:</p><div class=tbl-wrap><table><tr><th>Variável</th><th class=num>Sem correção</th><th class=num>FDR</th><th class=num>Bonferroni</th></tr>" + rows + "</table></div><p>Cobertura com FDR: " + cb.total + " municípios (alto-alto " + cb.q[0] + ", baixo-baixo " + cb.q[2] + ", baixo-alto " + cb.q[1] + ", alto-baixo " + cb.q[3] + "). Com 999 sorteios, Bonferroni não consegue marcar nenhum município (menor p possível 0,001, acima de 0,00049). Exemplo A–F: I_i = " + TOY.l.I.map(function (a) { return f3(a); }).join("; ") + "; p exato = " + TOY.ex.map(function (e) { return f2(e.p); }).join("; ") + ".</p></div>";
  }
  function tabLimites() {
    var Ls = ["Os valores do simulador são fictícios; só a geometria e a vizinhança são reais.", "O resultado depende da definição de vizinhança e da padronização de W; aqui só foi usada a rainha.", "São 102 testes ao mesmo tempo, e eles não são independentes; sem correção, aparecem municípios significativos por sorte.", "O pseudo-p depende do número de sorteios e da semente; o menor valor possível é 1/(M + 1) e nunca é zero. Bonferroni exige pelo menos cerca de 2.040 sorteios.", "O teste trata os municípios como trocáveis, mas taxas de municípios com denominador pequeno são mais instáveis e podem produzir resultados locais por oscilação do acaso.", "O município significativo é o núcleo, não o aglomerado inteiro; o contorno do aglomerado não é dado pelo teste.", "A análise é ecológica: descreve municípios, não crianças. O padrão não prova causa.", "A divisão territorial usada (limites municipais) influencia o resultado."];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + Ls.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var D1 = ["Escopo: 102 municípios de Alagoas, com cobertura vacinal e taxa de abandono.", "Cobertura sem teto na base, com bandeiras para acima de 100%, 110% e 120% e abaixo de 50%; o teto de 100% só vale em mapas e médias, com o valor bruto na legenda.", "Denominador abaixo de 1.000 como bandeira; análise principal com o valor bruto e sensibilidade.", "Dispensa de submissão ao CEP mantida por ora."];
    var P = ["Matriz W: rainha, torre, k vizinhos mais próximos ou banda de distância, e como tratar municípios isolados.", "Número de sorteios (999 a 9999) e semente.", "Correção para comparações múltiplas: nenhuma, FDR ou Bonferroni (esta exige pelo menos cerca de 2.040 sorteios).", "Nível de significância (aqui 0,05).", "Taxas brutas ou suavizadas (por exemplo, Bayes empírico, que exige contagem e população).", "Como tratar os municípios com denominador pequeno no mapa de aglomerados (manter com bandeira, mostrar com e sem)."];
    return "<div class=card><h2>O que o projeto definiu</h2><ul>" + D1.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>Escolhas que o projeto ainda vai definir</h2><p class=cap>Estas escolhas afetam o resultado e estão em aberto; aqui aparecem as alternativas, sem decisão.</p><ul>" + P.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabFontes() { var r = (NS.refs && NS.refs.lisa) || []; return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>"; }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>Entradas: um arquivo de geometria dos municípios (por exemplo, a malha do IBGE) e uma tabela com a variável de interesse por município. Existem pacotes de análise espacial em Python e em R que calculam o Moran local, a matriz de vizinhança e o teste por permutação. <b>Confira a documentação do pacote e da versão que for usar</b>: nomes de funções, opções e colunas de resultado mudam entre versões. Os números não serão idênticos aos deste simulador, porque o sorteio e a escala de I_i podem ser diferentes.</p>" +
      "<h3>A lógica, em pseudocódigo próprio</h3><pre>vizinhos de i = municípios que tocam o município i (rainha)\nW = pesos iguais entre os vizinhos de i, somando 1 por linha\nz[i] = valor[i] − média dos valores\nWz[i] = média de z entre os vizinhos de i\nI[i] = z[i] × Wz[i] / (soma de z² / n)\nquadrante[i] = pelos sinais de z[i] e Wz[i]\n\npara cada município i, em M rodadas:\n  mantenha z[i] fixo\n  sorteie, entre os outros n − 1 municípios, tantos valores quantos são os vizinhos de i\n  calcule o I local com esses valores\nR = nº de rodadas com I igual ou mais extremo que o observado (lado com menos rodadas)\npseudo-p[i] = (R + 1) / (M + 1)\n\nBonferroni: significativo se p &lt;= 0,05 / 102\nFDR (Benjamini-Hochberg): ordene os p; ache o maior i com p(i) &lt;= i × 0,05 / 102; todos até i são significativos</pre>" +
      "<h3>Conferência neste repositório</h3><p>O arquivo <code>tests/check_lisa.py</code> refaz em Python (shapely, numpy) a vizinhança, o I local, os quadrantes, a permutação condicional com a mesma semente (mulberry32 e sorteio parcial reimplementados), o teste exato do exemplo A–F, os critérios Bonferroni e FDR e uma verificação estatística tolerante com sorteios independentes.</p><pre>node tests/dump_lisa.js &gt; lisa_js.json\npython3 tests/check_lisa.py lisa_js.json</pre></div>";
  }
  function tabFaq() { return "<div class=card>" + STEPS.map(function (x) { return "<h3>" + x.q + "</h3><p>" + x.a + "</p>"; }).join("") + "<h3>O que é “semente fixa”?</h3><p>É o ponto de partida do sorteio. Com a mesma semente, o sorteio sai igual toda vez, e por isso o resultado pode ser conferido e repetido. Aqui cada município tem a sua semente, derivada de uma semente única.</p><h3>Por que o p nunca é zero?</h3><p>Porque o valor verdadeiro conta como uma das M + 1 possibilidades. O menor p possível é 1 ÷ (M + 1).</p><h3>E se um município ficar com p exatamente em 0,05?</h3><p>O p mede quão raro seria o resultado ao acaso, não é uma linha que separa certo de errado. O projeto ainda vai definir como relatar e interpretar o p.</p><h3>Por que aparecem nomes de municípios reais?</h3><p>Para o mapa ser reconhecível. Os valores, porém, são sorteados e não têm relação com os municípios reais; nada aqui descreve a cobertura de um município.</p></div>"; }

  NS.methods.lisa = {
    id: "lisa", n: 5, nome: "Moran Local (LISA)", ready: true, steps: STEPS.length, count: function () { return STEPS.length; },
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
    }
  };
})();
