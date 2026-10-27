/* Gera os resultados do motor JS dos Indicadores em JSON, para comparação com tests/check_indicadores.py */
const I = require("../js/indicadores_core.js");
console.log(JSON.stringify({ municipios: I.municipios, res: I.tudo() }));
