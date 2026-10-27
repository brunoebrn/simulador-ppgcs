/* Dados fictícios fixos do simulador. NÃO são resultados da pesquisa. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.PPGCS = root.PPGCS || {}; root.PPGCS.data = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    /* Série didática de 5 pontos: cobertura (%) de um município fictício, 2020 a 2024 */
    serie5: { anos: [2020, 2021, 2022, 2023, 2024], cob: [80, 85, 90, 70, 50] },
    /* Série fictícia de 25 pontos, 2000 a 2024 (cobertura estadual fictícia, %) */
    serie25: {
      anos: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012,
        2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
      cob: [78, 80, 83, 85, 88, 90, 93, 95, 96, 97, 98, 99, 98, 97, 96, 96, 92, 88, 85, 83, 76, 74, 75, 78, 80]
    }
  };
});
