# Roadmap

P0: monorepo, contratos, política de agentes, registro de módulos, CI, documentação.
P1: aplicativos React Native e NestJS, identidade, consentimento, criptografia e testes.
P2: CTO, Negresco, Guardião, personalidade, voz, memória seletiva, auditoria.
P3: simuladores e módulos financeiros com adaptadores mock e testes.
P4: integrações com provedores autorizados para Open Finance, Pix e investimentos.
P5: visão de documentos, gêmeo financeiro, conselho de agentes, avatar e offline.

Nenhum recurso futuro é considerado implementado apenas por aparecer neste roteiro.

## Ordem de execução atual (fases de entrega)

Prioridade corrente: **Fase 1 — Base confiável**. Em seguida: Fase 2 (finanças manuais), Fase 3 (Negresco/CTO), Fase 4 (integrações autorizadas), Fase 5 (acabamento e lançamento). Essa ordem de entrega não muda a enumeração técnica P0–P5 acima.

**Decisão de escopo:** [ADR 0001](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md). SQLCipher nativo, Keystore e zero-knowledge serão desenvolvidos no Negresco Finance, **nunca como tarefa indireta do Security Black**. Nenhum desses mecanismos nativos está aprovado no APK atual.
