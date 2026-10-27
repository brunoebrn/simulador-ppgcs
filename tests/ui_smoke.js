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
    for (let s6 = 1; s6 <= 7; s6++) {
      await page.goto(url + "#satscan/" + s6); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s6 === 5 ? 6000 : s6 === 4 ? 3500 : s6 === 3 ? 3500 : 1500);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "satscan passo", s6, "rolagem horizontal de", ov, "px"); bad++; }
      const nm = await page.evaluate(() => document.querySelectorAll("svg.map path").length), want = s6 === 2 ? 0 : s6 === 7 ? 306 : s6 === 1 ? 204 : s6 === 5 ? 102 : 102;
      if (nm < want) { console.log(name, "satscan passo", s6, "mapa com", nm, "municípios (esperado", want + ")"); bad++; }
      const ctl = await page.evaluate(() => !!document.querySelector(".stage .mini")), anim = [3, 4, 5].includes(s6);
      if (ctl !== anim) { console.log(name, "satscan passo", s6, "controles de animação", ctl ? "presentes" : "ausentes", "(esperado", anim ? "presentes)" : "ausentes)"); bad++; }
      if (anim) { const t = await page.textContent(".stage .sum"); if (!/Pronto/.test(t)) { console.log(name, "satscan passo", s6, "animação não terminou:", t); bad++; } }
      if (s6 === 5) { const t = await page.textContent(".stage .sum"); if (!/0,001/.test(t)) { console.log(name, "satscan passo 5: faltou p mínimo 0,001:", t); bad++; } }
      await page.screenshot({ path: `${out}/${name}-satscan-passo${s6}.png`, fullPage: false });
    }
    await page.goto(url + "#satscan/2"); await page.waitForTimeout(400);
    for (const lab of ["1", "2", "3", "4", "5"]) {
      await page.click(`.opts button:text-is('${lab}')`); await page.waitForTimeout(300);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "satscan etapa", lab, "rolagem horizontal de", ov, "px"); bad++; }
      const t = await page.textContent("[data-live=conta2]");
      if (lab === "2" && !/18,420/.test(t)) { console.log(name, "satscan etapa 2: faltou LLR 18,420"); bad++; }
      if (lab === "4" && !/25,265/.test(t)) { console.log(name, "satscan etapa 4: faltou LLR 25,265"); bad++; }
      if (lab === "5" && !/3,25/.test(t)) { console.log(name, "satscan etapa 5: faltou risco relativo 3,25"); bad++; }
      if (lab === "1" && !/165/.test(t)) { console.log(name, "satscan etapa 1: faltou C = 165"); bad++; }
      if (lab === "3" || lab === "5") await page.screenshot({ path: `${out}/${name}-satscan-etapa-${lab}.png`, fullPage: false });
    }
    await page.goto(url + "#satscan/3"); await page.waitForTimeout(500);
    const c3 = await page.textContent("[data-live=conta3]");
    await page.evaluate(() => document.querySelectorAll("svg.map path.clk")[30].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await page.waitForTimeout(300);
    if (c3 === await page.textContent("[data-live=conta3]") && !/Centro: <b>/.test(c3)) { /* conta muda ao trocar o centro */ }
    if (!(await page.textContent("[data-live=conta3]")).match(/Centro:/)) { console.log(name, "satscan passo 3: sem conta do centro"); bad++; }
    await page.click(".opts button:text-is('10%')"); await page.waitForTimeout(500);
    if (!/10%/.test(await page.textContent("[data-live=conta3]"))) { console.log(name, "satscan passo 3: limite 10% não refletido"); bad++; }
    await page.goto(url + "#satscan/5"); await page.waitForTimeout(300); await page.evaluate(() => window.PPGCS.clock.setSpeed(8));
    await page.click(".opts button:text-is('9999')"); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(12000);
    { const t = await page.textContent(".stage .sum"); if (!(/Pronto/.test(t) && /0,0001/.test(t))) { console.log(name, "satscan passo 5 com 9999: animação não terminou:", t); bad++; } }
    await page.screenshot({ path: `${out}/${name}-satscan-M9999.png`, fullPage: false });
    await page.goto(url + "#satscan/6"); await page.waitForTimeout(800);
    await page.evaluate(() => { const ps = [...document.querySelectorAll("svg.map path.clk")]; const q = ps.find(p => /qd0/.test(p.getAttribute("class"))); if (q) q.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await page.waitForTimeout(200);
    if (!/Aglomerado nº 1/.test(await page.textContent(".stage .sum"))) { console.log(name, "satscan passo 6: clique no aglomerado sem leitura"); bad++; }
    await page.screenshot({ path: `${out}/${name}-satscan-secundarios.png`, fullPage: false });
    for (let s7 = 1; s7 <= 8; s7++) {
      await page.goto(url + "#gwr/" + s7); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s7 === 5 ? 3500 : 1500);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "gwr passo", s7, "rolagem horizontal de", ov, "px"); bad++; }
      const nm = await page.evaluate(() => document.querySelectorAll("svg.map path").length), want = [0, 204, 0, 102, 102, 102, 0, 102, 204][s7];
      if (nm < want) { console.log(name, "gwr passo", s7, "mapa com", nm, "municípios (esperado", want + ")"); bad++; }
      const ctl = await page.evaluate(() => !!document.querySelector(".stage .mini"));
      if (ctl !== (s7 === 5)) { console.log(name, "gwr passo", s7, "controles de animação", ctl ? "presentes" : "ausentes"); bad++; }
      if (s7 === 5) { const t = await page.textContent(".stage .sum"); if (!/Pronto/.test(t)) { console.log(name, "gwr passo 5: animação não terminou:", t); bad++; } }
      if (s7 === 6) { const t = await page.textContent("[data-live=conta6]"); if (!/AICc/.test(t) || !/OLS/.test(t)) { console.log(name, "gwr passo 6: faltou AICc do GWR e do OLS"); bad++; } }
      await page.screenshot({ path: `${out}/${name}-gwr-passo${s7}.png`, fullPage: false });
    }
    await page.goto(url + "#gwr/2"); await page.waitForTimeout(400);
    for (const lab of ["1: à mão", "2: cinco explicativas", "3: depois da escolha"]) {
      await page.click(`.opts button:text-is('${lab}')`); await page.waitForTimeout(400);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "gwr VIF", lab, "rolagem horizontal de", ov, "px"); bad++; }
      const t = await page.textContent("[data-live=conta2]");
      if (lab[0] === "1" && !(/3,19/.test(t) && /0,8286/.test(t))) { console.log(name, "gwr VIF etapa 1: faltou r = 0,8286 e VIF 3,19"); bad++; }
      if (lab[0] === "2" && !/IVS/.test(t)) { console.log(name, "gwr VIF etapa 2: faltou a tabela das cinco"); bad++; }
      await page.screenshot({ path: `${out}/${name}-gwr-vif-${lab[0]}.png`, fullPage: false });
    }
    await page.goto(url + "#gwr/4"); await page.waitForTimeout(500);
    await page.click(".opts button:text-is('9999')"); await page.waitForTimeout(800);
    if (!/9\.999/.test(await page.textContent("[data-live=conta4]"))) { console.log(name, "gwr passo 4: faltou M = 9.999"); bad++; }
    await page.goto(url + "#gwr/5"); await page.waitForTimeout(500); await page.evaluate(() => window.PPGCS.clock.setSpeed(8));
    const c5 = await page.textContent("[data-live=conta5]");
    await page.evaluate(() => document.querySelectorAll("svg.map path.clk")[30].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await page.waitForTimeout(600);
    if (c5 === await page.textContent("[data-live=conta5]")) { console.log(name, "gwr passo 5: clique no município não atualizou"); bad++; }
    await page.click(".opts button:text-is('102')"); await page.waitForTimeout(600);
    if (!/k = <b>102|k = 102/.test(await page.innerHTML("[data-live=conta5]"))) { console.log(name, "gwr passo 5: k = 102 não refletido"); bad++; }
    await page.goto(url + "#gwr/7"); await page.waitForTimeout(600);
    const c7 = await page.textContent("[data-live=conta7]");
    await page.click(".opts button:text-is('Bonferroni')"); await page.waitForTimeout(400);
    if (c7 === await page.textContent("[data-live=conta7]") || !/Bonferroni/.test(await page.textContent("[data-live=conta7]"))) { console.log(name, "gwr passo 7: correção de Bonferroni não refletida"); bad++; }
    await page.screenshot({ path: `${out}/${name}-gwr-bonf.png`, fullPage: false });
    await page.click(".opts button:text-is('R² local')"); await page.waitForTimeout(400);
    if (!/R² local/.test(await page.textContent("[data-live=conta7]"))) { console.log(name, "gwr passo 7: faltou R² local"); bad++; }
    await page.screenshot({ path: `${out}/${name}-gwr-r2.png`, fullPage: false });
    await page.click(".opts button:text-is('5 explicativas')"); await page.waitForTimeout(500);
    if (!/IVS/.test(await page.textContent(".opts"))) { console.log(name, "gwr passo 7: modelo de 5 explicativas sem IVS"); bad++; }
    await page.screenshot({ path: `${out}/${name}-gwr-5vars.png`, fullPage: false });
    const want8 = [/6 de 10/, /Maior queda/, /0,4221/, /27 de 102/, /35 munic/, /0,807/];
    for (let s8 = 1; s8 <= 6; s8++) {
      await page.goto(url + "#encaixe/" + s8); await page.waitForSelector(".stage [data-ready]", { timeout: 20000 });
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "encaixe passo", s8, "rolagem horizontal de", ov, "px"); bad++; }
      const ctl = await page.evaluate(() => !!document.querySelector(".stage .mini")); if (ctl) { console.log(name, "encaixe passo", s8, "controles de animação indevidos"); bad++; }
      const t = await page.textContent(".stage"); if (!want8[s8 - 1].test(t)) { console.log(name, "encaixe passo", s8, "faltou valor-chave:", t.slice(0, 120)); bad++; }
      const nb = await page.evaluate(() => document.querySelectorAll("svg.chain g.bx").length), on = await page.evaluate(() => [...document.querySelectorAll("svg.chain g.bx")].findIndex(g => g.classList.contains("on")));
      if (nb !== 6 || on !== s8 - 1) { console.log(name, "encaixe passo", s8, "diagrama com", nb, "caixas, destaque em", on); bad++; }
      await page.waitForFunction(() => !/calculando/.test(document.querySelector("[data-live=conta]").textContent), null, { timeout: 20000 });
      if (s8 === 1 || s8 === 4 || s8 === 6) await page.screenshot({ path: `${out}/${name}-encaixe-passo${s8}.png`, fullPage: s8 === 1 });
    }
    await page.goto(url + "#encaixe/3"); await page.waitForTimeout(300);
    await page.click("svg.chain g.bx:nth-of-type(6)"); await page.waitForTimeout(500);
    if (!/VIF, OLS e GWR/.test(await page.textContent("#menu [aria-current=page]"))) { console.log(name, "encaixe: clique na caixa 6 não abriu o método"); bad++; }
    if (!(await page.evaluate(() => /gwr\/1$/.test(location.hash)))) { console.log(name, "encaixe: hash não foi para gwr/1"); bad++; }
    await page.goto(url + "#encaixe/2"); await page.waitForTimeout(300);
    await page.click(".opts button:text-is('4. I de Moran global')"); await page.waitForTimeout(500);
    if (!(await page.evaluate(() => /moran\/1$/.test(location.hash)))) { console.log(name, "encaixe: chip do método 4 não navegou"); bad++; }
    await page.goto(url + "#aede/3"); await page.waitForTimeout(400); await page.evaluate(() => document.querySelectorAll("svg.map path.clk")[10].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await page.waitForTimeout(200);
    if (!(await page.textContent("[aria-live=polite]")).match(/vizinhos/)) { console.log(name, "aede: clique no município não atualizou"); bad++; }
    for (const m of ["joinpoint", "indicadores", "aede", "moran", "lisa", "satscan", "gwr", "encaixe"]) {
      await page.goto(url + "#" + m + "/1"); await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelectorAll("details.more").forEach(d => { d.open = true; })); await page.waitForTimeout(300);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, m, "seções abertas: rolagem horizontal de", ov, "px"); bad++; }
      if (m === "joinpoint" || m === "aede" || m === "moran" || m === "lisa" || m === "satscan" || m === "gwr" || m === "encaixe") await page.screenshot({ path: `${out}/${name}-${m}-saibamais.png`, fullPage: true });
    }
    const real = errs.filter(e => !/ERR_FILE_NOT_FOUND/.test(e)); errs.length = 0; errs.push(...real);
    if (errs.length) { console.log(name, "erros:", errs); bad++; }
    await ctx.close();
  }
  await browser.close(); console.log(bad ? bad + " problemas" : "sem problemas"); process.exit(bad ? 1 : 0);
})();
