/* Gera os valores-chave do método 8 (js/encaixe_core.js) em JSON, para comparação com os dumps dos outros métodos em tests/check_encaixe.py */
const fs = require("fs"), path = require("path"), E = require("../js/encaixe_core.js");
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/geo/al_municipios.geojson"), "utf8")).features;
global.window = { PPGCS: {} }; eval(fs.readFileSync(path.join(__dirname, "../js/spatial_data.js"), "utf8"));
console.log(JSON.stringify({ ind: E.indicadores(), jp: E.joinpoint(), esp: E.espacial(geo, window.PPGCS.spatial_data) }));
