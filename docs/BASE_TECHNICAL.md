# Base tecnica: politica de capacidades

O pacote app-core conecta contratos ja existentes de sessao, agentes, risco, Pix e modulos.

## Garantias implementadas
- Validacao de sessao, identidade do usuario e escopos antes de autorizar capacidades.
- Rejeicao de operacoes desconhecidas e de pedidos entre usuarios diferentes.
- Negresco nao delega diretamente: CTO e o unico roteador autorizado pelas politicas.
- Rascunhos Pix podem ser validados localmente; nao sao pagamentos.
- Pix real permanece bloqueado mesmo com ambiente LIVE, consentimento e verificacao de servidor: falta um executor financeiro auditado.
- Avaliacao de risco do dispositivo depende dos sinais fornecidos; ausencia de sinais nao comprova integridade.
- Nao persiste dados, nao executa rede e nao possui backend.

## Proximos blocos da base
Backend autenticado, consentimentos persistidos e revogaveis, registro de auditoria inviolavel, criptografia e gestao de chaves, monitoramento de integridade e provedores de integracao em sandbox.

## Verificacao
Executar `npm test` no repositorio. A compilacao Android e o OTA sao validacoes independentes.
