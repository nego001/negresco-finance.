# Negresco Finance: fundacao modular P0

Este pacote implementa contratos e politicas locais reutilizaveis. Nao constitui um backend financeiro funcional.

## Blocos presentes
- Contratos de Pix e integracoes, sessao e autorizacao com autenticacao reforcada.
- Orquestrador de capacidades: sessao, escopos, risco, modulos, delegacao CTO e bloqueio de Pix real.
- Consentimento por usuario, escopo, finalidade, recurso e expiracao; revogacao em memoria.
- Eventos de auditoria com campos limitados, sem incluir payload financeiro.
- Registro de idempotencia de rascunhos em memoria; conflito detectado, capacidade limitada.
- Preferencias visuais validadas, sem persistencia.
- Testes automatizados com Node 22 (`npm test`).

## Nao implementado
- Backend, banco de dados, migracoes, autenticacao real, armazenamento de consentimentos e revogacoes.
- Logs de auditoria duraveis e assinados, criptografia Android Keystore / KMS, TLS no servidor, integracao bancaria.
- Processamento Pix real, antifraude, seguranca operacional e conformidade regulatoria.
- Persistencia de preferencias no Android e ligacao do app React Native aos novos pacotes.

## Criterio de aceite
O codigo da base deve passar no CI e permanecer bloqueando pagamentos reais. Build Android e OTA devem ser verificados separadamente. Nunca declarar uma transacao concluida sem confirmacao do provedor.
