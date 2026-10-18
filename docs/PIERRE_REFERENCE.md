# Pierre como referência funcional

Objetivo: construir produto original inspirado nas categorias funcionais observadas no Pierre, sem copiar código, marcas, identidade visual, segredos ou APIs privadas.

## Mapeamento inicial (hipóteses a validar em análise de APK/telas)
| Referência Pierre | Módulo Negresco | Prioridade |
|---|---|---|
| Contas e saldos | Open Finance | P0 |
| Movimentações | Open Finance + análises | P0 |
| Pix | Pix | P0 |
| Cartões/faturas | Cartões | P0 |
| Investimentos | Investimentos | P0 |
| Organização financeira | Metas | P0 |
| Assistência financeira | Negresco + CTO | P0 |
| Assinaturas | Opcional | P2 |
| Relatórios | Opcional | P2 |

**Limite da evidência:** este documento é um mapa de produto preliminar, não uma análise técnica validada de cada tela ou API do APK. Validar por evidências próprias e screenshots antes de afirmar paridade.

## Critérios de paridade
Cada fluxo deve ter: entrada, validações, estados vazios/erro, acessibilidade, proteção de dados, testes, dependência de integração real e proposta de melhoria.

## Restrições
Não usar serviços privados do Pierre, não reutilizar código proprietário, não contornar autenticação ou proteções, não alegar conexão real sem parceiro autorizado.
