/* Método 8: Como se encaixam. Página curta, sem cálculo novo: mostra a cadeia do projeto e reaproveita os números fictícios dos métodos 1 a 7
   (valores reunidos em js/encaixe_core.js, com os mesmos motores, dados, sementes e configurações padrão dos módulos). Nada aqui anima, então não há controles de animação. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var C = NS.charts, clock = NS.clock, fmt = C.fmt, sg = C.signed, el = C.el, K = NS.encaixe_core;
  function f1(x) { return fmt(x, 1); } function f2(x) { return fmt(x, 2); } function f3(x) { return fmt(x, 3); } function f4(x) { return fmt(x, 4); } function f0(x) { return fmt(x, 0); }

  /* ---------- valores-chave: o bloco 'ind' é imediato; 'jp' e 'esp' são calculados sob demanda, em pedaços, para não travar a página ---------- */
  var V = { ind: null, jp: null, esp: null }, waiting = [], started = false;
  function start() {
    if (started) return; started = true;
    V.ind = K.indicadores();
    setTimeout(function () { V.jp = K.joinpoint(); flush(); setTimeout(function () { V.esp = K.espacial(NS.geo.features, NS.spatial_data); flush(); }, 20); }, 30);
  }
  function flush() { var w = waiting; waiting = []; w.forEach(function (o) { if (V[o.key]) o.fn(V[o.key]); else waiting.push(o); }); }
  function when(key, fn) { start(); if (V[key]) fn(V[key]); else waiting.push({ key: key, fn: fn }); }

  /* ---------- a cadeia ---------- */
  var CHAIN = [
    { id: "indicadores", nome: "Indicadores", q: "Quantas crianças foram vacinadas, quantas não terminaram o esquema e quantos municípios chegaram a 95%?", nao: "Por que um município ficou abaixo da meta; nem se o registro está correto." },
    { id: "joinpoint", nome: "Joinpoint", q: "A cobertura do estado subiu, caiu ou mudou de direção, e em que anos?", nao: "Onde, no mapa, isso aconteceu; nem a causa da mudança." },
    { id: "moran", nome: "AEDE e Moran global", q: "Municípios parecidos ficam perto uns dos outros no mapa?", nao: "Quais municípios formam o padrão; é um número único para o estado." },
    { id: "lisa", nome: "LISA", q: "Quais municípios têm vizinhos parecidos ou destoam dos vizinhos?", nao: "Se o grupo inteiro é significativo (só o município central é testado); nem a causa." },
    { id: "satscan", nome: "SaTScan", q: "Existe um grupo de municípios vizinhos com risco maior que o do resto do estado?", nao: "O motivo do risco; o círculo não segue o contorno real dos municípios." },
    { id: "gwr", nome: "VIF, OLS e GWR", q: "Que fatores andam junto com a cobertura, e isso muda de lugar para lugar?", nao: "Causa e efeito: é associação entre municípios, não entre pessoas." }
  ];
  var TITLES = { indicadores: "Indicadores", joinpoint: "Joinpoint", aede: "AEDE", moran: "I de Moran global", lisa: "LISA", satscan: "SaTScan", gwr: "VIF, OLS e GWR" };
  var NUM = { indicadores: 1, joinpoint: 2, aede: 3, moran: 4, lisa: 5, satscan: 6, gwr: 7 };

  function wrap(txt, max) {
    var words = txt.split(" "), lines = [], cur = "";
    words.forEach(function (w) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) lines.push(cur); return lines;
  }
  function text(g, x, y, lines, attrs, lh) { lines.forEach(function (t, i) { el("text", Object.assign({ x: x, y: y + i * lh }, attrs), g, t); }); return y + lines.length * lh; }

  /* Diagrama: três colunas em duas linhas (largo) ou uma coluna (celular). Cada caixa é um link para o método. */
  function diagrama(parent, active, app) {
    var W = Math.max(280, Math.min(900, parent.clientWidth || 640)), wide = W >= 700, cols = wide ? 3 : 1, gx = wide ? 34 : 0, gy = 30, m = 6;
    var bw = (W - 2 * m - gx * (cols - 1)) / cols, cw = Math.max(18, Math.floor((bw - 24) / 6.7)), chars = Math.max(18, Math.floor((bw - 24) / 6.2));
    var items = CHAIN.map(function (c) { return { c: c, ql: wrap(c.q, cw), nl: wrap("Não responde: " + c.nao, chars) }; });
    var hs = items.map(function (it) { return 14 + 22 + it.ql.length * 17 + 8 + it.nl.length * 16 + 12; }), rows = Math.ceil(items.length / cols), rowH = [];
    for (var r = 0; r < rows; r++) { var mx = 0; for (var c0 = 0; c0 < cols; c0++) { var ix = r * cols + c0; if (hs[ix]) mx = Math.max(mx, hs[ix]); } rowH.push(mx); }
    var H = m * 2 + rowH.reduce(function (a, b) { return a + b; }, 0) + gy * (rows - 1);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "group", "aria-label": "Cadeia do projeto: seis métodos em sequência; cada caixa abre a página do método", "class": "chain" }, parent);
    var defs = el("defs", {}, svg), mk = el("marker", { id: "arw", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M1 1L9 5L1 9z", fill: "currentColor", "class": "muted" }, mk);
    var pos = items.map(function (it, i) { var r = Math.floor(i / cols), c = i % cols, y = m; for (var k = 0; k < r; k++) y += rowH[k] + gy; return { x: m + c * (bw + gx), y: y, h: rowH[r] }; });
    pos.forEach(function (p, i) {
      if (i === 0) return; var q = pos[i - 1];
      if (wide && i % cols === 0) { var y1 = q.y + q.h, ym = y1 + gy / 2, x1 = q.x + bw / 2, x2 = p.x + bw / 2; el("path", { d: "M" + x1 + " " + y1 + "V" + ym + "H" + x2 + "V" + (p.y - 3), fill: "none", "class": "link", "marker-end": "url(#arw)" }, svg); }
      else if (wide) el("path", { d: "M" + (q.x + bw + 3) + " " + (q.y + q.h / 2) + "H" + (p.x - 3), fill: "none", "class": "link", "marker-end": "url(#arw)" }, svg);
      else el("path", { d: "M" + (p.x + bw / 2) + " " + (q.y + q.h + 2) + "V" + (p.y - 3), fill: "none", "class": "link", "marker-end": "url(#arw)" }, svg);
    });
    items.forEach(function (it, i) {
      var p = pos[i], on = i === active, g = el("g", { "class": "bx" + (on ? " on" : ""), role: "link", tabindex: 0, "aria-label": "Abrir o método: " + it.c.nome + (on ? " (etapa atual da simulação)" : "") }, svg);
      el("rect", { x: p.x, y: p.y, width: bw, height: p.h, rx: 10 }, g);
      el("circle", { cx: p.x + 20, cy: p.y + 25, r: 11, "class": "badge" }, g); el("text", { x: p.x + 20, y: p.y + 30, "text-anchor": "middle", "font-size": 13, "font-weight": 700, "class": "badge-t" }, g, String(i + 1));
      el("text", { x: p.x + 38, y: p.y + 30, "font-size": 15, "font-weight": 700 }, g, it.c.nome);
      var y = text(g, p.x + 12, p.y + 56, it.ql, { "font-size": 13 }, 17);
      text(g, p.x + 12, y + 8, it.nl, { "font-size": 12.5, "class": "muted" }, 16);
      var go = function () { app.open(it.c.id); };
      g.addEventListener("click", go); g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    return svg;
  }
  function chips(parent, app) {
    var d = document.createElement("div"); d.className = "opts"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "Abrir a página de um método");
    var g = document.createElement("span"); g.className = "grp"; g.innerHTML = "<span>Abrir método</span>"; d.appendChild(g);
    Object.keys(NUM).forEach(function (id) { var b = document.createElement("button"); b.type = "button"; b.textContent = NUM[id] + ". " + TITLES[id]; b.addEventListener("click", function () { app.open(id); }); g.appendChild(b); });
    parent.appendChild(d);
  }

  /* ---------- peças de apresentação ---------- */
  function tile(l, v, s) { return "<div class=tile><span class=tl>" + l + "</span><span class=tv>" + v + "</span>" + (s ? "<span class=ts>" + s + "</span>" : "") + "</div>"; }
  function tiles(arr) { return "<div class=tiles>" + arr.join("") + "</div>"; }
  function pend(stage, key, draw) {
    var box = document.createElement("div"); box.setAttribute("aria-live", "polite"); stage.appendChild(box);
    box.innerHTML = "<p class=cap>calculando os valores deste passo…</p>";
    when(key, function (v) { if (document.body.contains(box)) { box.innerHTML = draw(v); box.setAttribute("data-ready", "1"); } });
  }
  function aviso(stage, t) { var p = document.createElement("p"); p.className = "aviso-fic"; p.textContent = t || "Valores sorteados, sem relação com os municípios reais."; stage.appendChild(p); }
  function cap(stage, t) { var p = document.createElement("p"); p.className = "cap"; p.textContent = t; stage.appendChild(p); }
  function pv(p) { return fmt(p, 3); }

  /* Cada passo guarda texto simples, o que o computador faz, a conta, a versão técnica, a pergunta de FAQ e o desenho. */
  var STEPS = [
    { t: "Ponto de partida: os indicadores", at: 0, key: "ind",
      kid: "Antes de qualquer mapa, é preciso medir. Para cada município, conta-se quantas crianças foram vacinadas e se terminaram o esquema. Depois, quantos municípios chegaram à meta de 95%. Os métodos seguintes partem desses números.",
      pc: "Calcula a cobertura e o abandono por município e conta quantos municípios atingiram 95%. O resultado é a homogeneidade.",
      conta: function (v) { return "<span class=eq>Homogeneidade = " + v.nAtinge + " ÷ " + v.n + " × 100 = <b>" + f1(v.homog) + "%</b></span><span class=eq>Faixa de sensibilidade: <b>" + f1(v.sensInf) + "%</b> a <b>" + f1(v.sensSup) + "%</b></span>"; },
      tech: "<p>Mesmos dez municípios inventados do método 1. A homogeneidade principal é bruta (sem teto). O limite inferior retira do cálculo os municípios com cobertura acima de 120%; o superior os conta como atingiram a meta.</p>",
      q: "Por que começar pelos indicadores?", a: "Porque todos os outros métodos usam cobertura e abandono como entrada. Se o dado de partida tiver problema de registro, o problema acompanha a cadeia inteira.",
      viz: function (stage) { pend(stage, "ind", function (v) { return tiles([tile("Atingiram 95%", v.nAtinge + " de " + v.n, "municípios do exemplo"), tile("Homogeneidade", f1(v.homog) + "%", "principal (bruta)"), tile("Limite inferior", f1(v.sensInf) + "%", "sem os acima de 120%"), tile("Limite superior", f1(v.sensSup) + "%", "acima de 120% contam como sim")]); }); cap(stage, "Dez municípios inventados (método 1)."); } },

    { t: "Tendência no tempo: Joinpoint", at: 1, key: "jp",
      kid: "Com a série do estado ano a ano, o Joinpoint procura os anos em que a linha mudou de direção e diz quanto variou por ano em cada trecho. Ele não mostra em que lugar do mapa a cobertura mudou.",
      pc: "Testa em sequência, com sorteios de resíduos, se vale a pena ter mais dobras (até 4) e calcula a variação percentual anual (APC) de cada trecho e a média do período (AAPC).",
      conta: function (v) { return "<span class=eq>Dobras escolhidas: <b>" + v.k + "</b> (anos " + v.taus.map(function (t, i) { return v.segs[i].ate; }).join(", ") + ")</span>" + v.segs.map(function (g) { return "<span class=eq>" + g.de + "–" + g.ate + ": APC = <b>" + sg(g.apc, 2) + "%</b> ao ano</span>"; }).join("") + "<span class=eq>AAPC (2000–2024) = <b>" + sg(v.aapc, 2) + "%</b> ao ano</span>"; },
      tech: "<p>Série fictícia de 25 pontos (método 2), máximo de 4 dobras, mínimo de 2 pontos nas pontas e entre dobras, 1.000 réplicas por teste e semente 2026. APC = (e<sup>b</sup> − 1) × 100. O AAPC é a média ponderada das inclinações no ln, não a média dos APCs. O último teste (3 contra 4 dobras) ficou perto do nível, então o número de dobras merece análise de sensibilidade.</p>",
      q: "Por que o AAPC é quase zero se há trechos fortes?", a: "Porque os trechos que sobem e os que descem se compensam na média do período. O AAPC resume, não substitui a leitura trecho a trecho.",
      viz: function (stage) { pend(stage, "jp", function (v) { return tiles([tile("Dobras", String(v.k), "anos " + v.segs.slice(0, -1).map(function (g) { return g.ate; }).join(", ")), tile("Maior queda", sg(Math.min.apply(null, v.apc), 2) + "%", "ao ano (APC)"), tile("Maior alta", sg(Math.max.apply(null, v.apc), 2) + "%", "ao ano (APC)"), tile("AAPC", sg(v.aapc, 2) + "%", "ao ano, 2000–2024")]); }); cap(stage, "Série fictícia do estado, 2000 a 2024 (método 2)."); } },

    { t: "Há padrão no mapa? I de Moran global", at: 2, key: "esp",
      kid: "Agora olhamos o mapa. Pergunta: municípios com cobertura parecida ficam perto uns dos outros? O I de Moran resume isso em um número. Perto do valor esperado ao acaso, não há padrão; acima dele, municípios parecidos tendem a ficar juntos.",
      pc: "Define quem é vizinho de quem (aqui, municípios que se tocam) e compara cada município com a média dos seus vizinhos. Sorteia 999 mapas embaralhados para ver se o valor observado seria comum ao acaso.",
      conta: function (v) { var m = v.moran; return "<span class=eq>I = <b>" + f4(m.I) + "</b></span><span class=eq>Esperado ao acaso: −1 ÷ (n − 1) = −1 ÷ " + (v.n - 1) + " = <b>" + f4(m.EI) + "</b></span><span class=eq>p = (R + 1) ÷ (M + 1) = (" + m.R + " + 1) ÷ (999 + 1) = <b>" + pv(m.p) + "</b></span>"; },
      tech: "<p>I = (n ÷ S<sub>0</sub>) · Σ<sub>i</sub> Σ<sub>j</sub> w<sub>ij</sub> z<sub>i</sub> z<sub>j</sub> ÷ Σ z<sub>i</sub>², com pesos padronizados por linha, vizinhança queen, 102 municípios, cobertura fictícia, 999 permutações e semente 2026. R é quantos sorteios deram I igual ou maior que o observado.</p>",
      q: "Um I de Moran alto prova que há aglomerado?", a: "Mostra que, no conjunto, vizinhos tendem a ser parecidos. Onde estão os aglomerados é pergunta do passo seguinte.",
      viz: function (stage) { pend(stage, "esp", function (v) { var m = v.moran; return tiles([tile("I de Moran", f4(m.I), "cobertura fictícia"), tile("Esperado ao acaso", f4(m.EI), "−1 ÷ (n − 1)"), tile("Pseudo-p", pv(m.p), "999 permutações"), tile("Vizinhança", "queen", "municípios que se tocam")]); }); aviso(stage); } },

    { t: "Onde? LISA", at: 3, key: "esp",
      kid: "O número único não diz onde. O LISA examina município por município: quem está cercado de parecidos (aglomerado) e quem destoa dos vizinhos. Como são 102 testes de uma vez, aplica-se uma correção para não marcar município demais.",
      pc: "Calcula um I local para cada município, sorteia 999 vezes os vizinhos, aplica a correção por FDR e agrupa os significativos em quatro tipos.",
      conta: function (v) { var l = v.lisa; return "<span class=eq>Significativos (FDR, 5%): <b>" + l.total + "</b> de " + v.n + "</span><span class=eq>Alto-alto: <b>" + l.hh + "</b> | Baixo-baixo: <b>" + l.ll + "</b> | Baixo-alto: <b>" + l.lh + "</b> | Alto-baixo: <b>" + l.hl + "</b></span><span class=eq>Sem significância: <b>" + (v.n - l.total) + "</b></span>"; },
      tech: "<p>I<sub>i</sub> = z<sub>i</sub> · Σ<sub>j</sub> w<sub>ij</sub> z<sub>j</sub> ÷ (Σ z² ÷ n). Permutação condicional (z<sub>i</sub> fixo, demais permutados), 999 sorteios, semente 2026. O FDR compara o p ordenado com i · α ÷ n. A correção usada aqui é só ilustrativa: o projeto ainda vai escolher.</p>",
      q: "O aglomerado inteiro é significativo?", a: "Não: o teste é do município central. Os vizinhos ao redor dele aparecem coloridos porque também passaram no teste, não porque o grupo foi testado como um todo.",
      viz: function (stage) { pend(stage, "esp", function (v) { var l = v.lisa; return tiles([tile("Significativos", l.total + " de " + v.n, "FDR 5%"), tile("Alto-alto", String(l.hh), "cobertura alta entre altos"), tile("Baixo-baixo", String(l.ll), "cobertura baixa entre baixos"), tile("Fora da curva", String(l.lh + l.hl), l.lh + " baixo-alto e " + l.hl + " alto-baixo")]); }); aviso(stage); } },

    { t: "Grupo de risco: SaTScan", at: 4, key: "esp",
      kid: "O SaTScan faz outra pergunta: existe um grupo de municípios vizinhos, dentro de um círculo, com mais crianças sem vacina do que seria esperado? Ele escolhe o círculo mais forte e dá um p por sorteios.",
      pc: "Centra um círculo em cada município e aumenta o raio até incluir 50% da população. Compara casos dentro e fora de cada círculo e guarda o de maior razão de verossimilhança (LLR).",
      conta: function (v) { var s = v.scan; return "<span class=eq>Aglomerado mais provável: <b>" + s.k + "</b> municípios</span><span class=eq>Casos observados: <b>" + f0(s.c) + "</b> | esperados: <b>" + fmt(s.E, 1) + "</b></span><span class=eq>Risco relativo = <b>" + f2(s.rr) + "</b> | LLR = <b>" + fmt(s.llr, 1) + "</b></span><span class=eq>p = (R + 1) ÷ (M + 1) = (" + s.R + " + 1) ÷ (999 + 1) = <b>" + pv(s.p) + "</b></span>"; },
      tech: "<p>Modelo de Poisson, alto risco, puramente espacial, tamanho máximo de 50% da população, 999 réplicas de Monte Carlo, semente 2026. Casos = crianças não vacinadas fictícias, arredondamento de nascidos × (1 − cobertura limitada a 100%). O p já considera as muitas janelas testadas. Modelo e tamanho máximo ainda são escolhas em aberto no projeto.</p>",
      q: "O SaTScan e o LISA deveriam apontar os mesmos lugares?", a: "Não necessariamente. O LISA compara cada município com os vizinhos; o SaTScan compara um círculo inteiro com o resto do estado. Perguntas diferentes podem dar mapas diferentes.",
      viz: function (stage) { pend(stage, "esp", function (v) { var s = v.scan; return tiles([tile("Aglomerado", s.k + " municípios", "o mais provável"), tile("Risco relativo", f2(s.rr), "dentro ÷ fora"), tile("LLR", fmt(s.llr, 1), "razão de verossimilhança"), tile("Pseudo-p", pv(s.p), "999 réplicas")]); }); aviso(stage); } },

    { t: "Fatores associados: VIF, OLS e GWR", at: 5, key: "esp",
      kid: "Por fim, pergunta-se que fatores andam junto com a cobertura (no exemplo, IDHM, analfabetismo e cobertura da ESF) e se isso muda de lugar para lugar. O VIF checa se as explicativas se repetem, o OLS dá uma resposta para o estado todo e o GWR dá uma por lugar. É associação, não causa.",
      pc: "Calcula o VIF de cada explicativa, ajusta o OLS e testa se os resíduos têm padrão no mapa. Depois ajusta um modelo local por município, com os vizinhos mais próximos pesando mais (quantos, é escolhido pelo AICc).",
      conta: function (v) { var r = v.reg; return "<span class=eq>Maior VIF = <b>" + f2(r.vifMax) + "</b></span><span class=eq>R² do OLS = <b>" + f3(r.olsR2) + "</b> | R² do GWR = <b>" + f3(r.gwR2) + "</b></span><span class=eq>AICc do OLS = <b>" + fmt(r.olsAicc, 1) + "</b> | AICc do GWR = <b>" + fmt(r.gwAicc, 1) + "</b> (banda de " + r.kb + " vizinhos)</span><span class=eq>I de Moran dos resíduos do OLS = <b>" + f3(r.residI) + "</b> (p = " + pv(r.residP) + ")</span>"; },
      tech: "<p>VIF<sub>k</sub> = 1 ÷ (1 − R²<sub>k</sub>). GWR com kernel bisquare adaptativo (k vizinhos mais próximos), banda por AICc; 102 municípios, modelo de 3 explicativas padronizadas. R² maior no GWR vem com mais parâmetros efetivos; por isso se compara também o AICc, que penaliza essa flexibilidade. Resposta limitada a 0–100% e cobertura acima de 100% seguem como limitação aberta.</p>",
      q: "Por que o R² do GWR é tão maior que o do OLS?", a: "Porque o GWR ajusta um modelo por lugar e tem muito mais parâmetros efetivos. Por isso olha-se o AICc, e mesmo assim o resultado é exploratório, com 102 municípios.",
      viz: function (stage) { pend(stage, "esp", function (v) { var r = v.reg; return tiles([tile("Maior VIF", f2(r.vifMax), "explicativas pouco repetidas"), tile("R² OLS", f3(r.olsR2), "AICc " + fmt(r.olsAicc, 1)), tile("R² GWR", f3(r.gwR2), "AICc " + fmt(r.gwAicc, 1)), tile("Resíduos do OLS", "I = " + f3(r.residI), "p = " + pv(r.residP))]); }); aviso(stage); } }
  ];

  var ARW = { prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' };
  function renderPassos(root, app, state) {
    var N = STEPS.length, idx = Math.max(0, Math.min(N - 1, (state.step || 1) - 1)), st = STEPS[idx];
    clock.clear(); root.innerHTML = "";
    var intro = document.createElement("section"); intro.className = "chain-wrap"; root.appendChild(intro);
    intro.innerHTML = "<h2>A cadeia do projeto</h2><p>Cada método responde a uma pergunta e deixa outras sem resposta. Toque em uma caixa para abrir a página do método. A caixa em destaque é a do passo da simulação abaixo.</p>";
    var box = document.createElement("div"); box.className = "chain-box"; intro.appendChild(box); diagrama(box, st.at, app); chips(intro, app);
    var sim = document.createElement("h2"); sim.textContent = "Simulação: percorrendo a cadeia"; sim.style.marginTop = "18px"; root.appendChild(sim);
    var head = document.createElement("div"); head.className = "stephead";
    var back = document.createElement("button"); back.className = "arrow"; back.innerHTML = ARW.prev; back.setAttribute("aria-label", "Passo anterior"); back.title = "Passo anterior"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "arrow"; nxt.innerHTML = ARW.next; nxt.setAttribute("aria-label", "Próximo passo"); nxt.title = "Próximo passo"; nxt.disabled = idx === N - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    var no = document.createElement("p"); no.className = "stepno"; no.textContent = "Passo " + (idx + 1) + " de " + N;
    head.appendChild(back); head.appendChild(no); head.appendChild(nxt); root.appendChild(head);
    var pr = document.createElement("div"); pr.className = "progress"; pr.setAttribute("role", "progressbar"); pr.setAttribute("aria-valuemin", "1"); pr.setAttribute("aria-valuemax", String(N)); pr.setAttribute("aria-valuenow", String(idx + 1)); pr.innerHTML = '<i style="width:' + ((idx + 1) / N * 100) + '%"></i>'; root.appendChild(pr);
    var h2 = document.createElement("h2"); h2.id = "step-h"; h2.tabIndex = -1; h2.textContent = (idx + 1) + ". " + st.t; root.appendChild(h2);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var body = document.createElement("div"); root.appendChild(body);
    body.innerHTML =
      "<div class='callout kid'><b>Explicação simplificada</b>" + st.kid + "</div>" +
      "<div class=card><span class=lbl>O que o computador faz</span><p>" + st.pc + "</p></div>" +
      "<div class='card conta'><span class=lbl>Conta na tela</span><div data-live='conta'><p>calculando…</p></div></div>" +
      "<details class=tech" + (app.tech() ? " open" : "") + "><summary>Ver a versão técnica</summary>" + st.tech + "</details>";
    st.viz(stage);
    when(st.key, function (v) { var c = body.querySelector("[data-live=conta]"); if (c && document.body.contains(c)) c.innerHTML = st.conta(v); });
    var h = root.querySelector("#step-h"); if (state.focus && h) h.focus({ preventScroll: false });
  }

  /* ---------- seções de Saiba mais ---------- */
  function tabContexto() {
    return "<div class=card><h2>Qual pergunta este método responde?</h2><p>Como os métodos do projeto se ligam? Cada um responde a uma pergunta diferente, na ordem em que o raciocínio avança: medir, olhar no tempo, olhar no mapa, localizar, procurar grupos de risco e, por fim, examinar fatores associados.</p><p>Esta página não calcula nada novo. Ela reúne os números fictícios dos métodos 1 a 7 para mostrar como a saída de um passo alimenta a pergunta do seguinte, sem prometer causalidade em nenhum deles.</p><ul><li>Indicadores entregam cobertura, abandono e homogeneidade.</li><li>O Joinpoint lê a série do estado ao longo dos anos.</li><li>O I de Moran global (e a AEDE, que prepara a vizinhança) diz se há padrão espacial no conjunto.</li><li>O LISA localiza municípios dentro do padrão e fora dele.</li><li>O SaTScan procura um grupo de municípios com risco maior que o de fora.</li><li>O VIF, o OLS e o GWR examinam fatores que andam junto com a cobertura.</li></ul></div>";
  }
  function tabDados() {
    var r = [["Indicadores", "10 municípios inventados (nascidos, 1ª e 3ª dose)", "Método 1"], ["Joinpoint", "Série fictícia do estado, 25 anos (2000–2024)", "Método 2"], ["Moran global e LISA", "Cobertura fictícia dos 102 municípios; vizinhança queen", "Métodos 3 a 5"], ["SaTScan", "Nascidos e crianças não vacinadas fictícios dos 102 municípios", "Método 6"], ["VIF, OLS e GWR", "Cobertura e três explicativas fictícias (IDHM, analfabetismo, ESF)", "Método 7"]];
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Etapa</th><th>Dados usados</th><th>Origem</th></tr>" + r.map(function (x) { return "<tr><td>" + x[0] + "</td><td>" + x[1] + "</td><td>" + x[2] + "</td></tr>"; }).join("") + "</table></div><p>Só o desenho dos municípios é real (malha do IBGE). Os valores foram sorteados com semente fixa e não têm relação com os municípios reais.</p></div>";
  }
  function tabResultado() {
    var rows = [
      ["Quanto se vacinou e quantos municípios chegaram à meta?", "Indicadores", "Cobertura, abandono, homogeneidade e bandeiras de qualidade", "Numerador e denominador de fontes diferentes; cobertura acima de 100% é sinal de dado, não de excesso de vacinação"],
      ["A cobertura mudou de direção ao longo dos anos?", "Joinpoint", "Anos de dobra, APC por trecho e AAPC", "Número de dobras depende das configurações; o AAPC pode ficar perto de zero com trechos opostos; nada diz sobre o mapa"],
      ["Municípios parecidos ficam perto uns dos outros?", "AEDE e I de Moran global", "I de Moran e pseudo-p", "Depende da matriz de vizinhança; um número só para o estado; não localiza"],
      ["Quais municípios formam aglomerados ou destoam?", "LISA", "Mapa de quadrantes com significância", "102 testes não independentes exigem correção; taxas de municípios pequenos são instáveis; testa o município, não o grupo"],
      ["Há um grupo de municípios com risco maior que o de fora?", "SaTScan", "Aglomerado mais provável, risco relativo, p por Monte Carlo, secundários", "Círculo não segue os contornos; modelo e tamanho máximo fixados antes; tendência não ajustada pode virar aglomerado"],
      ["Que fatores andam junto com a cobertura, e isso varia no espaço?", "VIF, OLS e GWR", "VIF, coeficientes do OLS, coeficientes locais, R² e AICc", "102 municípios é pouco; muitos testes; cobertura acima de 100% e resposta limitada em aberto; associação, não causa"]];
    return "<div class=card><h2>Resultado e como ler</h2><p>Quatro colunas por método: a pergunta, o método, o que ele entrega e o que limita a leitura.</p><div class=tbl-wrap><table><tr><th>Pergunta</th><th>Método</th><th>Saída</th><th>Limite</th></tr>" + rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div><ul><li><b>Pode concluir:</b> o que cada saída mostra, dentro da sua pergunta e das suas escolhas.</li><li><b>Não pode concluir:</b> que um método confirma o outro, nem que a associação encontrada é causa.</li></ul></div>";
  }
  function tabLimites() {
    var L = ["Os métodos respondem perguntas diferentes: um resultado não confirma nem desmente o outro.", "Todos partem do mesmo dado de cobertura: erro de registro ou de denominador atravessa a cadeia inteira.", "Os testes espaciais usam sorteios; com outra semente ou outro número de sorteios o p muda um pouco.", "Mudar a vizinhança, o tamanho máximo do círculo ou a correção de testes pode mudar os mapas; por isso mostra-se sensibilidade.", "O GWR e a regressão com 102 municípios são exploratórios.", "Todas as análises são ecológicas (por município): falam de municípios, não de pessoas, e não provam causa."];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + L.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var fechadas = ["Cobertura sem teto na base, com bandeiras para acima de 100%, 110% e 120% e abaixo de 50%; teto de 100% só em mapas e médias, com o valor bruto na legenda.", "Análise principal bruta, com sensibilidade; denominador abaixo de 1.000 como bandeira."];
    var abertas = [["Matriz de vizinhança (W)", "queen, rook, k vizinhos mais próximos ou banda de distância; a escolha muda Moran, LISA e resíduos do OLS."], ["Número de permutações", "999 ou 9999; a correção de Bonferroni com 102 testes exige muitas permutações."], ["Correção de múltiplos testes", "sem correção, FDR ou Bonferroni, no LISA e nos coeficientes locais do GWR."], ["Modelo do SaTScan", "Poisson ou outro modelo, e o tamanho máximo do círculo (por exemplo 50%, 25% ou 10% da população), fixado antes de ver os resultados."], ["Cobertura acima de 100% e resposta limitada", "como entra no scan e no GWR, já que a cobertura é uma proporção e passa de 100% em alguns municípios."], ["Ajuste de tendência", "como tratar a tendência no tempo para que ela não apareça como aglomerado."]];
    return "<div class=card><h2>O que o projeto já definiu</h2><ul>" + fechadas.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>O que o projeto ainda vai decidir</h2><p>Estas escolhas continuam em aberto. A simulação usa valores de exemplo só para ilustrar.</p><div class=tbl-wrap><table><tr><th>Escolha</th><th>Alternativas e por que importa</th></tr>" + abertas.map(function (x) { return "<tr><td>" + x[0] + "</td><td>" + x[1] + "</td></tr>"; }).join("") + "</table></div></div>";
  }
  function tabFontes() {
    var r = (NS.refs && NS.refs.encaixe) || [];
    return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>O que passa de uma etapa para a seguinte:</p><ol><li>Tabela de doses e nascidos por município e ano (entrada dos indicadores).</li><li>Série anual do estado para o Joinpoint, rodado no programa do National Cancer Institute.</li><li>Cobertura e abandono por município, mais a malha municipal do IBGE, para a vizinhança, o I de Moran e o LISA.</li><li>Casos, população e coordenadas dos municípios para o SaTScan.</li><li>Cobertura e variáveis explicativas por município para o VIF, o OLS e o GWR.</li></ol><p>Cada método tem a própria seção com o código de exemplo. A conferência numérica desta página está em <code>tests/check_encaixe.py</code>, que compara os valores exibidos com os dos testes dos métodos 1 a 7.</p></div>";
  }
  function tabFaq() {
    var extra = [["Preciso seguir esta ordem?", "A ordem mostra o raciocínio do projeto: da medida ao mapa, do mapa ao grupo de risco e deste aos fatores. Cada método responde a sua pergunta por conta própria."], ["Os números desta página são resultados da pesquisa?", "Não. São dados fictícios e fixos, sorteados com semente. Só o desenho dos municípios é real."], ["Posso dizer que o IDHM ou a escolaridade causam a cobertura?", "Não. O que se estima é associação entre municípios. Causa exigiria outro desenho de estudo."], ["O que muda se a matriz de vizinhança mudar?", "Muda o I de Moran, o LISA e a autocorrelação dos resíduos. Por isso o projeto prevê mostrar a sensibilidade a essa escolha."]];
    var all = STEPS.map(function (x) { return [x.q, x.a]; }).concat(extra);
    return "<div class=card>" + all.map(function (x) { return "<h3>" + x[0] + "</h3><p>" + x[1] + "</p>"; }).join("") + "</div>";
  }

  NS.methods.encaixe = {
    id: "encaixe", n: 8, nome: "Como se encaixam", ready: true, steps: STEPS.length,
    tabs: [["passos", "Passo a passo"], ["contexto", "Contexto"], ["dados", "Dados e variáveis"], ["resultado", "Resultado e como ler"], ["limites", "Limitações e cuidados"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
    }
  };
})();
