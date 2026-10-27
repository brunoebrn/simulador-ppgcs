/* Método 2: Regressão Joinpoint. Todas as afirmações vêm do fichamento S5ab (número da afirmação entre parênteses).
   Todos os números exibidos são calculados em js/stats.js. Dados 100% fictícios (js/data.js). */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var ST = NS.stats, D = NS.data, C = NS.charts, clock = NS.clock, fmt = C.fmt, sg = C.signed, el = C.el;
  var OPTS = { fim: 2, entre: 2 }, SEED = 2026, NPERM = 1000;

  /* ---------- selos de status ---------- */
  function seal(s) {
    var m = { "LIDO": ["ok", "LIDO"], "LIDO-WebFetch": ["ok", "LIDO-WebFetch"], "SECUNDÁRIO": ["", "SECUNDÁRIO · a confirmar"], "NÃO LOCALIZADO": ["", "NÃO LOCALIZADO · a confirmar"],
      "CALCULADO": ["", "cálculo próprio · a conferir no software"], "NÃO VERIFICADO": ["", "não verificado · a confirmar"] }[s] || ["", s];
    return '<span class="seal ' + m[0] + '">' + m[1] + "</span>";
  }
  function src(list) { return '<p class="srcline"><b>Fonte:</b> ' + list.map(function (x) { return "S5ab " + x[0] + " " + seal(x[1]); }).join(" ") + "</p>"; }

  /* ---------- estado por conjunto de dados ---------- */
  var cache = {}, token = 0;
  function prep(key) {
    if (cache[key]) return cache[key];
    var ser = key === "5" ? D.serie5 : D.serie25, y = Float64Array.from(ser.cob.map(function (v) { return Math.log(v / 100); }));
    var S = { key: key, ser: ser, n: y.length, y: y, kMax: key === "5" ? 1 : 4, listeners: [] };
    S.f0 = ST.bestFit(y, 0, OPTS); S.fA = ST.bestFit(y, S.kMax, OPTS); S.f1 = ST.bestFit(y, 1, OPTS);
    S.T = S.f0.sse / S.fA.sse;
    S.yr = key === "5" ? [30, 100, 10] : [65, 100, 5];
    S.seq = { tests: [], done: false, cur: null };
    cache[key] = S; startSeq(S); return S;
  }
  function startSeq(S) {
    var ka = 0, kb = S.kMax, idx = 0, myTok = ++token; S.tok = myTok;
    function emit() { S.listeners.forEach(function (fn) { fn(); }); }
    function next() {
      if (S.tok !== myTok) return;
      if (ka >= kb) { S.k = ka; S.fit = ST.bestFit(S.y, ka, OPTS); S.sum = ST.summarize(S.ser.cob, S.ser.anos, S.fit); S.seq.done = true; emit(); return; }
      var pt = new ST.PermTest(S.y, ka, kb, { seed: SEED + idx, fim: OPTS.fim, entre: OPTS.entre }); S.seq.cur = { ka: ka, kb: kb, done: 0 };
      (function chunk() {
        if (S.tok !== myTok) return;
        pt.run(Math.min(100, NPERM - pt.Ts.length)); S.seq.cur.done = pt.Ts.length; emit();
        if (pt.Ts.length < NPERM) { setTimeout(chunk, 0); return; }
        var lvl = ST.levelPerTest(0.05, S.kMax, ka), p = pt.pValue(), rej = p < lvl;
        S.seq.tests.push({ ka: ka, kb: kb, T: pt.T, sseN: pt.fa.sse, sseA: pt.fb.sse, p: p, exceed: pt.exceed, level: lvl, reject: rej });
        if (rej) ka++; else kb--; idx++; S.seq.cur = null; setTimeout(next, 0);
      })();
    }
    setTimeout(next, 0);
  }
  function pctFit(S, fitted) { return Array.prototype.map.call(fitted, function (v) { return 100 * Math.exp(v); }); }
  function baseChart(stage, S, label) {
    var ch = new C.Chart(stage, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", label: label, h: 300 });
    return ch;
  }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function f2(x) { return fmt(x, 2); } function f4(x) { return fmt(x, 4); }
  function segTxt(g) { return g.de + "–" + g.ate; }

  /* ---------- passos ---------- */
  var STEPS = [
    { t: "A série: os degraus", // 1
      kid: "Cada ano é um degrau de uma escada. A altura do degrau é quantas crianças receberam a vacina em cada 100. Queremos saber se a escada sobe, desce ou muda de direção.",
      pc: function (S) { return "Lê " + S.n + " anos de cobertura e guarda cada um como um ponto: o ano na horizontal, a cobertura na vertical."; },
      conta: function (S) { return "<table><tr><th>Ano</th>" + S.ser.anos.map(function (a) { return "<th class=num>" + a + "</th>"; }).join("") + "</tr><tr><th>Cobertura (%)</th>" + S.ser.cob.map(function (c) { return "<td class=num>" + c + "</td>"; }).join("") + "</tr></table>"; },
      tech: function (S) { return "<p>Série anual y<sub>t</sub>, t = 1…" + S.n + ". O Joinpoint ajusta um modelo de segmentos de reta unidos (contínuo) nos pontos de mudança (S5ab 5, 6). Aqui os dados são fictícios e fixos.</p>" + (S.key === "5" ? "<p><b>Por que 5 pontos?</b> Só para ver o mecanismo. O manual diz que “pelo menos sete pontos de dados” devem existir para considerar permitir um joinpoint (S5ab 45) e, na tabela do máximo padrão, 0 a 6 pontos dá 0 joinpoints (S5ab 46). A fórmula de observações mínimas, com as restrições padrão de 2 e 2, dá 5 para 1 joinpoint (S5ab 48; conta minha: 2·2 + 0·2 + 1 = 5, " + "a conferir no software). Ou seja, o programa só aceitaria 1 dobra em 5 pontos se o analista pedir esse máximo à mão, contra a recomendação do manual.</p>" : "<p>Série de 25 pontos (2000–2024), o tamanho do nosso projeto. Para 22–26 pontos o máximo padrão de joinpoints é 4 (S5ab 46).</p>"); },
      fala: "Esta série é inteiramente fictícia. Ela serve para mostrar o mecanismo do método, não para dizer nada sobre Alagoas.",
      q: "Por que usar só 5 pontos no exemplo?", a: "Porque a conta cabe na tela. O próprio manual desaconselha dobras com menos de 7 pontos; no projeto real a série tem 25 pontos.",
      src: [["45–46", "LIDO"], ["48", "LIDO"]],
      viz: function (st, S) { var ch = baseChart(st, S, "Cobertura por ano (fictícia)"), g = ch.g, pts = [], line;
        ch.points(S.ser.cob, "pt", 6, g).forEach(function (p) { p.style.opacity = 0; pts.push(p); });
        clock.tween(Math.max(1.5, S.n * .2), function (p) { var k = Math.floor(p * S.n + 1e-9); pts.forEach(function (c, i) { c.style.opacity = i < k ? 1 : 0; }); if (p >= 1) { if (!line) line = ch.line(S.ser.cob, "l-data", g); pts.forEach(function (c) { c.style.opacity = 1; g.appendChild(c); }); } });
        cap(st, "Dados fictícios: " + S.ser.anos[0] + " a " + S.ser.anos[S.n - 1] + "."); } },

    { t: "Trocar a escala: usar o ln", // 2
      kid: "Se a vacinação cai 10% por ano, cada ano cai 10% do que sobrou, e não o mesmo tanto de pontos. Isso é como juros ao contrário. O ln é uma lente que transforma esse “10% do que sobrou” em passos iguais, e aí uma régua reta consegue descrever.",
      limite: "Limite da analogia: uma reta no ln quer dizer variação percentual constante. Não quer dizer perda constante em pontos percentuais.",
      pc: function () { return "Divide a cobertura por 100 (vira proporção) e aplica o logaritmo natural, ln, em cada ano."; },
      conta: function (S) { var r = S.ser.cob.slice(0, Math.min(S.n, 5)).map(function (c, i) { return "<span class=eq>" + S.ser.anos[i] + ": ln(" + fmt(c / 100, 2) + ") = " + f4(Math.log(c / 100)) + "</span>"; }).join(""); return r + (S.n > 5 ? "<span class=eq>… (as demais " + (S.n - 5) + " seguem o mesmo cálculo)</span>" : ""); },
      tech: function () { return "<p>Modelo log-linear: ln(y) = b₀ + b₁·x + e (S5ab 1). Dentro de cada segmento, ln da taxa é linear no tempo (S5ab 2) e APC = (e<sup>b₁</sup> − 1) × 100 (S5ab 3), o que pressupõe variação percentual constante no segmento (S5ab 4). Percentuais devem ser transformados em proporções antes da análise (S5ab 9).</p><p>Escolha entre linear e log-linear: o manual manda escolher o modelo cuja análise de resíduos indique melhor ajuste (S5ab 8). Com cobertura perto do teto de 100%, isso precisa ser verificado nos resíduos (S5ab, seção 4, item 7).</p>"; },
      fala: "Trabalhamos em ln porque o indicador do método, o APC, é um percentual por ano. Em ln, mudança percentual constante vira inclinação constante.",
      q: "Por que não ajustar a cobertura direto, sem ln?", a: "Seria um modelo linear em pontos percentuais. O manual aceita os dois e manda escolher pela análise de resíduos; o APC percentual vem do modelo log-linear. A escolha para a série real fica pendente.",
      src: [["1–4", "LIDO"], ["8–9", "LIDO"]],
      viz: function (st, S) { var a = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0] / 100, ymax: 1, ystep: S.key === "5" ? .1 : .05, yfmt: function (v) { return fmt(v, 2); }, ylabel: "proporção", h: 190, label: "Proporção por ano" });
        var lo = Math.log(S.yr[0] / 100), b = new C.Chart(st, { xs: S.ser.anos, ymin: lo, ymax: 0, ystep: S.key === "5" ? .2 : .05, yfmt: function (v) { return fmt(v, 2); }, ylabel: "ln(proporção)", h: 190, label: "ln da proporção por ano" });
        a.points(S.ser.cob.map(function (c) { return c; }).map(function (c) { return c; }), "pt", 0, a.g);
        a.g.textContent = ""; a.setY(S.yr[0] / 100, 1); var pa = a.points(S.ser.cob.map(function (c) { return c / 100; }), "pt", 5, a.g), pb = b.points(S.y, "pt", 5, b.g);
        pb.forEach(function (p) { p.style.opacity = 0; });
        clock.tween(Math.max(1.5, S.n * .2), function (p) { var k = Math.floor(p * S.n + 1e-9); pb.forEach(function (c, i) { c.style.opacity = i < k || p >= 1 ? 1 : 0; }); });
        cap(st, "Em cima: proporção. Embaixo: ln da proporção, que é a escala em que o Joinpoint ajusta as retas."); } },

    { t: "Uma régua só", // 3
      kid: "Primeiro tentamos descrever tudo com uma régua esticada no meio dos degraus. Os risquinhos vermelhos mostram o quanto cada degrau fica longe da régua: é o “erro” de cada ano.",
      pc: function () { return "Acha a reta que deixa os erros menores no total (mínimos quadrados) e soma o quadrado de todos os erros. Essa soma se chama SSE."; },
      conta: function (S) { var b = S.f0.beta; return "<span class=eq>Reta no ln: ln(y) = " + f4(b[0]) + " + (" + f4(b[1]) + ")·x</span><span class=eq>Soma dos quadrados dos erros da régua única: <b>SSE_N = " + f4(S.f0.sse) + "</b></span><span class=eq>Variação percentual anual desta reta única: (e^" + f4(b[1]) + " − 1)·100 = " + sg((Math.exp(b[1]) - 1) * 100, 2) + "%</span>"; },
      tech: function () { return "<p>É o modelo nulo da primeira comparação: k = 0 joinpoints, sem dobra. O ajuste é por mínimos quadrados ordinários, que supõe erros não correlacionados com variância constante (S5ab 14). O SSE mínimo para k joinpoints vem do grid search de Lerman (S5ab 10); para k = 0 é simplesmente a reta de mínimos quadrados.</p>"; },
      fala: "Este é o modelo mais simples: uma tendência única. Tudo que vem depois pergunta se vale a pena complicar.",
      q: "O que é SSE?", a: "A soma dos quadrados das distâncias entre cada ponto e a linha do modelo, na escala ln. Quanto menor, melhor o ajuste.",
      src: [["10", "LIDO"], ["14", "LIDO"]],
      viz: function (st, S) { var ch = baseChart(st, S, "Uma reta única"), g = ch.g, fit = pctFit(S, S.f0.fitted);
        ch.line(fit, "l-null", g); var res = S.ser.cob.map(function (c, i) { return el("line", { x1: ch.x(i), x2: ch.x(i), y1: ch.y(c), y2: ch.y(c), "class": "res" }, g); });
        ch.line(S.ser.cob, "l-data", g); ch.points(S.ser.cob, "pt", 5, g);
        clock.tween(Math.max(1.5, S.n * .25), function (p) { res.forEach(function (r, i) { var q = Math.max(0, Math.min(1, p * S.n - i)); r.setAttribute("y2", ch.y(S.ser.cob[i] + (fit[i] - S.ser.cob[i]) * q)); }); });
        cap(st, "Linha tracejada: reta única. Risquinhos vermelhos: erro de cada ano."); } },

    { t: "O pino de dobra", // 4
      kid: "Agora deixamos a régua dobrar em um pino. As duas metades têm que se encontrar no pino (a linha não pode quebrar). O computador testa o pino em cada ano possível e fica com o pino que deixa os erros menores.",
      limite: "Limite da analogia: o pino só pode ficar em um ano da série (por padrão), e não pode ficar perto demais das pontas.",
      pc: function (S) { var m = ST.enumerateTaus(S.n, 1, 2, 2).length; return "Testa " + m + " posição(ões) possível(is) para o pino, calcula o SSE de cada uma e escolhe a de menor SSE (busca em grade). " + (S.key === "5" ? "Com 5 pontos, a restrição de 2 pontos nas pontas deixa só 1 posição: 2022." : "Aqui mostramos uma dobra só; o programa repete isso para 2, 3 e 4 dobras."); },
      conta: function (S) { var c = ST.bestFit(S.y, 1, Object.assign({ collect: true }, OPTS)); return "<span class=eq>Posições testadas: " + c.nConfigs + "</span><span class=eq>Melhor pino: <b>" + S.ser.anos[c.taus[0]] + "</b> com SSE = " + f4(c.sse) + " (contra " + f4(S.f0.sse) + " da régua única)</span>"; },
      tech: function () { return "<p>Modelo: E[y|x] = β₀ + β₁x + δ₁(x − τ₁)₊, contínuo em τ₁ (S5ab 5, 6). Grid search de Lerman: cria uma grade de todas as posições permitidas e calcula o SSE em cada uma (S5ab 10, 13). Por padrão, joinpoints só em observações (S5ab 11); não pode haver joinpoint a menos de 2 pontos das pontas, e deve haver pelo menos 2 pontos entre dois joinpoints (S5ab 44).</p><p>Inconsistência interna do manual, documentada e não harmonizada: a página diz “Max = 7” e também “máximo de 9” para o grid search (S5ab 47).</p>"; },
      fala: "O computador não adivinha o ano da mudança: ele testa todos os anos permitidos e escolhe o que melhor encaixa. Por padrão a dobra só cai em ano observado.",
      q: "O Joinpoint prova que algo mudou naquele ano?", a: "Não. Ele escolhe o ano que melhor encaixa. Se a mudança é real, quem decide é o teste da próxima etapa, e a causa ele não explica.",
      src: [["5–6", "LIDO"], ["10–13", "LIDO"], ["44", "LIDO"], ["47", "LIDO"]],
      viz: function (st, S) { var ch = baseChart(st, S, "Teste de cada posição do pino"), g = ch.g, all = ST.bestFit(S.y, 1, Object.assign({ collect: true }, OPTS)).all, m = all.length;
        ch.points(S.ser.cob, "pt", 4, g); var cand = el("path", { "class": "l-alt", d: "" }, g), mark = el("circle", { r: 8, "class": "pt-break", cx: -20, cy: -20 }, g);
        var W4 = C.width(st), bars = el("svg", { viewBox: "0 0 " + W4 + " 110", role: "img", "aria-label": "SSE de cada posição" }, st), mx = Math.max.apply(null, all.map(function (a) { return a.sse; })), bw = (W4 - 40) / m;
        var br = all.map(function (a, i) { return el("rect", { x: 20 + i * bw + 1, y: 90, width: Math.max(2, bw - 3), height: 0, "class": "bar" }, bars); });
        el("text", { x: 20, y: 12, "font-size": 12, "class": "muted" }, bars, "SSE de cada posição do pino (barra mais baixa = melhor)");
        var best = all.reduce(function (b, a, i) { return a.sse < all[b].sse ? i : b; }, 0), lab = el("text", { x: W4 / 2, y: 107, "text-anchor": "middle", "font-size": 12 }, bars, "");
        function draw(i) { var f = ST.fitAt(S.y, all[i].taus), v = pctFit(S, f.fitted); cand.setAttribute("d", v.map(function (q, j) { return (j ? "L" : "M") + ch.x(j).toFixed(1) + " " + ch.y(q).toFixed(1); }).join(" ")); mark.setAttribute("cx", ch.x(all[i].taus[0])); mark.setAttribute("cy", ch.y(v[all[i].taus[0]])); lab.textContent = "testando o pino em " + S.ser.anos[all[i].taus[0]] + ": SSE = " + f4(all[i].sse); }
        clock.tween(Math.max(2, m * .45), function (p) { var k = Math.min(m - 1, Math.floor(p * m)); draw(p >= 1 ? best : k); br.forEach(function (r, i) { var upto = p >= 1 ? m : k + 1; if (i < upto) { var h = 70 * all[i].sse / mx; r.setAttribute("height", h); r.setAttribute("y", 90 - h); r.setAttribute("class", p >= 1 && i === best ? "bar-hit" : "bar"); } }); if (p >= 1) lab.textContent = "melhor pino: " + S.ser.anos[all[best].taus[0]] + " (SSE = " + f4(all[best].sse) + ")"; });
        cap(st, "Linha vermelha: régua dobrada no pino em teste. Círculo âmbar: o pino. Barras vermelhas = melhor posição."); } },

    { t: "A dobra melhora tanto assim? A razão T", // 5
      kid: "Comparamos os erros da régua única com os erros da régua com pino(s). Se os erros encolhem muito, a razão fica grande: o pino ajudou. Se a razão fica perto de 1, o pino quase não ajudou.",
      pc: function (S) { return "Divide o SSE do modelo simples (nulo, " + S.seq0ka + " dobras) pelo SSE do modelo complexo (alternativo, " + S.kMax + " dobra" + (S.kMax > 1 ? "s" : "") + ")."; },
      conta: function (S) { return "<span class=eq>SSE_N (0 dobras) = " + f4(S.f0.sse) + "</span><span class=eq>SSE_A (" + S.kMax + " dobra" + (S.kMax > 1 ? "s" : "") + ") = " + f4(S.fA.sse) + "</span><span class=eq><b>T = SSE_N / SSE_A = " + f2(S.T) + "</b></span>"; },
      tech: function () { return "<p>Estatística do teste: T = SSE_N / SSE_A (S5ab 18). Valores de T próximos de 1 indicam que o alternativo não é muito melhor que o nulo; valores maiores indicam que é muito melhor (S5ab 19). A distribuição de T não é obtida analiticamente, por isso se usa a permutação (S5ab 21).</p>"; },
      fala: "T mede o ganho de ajuste ao complicar o modelo. Sozinho, T não diz se o ganho é grande demais para ser acaso: isso é papel do passo seguinte.",
      q: "T grande já prova que a dobra existe?", a: "Não. Precisa comparar com o que T faria se a dobra não existisse (o liquidificador do próximo passo).",
      src: [["18–19", "LIDO"], ["21", "LIDO"]],
      viz: function (st, S) { var W5 = C.width(st), s = el("svg", { viewBox: "0 0 " + W5 + " 150", role: "img", "aria-label": "Comparação de SSE" }, st), W = W5 - 150;
        var items = [["Régua única (SSE_N)", S.f0.sse, "bar"], ["Com pino(s) (SSE_A)", S.fA.sse, "bar-hit"]], rs = [], vs = [];
        items.forEach(function (it, i) { el("text", { x: 12, y: 24 + i * 50, "font-size": 13, "font-weight": 700 }, s, it[0]); rs.push(el("rect", { x: 12, y: 32 + i * 50, width: 0, height: 22, "class": it[2] }, s)); vs.push(el("text", { x: 16, y: 48 + i * 50, "font-size": 13, fill: "#fff" }, s, "")); });
        var tt = el("text", { x: 12, y: 142, "font-size": 15, "font-weight": 700 }, s, "");
        clock.tween(2, function (p) { items.forEach(function (it, i) { var w = Math.max(2, W * it[1] / S.f0.sse * p); rs[i].setAttribute("width", w); vs[i].textContent = ""; }); tt.textContent = p >= 1 ? "T = " + f4(S.f0.sse) + " / " + f4(S.fA.sse) + " = " + f2(S.T) : ""; });
        el("text", { x: W + 20, y: 48, "font-size": 13 }, s, f4(S.f0.sse)); el("text", { x: W + 20, y: 98, "font-size": 13 }, s, f4(S.fA.sse));
        cap(st, "Barras proporcionais ao SSE. Barra menor = erros menores."); } },

    { t: "O liquidificador de resíduos", // 6
      kid: "Para saber se o pino ajudou “de verdade”, o computador finge que o pino não existe. Ele pega os erros da régua única, joga num liquidificador (embaralha) e devolve cada erro para um ano diferente. Faz isso mil vezes e vê quantas vezes o “ganho” fica tão grande quanto o que vimos.",
      limite: "Limite da analogia: embaralha-se o ERRO, e não a ordem dos anos. A tendência da régua única continua lá; só o ruído muda de lugar.",
      pc: function (S) { return "Repete " + NPERM + " vezes: embaralha os erros do modelo nulo, soma de volta aos valores ajustados por ele, refaz os dois ajustes e recalcula T. O p-valor é a fração de vezes em que T_falso ≥ T observado."; },
      conta: function (S) { return '<span class=eq>T observado = ' + f2(S.T) + '</span><span class=eq data-live="p">p = (número de T_falso ≥ T observado) / réplicas</span>'; },
      tech: function () { return "<p>Permutam-se os resíduos do modelo nulo e somam-se de volta aos valores modelados por ele, formando um conjunto de dados de permutação (S5ab 20). O p-valor é a proporção de conjuntos permutados cujo T é pelo menos tão extremo quanto o observado (S5ab 22); rejeita-se o nulo se p for menor que o nível do teste (S5ab 23). Sob H₀ o p-valor é uniforme em (0,1) (S5ab 24).</p><p>É uma amostra Monte Carlo das N! permutações possíveis (S5ab 25, " + "LIDO-WebFetch). Mínimo 1000 réplicas, máximo 10.000, recomendação de pelo menos 4499 (S5ab 26); o padrão atual é 4499 e versões antigas usavam 999 (S5ab 27). Aqui usamos o mínimo, 1000, para a animação ser rápida. O resultado depende da semente (S5ab 86); a nossa é fixa (" + SEED + "), então este simulador sempre dá o mesmo resultado.</p><p><b>O que o p-valor diz:</b> quão compatível o ganho observado é com o acaso sob o modelo nulo. Não “prova” a dobra.</p>"; },
      fala: "Não embaralhamos os anos. Embaralhamos os erros do modelo mais simples e medimos quão grande o ganho de ajuste ficaria só por acaso. O p-valor é a fração de simulações com ganho tão grande quanto o observado, e indica incompatibilidade com o acaso, não prova.",
      q: "Mil sorteios é o número certo?", a: "É o mínimo permitido pelo manual. A recomendação é pelo menos 4499 e o padrão atual é 4499. Com poucos sorteios o p-valor varia mais entre rodadas; por isso a semente é fixada e declarada.",
      src: [["20–27", "LIDO"], ["86", "LIDO"]],
      viz: function (st, S, ctl) { return permViz(st, S, ctl); } },

    { t: "A fila de testes", // 7
      kid: "Um teste só responde “vale a pena ter mais pinos?”. O computador faz uma fila: começa comparando nenhum pino contra o máximo. Se o máximo ganha, sobe a régua mínima; se não ganha, tira um pino do máximo. Repete até os dois lados ficarem iguais.",
      pc: function (S) { return "Faz a sequência de testes (cada um com " + NPERM + " réplicas) e fica com o número de dobras em que a fila para."; },
      conta: function (S) { return "<div class='tbl-wrap' data-live='seq'></div>"; },
      tech: function (S) { return "<p>Procedimento sequencial: H₀: k = ka contra H₁: k = kb, começando em ka = MIN e kb = MAX; se H₀ é rejeitada sobe-se ka, senão desce-se kb, até ka = kb (S5ab 17). A partir da versão 3.0 o nível de cada teste é α(ka, kb) = α/(MAX − ka) (S5ab 30), com α global padrão 0,05 (S5ab 34); antes da v3.0 usava-se Bonferroni (S5ab 29). Neste exemplo MIN = 0 e MAX = " + S.kMax + ".</p><p>Mudar MIN ou MAX muda os níveis e pode mudar o modelo final (S5ab 33). A permutação tende a detectar menos joinpoints (S5ab 35). Desde a versão 5.0 o padrão do programa é o WBIC, e não a permutação (S5ab 39); este simulador mostra a permutação porque é o método descrito no fichamento como clássico (Kim et al., 2000). A escolha para o projeto está <b>pendente</b>.</p>"; },
      fala: "O número de dobras não é escolhido a olho: é decidido por uma fila de testes, cada um com nível ajustado para não aceitar dobras demais por sorte.",
      q: "O programa atual ainda usa permutação?", a: "Pode usar, mas o padrão desde a versão 5.0 é o WBIC. Qual método usar no projeto ainda não foi decidido.",
      src: [["17", "LIDO"], ["29–34", "LIDO"], ["39", "LIDO"]],
      viz: function (st, S) { var box = document.createElement("div"); st.appendChild(box); box.innerHTML = "<p class=cap>A tabela abaixo mostra cada teste da fila.</p>"; var c = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", h: 260, label: "Série e modelo escolhido" }); ch2(c, S); } },

    { t: "O APC: velocidade de cada trecho", // 8
      kid: "Cada trecho da régua tem uma inclinação. O APC traduz essa inclinação em “quantos por cento por ano” a cobertura sobe ou cai naquele trecho.",
      pc: function () { return "Pega a inclinação b de cada trecho (no ln) e calcula APC = (e^b − 1) × 100."; },
      conta: function (S) { return "<div data-live='apc'></div>"; },
      tech: function (S) { return "<p>APC = (e<sup>b</sup> − 1) × 100 (S5ab 3), com b a inclinação do segmento no ln. As inclinações são obtidas do modelo contínuo ajustado; o APC é uma variação percentual relativa, e não pontos percentuais.</p>" + (S.key === "5" ? "<p><b>Conferência com o guia do discente.</b> O guia traz −19,0% e −7,2%. Com ajuste log-linear contínuo de uma dobra em 2022, os números calculados aqui são os que aparecem na conta (APC₁ ≈ +6,8%, APC₂ ≈ −25,4%, AAPC ≈ −10,7%), conferidos contra uma implementação independente em Python. Os valores do guia não correspondem a esses dados.</p>" : ""); },
      fala: "O APC é o percentual de variação por ano dentro do trecho. Ele supõe que a taxa muda uma fração constante do valor do ano anterior.",
      q: "APC de −25% quer dizer que a cobertura caiu 25 pontos por ano?", a: "Não. Quer dizer que a cobertura cai cerca de 25% do valor do ano anterior a cada ano, naquele trecho.",
      src: [["2–4", "LIDO"]],
      viz: function (st, S) { var c = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", h: 300, label: "Modelo escolhido com APC por trecho" }); ch2(c, S, true); } },

    { t: "O AAPC: uma média só", // 9
      kid: "O AAPC é uma nota única para todo o período. Os trechos mais compridos pesam mais na média.",
      pc: function () { return "Faz a média das inclinações, com peso igual ao comprimento de cada trecho, e então converte em percentual por ano."; },
      conta: function (S) { return "<div data-live='aapc'></div>"; },
      tech: function () { return "<p>AAPC = { exp( Σ wᵢbᵢ / Σ wᵢ ) − 1 } × 100, com wᵢ o comprimento de cada segmento dentro do intervalo (S5ab 66–68). Não é a média aritmética dos APCs (S5ab, seção 4, item 8). Depende do intervalo escolhido (S5ab 70) e, se o intervalo cabe em um só segmento, é igual ao APC dele (S5ab 71).</p><p>O IC do AAPC mostrado no fichamento é baseado na normal (S5ab 72–73). <b>Termo “método delta”:</b> não aparece nas páginas lidas do manual (S5ab 76, NÃO LOCALIZADO); por isso o simulador descreve o cálculo e não usa esse nome.</p>"; },
      fala: "O AAPC resume o período inteiro, mas pode esconder trechos fortes de sinais opostos que se compensam. Por isso sempre mostro os APCs junto.",
      q: "O AAPC é a média dos APCs?", a: "Não exatamente: é a exponencial da média ponderada das inclinações, menos 1. Com APCs moderados a diferença é pequena.",
      src: [["66–73", "LIDO"], ["76", "NÃO LOCALIZADO"]],
      viz: function (st, S) { var W9 = C.width(st), box = el("svg", { viewBox: "0 0 " + W9 + " 150", role: "img", "aria-label": "Pesos dos trechos" }, st); liveAapc(box, S, W9); } },

    { t: "p e intervalo de cada trecho (teste t)", // 10
      kid: "Agora perguntamos se a inclinação de cada trecho é diferente de zero e quão certa é a medida. Esse teste é outro: é uma conta com tabela t, sem liquidificador.",
      pc: function () { return "Para cada trecho, calcula o erro padrão da inclinação, a estatística t, o p-valor bicaudal e o intervalo de confiança."; },
      conta: function (S) { return "<div data-live='tt'></div>"; },
      tech: function (S) { return "<p>O p-valor do segmento vem de um teste t bicaudal, 2{1 − t<sub>d</sub>(|U|)} (S5ab 56), com d = n* − 2(k + 1) graus de liberdade, onde n* exclui os pontos sobre joinpoints (S5ab 55). Os erros padrão vêm de mínimos quadrados sem a restrição de continuidade, condicionados aos joinpoints estimados e sem os pontos sobre joinpoints (S5ab 54). IC: 100·{exp(b ± s·t<sub>d</sub>⁻¹(1 − α/2)) − 1} (S5ab 53).</p><p><b>Este p NÃO é o da permutação</b> (S5ab 57): o manual diz que o p do teste t é menos exato por ser assintótico. Estatísticas de inclinação exigem pelo menos 3 observações por segmento, excluindo as sobre joinpoints (S5ab 51).</p><p>O programa atual usa por padrão o intervalo por quantil empírico (S5ab 59); este simulador mostra o IC t descrito em S5ab 53 e <b>não</b> reproduz o quantil empírico. Segmentos curtos podem ter IC paramétrico “muito liberal” (S5ab 63).</p>"; },
      fala: "Existem dois p-valores diferentes: o da permutação decide quantas dobras; o do teste t diz se a inclinação de cada trecho é diferente de zero. Não se misturam.",
      q: "Por que o exemplo de 5 pontos não mostra p nem intervalo?", a: "Porque, com 5 pontos, cada trecho tem menos de 3 observações depois de retirar o ponto sobre a dobra, e o manual diz que o erro padrão e o p não podem ser calculados assim.",
      src: [["51", "LIDO"], ["53–57", "LIDO"], ["59", "LIDO"], ["63", "LIDO"]],
      viz: function (st, S) { var c = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", h: 260, label: "Modelo escolhido" }); ch2(c, S); } },

    { t: "O que o Joinpoint não diz", // 11
      kid: "O Joinpoint aponta onde a escada muda de direção. Ele não sabe por que mudou, como um termômetro que mostra a febre, mas não a causa.",
      pc: function () { return "Nada além do que está nos passos anteriores: ajusta, testa e resume. Não recebe informação sobre pandemia, sistema de registro ou gestão."; },
      conta: function (S) { return "<ul><li>Mostra <b>quando</b> a tendência mudou.</li><li>Não mostra <b>por quê</b>.</li><li>O ano da dobra é um ano da série, não uma data exata.</li><li>Mudanças de sistema de informação e a pandemia aparecem como dobras, mas o método não as distingue de outras causas.</li></ul>"; },
      tech: function () { return "<p>O projeto pretende testar a hipótese de que a pandemia de COVID-19 e a mudança dos sistemas de informação representam quebras estruturais (PDF, seção 3.4). O Joinpoint não atribui causa; a interpretação é feita à parte. Por padrão os joinpoints só ocorrem em observações (S5ab 11), e o resultado depende de MIN, MAX, restrições e semente (S5ab 33, 86).</p>"; },
      fala: "O Joinpoint aponta quando a tendência muda. Se a causa foi pandemia, troca de sistema ou política, é uma interpretação que fazemos fora do método.",
      q: "Uma dobra em 2020 prova efeito da pandemia?", a: "Não. Mostra que a tendência mudou por volta daquele ano. Atribuir causa exige outra evidência.",
      src: [["11", "LIDO"], ["33", "LIDO"], ["86", "LIDO"]],
      viz: function (st, S) { var c = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", h: 260, label: "Série com pontos de mudança" }); ch2(c, S); el("text", { x: c.m.l + 8, y: c.m.t + 22, "font-size": 16, "font-weight": 700 }, c.svg, "? por quê"); } }
  ];

  /* gráfico do modelo final (etapas 7 a 11) */
  function ch2(ch, S, labelApc) {
    function draw() {
      ch.g.textContent = "";
      if (!S.seq.done) { ch.points(S.ser.cob, "pt", 5, ch.g); ch.text(ch.w / 2, ch.m.t + 30, "calculando a fila de testes…", { cls: "muted" }); return; }
      var fit = pctFit(S, S.fit.fitted), bounds = [0].concat(S.fit.taus, [S.n - 1]);
      ch.line(fit, "l-alt", ch.g); ch.points(S.ser.cob, "pt", 5, ch.g);
      S.fit.taus.forEach(function (t) { el("circle", { cx: ch.x(t), cy: ch.y(fit[t]), r: 8, "class": "pt-break" }, ch.g); ch.text(ch.x(t), ch.h - ch.m.b + 32, "dobra " + S.ser.anos[t], { size: 12, bold: true }); });
      if (labelApc) S.sum.segs.forEach(function (g, i) { var a = bounds[i], b = bounds[i + 1], mid = (a + b) / 2; ch.text(ch.x(mid), ch.y(fit[Math.round(mid)]) - 14, "APC " + sg(g.apc, 1) + "%", { bold: true, size: 13 }); });
    }
    draw(); S.listeners.push(draw);
  }

  /* ---------- visual do passo 6 (permutação) ---------- */
  function permViz(st, S, ctl) {
    var ch = baseChart(st, S, "Séries falsas geradas pelo liquidificador"), g = ch.g, nullLine = pctFit(S, S.f0.fitted), gl = el("g", {}, g);
    ch.line(nullLine, "l-null", g); ch.points(S.ser.cob, "pt", 4, g);
    var hist = new C.Histogram(st, { label: "Histograma de T das séries falsas", lo: 1 });
    var info = document.createElement("p"); info.className = "cap conta"; info.setAttribute("role", "status"); st.appendChild(info);
    var bar = document.createElement("div"); bar.className = "nav-steps"; bar.style.flexWrap = "wrap"; st.appendChild(bar);
    function mk(txt, fn) { var b = document.createElement("button"); b.className = "btn btn-small"; b.textContent = txt; b.addEventListener("click", fn); bar.appendChild(b); return b; }
    var pt, task, trail = [];
    function stats() { var n = pt.Ts.length; return { n: n, ex: pt.exceed, p: n ? pt.exceed / n : NaN }; }
    function update(last) {
      var s = stats(), li = ctl.root.querySelector("[data-live=p]");
      if (last) { var d = Array.prototype.map.call(last.series, function (v) { return 100 * Math.exp(v); }); if (trail.length > 12) gl.removeChild(trail.shift()); trail.forEach(function (t) { t.style.opacity = .25; }); var p = ch.line(d, "l-perm", gl); p.style.opacity = 1; p.style.strokeWidth = 2; trail.push(p); }
      hist.update(pt.Ts, S.T);
      var txt = "Réplica " + s.n + " de " + NPERM + ". T_falso ≥ T observado em " + s.ex + " réplica(s). p = " + s.ex + "/" + s.n + (s.n ? " = " + (s.p === 0 ? "0 (menor que 1/" + NPERM + ")" : fmt(s.p, 3)) : "");
      info.textContent = txt; if (li) li.textContent = "p = " + s.ex + " / " + s.n + (s.n ? " = " + fmt(s.p, 3) : "");
    }
    function fresh() { if (task) task.done = true; trail.forEach(function (t) { if (t.parentNode) t.parentNode.removeChild(t); }); trail = []; pt = new ST.PermTest(S.y, 0, S.kMax, { seed: SEED, fim: OPTS.fim, entre: OPTS.entre }); update(null); }
    function auto() { if (task) task.done = true; task = clock.rateTask(40, function () { if (pt.Ts.length < NPERM) update(pt.step()); }, function () { return pt.Ts.length >= NPERM; }); }
    fresh(); auto();
    mk("Rodar todas", function () { if (task) task.done = true; (function ch() { var n = Math.min(100, NPERM - pt.Ts.length); for (var i = 0; i < n; i++) { var r = pt.step(); if (i === n - 1) update(r); } if (pt.Ts.length < NPERM) setTimeout(ch, 0); })(); });
    mk("Uma réplica por vez", function () { clock.pause(); if (pt.Ts.length < NPERM) update(pt.step()); });
    mk("Recomeçar o sorteio", function () { fresh(); clock.play(); auto(); });
    cap(st, "Linha tracejada: modelo nulo. Linhas azuis: séries falsas (as últimas 12). Barras vermelhas: T_falso ≥ T observado.");
  }

  /* ---------- blocos "vivos" que dependem da fila de testes ---------- */
  function liveAapc(box, S, W9) {
    function draw() {
      box.textContent = "";
      if (!S.seq.done) { el("text", { x: 12, y: 40, "font-size": 14, "class": "muted" }, box, "calculando a fila de testes…"); return; }
      var segs = S.sum.segs, tot = segs.reduce(function (a, g) { return a + g.length; }, 0), x = 20, W = W9 - 40;
      segs.forEach(function (g, i) { var w = W * g.length / tot; el("rect", { x: x + 1, y: 30, width: Math.max(2, w - 2), height: 36, "class": i % 2 ? "bar-hit" : "bar" }, box); el("text", { x: x + w / 2, y: 52, "text-anchor": "middle", "font-size": 12, fill: "#fff", "font-weight": 700 }, box, g.length + " ano" + (g.length > 1 ? "s" : "")); el("text", { x: x + w / 2, y: 86, "text-anchor": "middle", "font-size": 12 }, box, segTxt(g)); el("text", { x: x + w / 2, y: 104, "text-anchor": "middle", "font-size": 12, "font-weight": 700 }, box, "b = " + f4(g.slope)); x += w; });
      el("text", { x: 20, y: 20, "font-size": 12, "class": "muted" }, box, "peso = comprimento do trecho");
      el("text", { x: 20, y: 134, "font-size": 15, "font-weight": 700 }, box, "AAPC = " + sg(S.sum.aapc, 2) + "% ao ano");
    }
    draw(); S.listeners.push(draw);
  }
  function seqTable(S) {
    var rows = S.seq.tests.map(function (t) { return "<tr><td>" + t.ka + " contra " + t.kb + "</td><td class=num>" + f2(t.T) + "</td><td class=num>" + t.exceed + " de " + NPERM + "</td><td class=num>" + (t.p === 0 ? "&lt; 0,001" : fmt(t.p, 3)) + "</td><td class=num>" + fmt(t.level, 4) + "</td><td>" + (t.reject ? "rejeita: sobe ka" : "não rejeita: desce kb") + "</td></tr>"; }).join("");
    var cur = S.seq.cur ? "<tr><td colspan=6>calculando " + S.seq.cur.ka + " contra " + S.seq.cur.kb + "… " + S.seq.cur.done + " de " + NPERM + " réplicas</td></tr>" : "";
    var end = S.seq.done ? "<p class='sum'>Resultado da fila: " + S.k + " dobra" + (S.k === 1 ? "" : "s") + (S.fit.taus.length ? " (em " + S.fit.taus.map(function (t) { return S.ser.anos[t]; }).join(", ") + ")" : "") + ".</p>" : "";
    var note = S.key === "25" ? "<p>Observação: o último teste, 3 contra 4, ficou no limite (p próximo do nível). Isso mostra por que o número de dobras deve ser acompanhado de análise de sensibilidade (MIN, MAX, semente, nº de réplicas).</p>" : "";
    return "<table><tr><th>Teste (ka contra kb)</th><th class=num>T</th><th class=num>T_falso ≥ T</th><th class=num>p</th><th class=num>Nível α/(MAX−ka)</th><th>Decisão</th></tr>" + rows + cur + "</table>" + end + (S.seq.done ? note : "");
  }
  function apcHtml(S) {
    if (!S.seq.done) return "<p>calculando a fila de testes…</p>";
    var t = S.sum.segs.map(function (g) { return "<tr><td>" + segTxt(g) + "</td><td class=num>" + f4(g.slope) + "</td><td class=num>(e^" + f4(g.slope) + " − 1)·100</td><td class=num><b>" + sg(g.apc, 2) + "%</b></td></tr>"; }).join("");
    return "<table><tr><th>Trecho</th><th class=num>b (ln)</th><th class=num>Conta</th><th class=num>APC</th></tr>" + t + "</table>";
  }
  function aapcHtml(S) {
    if (!S.seq.done) return "<p>calculando a fila de testes…</p>";
    var segs = S.sum.segs, tot = segs.reduce(function (a, g) { return a + g.length; }, 0), num = segs.map(function (g) { return g.length + "·(" + f4(g.slope) + ")"; }).join(" + ");
    var avg = segs.reduce(function (a, g) { return a + g.length * g.slope; }, 0) / tot;
    return "<span class=eq>Média ponderada das inclinações = (" + num + ") / " + tot + " = " + f4(avg) + "</span><span class=eq><b>AAPC = (e^" + f4(avg) + " − 1)·100 = " + sg(S.sum.aapc, 2) + "% ao ano</b></span>" + (S.sum.aapcCI ? "<span class=eq>IC95% normal: " + sg(S.sum.aapcCI.lo, 2) + "% a " + sg(S.sum.aapcCI.hi, 2) + "%</span>" : "<span class=eq>IC do AAPC: não calculável aqui (mesma razão do passo seguinte).</span>");
  }
  function ttHtml(S) {
    if (!S.seq.done) return "<p>calculando a fila de testes…</p>";
    var inf = S.sum.inf;
    if (!inf.ok) return "<div class='callout alert'><b>Não calculável neste exemplo</b>Graus de liberdade d = n* − 2(k + 1) = " + inf.nStar + " − " + 2 * (S.k + 1) + " = " + inf.df + ". Após retirar os pontos sobre as dobras, restam " + inf.nStar + " pontos para estimar " + 2 * (S.k + 1) + " parâmetros. O manual diz que o erro padrão da inclinação e o p não podem ser calculados com menos de 3 observações por trecho (S5ab 51). Por isso o simulador <b>não</b> mostra p nem IC por trecho aqui.</div>";
    var t = S.sum.segs.map(function (g) { return "<tr><td>" + segTxt(g) + "</td><td class=num>" + sg(g.apc, 2) + "%</td><td class=num>" + f4(g.se) + "</td><td class=num>" + fmt(g.t, 2) + "</td><td class=num>" + (g.p < 0.001 ? "&lt; 0,001" : fmt(g.p, 3)) + "</td><td class=num>" + sg(g.lo, 2) + "% a " + sg(g.hi, 2) + "%</td></tr>"; }).join("");
    return "<p>gl = n* − 2(k + 1) = " + inf.nStar + " − " + 2 * (S.k + 1) + " = " + inf.df + "</p><div class='tbl-wrap'><table><tr><th>Trecho</th><th class=num>APC</th><th class=num>EP (b)</th><th class=num>t</th><th class=num>p (teste t)</th><th class=num>IC95% t</th></tr>" + t + "</table></div><p>Um APC com p ≥ 0,05 é classificado como estacionário no projeto (PDF, seção 3.4), mas p alto num trecho curto também pode ser falta de poder (S5ab 58).</p>";
  }

  /* ---------- tela do passo a passo ---------- */
  function renderPassos(root, app, state) {
    var S = prep(state.ds); S.seq0ka = 0;
    var idx = Math.max(0, Math.min(STEPS.length - 1, (state.step || 1) - 1)), st = STEPS[idx];
    clock.clear(); S.listeners.length = 0;
    root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "dataset"; ds.innerHTML = "<span><b>Dados:</b></span>";
    var seg = document.createElement("div"); seg.className = "seg"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Conjunto de dados");
    [["5", "Série didática (5 pontos)"], ["25", "Série fictícia (25 pontos)"]].forEach(function (o) { var b = document.createElement("button"); b.textContent = o[1]; b.setAttribute("aria-pressed", String(o[0] === state.ds)); b.addEventListener("click", function () { state.ds = o[0]; renderPassos(root, app, state); }); seg.appendChild(b); });
    ds.appendChild(seg); root.appendChild(ds);
    var head = document.createElement("div"); head.innerHTML = '<p class="stepno">Passo ' + (idx + 1) + " de " + STEPS.length + '</p><div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + (idx + 1) + '"><i style="width:' + ((idx + 1) / STEPS.length * 100) + '%"></i></div><h2 tabindex="-1" id="step-h">' + (idx + 1) + ". " + st.t + "</h2>";
    root.appendChild(head);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var ctl = { root: root };
    var body = document.createElement("div"); root.appendChild(body);
    body.innerHTML =
      "<div class='callout kid'><b>Como para uma criança de 5 anos</b>" + st.kid + (st.limite ? "<br><em>" + st.limite + "</em>" : "") + "</div>" +
      "<div class=card><span class=lbl>O que o computador faz</span>" + st.pc(S) + "</div>" +
      "<div class='card conta'><span class=lbl>Conta na tela</span>" + st.conta(S) + "</div>" +
      "<details class=tech" + (app.tech() ? " open" : "") + "><summary>Ver a versão técnica</summary>" + st.tech(S) + "</details>" +
      (app.banca() ? "<div class=banca-box><span class=lbl>Modo banca: fala pronta</span><p>" + st.fala + "</p><span class=lbl>Pergunta provável</span><p><b>" + st.q + "</b></p><p>" + st.a + "</p></div>" : "") +
      src(st.src);
    var nav = document.createElement("div"); nav.className = "nav-steps";
    var back = document.createElement("button"); back.className = "btn"; back.textContent = "Voltar"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "btn primary"; nxt.textContent = idx === STEPS.length - 1 ? "Fim do método" : "Avançar"; nxt.disabled = idx === STEPS.length - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    nav.appendChild(back); nav.appendChild(nxt); root.appendChild(nav);
    st.viz(stage, S, ctl);
    function refresh() {
      var a = root.querySelector("[data-live=seq]"); if (a) a.innerHTML = seqTable(S);
      var b = root.querySelector("[data-live=apc]"); if (b) b.innerHTML = apcHtml(S);
      var c = root.querySelector("[data-live=aapc]"); if (c) c.innerHTML = aapcHtml(S);
      var d = root.querySelector("[data-live=tt]"); if (d) d.innerHTML = ttHtml(S);
    }
    S.listeners.push(refresh); refresh();
    var h = root.querySelector("#step-h"); if (state.focus && h) h.focus({ preventScroll: false });
  }

  /* ---------- abas (a) a (h) ---------- */
  function tabContexto() { return "<div class=card><h2>Qual pergunta este método responde?</h2><p>A cobertura vacinal de Alagoas, de 2000 a 2024, subiu, caiu ou mudou de direção? E em que anos a direção mudou?</p><p>A Regressão Joinpoint divide a série em trechos de reta e estima, em cada trecho, quantos por cento por ano a cobertura muda (APC), além de uma média do período (AAPC). No projeto, ela também vai ser usada para testar se a pandemia de COVID-19 e a mudança dos sistemas de informação aparecem como quebras na tendência (PDF, seção 3.4).</p></div>" +
    "<div class='callout alert'><b>Atenção</b>Todos os números deste simulador são fictícios e foram feitos só para mostrar o mecanismo. Nada aqui é resultado da pesquisa.</div><p>Use a aba <b>Passo a passo</b> para ver o método funcionando e a aba <b>Modo banca</b> (botão no topo) para ver a fala pronta e a pergunta provável de cada passo.</p>"; }
  function tabDados(S) {
    var rows = function (K) { var s = K === "5" ? D.serie5 : D.serie25; return s.anos.map(function (a, i) { return "<tr><td>" + a + "</td><td class=num>" + s.cob[i] + "</td><td class=num>" + fmt(s.cob[i] / 100, 2) + "</td><td class=num>" + f4(Math.log(s.cob[i] / 100)) + "</td></tr>"; }).join(""); };
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class='tbl-wrap'><table><tr><th>Variável</th><th>Papel</th><th>Unidade</th><th>Período</th><th>Fonte presumida</th></tr><tr><td>Ano</td><td>tempo (eixo x)</td><td>ano</td><td>2020–2024 (didática) e 2000–2024 (25 pontos)</td><td>fictícia</td></tr><tr><td>Cobertura vacinal</td><td>desfecho (eixo y)</td><td>% (convertida em proporção e depois em ln)</td><td>idem</td><td>fictícia; no projeto real, doses ÷ nascidos vivos × 100 (PDF, seção 3.3)</td></tr></table></div></div>" +
    "<div class=card><h3>Série didática (5 pontos)</h3><div class='tbl-wrap'><table><tr><th>Ano</th><th class=num>Cobertura (%)</th><th class=num>Proporção</th><th class=num>ln</th></tr>" + rows("5") + "</table></div></div>" +
    "<details class=tech><summary>Série fictícia de 25 pontos (2000–2024)</summary><div class='tbl-wrap'><table><tr><th>Ano</th><th class=num>Cobertura (%)</th><th class=num>Proporção</th><th class=num>ln</th></tr>" + rows("25") + "</table></div></details>"; }
  function tabResultado() {
    var S5 = prep("5"), S25 = prep("25");
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Cada trecho traz um APC. No projeto, cada segmento será classificado pelo sinal e pela significância do APC como crescimento, estacionariedade ou declínio (PDF, seção 3.4). As dobras são lidas como anos em que a tendência mudou.</p><ul><li><b>Pode concluir:</b> a tendência mudou por volta daquele ano e quanto, em % ao ano, cada trecho sobe ou cai.</li><li><b>Não pode concluir:</b> a causa da mudança; que a dobra “foi provada” pelo p da permutação (ele indica incompatibilidade com o acaso sob o modelo nulo); que o ano da dobra é exato.</li></ul></div>" +
    "<div class=card><h3>Exemplo com a série didática (resultado do código)</h3><div id=res5></div><p class=cap>O guia do discente traz −19,0% e −7,2% para estes dados. Com ajuste log-linear contínuo de uma dobra em 2022, o cálculo aqui dá os valores da tabela, conferidos contra uma implementação independente em Python.</p></div>";
  }
  function fillResultado(root) {
    var S = prep("5"), n = root.querySelector("#res5"); if (!n) return;
    function draw() { n.innerHTML = S.seq.done ? "<div class='tbl-wrap'>" + apcHtml(S) + "</div><p class=sum>AAPC (2020–2024) = " + sg(S.sum.aapc, 2) + "% ao ano</p>" : "<p>calculando…</p>"; }
    draw(); S.listeners.push(draw);
  }
  function tabLimitacoes() {
    var L = [
      ["Dois p-valores diferentes. O da permutação decide quantas dobras; o do teste t por segmento é assintótico e, segundo o manual, menos exato.", "56–57", "LIDO"],
      ["A permutação embaralha os resíduos do modelo nulo, e não a série original.", "20", "LIDO"],
      ["A permutação deixou de ser o padrão: desde a v5.0 o padrão é o WBIC, e o IC padrão é o quantil empírico.", "39, 59", "LIDO"],
      ["O resultado depende de MIN, MAX, restrições, número de réplicas e semente; fazer análise de sensibilidade.", "33, 86", "LIDO"],
      ["25 pontos é curto: estatísticas de inclinação exigem 3 ou mais observações por trecho; pontos sobre dobras são descartados; trechos curtos dão IC paramétrico “muito liberal”.", "51, 54–55, 63", "LIDO"],
      ["Dividir um trecho em dois reduz o poder dos testes de cada pedaço.", "58", "LIDO"],
      ["O modelo log-linear supõe variação percentual constante em cada trecho. Com cobertura perto do teto de 100%, a adequação do log-linear e da normalidade dos erros deve ser verificada nos resíduos. O manual não trata de cobertura vacinal nem de cobertura acima de 100%.", "4, 8; seção 4 item 7", "NÃO LOCALIZADO"],
      ["O AAPC não é a média aritmética dos APCs e pode ficar perto de zero mesmo com trechos fortes de sinais opostos.", "68, 69", "LIDO"],
      ["Autocorrelação: o padrão supõe erros não correlacionados; corrigir com φ estimado pode reduzir o poder; o manual sugere sensibilidade com φ = 0,1; 0,2; 0,3.", "79–82", "LIDO"],
      ["Heterocedasticidade: para proporções com n conhecido, o manual sugere EP = √(p(1 − p)/n), o que exige o denominador de cada ano.", "85", "LIDO"],
      ["Joinpoints só em observações por padrão: a dobra “estimada” é um ano da série.", "11", "LIDO"],
      ["Desempenho (poder e cobertura do IC) do método para n = 25: não localizado nas fontes lidas. Kim et al. 2000 foi lido só no resumo.", "lacunas 1, 7", "NÃO LOCALIZADO"]
    ];
    return "<div class=card><h2>Limitações e pegadinhas</h2><p>Fonte: S5ab, seções 4 e 6. O registro geral de fragilidades do projeto está em S5m (não reproduzido aqui item a item).</p><ul>" + L.map(function (l) { return "<li>" + l[0] + " <small>S5ab " + l[1] + "</small> " + seal(l[2]) + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecidido() {
    return "<div class=card><h2>O que o projeto já decidiu</h2><ul><li>Usar a Regressão Joinpoint, com o Joinpoint Regression Program do NCI, para a caracterização temporal da cobertura e do abandono (PDF, seção 3.4).</li><li>Estimar APC, AAPC e pontos de inflexão significativos.</li><li>Testar a pandemia de COVID-19 e a mudança de sistemas de informação como quebras estruturais.</li><li>Classificar cada segmento como crescimento, estacionariedade ou declínio conforme sinal e significância do APC.</li></ul></div>" +
    "<div class=card><h2>O que está pendente</h2><p class=cap>Itens abaixo vêm das pegadinhas e lacunas do S5ab. Não foram resolvidos aqui.</p>" +
    ["Versão do programa a ser usada (a v6.1.0 era a vigente na consulta de 26/10/2026).", "Método de seleção do número de dobras: permutação (clássico) ou WBIC (padrão desde a v5.0).", "MIN e MAX de joinpoints e restrições de posição (padrão: 2 e 2).", "Número de réplicas de permutação e semente, se a permutação for usada.", "Modelo de erro: variância constante, EP fornecido (proporções) e tratamento de autocorrelação.", "Adequação do log-linear para cobertura perto do teto de 100% (verificar resíduos).", "Como a cobertura acima de 100% entra na série do Joinpoint: o S5ab não trata disso (lacuna 6); ver S5y.", "Análise de sensibilidade (variar MIN, MAX, semente, réplicas)."].map(function (t) { return "<div class=pending>" + t + "</div>"; }).join("") + "</div>";
  }
  var FONTES = [
    ["F1", "Kim, Fay, Feuer, Midthune (2000). Permutation tests for joinpoint regression. Stat Med 19(3):335–351", "LIDO (apenas resumo)"],
    ["F2", "Clegg et al. (2009). Estimating average annual per cent change in trend analysis. Stat Med 28(29):3670–3682", "LIDO (apenas resumo)"],
    ["F3", "Kim et al. (2017). Improved confidence interval for average annual percent change. Stat Med 36(19):3059–3074", "LIDO (apenas resumo)"],
    ["F4", "Kim, Chen, Byrne, Wheeler, Feuer (2022). Twenty years since Joinpoint 1.0. Stat Med 41(16):3102–3130", "LIDO (apenas resumo)"],
    ["H1–H4", "Joinpoint Help System (NCI): testes de permutação, detalhes, FAQ e p-valores", "LIDO"],
    ["H5–H7", "Help: número de joinpoints, observações mínimas, grid search", "LIDO"],
    ["H8–H11", "Help: notas estatísticas, APC, AAPC, IC e quantil empírico", "LIDO"],
    ["H12–H13", "Help: nível de cada teste na sequência; número de permutações (FAQ)", "LIDO-WebFetch"],
    ["H14–H18", "Help: seleção de modelo (BIC, BIC3, WBIC), erros, mudanças da v5.0, FAQ, parada antecipada", "LIDO"]
  ];
  function tabFontes() {
    return "<div class=card><h2>Fontes e status de verificação</h2><p>URL base: <code>https://surveillance.cancer.gov/help/joinpoint/</code>. Detalhes de cada afirmação (trecho literal, página e status) estão no fichamento S5ab, seção 2.</p><div class='tbl-wrap'><table><tr><th>ID</th><th>Fonte</th><th>Status</th></tr>" + FONTES.map(function (f) { return "<tr><td>" + f[0] + "</td><td>" + f[1] + "</td><td>" + seal(f[2].indexOf("WebFetch") >= 0 ? "LIDO-WebFetch" : "LIDO") + (f[2].indexOf("resumo") >= 0 ? " <small>apenas resumo</small>" : "") + "</td></tr>"; }).join("") + "</table></div>" +
    "<h3>Verificadas nesta construção (26/10/2026)</h3><div class='tbl-wrap'><table><tr><th>ID</th><th>Fonte</th><th>Status</th></tr><tr><td>V1</td><td>Página do Joinpoint Regression Program, NCI: <code>https://surveillance.cancer.gov/joinpoint/</code> (versão 6.1.0, lançada em 20/07/2026; versão desktop e de linha de comando; a de linha de comando “is for use in a batch mode or called from other software, such as SAS or R”)</td><td>" + seal("LIDO-WebFetch") + "</td></tr><tr><td>V2</td><td>Pacote R segmented, página no índice do CRAN (<code>search.r-project.org/CRAN/packages/segmented/index.html</code>): só o título “Regression Models with Break-Points / Change-Points Estimation” e o início da descrição foram lidos</td><td>" + seal("LIDO-WebFetch") + "</td></tr></table></div>" +
    "<p>Sem texto integral lido: Kim et al. 2000 (só resumo). Divergências internas do manual (ex.: máximo 7 contra 9 no grid search) estão documentadas no S5ab, lacuna 3, e não foram harmonizadas.</p></div>"; }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><h3>1. Joinpoint Regression Program (NCI)</h3><p>Software do NCI, citado no projeto (PDF, seção 3.4). A página oficial lista versão com interface gráfica e versão de linha de comando, ambas na 6.1.0 em 26/10/2026 " + seal("LIDO-WebFetch") + ". Segundo a mesma página, a linha de comando pode ser chamada de outros programas, como SAS ou R; não foi encontrado pacote R oficial citado ali.</p><p><b>Entrada:</b> arquivo de dados com campos de x (ano) e y (cobertura em proporção, se for log-linear). O manual indica que a opção de variância constante é escolhida automaticamente se o arquivo tiver só 2 campos (S5ab 83 " + seal("LIDO") + "). Formato exato do arquivo (separador, extensão): " + seal("NÃO VERIFICADO") + ".</p><p><b>O que configurar</b> (todos pendentes de decisão, ver aba Decidido x pendente): transformação log; MIN e MAX; restrições de posição; método de seleção; nº de permutações e semente; modelo de erro.</p>" +
    "<h3>2. R: pacote segmented</h3><p>Regressão segmentada em R. Título do pacote confirmado " + seal("LIDO-WebFetch") + ". Nome da função principal, argumentos e versão: " + seal("NÃO VERIFICADO") + ". Se o pacote replica ou não a seleção por permutação do NCI: " + seal("NÃO VERIFICADO") + ". Por isso, não substitui o programa do NCI na descrição metodológica sem checagem.</p><pre># A CONFIRMAR: nomes e argumentos não verificados na documentação; não foi executado.\nlibrary(segmented)\nd  &lt;- data.frame(ano = 2020:2024, cob = c(0.80, 0.85, 0.90, 0.70, 0.50))\nm0 &lt;- lm(log(cob) ~ ano, data = d)\n# m1 &lt;- segmented(m0, seg.Z = ~ano)   # exige confirmação</pre>" +
    "<h3>3. Conferência independente (testada neste repositório)</h3><p>O repositório inclui <code>tests/check_joinpoint.py</code>, escrito com numpy e scipy, que refaz a busca em grade, o APC, o AAPC, o teste t e a permutação (com a mesma semente) e compara com o motor JavaScript. Resultado da última execução: 74 comparações, 0 divergências.</p><pre>node tests/dump_js.js &gt; js.json\npython3 tests/check_joinpoint.py js.json</pre></div>"; }

  NS.methods.joinpoint = {
    id: "joinpoint", n: 2, nome: "Regressão Joinpoint", ready: true, steps: STEPS.length,
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decidido x pendente"], ["fontes", "Fontes"], ["rodar", "Como rodar de verdade"]],
    render: function (tab, root, app, state) {
      state.ds = state.ds || "5";
      if (tab === "passos") { renderPassos(root, app, state); return; }
      clock.clear();
      var html = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimitacoes, decisao: tabDecidido, fontes: tabFontes, rodar: tabRodar }[tab]();
      root.innerHTML = html; if (tab === "resultado") fillResultado(root);
    }
  };
})();
