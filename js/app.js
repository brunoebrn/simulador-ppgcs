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
  var view = $("#view"), tabsEl = $("#tabs"), menu = $("#menu"), states = {}, flags = { tech: false };
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  var app = {
    tech: function () { return flags.tech; }, remount: function () { attachMini(); },
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
      b.addEventListener("click", function () { nav(m.id + "/1"); });
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
      b.addEventListener("click", function () { nav(m.id + "/1"); }); box.appendChild(b);
    });
  }
  var cur = null;
  /* Uma página por método: a simulação abre direto; o restante fica em seções recolhíveis abaixo. */
  function paint() {
    var mt = cur.mt, st = cur.st;
    clock.clear(); view.innerHTML = ""; tabsEl.hidden = true;
    var main = document.createElement("div"); view.appendChild(main);
    mt.render("passos", main, app, st);
    var wrap = document.createElement("section"); wrap.className = "more-wrap";
    wrap.innerHTML = "<h2>Saiba mais sobre este método</h2>";
    mt.tabs.filter(function (t) { return t[0] !== "passos"; }).forEach(function (t) {
      var d = document.createElement("details"); d.className = "more"; var sm = document.createElement("summary"), body = document.createElement("div");
      sm.textContent = t[1]; d.appendChild(sm); d.appendChild(body);
      var done = false; function fill() { if (!done) { done = true; mt.render(t[0], body, app, st); } }
      if (t[0] === "faq") { d.open = true; fill(); } else d.addEventListener("toggle", function () { if (d.open) fill(); });
      wrap.appendChild(d);
    });
    view.appendChild(wrap); attachMini();
  }
  function route() {
    var r = parse(); buildMenu(r.id);
    if (!r.id || !M[r.id] || !M[r.id].ready) { cur = null; home(); return; }
    var mt = M[r.id], st = states[r.id] = states[r.id] || { id: r.id, step: 1 }, num = parseInt(r.sub, 10);
    st.step = isNaN(num) ? (st.step || 1) : num;
    cur = { mt: mt, st: st, tab: "passos" };
    st.focus = !!window.__focusNext; window.__focusNext = false;
    paint();
  }
  function rerender() { if (cur) paint(); }

  /* Controles superiores */
  function toggle(id, key) {
    var b = $(id); b.addEventListener("click", function () { flags[key] = !flags[key]; b.setAttribute("aria-pressed", String(flags[key])); safe(function () { localStorage.setItem("ppgcs-" + key, flags[key] ? "1" : "0"); }); rerender(); });
    if (safe(function () { return localStorage.getItem("ppgcs-" + key); }) === "1") { flags[key] = true; b.setAttribute("aria-pressed", "true"); }
  }
  toggle("#b-tech", "tech");
  var tema = $("#b-tema"), root = document.documentElement;
  var saved = safe(function () { return localStorage.getItem("ppgcs-tema"); }); if (saved) root.setAttribute("data-theme", saved);
  tema.addEventListener("click", function () {
    var isDark = root.getAttribute("data-theme") === "dark";
    var nx = isDark ? "light" : "dark"; root.setAttribute("data-theme", nx); safe(function () { localStorage.setItem("ppgcs-tema", nx); });
  });

  /* Controles compactos: ficam dentro do quadro do gráfico, retráteis, com ícones */
  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    step: '<svg viewBox="0 0 24 24"><path d="M6 5l9 7-9 7zM19 5v14"/></svg>', again: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/></svg>', close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  var miniOpen = safe(function () { return localStorage.getItem("ppgcs-mini") === "1"; }); if (miniOpen === null) miniOpen = false;
  var minis = [];
  function fx(s) { return String(s).replace(".", ",") + "×"; }
  function ibtn(ic, label, fn) { var b = document.createElement("button"); b.type = "button"; b.innerHTML = ic; b.setAttribute("aria-label", label); b.title = label; b.addEventListener("click", fn); return b; }
  function buildMini(stage) {
    var bar = document.createElement("div"); bar.className = "mini"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Controles da simulação");
    var tog = ibtn(ICON.open, "Controles da animação (mostrar ou ocultar)", function () { miniOpen = !miniOpen; safe(function () { localStorage.setItem("ppgcs-mini", miniOpen ? "1" : "0"); }); minis.forEach(drawMini); });
    var pl = ibtn(ICON.pause, "Pausar", function () { clock.toggle(); });
    var st = ibtn(ICON.step, "Avançar um quadro", function () { clock.pause(); clock.stepFrame(); });
    var rs = ibtn(ICON.again, "Reiniciar", function () { clock.play(); clock.restart(); });
    var sp = document.createElement("label"); sp.className = "spd"; sp.title = "Velocidade";
    var rg = document.createElement("input"); rg.type = "range"; rg.min = 0; rg.max = clock.speeds.length - 1; rg.step = 1; rg.setAttribute("aria-label", "Velocidade da animação");
    var val = document.createElement("span"); val.className = "val";
    rg.addEventListener("input", function () { clock.setSpeed(clock.speeds[+rg.value]); });
    sp.appendChild(rg); sp.appendChild(val);
    var o = { bar: bar, tog: tog, pl: pl, st: st, rs: rs, sp: sp, rg: rg, val: val }; minis.push(o);
    tog.className = "tog"; [tog, pl, st, rs, sp].forEach(function (x) { bar.appendChild(x); }); drawMini(o);
    stage.insertBefore(bar, stage.firstChild); return o;
  }
  function drawMini(o) {
    o.bar.classList.toggle("closed", !miniOpen); o.tog.innerHTML = miniOpen ? ICON.close : ICON.open; o.tog.setAttribute("aria-expanded", String(miniOpen));
    o.pl.hidden = o.st.hidden = o.rs.hidden = o.sp.hidden = !miniOpen;
    o.pl.innerHTML = clock.paused ? ICON.play : ICON.pause; o.pl.setAttribute("aria-label", clock.paused ? "Tocar" : "Pausar"); o.pl.title = o.pl.getAttribute("aria-label");
    var k = clock.speeds.indexOf(clock.speed); o.rg.value = k < 0 ? 2 : k; o.val.textContent = fx(clock.speed);
  }
  function sync() { minis = minis.filter(function (o) { return document.body.contains(o.bar); }); minis.forEach(drawMini); }
  function attachMini() { minis = []; var stage = view.querySelector(".stage"); if (stage && clock.active()) buildMini(stage); }
  clock.onChange(function (k) { if (k === "restart") rerender(); sync(); });

  var lastW = window.innerWidth, rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; rerender(); } }, 250); });
  window.addEventListener("hashchange", function () { var h = ""; try { h = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {} if (h !== here) { here = h; window.__focusNext = true; route(); window.scrollTo(0, 0); } });
  window.addEventListener("keydown", function (e) {
    if (!cur || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.getAttribute("role") === "tab") return;
    var n = cur.st.step || 1;
    if (e.key === "ArrowRight" && n < cur.mt.steps) { e.preventDefault(); app.go(cur.st, n + 1); }
    if (e.key === "ArrowLeft" && n > 1) { e.preventDefault(); app.go(cur.st, n - 1); }
  });
  sync(); route();
})();
