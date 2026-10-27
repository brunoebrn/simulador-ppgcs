# Simulador didático de métodos estatísticos

Material de apoio ao projeto de mestrado **"Determinantes socioespaciais e o impacto da gestão na cobertura vacinal infantil em Alagoas (2000–2024)"**, do Programa de Pós-Graduação em Ciências da Saúde (PPGCS) da Universidade Federal de Alagoas (UFAL).

## Proposta

O simulador explica, passo a passo e com animações, os métodos estatísticos previstos no projeto, em linguagem simples e com a conta mostrada na tela. A ideia é que alguém sem formação em estatística consiga acompanhar o raciocínio de cada método, e que quem já conhece o método consiga conferir cada etapa do cálculo.

**Todos os dados são fictícios** e fixos. Nada do que aparece é resultado da pesquisa, e uma faixa permanente no topo da página lembra isso. Nos mapas, só o desenho dos municípios e as relações de vizinhança são reais; os valores são sorteados e não têm relação com os municípios.

## Métodos

| # | Método | Pergunta que responde |
|---|---|---|
| 1 | Indicadores | Como se calculam cobertura vacinal, taxa de abandono e homogeneidade? |
| 2 | Regressão Joinpoint | Quando a tendência da série muda, e quanto? |
| 3 | AEDE | Quem é vizinho de quem, e os valores vizinhos se parecem? |
| 4 | I de Moran Global | Existe padrão espacial no conjunto dos municípios? |
| 5 | Moran Local (LISA) | Onde estão os aglomerados e os pontos fora da curva? |
| 6 | Varredura de Kulldorff (SaTScan) | Existe um grupo de municípios com risco maior que o de fora? |
| 7 | VIF, OLS e GWR | O que ajuda a explicar a cobertura, e isso muda de lugar para lugar? |
| 8 | Como se encaixam | Como os métodos se ligam e o que cada um não responde? |

## Como cada método é apresentado

- **Simulação em passos**, com explicação simplificada, o que o computador faz, a conta na tela e uma versão técnica opcional.
- **Animações** com controles (tocar, pausar, avançar, reiniciar, velocidade) apenas nas figuras que de fato se movem.
- **Saiba mais**: contexto, dados e variáveis, como ler o resultado, limitações, decisões do projeto, referências e como rodar de verdade.
- **Perguntas frequentes** ao final da página.
- **Referências** em formato ABNT.

## Dados e mapas

- Séries, municípios e variáveis são fictícios, gerados com semente fixa para que os resultados sejam sempre os mesmos.
- A malha municipal de Alagoas (102 municípios) vem do Instituto Brasileiro de Geografia e Estatística (IBGE), malha municipal 2025, simplificada para uso na web, preservando as divisas. A vizinhança (rainha) é calculada a partir dessa geometria.

## Conferência dos números

Os cálculos são feitos em JavaScript no navegador e conferidos por programas independentes em Python, que recalculam cada resultado sem reutilizar o código do site.

## Uso

Site estático (HTML, CSS e JavaScript puros), sem instalação e sem conexão com a internet. Para usar, abra o arquivo `index.html` no navegador. Funciona em computador, tablet e celular, com tema claro ou escuro.

## Licenças

Fontes Figtree e Hanken Grotesk (SIL Open Font License 1.1), incluídas em `fonts/`. Brasão da UFAL e logo do PPGCS pertencem às suas instituições.
