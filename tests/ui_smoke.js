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
    await page.goto(url + "#joinpoint/1"); await page.waitForTimeout(400);
    for (let s = 1; s <= 11; s++) {
      await page.goto(url + "#joinpoint/" + s); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(s === 6 ? 1500 : 900);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "passo", s, "rolagem horizontal de", ov, "px"); bad++; }
      if (s === 1 || s === 4 || s === 6 || s === 8 || s === 10) await page.screenshot({ path: `${out}/${name}-passo${s}.png`, fullPage: false });
    }
    for (const tab of ["contexto", "dados", "resultado", "limites", "decisao", "fontes", "rodar"]) {
      await page.goto(url + "#joinpoint/" + tab); await page.waitForTimeout(150);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "aba", tab, "rolagem horizontal de", ov, "px"); bad++; }
    }
    await page.goto(url + "#joinpoint/7"); await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${name}-passo7.png` });
    await page.click("#b-tema"); await page.click("#b-banca"); await page.goto(url + "#joinpoint/6"); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${name}-escuro-banca.png` });
    for (let s2 = 1; s2 <= 8; s2++) {
      await page.goto(url + "#indicadores/" + s2); await page.evaluate(() => window.PPGCS.clock.setSpeed(8)); await page.waitForTimeout(900);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "indicadores passo", s2, "rolagem horizontal de", ov, "px"); bad++; }
      if (s2 === 4 || s2 === 7) await page.screenshot({ path: `${out}/${name}-ind-passo${s2}.png` });
    }
    for (const tab of ["contexto", "dados", "resultado", "limites", "decisao", "fontes", "rodar"]) {
      await page.goto(url + "#indicadores/" + tab); await page.waitForTimeout(150);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) { console.log(name, "indicadores aba", tab, "rolagem horizontal de", ov, "px"); bad++; }
    }
    const real = errs.filter(e => !/ERR_FILE_NOT_FOUND/.test(e)); errs.length = 0; errs.push(...real);
    if (errs.length) { console.log(name, "erros:", errs); bad++; }
    await ctx.close();
  }
  await browser.close(); console.log(bad ? bad + " problemas" : "sem problemas"); process.exit(bad ? 1 : 0);
})();
