# Roadmap

P0: monorepo, contratos, política de agentes, registro de módulos, CI, documentação.
P1: aplicativos React Native e NestJS, identidade, consentimento, criptografia e testes.
P2: CTO, Nilo (assistente principal), Guardião, personalidade, voz, memória seletiva, auditoria.
P3: simuladores e módulos financeiros com adaptadores mock e testes.
P4: integrações com provedores autorizados para Open Finance, Pix e investimentos.
P5: visão de documentos, gêmeo financeiro, conselho de agentes, avatar e offline.

Nenhum recurso futuro é considerado implementado apenas por aparecer neste roteiro.

## Ordem de execução atual (fases de entrega)

Prioridade corrente: **Fase 1 — Base confiável**. Em seguida: Fase 2 (finanças manuais), Fase 3 (Nilo/CTO), Fase 4 (integrações autorizadas), Fase 5 (acabamento e lançamento). Essa ordem de entrega não muda a enumeração técnica P0–P5 acima.

**Decisão de escopo:** [ADR 0001](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md). SQLCipher nativo, Keystore e zero-knowledge serão desenvolvidos no Negresco Finance, **nunca como tarefa indireta do Security Black**. Nenhum desses mecanismos nativos está aprovado no APK atual.

## Visão de IAs especializadas (planejamento futuro)

Nomes, cargos, personalidades, vozes, avaliações independentes e módulos proativos de compras, jogos, assinaturas e economia estão descritos em [Visão Multiagente Futura](AI_MULTIAGENT_FUTURE_VISION.md). **Não são recursos implementados**, não possuem acesso bancário real e não alteram a ordem de entrega.

**Etapa atual de segurança: SEC-05K**, journal durável e recuperação de migração criptográfica interrompida, limitada a fixtures descartáveis. Leia [SEC-05K](security/SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md). PR #14 segue em rascunho e não autoriza APK/merge.

### Backlog separado: IAs sociais e processo vivo

[Arquitetura social do Negresco Finance v1](ai-social/ARQUITETURA-IAS-SOCIAIS-NEGRESCO-V1.md) e [Plano de implantação S0–S8](ai-social/PLANO-IAS-SOCIAIS-NEGRESCO-V1.md) aproveitam princípios gerais do NegrecoDroid sem importar nomes, hierarquia ou dados do outro aplicativo. Futuro chat de equipe, prévia de execução real, personalidade e voz, relação social simulada e notificação por nome. **Nenhum módulo implementado; não iniciar S1–S8 antes dos gates de segurança e da fase de IAs.** A etapa atual permanece **SEC-05K**.

### Catálogo visual e notificações S7 (planejamento)

O backlog multiagente passou a contemplar **17 inteligências planejadas**, cada uma com nome, cargo, aparência/avatar próprio e personalidade. Ver [Catálogo de 17 IAs: aparência e notificações](ai-social/CATALOGO-17-IAS-IDENTIDADE-VISUAL-NOTIFICACOES-V1.md). A aparência estática é especificada para S1, os avatares do chat/preview para S3/S4, vozes em S6 e notificações Android individualizadas por nome/ícone opcional na **S7**. Todas as entregas são futuras e **SEC-05K permanece a etapa atual**, sem alterações neste documento de planejamento.
