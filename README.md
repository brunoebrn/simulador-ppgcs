# Simulador didático de métodos estatísticos – PPGCS/UFAL

Site estático (HTML, CSS e JavaScript puros, sem build, sem CDN, funciona offline). Todos os dados são fictícios.

## Estado
Entregue: método 2 (Regressão Joinpoint), para validação. Os demais métodos aparecem no menu como "em breve".

## Publicar no GitHub Pages
1. Crie um repositório no GitHub e envie o conteúdo desta pasta na raiz (index.html, css, js, fonts, assets, .nojekyll).
2. No repositório: Settings > Pages > Build and deployment > Source: "Deploy from a branch".
3. Escolha a branch (main) e a pasta "/ (root)" e salve.
4. Aguarde alguns minutos; o endereço aparece na mesma página.

Para testar localmente basta abrir index.html no navegador.

## Logos
Salve os arquivos em assets/ com os nomes exatos `ufal.png` e `ppgcs.png`. O simulador os mostra sozinho no cabeçalho (sobre fundo branco); sem os arquivos, aparece o espaço reservado.

## Testes
- Conferência numérica independente (Python): `node tests/dump_js.js > js.json && python3 tests/check_joinpoint.py js.json` (requer numpy e scipy).
- Interface (Playwright): `node tests/ui_smoke.js pasta-de-capturas` (celular 360 e 390 px, tablet 768 px, desktop 1280 px).

## Fontes e licenças
Figtree e Hanken Grotesk (SIL OFL 1.1), arquivos woff2 locais em fonts/ com as licenças.
Valores de cor do S3: 1A5CA8, 0B2A4A, 0F1E33, 5A6B7F, AD6F00, 2B6CB0, 9CC3EE, E3A008, B8344A, EAF1FA. Os tons do tema escuro e as superfícies neutras foram derivados nesta construção (não constam no S3) e validados com o validador de paleta categórica.
