/* Teste de fumaça da interface com Playwright: erros de console, rolagem horizontal, passos 1 a 11, abas, temas.
   Uso: node tests/ui_smoke.js [pasta-de-capturas] */
const { chromium } = require("playwright");
const path = require("path");
const out = process.argv[2] || "/tmp";
const url = "file://" + path.resolve(__dirname, "../index.html");
(async () => {
  const browser = await chromium.launch(); let bad = 0;
  for (const [w, h, name] of [[360, 740, "m360"], [390, 844, "m390"], [768, 1024, "t768"], [1280, 800, "d1280"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }), page = await ctx.newPage(), errs = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); page.on("pageerror", e => errs.push(String(e)));
    await page.goto(url + "#joinpoint/1"); await page.waitForTimeout(400); await page.click("button:text-is('completo')");
    for (let s = 1; s <= 11; s++) {
      await page.goto(url + "#joinpoint/" + s); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s === 6 ? 1500 : 900);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "passo", s, "rolagem horizontal de", ov, "px"); bad++; }
      if (s === 1 || s === 4 || s === 6 || s === 8 || s === 10) await page.screenshot({ path: `${out}/${name}-passo${s}.png`, fullPage: false });
    }
    await page.goto(url + "#joinpoint/7"); await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${name}-passo7.png` });
    await page.click("#b-tema"); await page.goto(url + "#joinpoint/6"); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${name}-escuro-banca.png` });
    for (let s2 = 1; s2 <= 8; s2++) {
      await page.goto(url + "#indicadores/" + s2); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(900);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "indicadores passo", s2, "rolagem horizontal de", ov, "px"); bad++; }
      if (s2 === 4 || s2 === 7) await page.screenshot({ path: `${out}/${name}-ind-passo${s2}.png` });
    }
    await page.goto(url + "#aede/1"); await page.waitForTimeout(500); await page.click("button:text-is('completo')");
    for (let s3 = 1; s3 <= 7; s3++) {
      await page.goto(url + "#aede/" + s3); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s3 === 5 ? 3500 : 1200);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "aede passo", s3, "rolagem horizontal de", ov, "px"); bad++; }
      const nm = await page.evaluate(() => document.querySelectorAll("svg.map path").length);
      if (s3 <= 6 && s3 !== 4 && nm < 102) { console.log(name, "aede passo", s3, "mapa com", nm, "municípios"); bad++; }
      await page.screenshot({ path: `${out}/${name}-aede-passo${s3}.png`, fullPage: false });
    }
    for (let s4 = 1; s4 <= 6; s4++) {
      await page.goto(url + "#moran/" + s4); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s4 === 4 ? 4500 : s4 === 3 ? 2500 : 1000);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "moran passo", s4, "rolagem horizontal de", ov, "px"); bad++; }
      const nm = await page.evaluate(() => document.querySelectorAll("svg.map path").length), want = [1, 3, 4, 6].includes(s4) ? 102 : 0;
      if (nm < want) { console.log(name, "moran passo", s4, "mapa com", nm, "municípios"); bad++; }
      const ctl = await page.evaluate(() => !!document.querySelector(".stage .mini")), anim = s4 === 3 || s4 === 4;
      if (ctl !== anim) { console.log(name, "moran passo", s4, "controles de animação", ctl ? "presentes" : "ausentes", "(esperado", anim ? "presentes)" : "ausentes)"); bad++; }
      if (s4 === 4) { const t = await page.textContent(".stage .sum"); if (!/Pronto/.test(t) || !/pseudo-p/.test(t)) { console.log(name, "moran passo 4: animação não terminou:", t); bad++; } }
      if (s4 === 3) { const t = await page.textContent(".stage .sum"); if (!/Pronto/.test(t)) { console.log(name, "moran passo 3: animação não terminou:", t); bad++; } }
      await page.screenshot({ path: `${out}/${name}-moran-passo${s4}.png`, fullPage: false });
    }
    await page.goto(url + "#moran/2"); await page.waitForTimeout(400);
    for (const lab of ["1", "3", "5", "6"]) {
      await page.click(`.opts button:text-is('${lab}')`); await page.waitForTimeout(500);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "moran etapa", lab, "rolagem horizontal de", ov, "px"); bad++; }
      await page.screenshot({ path: `${out}/${name}-moran-etapa-${lab[0]}.png`, fullPage: false });
    }
    const t5 = await page.textContent("[data-live=conta2]"); if (!/0,7035/.test(t5)) { console.log(name, "moran etapa 6: faltou I = 0,7035"); bad++; }
    await page.goto(url + "#moran/4"); await page.waitForTimeout(300);
    for (const mm of ["99", "9999", "999"]) { await page.click(`.opts button:text-is('${mm}')`); await page.waitForTimeout(mm === "9999" ? 3500 : mm === "99" ? 4000 : 3500); const t = await page.textContent(".stage .sum"); if (!/Pronto/.test(t)) { console.log(name, "moran M =", mm, "não terminou:", t); bad++; } }
    await page.screenshot({ path: `${out}/${name}-moran-M999.png`, fullPage: false });
    for (let s5 = 1; s5 <= 6; s5++) {
      await page.goto(url + "#lisa/" + s5); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s5 === 4 ? 5500 : 1200);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "lisa passo", s5, "rolagem horizontal de", ov, "px"); bad++; }
      const nm = await page.evaluate(() => document.querySelectorAll("svg.map path").length), want = [1, 3, 4, 5, 6].includes(s5) ? 102 : 0;
      if (nm < want) { console.log(name, "lisa passo", s5, "mapa com", nm, "municípios"); bad++; }
      const ctl = await page.evaluate(() => !!document.querySelector(".stage .mini"));
      if (ctl !== (s5 === 4)) { console.log(name, "lisa passo", s5, "controles de animação", ctl ? "presentes" : "ausentes"); bad++; }
      if (s5 === 4) { const t = await page.textContent(".stage .sum"); if (!/Pronto/.test(t) || !/pseudo-p/.test(t)) { console.log(name, "lisa passo 4: animação não terminou:", t); bad++; } }
      await page.screenshot({ path: `${out}/${name}-lisa-passo${s5}.png`, fullPage: false });
    }
    await page.goto(url + "#lisa/2"); await page.waitForTimeout(400);
    for (const lab of ["1", "2", "3", "4", "5", "6"]) {
      await page.click(`.opts button:text-is('${lab}')`); await page.waitForTimeout(400);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "lisa etapa", lab, "rolagem horizontal de", ov, "px"); bad++; }
      const t = await page.textContent("[data-live=conta2]");
      if (lab === "4" && !/0,7035/.test(t)) { console.log(name, "lisa etapa 4: faltou média 0,7035"); bad++; }
      if (lab === "6" && !(/0,0056/.test(t) && /0,20; 0,10; 0,30; 0,50; 0,10; 0,20/.test(t))) { console.log(name, "lisa etapa 6: faltaram os p exatos"); bad++; }
      if (lab === "3" || lab === "6") await page.screenshot({ path: `${out}/${name}-lisa-etapa-${lab}.png`, fullPage: false });
    }
    await page.goto(url + "#lisa/3"); await page.waitForTimeout(500);
    const c0 = await page.textContent("[data-live=conta3]");
    await page.evaluate(() => document.querySelectorAll("svg.map path.clk")[30].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await page.waitForTimeout(200);
    if (c0 === await page.textContent("[data-live=conta3]")) { console.log(name, "lisa passo 3: clique no município não atualizou"); bad++; }
    await page.goto(url + "#lisa/5"); await page.waitForTimeout(500);
    await page.click(".opts button:text-is('Bonferroni')"); await page.waitForTimeout(400);
    if (!(await page.textContent(".stage")).match(/M insuficiente/)) { console.log(name, "lisa passo 5: faltou o aviso de Bonferroni com M = 999"); bad++; }
    await page.screenshot({ path: `${out}/${name}-lisa-bonf999.png`, fullPage: false });
    await page.click(".opts button:text-is('9999')"); await page.waitForTimeout(500);
    if ((await page.textContent(".stage")).match(/M insuficiente/)) { console.log(name, "lisa passo 5: aviso indevido com M = 9999"); bad++; }
    await page.goto(url + "#lisa/6"); await page.waitForTimeout(500);
    await page.evaluate(() => { const ps = [...document.querySelectorAll("svg.map path.clk")]; const q = ps.find(p => /qd\d/.test(p.getAttribute("class"))); if (q) q.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await page.waitForTimeout(200);
    if (!/núcleo/.test(await page.textContent(".stage .sum"))) { console.log(name, "lisa passo 6: clique em município colorido sem leitura do núcleo"); bad++; }
    await page.screenshot({ path: `${out}/${name}-lisa-nucleo.png`, fullPage: false });
    await page.goto(url + "#aede/3"); await page.waitForTimeout(400); await page.evaluate(() => document.querySelectorAll("svg.map path.clk")[10].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await page.waitForTimeout(200);
    if (!(await page.textContent("[aria-live=polite]")).match(/vizinhos/)) { console.log(name, "aede: clique no município não atualizou"); bad++; }
    for (const m of ["joinpoint", "indicadores", "aede", "moran", "lisa"]) {
      await page.goto(url + "#" + m + "/1"); await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelectorAll("details.more").forEach(d => { d.open = true; })); await page.waitForTimeout(300);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, m, "seções abertas: rolagem horizontal de", ov, "px"); bad++; }
      if (m === "joinpoint" || m === "aede" || m === "moran" || m === "lisa") await page.screenshot({ path: `${out}/${name}-${m}-saibamais.png`, fullPage: true });
    }
    const real = errs.filter(e => !/ERR_FILE_NOT_FOUND/.test(e)); errs.length = 0; errs.push(...real);
    if (errs.length) { console.log(name, "erros:", errs); bad++; }
    await ctx.close();
  }
  await browser.close(); console.log(bad ? bad + " problemas" : "sem problemas"); process.exit(bad ? 1 : 0);
})();
