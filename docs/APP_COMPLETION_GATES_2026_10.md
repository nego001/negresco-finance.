# Negresco Finance | Plano verificável até um aplicativo utilizável
**Revisão:** 22 de outubro de 2026. **Status:** plano, não lançamento nem autorização de merge. A PR #14 continua em draft.

## Resposta executiva: onde estamos

**Fase 1 — Base confiável, EM ANDAMENTO**. O projeto já tem protótipo React Native/Expo, APK Android candidato 3.1.3, Guardião com validação matemática local e CNPJ opcional, tema OLED e navegação demonstrativa. Os laboratórios DataStore, Android Keystore, BiometricPrompt, SQLCipher, recuperação e SEC-05K têm testes isolados de CI, **mas não estão integrados ao APK 3.1.3**. Um job verde não valida o uso bancário, nem QA físico.

O APK Android 3.1.3 já gerado é assinado como **Debug** e não foi homologado na instalação do titular. A PR #6 continua em draft com lacuna conhecida de desativação biométrica transacional; a PR #17 cobre proposta futura de IA, não uma funcionalidade distribuída. O design com seis layouts é especificado na issue #13, mas a arte original de referência ainda não está anexada e as telas não estão implementadas.

**Estado de testes:** execução SEC-05K do commit af49e134, workflow 39724210261, aprovou 7/7 jobs, incluindo emuladores. O log contém 5.772 verificações Kotlin SEC-05K e 384 PostgreSQL, num total de 6.156 assertivas de laboratório, **sem relação percentual direta com o produto entregue**. A contagem é informativa, não um gate de release.

## Duas linhas de chegada

### A. APK DEMONSTRATIVO HOMOLOGADO (sem dados bancários reais)

Objetivo: instalação/atualização segura e navegação confiável do protótipo de demonstração. Não anunciar cofre, SQLCipher ativo ou proteção bancária.

- [x] APK de testes 3.1.3 já compilado e hashes publicados no histórico da PR #14.
- [x] Contratos CI/compilação de laboratório aprovados na revisão atual.
- [ ] Comparar de forma **somente leitura** certificado e versionCode do APK instalado com o candidato antes de qualquer tentativa de atualização.
- [ ] Executar QA-01 a QA-40 no Samsung com **dados fictícios**, registrar falhas e corrigir regressões de bloqueio visual, PDF, Guardião e captura.
- [ ] Demonstrar procedimento sem perda de dados e identidade de assinatura permanente apropriada ao canal. Assinatura Debug não pode ser simplesmente substituída sobre instalação incompatível.
- [ ] Revisar permissões, coleta de dados, dependências e comunicação de limites; publicar apenas após aceite explícito e sem confundir com release bancário.

**Bloqueio de segurança:** não apagar, reinstalar ou atualizar sobre um APK existente sem prova de assinatura compatível e plano de preservação de dados. QA físico só pode ser marcado após execução real autorizada.

### B. MVP FINANCEIRO OFFLINE (primeiro produto de controle financeiro)

Objetivo: permitir registrar manualmente receitas, despesas, cartões, categorias, parcelas e metas com dados persistidos de forma protegida. **Sem transferências reais, acesso bancário ou IA com dados financeiros enviados a servidor.**

#### Fase 1: fechar armazenamento e autorização
- [ ] Implementar *dentro do app* adaptador Android nativo/ponte Expo controlada para DataStore, BiometricPrompt/CryptoObject e ciclo de vida, com revogação e opt-out transacional seguro. Hoje: módulos isolados, não conectados.
- [ ] Integrar SQLCipher nativo ao módulo financeiro do Negresco Finance, sem fallback silencioso para SQLite em texto claro; testar criação/abertura, chaves incorretas, WAL, corrupção e kill/restart com dados sintéticos.
- [ ] Vincular a chave de dados ao Android Keystore, com provisionamento explícito, rotação, invalidação, política de senha/biometria, exportação/recuperação independente e testes reais em dispositivo.
- [ ] Definir migração segura do storage existente: backup com prova de integridade e restauração, assinatura estável, testes de atualização sem perda, armazenamento temporário e falha fechada.
- [ ] Resolver ou aceitar formalmente os limites de rollback na arquitetura aplicável, com revisão de modelo de ameaça, evitando fingir monotonicidade a partir de arquivos assinados. SEC-05K é um laboratório, não autoridade externa operacional.
- [ ] Executar auditoria técnica das bibliotecas nativas, licenças, ABIs, logs, LGPD e requisitos OWASP MASVS e homologação no Samsung; **não usar dados financeiros reais antes disso**.

#### Fase 2: implementar funções de finanças manuais
- [ ] CRUD local de contas, receitas, despesas e lançamentos; categorias e busca, validações monetárias e histórico.
- [ ] Cartões, fechamento/vencimento de faturas, compras parceladas e saldo mensal com regras determinísticas.
- [ ] Metas, reserva, orçamento por categoria e relatórios exportáveis com controles de privacidade.
- [ ] Operação offline, tratamento de erros, migração do schema e testes de não perda sob kill/corrupção/restauração.
- [ ] Integração consistente entre Guardião, navegação e dados financeiros **sem atribuir autenticidade bancária a validação matemática de boleto**.

#### Fase 5 antecipável: acabamento mínimo para MVP
- [ ] Modularizar o grande App.tsx, criar componentes/tokens reutilizáveis e telas responsivas/acessíveis.
- [ ] Implementar e conferir o conjunto visual aprovado da issue #13 **quando a arte horizontal original estiver versionada**, sem substituir a referência por um pôster novo.
- [ ] Executar QA funcional, segurança, desempenho, migração, privacidade, backup e assinatura de build de distribuição, com relatório de release.

**Definição de pronto do MVP:** CRUD e relatórios funcionam com persistência protegida; dados resistem às falhas previstas ou o app falha com segurança; atualização não perde dados; testes físicos passam; não há P0 críticos; documentação apresenta limites reais. Só então considerar distribuição além da demonstração, após revisão/consentimento do proprietário.

## Além do MVP: visão do superapp, sem prometer prazo

**Fase 3:** Negresco/CTO/Guardião como agentes funcionais com autorização por ação, privacidade, orçamentos de uso, limites de permissões e testes de segurança. PR #17 é planejamento futuro; 17 IAs não estão implementadas.

**Fase 4:** identidade Negresco ID, backend, eventual sincronização E2EE entre dispositivos, provedores Open Finance/Pix/investimentos autorizados, consentimento, LGPD e auditoria. Sem login bancário ou transações reais até obter habilitações apropriadas.

**Fase 5:** seis layouts definitivos, personalização, marca, acessibilidade, testes visuais e pacotes estáveis; clientes **iOS, Windows e Linux** dependem de projetos/portabilidade/CI e validação próprios, não surgem automaticamente do APK Expo Android.

Se “aplicativo completo” significar **toda a visão do superapp**, Fases 2–5 e suas integrações continuam amplamente pendentes; não existe percentual ou prazo técnico defensável com a informação atual. O **alvo executável primeiro** é o MVP offline sem integrações bancárias.

## Próxima ação recomendada para engenharia

**Primeiro bloco:** fechar o gate de migração nativa e QA em dispositivo da Fase 1, sem publicar APK. Produzir um plano de integração nativa mínimo com fronteira Expo/Kotlin, contrato dos estados DataStore/biometria e banco SQLCipher; auditar o caminho inseguro de opt-out da PR #6 e garantir que a próxima branch de produto não habilite armazenamento sensível antes da homologação. Evitar expandir indefinidamente testes SEC-05K sem reduzir os bloqueios de integração.

**Não alterar a PR #17, não mesclar a PR #14, não criar release/APK nem usar dados financeiros reais como parte desta documentação.**

## Fontes internas

- [Roadmap](ROADMAP.md) e [Fase 1](PHASE1_BASELINE.md)
- [Arquitetura](ARCHITECTURE.md) e [QA no Samsung](ANDROID_QA_V3.1.md)
- [Preview 3.1.3](releases/NEGRESCO_FINANCE_3_1_3_SECURITY_PREVIEW.md)
- [Gates Bitwarden aspiracionais](security/BITWARDEN_GRADE_SECURITY_GATES.md) e [SEC-05K](security/SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md)
- [Issue #1](https://github.com/nego001/negresco-finance./issues/1), [Issue #13](https://github.com/nego001/negresco-finance./issues/13), [PR #6](https://github.com/nego001/negresco-finance./pull/6), [PR #14](https://github.com/nego001/negresco-finance./pull/14), [PR #17](https://github.com/nego001/negresco-finance./pull/17)
