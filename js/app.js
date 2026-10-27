/* Casca do aplicativo: navegação por hash (#metodo/passo ou #metodo/aba), temas, modo banca, controle de velocidade. */
(function () {
  "use strict";
  var NS = window.PPGCS, clock = NS.clock, M = NS.methods;
  var LIST = [
    { id: "indicadores", n: 1, nome: "Indicadores", d: "Cobertura, abandono e homogeneidade." },
    { id: "joinpoint", n: 2, nome: "Regressão Joinpoint", d: "Quando a tendência muda e quanto." },
    { id: "aede", n: 3, nome: "AEDE", d: "Vizinhança e defasagem espacial." },
    { id: "moran", n: 4, nome: "I de Moran Global", d: "Existe padrão espacial no conjunto?" },
    { id: "lisa", n: 5, nome: "Moran Local (LISA)", d: "Onde estão os aglomerados e os pontos fora da curva?" },
    { id: "satscan", n: 6, nome: "Varredura de Kulldorff", d: "Aglomerados no espaço e no tempo." },
    { id: "gwr", n: 7, nome: "VIF, OLS e GWR", d: "O que ajuda a explicar a cobertura." },
    { id: "encaixe", n: 8, nome: "Como se encaixam", d: "A cadeia do projeto e o que cada método não responde." }
  ];
  var $ = function (s) { return document.querySelector(s); };
  var view = $("#view"), tabsEl = $("#tabs"), menu = $("#menu"), states = {}, flags = { banca: false, tech: false };
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  var app = {
    banca: function () { return flags.banca; }, tech: function () { return flags.tech; },
    go: function (state, n) { nav(state.id + "/" + n); }
  };

  /* Rota guardada em memória; o hash é só um espelho (alguns ambientes embutidos não repassam hash com barra). */
  var here = ""; try { here = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {}
  function nav(r) { here = r; window.__focusNext = true; try { location.hash = r ? "#" + r : ""; } catch (e) {} route(); window.scrollTo(0, 0); }
  function parse() {
    var h = here.split("/"), id = h[0] || "", sub = h[1] || "";
    return { id: id, sub: sub };
  }
  function buildMenu(cur) {
    menu.innerHTML = "";
    var home = document.createElement("li"); home.innerHTML = "<button><span class='n'>⌂</span>Início</button>";
    home.firstChild.addEventListener("click", function () { nav(""); }); if (!cur) home.firstChild.setAttribute("aria-current", "page"); menu.appendChild(home);
    LIST.forEach(function (m) {
      var li = document.createElement("li"), b = document.createElement("button"), ready = M[m.id] && M[m.id].ready;
      b.innerHTML = "<span class='n'>" + m.n + "</span>" + m.nome + (ready ? "" : "<span class='soon'>em breve</span>");
      b.disabled = !ready; if (m.id === cur) b.setAttribute("aria-current", "page");
      b.addEventListener("click", function () { nav(m.id + "/contexto"); });
      li.appendChild(b); menu.appendChild(li);
    });
  }
  function home() {
    tabsEl.hidden = true; clock.clear();
    view.innerHTML = "<h2>Escolha um método</h2><p>Cada método é explicado em passos curtos, com animação, conta na tela e uma fala pronta para a banca. Todos os números são de exemplos fictícios.</p><div class=cards></div>";
    var box = view.querySelector(".cards"); box.style.cssText = "display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))";
    LIST.forEach(function (m) {
      var ready = M[m.id] && M[m.id].ready, b = document.createElement("button");
      b.className = "card"; b.style.cssText = "text-align:left;cursor:" + (ready ? "pointer" : "default") + ";margin:0;min-height:96px"; b.disabled = !ready;
      b.innerHTML = "<span class=lbl>" + m.n + ". " + m.nome + "</span>" + m.d + (ready ? "" : " <span class=seal>em breve</span>");
      b.addEventListener("click", function () { nav(m.id + "/contexto"); }); box.appendChild(b);
    });
  }
  var cur = null;
  function route() {
    var r = parse(); buildMenu(r.id);
    if (!r.id || !M[r.id] || !M[r.id].ready) { cur = null; home(); return; }
    var mt = M[r.id], st = states[r.id] = states[r.id] || { id: r.id, step: 1 }, tab, num = parseInt(r.sub, 10);
    if (!isNaN(num)) { tab = "passos"; st.step = num; } else tab = r.sub || "contexto";
    if (!mt.tabs.some(function (t) { return t[0] === tab; })) tab = "contexto";
    cur = { mt: mt, st: st, tab: tab };
    tabsEl.hidden = false; tabsEl.innerHTML = "";
    mt.tabs.forEach(function (t, i) {
      var b = document.createElement("button"); b.setAttribute("role", "tab"); b.textContent = "(" + String.fromCharCode(97 + i) + ") " + t[1];
      b.setAttribute("aria-selected", String(t[0] === tab)); b.tabIndex = t[0] === tab ? 0 : -1;
      b.addEventListener("click", function () { nav(mt.id + "/" + (t[0] === "passos" ? st.step : t[0])); });
      b.addEventListener("keydown", function (e) { var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!k) return; e.preventDefault(); e.stopPropagation(); var all = tabsEl.children, j = (i + k + all.length) % all.length; all[j].focus(); all[j].click(); });
      tabsEl.appendChild(b);
    });
    st.focus = !!window.__focusNext; window.__focusNext = false;
    mt.render(tab, view, app, st);
  }
  function rerender() { if (cur) cur.mt.render(cur.tab, view, app, cur.st); }

  /* Controles superiores */
  function toggle(id, key) {
    var b = $(id); b.addEventListener("click", function () { flags[key] = !flags[key]; b.setAttribute("aria-pressed", String(flags[key])); safe(function () { localStorage.setItem("ppgcs-" + key, flags[key] ? "1" : "0"); }); rerender(); });
    if (safe(function () { return localStorage.getItem("ppgcs-" + key); }) === "1") { flags[key] = true; b.setAttribute("aria-pressed", "true"); }
  }
  toggle("#b-banca", "banca"); toggle("#b-tech", "tech");
  var tema = $("#b-tema"), root = document.documentElement;
  var saved = safe(function () { return localStorage.getItem("ppgcs-tema"); }); if (saved) root.setAttribute("data-theme", saved);
  tema.addEventListener("click", function () {
    var isDark = root.getAttribute("data-theme") === "dark";
    var nx = isDark ? "light" : "dark"; root.setAttribute("data-theme", nx); safe(function () { localStorage.setItem("ppgcs-tema", nx); });
  });

  /* Player */
  var spd = $("#p-speed"), play = $("#p-play");
  clock.speeds.forEach(function (s) {
    var b = document.createElement("button"); b.textContent = String(s).replace(".", ",") + "x"; b.setAttribute("aria-pressed", String(s === 1)); b.setAttribute("aria-label", "Velocidade " + String(s).replace(".", ",") + " vezes");
    b.addEventListener("click", function () { clock.setSpeed(s); }); b.dataset.s = s; spd.appendChild(b);
  });
  function sync() {
    Array.prototype.forEach.call(spd.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(parseFloat(b.dataset.s) === clock.speed)); });
    play.textContent = clock.paused ? "Tocar" : "Pausar"; play.setAttribute("aria-pressed", String(clock.paused));
  }
  clock.onChange(function (k) { if (k === "restart") rerender(); sync(); });
  play.addEventListener("click", function () { clock.toggle(); });
  $("#p-frame").addEventListener("click", function () { clock.pause(); clock.stepFrame(); });
  $("#p-restart").addEventListener("click", function () { clock.play(); clock.restart(); });
  if (clock.reduced) { var n = document.createElement("span"); n.className = "lab"; n.textContent = "Movimento reduzido: use Avançar um quadro ou os botões de cada simulação."; $("#player").appendChild(n); }

  var lastW = window.innerWidth, rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; rerender(); } }, 250); });
  window.addEventListener("hashchange", function () { var h = ""; try { h = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {} if (h !== here) { here = h; window.__focusNext = true; route(); window.scrollTo(0, 0); } });
  window.addEventListener("keydown", function (e) {
    if (!cur || cur.tab !== "passos" || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.getAttribute("role") === "tab") return;
    var n = cur.st.step || 1;
    if (e.key === "ArrowRight" && n < cur.mt.steps) { e.preventDefault(); app.go(cur.st, n + 1); }
    if (e.key === "ArrowLeft" && n > 1) { e.preventDefault(); app.go(cur.st, n - 1); }
  });
  sync(); route();
})();
