/* Método 3: AEDE (análise exploratória de dados espaciais). Núcleo numérico em js/spatial_core.js.
   Geometria real dos 102 municípios de Alagoas (IBGE 2025); VALORES 100% fictícios (js/spatial_data.js), sem relação com os municípios reais. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var S = NS.spatial, C = NS.charts, clock = NS.clock, fmt = C.fmt, el = C.el;
  var G = NS.geo.features, D = NS.spatial_data, X = D.cob, N = G.length, SEED = 2026, NPERM = 999;
  var NAMES = G.map(function (f) { return f.properties.n; });
  var NBQ = S.neighbors(G, "queen"), NBR = S.neighbors(G, "rook"), NBK = S.knn(G, 5);
  var WQ = S.rowStd(NBQ), WR = S.rowStd(NBR), WK = S.rowStd(NBK);
  var MQ = S.moranI(X, WQ), MR = S.moranI(X, WR), MK = S.moranI(X, WK), PQ = S.permTest(X, WQ, NPERM, SEED);
  var ZS = S.zscore(X), WZS = S.lag(ZS, WQ), QUAD = ZS.map(function (z, i) { return S.quadrant(z, WZS[i]); });
  var MEAN = S.mean(X), PEQ = D.nasc.map(function (v) { return v < 1000; });
  var SEL0 = G.findIndex(function (f) { return f.properties.c === "2700300"; });
  /* Exemplo mínimo A–F (taxas 95, 92, 90, 80, 72, 70; vizinhos A–B, B–C, B–D, C–D, D–E, E–F). */
  var TOY = { x: [95, 92, 90, 80, 72, 70], nb: [[1], [0, 2, 3], [1, 3], [1, 2, 4], [3, 5], [4]] };
  TOY.W = S.rowStd(TOY.nb); TOY.m = S.moranI(TOY.x, TOY.W);

  function f1(x) { return fmt(x, 1); } function f2(x) { return fmt(x, 2); } function f3(x) { return fmt(x, 3); } function f4(x) { return fmt(x, 4); }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function aviso(stage) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = "Valores sorteados, sem relação com os municípios reais. Só o desenho dos municípios e as vizinhanças são reais."; stage.appendChild(p); }
  function legend(items) { var d = document.createElement("div"); d.className = "legend"; d.innerHTML = items.map(function (i) { return "<span><i class='sq " + i[0] + "'></i>" + i[1] + "</span>"; }).join(""); return d; }
  function info(stage) { var p = document.createElement("p"); p.className = "sum"; p.setAttribute("aria-live", "polite"); p.style.margin = "4px 6px"; stage.appendChild(p); return p; }
  function L(l) { return l.map(function (i) { return NAMES[i]; }).join(", "); }

  /* Mapa SVG a partir da malha real: implementação compartilhada em NS.charts.mapa (js/charts.js). */
  function mapa(parent, o) { o.dots = o.dots ? PEQ : null; return C.mapa(parent, o); }
  function setCls(m, i, c, extra) { m.paths[i].setAttribute("class", c + (extra || "")); }
  var PALMAP = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
  function qcls(x, br) { return "q" + PALMAP[br.length + 1][S.classOf(x, br)]; }

  /* ---------- seletor de município (compartilhado) ---------- */
  function seletor(root, state, onChange) {
    var g = document.createElement("span"); g.className = "grp";
    var lb = document.createElement("label"); lb.textContent = "Município:"; lb.style.marginRight = "4px"; lb.setAttribute("for", "sel-mun"); g.appendChild(lb);
    var s = document.createElement("select"); s.id = "sel-mun";
    NAMES.map(function (n, i) { return [n, i]; }).sort(function (a, b) { return a[0].localeCompare(b[0], "pt-BR"); }).forEach(function (e) { var o = document.createElement("option"); o.value = e[1]; o.textContent = e[0]; if (e[1] === state.sel) o.selected = true; s.appendChild(o); });
    s.addEventListener("change", function () { state.sel = +s.value; onChange(); });
    g.appendChild(s); return g;
  }

  /* ---------- passos ---------- */
  var STEPS = [
    { t: "Por que olhar o espaço antes de modelar",
      kid: "Imagine pintar o mapa de Alagoas com tinta azul-escura onde a cobertura é alta e clara onde é baixa. Se as manchas escuras ficam juntas, a vizinhança importa. Se parece confete jogado ao acaso, não importa. A análise espacial começa olhando isso.",
      pc: function () { return "Pega os mesmos 102 números e pinta o mapa de duas formas: com cada valor no seu município e com os valores embaralhados entre municípios. A média e o histograma são idênticos nas duas. Só o lugar muda."; },
      conta: function (s) { var sh = s.shuf; return "<span class=eq>Média da cobertura (fictícia): <b>" + f1(MEAN) + "%</b> nos dois mapas</span><span class=eq>Mapa à esquerda (valores nos seus lugares): I de Moran = <b>" + f2(MQ.I) + "</b></span><span class=eq>Mapa à direita (valores embaralhados): I de Moran = <b>" + f2(sh.I) + "</b></span><p>O I de Moran é um número que resume se municípios vizinhos têm valores parecidos. Perto de zero: sem padrão. Positivo: parecidos. Ele é explicado nos próximos passos.</p>"; },
      tech: function () { return "<p>A maior parte dos modelos usuais supõe observações independentes. Em dados de áreas contíguas, a dependência espacial (autocorrelação) viola isso e precisa ser descrita antes da modelagem. Aqui, o sorteio da direita é uma permutação com semente fixa; o I de Moran dele deve ficar perto do valor esperado sob ausência de padrão, E[I] = −1/(n−1) = " + f3(MQ.EI) + ". Os mapas usam só duas cores (acima ou abaixo da média) para não antecipar as classes do passo 2.</p>"; },
      q: "Por que não ir direto ao modelo?", a: "Porque municípios vizinhos tendem a se parecer, e isso afeta o que os modelos podem supor. Olhar o espaço primeiro mostra se há padrão e onde, e orienta as escolhas seguintes.",
      viz: function (stage, ctl, state, root) {
        var box = document.createElement("div"); box.className = "dataset"; stage.appendChild(box);
        var btn = document.createElement("button"); btn.className = "btn btn-small"; btn.textContent = "Embaralhar de novo"; box.appendChild(btn);
        var grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        function cls(vals) { return function (i) { return vals[i] >= MEAN ? "q3" : "q0"; }; }
        a.innerHTML = "<p class=cap>Valores nos seus lugares</p>"; b.innerHTML = "<p class=cap>Mesmos valores, embaralhados</p>";
        mapa(a, { w: a.clientWidth, cls: cls(X), label: "Mapa de Alagoas com a cobertura fictícia acima ou abaixo da média", titles: function (i) { return f1(X[i]) + "%"; } });
        var mb = null;
        function draw() {
          var v = X.slice(); S.shuffle(v, S.rng(state.shufSeed)); state.shuf = { v: v, I: S.moranI(v, WQ).I };
          if (mb) b.removeChild(mb.svg);
          mb = mapa(b, { w: b.clientWidth, cls: cls(v), label: "Mapa de Alagoas com os mesmos valores embaralhados entre os municípios", titles: function (i) { return f1(v[i]) + "%"; } });
          var c = root.querySelector("[data-live=conta1]"); if (c) c.innerHTML = STEPS[0].conta(state);
        }
        btn.addEventListener("click", function () { state.shufSeed++; draw(); });
        draw();
        stage.appendChild(legend([["sw3", "acima da média"], ["sw0", "abaixo da média"]]));
        aviso(stage); cap(stage, "A média e o histograma são iguais nos dois mapas. Só o primeiro tem manchas de vizinhos parecidos.");
      } },

    { t: "Mapa da cobertura por quantis",
      kid: "Para ver o padrão, juntamos os municípios em grupos do mesmo tamanho: os 20% com menor cobertura numa cor, os 20% seguintes noutra, e assim até os 20% com maior cobertura. É um mapa em tons de azul.",
      pc: function () { return "Ordena os 102 valores, corta em grupos com o mesmo número de municípios (quantis) e pinta cada município com a cor do seu grupo."; },
      conta: function (s) {
        var k = s.k, br = S.quantileBreaks(X, k), cnt = new Array(k).fill(0), lo = new Array(k).fill(1e9), hi = new Array(k).fill(-1e9);
        X.forEach(function (v) { var c = S.classOf(v, br); cnt[c]++; lo[c] = Math.min(lo[c], v); hi[c] = Math.max(hi[c], v); });
        var rows = cnt.map(function (c, j) { return "<tr><td>" + (j + 1) + "</td><td class=num>" + f1(lo[j]) + " a " + f1(hi[j]) + "</td><td class=num>" + c + "</td></tr>"; }).join("");
        return "<span class=eq>Cortes em " + k + " grupos: " + br.map(f1).join("; ") + "</span><div class=tbl-wrap><table><tr><th>Grupo</th><th class=num>Cobertura (%)</th><th class=num>Municípios</th></tr>" + rows + "</table></div>";
      },
      tech: function () { return "<p>Mapa coroplético por quantis. Os pontos de corte usam interpolação linear entre os valores ordenados (mesmo padrão do numpy.quantile); um município entra na classe igual ao número de cortes menores que o seu valor. Quantis dão classes de mesmo tamanho, mas valores quase iguais podem cair em cores diferentes e valores muito distintos na mesma cor. Decisão do projeto: o teto de 100% vale só em mapas e médias, com o valor bruto na legenda; como o agrupamento depende só da ordem dos valores, o teto não altera as classes, exceto em empates no 100%. Os pontos pretos marcam municípios com denominador fictício menor que 1.000, cujas taxas são instáveis.</p>"; },
      q: "Por que quantis e não faixas fixas, como 0–50–95%?", a: "Quantis mostram a posição relativa de cada município e sempre usam todas as cores. Faixas fixas, como as do 95%, contam outra história (quem atingiu a meta). A escolha das classes dos mapas do projeto ainda será definida.",
      viz: function (stage, ctl, state, root) {
        var br = S.quantileBreaks(X, state.k), inf = info(stage), m = mapa(stage, { w: stage.clientWidth, cls: function (i) { return qcls(X[i], br); }, dots: state.dots, label: "Mapa de quantis da cobertura fictícia", titles: function (i) { return f1(X[i]) + "%"; }, onSel: show, onHover: show });
        function show(i) { state.sel = i; inf.textContent = NAMES[i] + ": cobertura fictícia de " + f1(X[i]) + "% (grupo " + (S.classOf(X[i], br) + 1) + " de " + state.k + "), " + D.nasc[i].toLocaleString("pt-BR") + " nascidos fictícios" + (PEQ[i] ? " (denominador pequeno)" : "") + "."; }
        show(state.sel);
        var items = [], pct = Math.round(100 / state.k); for (var j = 0; j < state.k; j++) items.push(["sw" + PALMAP[state.k][j], j === 0 ? "menores " + pct + "%" : j === state.k - 1 ? "maiores " + pct + "%" : "grupo " + (j + 1)]);
        stage.appendChild(legend(items)); aviso(stage);
        cap(stage, "Toque ou passe o mouse em um município. Pontos pretos: denominador pequeno. Os valores brutos acima de 100% aparecem na tabela; no mapa só a posição conta.");
      } },

    { t: "Quem é vizinho de quem",
      kid: "Dois municípios são vizinhos se se encostam no mapa. Pelo critério “rainha” (queen), basta tocar num ponto, mesmo que só na quina. Pelo critério “torre” (rook), é preciso dividir um pedaço de divisa.",
      pc: function () { return "Compara os contornos reais dos municípios, ponto a ponto, e anota para cada um a lista de quem encosta nele. Clique em um município para ver os vizinhos."; },
      conta: function (s) {
        var nb = (s.viz === "rook" ? NBR : NBQ), i = s.sel, o = (s.viz === "rook" ? NBQ : NBR).nb[i];
        return "<span class=eq><b>" + NAMES[i] + "</b> (" + (s.viz === "rook" ? "torre" : "rainha") + "): " + nb.nb[i].length + " vizinhos</span><p>" + L(nb.nb[i]) + ".</p>" +
          (o.length !== nb.nb[i].length ? "<p>No outro critério, ele teria " + o.length + " vizinhos.</p>" : "<p>No outro critério, a lista é a mesma.</p>") +
          "<div class=tbl-wrap><table><tr><th>Critério</th><th class=num>Pares vizinhos</th><th class=num>Isolados</th><th class=num>Média de vizinhos</th><th class=num>Mínimo a máximo</th></tr>" +
          [["Rainha", NBQ], ["Torre", NBR]].map(function (e) { return "<tr><td>" + e[0] + "</td><td class=num>" + e[1].pairs + "</td><td class=num>" + e[1].islands.length + "</td><td class=num>" + f2(e[1].meanDeg) + "</td><td class=num>" + e[1].minDeg + " a " + e[1].maxDeg + "</td></tr>"; }).join("") + "</table></div>";
      },
      tech: function () { return "<p>Contiguidade de primeira ordem calculada no navegador a partir da malha municipal do IBGE (2025), simplificada preservando as divisas compartilhadas. Rainha: dois municípios compartilham ao menos um vértice. Torre: compartilham ao menos uma aresta (segmento de divisa). Município sem vizinho é uma ilha e fica com linha de zeros em W. A contagem foi conferida por cálculo independente em Python (shapely): ver tests/check_aede.py. Outras definições de vizinhança (k vizinhos mais próximos, banda de distância) existem e podem mudar o resultado; a escolha do projeto ainda será definida.</p>"; },
      q: "Rainha ou torre, qual é a certa?", a: "Nenhuma é certa em si. Rainha conta quem toca só num ponto; torre exige divisa. Os dois dão resultados parecidos aqui, e mostrar a sensibilidade a essa escolha faz parte do método. A escolha do projeto ainda será definida.",
      viz: function (stage, ctl, state, root) {
        var inf = info(stage), nbd = state.viz === "rook" ? NBR : NBQ;
        var m = mapa(stage, { w: stage.clientWidth, cls: function (i) { return i === state.sel ? "selc" : nbd.nb[state.sel].indexOf(i) >= 0 ? "nbr" : "q0"; }, label: "Mapa de Alagoas com o município escolhido e seus vizinhos", onSel: function (i) { state.sel = i; ctl.redraw(); }, onHover: null });
        nbd.nb[state.sel].forEach(function (j) { var a = m.cs[state.sel], b = m.cs[j]; el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "class": "lnk" }, m.g); });
        inf.textContent = NAMES[state.sel] + " tem " + nbd.nb[state.sel].length + " vizinhos (" + (state.viz === "rook" ? "torre" : "rainha") + ").";
        stage.appendChild(legend([["sws", "município escolhido"], ["swn", "vizinhos"], ["sw0", "demais"]]));
        cap(stage, "Clique em um município (ou use a caixa de seleção acima) para ver quem é vizinho dele.");
      } },

    { t: "A matriz W e a padronização por linha",
      kid: "Para o computador, “quem é vizinho de quem” vira uma tabela quadrada: uma linha e uma coluna para cada município, com 1 onde são vizinhos e 0 onde não são. Depois cada linha é dividida pelo seu total, para somar 1: o peso de cada vizinho vira 1 dividido pelo número de vizinhos.",
      pc: function () { return "Monta a tabela W de 102 por 102 e divide cada linha pela soma dela. Assim, multiplicar W pelos valores dá a média dos vizinhos."; },
      conta: function (s) {
        var i = s.sel, nb = NBQ.nb[i], k = nb.length;
        var toy = "<p><b>Exemplo pequeno (A a F)</b>: B tem vizinhos A, C e D, então cada um pesa 1/3. A tem só B, que pesa 1.</p><div class=tbl-wrap><table><tr><th></th>" + "ABCDEF".split("").map(function (c) { return "<th class=num>" + c + "</th>"; }).join("") + "</tr>" +
          TOY.nb.map(function (l, r) { return "<tr><td>" + "ABCDEF"[r] + "</td>" + [0, 1, 2, 3, 4, 5].map(function (c) { var t = l.indexOf(c); return "<td class=num>" + (t < 0 ? "0" : s.std ? fmt(TOY.W.w[r][t], 2) : "1") + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
        return "<span class=eq>Linha de <b>" + NAMES[i] + "</b>: " + k + " vizinhos, cada peso " + (s.std ? "= 1 ÷ " + k + " = <b>" + f3(1 / k) + "</b>" : "= <b>1</b>") + "</span><span class=eq>Soma da linha: <b>" + (s.std ? "1" : String(k)) + "</b></span>" + toy;
      },
      tech: function () { return "<p>W é a matriz de pesos espaciais, com w<sub>ij</sub> &gt; 0 quando j é vizinho de i e w<sub>ii</sub> = 0. Padronizada por linha: w<sub>ij</sub> = 1/k<sub>i</sub>, de modo que cada linha soma 1 e S0 (soma de todos os pesos) vale n quando não há ilhas; com q ilhas, S0 = n − q. Com essa padronização W deixa de ser simétrica quando os municípios têm números de vizinhos diferentes. O desenho mostra os municípios ordenados de oeste a leste, o que concentra as células perto da diagonal; só as células não vazias são desenhadas.</p>"; },
      q: "Por que padronizar por linha?", a: "Para que o valor defasado seja uma média e não uma soma: um município com 9 vizinhos não pesa mais que um com 3 só por ter mais vizinhos. Outras padronizações existem e podem mudar o resultado.",
      viz: function (stage, ctl, state, root) {
        var order = G.map(function (f, i) { return [S.centroid(f)[0], i]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (e) { return e[1]; }), pos = {}; order.forEach(function (i, r) { pos[i] = r; });
        var w = Math.max(280, Math.min(520, stage.clientWidth - 16)), m = { l: 6, t: 6 }, cs = (w - 2 * m.l) / N;
        var svg = el("svg", { viewBox: "0 0 " + w + " " + w, role: "img", "aria-label": "Matriz de vizinhança W, 102 por 102, municípios de oeste a leste" }, stage);
        el("rect", { x: m.l, y: m.t, width: cs * N, height: cs * N, fill: "none", stroke: "currentColor", "stroke-width": .8, opacity: .5 }, svg);
        var rowSel = pos[state.sel];
        el("rect", { x: m.l, y: m.t + rowSel * cs - 0.5, width: cs * N, height: cs + 1, "class": "cell-sel", opacity: .25 }, svg);
        order.forEach(function (i, r) { NBQ.nb[i].forEach(function (j, t) {
          var v = state.std ? WQ.w[i][t] : 1, c = el("rect", { x: m.l + pos[j] * cs, y: m.t + r * cs, width: Math.max(cs, 1.4), height: Math.max(cs, 1.4), "class": i === state.sel ? "cell-sel" : "cell", opacity: state.std ? Math.min(1, .25 + v * 1.5) : 1 }, svg);
          el("title", {}, c, NAMES[i] + " e " + NAMES[j] + ": peso " + f3(v));
        }); });
        el("text", { x: w / 2, y: w - 1, "text-anchor": "middle", "font-size": 11, "class": "muted" }, svg, "colunas: municípios de oeste a leste");
        cap(stage, "Cada ponto é um par de vizinhos. A linha vermelha é o município escolhido. Pontos mais fracos = peso menor (mais vizinhos).");
      } },

    { t: "Defasagem espacial: a média dos vizinhos",
      kid: "Para cada município, perguntamos: “e os vizinhos, como estão em média?”. O computador faz isso município por município e pinta um segundo mapa com essas médias. O segundo mapa fica mais suave: os extremos se diluem.",
      pc: function () { return "Para cada município, pega a lista de vizinhos, soma os valores deles, divide pelo número de vizinhos e guarda o resultado. Este é o valor defasado, chamado Wz."; },
      conta: function (s) {
        var i = s.sel, nb = NBQ.nb[i], sm = 0; nb.forEach(function (j) { sm += X[j]; });
        var rowsB = TOY.nb.map(function (l, r) { return "<tr><td>" + "ABCDEF"[r] + "</td><td class=num>" + TOY.x[r] + "</td><td>" + (l.map(function (j) { return "ABCDEF"[j]; }).join(", ")) + "</td><td class=num>" + f2(TOY.m.wz[r] + S.mean(TOY.x)) + "</td></tr>"; }).join("");
        return "<span class=eq><b>" + NAMES[i] + "</b>: média dos " + nb.length + " vizinhos = (" + nb.map(function (j) { return f1(X[j]); }).join(" + ") + ") ÷ " + nb.length + " = <b>" + f1(sm / nb.length) + "%</b></span><span class=eq>Valor do próprio município: " + f1(X[i]) + "%</span>" +
          "<p><b>Exemplo pequeno (A a F)</b>: B tem vizinhos A, C e D: (95 + 90 + 80) ÷ 3 = 88,33.</p><div class=tbl-wrap><table><tr><th></th><th class=num>Valor</th><th>Vizinhos</th><th class=num>Média dos vizinhos</th></tr>" + rowsB + "</table></div>";
      },
      tech: function () { return "<p>Defasagem espacial: (Wz)<sub>i</sub> = Σ<sub>j</sub> w<sub>ij</sub> z<sub>j</sub>. Aqui, para ficar legível, a figura mostra a média dos valores brutos dos vizinhos (Wx); no passo 6 trabalha-se com os desvios da média, em que Wz = Wx − média quando não há ilhas. As cores usam os mesmos cortes de quantis do mapa original, o que torna visível a suavização. A animação percorre os municípios na ordem do código IBGE, começando pelo escolhido.</p>"; },
      q: "A defasagem espacial é um novo dado?", a: "É um dado derivado: a média do entorno de cada município. Ele só existe por causa da escolha da matriz W. Comparar o valor do município com o do entorno é a base do diagrama de Moran.",
      viz: function (stage, ctl, state, root) {
        var br = S.quantileBreaks(X, 5), grid = document.createElement("div"); grid.className = "maps2"; stage.appendChild(grid);
        var a = document.createElement("div"), b = document.createElement("div"); grid.appendChild(a); grid.appendChild(b);
        a.innerHTML = "<p class=cap>Valor do município</p>"; b.innerHTML = "<p class=cap>Média dos vizinhos</p>";
        var ma = mapa(a, { w: a.clientWidth, cls: function (i) { return qcls(X[i], br); }, label: "Mapa do valor de cada município" });
        var mb = mapa(b, { w: b.clientWidth, cls: function () { return "qe"; }, label: "Mapa da média dos vizinhos, preenchido município a município" });
        var inf = info(stage), WX = S.lag(X, WQ), order = [state.sel]; for (var i = 0; i < N; i++) if (i !== state.sel) order.push(i);
        var k = 0, hl = [];
        function paintA() { hl.forEach(function (j) { setCls(ma, j, qcls(X[j], br)); }); hl = []; }
        function one() {
          var i = order[k]; paintA();
          NBQ.nb[i].forEach(function (j) { setCls(ma, j, "nbr"); hl.push(j); }); setCls(ma, i, "selc"); hl.push(i);
          setCls(mb, i, qcls(WX[i], br)); k++;
          inf.textContent = "Município " + k + " de " + N + ": " + NAMES[i] + ", " + NBQ.nb[i].length + " vizinhos. Valor " + f1(X[i]) + "%; média dos vizinhos " + f1(WX[i]) + "%.";
          if (k >= N) { paintA(); inf.textContent = "Pronto: média dos vizinhos calculada nos " + N + " municípios. Compare os dois mapas: o da direita é mais suave."; }
        }
        if (clock.reduced) { while (k < N) one(); } else clock.rateTask(8, one, function () { return k >= N; });
        stage.appendChild(legend([["sw0", "menores"], ["sw2", "intermediários"], ["sw4", "maiores"], ["swe", "ainda não calculado"], ["sws", "município da vez"], ["swn", "vizinhos dele"]]));
        aviso(stage); cap(stage, "Mesmos cortes de cores nos dois mapas. A média dos vizinhos varia menos que o valor de cada município.");
      } },

    { t: "Diagrama de dispersão de Moran",
      kid: "Colocamos cada município num gráfico: para a direita, o quanto ele está acima da média; para cima, o quanto os vizinhos estão acima da média. Se os pontos sobem da esquerda para a direita, municípios altos têm vizinhos altos. A inclinação da reta é o I de Moran.",
      pc: function () { return "Troca os valores por desvios da média (padronizados), calcula a média dos vizinhos de cada um, marca um ponto por município e ajusta uma reta. O sinal e a inclinação dessa reta resumem o padrão."; },
      conta: function (s) {
        var i = s.sel, q = QUAD[i];
        var c = [0, 0, 0, 0]; QUAD.forEach(function (x) { c[x]++; });
        return "<span class=eq><b>" + NAMES[i] + "</b>: z = (" + f1(X[i]) + " − " + f1(MEAN) + ") ÷ " + f2(S.sd(X)) + " = <b>" + f2(ZS[i]) + "</b>; Wz = <b>" + f2(WZS[i]) + "</b> → " + S.QUAD[q] + "</span>" +
          "<span class=eq>Inclinação da reta = <b>" + f3(S.slope(ZS, WZS)) + "</b> = I de Moran (" + f3(MQ.I) + "); esperado sem padrão: " + f3(MQ.EI) + "</span>" +
          "<div class=tbl-wrap><table><tr><th>Quadrante</th><th class=num>Municípios</th></tr>" + [0, 3, 1, 2].map(function (j) { return "<tr><td>" + S.QUAD[j] + "</td><td class=num>" + c[j] + "</td></tr>"; }).join("") + "</table></div>" +
          "<p><b>Exemplo pequeno (A a F)</b>: I = Σ z·Wz ÷ Σ z² = " + f2(TOY.m.num) + " ÷ " + f2(TOY.m.den) + " = <b>" + f4(TOY.m.I) + "</b>; esperado sem padrão: " + f2(TOY.m.EI) + ".</p>";
      },
      tech: function () { return "<p>I = (n/S0) · Σ<sub>i</sub> Σ<sub>j</sub> w<sub>ij</sub> z<sub>i</sub> z<sub>j</sub> / Σ z<sub>i</sub>², com z = desvio da média. Com W padronizada por linha, S0 = n e I coincide com a inclinação da regressão de Wz sobre z. Os quadrantes são: alto-alto e baixo-baixo (associação positiva) e baixo-alto e alto-baixo (pontos que destoam do entorno). Valor esperado sob ausência de padrão: E[I] = −1/(n−1). Esta figura é descritiva: o quadrante de um município ainda não vem com teste de significância (isso é o LISA). A estatística vem de Moran (1950). As coordenadas usam desvios padronizados (média 0, desvio padrão 1); a inclinação não muda com a padronização.</p>"; },
      q: "O que significa um ponto no quadrante baixo-alto?", a: "É um município abaixo da média cercado de vizinhos acima da média. É candidato a ponto fora da curva espacial, mas só o teste local (LISA) diz se isso vai além do acaso.",
      viz: function (stage, ctl, state, root) {
        var w = Math.max(280, Math.min(560, stage.clientWidth - 16)), h = Math.round(w * .85), m = { l: 38, r: 10, t: 14, b: 34 }, lim = Math.ceil(Math.max.apply(null, ZS.concat(WZS).map(Math.abs)) * 2) / 2 + .25;
        var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Diagrama de dispersão de Moran: desvio padronizado do município contra a média dos vizinhos" }, stage);
        var X_ = function (v) { return m.l + (w - m.l - m.r) * (v + lim) / (2 * lim); }, Y_ = function (v) { return m.t + (h - m.t - m.b) * (1 - (v + lim) / (2 * lim)); };
        for (var t = -Math.floor(lim); t <= Math.floor(lim); t++) {
          el("line", { x1: X_(t), x2: X_(t), y1: m.t, y2: h - m.b, "class": "grid", stroke: "var(--line)" }, svg); el("line", { x1: m.l, x2: w - m.r, y1: Y_(t), y2: Y_(t), stroke: "var(--line)" }, svg);
          el("text", { x: X_(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, String(t).replace("-", "−")); el("text", { x: m.l - 6, y: Y_(t) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg, String(t).replace("-", "−"));
        }
        el("line", { x1: X_(0), x2: X_(0), y1: m.t, y2: h - m.b, stroke: "currentColor", "stroke-width": 1.4 }, svg); el("line", { x1: m.l, x2: w - m.r, y1: Y_(0), y2: Y_(0), stroke: "currentColor", "stroke-width": 1.4 }, svg);
        [["baixo-alto", m.l + 4, m.t + 12, "start"], ["alto-alto", w - m.r - 4, m.t + 12, "end"], ["baixo-baixo", m.l + 4, h - m.b - 6, "start"], ["alto-baixo", w - m.r - 4, h - m.b - 6, "end"]].forEach(function (q) { el("text", { x: q[1], y: q[2], "text-anchor": q[3], "font-size": 12, "font-weight": 700, "class": "muted" }, svg, q[0]); });
        el("text", { x: (m.l + w - m.r) / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, "desvio padronizado do município (z)");
        el("text", { x: 4, y: 11, "font-size": 12, "class": "muted" }, svg, "média dos vizinhos (Wz)");
        var pts = ZS.map(function (z, i) { return el("circle", { cx: X_(z), cy: Y_(0), r: i === state.sel ? 6 : 4, "class": "qd" + QUAD[i], stroke: i === state.sel ? "currentColor" : "var(--bg)", "stroke-width": i === state.sel ? 2.5 : 1 }, svg); });
        var mq = null;
        function pick(i) {
          state.sel = i; pts.forEach(function (p, j) { p.setAttribute("r", j === i ? 6 : 4); p.setAttribute("stroke", j === i ? "currentColor" : "var(--bg)"); p.setAttribute("stroke-width", j === i ? 2.5 : 1); });
          pts[i].parentNode.appendChild(pts[i]); if (mq) mq.paths.forEach(function (q, j) { q.setAttribute("class", "qd" + QUAD[j] + (j === i ? " focus" : "")); });
          var c = root.querySelector("[data-live=conta6]"); if (c) c.innerHTML = STEPS[5].conta(state);
        }
        pts.forEach(function (p, i) { el("title", {}, p, NAMES[i]); p.style.cursor = "pointer"; p.addEventListener("click", function () { pick(i); }); });
        var sl = S.slope(ZS, WZS), ic = S.mean(WZS) - sl * S.mean(ZS), ln = el("line", { x1: X_(-lim), y1: Y_(ic - sl * lim), x2: X_(lim), y2: Y_(ic + sl * lim), "class": "l-alt", opacity: 0 }, svg);
        var lab = el("text", { x: X_(lim * .55), y: Y_(ic + sl * lim * .55) - 8, "font-size": 13, "font-weight": 700, "text-anchor": "middle", opacity: 0 }, svg, "inclinação = " + f2(sl));
        clock.tween(2.2, function (p) { var e = p * p * (3 - 2 * p); pts.forEach(function (c, i) { c.setAttribute("cy", Y_(WZS[i] * e)); }); var o = p >= 1 ? 1 : 0; ln.setAttribute("opacity", o); lab.setAttribute("opacity", o); });
        stage.appendChild(legend([["swq0", "alto-alto"], ["swq3", "alto-baixo"], ["swq1", "baixo-alto"], ["swq2", "baixo-baixo"]]));
        var h2 = document.createElement("p"); h2.className = "cap"; h2.textContent = "Clique em um ponto para destacar o município. Mapa dos quadrantes abaixo (sem teste de significância ainda)."; stage.appendChild(h2);
        mq = mapa(stage, { w: stage.clientWidth, onSel: pick, cls: function (i) { return "qd" + QUAD[i] + (i === state.sel ? " focus" : ""); }, label: "Mapa dos quadrantes do diagrama de Moran", titles: function (i) { return S.QUAD[QUAD[i]]; } });
        aviso(stage);
      } },

    { t: "O que fazer em seguida",
      kid: "Já sabemos olhar o mapa, definir vizinhos e comparar cada município com o entorno. Os próximos passos respondem duas perguntas: existe padrão espacial no conjunto? E onde estão os grupos de municípios parecidos e os pontos fora da curva?",
      pc: function () { return "Repete o cálculo do I de Moran com três definições de vizinhança (rainha, torre e 5 vizinhos mais próximos), com um teste por sorteios (permutação) para o caso da rainha."; },
      conta: function () {
        var rows = [["Rainha", NBQ, MQ], ["Torre", NBR, MR], ["5 vizinhos mais próximos", NBK, MK]].map(function (e) { return "<tr><td>" + e[0] + "</td><td class=num>" + f2(e[1].meanDeg) + "</td><td class=num>" + f3(e[2].I) + "</td></tr>"; }).join("");
        return "<div class=tbl-wrap><table><tr><th>Vizinhança</th><th class=num>Média de vizinhos</th><th class=num>I de Moran</th></tr>" + rows + "</table></div><span class=eq>Esperado sem padrão: " + f3(MQ.EI) + "</span><span class=eq>Rainha: pseudo-p = (" + PQ.R + " + 1) ÷ (" + NPERM + " + 1) = <b>" + f3(PQ.p) + "</b> (semente " + SEED + ")</span><p>Valores de exemplo fictícios. Os testes e a leitura completa são o tema do método 4 (I de Moran global), e os agrupamentos locais, do método 5 (Moran local, LISA).</p>";
      },
      tech: function () { return "<p>O I de Moran global resume a associação espacial num único número e é testado por permutação: os valores são embaralhados entre os municípios (Fisher-Yates, semente fixa) " + NPERM + " vezes, e o pseudo-p é (R + 1)/(M + 1), em que R é o número de réplicas tão ou mais extremas que o I observado. O Moran local (LISA, Anselin, 1995) decompõe o global em uma contribuição por município. A sensibilidade à matriz W deve ser mostrada: aqui, três definições de vizinhança. Escolhas que o projeto ainda vai definir: matriz W, número de permutações, correção para comparações múltiplas e tratamento de ilhas.</p>"; },
      q: "A AEDE já responde se há padrão espacial?", a: "Ela descreve e levanta hipóteses: mapa, vizinhança, defasagem e diagrama. A resposta com teste vem do I de Moran global; a localização dos grupos, do Moran local.",
      viz: function (stage) {
        var rows = [["Rainha", MQ.I], ["Torre", MR.I], ["5 mais próximos", MK.I]], w = C.width(stage), h = 170, m = { l: 136, r: 24, t: 14, b: 30 }, bh = 28;
        var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "I de Moran fictício com três definições de vizinhança" }, stage), max = 0.6, Xs = function (v) { return m.l + (w - m.l - m.r) * v / max; };
        for (var t = 0; t <= 0.6001; t += 0.2) { el("line", { x1: Xs(t), x2: Xs(t), y1: m.t, y2: h - m.b, stroke: "var(--line)" }, svg); el("text", { x: Xs(t), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, fmt(t, 1)); }
        rows.forEach(function (r, i) { var y = m.t + i * (bh + 12); el("text", { x: m.l - 8, y: y + bh / 2 + 5, "text-anchor": "end", "font-size": 13 }, svg, r[0]); el("rect", { x: Xs(0), y: y, width: Xs(r[1]) - Xs(0), height: bh, "class": "bar" }, svg); el("text", { x: Xs(r[1]) + 6, y: y + bh / 2 + 5, "font-size": 13, "font-weight": 700 }, svg, f2(r[1])); });
        el("line", { x1: Xs(0), x2: Xs(0), y1: m.t, y2: h - m.b, stroke: "currentColor", "stroke-width": 1.4 }, svg);
        el("text", { x: (m.l + w - m.r) / 2, y: h - 2, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, "I de Moran (esperado sem padrão: " + f2(MQ.EI) + ")");
        aviso(stage); cap(stage, "Mesmos dados fictícios, três definições de vizinhança.");
      } }
  ];
  STEPS.forEach(function (s) { var p = s.pc, c = s.conta, t = s.tech; s.pc = function () { return typeof p === "function" ? p() : p; }; s.conta = function (st) { return c(st); }; s.tech = function () { return t(); }; });
  var SIMPLE = [0, 1, 2, 4, 5, 6]; /* roteiro simplificado: sem o passo da matriz W */

  var ARW = { prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' };
  function chips(label, opts, cur, onPick) {
    var g = document.createElement("span"); g.className = "grp"; g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
    var l = document.createElement("span"); l.textContent = label + ":"; g.appendChild(l);
    opts.forEach(function (o) { var b = document.createElement("button"); b.type = "button"; b.textContent = o[1]; b.setAttribute("aria-pressed", String(o[0] === cur)); b.addEventListener("click", function () { onPick(o[0]); }); g.appendChild(b); });
    return g;
  }
  function renderPassos(root, app, state) {
    if (state.simple === undefined) state.simple = true;
    if (state.sel === undefined) state.sel = SEL0;
    state.k = state.k || 5; state.viz = state.viz || "queen"; state.std = state.std !== false; state.shufSeed = state.shufSeed || 11;
    var order = state.simple ? SIMPLE : STEPS.map(function (x, i) { return i; }), N_ = order.length;
    var idx = Math.max(0, Math.min(N_ - 1, (state.step || 1) - 1)), st = STEPS[order[idx]], which = order[idx];
    clock.clear(); root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "opts"; root.appendChild(ds);
    function redraw() { renderPassos(root, app, state); app.remount && app.remount(); }
    ds.appendChild(chips("Roteiro", [[true, "simplificado"], [false, "completo"]], state.simple, function (v) { state.simple = v; state.step = 1; app.go(state, 1); }));
    if (which === 1) ds.appendChild(chips("Classes", [[4, "4"], [5, "5"]], state.k, function (v) { state.k = v; redraw(); }));
    if (which === 2) ds.appendChild(chips("Vizinhança", [["queen", "rainha"], ["rook", "torre"]], state.viz, function (v) { state.viz = v; redraw(); }));
    if (which === 3) ds.appendChild(chips("Pesos", [[false, "0 ou 1"], [true, "por linha"]], state.std, function (v) { state.std = v; redraw(); }));
    if (which === 1) ds.appendChild(chips("Denominador pequeno", [[true, "marcar"], [false, "ocultar"]], !!state.dots, function (v) { state.dots = v; redraw(); }));
    if (which === 1 || which === 2 || which === 3 || which === 4 || which === 5) ds.appendChild(seletor(root, state, redraw));
    var head = document.createElement("div"); head.className = "stephead";
    var back = document.createElement("button"); back.className = "arrow"; back.innerHTML = ARW.prev; back.setAttribute("aria-label", "Passo anterior"); back.title = "Passo anterior"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "arrow"; nxt.innerHTML = ARW.next; nxt.setAttribute("aria-label", "Próximo passo"); nxt.title = "Próximo passo"; nxt.disabled = idx === N_ - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    var no = document.createElement("p"); no.className = "stepno"; no.textContent = "Passo " + (idx + 1) + " de " + N_;
    head.appendChild(back); head.appendChild(no); head.appendChild(nxt); root.appendChild(head);
    var pr = document.createElement("div"); pr.className = "progress"; pr.setAttribute("role", "progressbar"); pr.setAttribute("aria-valuemin", "1"); pr.setAttribute("aria-valuemax", String(N_)); pr.setAttribute("aria-valuenow", String(idx + 1)); pr.innerHTML = '<i style="width:' + ((idx + 1) / N_ * 100) + '%"></i>'; root.appendChild(pr);
    var h2 = document.createElement("h2"); h2.id = "step-h"; h2.tabIndex = -1; h2.textContent = (idx + 1) + ". " + st.t; root.appendChild(h2);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var body = document.createElement("div"); root.appendChild(body);
    if (!state.shuf) { var v = X.slice(); S.shuffle(v, S.rng(state.shufSeed)); state.shuf = { v: v, I: S.moranI(v, WQ).I }; }
    body.innerHTML =
      "<div class='callout kid'><b>Explicação simplificada</b>" + st.kid + "</div>" +
      "<div class=card><span class=lbl>O que o computador faz</span>" + st.pc() + "</div>" +
      "<div class='card conta'><span class=lbl>Conta na tela</span><div data-live=conta" + (which + 1) + ">" + st.conta(state) + "</div></div>" +
      "<details class=tech" + (app.tech() ? " open" : "") + "><summary>Ver a versão técnica</summary>" + st.tech() + "</details>";
    var ctl = { redraw: redraw };
    st.viz(stage, ctl, state, root);
    var h = root.querySelector("#step-h"); if (state.focus && h) h.focus({ preventScroll: false });
  }

  /* ---------- seções "Saiba mais" ---------- */
  function tabContexto() {
    return "<div class=card><h2>Qual pergunta este método responde?</h2><p>A cobertura vacinal e o abandono dos 102 municípios de Alagoas se distribuem no mapa de forma aleatória ou há regiões de valores parecidos? Antes de ajustar qualquer modelo, a análise exploratória de dados espaciais (AEDE) descreve a distribuição no espaço e levanta hipóteses.</p>" +
      "<p>É um conjunto de técnicas: mapa por quantis, definição de vizinhança, matriz W, defasagem espacial, diagrama de dispersão de Moran, I de Moran global e Moran local (LISA). Este método cobre as quatro primeiras partes e o diagrama; os testes ficam para os métodos 4 e 5.</p>" +
      "<p>O I de Moran vem de Moran (1950) e os indicadores locais de associação espacial (LISA), de Anselin (1995). Há estudos de análise espacial da cobertura vacinal no Nordeste e na Paraíba (Cunha e colaboradores, 2022 e 2023).</p></div>" +
      "<div class='callout alert'><b>Atenção</b>Os valores deste simulador são fictícios e sorteados, sem relação com os municípios reais. Só o desenho dos municípios (malha do IBGE) e as relações de vizinhança são reais.</div><p>A simulação está no topo desta página. As perguntas frequentes ficam no final.</p>";
  }
  function tabDados() {
    var rows = G.map(function (f, i) { return "<tr><td>" + NAMES[i] + "</td><td class=num>" + D.nasc[i].toLocaleString("pt-BR") + "</td><td class=num>" + f1(D.cob[i]) + "</td><td class=num>" + f1(D.aband[i]) + "</td><td>" + (PEQ[i] ? "sim" : "") + "</td></tr>"; }).join("");
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Variável</th><th>Papel</th><th>Unidade</th><th>Origem aqui</th></tr><tr><td>Malha municipal</td><td>geometria e vizinhança</td><td>102 polígonos</td><td>IBGE, 2025 (real)</td></tr><tr><td>Cobertura vacinal</td><td>variável analisada</td><td>%</td><td>sorteada, semente fixa</td></tr><tr><td>Taxa de abandono</td><td>variável de apoio</td><td>%</td><td>sorteada, semente fixa</td></tr><tr><td>Nascidos vivos</td><td>denominador</td><td>crianças</td><td>sorteado, semente fixa</td></tr></table></div>" +
      "<p>O padrão espacial dos valores (dois bolsões de cobertura baixa e uma região mais alta) foi inventado para a demonstração, com mais ruído nos municípios de denominador pequeno. Valores sorteados, sem relação com os municípios reais. O gerador está em <code>tests/gen_spatial_data.js</code>.</p></div>" +
      "<details class=tech><summary>Tabela dos 102 municípios (valores fictícios)</summary><div class=scroll-box><table><tr><th>Município</th><th class=num>Nascidos</th><th class=num>Cobertura (%)</th><th class=num>Abandono (%)</th><th>Menos de 1.000</th></tr>" + rows + "</table></div></details>";
  }
  function tabResultado() {
    var c = [0, 0, 0, 0]; QUAD.forEach(function (x) { c[x]++; });
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Mapas de quantis, lista de vizinhos, valor defasado por município e o diagrama de dispersão de Moran com seus quadrantes. Servem para levantar hipóteses e escolher a matriz W; os testes vêm depois.</p><ul><li><b>Pode concluir:</b> se o mapa sugere manchas de valores parecidos e se a conclusão muda com a definição de vizinhança.</li><li><b>Não pode concluir:</b> que o padrão é estatisticamente significativo (isso exige o teste do I de Moran) nem a causa dele.</li></ul></div>" +
      "<div class=card><h3>Exemplo fictício</h3><p>Rainha: " + NBQ.pairs + " pares de vizinhos, nenhum município isolado, média de " + f2(NBQ.meanDeg) + " vizinhos (de " + NBQ.minDeg + " a " + NBQ.maxDeg + "). Torre: " + NBR.pairs + " pares, média de " + f2(NBR.meanDeg) + ". I de Moran da cobertura fictícia: " + f3(MQ.I) + " (rainha), " + f3(MR.I) + " (torre) e " + f3(MK.I) + " (5 vizinhos mais próximos); esperado sem padrão: " + f3(MQ.EI) + ". Pseudo-p da rainha, com " + NPERM + " permutações: " + f3(PQ.p) + ". Quadrantes: " + c[0] + " alto-alto, " + c[2] + " baixo-baixo, " + c[1] + " baixo-alto e " + c[3] + " alto-baixo.</p></div>";
  }
  function tabLimites() {
    var Ls = ["Os valores do simulador são fictícios; só a geometria e a vizinhança são reais.", "O resultado depende da definição de vizinhança e da padronização de W; por isso é preciso mostrar a sensibilidade a essa escolha.", "A vizinhança por contiguidade trata como iguais municípios de tamanhos e formas muito diferentes e não enxerga barreiras (rios, estradas) nem fluxos de pessoas.", "Taxas de municípios com denominador pequeno são instáveis e podem gerar manchas ou pontos fora da curva só por acaso.", "Mapas por quantis mostram posição relativa; valores quase iguais podem ter cores diferentes.", "A AEDE é descritiva: não prova causa e, sozinha, não testa significância.", "A análise é ecológica: descreve municípios, não crianças.", "Mapa coroplético depende da divisão territorial usada (os limites municipais)."];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + Ls.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var D1 = ["Escopo: 102 municípios de Alagoas, com cobertura vacinal e taxa de abandono.", "Cobertura sem teto na base, com bandeiras para acima de 100%, 110% e 120% e abaixo de 50%; o teto de 100% só vale em mapas e médias, com o valor bruto na legenda.", "Denominador abaixo de 1.000 como bandeira; análise principal com o valor bruto e sensibilidade.", "Dispensa de submissão ao CEP mantida por ora."];
    var P = ["Matriz W: rainha, torre, k vizinhos mais próximos ou banda de distância, e como tratar municípios isolados.", "Padronização de W (por linha ou outra).", "Número de permutações do teste e semente.", "Correção para comparações múltiplas nos testes locais.", "Classes e cortes dos mapas.", "Uso de taxas suavizadas (por exemplo, Bayes empírico) ao lado das taxas brutas."];
    return "<div class=card><h2>O que o projeto definiu</h2><ul>" + D1.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>Escolhas que o projeto ainda vai definir</h2><p class=cap>Estas escolhas afetam o resultado e estão em aberto; aqui aparecem as alternativas, sem decisão.</p><ul>" + P.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabFontes() { var r = (NS.refs && NS.refs.aede) || []; return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>"; }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>Entradas: um arquivo de geometria dos municípios (por exemplo, a malha do IBGE) e uma tabela com a variável de interesse por município. Os nomes são exemplos.</p>" +
      "<h3>Python (geopandas, libpysal, esda)</h3><pre>import geopandas as gpd\nfrom libpysal import weights\nfrom esda.moran import Moran\n\ngdf = gpd.read_file('AL_Municipios_2025.shp').merge(tabela, on='CD_MUN')\nw = weights.Queen.from_dataframe(gdf)\nw.transform = 'r'            # padronização por linha\nmoran = Moran(gdf['cobertura'], w, permutations=999)\nprint(moran.I, moran.EI, moran.p_sim)</pre>" +
      "<h3>R (sf e spdep)</h3><pre>library(sf); library(spdep)\nmapa &lt;- merge(st_read('AL_Municipios_2025.shp'), tabela, by = 'CD_MUN')\nnb &lt;- poly2nb(mapa, queen = TRUE)\nlw &lt;- nb2listw(nb, style = 'W', zero.policy = TRUE)\nmoran.mc(mapa$cobertura, lw, nsim = 999)</pre>" +
      "<h3>Conferência neste repositório</h3><p>O arquivo <code>tests/check_aede.py</code> refaz em Python (shapely e numpy) a vizinhança rainha e torre, os 5 vizinhos mais próximos, a defasagem, o I de Moran e a permutação com a mesma semente, e compara com o motor JavaScript.</p><pre>node tests/dump_aede.js &gt; aede_js.json\npython3 tests/check_aede.py aede_js.json</pre></div>";
  }
  function tabFaq() { return "<div class=card>" + STEPS.map(function (x) { return "<h3>" + x.q + "</h3><p>" + x.a + "</p>"; }).join("") + "<h3>Por que aparecem nomes de municípios reais?</h3><p>Para o mapa ser reconhecível. Os valores, porém, são sorteados e não têm relação com os municípios reais; nada aqui descreve a cobertura de um município.</p><h3>Um município sem vizinhos atrapalha?</h3><p>Município isolado (ilha) fica com linha de zeros em W e reduz a soma dos pesos. Na malha usada aqui, nenhum município é isolado pelos critérios rainha e torre.</p></div>"; }

  NS.methods.aede = {
    id: "aede", n: 3, nome: "AEDE", ready: true, steps: STEPS.length, count: function (st) { return st.simple === false ? STEPS.length : SIMPLE.length; },
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
    }
  };
})();
