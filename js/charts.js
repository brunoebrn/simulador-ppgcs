/* Auxiliares de gráfico SVG (sem gradiente, sombra ou 3D). */
(function () {
  "use strict";
  var NS = (window.PPGCS = window.PPGCS || {});
  var SVGNS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent, text) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  var nf = {};
  function fmt(x, d) {
    d = d == null ? 1 : d; var k = "d" + d;
    nf[k] = nf[k] || new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[k].format(x).replace("-", "−");
  }
  function signed(x, d) { return (x > 0 ? "+" : "") + fmt(x, d == null ? 1 : d); }

  /* Eixo X por índice (anos) e Y numérico. */
  function width(parent) { var cw = parent.clientWidth || 640; return Math.max(280, Math.min(720, cw - 16)); }
  function Chart(parent, o) {
    var w = o.w || width(parent), h = o.h || 320, m = o.m || { l: 52, r: 16, t: 28, b: 40 };
    this.w = w; this.h = h; this.m = m; this.o = o;
    this.svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": o.label || "Gráfico" }, parent);
    this.gGrid = el("g", { "class": "grid" }, this.svg);
    this.gAxis = el("g", { "class": "axis" }, this.svg);
    this.g = el("g", {}, this.svg);
    this.setY(o.ymin, o.ymax);
    this.drawAxes();
  }
  Chart.prototype.x = function (i) { var n = this.o.xs.length; return this.m.l + (this.w - this.m.l - this.m.r) * (n === 1 ? .5 : i / (n - 1)); };
  Chart.prototype.y = function (v) { return this.m.t + (this.h - this.m.t - this.m.b) * (1 - (v - this.ymin) / (this.ymax - this.ymin)); };
  Chart.prototype.setY = function (a, b) { this.ymin = a; this.ymax = b; };
  Chart.prototype.drawAxes = function () {
    var o = this.o, i, n = o.xs.length, step = o.ystep || 10;
    this.gGrid.textContent = ""; this.gAxis.textContent = "";
    for (var v = Math.ceil(this.ymin / step) * step; v <= this.ymax + 1e-9; v += step) {
      el("line", { x1: this.m.l, x2: this.w - this.m.r, y1: this.y(v), y2: this.y(v) }, this.gGrid);
      el("text", { x: this.m.l - 8, y: this.y(v) + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, this.gAxis, (o.yfmt ? o.yfmt(v) : fmt(v, 0)));
    }
    el("line", { x1: this.m.l, x2: this.w - this.m.r, y1: this.h - this.m.b, y2: this.h - this.m.b }, this.gAxis);
    var every = n > 12 ? 4 : 1;
    for (i = 0; i < n; i += every) {
      el("text", { x: this.x(i), y: this.h - this.m.b + 18, "text-anchor": "middle", "font-size": 12, "class": "muted" }, this.gAxis, String(o.xs[i]));
    }
    if (o.ylabel) el("text", { x: 4, y: 12, "font-size": 12, "class": "muted" }, this.gAxis, o.ylabel);
  };
  Chart.prototype.line = function (vals, cls, parent) {
    var d = vals.map(function (v, i) { return (i ? "L" : "M") + this.x(i).toFixed(1) + " " + this.y(v).toFixed(1); }, this).join(" ");
    return el("path", { d: d, "class": cls }, parent || this.g);
  };
  Chart.prototype.points = function (vals, cls, r, parent) {
    return Array.prototype.slice.call(vals).map(function (v, i) { return el("circle", { cx: this.x(i), cy: this.y(v), r: r || 5, "class": cls || "pt" }, parent || this.g); }, this);
  };
  Chart.prototype.text = function (x, y, s, o) { o = o || {}; return el("text", { x: x, y: y, "font-size": o.size || 13, "text-anchor": o.anchor || "middle", "font-weight": o.bold ? 700 : 400, "class": o.cls || "" }, this.g, s); };

  /* Histograma: bins sobre [lo, hi]; devolve objeto com update(values, observed). */
  function Histogram(parent, o) {
    var w = o.w || width(parent), h = o.h || 220, m = { l: 44, r: 16, t: 16, b: 38 }, nb = o.bins || 24;
    var svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": o.label || "Histograma" }, parent);
    var gA = el("g", { "class": "axis" }, svg), gB = el("g", {}, svg), gO = el("g", {}, svg);
    this.update = function (vals, obs, exceedFn) {
      var hiV = Math.max(obs, 1.0001) * 1.08, lo = o.lo == null ? 1 : o.lo, bw = (hiV - lo) / nb, counts = new Array(nb).fill(0), hit = new Array(nb).fill(0), i;
      vals.forEach(function (v) { var b = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw))); counts[b]++; if (v >= obs) hit[b]++; });
      var mx = Math.max.apply(null, counts.concat([5])), X = function (v) { return m.l + (w - m.l - m.r) * (v - lo) / (hiV - lo); }, Y = function (c) { return m.t + (h - m.t - m.b) * (1 - c / mx); };
      gA.textContent = ""; gB.textContent = ""; gO.textContent = "";
      el("line", { x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b }, gA);
      el("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b }, gA);
      [0, .25, .5, .75, 1].forEach(function (f) { var v = lo + f * (hiV - lo); el("text", { x: X(v), y: h - m.b + 16, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, fmt(v, v < 10 ? 1 : 0)); });
      el("text", { x: m.l - 6, y: m.t + 4, "text-anchor": "end", "font-size": 12, "class": "muted" }, gA, String(mx));
      el("text", { x: w / 2, y: h - 4, "text-anchor": "middle", "font-size": 12, "class": "muted" }, gA, o.xlabel || "T = SSE_N / SSE_A");
      for (i = 0; i < nb; i++) if (counts[i]) el("rect", { x: X(lo + i * bw) + 1, y: Y(counts[i]), width: Math.max(1, X(lo + (i + 1) * bw) - X(lo + i * bw) - 2), height: (h - m.b) - Y(counts[i]), "class": (lo + i * bw) >= obs ? "bar-hit" : "bar" }, gB);
      el("line", { x1: X(obs), x2: X(obs), y1: m.t, y2: h - m.b, "class": "obs" }, gO);
      el("text", { x: Math.min(X(obs) - 6, w - m.r), y: m.t + 12, "text-anchor": "end", "font-size": 12, "font-weight": 700 }, gO, "T observado = " + fmt(obs, 2));
    };
    this.svg = svg;
  }

  /* Mapa SVG de Alagoas a partir da malha real (NS.geo, NS.spatial). Compartilhado pelos métodos espaciais.
     o: { cls(i), label, onSel(i), onHover(i), titles(i), dots (lista booleana: marca centroides), w }.
     Devolve { svg, paths, P, cs, g }. */
  function mapa(parent, o) {
    var S = NS.spatial, G = NS.geo.features, w = Math.max(280, Math.min(720, (o.w || parent.clientWidth || 640) - 8)), P = S.projector(G, w, 0, 4);
    var svg = el("svg", { viewBox: "0 0 " + w + " " + P.height.toFixed(1), role: "img", "aria-label": o.label, "class": "map" }, parent), paths = [];
    G.forEach(function (f, i) {
      var p = el("path", { d: P.path(f), "class": o.cls(i) + (o.onSel ? " clk" : "") }, svg);
      el("title", {}, p, f.properties.n + (o.titles ? ": " + o.titles(i) : ""));
      if (o.onSel) p.addEventListener("click", function () { o.onSel(i); });
      if (o.onHover) p.addEventListener("mouseenter", function () { o.onHover(i); });
      paths.push(p);
    });
    var gx = el("g", {}, svg), cs = G.map(function (f, i) { return P.centroid(i); });
    if (o.dots) cs.forEach(function (c, i) { if (o.dots[i]) el("circle", { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 1.5, "class": "dot" }, gx); });
    return { svg: svg, paths: paths, P: P, cs: cs, g: gx };
  }
  NS.charts = { width: width, el: el, Chart: Chart, Histogram: Histogram, fmt: fmt, signed: signed, mapa: mapa };
})();
