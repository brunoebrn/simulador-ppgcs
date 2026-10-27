/* Método 4: I de Moran global. Núcleo numérico em js/spatial_core.js; mapa compartilhado em js/charts.js (NS.charts.mapa).
   Geometria real dos 102 municípios de Alagoas (IBGE 2025); VALORES 100% fictícios (js/spatial_data.js), sem relação com os municípios reais. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var S = NS.spatial, C = NS.charts, clock = NS.clock, fmt = C.fmt, el = C.el;
  var G = NS.geo.features, D = NS.spatial_data, N = G.length, SEED = 2026;
  var NAMES = G.map(function (f) { return f.properties.n; });
  var NB = { queen: S.neighbors(G, "queen"), rook: S.neighbors(G, "rook"), knn5: S.knn(G, 5) };
  var WS = { queen: S.rowStd(NB.queen), rook: S.rowStd(NB.rook), knn5: S.rowStd(NB.knn5) };
  var KIND = { queen: "rainha", rook: "torre", knn5: "5 vizinhos mais próximos" };
  var KSHORT = { queen: "Rainha", rook: "Torre", knn5: "5 próximos" };
  var VAR = {
    cob: { x: D.cob, nome: "cobertura vacinal fictícia (%)", curto: "Cobertura", un: "%" },
    aband: { x: D.aband, nome: "taxa de abandono fictícia (%)", curto: "Abandono", un: "%" },
    ruido: { x: D.ruido, nome: "índice fictício sem padrão espacial", curto: "Sem padrão", un: "" }
  };
  var cache = {};
  function MI(v, k) { var key = "m" + v + k; return cache[key] || (cache[key] = S.moranI(VAR[v].x, WS[k])); }
  function PT(v, k, M) { var key = "p" + v + k + M; return cache[key] || (cache[key] = S.permTest(VAR[v].x, WS[k], M, SEED)); }
  function band(p) { var s = p.sims.slice().sort(function (a, b) { return a - b; }); return [S.quantile(s, 0.025), S.quantile(s, 0.975)]; }

  /* Exemplo mínimo A–F (taxas 95, 92, 90, 80, 72, 70; vizinhos A–B, B–C, B–D, C–D, D–E, E–F). */
  var TOY = { x: [95, 92, 90, 80, 72, 70], nb: [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]] };
  TOY.W = S.rowStd(TOY.nb); TOY.m = S.moranI(TOY.x, TOY.W); TOY.mean = S.mean(TOY.x);
  TOY.prod = TOY.m.z.map(function (z, i) { return z * TOY.m.wz[i]; }); TOY.ex = S.exactPerm(TOY.x, TOY.W);
  TOY.all = []; (function () { var a = TOY.x.slice(); (function rec(k) { if (k === 6) { TOY.all.push(S.moranI(a, TOY.W).I); return; } for (var i = k; i < 6; i++) { var t = a[k]; a[k] = a[i]; a[i] = t; rec(k + 1); t = a[k]; a[k] = a[i]; a[i] = t; } })(0); })();
  var LET = "ABCDEF";

  /* Tabuleiros 6×6 (vizinhança por divisa) para a ideia de agrupado, ao acaso e alternado. */
  var GRID = (function () {
    var nb = []; for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++) { var l = []; if (r > 0) l.push((r - 1) * 6 + c); if (c > 0) l.push(r * 6 + c - 1); if (c < 5) l.push(r * 6 + c + 1); if (r < 5) l.push((r + 1) * 6 + c); nb.push(l.sort(function (a, b) { return a - b; })); }
    var W = S.rowStd(nb), blk = [], chk = []; for (var i = 0; i < 36; i++) { blk.push(i % 6 < 3 ? 1 : 0); chk.push(((i / 6 | 0) + i % 6) % 2); }
    var rnd = blk.slice(); S.shuffle(rnd, S.rng(46));
    return [{ t: "Agrupado", v: blk }, { t: "Ao acaso", v: rnd }, { t: "Alternado", v: chk }].map(function (g) { g.I = S.moranI(g.v, W).I; return g; });
  })();

  function f1(x) { return fmt(x, 1); } function f2(x) { return fmt(x, 2); } function f3(x) { return fmt(x, 3); } function f4(x) { return fmt(x, 4); }
  function pdig(M) { return String(M + 1).length - 1; }
  function fp(p, M) { return fmt(p, pdig(M)); }
  /* Texto do pseudo-p: nunca escreve p = 0. Se R = 0, o menor valor possível do teste é 1/(M+1). */
  function ptxt(R, M) { return R === 0 ? "menor que 1/(" + M + " + 1) = " + fp(1 / (M + 1), M) : "= " + fp(S.pseudoP(R, M), M); }
  function pform(R, M) { return "(" + R + " + 1) ÷ (" + M + " + 1) = " + fp(S.pseudoP(R, M), M); }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function aviso(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Valores sorteados, sem relação com os municípios reais. Só o desenho dos municípios e as vizinhanças são reais."; stage.appendChild(p); }
  function legend(items) { var d = document.createElement("div"); d.className = "legend"; d.innerHTML = items.map(function (i) { return "<span><i class='" + i[0] + "'></i>" + i[1] + "</span>"; }).join(""); return d; }
  function info(stage) { var p = document.createElement("p"); p.className = "sum"; p.setAttribute("aria-live", "polite"); p.style.margin = "4px 6px"; stage.appendChild(p); return p; }
  function setCls(m, i, c) { m.paths[i].setAttribute("class", c); }
  function mapa(parent, o) { return C.mapa(parent, o); }
  function two(x, m) { return function (i) { return x[i] >= m ? "q3" : "q0"; }; }

  /* Histograma que acumula (um valor por vez) com linhas do I observado e de E[I]. */
  function nullHist(parent, o) {
    var w = C.width(parent), h = o.h || 230, m = { l: 46, r: 14, t: 24, b: 42 }, nb = 30, lo = o.lo, hi = o.hi, bw = (hi - lo) / nb, counts = new Array(nb).fill(0), ymax = o.ymax || 6;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": o.label }, parent), gA = el("g", { "class": "axis" }, svg), gB = el("g", {}, svg), gO = el("g", {}, svg), rects = [];
    var X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hi - lo); }, Y = function (c) { return m.t + (h - m.t - m.b) * (1 - c / ymax); };
    function axes() {
      gA.textContent = ""; el("line", { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b }, gA); el("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b }, gA);
      for (var t = Math.ceil(lo * 5 - 1e-9) / 5; t <= hi + 1e-9; t += 0.2) el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, fmt(t, 1));
      [0, ymax].forEach(function (c) { el("text", { x: m.l - 6, y: Y(c) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, String(c)); });
      el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, o.xlabel);
      el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, gA, "nº de embaralhamentos");
    }
    function bar(b) { var hit = o.upper ? lo + b * bw >= o.obs : lo + (b + 1) * bw <= o.obs; if (!rects[b]) rects[b] = el("rect", { "class": "bar" }, gB); rects[b].setAttribute("class", hit ? "bar-hit" : "bar"); rects[b].setAttribute("x", (X(lo + b * bw) + 1).toFixed(1)); rects[b].setAttribute("width", Math.max(1, X(lo + (b + 1) * bw) - X(lo + b * bw) - 2).toFixed(1)); rects[b].setAttribute("y", Y(counts[b]).toFixed(1)); rects[b].setAttribute("height", (h - m.b - Y(counts[b])).toFixed(1)); }
    function all() { axes(); for (var b = 0; b < nb; b++) if (counts[b]) bar(b); }
    all();
    el("line", { x1: X(o.EI), x2: X(o.EI), y1: m.t, y2: h - m.b, stroke: "var(--muted)", "stroke-width": 2, "stroke-dasharray": "5 4" }, gO);
    el("text", { x: X(o.EI) + 4, y: m.t + 4, "font-size": 12, "class": "muted" }, gO, "E[I] = " + f2(o.EI));
    el("line", { x1: X(o.obs), x2: X(o.obs), y1: m.t, y2: h - m.b, "class": "obs" }, gO);
    var obsRight = X(o.obs) > (w + m.l) / 2;
    el("text", { x: obsRight ? X(o.obs) - 6 : X(o.obs) + 6, y: m.t + 18, "text-anchor": obsRight ? "end" : "start", "font-size": 12, "font-weight": 700 }, gO, "I observado = " + f2(o.obs));
    return {
      add: function (v) { var b = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw))); counts[b]++; if (counts[b] > ymax) { ymax = Math.ceil(counts[b] * 1.5); all(); } else bar(b); },
      svg: svg
    };
  }

  /* Linhas lado a lado: faixa de 95% dos embaralhamentos (cinza), I observado (ponto) e E[I] (tracejado). rows: { t, I, lo, hi, txt }. */
  function rowsFig(parent, rows, EI, label) {
    var w = C.width(parent), rh = 52, m = { l: 112, r: 12, t: 22, b: 34 }, h = m.t + rh * rows.length + m.b;
    var mn = Math.min(EI, 0), mx = 0; rows.forEach(function (r) { mn = Math.min(mn, r.I, r.lo); mx = Math.max(mx, r.I, r.hi); });
    var lo = Math.floor((mn - 0.03) * 5) / 5, hi = Math.ceil((mx + 0.03) * 5) / 5, X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hi - lo); };
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": label }, parent);
    for (var t = Math.ceil(lo * 5 - 1e-9) / 5; t <= hi + 1e-9; t += 0.2) { el("line", { x1: X(t), x2: X(t), y1: m.t - 4, y2: h - m.b, stroke: "var(--line)" }, svg); el("text", { x: X(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, fmt(t, 1)); }
    el("line", { x1: X(EI), x2: X(EI), y1: m.t - 4, y2: h - m.b, stroke: "var(--muted)", "stroke-width": 2, "stroke-dasharray": "5 4" }, svg);
    el("text", { x: X(EI) + 4, y: 11, "font-size": 12, "class": "muted" }, svg, "E[I] = " + f2(EI));
    rows.forEach(function (r, i) {
      var y = m.t + i * rh + rh / 2;
      el("text", { x: 4, y: y - 3, "font-size": 13, "font-weight": 700 }, svg, r.t); el("text", { x: 4, y: y + 13, "font-size": 12, "class": "muted" }, svg, r.txt);
      el("rect", { x: X(r.lo), y: y - 8, width: Math.max(2, X(r.hi) - X(r.lo)), height: 16, rx: 3, fill: "var(--line)" }, svg);
      el("circle", { cx: X(r.I), cy: y, r: 7, fill: "var(--c3)", stroke: "var(--bg)", "stroke-width": 2 }, svg);
    });
    el("text", { x: (m.l + w - m.r) / 2, y: h - 2, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, "I de Moran");
    return svg;
  }

  /* ---------- passos ---------- */
  var STEPS = [
    { t: "A pergunta: há padrão espacial?",
      kid: "Olhe o mapa de Alagoas: os municípios acima da média (azul escuro) ficam juntos ou estão misturados como confete? O I de Moran é um número que responde a isso. Perto do que se espera ao acaso: sem padrão. Bem acima: vizinhos parecidos. Bem abaixo: vizinhos opostos, como num tabuleiro de xadrez.",
      pc: function () { return "Compara o valor de cada município com o valor médio dos seus vizinhos e resume as 102 comparações num único número, o I de Moran. Depois, nos próximos passos, ele pergunta se esse número seria comum se os valores estivessem espalhados ao acaso."; },
      conta: function (s) {
        var v = s.v, m = MI(v, "queen"), rows = GRID.map(function (g) { return "<tr><td>" + g.t + "</td><td class=num>" + f2(g.I) + "</td></tr>"; }).join("");
        return "<span class=eq>Variável: <b>" + VAR[v].nome + "</b></span><span class=eq>I de Moran (rainha) = <b>" + f3(m.I) + "</b></span><span class=eq>Esperado ao acaso: E[I] = −1 ÷ (n − 1) = −1 ÷ " + (N - 1) + " = <b>" + f3(m.EI) + "</b></span>" +
          "<p>Para sentir a escala, três tabuleiros de 36 casas (vizinhos pela divisa), cada um com 18 casas escuras e 18 claras:</p><div class=tbl-wrap><table><tr><th>Tabuleiro</th><th class=num>I de Moran</th></tr>" + rows + "</table></div>";
      },
      tech: function () { return "<p>O I de Moran (Moran, 1950) mede a autocorrelação espacial global: I = (n/S0) · Σ<sub>i</sub> Σ<sub>j</sub> w<sub>ij</sub> z<sub>i</sub> z<sub>j</sub> / Σ z<sub>i</sub>², com z o desvio da média e S0 a soma dos pesos. Sob ausência de padrão, o valor esperado é E[I] = −1/(n−1), um pouco abaixo de zero. Os tabuleiros usam vizinhança por divisa (torre) e pesos padronizados por linha; o “ao acaso” é um embaralhamento do tabuleiro agrupado, com semente fixa (46) escolhida por dar um I próximo do esperado, só para ilustrar. Os números dos tabuleiros são ilustrativos e não valem para os dados reais.</p>"; },
      q: "O que o I de Moran responde?", a: "Se municípios vizinhos têm valores mais parecidos (ou mais diferentes) do que se esperaria se os valores estivessem espalhados ao acaso. Ele resume isso num número e, com um teste, diz quão raro seria esse número ao acaso.",
      viz: function (stage, ctl, state) {
        var x = VAR[state.v].x, mean = S.mean(x), grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>" + VAR[state.v].curto + ": acima ou abaixo da média</p>"; b.innerHTML = "<p class=cap>Três tabuleiros de exemplo</p>";
        mapa(a, { w: a.clientWidth, cls: two(x, mean), label: "Mapa de Alagoas com a variável fictícia acima ou abaixo da média", titles: function (i) { return f1(x[i]) + VAR[state.v].un; } });
        var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;justify-content:space-between"; b.appendChild(row);
        GRID.forEach(function (g) {
          var cell = document.createElement("div"); cell.style.cssText = "flex:1 1 0;min-width:0;text-align:center;font-size:.85rem";
          var sv = el("svg", { viewBox: "0 0 60 60", role: "img", "aria-label": "Tabuleiro " + g.t.toLowerCase() + ", I de Moran " + f2(g.I), style: "width:100%;max-width:110px;display:block;margin:0 auto" }, cell);
          g.v.forEach(function (v, i) { el("rect", { x: (i % 6) * 10, y: (i / 6 | 0) * 10, width: 9.4, height: 9.4, "class": v ? "q3" : "q0", fill: v ? "var(--q3)" : "var(--q0)" }, sv); });
          cell.appendChild(document.createTextNode(g.t)); cell.appendChild(document.createElement("br")); var bd = document.createElement("b"); bd.textContent = "I = " + f2(g.I); cell.appendChild(bd); row.appendChild(cell);
        });
        stage.appendChild(legend([["sq sw3", "acima da média"], ["sq sw0", "abaixo da média"]])); aviso(stage);
        cap(stage, "À esquerda, a variável escolhida. À direita, o que o I de Moran enxerga em três padrões extremos.");
      } },

    { t: "A conta com seis municípios (A a F)",
      kid: "Vamos fazer a conta à mão com seis municípios fictícios, A a F. B é vizinho de A, C e D; D também é vizinho de E; E é vizinho de F. Em cada etapa aparece uma coluna nova na tabela: tirar a média, olhar os vizinhos, multiplicar, somar e dividir.",
      pc: function () { return "Faz com seis municípios a mesma conta que fará com 102. Cada etapa acrescenta uma coluna à tabela abaixo. No fim, lista todas as 720 ordens possíveis dos seis valores para ver quantas dão um I tão alto quanto o observado."; },
      conta: function (s) {
        var k = s.sub, m = TOY.m, mean = TOY.mean, head = "<tr><th>Município</th><th class=num>Taxa</th>" + (k >= 2 ? "<th class=num>z = taxa − média</th>" : "") + (k >= 3 ? "<th>Vizinhos</th><th class=num>Wz = média dos z dos vizinhos</th>" : "") + (k >= 4 ? "<th class=num>z · Wz</th>" : "") + "</tr>";
        var rows = TOY.x.map(function (v, i) { return "<tr><td>" + LET[i] + "</td><td class=num>" + v + "</td>" + (k >= 2 ? "<td class=num>" + f4(m.z[i]) + "</td>" : "") + (k >= 3 ? "<td>" + TOY.nb[i].map(function (j) { return LET[j]; }).join(", ") + "</td><td class=num>" + f4(m.wz[i]) + "</td>" : "") + (k >= 4 ? "<td class=num>" + f2(TOY.prod[i]) + "</td>" : "") + "</tr>"; }).join("");
        var txt = [
          "<span class=eq>Média = (95 + 92 + 90 + 80 + 72 + 70) ÷ 6 = 499 ÷ 6 = <b>" + f4(mean) + "</b></span>",
          "<span class=eq>z de A = 95 − " + f4(mean) + " = <b>" + f4(m.z[0]) + "</b> (os seis z somam zero)</span>",
          "<span class=eq>Wz de B (vizinhos A, C e D) = (" + f4(m.z[0]) + " + " + f4(m.z[2]) + " + (" + f4(m.z[3]) + ")) ÷ 3 = <b>" + f4(m.wz[1]) + "</b></span><span class=eq>Wz de A (só B) = <b>" + f4(m.z[1]) + "</b></span>",
          "<span class=eq>z · Wz de A = " + f4(m.z[0]) + " × " + f4(m.wz[0]) + " = <b>" + f2(TOY.prod[0]) + "</b>. Soma dos seis produtos: <b>" + f2(m.num) + "</b></span>",
          "<span class=eq>Σ z² = <b>" + f2(m.den) + "</b></span><span class=eq>I = (n ÷ S0) × Σ z·Wz ÷ Σ z² = (6 ÷ 6) × " + f2(m.num) + " ÷ " + f2(m.den) + " = <b>" + f4(m.I) + "</b></span><span class=eq>Esperado ao acaso: E[I] = −1 ÷ (6 − 1) = <b>" + f2(m.EI) + "</b></span>",
          "<span class=eq>Ordens possíveis dos seis valores: 6! = <b>" + TOY.ex.total + "</b>. Com I maior ou igual a " + f4(m.I) + ": <b>" + TOY.ex.count + "</b> (a ordem real é uma delas)</span><span class=eq>p exato = " + TOY.ex.count + " ÷ " + TOY.ex.total + " = <b>" + f4(TOY.ex.p) + "</b></span>"
        ][k - 1];
        return txt + "<div class=tbl-wrap><table>" + head + rows + "</table></div><p class=cap>Valores arredondados na tela; o cálculo usa todas as casas.</p>";
      },
      tech: function () { return "<p>Etapas: (1) média; (2) desvios z<sub>i</sub> = x<sub>i</sub> − x̄; (3) defasagem espacial (Wz)<sub>i</sub> = Σ<sub>j</sub> w<sub>ij</sub> z<sub>j</sub>, com W padronizada por linha; (4) produtos z<sub>i</sub>(Wz)<sub>i</sub>; (5) I = (n/S0) · Σ z<sub>i</sub>(Wz)<sub>i</sub> / Σ z<sub>i</sub>². Aqui S0 = 6, a soma dos pesos (cada uma das seis linhas soma 1), então n/S0 = 1 e I é a inclinação da reta de Wz sobre z. Na etapa 6, o teste é exato: com apenas seis valores é possível percorrer todas as 6! = 720 ordens e contar quantas dão I ≥ I observado, sem sorteio. Com 102 municípios isso é impossível (102! ordens), e se recorre ao sorteio de embaralhamentos (passo 4). O gráfico mostra o I de cada uma das 720 ordens; na prática, ordens diferentes podem repetir o mesmo I.</p>"; },
      q: "Por que fazer a conta com só seis municípios?", a: "Porque dá para conferir cada número à mão. A conta com 102 municípios é a mesma, só que repetida mais vezes.",
      viz: function (stage, ctl, state) {
        var k = state.sub, m = TOY.m, w = Math.max(280, Math.min(420, C.width(stage))), h = 130, sx = w / 400;
        var P = [[34, 70], [110, 70], [184, 30], [184, 110], [258, 110], [334, 110]];
        var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Seis municípios fictícios, A a F, ligados por vizinhança" }, stage);
        TOY.nb.forEach(function (l, i) { l.forEach(function (j) { if (j > i) el("line", { x1: P[i][0] * sx, y1: P[i][1], x2: P[j][0] * sx, y2: P[j][1], stroke: "var(--text)", "stroke-width": 2, opacity: .6 }, svg); }); });
        P.forEach(function (p, i) {
          el("circle", { cx: p[0] * sx, cy: p[1], r: 17, "class": k >= 2 ? (m.z[i] >= 0 ? "qd0" : "qd2") : "", fill: k >= 2 ? "" : "var(--panel2)", stroke: "var(--text)", "stroke-width": 1.5 }, svg);
          el("text", { x: p[0] * sx, y: p[1] + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: k >= 2 ? "#fff" : "currentColor" }, svg, LET[i]);
          el("text", { x: p[0] * sx, y: p[1] + (i === 2 ? -23 : 35), "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, k >= 2 ? "z = " + f2(m.z[i]) : String(TOY.x[i]));
        });
        if (k >= 6) {
          var lo = Math.floor(Math.min.apply(null, TOY.all) * 10) / 10 - 0.1, hi = 1.0, mx = 0, cnt = {};
          var hh = nullHist(stage, { lo: lo, hi: hi, obs: m.I, EI: m.EI, upper: true, ymax: 130, label: "Distribuição do I de Moran nas 720 ordens possíveis dos seis valores", xlabel: "I de Moran de cada ordem possível" });
          TOY.all.forEach(function (v) { hh.add(v); });
          cap(stage, "Cada uma das 720 ordens dos seis valores dá um I. Em vermelho, as que chegam ao I observado ou passam dele.");
        } else cap(stage, k >= 2 ? "Vermelho: município acima da média (z positivo). Azul: abaixo da média (z negativo)." : "Os seis municípios fictícios e quem é vizinho de quem. Abaixo de cada um, a taxa.");
        aviso(stage);
      } },

    { t: "A mesma conta nos 102 municípios",
      kid: "Agora a mesma conta com Alagoas inteira. O computador percorre um município por vez e calcula quanto ele contribui: o desvio dele vezes a média dos desvios dos vizinhos. Município e vizinhos do mesmo lado da média puxam o I para cima (azul). De lados opostos, puxam para baixo (rosa).",
      pc: function () { return "Para cada município: tira a média, calcula a média dos vizinhos, multiplica as duas coisas e soma ao total. No fim, divide pela soma dos quadrados dos desvios. É o mesmo roteiro do exemplo A–F."; },
      conta: function (s) {
        var v = s.v, m = MI(v, "queen"), n = m.n;
        return "<span class=eq>Variável: <b>" + VAR[v].nome + "</b>; vizinhança: rainha</span><span class=eq>n = " + n + "; S0 = " + f1(m.S0) + " (cada linha de W soma 1, sem municípios isolados)</span><span class=eq>Σ z · Wz = <b>" + f2(m.num) + "</b>; Σ z² = <b>" + f2(m.den) + "</b></span><span class=eq>I = (" + n + " ÷ " + f1(m.S0) + ") × " + f2(m.num) + " ÷ " + f2(m.den) + " = <b>" + f4(m.I) + "</b></span><span class=eq>E[I] = −1 ÷ (" + n + " − 1) = <b>" + f4(m.EI) + "</b></span>" +
          "<p>O I observado é " + (m.I > m.EI ? "maior" : "menor") + " que o esperado ao acaso. Falta saber se a diferença é grande para o acaso: é o teste do próximo passo.</p>";
      },
      tech: function () { return "<p>Mesmo cálculo do exemplo A–F, agora com a matriz W de contiguidade rainha (padronizada por linha) dos 102 municípios, calculada no navegador a partir da malha do IBGE. Como não há ilhas, S0 = n = 102 e I coincide com a inclinação da reta de Wz sobre z. A soma Σ z<sub>i</sub>(Wz)<sub>i</sub> é percorrida na ordem do código IBGE e a animação mostra o I parcial, isto é, (n/S0) · soma parcial / Σ z². O valor final não depende da ordem. Sinal de cada termo: positivo quando z e Wz têm o mesmo sinal.</p>"; },
      q: "Por que o E[I] não é zero?", a: "Porque o I de Moran, calculado com os desvios da própria média dos dados, tem valor médio um pouco abaixo de zero quando os valores estão espalhados ao acaso: −1/(n − 1). Com 102 municípios, é perto de −0,01.",
      viz: function (stage, ctl, state) {
        var v = state.v, x = VAR[v].x, m = MI(v, "queen"), inf = info(stage), mp = mapa(stage, { w: stage.clientWidth, cls: function () { return "qe"; }, label: "Mapa da contribuição de cada município ao I de Moran, preenchido município a município", titles: function (i) { return "z · Wz = " + f2(m.z[i] * m.wz[i]); } });
        var k = 0, acc = 0, fac = m.n / m.S0 / m.den;
        function one() {
          var i = k, pr = m.z[i] * m.wz[i]; acc += pr; k++; setCls(mp, i, pr >= 0 ? "cp" : "cn");
          inf.textContent = "Município " + k + " de " + N + ": " + NAMES[i] + ". z = " + f2(m.z[i]) + "; Wz = " + f2(m.wz[i]) + "; z · Wz = " + f2(pr) + ". Soma parcial = " + f2(acc) + "; I parcial = " + f3(acc * fac) + ".";
          if (k >= N) inf.textContent = "Pronto: soma = " + f2(acc) + "; I = " + f3(acc * fac) + " (E[I] = " + f3(m.EI) + ").";
        }
        if (clock.reduced) { while (k < N) one(); } else clock.rateTask(8, one, function () { return k >= N; });
        stage.appendChild(legend([["sq swcp", "z e vizinhos do mesmo lado da média"], ["sq swcn", "de lados opostos"], ["sq swe", "ainda não calculado"]])); aviso(stage);
        cap(stage, "Cada município pinta-se de azul ou rosa conforme puxe o I para cima ou para baixo. O I é a soma de todos esses puxões, dividida pela soma dos quadrados dos desvios.");
      } },

    { t: "Teste por embaralhamento",
      kid: "Para saber se o I é grande para o acaso, fazemos de conta que os valores não têm relação com o lugar: embaralhamos os 102 valores entre os municípios, como cartas, e calculamos o I de novo. Cada embaralhamento vira um ponto no gráfico. Se quase nenhum chega ao I verdadeiro, o padrão é difícil de explicar só pelo acaso.",
      pc: function () { return "Embaralha os valores entre os municípios (com semente fixa, para dar sempre o mesmo resultado), calcula o I de cada embaralhamento e conta quantos igualam ou passam do I observado. Esse número é R. O pseudo-p é (R + 1) ÷ (M + 1), em que M é o número de embaralhamentos."; },
      conta: function (s) {
        var v = s.v, M = s.M, pt = PT(v, "queen", M), mean = 0; pt.sims.forEach(function (a) { mean += a; }); mean /= M;
        var sd = Math.sqrt(pt.sims.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (M - 1));
        return "<span class=eq>Variável: <b>" + VAR[v].nome + "</b>; vizinhança: rainha; semente <b>" + SEED + "</b></span><span class=eq>I observado = <b>" + f3(pt.I) + "</b>; E[I] = " + f3(pt.EI) + "</span><span class=eq>M = <b>" + M + "</b> embaralhamentos; média dos I embaralhados = " + f3(mean) + "; desvio padrão = " + f3(sd) + "</span><span class=eq>R = embaralhamentos com I " + (pt.upper ? "≥" : "≤") + " " + f3(pt.I) + ": <b>" + pt.R + "</b></span><span class=eq>pseudo-p = " + pform(pt.R, M) + (pt.R === 0 ? "" : "") + "</span>" +
          (pt.R === 0 ? "<p>Nenhum embaralhamento chegou ao I observado. O pseudo-p nunca é zero: o menor valor que este teste pode dar é 1 ÷ (M + 1). Por isso se escreve <b>p menor que " + fp(1 / (M + 1), M) + "</b>, e não p = 0.</p>" : "<p>O teste é unilateral, no lado em que caiu o I observado.</p>") +
          "<p>No exemplo A–F, onde era possível listar todas as 720 ordens, o p exato foi " + f4(TOY.ex.p) + ". Aqui são 102 valores (impossível listar tudo), então se sorteia.</p>";
      },
      tech: function () { return "<p>Teste de permutação (Monte Carlo): sob a hipótese nula de que os valores são trocáveis entre os municípios, cada embaralhamento (Fisher-Yates com semente fixa, gerador mulberry32) é uma configuração igualmente provável. Com R réplicas tão ou mais extremas que o I observado, no lado do observado em relação a E[I], o pseudo-p é (R + 1)/(M + 1), contando o próprio observado como uma das M + 1 configurações. Por isso o p nunca é zero: seu mínimo é 1/(M + 1), e com R = 0 escreve-se “menor que 1/(M + 1)”. M = 99, 999 ou 9999 muda a resolução do teste (0,01; 0,001; 0,0001). Com a mesma semente, as primeiras 99 réplicas são as mesmas das 999. O teste é global e embaralha todos os valores; o teste local (LISA) usa outro esquema, a permutação condicional. Hipótese de trocabilidade: municípios pequenos têm taxas mais variáveis, e o embaralhamento os trata como equivalentes aos demais.</p>"; },
      q: "Por que 999 embaralhamentos e não 1.000?", a: "Porque o observado entra na conta como mais uma configuração: com M = 999, são 1.000 no total, e o menor p possível é 1/1.000 = 0,001. É uma convenção que deixa os valores de p redondos.",
      viz: function (stage, ctl, state, root) {
        var v = state.v, x = VAR[v].x, M = state.M, pt = PT(v, "queen", M), mean = S.mean(x);
        var lo = Math.floor((Math.min(pt.I, pt.EI, Math.min.apply(null, pt.sims)) - 0.04) * 20) / 20, hi = Math.ceil((Math.max(pt.I, Math.max.apply(null, pt.sims)) + 0.04) * 20) / 20;
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        b.innerHTML = "<p class=cap>Embaralhamento atual (acima ou abaixo da média)</p>";
        var hist = nullHist(a, { lo: lo, hi: hi, obs: pt.I, EI: pt.EI, upper: pt.upper, ymax: Math.max(5, Math.round(M / 8)), label: "Histograma do I de Moran nos embaralhamentos", xlabel: "I de Moran de cada embaralhamento" });
        var cur = x.map(function () { return "q0"; }), mp = mapa(b, { w: b.clientWidth, cls: function (i) { return two(x, mean)(i); }, label: "Mapa com os valores embaralhados entre os municípios" });
        mp.paths.forEach(function (p, i) { cur[i] = p.getAttribute("class"); });
        var inf = info(stage), rnd = S.rng(SEED), vv = x.slice(), r = 0, R = 0, rate = M <= 99 ? 4 : M <= 999 ? 40 : 400;
        function done() { return r >= M; }
        function one() {
          S.shuffle(vv, rnd); var I = pt.sims[r]; r++; if (pt.upper ? I >= pt.I : I <= pt.I) R++; hist.add(I);
          for (var i = 0; i < N; i++) { var c = vv[i] >= mean ? "q3" : "q0"; if (c !== cur[i]) { cur[i] = c; mp.paths[i].setAttribute("class", c); } }
          inf.textContent = "Embaralhamento " + r + " de " + M + ": I = " + f3(I) + ". Até agora, R = " + R + " com I " + (pt.upper ? "≥" : "≤") + " " + f3(pt.I) + ".";
          if (done()) {
            if (R !== pt.R || Math.abs(S.moranI(vv, WS.queen).I - pt.sims[M - 1]) > 1e-12) console.error("Inconsistência no teste de permutação");
            inf.textContent = "Pronto: M = " + M + ", R = " + R + ", pseudo-p = " + pform(R, M) + (R === 0 ? " (p menor que " + fp(1 / (M + 1), M) + ", nunca zero)." : ".");
          }
        }
        if (clock.reduced) { while (!done()) one(); } else clock.rateTask(rate, one, done);
        stage.appendChild(legend([["sq sw3", "I de cada embaralhamento"], ["sq sws", "chegou ao I observado ou passou"], ["k-null", "E[I]"]])); aviso(stage);
        cap(stage, "Semente fixa " + SEED + ": rodar de novo dá o mesmo resultado. Use os controles da animação para pausar, acelerar ou reiniciar.");
      } },

    { t: "A vizinhança muda o resultado?",
      kid: "O I depende de quem se chama de vizinho. Repetimos o cálculo com três definições: rainha (basta tocar num ponto), torre (precisa dividir um pedaço de divisa) e os 5 municípios mais próximos. Se as três contam a mesma história, o resultado é mais confiável.",
      pc: function () { return "Refaz a conta e o teste de embaralhamento (mesma semente, 999 embaralhamentos) para cada definição de vizinhança e coloca os resultados lado a lado. A faixa cinza mostra onde caem 95% dos I dos embaralhamentos."; },
      conta: function (s) {
        var v = s.v, rows = ["queen", "rook", "knn5"].map(function (k) { var m = MI(v, k), p = PT(v, k, 999); return "<tr><td>" + KSHORT[k] + "</td><td class=num>" + f2(NB[k].meanDeg) + "</td><td class=num>" + f3(m.I) + "</td><td class=num>" + p.R + "</td><td>" + (p.R === 0 ? "< " + fp(1 / 1000, 999) : fp(p.p, 999)) + "</td></tr>"; }).join("");
        return "<span class=eq>Variável: <b>" + VAR[s.v].nome + "</b>; E[I] = " + f3(MI(v, "queen").EI) + "; M = 999; semente " + SEED + "</span><div class=tbl-wrap><table><tr><th>Vizinhança</th><th class=num>Média de vizinhos</th><th class=num>I</th><th class=num>R</th><th>pseudo-p</th></tr>" + rows + "</table></div>";
      },
      tech: function () { return "<p>Rainha: contiguidade por vértice ou aresta; torre: por aresta; 5 mais próximos: os cinco centroides mais próximos de cada município (relação não simétrica: A pode ser um dos cinco de B sem que B seja um dos cinco de A). Todas padronizadas por linha, S0 = n = 102 (nenhuma ilha). O I e o pseudo-p mudam porque W muda; a mesma semente e o mesmo M tornam as linhas comparáveis. A faixa cinza vai dos percentis 2,5 e 97,5 dos I embaralhados. A escolha da matriz W para o projeto ainda será definida; mostrar essa sensibilidade faz parte do método.</p>"; },
      q: "Qual vizinhança usar?", a: "Não há uma certa em si. O que se faz é mostrar que a conclusão aguenta a mudança. A escolha do projeto ainda será definida.",
      viz: function (stage, ctl, state) {
        var v = state.v, ks = ["queen", "rook", "knn5"], rows = ks.map(function (k) { var m = MI(v, k), p = PT(v, k, 999), b = band(p); return { t: KSHORT[k], I: m.I, lo: b[0], hi: b[1], txt: "I " + f2(m.I) + "; p " + (p.R === 0 ? "< " + fp(1 / 1000, 999) : fp(p.p, 999)) }; });
        rowsFig(stage, rows, MI(v, "queen").EI, "I de Moran e pseudo-p com três definições de vizinhança");
        stage.appendChild(legend([["sq swobs", "I observado"], ["sq swband", "95% dos embaralhamentos"], ["k-null", "E[I]"]])); aviso(stage);
        cap(stage, "Ponto vermelho: I observado. Faixa cinza: onde caem 95% dos I de 999 embaralhamentos. Ponto longe da faixa: raro ao acaso.");
      } },

    { t: "Como ler, e o que o I global não diz",
      kid: "Um I acima do esperado e um p pequeno dizem que vizinhos tendem a se parecer mais do que o acaso explicaria. Um p grande diz que não há evidência de padrão. Mas o I é um número único para o estado inteiro: ele não diz onde estão os municípios que formam o padrão. Para isso existe o Moran local, o próximo método.",
      pc: function () { return "Compara três variáveis fictícias lado a lado e mostra de onde vem o I: cada município contribui com um pedaço (seu desvio vezes a média dos vizinhos). A soma dos pedaços é o I. O I global só diz o total, não quais municípios mais contribuem."; },
      conta: function (s) {
        var v = s.v, m = MI(v, "queen"), p = PT(v, "queen", 999), pos = 0, num = 0, neg = 0;
        m.z.forEach(function (z, i) { var c = z * m.wz[i]; if (c >= 0) { pos++; num += c; } else neg++; });
        var lei = p.R === 0 || p.p < 0.05 ? (m.I > m.EI ? "valores de municípios vizinhos se parecem mais do que o acaso explicaria" : "valores de municípios vizinhos diferem mais do que o acaso explicaria") : "o I observado é comum entre os embaralhamentos; não há evidência de padrão espacial global";
        return "<span class=eq>" + VAR[v].curto + " (rainha, M = 999): I = <b>" + f3(m.I) + "</b>; E[I] = " + f3(m.EI) + "; pseudo-p " + ptxt(p.R, 999) + "</span><p>Leitura: " + lei + ".</p><span class=eq>Municípios que puxam o I para cima: <b>" + pos + "</b>; para baixo: <b>" + neg + "</b></span>" +
          "<p><b>O que o I global não diz:</b> onde estão os municípios que formam o padrão nem se algum município destoa dos vizinhos. Também não diz a causa. Mapas diferentes podem ter o mesmo I, porque ele é um só número.</p>";
      },
      tech: function () { return "<p>Leitura: compara-se I com E[I] = −1/(n−1); a significância vem do pseudo-p por permutação, e deve-se informar o número de embaralhamentos e a semente. O I global é uma média ponderada das contribuições de todos os municípios e não localiza nada; a decomposição por município é o ponto de partida do Moran local (Anselin, 1995), que exige teste próprio por município, com permutação condicional e correção para comparações múltiplas. Os dados deste simulador são fictícios: a leitura acima serve só para treinar a interpretação.</p>"; },
      q: "I de Moran alto prova que há um problema onde o valor é baixo?", a: "Não. O I global diz que há padrão no conjunto, não onde ele está, nem por quê. Localizar é tarefa do Moran local e da varredura espacial; a causa exige outras análises e cuidado, pois os dados são de municípios, não de pessoas.",
      viz: function (stage, ctl, state) {
        var v = state.v, m = MI(v, "queen"), grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>As três variáveis fictícias (rainha, 999 embaralhamentos)</p>"; b.innerHTML = "<p class=cap>Contribuição de cada município ao I</p>";
        var rows = ["cob", "aband", "ruido"].map(function (vk) { var mm = MI(vk, "queen"), p = PT(vk, "queen", 999), bb = band(p); return { t: VAR[vk].curto, I: mm.I, lo: bb[0], hi: bb[1], txt: "I " + f2(mm.I) + "; p " + (p.R === 0 ? "< " + fp(1 / 1000, 999) : fp(p.p, 999)) }; });
        rowsFig(a, rows, m.EI, "I de Moran de três variáveis fictícias");
        mapa(b, { w: b.clientWidth, cls: function (i) { return m.z[i] * m.wz[i] >= 0 ? "cp" : "cn"; }, label: "Mapa do sinal da contribuição de cada município ao I de Moran", titles: function (i) { return "z · Wz = " + f2(m.z[i] * m.wz[i]); } });
        stage.appendChild(legend([["sq swcp", "puxa o I para cima"], ["sq swcn", "puxa o I para baixo"]])); aviso(stage);
        cap(stage, "À esquerda, o I global resume cada variável em um ponto. À direita, o mapa mostra que ele é a soma de contribuições espalhadas. Ainda não há teste por município: isso é o Moran local.");
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
  function renderPassos(root, app, state) {
    state.v = state.v || "cob"; state.M = state.M || 999; state.sub = state.sub || 1;
    var N_ = STEPS.length, idx = Math.max(0, Math.min(N_ - 1, (state.step || 1) - 1)), st = STEPS[idx];
    clock.clear(); root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "opts"; root.appendChild(ds);
    function redraw() { renderPassos(root, app, state); app.remount && app.remount(); }
    if (idx !== 1) ds.appendChild(chips("Variável", [["cob", "cobertura"], ["aband", "abandono"], ["ruido", "sem padrão"]], state.v, function (v) { state.v = v; redraw(); }));
    if (idx === 1) ds.appendChild(chips("Etapa", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]], state.sub, function (v) { state.sub = v; redraw(); }));
    if (idx === 3) ds.appendChild(chips("Embaralhamentos", [[99, "99"], [999, "999"], [9999, "9999"]], state.M, function (v) { state.M = v; redraw(); }));
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
    return "<div class=card><h2>Qual pergunta este método responde?</h2><p>Existe padrão espacial no conjunto dos 102 municípios de Alagoas? Em outras palavras, municípios vizinhos têm valores de cobertura vacinal (ou de abandono) mais parecidos entre si do que teriam se os valores estivessem espalhados ao acaso?</p>" +
      "<p>O I de Moran global (Moran, 1950) resume essa ideia num único número e, com um teste por embaralhamento, diz quão raro seria esse número ao acaso. É o passo seguinte à análise exploratória (AEDE) e antecede o Moran local (LISA, Anselin, 1995), que procura onde estão os agrupamentos. Há estudos de análise espacial da cobertura vacinal no Nordeste e na Paraíba (Cunha e colaboradores, 2022 e 2023).</p></div>" +
      "<div class='callout alert'><b>Atenção</b>Os valores deste simulador são fictícios e sorteados, sem relação com os municípios reais. Só o desenho dos municípios (malha do IBGE) e as relações de vizinhança são reais.</div><p>A simulação está no topo desta página. As perguntas frequentes ficam no final.</p>";
  }
  function tabDados() {
    var rows = G.map(function (f, i) { return "<tr><td>" + NAMES[i] + "</td><td class=num>" + f1(D.cob[i]) + "</td><td class=num>" + f1(D.aband[i]) + "</td><td class=num>" + f1(D.ruido[i]) + "</td></tr>"; }).join("");
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Variável</th><th>Papel</th><th>Unidade</th><th>Origem aqui</th></tr><tr><td>Malha municipal</td><td>geometria e vizinhança</td><td>102 polígonos</td><td>IBGE, 2025 (real)</td></tr><tr><td>Cobertura vacinal</td><td>variável analisada</td><td>%</td><td>sorteada, semente fixa, com padrão espacial inventado</td></tr><tr><td>Taxa de abandono</td><td>variável analisada</td><td>%</td><td>sorteada, semente fixa, ligada à cobertura</td></tr><tr><td>Índice sem padrão</td><td>caso de contraste</td><td>sem unidade</td><td>sorteio independente por município, sem padrão espacial</td></tr></table></div>" +
      "<p>As duas primeiras foram inventadas com padrão espacial, para a demonstração; a terceira existe para mostrar como é um resultado sem padrão. Valores sorteados, sem relação com os municípios reais. O gerador está em <code>tests/gen_spatial_data.js</code>.</p></div>" +
      "<details class=tech><summary>Tabela dos 102 municípios (valores fictícios)</summary><div class=scroll-box><table><tr><th>Município</th><th class=num>Cobertura (%)</th><th class=num>Abandono (%)</th><th class=num>Índice sem padrão</th></tr>" + rows + "</table></div></details>";
  }
  function tabResultado() {
    var rows = ["cob", "aband", "ruido"].map(function (v) { var m = MI(v, "queen"), p = PT(v, "queen", 999); return "<tr><td>" + VAR[v].curto + "</td><td class=num>" + f3(m.I) + "</td><td class=num>" + f3(m.EI) + "</td><td class=num>" + p.R + "</td><td>" + (p.R === 0 ? "< " + fp(1 / 1000, 999) : fp(p.p, 999)) + "</td></tr>"; }).join("");
    var sens = ["queen", "rook", "knn5"].map(function (k) { var m = MI("cob", k), p = PT("cob", k, 999); return KSHORT[k] + ": I = " + f3(m.I) + ", p " + ptxt(p.R, 999); }).join("; ");
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Um I de Moran, o valor esperado ao acaso, o número de embaralhamentos que igualaram ou passaram do observado (R) e o pseudo-p. O I mostra a direção e a força do padrão; o p, quão raro ele seria ao acaso.</p><ul><li><b>Pode concluir:</b> se há padrão espacial global na variável, na direção do sinal do I, e se a conclusão resiste à mudança de vizinhança.</li><li><b>Não pode concluir:</b> onde está o padrão, quantos agrupamentos existem, qual município destoa nem a causa.</li></ul></div>" +
      "<div class=card><h3>Exemplo fictício (rainha, 999 embaralhamentos, semente " + SEED + ")</h3><div class=tbl-wrap><table><tr><th>Variável</th><th class=num>I</th><th class=num>E[I]</th><th class=num>R</th><th>pseudo-p</th></tr>" + rows + "</table></div><p>Cobertura em três vizinhanças: " + sens + ". Exemplo A–F: I = " + f4(TOY.m.I) + "; E[I] = " + f2(TOY.m.EI) + "; p exato = " + TOY.ex.count + "/" + TOY.ex.total + " = " + f4(TOY.ex.p) + ".</p></div>";
  }
  function tabLimites() {
    var Ls = ["Os valores do simulador são fictícios; só a geometria e a vizinhança são reais.", "O I global resume tudo em um número: não localiza agrupamentos nem pontos fora da curva.", "O resultado depende da definição de vizinhança e da padronização de W; por isso se mostra a sensibilidade.", "O pseudo-p depende do número de embaralhamentos e da semente; o valor mínimo possível é 1/(M + 1) e nunca é zero.", "O embaralhamento supõe que os valores são trocáveis entre municípios; taxas de municípios com denominador pequeno são mais instáveis e podem distorcer a leitura.", "A análise é ecológica: descreve municípios, não crianças. O padrão não prova causa.", "A divisão territorial usada (limites municipais) influencia o resultado."];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + Ls.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var D1 = ["Escopo: 102 municípios de Alagoas, com cobertura vacinal e taxa de abandono.", "Cobertura sem teto na base, com bandeiras para acima de 100%, 110% e 120% e abaixo de 50%; o teto de 100% só vale em mapas e médias, com o valor bruto na legenda.", "Denominador abaixo de 1.000 como bandeira; análise principal com o valor bruto e sensibilidade.", "Dispensa de submissão ao CEP mantida por ora."];
    var P = ["Matriz W: rainha, torre, k vizinhos mais próximos ou banda de distância, e como tratar municípios isolados.", "Padronização de W (por linha ou outra).", "Número de embaralhamentos (99, 999, 9999) e semente.", "Taxas brutas ou suavizadas (por exemplo, Bayes empírico) na análise principal.", "Como apresentar o p quando nenhum embaralhamento atinge o observado (p menor que 1/(M + 1))."];
    return "<div class=card><h2>O que o projeto definiu</h2><ul>" + D1.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>Escolhas que o projeto ainda vai definir</h2><p class=cap>Estas escolhas afetam o resultado e estão em aberto; aqui aparecem as alternativas, sem decisão.</p><ul>" + P.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabFontes() { var r = (NS.refs && NS.refs.moran) || []; return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>"; }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>Entradas: um arquivo de geometria dos municípios (por exemplo, a malha do IBGE) e uma tabela com a variável de interesse por município. Os nomes são exemplos.</p>" +
      "<p>Existem pacotes de análise espacial em Python e em R que calculam a matriz de vizinhança, o I de Moran e o teste por permutação. <b>Confira a documentação do pacote e da versão que for usar</b>: nomes de funções, opções e colunas de resultado mudam entre versões. Os números não serão idênticos aos deste simulador, porque o sorteio da permutação pode ser diferente.</p>" +
      "<h3>A lógica, em pseudocódigo próprio</h3><pre>vizinhos de i = municípios que tocam o município i (rainha)\nW = pesos iguais entre os vizinhos de i, somando 1 por linha\nz[i] = valor[i] − média dos valores\nWz[i] = média de z entre os vizinhos de i\nI = (n / soma dos pesos) × soma de z[i] × Wz[i] / soma de z[i]²\nE[I] = −1 / (n − 1)\n\npara cada rodada de 1 a M:\n  embaralhe os valores entre os municípios (semente fixa)\n  recalcule I\nR = nº de rodadas com I igual ou mais extremo que o observado (do lado de I em relação a E[I])\npseudo-p = (R + 1) / (M + 1)</pre>" +
      "<p>Fixe a semente do gerador aleatório antes do teste, para repetir o resultado (o nome do comando depende da linguagem e do pacote: consulte a documentação).</p>" +
      "<h3>Conferência neste repositório</h3><p>O arquivo <code>tests/check_moran.py</code> refaz em Python (shapely e numpy) a vizinhança, o I de Moran, o E[I], a permutação com a mesma semente, o teste exato das 720 ordens do exemplo A–F e uma verificação estatística tolerante com sorteios independentes.</p><pre>node tests/dump_moran.js &gt; moran_js.json\npython3 tests/check_moran.py moran_js.json</pre></div>";
  }
  function tabFaq() { return "<div class=card>" + STEPS.map(function (x) { return "<h3>" + x.q + "</h3><p>" + x.a + "</p>"; }).join("") + "<h3>O que é “semente fixa”?</h3><p>É o ponto de partida do sorteio dos embaralhamentos. Com a mesma semente, o sorteio sai igual toda vez, e por isso o resultado pode ser conferido e repetido.</p><h3>E se o valor de p der exatamente 0,05?</h3><p>O p é uma medida de quão raro seria o resultado ao acaso, não uma linha que separa certo de errado. O projeto ainda vai definir como relatar e interpretar o p.</p><h3>Por que aparecem nomes de municípios reais?</h3><p>Para o mapa ser reconhecível. Os valores, porém, são sorteados e não têm relação com os municípios reais; nada aqui descreve a cobertura de um município.</p></div>"; }

  NS.methods.moran = {
    id: "moran", n: 4, nome: "I de Moran Global", ready: true, steps: STEPS.length, count: function () { return STEPS.length; },
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
    }
  };
})();
