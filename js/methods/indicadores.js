/* Método 1: Indicadores (cobertura, abandono, homogeneidade). Fontes: PDF seção 3.3, S5y, S5r, S5k, S5m.
   Números calculados em js/indicadores_core.js; dados 100% fictícios. */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {}); NS.methods = NS.methods || {};
  var I = NS.ind, C = NS.charts, clock = NS.clock, fmt = C.fmt, el = C.el;
  var R = I.tudo(), L = R.linhas, SMALL = { nv: 45, d3: 41 };

  function seal(s) {
    var m = { "LIDO": ["ok", "LIDO"], "LIDO-WebFetch": ["ok", "LIDO-WebFetch"], "PDF": ["ok", "PDF do projeto"], "DECISÃO": ["ok", "decisão do discente"],
      "SECUNDÁRIO": ["", "SECUNDÁRIO · a confirmar"], "NÃO LOCALIZADO": ["", "NÃO LOCALIZADO · a confirmar"], "INFERÊNCIA": ["", "inferência · a confirmar"],
      "NÃO VERIFICADO": ["", "não verificado · a confirmar"] }[s] || ["", s];
    return '<span class="seal ' + m[0] + '">' + m[1] + "</span>";
  }
  function src(list) { return '<p class="srcline"><b>Fonte:</b> ' + list.map(function (x) { return x[0] + " " + seal(x[1]); }).join(" ") + "</p>"; }
  function cap(stage, txt) { var p = document.createElement("p"); p.className = "cap"; p.textContent = txt; stage.appendChild(p); return p; }
  function f1(x) { return fmt(x, 1); }

  /* Gráfico de barras por município. vals: array; opts: ymax, meta (linha), cls(i), label */
  function bars(stage, vals, o) {
    var w = C.width(stage), h = o.h || 300, m = { l: 48, r: 12, t: 24, b: 54 }, n = vals.length, ymin = o.ymin || 0, ymax = o.ymax, step = o.step || 25;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": o.label }, stage);
    var Y = function (v) { return m.t + (h - m.t - m.b) * (1 - (v - ymin) / (ymax - ymin)); }, bw = (w - m.l - m.r) / n;
    for (var v = Math.ceil(ymin / step) * step; v <= ymax + 1e-9; v += step) {
      el("line", { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v), "class": "grid" }, svg);
      el("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, svg, fmt(v, 0));
    }
    if (ymin < 0) el("line", { x1: m.l, x2: w - m.r, y1: Y(0), y2: Y(0), "class": "axis", stroke: "currentColor" }, svg);
    var rects = vals.map(function (val, i) {
      var x = m.l + i * bw + bw * .15, r = el("rect", { x: x, y: Y(Math.max(val, 0)), width: bw * .7, height: 0, "class": (o.cls && o.cls(i)) || "bar" }, svg);
      el("text", { x: m.l + i * bw + bw / 2, y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, String.fromCharCode(65 + i));
      return { r: r, top: Y(Math.max(val, 0)), bot: Y(Math.min(val, 0) < 0 ? 0 : 0), val: val, y0: Y(0), x: x, bw: bw * .7, i: i };
    });
    var labs = vals.map(function (val, i) { return el("text", { x: m.l + i * bw + bw / 2, y: Y(Math.max(val, 0)) - 5, "text-anchor": "middle", "font-size": 11, "font-weight": 700, opacity: 0 }, svg, f1(val)); });
    if (o.meta != null) { el("line", { x1: m.l, x2: w - m.r, y1: Y(o.meta), y2: Y(o.meta), "class": "obs" }, svg); el("text", { x: w - m.r, y: Y(o.meta) - 5, "text-anchor": "end", "font-size": 12, "font-weight": 700 }, svg, o.metaLabel || ("meta " + o.meta + "%")); }
    el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, svg, o.ylabel || "%");
    el("text", { x: (m.l + w - m.r) / 2, y: h - 8, "text-anchor": "middle", "font-size": 12, "class": "muted" }, svg, "municípios fictícios");
    clock.tween(1.6, function (p) {
      rects.forEach(function (b, i) {
        var hh = Math.abs(b.y0 - Y(b.val)) * p; b.r.setAttribute("height", hh); b.r.setAttribute("y", b.val >= 0 ? b.y0 - hh : b.y0);
        labs[i].setAttribute("opacity", p >= 1 ? 1 : 0);
      });
    });
    return svg;
  }
  function tabelaBase(cols) {
    return "<div class=tbl-wrap><table><tr><th>Município</th>" + cols.map(function (c) { return "<th class=num>" + c[0] + "</th>"; }).join("") + "</tr>" +
      L.map(function (x, i) { return "<tr><td>" + String.fromCharCode(65 + i) + "</td>" + cols.map(function (c) { return "<td class=num>" + c[1](x) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
  }
  var CL = function (i) { return L[i].atinge ? "bar" : "bar-hit"; };

  var STEPS = [
    { t: "Os números de cada município",
      kid: "Imagine uma classe por cidade. Contamos quantas crianças nasceram e quantas tomaram a vacina. Só isso: duas contagens por cidade.",
      pc: "Lê, para cada município, três números: nascidos vivos, crianças com a 1ª dose e crianças com a 3ª dose (a dose final do esquema).",
      conta: function () { return tabelaBase([["Nascidos vivos", function (x) { return x.nv; }], ["1ª dose", function (x) { return x.d1; }], ["3ª dose", function (x) { return x.d3; }]]); },
      tech: "<p>Linha = município; colunas = denominador (nascidos vivos, população-alvo) e doses aplicadas (PDF, seção 3.3). A escolha de qual dose representa cada imunobiológico no projeto está nos documentos da dim_tracador (S5n); aqui a “3ª dose” é só um exemplo " + "<span class='seal'>a confirmar</span>.</p>",
      fala: "São dez municípios inventados. Mostram como o indicador é montado, não dizem nada sobre Alagoas.",
      q: "De onde vêm os nascidos vivos no projeto real?", a: "O projeto aponta o SINASC como denominador; os testes e limitações dele estão no S5i e no S5m (F13).",
      src: [["PDF 3.3 a", "PDF"], ["S5i, S5m F13", "LIDO"]],
      viz: function (st) { bars(st, L.map(function (x) { return x.nv; }), { ymax: 6000, step: 1000, ylabel: "nascidos vivos", label: "Nascidos vivos por município fictício" }); cap(st, "Altura = nascidos vivos. O município F é grande e o J é minúsculo."); } },

    { t: "Cobertura vacinal",
      kid: "Cobertura é a fração da classe que tomou a vacina. Se 95 em cada 100 crianças tomaram, a cobertura é 95%.",
      pc: "Divide as doses pelos nascidos vivos e multiplica por 100, município a município.",
      conta: function () { return "<span class=eq>Cobertura = doses ÷ nascidos vivos × 100</span><span class=eq>Município A: 2.300 ÷ 2.400 × 100 = <b>" + f1(L[0].cv) + "%</b></span>" + tabelaBase([["3ª dose", function (x) { return x.d3; }], ["Nascidos", function (x) { return x.nv; }], ["Cobertura (%)", function (x) { return f1(x.cv); }]]); },
      tech: "<p>CV = razão entre doses aplicadas e população-alvo (nascidos vivos), em percentual (PDF, seção 3.3 a). Aqui o cálculo é transversal simples; o método por coorte difere (S5m F14).</p>",
      fala: "Cobertura é doses sobre nascidos vivos. Sem teto na base: o valor bruto fica guardado, como decidido no S5y.",
      q: "Por que a cobertura pode passar de 100%?", a: "Porque numerador e denominador vêm de fontes diferentes. Isso é sinal de erro de registro ou de denominador, não de “vacinar demais” (passo 6).",
      src: [["PDF 3.3 a", "PDF"], ["S5m F14", "INFERÊNCIA"]],
      viz: function (st) { bars(st, L.map(function (x) { return x.cv; }), { ymax: 150, step: 25, cls: function () { return "bar"; }, label: "Cobertura por município fictício" }); cap(st, "Altura = cobertura (%). Há municípios acima de 100%."); } },

    { t: "A meta de 95%",
      kid: "Existe uma linha de chegada: 95 crianças em cada 100. Quem chega nela ou passa, ganha um “sim”. Quem fica antes, “não”.",
      pc: "Compara a cobertura de cada município com 95 e marca sim (≥ 95) ou não (< 95). A comparação usa números inteiros para que 95,0 conte como sim.",
      conta: function () { return "<span class=eq>sim se doses × 100 ≥ 95 × nascidos</span><span class=eq>Município I: 1.425 × 100 = 142.500 ≥ 95 × 1.500 = 142.500 → <b>sim</b></span>" + tabelaBase([["Cobertura (%)", function (x) { return f1(x.cv); }], ["≥ 95?", function (x) { return x.atinge ? "sim" : "não"; }]]); },
      tech: "<p>A meta de 95% é “preconizada pelo Ministério da Saúde” no PDF (seção 3.3 c). O registro oficial mais antigo localizado é a Portaria MS nº 2.394/2003 " + seal("LIDO-WebFetch") + " (agregador, não DOU); o ato originário e a data da meta " + seal("NÃO LOCALIZADO") + " (S5r).</p>",
      fala: "A meta de 95% aparece em documentos oficiais de 2003 a 2026. O ato que a criou não foi localizado, e eu não vou citar um ato único.",
      q: "Quem fixou os 95%?", a: "Não localizado. Há documentos de 2003, 2013, 2022, 2025 e 2026 que usam o valor; citar o conjunto e a Portaria 2.394/2003 como o registro mais antigo achado (decisão de citar é do discente).",
      src: [["S5r tabela 2", "LIDO-WebFetch"], ["S5r seção 1", "NÃO LOCALIZADO"]],
      viz: function (st) { bars(st, L.map(function (x) { return x.cv; }), { ymax: 150, step: 25, meta: 95, cls: CL, label: "Municípios que atingem 95%" }); cap(st, "Barra azul: atingiu 95%. Barra de destaque: não atingiu."); } },

    { t: "Homogeneidade",
      kid: "Não basta a média da cidade grande ser boa. Perguntamos: quantas cidades chegaram na linha? Se só metade chegou, ainda há muitos bolsões sem proteção.",
      pc: "Conta quantos municípios atingiram a meta e divide pelo total de municípios.",
      conta: function () { return "<span class=eq>Homogeneidade = municípios com cobertura ≥ 95% ÷ total de municípios × 100</span><span class=eq>" + R.nAtinge + " ÷ " + R.n + " × 100 = <b>" + f1(R.homog) + "%</b></span>"; },
      tech: "<p>Definição do projeto (PDF, seção 3.3 c) igual à de Teixeira e Rocha 2010 " + seal("LIDO-WebFetch") + ". Existem outras definições em uso (S5r seção 4): adequada se pelo menos 70% dos municípios atingem a meta (Portaria 91/2007, Caderno 2013-2015, Cunha 2023, Araújo 2025) e proporção de vacinas por município (COAP, PQA-VS). O projeto usa a proporção bruta, sem o corte de 70%. Reportar também a classificação de 70% está " + seal("pendente") + " (S5r seção 5).</p>",
      fala: "Homogeneidade aqui é a proporção de municípios que chegaram a 95%. Não uso o corte de 70% do SI-PNI como definição principal.",
      q: "Por que não a média estadual?", a: "A média esconde municípios abaixo da meta, e a justificativa citada é reduzir bolsões de suscetíveis (Teixeira e Rocha 2010, LIDO-WebFetch).",
      src: [["PDF 3.3 c", "PDF"], ["S5r seção 3 e 4", "LIDO-WebFetch"]],
      viz: function (st) {
        var w = C.width(st), h = 120, svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Quadrados dos municípios" }, st), n = R.n, gap = 6, s = Math.min(48, (w - 16 - gap * (n - 1)) / n), x0 = (w - (s * n + gap * (n - 1))) / 2, qs = [];
        L.forEach(function (x, i) { var r = el("rect", { x: x0 + i * (s + gap), y: 20, width: s, height: s, rx: 4, "class": "bar-hit", opacity: .35 }, svg); el("text", { x: x0 + i * (s + gap) + s / 2, y: 20 + s / 2 + 5, "text-anchor": "middle", "font-size": 13, "font-weight": 700 }, svg, String.fromCharCode(65 + i)); qs.push(r); });
        var t = el("text", { x: w / 2, y: 20 + s + 28, "text-anchor": "middle", "font-size": 15, "font-weight": 700 }, svg, "0 de " + n);
        clock.tween(2.2, function (p) { var k = Math.floor(p * n + 1e-9), c = 0; L.forEach(function (x, i) { if (i < k) { qs[i].setAttribute("opacity", 1); qs[i].setAttribute("class", x.atinge ? "bar" : "bar-hit"); if (x.atinge) c++; } }); t.textContent = (p >= 1 ? R.nAtinge : c) + " de " + n + " atingiram (" + f1(100 * (p >= 1 ? R.nAtinge : c) / n) + "% se parasse aqui)"; });
        cap(st, "Os quadrados acendem um a um; azul = atingiu 95%."); } },

    { t: "Taxa de abandono",
      kid: "Algumas crianças começam o esquema e não terminam. O abandono diz de cada 100 que começaram, quantas não chegaram à última dose.",
      pc: "Subtrai as doses finais das iniciais, divide pelas iniciais e multiplica por 100. Se der negativo, acende um alerta.",
      conta: function () { return "<span class=eq>TA = (dose inicial − dose final) ÷ dose inicial × 100</span><span class=eq>Município B: (1.790 − 1.700) ÷ 1.790 × 100 = <b>" + f1(L[1].ta) + "%</b></span><span class=eq>Município G: (150 − 155) ÷ 150 × 100 = <b>" + f1(L[6].ta) + "%</b> (negativa)</span>" + tabelaBase([["1ª dose", function (x) { return x.d1; }], ["3ª dose", function (x) { return x.d3; }], ["Abandono (%)", function (x) { return f1(x.ta); }], ["Faixa", function (x) { return x.classeTA; }]]); },
      tech: "<p>Fórmula do projeto: PDF, seção 3.3 b. A mesma forma aparece em OMS 2018 " + seal("LIDO-WebFetch") + ", Peck 2019 " + seal("LIDO") + " e Kirkby 2021 " + seal("LIDO") + ". Dose final maior que a inicial indica possível problema de qualidade dos dados (Kirkby 2021; OMS 2018); Kirkby exclui os negativos e Moura 2023 os substituiu pelo valor do ano anterior, decisões desses estudos e não norma. As faixas baixo (&lt; 5%), médio (5% a &lt; 10%) e alto (≥ 10%) vêm só de relato secundário " + seal("SECUNDÁRIO") + " (S5k 3.4); a classificação OMS é outra (&lt; 10%, ≥ 10%, negativo). Limitação: no dado agregado, não se rastreia a mesma criança (S5k seção 4b). Para a SCR, as duas doses ficam em coortes distintas, e Peck 2019 usa diferença de pontos percentuais em vez de abandono.</p>",
      fala: "Abandono negativo não é sucesso: é um alerta de que o registro está inconsistente. Não interpreto como melhora.",
      q: "Como o projeto trata abandono negativo?", a: "Mantém o valor e marca como alerta de qualidade (S5m F16). Substituir ou excluir ainda é decisão pendente.",
      src: [["PDF 3.3 b", "PDF"], ["S5k seção 3", "LIDO"], ["S5k 3.4 faixas", "SECUNDÁRIO"], ["S5m F16", "LIDO"]],
      viz: function (st) { bars(st, L.map(function (x) { return x.ta; }), { ymin: -10, ymax: 20, step: 5, cls: function (i) { return L[i].ta < 0 ? "bar-hit" : "bar"; }, label: "Taxa de abandono por município fictício", ylabel: "abandono (%)" }); cap(st, "Barra de destaque abaixo do zero: dose final maior que a inicial (município G)."); } },

    { t: "Cobertura acima de 100%",
      kid: "Se a classe tem 100 alunos e a lista diz que 130 foram vacinados, algo está errado na lista ou na contagem de alunos. Não é que vacinaram demais.",
      pc: "Não corta nada. Apenas liga bandeiras: acima de 100, acima de 110, acima de 120 e abaixo de 50.",
      conta: function () { return tabelaBase([["Cobertura (%)", function (x) { return f1(x.cv); }], [">100", function (x) { return x.gt100 ? "●" : ""; }], [">110", function (x) { return x.gt110 ? "●" : ""; }], [">120", function (x) { return x.gt120 ? "●" : ""; }], ["<50", function (x) { return x.lt50 ? "●" : ""; }]]) + "<p>Resumo: " + R.nGt100 + " municípios acima de 100, " + R.nGt110 + " acima de 110, " + R.nAcima120 + " acima de 120 e " + R.nLt50 + " abaixo de 50.</p>"; },
      tech: "<p>Decisão do discente de 03/10/2026 " + seal("DECISÃO") + " (S5y): base sem teto, com as bandeiras cob_gt100, cob_gt110, cob_gt120 e cob_lt50; teto de 100% só em mapas e médias, com o bruto na legenda. Os limiares vêm de dois artigos do mesmo fascículo: acima de 110% e abaixo de 50% como “eventos sentinelas” (Teixeira e Mota 2010, p. 200) e acima de 120% ou abaixo de 50% como aberrantes (Teixeira e Rocha 2010, p. 220), ambos " + seal("LIDO-WebFetch") + ". Divergência registrada, sem harmonizar: 110% contra 120%. A OMS 2022 também cita estimativas “far in excess of 100%” como sinal de baixa acurácia " + seal("LIDO-WebFetch") + ". Não se distingue erro de numerador, de denominador ou migração só com dado administrativo (S5m F15).</p>",
      fala: "Não trunco a cobertura na base. Marco os municípios acima de 110% e de 120% e declaro que os dois limiares vêm de artigos diferentes.",
      q: "Por que não limitar em 100%?", a: "Porque a homogeneidade é binária: 130% e 100% dão o mesmo “sim”. O teto só mudaria médias e mapas (S5y seção 2, inferência lógica).",
      src: [["S5y seções 1 a 3", "DECISÃO"], ["S5y tabela", "LIDO-WebFetch"], ["S5m F15", "LIDO-WebFetch"]],
      viz: function (st) { bars(st, L.map(function (x) { return x.cv; }), { ymax: 150, step: 25, meta: 120, metaLabel: "120%", cls: function (i) { return L[i].gt120 ? "bar-hit" : "bar"; }, label: "Municípios acima de 120%" }); cap(st, "Barras de destaque: acima de 120% (municípios E e G)."); } },

    { t: "Sensibilidade nos dois limites",
      kid: "Para saber se os municípios “estranhos” mudam a história, contamos de dois jeitos: com eles contando como “sim” e depois tirando-os da conta.",
      pc: "Calcula a homogeneidade três vezes: principal (bruta), limite superior (>120% contam como sim) e limite inferior (>120% saem do numerador e do denominador).",
      conta: function () { return "<span class=eq>Principal: " + R.nAtinge + " ÷ " + R.n + " × 100 = <b>" + f1(R.homog) + "%</b></span><span class=eq>(a) Limite superior (>120% como “atingiu”): " + R.nAtinge + " ÷ " + R.n + " = <b>" + f1(R.sensSup) + "%</b></span><span class=eq>(b) Limite inferior (>120% fora): " + R.nAtingeValidos + " ÷ " + R.nValidos + " × 100 = <b>" + f1(R.sensInf) + "%</b></span><p>Municípios afetados: " + R.nAcima120 + " de " + R.n + ".</p>"; },
      tech: "<p>Desenho da decisão S5y seção 3 item 3 " + seal("DECISÃO") + ": reportar os dois limites ao lado da principal e o número de municípios afetados por ano e passo. Os limiares de 110% e 100% entram só como bandeira descritiva, não como cenário. Neste exemplo, (a) coincide com a principal por construção.</p>",
      fala: "A principal é a bruta. O limite inferior mostra o quanto o resultado depende dos municípios com cobertura implausível.",
      q: "Qual das três é “a verdadeira”?", a: "Nenhuma é a verdade; a principal é a definição do projeto e as outras mostram a faixa em que ela pode estar.",
      src: [["S5y seção 3", "DECISÃO"]],
      viz: function (st) {
        var vals = [R.homog, R.sensSup, R.sensInf], names = ["Principal", "Limite superior", "Limite inferior"], w = C.width(st), h = 200, m = { l: 112, r: 50, t: 12, b: 24 }, bh = 34;
        var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Três homogeneidades" }, st), rs = [], ts = [];
        vals.forEach(function (v, i) { var y = m.t + i * (bh + 18); el("text", { x: m.l - 8, y: y + bh / 2 + 5, "text-anchor": "end", "font-size": 13 }, svg, names[i]); rs.push(el("rect", { x: m.l, y: y, width: 0, height: bh, "class": i === 2 ? "bar-hit" : "bar" }, svg)); ts.push(el("text", { x: m.l + 6, y: y + bh / 2 + 5, "font-size": 13, "font-weight": 700, fill: "#fff" }, svg, "")); });
        el("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b + 4, "class": "axis", stroke: "currentColor" }, svg);
        clock.tween(1.6, function (p) { vals.forEach(function (v, i) { rs[i].setAttribute("width", (w - m.l - m.r) * v / 100 * p); ts[i].setAttribute("x", m.l + 8); ts[i].textContent = f1(v * p) + "%"; }); });
        cap(st, "Mesmo conjunto de municípios, três leituras (escala 0 a 100%)."); } },

    { t: "Denominador pequeno",
      kid: "Numa classe de 45 alunos, um aluno a mais já muda bastante a nota da turma. Numa escola de 5.000 alunos, quase não muda.",
      pc: "Mostra o município J, com 45 nascidos: ao somar ou tirar uma criança vacinada, a cobertura salta. Clique nos botões.",
      conta: function () { return "<span class=eq>Município J: " + SMALL.d3 + " ÷ " + SMALL.nv + " × 100 = <b>" + f1(SMALL.d3 * 100 / SMALL.nv) + "%</b></span><span class=eq>Município F: 5.150 ÷ 5.200 × 100 = <b>" + f1(L[5].cv) + "%</b>; com mais 1 criança, " + f1(5151 * 100 / 5200) + "%</span><p>Municípios com menos de 1.000 nascidos neste exemplo: " + R.nPequenos + " de " + R.n + ".</p>"; },
      tech: "<p>Bandeira de denominador pequeno (&lt; 1.000 crianças), alinhada à cautela de Teixeira e Mota 2010 " + seal("LIDO-WebFetch") + " e à estratificação por porte (S5m F18; efeito sobre a inferência: " + seal("INFERÊNCIA") + "). Valores aberrantes são mais frequentes em municípios pequenos (Teixeira e Rocha 2010, p. 220, " + seal("LIDO-WebFetch") + "). Na camada 2 real, 93% das células município × ano têm denominador abaixo de 1.000 (S5m F43, VERIFICADO-DADOS), então essa bandeira sozinha discrimina pouco e foi criado o estrato porte_den.</p>",
      fala: "Em município pequeno, uma criança muda vários pontos percentuais. Por isso uso estratos de porte e não interpreto flutuação anual isolada.",
      q: "Por que não suavizar os dados?", a: "A suavização pode esconder o erro de registro, que é objeto do estudo (S5m F19). Só entra como camada opcional ao lado do bruto.",
      src: [["S5m F18, F19, F43", "LIDO-WebFetch"], ["S5y seção 3 item 5", "DECISÃO"]],
      viz: function (st) {
        var d = SMALL.d3, box = document.createElement("div"); box.className = "dataset"; st.appendChild(box);
        var out = document.createElement("p"); out.className = "sum"; out.setAttribute("aria-live", "polite");
        function mk(txt, delta) { var b = document.createElement("button"); b.className = "btn"; b.textContent = txt; b.addEventListener("click", function () { d = Math.max(0, Math.min(SMALL.nv, d + delta)); draw(); }); box.appendChild(b); }
        mk("−1 criança vacinada", -1); mk("+1 criança vacinada", 1);
        var w = C.width(st), h = 90, svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "Cobertura do município J" }, st), bar = el("rect", { x: 20, y: 24, width: 0, height: 28, "class": "bar" }, svg);
        el("line", { x1: 20 + (w - 40) * .95, x2: 20 + (w - 40) * .95, y1: 14, y2: 62, "class": "obs" }, svg); el("text", { x: 20 + (w - 40) * .95, y: 76, "text-anchor": "middle", "font-size": 12, "font-weight": 700 }, svg, "95%");
        st.appendChild(out);
        function draw() { var c = d * 100 / SMALL.nv; bar.setAttribute("width", (w - 40) * Math.min(c, 100) / 100); bar.setAttribute("class", d * 100 >= 95 * SMALL.nv ? "bar" : "bar-hit"); out.textContent = "Município J: " + d + " de " + SMALL.nv + " = " + f1(c) + "%. Atingiu 95%? " + (d * 100 >= 95 * SMALL.nv ? "sim" : "não") + ". Cada criança vale " + f1(100 / SMALL.nv) + " ponto percentual."; }
        draw(); } }
  ];
  STEPS.forEach(function (s) { var p = s.pc, c = s.conta, t = s.tech; s.pc = function () { return p; }; s.conta = typeof c === "function" ? c : function () { return c; }; s.tech = function () { return t; }; });

  function renderPassos(root, app, state) {
    var idx = Math.max(0, Math.min(STEPS.length - 1, (state.step || 1) - 1)), st = STEPS[idx];
    clock.clear(); root.innerHTML = "";
    var head = document.createElement("div"); head.innerHTML = '<p class="stepno">Passo ' + (idx + 1) + " de " + STEPS.length + '</p><div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + (idx + 1) + '"><i style="width:' + ((idx + 1) / STEPS.length * 100) + '%"></i></div><h2 tabindex="-1" id="step-h">' + (idx + 1) + ". " + st.t + "</h2>";
    root.appendChild(head);
    var stage = document.createElement("div"); stage.className = "stage"; root.appendChild(stage);
    var body = document.createElement("div"); root.appendChild(body);
    body.innerHTML =
      "<div class='callout kid'><b>Como para uma criança de 5 anos</b>" + st.kid + "</div>" +
      "<div class=card><span class=lbl>O que o computador faz</span>" + st.pc() + "</div>" +
      "<div class='card conta'><span class=lbl>Conta na tela</span>" + st.conta() + "</div>" +
      "<details class=tech" + (app.tech() ? " open" : "") + "><summary>Ver a versão técnica</summary>" + st.tech() + "</details>" +
      (app.banca() ? "<div class=banca-box><span class=lbl>Modo banca: fala pronta</span><p>" + st.fala + "</p><span class=lbl>Pergunta provável</span><p><b>" + st.q + "</b></p><p>" + st.a + "</p></div>" : "") + src(st.src);
    var nav = document.createElement("div"); nav.className = "nav-steps";
    var back = document.createElement("button"); back.className = "btn"; back.textContent = "Voltar"; back.disabled = idx === 0; back.addEventListener("click", function () { app.go(state, idx); });
    var nxt = document.createElement("button"); nxt.className = "btn primary"; nxt.textContent = idx === STEPS.length - 1 ? "Fim do método" : "Avançar"; nxt.disabled = idx === STEPS.length - 1; nxt.addEventListener("click", function () { app.go(state, idx + 2); });
    nav.appendChild(back); nav.appendChild(nxt); root.appendChild(nav);
    st.viz(stage);
    var h = root.querySelector("#step-h"); if (state.focus && h) h.focus({ preventScroll: false });
  }

  function tabContexto() { return "<div class=card><h2>Qual pergunta este método responde?</h2><p>Como medir se as crianças de cada município foram vacinadas, se terminaram o esquema e se o estado chegou à meta de forma igual em todos os municípios?</p><p>Três indicadores do projeto (PDF, seção 3.3): <b>cobertura vacinal</b>, <b>taxa de abandono</b> e <b>homogeneidade</b>. Eles alimentam todos os métodos seguintes.</p></div><div class='callout alert'><b>Atenção</b>Todos os números deste simulador são fictícios e servem só para mostrar o mecanismo. Nada aqui é resultado da pesquisa.</div><p>Use a aba <b>Passo a passo</b>; o botão <b>Modo banca</b> mostra a fala pronta e a pergunta provável.</p>"; }
  function tabDados() {
    return "<div class=card><h2>Dados e variáveis (fictícios)</h2><div class=tbl-wrap><table><tr><th>Variável</th><th>Papel</th><th>Unidade</th><th>Fonte no projeto real</th></tr><tr><td>Nascidos vivos</td><td>denominador</td><td>crianças</td><td>SINASC (S5i) " + seal("LIDO") + "</td></tr><tr><td>Doses aplicadas (1ª e 3ª)</td><td>numerador</td><td>doses</td><td>DBF/CSV do SI-PNI (S5aa) " + seal("LIDO") + "</td></tr><tr><td>Cobertura, abandono</td><td>desfechos</td><td>%</td><td>calculados</td></tr></table></div></div>" +
      "<div class=card><h3>Dez municípios fictícios</h3>" + tabelaBase([["Nascidos", function (x) { return x.nv; }], ["1ª dose", function (x) { return x.d1; }], ["3ª dose", function (x) { return x.d3; }], ["Cobertura (%)", function (x) { return f1(x.cv); }], ["Abandono (%)", function (x) { return f1(x.ta); }]]) + "</div>";
  }
  function tabResultado() { return "<div class=card><h2>Resultado esperado e como lê-lo</h2><p>Por município e ano: cobertura, abandono e bandeiras de qualidade. Por estado e ano: homogeneidade (principal e dois limites). Séries desses indicadores seguem para o Joinpoint e para os métodos espaciais.</p><ul><li><b>Pode concluir:</b> quantos municípios atingiram 95% e quais têm sinal de inconsistência.</li><li><b>Não pode concluir:</b> se a baixa cobertura é falta de vacinação ou falha de registro (S5m F21).</li></ul></div><div class=card><h3>Exemplo fictício</h3><p>Homogeneidade: " + f1(R.homog) + "% (principal), " + f1(R.sensSup) + "% (limite superior) e " + f1(R.sensInf) + "% (limite inferior). Abandono negativo em " + R.nNegTA + " município. Denominador abaixo de 1.000 em " + R.nPequenos + " de " + R.n + ".</p></div>"; }
  function tabLimites() {
    var Ls = [["Numerador e denominador vêm de fontes diferentes; só com dado administrativo não se separa erro de registro, de denominador e migração.", "S5m F15", "LIDO-WebFetch"], ["Abandono agregado compara doses do período, não acompanha a mesma criança.", "S5k 4b", "SECUNDÁRIO"], ["Dose final maior que a inicial indica possível problema de qualidade.", "S5m F16", "LIDO"], ["Cobertura transversal não é cobertura de coorte.", "S5m F14, F43", "INFERÊNCIA"], ["Municípios pequenos têm cobertura volátil.", "S5m F18", "LIDO-WebFetch"], ["Subregistro e atraso do SINASC afetam o denominador.", "S5m F13", "LIDO"], ["Para a SCR, as duas doses estão em coortes distintas e a fórmula de abandono é questionável.", "S5k 4c", "LIDO"], ["As faixas de abandono 5% e 10% só têm fonte secundária.", "S5k 3.4", "SECUNDÁRIO"], ["O ato originário da meta de 95% não foi localizado.", "S5r", "NÃO LOCALIZADO"]];
    return "<div class=card><h2>Limitações e pegadinhas</h2><ul>" + Ls.map(function (l) { return "<li>" + l[0] + " <small>" + l[1] + "</small> " + seal(l[2]) + "</li>"; }).join("") + "</ul></div>";
  }
  function tabDecisao() {
    var D = ["Cobertura = doses ÷ nascidos vivos × 100; abandono = (inicial − final) ÷ inicial × 100; homogeneidade = proporção de municípios com 95% ou mais (PDF 3.3).", "Cobertura sem teto na base, com bandeiras >100, >110, >120 e <50 (S5y, 03/10/2026).", "Análise principal bruta; sensibilidade em dois limites para >120%.", "Teto de 100% só em mapas e médias, com o bruto na legenda.", "Denominador pequeno (<1.000) como bandeira à parte; estratos por porte."];
    var P = ["Definição de homogeneidade a reportar além da bruta: classificação de 70% do SI-PNI, ou ambas (S5r seção 5).", "Tratamento do abandono negativo: manter como alerta, excluir ou substituir.", "Faixas de classificação do abandono (5% e 10%): confirmar em fonte primária.", "Ato originário da meta de 95% e documentos de 2000 a 2002.", "Qual dose representa cada imunobiológico em cada era (S5n)."];
    return "<div class=card><h2>O que o projeto já decidiu</h2><ul>" + D.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div><div class=card><h2>O que está pendente</h2><ul>" + P.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  function tabFontes() {
    var F = [["PDF do projeto, seção 3.3", "definições de CV, TA e homogeneidade", "PDF"], ["S5y", "decisão sobre cobertura acima de 100%", "DECISÃO"], ["S5r", "meta de 95% e homogeneidade; Portaria MS 2.394/2003, Teixeira e Rocha 2010", "LIDO-WebFetch"], ["S5k", "OMS 2018, Peck 2019, Kirkby 2021, Moura 2023", "LIDO"], ["S5k 3.4", "faixas de abandono 5% e 10% (via Epidemiol Serv Saúde 2021)", "SECUNDÁRIO"], ["S5m", "fragilidades F13 a F19, F43", "LIDO"]];
    return "<div class=card><h2>Fontes e status de verificação</h2><div class=tbl-wrap><table><tr><th>Fonte</th><th>Uso</th><th>Status</th></tr>" + F.map(function (f) { return "<tr><td>" + f[0] + "</td><td>" + f[1] + "</td><td>" + seal(f[2]) + "</td></tr>"; }).join("") + "</table></div><p>Trechos literais e páginas estão nos fichamentos citados. Aspas marcadas LIDO-WebFetch devem ser reconferidas no PDF antes de entrarem no texto do projeto.</p></div>";
  }
  function tabRodar() {
    return "<div class=card><h2>Como rodar de verdade</h2><p>Entradas: tabelas da camada 2 (doses por município, ano e passo; S5z, S5aa) e nascidos vivos do SINASC por município e ano.</p><h3>Python (pandas)</h3><pre>df['cv'] = df['doses'] * 100 / df['nascidos']\ndf['ta'] = (df['dose1'] - df['dose3']) * 100 / df['dose1']\ndf['atinge'] = df['doses'] * 100 &gt;= 95 * df['nascidos']\nhomog = df.groupby('ano')['atinge'].mean() * 100</pre><p>Os nomes de coluna acima são exemplos. A mesma lógica vale em R (dplyr) " + seal("NÃO VERIFICADO") + " quanto a pacotes específicos.</p><p>Pacotes para ler DBF/DBC do DATASUS (por exemplo microdatasus, read.dbc): " + seal("NÃO VERIFICADO") + ". Confirmar na documentação oficial antes de citar.</p><h3>Conferência independente</h3><pre>node tests/dump_indicadores.js &gt; ind_js.json\npython3 tests/check_indicadores.py ind_js.json</pre></div>";
  }

  NS.methods.indicadores = {
    id: "indicadores", n: 1, nome: "Indicadores", ready: true, steps: STEPS.length,
    tabs: [["contexto", "Contexto"], ["dados", "Dados"], ["passos", "Passo a passo"], ["resultado", "Resultado"], ["limites", "Limitações"], ["decisao", "Decidido x pendente"], ["fontes", "Fontes"], ["rodar", "Como rodar de verdade"]],
    render: function (tab, root, app, state) {
      if (tab === "passos") { renderPassos(root, app, state); return; }
      clock.clear(); root.innerHTML = { contexto: tabContexto, dados: tabDados, resultado: tabResultado, limites: tabLimites, decisao: tabDecisao, fontes: tabFontes, rodar: tabRodar }[tab]();
    }
  };
})();
