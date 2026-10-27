/* Método 2: Regressão Joinpoint. Afirmações baseadas no manual do Joinpoint (NCI).
   Todos os números exibidos são calculados em js/stats.js. Dados 100% fictícios (js/data.js). */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var ST = NS.stats, D = NS.data, C = NS.charts, clock = NS.clock, fmt = C.fmt, sg = C.signed, el = C.el;
  var OPTS = { fim: 2, entre: 2 }, SEED = 2026, NPERM = 1000;

  /* ---------- selos de status ---------- */
  function seal() { return ""; }
  function src() { return ""; }

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
  function pFmt(ex, n) { return !n ? "–" : ex === 0 ? "menor que " + fmt(1 / n, 3) : fmt(ex / n, 3); }
  function f2(x) { return fmt(x, 2); } function f4(x) { return fmt(x, 4); }
  function segTxt(g) { return g.de + "–" + g.ate; }

  /* ---------- passos ---------- */
  var SIMPLE = [0, 3, 5, 6, 7, 8, 10]; /* roteiro simplificado: série, dobra, Monte Carlo, fila de testes, APC, AAPC, o que não diz */
  var STEPS = [
    { t: "A série: os degraus", // 1
      kid: "Cada ponto é um ano e mostra quantas crianças, em cada 100, foram vacinadas. O gráfico mostra se a cobertura sobe, cai ou muda de rumo.",
      pc: function (S) { return "Lê " + S.n + " anos de cobertura e coloca cada um como um ponto: ano na horizontal, cobertura na vertical."; },
      conta: function (S) { return "<table><tr><th>Ano</th>" + S.ser.anos.map(function (a) { return "<th class=num>" + a + "</th>"; }).join("") + "</tr><tr><th>Cobertura (%)</th>" + S.ser.cob.map(function (c) { return "<td class=num>" + c + "</td>"; }).join("") + "</tr></table>"; },
      tech: function (S) { return "<p>Série anual y<sub>t</sub>, t = 1…" + S.n + ". O Joinpoint ajusta um modelo de segmentos de reta unidos (contínuo) nos pontos de mudança. Aqui os dados são fictícios e fixos.</p>" + (S.key === "5" ? "<p><b>Por que 5 pontos?</b> Só para ver o mecanismo. O manual diz que “pelo menos sete pontos de dados” devem existir para considerar permitir um joinpoint e, na tabela do máximo padrão, 0 a 6 pontos dá 0 joinpoints. A fórmula de observações mínimas, com as restrições padrão de 2 e 2, dá 5 para 1 joinpoint(conta própria: 2·2 + 0·2 + 1 = 5, " + "a conferir no software). Ou seja, o programa só aceitaria 1 dobra em 5 pontos se o analista pedir esse máximo à mão, contra a recomendação do manual.</p>" : "<p>Série de 25 pontos (2000–2024), o tamanho do nosso projeto. Para 22–26 pontos o máximo padrão de joinpoints é 4.</p>"); },
      q: "Por que usar só 5 pontos no exemplo?", a: "Porque a conta cabe na tela. O próprio manual desaconselha dobras com menos de 7 pontos; no projeto real a série tem 25 pontos.",
      viz: function (st, S) { var ch = baseChart(st, S, "Cobertura por ano (fictícia)"), g = ch.g, pts = [], line;
        ch.points(S.ser.cob, "pt", 6, g).forEach(function (p) { p.style.opacity = 0; pts.push(p); });
        clock.tween(Math.max(1.5, S.n * .2), function (p) { var k = Math.floor(p * S.n + 1e-9); pts.forEach(function (c, i) { c.style.opacity = i < k ? 1 : 0; }); if (p >= 1) { if (!line) line = ch.line(S.ser.cob, "l-data", g); pts.forEach(function (c) { c.style.opacity = 1; g.appendChild(c); }); } });
        cap(st, "Dados fictícios: " + S.ser.anos[0] + " a " + S.ser.anos[S.n - 1] + "."); } },

    { t: "Trocar a escala (logaritmo)", // 2
      kid: "Uma queda de 10% ao ano tira, a cada ano, 10% do que sobrou, e não sempre o mesmo número de pontos. O logaritmo (ln) é uma conversão que transforma essa queda em uma reta, mais fácil de medir.",
      limite: "Limite da analogia: uma reta no ln quer dizer variação percentual constante. Não quer dizer perda constante em pontos percentuais.",
      pc: function () { return "Divide a cobertura por 100 e aplica o logaritmo natural (ln) em cada ano."; },
      conta: function (S) { var r = S.ser.cob.slice(0, Math.min(S.n, 5)).map(function (c, i) { return "<span class=eq>" + S.ser.anos[i] + ": ln(" + fmt(c / 100, 2) + ") = " + f4(Math.log(c / 100)) + "</span>"; }).join(""); return r + (S.n > 5 ? "<span class=eq>… (as demais " + (S.n - 5) + " seguem o mesmo cálculo)</span>" : ""); },
      tech: function () { return "<p>Modelo log-linear: ln(y) = b₀ + b₁·x + e. Dentro de cada segmento, ln da taxa é linear no tempo e APC = (e<sup>b₁</sup> − 1) × 100, o que pressupõe variação percentual constante no segmento. Percentuais devem ser transformados em proporções antes da análise.</p><p>Escolha entre linear e log-linear: o manual manda escolher o modelo cuja análise de resíduos indique melhor ajuste. Com cobertura perto do teto de 100%, isso precisa ser verificado nos resíduos.</p>"; },
      q: "Por que não ajustar a cobertura direto, sem ln?", a: "Seria um modelo linear em pontos percentuais. O manual aceita os dois e manda escolher pela análise de resíduos; o APC percentual vem do modelo log-linear. A escolha para a série real depende da análise dos resíduos.",
      viz: function (st, S) { var a = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0] / 100, ymax: 1, ystep: S.key === "5" ? .1 : .05, yfmt: function (v) { return fmt(v, 2); }, ylabel: "proporção", h: 190, label: "Proporção por ano" });
        var lo = Math.log(S.yr[0] / 100), b = new C.Chart(st, { xs: S.ser.anos, ymin: lo, ymax: 0, ystep: S.key === "5" ? .2 : .05, yfmt: function (v) { return fmt(v, 2); }, ylabel: "ln(proporção)", h: 190, label: "ln da proporção por ano" });
        a.points(S.ser.cob.map(function (c) { return c; }).map(function (c) { return c; }), "pt", 0, a.g);
        a.g.textContent = ""; a.setY(S.yr[0] / 100, 1); var pa = a.points(S.ser.cob.map(function (c) { return c / 100; }), "pt", 5, a.g), pb = b.points(S.y, "pt", 5, b.g);
        pb.forEach(function (p) { p.style.opacity = 0; });
        clock.tween(Math.max(1.5, S.n * .2), function (p) { var k = Math.floor(p * S.n + 1e-9); pb.forEach(function (c, i) { c.style.opacity = i < k || p >= 1 ? 1 : 0; }); });
        cap(st, "Em cima: proporção. Embaixo: ln da proporção, que é a escala em que o Joinpoint ajusta as retas."); } },

    { t: "Uma reta só", // 3
      kid: "Primeiro tentamos descrever todos os anos com uma única reta. Os tracinhos vermelhos mostram a distância entre cada ponto e a reta: é o erro de cada ano.",
      pc: function () { return "Acha a reta que fica mais perto de todos os pontos e soma o quadrado dos erros. Essa soma é o erro total, chamado de SSE."; },
      conta: function (S) { var b = S.f0.beta; return "<span class=eq>Reta no ln: ln(y) = " + f4(b[0]) + " + (" + f4(b[1]) + ")·x</span><span class=eq>Soma dos quadrados dos erros da reta única: <b>SSE_N = " + f4(S.f0.sse) + "</b></span><span class=eq>Variação percentual anual desta reta única: (e^" + f4(b[1]) + " − 1)·100 = " + sg((Math.exp(b[1]) - 1) * 100, 2) + "%</span>"; },
      tech: function () { return "<p>É o modelo nulo da primeira comparação: k = 0 joinpoints, sem dobra. O ajuste é por mínimos quadrados ordinários, que supõe erros não correlacionados com variância constante. O SSE mínimo para k joinpoints vem do grid search de Lerman; para k = 0 é simplesmente a reta de mínimos quadrados.</p>"; },
      q: "O que é SSE?", a: "A soma dos quadrados das distâncias entre cada ponto e a linha do modelo, na escala ln. Quanto menor, melhor o ajuste.",
      viz: function (st, S) { var ch = baseChart(st, S, "Uma reta única"), g = ch.g, fit = pctFit(S, S.f0.fitted);
        ch.line(fit, "l-null", g); var res = S.ser.cob.map(function (c, i) { return el("line", { x1: ch.x(i), x2: ch.x(i), y1: ch.y(c), y2: ch.y(c), "class": "res" }, g); });
        ch.line(S.ser.cob, "l-data", g); ch.points(S.ser.cob, "pt", 5, g);
        clock.tween(Math.max(1.5, S.n * .25), function (p) { res.forEach(function (r, i) { var q = Math.max(0, Math.min(1, p * S.n - i)); r.setAttribute("y2", ch.y(S.ser.cob[i] + (fit[i] - S.ser.cob[i]) * q)); }); });
        cap(st, "Linha tracejada: reta única. Risquinhos vermelhos: erro de cada ano."); } },

    { t: "A dobra", // 4
      kid: "Agora a reta pode dobrar em um ponto, a “dobra”. As duas partes precisam se encontrar na dobra. O computador testa uma dobra em cada ano possível e fica com a que deixa o erro total menor.",
      limite: "Limite da analogia: a dobra só pode ficar em um ano da série (por padrão), e não pode ficar perto demais das pontas.",
      pc: function (S) { var m = ST.enumerateTaus(S.n, 1, 2, 2).length; return "Testa " + m + " posição(ões) possível(is) para a dobra, calcula o erro total (SSE) de cada uma e escolhe a menor (busca em grade). " + (S.key === "5" ? "Com 5 pontos, a restrição de 2 pontos nas pontas deixa só 1 posição: 2022." : "Abaixo você também pode ver o melhor ajuste com 2, 3 e 4 dobras."); },
      conta: function (S) { var c = ST.bestFit(S.y, 1, Object.assign({ collect: true }, OPTS)); return "<span class=eq>Posições testadas: " + c.nConfigs + "</span><span class=eq>Melhor dobra: <b>" + S.ser.anos[c.taus[0]] + "</b> com SSE = " + f4(c.sse) + " (contra " + f4(S.f0.sse) + " da reta única)</span>"; },
      tech: function () { return "<p>Modelo: E[y|x] = β₀ + β₁x + δ₁(x − τ₁)₊, contínuo em τ₁. Grid search de Lerman: cria uma grade de todas as posições permitidas e calcula o SSE em cada uma. Por padrão, joinpoints só em observações; não pode haver joinpoint a menos de 2 pontos das pontas, e deve haver pelo menos 2 pontos entre dois joinpoints.</p><p>Inconsistência interna do manual, documentada e não harmonizada: a página diz “Max = 7” e também “máximo de 9” para o grid search.</p>"; },
      q: "O Joinpoint prova que algo mudou naquele ano?", a: "Não. Ele escolhe o ano que melhor encaixa. Se a mudança é real, quem decide é o teste da próxima etapa, e a causa ele não explica.",
      viz: function (st, S) { var ch = baseChart(st, S, "Teste de cada posição da dobra"), g = ch.g, all = ST.bestFit(S.y, 1, Object.assign({ collect: true }, OPTS)).all, m = all.length;
        ch.points(S.ser.cob, "pt", 4, g); var cand = el("path", { "class": "l-alt", d: "" }, g), mark = el("circle", { r: 8, "class": "pt-break", cx: -20, cy: -20 }, g);
        var W4 = C.width(st), bars = el("svg", { viewBox: "0 0 " + W4 + " 110", role: "img", "aria-label": "SSE de cada posição" }, st), mx = Math.max.apply(null, all.map(function (a) { return a.sse; })), bw = (W4 - 40) / m;
        var br = all.map(function (a, i) { return el("rect", { x: 20 + i * bw + 1, y: 90, width: Math.max(2, bw - 3), height: 0, "class": "bar" }, bars); });
        el("text", { x: 20, y: 12, "font-size": 12, "class": "muted" }, bars, "SSE de cada posição da dobra (barra mais baixa = melhor)");
        var best = all.reduce(function (b, a, i) { return a.sse < all[b].sse ? i : b; }, 0), lab = el("text", { x: W4 / 2, y: 107, "text-anchor": "middle", "font-size": 12 }, bars, "");
        function draw(i) { var f = ST.fitAt(S.y, all[i].taus), v = pctFit(S, f.fitted); cand.setAttribute("d", v.map(function (q, j) { return (j ? "L" : "M") + ch.x(j).toFixed(1) + " " + ch.y(q).toFixed(1); }).join(" ")); mark.setAttribute("cx", ch.x(all[i].taus[0])); mark.setAttribute("cy", ch.y(v[all[i].taus[0]])); lab.textContent = "testando a dobra em " + S.ser.anos[all[i].taus[0]] + ": SSE = " + f4(all[i].sse); }
        clock.tween(Math.max(2, m * .45), function (p) { var k = Math.min(m - 1, Math.floor(p * m)); draw(p >= 1 ? best : k); br.forEach(function (r, i) { var upto = p >= 1 ? m : k + 1; if (i < upto) { var h = 70 * all[i].sse / mx; r.setAttribute("height", h); r.setAttribute("y", 90 - h); r.setAttribute("class", p >= 1 && i === best ? "bar-hit" : "bar"); } }); if (p >= 1) lab.textContent = "melhor dobra: " + S.ser.anos[all[best].taus[0]] + " (SSE = " + f4(all[best].sse) + ")"; });
        cap(st, "Linha vermelha: reta dobrada na dobra em teste. Círculo âmbar: a dobra. Barra de destaque: melhor posição.");
        if (S.key === "25") {
          var box = document.createElement("div"); box.className = "opts"; var grp = document.createElement("span"); grp.className = "grp"; grp.innerHTML = "<span>Ver o melhor ajuste com:</span>"; box.appendChild(grp);
          var many = el("g", {}, g), note = document.createElement("p"), btns = [];
          note.className = "cap conta"; note.textContent = "Escolha o número de dobras para ver o ajuste.";
          function show(k) { many.textContent = ""; var f = ST.bestFit(S.y, k, OPTS); if (!f) return; var v = pctFit(S, f.fitted); ch.line(v, "l-alt", many);
            (f.taus || []).forEach(function (t) { el("circle", { cx: ch.x(t), cy: ch.y(v[t]), r: 7, "class": "pt-break" }, many); });
            note.textContent = k + " dobra" + (k === 1 ? "" : "s") + ((f.taus || []).length ? " (em " + f.taus.map(function (t) { return S.ser.anos[t]; }).join(", ") + ")" : "") + ": erro total (SSE) = " + f4(f.sse) + ". Mais dobras sempre reduzem o erro; a simulação de Monte Carlo decide se a melhora compensa.";
            btns.forEach(function (b, i) { b.setAttribute("aria-pressed", String(i === k)); }); }
          [0, 1, 2, 3, 4].forEach(function (k) { var b = document.createElement("button"); b.textContent = k + (k === 1 ? " dobra" : " dobras"); b.setAttribute("aria-pressed", "false"); b.addEventListener("click", function () { show(k); }); btns.push(b); grp.appendChild(b); });
          st.appendChild(box); st.appendChild(note);
        } } },

    { t: "A dobra ajuda? A razão T", // 5
      kid: "Comparamos o erro total da reta única com o das retas com dobra. Se o erro cai muito, a razão T fica grande e a dobra ajudou. Se T fica perto de 1, a dobra quase não ajudou.",
      pc: function (S) { return "Divide o erro total (SSE) do modelo simples (" + S.seq0ka + " dobras) pelo do modelo com dobras (" + S.kMax + " dobra" + (S.kMax > 1 ? "s" : "") + ")."; },
      conta: function (S) { return "<span class=eq>SSE_N (0 dobras) = " + f4(S.f0.sse) + "</span><span class=eq>SSE_A (" + S.kMax + " dobra" + (S.kMax > 1 ? "s" : "") + ") = " + f4(S.fA.sse) + "</span><span class=eq><b>T = SSE_N / SSE_A = " + f2(S.T) + "</b></span>"; },
      tech: function () { return "<p>Estatística do teste: T = SSE_N / SSE_A. Valores de T próximos de 1 indicam que o alternativo não é muito melhor que o nulo; valores maiores indicam que é muito melhor. A distribuição de T não é obtida analiticamente, por isso se usa a permutação.</p>"; },
      q: "T grande já prova que a dobra existe?", a: "Não. Precisa comparar com o que T faria se a dobra não existisse (o liquidificador do próximo passo).",
      viz: function (st, S) { var W5 = C.width(st), s = el("svg", { viewBox: "0 0 " + W5 + " 150", role: "img", "aria-label": "Comparação de SSE" }, st), W = W5 - 150;
        var items = [["Régua única (SSE_N)", S.f0.sse, "bar"], ["Com dobra(s) (SSE_A)", S.fA.sse, "bar-hit"]], rs = [], vs = [];
        items.forEach(function (it, i) { el("text", { x: 12, y: 24 + i * 50, "font-size": 13, "font-weight": 700 }, s, it[0]); rs.push(el("rect", { x: 12, y: 32 + i * 50, width: 0, height: 22, "class": it[2] }, s)); vs.push(el("text", { x: 16, y: 48 + i * 50, "font-size": 13, fill: "#fff" }, s, "")); });
        var tt = el("text", { x: 12, y: 142, "font-size": 15, "font-weight": 700 }, s, "");
        clock.tween(2, function (p) { items.forEach(function (it, i) { var w = Math.max(2, W * it[1] / S.f0.sse * p); rs[i].setAttribute("width", w); vs[i].textContent = ""; }); tt.textContent = p >= 1 ? "T = " + f4(S.f0.sse) + " / " + f4(S.fA.sse) + " = " + f2(S.T) : ""; });
        el("text", { x: W + 20, y: 48, "font-size": 13 }, s, f4(S.f0.sse)); el("text", { x: W + 20, y: 98, "font-size": 13 }, s, f4(S.fA.sse));
        cap(st, "Barras proporcionais ao SSE. Barra menor = erros menores."); } },

    { t: "Simulação de Monte Carlo: séries falsas", // 6
      kid: "Como saber se a dobra ajudou de verdade ou foi acaso? O computador finge que a dobra não existe: pega os erros da reta única, embaralha e devolve cada um a um ano diferente, formando uma série falsa. Repete mil vezes (simulação de Monte Carlo) e vê com que frequência o ganho falso é tão grande quanto o real.",
      limite: "Atenção: embaralham-se os erros, não a ordem dos anos. A tendência da reta única continua; só o ruído muda de lugar.",
      pc: function (S) { return "Repete " + NPERM + " vezes: embaralha os erros da reta única, soma de volta à reta e refaz os ajustes, obtendo um T falso. O valor p é a fração das vezes em que o T falso é maior ou igual ao T real."; },
      conta: function (S) { return '<span class=eq>T observado = ' + f2(S.T) + '</span><span class=eq data-live="p">p = séries falsas com ganho ≥ real ÷ séries geradas</span>'; },
      tech: function () { return "<p>Permutam-se os resíduos do modelo nulo e somam-se de volta aos valores modelados por ele, formando um conjunto de dados de permutação. O p-valor é a proporção de conjuntos permutados cujo T é pelo menos tão extremo quanto o observado; rejeita-se o nulo se p for menor que o nível do teste. Sob H₀ o p-valor é uniforme em (0,1).</p><p>É uma amostra Monte Carlo das N! permutações possíveis. Mínimo 1000 réplicas, máximo 10.000, recomendação de pelo menos 4499; o padrão atual é 4499 e versões antigas usavam 999. Aqui usamos o mínimo, 1000, para a animação ser rápida. O resultado depende da semente; a nossa é fixa (" + SEED + "), então este simulador sempre dá o mesmo resultado.</p><p><b>O que o p-valor diz:</b> quão compatível o ganho observado é com o acaso sob o modelo nulo. Não “prova” a dobra.</p>"; },
      q: "Mil sorteios é o número certo?", a: "É o mínimo permitido pelo manual. A recomendação é pelo menos 4499 e o padrão atual é 4499. Com poucos sorteios o p-valor varia mais entre rodadas; por isso a semente é fixada e declarada.",
      viz: function (st, S, ctl) { return permViz(st, S, ctl); } },

    { t: "A fila de testes", // 7
      kid: "Um único teste responde só se vale a pena ter mais dobras. Por isso o computador faz uma sequência de testes: compara 0 dobras com o máximo permitido; se o máximo ganha, aceita mais uma dobra; se não, reduz o máximo. Para quando os dois lados se encontram.",
      pc: function (S) { return "Faz a sequência de testes (cada um com " + NPERM + " réplicas) e fica com o número de dobras em que a fila para."; },
      conta: function (S) { return "<div class='tbl-wrap' data-live='seq'></div>"; },
      tech: function (S) { return "<p>Procedimento sequencial: H₀: k = ka contra H₁: k = kb, começando em ka = MIN e kb = MAX; se H₀ é rejeitada sobe-se ka, senão desce-se kb, até ka = kb. A partir da versão 3.0 o nível de cada teste é α(ka, kb) = α/(MAX − ka), com α global padrão 0,05; antes da v3.0 usava-se Bonferroni. Neste exemplo MIN = 0 e MAX = " + S.kMax + ".</p><p>Mudar MIN ou MAX muda os níveis e pode mudar o modelo final. A permutação tende a detectar menos joinpoints. Desde a versão 5.0 o padrão do programa é o WBIC, e não a permutação; este simulador mostra a permutação porque é o método descrito no manual como clássico (Kim et al., 2000). A escolha para o projeto está <b>pendente</b>.</p>"; },
      q: "O programa atual ainda usa permutação?", a: "Pode usar, mas o padrão desde a versão 5.0 é o WBIC. Qual método usar é uma escolha de configuração.",
      viz: function (st, S) { var box = document.createElement("div"); st.appendChild(box); box.innerHTML = "<p class=cap>A tabela abaixo mostra cada teste da fila.</p>"; var c = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", h: 260, label: "Série e modelo escolhido" }); ch2(c, S); } },

    { t: "APC: variação por ano em cada trecho", // 8
      kid: "Cada trecho tem uma inclinação. A variação percentual anual (APC) diz quantos por cento por ano a cobertura sobe ou cai naquele trecho.",
      pc: function () { return "Pega a inclinação b de cada trecho (no ln) e calcula APC = (e^b − 1) × 100."; },
      conta: function (S) { return "<div data-live='apc'></div>"; },
      tech: function (S) { return "<p>APC = (e<sup>b</sup> − 1) × 100, com b a inclinação do segmento no ln. As inclinações são obtidas do modelo contínuo ajustado; o APC é uma variação percentual relativa, e não pontos percentuais.</p>" + (S.key === "5" ? " " : ""); },
      q: "APC de −25% quer dizer que a cobertura caiu 25 pontos por ano?", a: "Não. Quer dizer que a cobertura cai cerca de 25% do valor do ano anterior a cada ano, naquele trecho.",
      viz: function (st, S) { var c = new C.Chart(st, { xs: S.ser.anos, ymin: S.yr[0], ymax: S.yr[1], ystep: S.yr[2], ylabel: "cobertura (%)", h: 300, label: "Modelo escolhido com APC por trecho" }); ch2(c, S, true); } },

    { t: "AAPC: uma média do período", // 9
      kid: "A variação média anual (AAPC) é uma nota única para o período todo. Trechos mais longos pesam mais.",
      pc: function () { return "Faz a média das inclinações, com peso igual ao comprimento de cada trecho, e então converte em percentual por ano."; },
      conta: function (S) { return "<div data-live='aapc'></div>"; },
      tech: function () { return "<p>AAPC = { exp( Σ wᵢbᵢ / Σ wᵢ ) − 1 } × 100, com wᵢ o comprimento de cada segmento dentro do intervalo. Não é a média aritmética dos APCs. Depende do intervalo escolhido e, se o intervalo cabe em um só segmento, é igual ao APC dele.</p><p>O IC do AAPC mostrado no manual é baseado na normal. <b>Termo “método delta”:</b> não aparece nas páginas lidas do manual; por isso o simulador descreve o cálculo e não usa esse nome.</p>"; },
      q: "O AAPC é a média dos APCs?", a: "Não exatamente: é a exponencial da média ponderada das inclinações, menos 1. Com APCs moderados a diferença é pequena.",
      viz: function (st, S) { var W9 = C.width(st), box = el("svg", { viewBox: "0 0 " + W9 + " 150", role: "img", "aria-label": "Pesos dos trechos" }, st); liveAapc(box, S, W9); } },

    { t: "Margem de erro de cada trecho", // 10
      kid: "Cada trecho tem uma inclinação medida com alguma incerteza. A barra mostra a margem de erro. Se a barra cruza o zero, não dá para afirmar que a cobertura subiu ou caiu naquele trecho.",
      pc: function () { return "Para cada trecho, calcula a margem de erro (intervalo de confiança de 95%) e o valor p do teste t."; },
      conta: function (S) { return "<div data-live='tt'></div>"; },
      tech: function (S) { return "<p>O p-valor do segmento vem de um teste t bicaudal, 2{1 − t<sub>d</sub>(|U|)}, com d = n* − 2(k + 1) graus de liberdade, onde n* exclui os pontos sobre joinpoints. Os erros padrão vêm de mínimos quadrados sem a restrição de continuidade, condicionados aos joinpoints estimados e sem os pontos sobre joinpoints. IC: 100·{exp(b ± s·t<sub>d</sub>⁻¹(1 − α/2)) − 1}.</p><p><b>Este p NÃO é o da permutação</b>: o manual diz que o p do teste t é menos exato por ser assintótico. Estatísticas de inclinação exigem pelo menos 3 observações por segmento, excluindo as sobre joinpoints.</p><p>O programa atual usa por padrão o intervalo por quantil empírico; este simulador mostra o IC t descrito no manual e <b>não</b> reproduz o quantil empírico. Segmentos curtos podem ter IC paramétrico “muito liberal”.</p>"; },
      q: "Por que o exemplo de 5 pontos não mostra p nem intervalo?", a: "Porque, com 5 pontos, cada trecho tem menos de 3 observações depois de retirar o ponto sobre a dobra, e o manual diz que o erro padrão e o p não podem ser calculados assim.",
      viz: function (st, S) { ciPlot(st, S); } },

    { t: "O que o Joinpoint não diz", // 11
      kid: "O Joinpoint mostra quando a tendência mudou, não por quê. É como um termômetro: mostra a febre, não a causa.",
      pc: function () { return "Nada além do que está nos passos anteriores: ajusta, testa e resume. Não recebe informação sobre pandemia, sistema de registro ou gestão."; },
      conta: function (S) { return "<ul><li>Mostra <b>quando</b> a tendência mudou.</li><li>Não mostra <b>por quê</b>.</li><li>O ano da dobra é um ano da série, não uma data exata.</li><li>Mudanças de sistema de informação e a pandemia aparecem como dobras, mas o método não as distingue de outras causas.</li></ul>"; },
      tech: function () { return "<p>O projeto pretende testar a hipótese de que a pandemia de COVID-19 e a mudança dos sistemas de informação representam quebras estruturais (projeto de pesquisa, seção 3.4). O Joinpoint não atribui causa; a interpretação é feita à parte. Por padrão os joinpoints só ocorrem em observações, e o resultado depende de MIN, MAX, restrições e semente.</p>"; },
      q: "Uma dobra em 2020 prova efeito da pandemia?", a: "Não. Mostra que a tendência mudou por volta daquele ano. Atribuir causa exige outra evidência.",
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
    var ch = baseChart(st, S, "Séries falsas geradas pela simulação de Monte Carlo"), g = ch.g, nullLine = pctFit(S, S.f0.fitted), gl = el("g", {}, g), gp = el("g", {}, g), gr = el("g", {}, g);
    ch.line(nullLine, "l-null", g);
    var big = S.n <= 5, rReal = big ? 9 : 6, rFake = big ? 8 : 5;
    /* pontos reais: grandes, com anel, por cima de tudo */
    var real = ch.points(S.ser.cob, "pt-real", rReal, gr); real.forEach(function (c) { c.setAttribute("r", rReal); });
    var info = document.createElement("p"); info.className = "cap conta"; info.setAttribute("role", "status"); st.appendChild(info);
    var bar = document.createElement("div"); bar.className = "nav-steps"; bar.style.flexWrap = "wrap"; st.appendChild(bar);
    function mk(txt, fn) { var b = document.createElement("button"); b.className = "btn btn-small"; b.textContent = txt; b.addEventListener("click", fn); bar.appendChild(b); return b; }
    var pt, task, task2, trail = [], fake = [], links = [];
    function stats() { var n = pt.Ts.length; return { n: n, ex: pt.exceed, p: n ? pt.exceed / n : NaN }; }
    function drawFake(series) {
      gp.textContent = "";
      Array.prototype.forEach.call(series, function (v, i) {
        var yv = 100 * Math.exp(v), y0 = nullLine[i];
        el("line", { x1: ch.x(i), x2: ch.x(i), y1: ch.y(y0), y2: ch.y(yv), "class": "resid-fake" }, gp);
        el("circle", { cx: ch.x(i), cy: ch.y(yv), r: rFake, "class": "pt-fake" }, gp);
      });
    }
    function update(last) {
      var s = stats(), li = ctl.root.querySelector("[data-live=p]");
      if (last) { var d = Array.prototype.map.call(last.series, function (v) { return 100 * Math.exp(v); }); if (trail.length > 8) gl.removeChild(trail.shift()); trail.forEach(function (t) { t.style.opacity = .18; }); var p = ch.line(d, "l-perm", gl); p.style.opacity = 1; p.style.strokeWidth = 2; trail.push(p); drawFake(last.series); }
      var txt = "Séries falsas geradas: " + s.n + " de " + NPERM + ". Em " + s.ex + " delas o ganho de ajuste foi tão grande quanto o real. Valor p até agora: " + pFmt(s.ex, s.n) + ".";
      info.textContent = txt; if (li) li.textContent = "p = " + s.ex + " ÷ " + s.n + " = " + (s.n ? (s.ex === 0 ? "0 (menor que " + fmt(1 / s.n, 3) + ")" : fmt(s.ex / s.n, 3)) : "–");
    }
    function stop() { if (task) task.done = true; if (task2) task2.done = true; }
    function fresh() { stop(); trail.forEach(function (t) { if (t.parentNode) t.parentNode.removeChild(t); }); trail = []; gp.textContent = ""; pt = new ST.PermTest(S.y, 0, S.kMax, { seed: SEED, fim: OPTS.fim, entre: OPTS.entre }); update(null); }
    /* começa devagar (6 séries por segundo) para dar para ver os pontos se moverem; depois acelera */
    function auto() { stop(); var phase2 = false;
      function go() { if (pt.Ts.length < NPERM) update(pt.step()); }
      task = clock.rateTask(6, go, function () { if (pt.Ts.length >= 24 && !phase2) { phase2 = true; task2 = clock.rateTask(60, go, function () { return pt.Ts.length >= NPERM; }); } return pt.Ts.length >= 24; }); }
    fresh(); auto();
    mk("Rodar todas", function () { stop(); (function ch2() { var n = Math.min(100, NPERM - pt.Ts.length); for (var i = 0; i < n; i++) { var r = pt.step(); if (i === n - 1) update(r); } if (pt.Ts.length < NPERM) setTimeout(ch2, 0); })(); });
    mk("Uma série por vez", function () { clock.pause(); if (pt.Ts.length < NPERM) update(pt.step()); });
    mk("Recomeçar o sorteio", function () { fresh(); clock.play(); auto(); });
    var lg = document.createElement("p"); lg.className = "legend"; lg.innerHTML = "<span><i class='k-real'></i> pontos reais</span><span><i class='k-fake'></i> pontos falsos (erros embaralhados)</span><span><i class='k-null'></i> reta única</span><span><i class='k-perm'></i> reta ajustada à série falsa</span>"; st.appendChild(lg);
    cap(st, "A cada série falsa, os pontos laranja mudam de posição: o erro de cada ano foi trocado de lugar. Se quase nenhuma série falsa chega ao ganho real, a dobra provavelmente não é acaso.");
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
  function ciPlot(st, S) {
    var box = document.createElement("div"); st.appendChild(box);
    function draw() {
      box.textContent = "";
      if (!S.seq.done) { box.innerHTML = "<p class=cap>calculando…</p>"; return; }
      var inf = S.sum.inf;
      if (!inf.ok) { box.innerHTML = "<p class=cap>Com esta série curta não há observações suficientes em cada trecho para calcular a margem de erro. Escolha a série de 25 pontos.</p>"; return; }
      var segs = S.sum.segs, w = C.width(st), rowH = 44, m = { l: 92, r: 16, t: 16, b: 38 }, h = m.t + m.b + segs.length * rowH;
      var lo = Math.floor(Math.min.apply(null, segs.map(function (g) { return g.lo; }).concat([0])) / 5) * 5 - 5, hi = Math.ceil(Math.max.apply(null, segs.map(function (g) { return g.hi; }).concat([0])) / 5) * 5 + 5;
      var X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hi - lo); };
      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Margem de erro de cada trecho" }, box);
      var step = (hi - lo) > 60 ? 20 : 10;
      for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) { el("line", { x1: X(v), x2: X(v), y1: m.t, y2: h - m.b, "class": "grid" }, svg); el("text", { x: X(v), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, fmt(v, 0) + "%"); }
      el("line", { x1: X(0), x2: X(0), y1: m.t, y2: h - m.b, "class": "obs" }, svg);
      segs.forEach(function (g, i) { var y = m.t + i * rowH + rowH / 2, zero = g.lo <= 0 && g.hi >= 0;
        el("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", "font-size": 12 }, svg, segTxt(g));
        el("line", { x1: X(g.lo), x2: X(g.hi), y1: y, y2: y, "class": zero ? "ci-zero" : "ci-ok" }, svg);
        el("circle", { cx: X(g.apc), cy: y, r: 6, "class": zero ? "ci-dot-zero" : "ci-dot-ok" }, svg);
        el("text", { x: X(g.apc), y: y - 10, "text-anchor": "middle", "font-size": 11, "font-weight": 700 }, svg, sg(g.apc, 1) + "%"); });
      var p = document.createElement("p"); p.className = "cap"; p.textContent = "Ponto: variação por ano (APC). Barra: margem de erro de 95%. Linha vermelha: zero. Barra cinza = cruza o zero (não dá para afirmar que subiu ou caiu)."; box.appendChild(p);
    }
    S.listeners.push(draw); draw();
  }
  function ttHtml(S) {
    if (!S.seq.done) return "<p>calculando a fila de testes…</p>";
    var inf = S.sum.inf;
    if (!inf.ok) return "<div class='callout alert'><b>Não calculável neste exemplo</b>Graus de liberdade d = n* − 2(k + 1) = " + inf.nStar + " − " + 2 * (S.k + 1) + " = " + inf.df + ". Após retirar os pontos sobre as dobras, restam " + inf.nStar + " pontos para estimar " + 2 * (S.k + 1) + " parâmetros. O manual diz que o erro padrão da inclinação e o p não podem ser calculados com menos de 3 observações por trecho. Por isso o simulador <b>não</b> mostra p nem IC por trecho aqui.</div>";
    var t = S.sum.segs.map(function (g) { return "<tr><td>" + segTxt(g) + "</td><td class=num>" + sg(g.apc, 2) + "%</td><td class=num>" + f4(g.se) + "</td><td class=num>" + fmt(g.t, 2) + "</td><td class=num>" + (g.p < 0.001 ? "&lt; 0,001" : fmt(g.p, 3)) + "</td><td class=num>" + sg(g.lo, 2) + "% a " + sg(g.hi, 2) + "%</td></tr>"; }).join("");
    return "<p>gl = n* − 2(k + 1) = " + inf.nStar + " − " + 2 * (S.k + 1) + " = " + inf.df + "</p><div class='tbl-wrap'><table><tr><th>Trecho</th><th class=num>APC</th><th class=num>EP (b)</th><th class=num>t</th><th class=num>p (teste t)</th><th class=num>IC95% t</th></tr>" + t + "</table></div><p>Um APC com p ≥ 0,05 é classificado como estacionário no projeto (projeto de pesquisa, seção 3.4), mas p alto num trecho curto também pode ser falta de poder.</p>";
  }

  /* ---------- tela do passo a passo ---------- */
  var ARW = { prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>' };
  function chips(label, opts, cur, onPick) {
    var g = document.createElement("span"); g.className = "grp"; g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
    var l = document.createElement("span"); l.textContent = label + ":"; g.appendChild(l);
    opts.forEach(function (o) { var b = document.createElement("button"); b.type = "button"; b.textContent = o[1]; b.setAttribute("aria-pressed", String(o[0] === cur)); b.addEventListener("click", function () { onPick(o[0]); }); g.appendChild(b); });
    return g;
  }
  function renderPassos(root, app, state) {
    var S = prep(state.ds); S.seq0ka = 0;
    if (state.simple === undefined) state.simple = true;
    var order = state.simple ? SIMPLE : STEPS.map(function (x, i) { return i; }), N = order.length;
    var idx = Math.max(0, Math.min(N - 1, (state.step || 1) - 1)), st = STEPS[order[idx]];
    clock.clear(); S.listeners.length = 0; root.innerHTML = "";
    var ds = document.createElement("div"); ds.className = "opts";
    ds.appendChild(chips("Série", [["5", "5 pontos"], ["25", "25 pontos"]], state.ds, function (v) { state.ds = v; renderPassos(root, app, state); app.remount && app.remount(); }));
    ds.appendChild(chips("Roteiro", [[true, "simplificado"], [false, "completo"]], state.simple, function (v) { state.simple = v; state.step = 1; app.go(state, 1); }));
    root.appendChild(ds);
    var head = document.createElement("div"); head.className = "stephead";
    var back = document.createElement("button"); back.className = "arrow"; back.innerHTML = ARW.prev; back.setAttribute("aria-label", "Passo anterior"); back.title = "Passo anterior"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "arrow"; nxt.innerHTML = ARW.next; nxt.setAttribute("aria-label", "Próximo passo"); nxt.title = "Próximo passo"; nxt.disabled = idx === N - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    var no = document.createElement("p"); no.className = "stepno"; no.textContent = "Passo " + (idx + 1) + " de " + N;
    head.appendChild(back); head.appendChild(no); head.appendChild(nxt); root.appendChild(head);
    var pr = document.createElement("div"); pr.className = "progress"; pr.setAttribute("role", "progressbar"); pr.setAttribute("aria-valuemin", "1"); pr.setAttribute("aria-valuemax", String(N)); pr.setAttribute("aria-valuenow", String(idx + 1)); pr.innerHTML = '<i style="width:' + ((idx + 1) / N * 100) + '%"></i>'; root.appendChild(pr);
    var h2 = document.createElement("h2"); h2.id = "step-h"; h2.tabIndex = -1; h2.textContent = (idx + 1) + ". " + st.t; root.appendChild(h2);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var ctl = { root: root };
    var body = document.createElement("div"); root.appendChild(body);
    body.innerHTML =
      "<div class='callout kid'><b>Explicação simplificada</b>" + st.kid + (st.limite ? "<br><em>" + st.limite + "</em>" : "") + "</div>" +
      "<div class=card><span class=lbl>O que o computador faz</span>" + st.pc(S) + "</div>" +
      "<div class='card conta'><span class=lbl>Conta na tela</span>" + st.conta(S) + "</div>" +
      "<details class=tech" + (app.tech() ? " open" : "") + "><summary>Ver a versão técnica</summary>" + st.tech(S) + "</details>";
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
  function tabContexto() { return "<div class=card><h2>Qual pergunta este método responde?</h2><p>A cobertura vacinal de Alagoas, de 2000 a 2024, subiu, caiu ou mudou de direção? E em que anos a direção mudou?</p><p>A Regressão Joinpoint divide a série em trechos de reta e estima, em cada trecho, quantos por cento por ano a cobertura muda (APC), além de uma média do período (AAPC). No projeto, ela também vai ser usada para testar se a pandemia de COVID-19 e a mudança dos sistemas de informação aparecem como quebras na tendência (projeto de pesquisa, seção 3.4).</p></div>" +
    "<div class='callout alert'><b>Atenção</b>Todos os números deste simulador são fictícios e foram feitos só para mostrar o mecanismo. Nada aqui é resultado da pesquisa.</div><p>A simulação está no topo desta página. As perguntas frequentes ficam no final.</p>"; }
  function tabDados(S) {
    var rows = function (K) { var s = K === "5" ? D.serie5 : D.serie25; return s.anos.map(function (a, i) { return "<tr><td>" + a + "</td><td class=num>" + s.cob[i] + "</td><td class=num>" + fmt(s.cob[i] / 100, 2) + "</td><td class=num>" + f4(Math.log(s.cob[i] / 100)) + "</td></tr>"; }).join(""); };
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class='tbl-wrap'><table><tr><th>Variável</th><th>Papel</th><th>Unidade</th><th>Período</th><th>Fonte presumida</th></tr><tr><td>Ano</td><td>tempo (eixo x)</td><td>ano</td><td>2020–2024 (didática) e 2000–2024 (25 pontos)</td><td>fictícia</td></tr><tr><td>Cobertura vacinal</td><td>desfecho (eixo y)</td><td>% (convertida em proporção e depois em ln)</td><td>idem</td><td>fictícia; no projeto real, doses ÷ nascidos vivos × 100 (projeto de pesquisa, seção 3.3)</td></tr></table></div></div>" +
    "<div class=card><h3>Série didática (5 pontos)</h3><div class='tbl-wrap'><table><tr><th>Ano</th><th class=num>Cobertura (%)</th><th class=num>Proporção</th><th class=num>ln</th></tr>" + rows("5") + "</table></div></div>" +
    "<details class=tech><summary>Série fictícia de 25 pontos (2000–2024)</summary><div class='tbl-wrap'><table><tr><th>Ano</th><th class=num>Cobertura (%)</th><th class=num>Proporção</th><th class=num>ln</th></tr>" + rows("25") + "</table></div></details>"; }
  function tabResultado() {
    var S5 = prep("5"), S25 = prep("25");
    return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Cada trecho traz um APC. No projeto, cada segmento será classificado pelo sinal e pela significância do APC como crescimento, estacionariedade ou declínio (projeto de pesquisa, seção 3.4). As dobras são lidas como anos em que a tendência mudou.</p><ul><li><b>Pode concluir:</b> a tendência mudou por volta daquele ano e quanto, em % ao ano, cada trecho sobe ou cai.</li><li><b>Não pode concluir:</b> a causa da mudança; que a dobra “foi provada” pelo p da permutação (ele indica incompatibilidade com o acaso sob o modelo nulo); que o ano da dobra é exato.</li></ul></div>" +
    "<div class=card><h3>Exemplo com a série didática (resultado do código)</h3><div id=res5></div><p class=cap>Valores calculados pelo código e conferidos contra uma implementação independente em Python.</p></div>";
  }
  function fillResultado(root) {
    var S = prep("5"), n = root.querySelector("#res5"); if (!n) return;
    function draw() { n.innerHTML = S.seq.done ? "<div class='tbl-wrap'>" + apcHtml(S) + "</div><p class=sum>AAPC (2020–2024) = " + sg(S.sum.aapc, 2) + "% ao ano</p>" : "<p>calculando…</p>"; }
    draw(); S.listeners.push(draw);
  }
  function tabLimitacoes() {
    var L = [
      "Há dois valores p diferentes. O da simulação de Monte Carlo decide quantas dobras; o do teste t de cada trecho é aproximado e, segundo o manual, menos exato.",
      "A simulação embaralha os erros do modelo mais simples, e não a ordem dos anos.",
      "Desde a versão 5.0, o padrão do programa é outro critério de seleção (WBIC); a simulação de permutação continua disponível.",
      "O resultado depende de configurações (mínimo e máximo de dobras, restrições, número de séries falsas e semente). Convém repetir com outras configurações.",
      "Série de 25 pontos é curta: a margem de erro de cada trecho exige 3 ou mais observações, e os pontos sobre as dobras são descartados.",
      "Dividir um trecho em dois reduz o poder dos testes de cada pedaço.",
      "O modelo supõe variação percentual constante em cada trecho. Com cobertura perto do teto de 100%, convém conferir os resíduos.",
      "O AAPC não é a média simples dos APCs e pode ficar perto de zero mesmo com trechos fortes de sinais opostos.",
      "O padrão supõe erros sem autocorrelação; o manual sugere testar a sensibilidade a esse pressuposto.",
      "Por padrão, as dobras só podem cair em anos observados."
    ];
    return "<div class=card><h2>Limitações e cuidados</h2><ul>" + L.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecidido() {
    return "<div class=card><h2>O que o projeto definiu</h2><ul><li>Usar a Regressão Joinpoint, com o Joinpoint Regression Program do National Cancer Institute, para a caracterização temporal da cobertura e da taxa de abandono.</li><li>Estimar APC, AAPC e pontos de inflexão significativos.</li><li>Testar a pandemia de COVID-19 e a mudança dos sistemas de informação como quebras estruturais.</li></ul></div>" +
      "<div class=card><h2>Escolhas de configuração do método</h2><p class=cap>O manual deixa estas escolhas em aberto; elas afetam o resultado.</p><ul><li>Versão do programa.</li><li>Seleção do número de dobras: permutação ou WBIC.</li><li>Mínimo e máximo de dobras e restrições de posição.</li><li>Número de séries falsas e semente, se a permutação for usada.</li><li>Modelo de erro: variância constante ou erro padrão informado.</li></ul></div>";
  }
  function tabFontes() {
    var r = (NS.refs && NS.refs.joinpoint) || [];
    return "<div class=card><h2>Referências</h2><ul class=refs>" + r.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><h3>Joinpoint Regression Program (NCI)</h3><p>Programa gratuito do National Cancer Institute, citado no projeto. Há versão com interface gráfica e versão de linha de comando (página oficial, consulta em 26/10/2026).</p>" +
      "<h3>R: pacote segmented</h3><p>Pacote do R para regressão com pontos de quebra. Não substitui o programa do NCI na descrição metodológica sem conferir se o método de seleção é o mesmo.</p>" +
      "<h3>Conferência neste repositório</h3><p>O arquivo <code>tests/check_joinpoint.py</code> refaz em Python (numpy e scipy) a busca em grade, o APC, o AAPC, o teste t e a simulação com a mesma semente, e compara com o motor JavaScript: 74 comparações, 0 divergências.</p><pre>node tests/dump_js.js &gt; js.json\npython3 tests/check_joinpoint.py js.json</pre></div>";
  }
  function tabFaq() { return "<div class=card>" + STEPS.map(function (x) { return "<h3>" + x.q + "</h3><p>" + x.a + "</p>"; }).join("") + "</div>"; }

  NS.methods.joinpoint = {
    id: "joinpoint", n: 2, nome: "Regressão Joinpoint", ready: true, steps: STEPS.length, count: function (st) { return st.simple === false ? STEPS.length : SIMPLE.length; },
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decisões do projeto"], ["fontes", "Referências"], ["rodar", "Como rodar de verdade"], ["faq", "Perguntas frequentes"]],
    render: function (tab, root, app, state) {
      state.ds = state.ds || "5";
      if (tab === "passos") { renderPassos(root, app, state); return; }
      var html = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimitacoes, decisao: tabDecidido, fontes: tabFontes, rodar: tabRodar, faq: tabFaq }[tab]();
      root.innerHTML = html; if (tab === "resultado") fillResultado(root);
    }
  };
})();
