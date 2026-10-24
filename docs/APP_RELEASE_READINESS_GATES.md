# Negresco Finance | Estado real e plano de conclusão do aplicativo

**Atualizado:** 22/10/2026. **Fonte:** branch `release/3.1.3-security-preview`, PR #14 (DRAFT), `docs/PHASE1_BASELINE.md`, `docs/ROADMAP.md`, PR #6, issue #13 e plano SEC-01–SEC-10.

> Este documento é um rastreador de **gates**. Nenhum checklist, teste isolado, APK Debug ou número de cenários substitui validação no dispositivo e segurança de produção. **Sem autorização de merge, publicação, instalação, migração ou manipulação de dados reais.**

## Resposta curta: em qual fase estamos?

**Fase 1 de 5 — Base confiável, AINDA ABERTA.** O subtrabalho ativo é **SEC-05K** (journal de rekey, recibos, anti-rollback e checkpoint Merkle), exclusivamente em fixtures Kotlin/JDBC/Android separadas. A candidata Android é **3.1.3, versionCode 34**, com interface Expo existente. A segurança nativa testada no laboratório **NÃO está integrada ao APK**, e o APK de CI usa assinatura **Debug**.

**Não confundir frentes:**
- **P0–P5:** arquitetura/engenharia de alto nível.
- **Fases 1–5:** ordem oficial de entrega do produto.
- **SEC-01–SEC-10:** componentes da segurança.
- **3.1.3:** versão candidata do APK, **não** porcentagem de conclusão.

## Entregue como protótipo, ainda sem homologação de produto

- Navegação e interface OLED com telas demonstrativas de módulos financeiros.
- Guardião: validação matemática local de linha digitável, histórico resumido, PDF local e consulta opcional CNPJ via BrasilAPI. **Não** confirma legitimidade nem autoriza pagamento.
- Bloqueio **de interface** opt-in por biometria, controles de lifecycle e tela protegida, ainda sem garantia criptográfica de dados e sem QA físico concluído.
- Compilação/contratos/CI e artefato APK 3.1.3 **de testes**, com atualização futura condicionada a assinatura compatível.

## Existe em laboratório, NÃO funciona no aplicativo instalado

- DataStore transacional, Android Keystore/CryptoObject, SQLCipher com dados sintéticos, política de sessão, migração, WAL e recuperação, confiança de dispositivos.
- SEC-05K: snapshots/journal, CAS de geração/UUID, assinaturas Ed25519, detecção de divergência/replay, simulações PostgreSQL e árvores Merkle (inclusão/consistência RFC 9162).
- Nenhum desses ensaios comprova storage monotônico fora de controle de um administrador; as raízes/checkpoints, retenção e high-water externos ainda não são providos por um serviço confiável.
- CI dos emuladores comprova somente o código que executaram; não demonstra integração do núcleo Kotlin/SQLCipher ao aplicativo Expo nem aceite no Samsung real.

## Gates bloqueadores de conclusão da Fase 1 (priorizados)

| Ordem | Gate | Evidência para marcar concluído | Estado |
| --- | --- | --- | --- |
| P0-1 | Bridge Android nativa segura entre Expo ↔ DataStore ↔ autorizador Keystore/BiometricPrompt ↔ SQLCipher | Fluxo ponta a ponta com arquivos fictícios, sem bypass por JS, ciclo de vida e falha fechada | **Pendente** |
| P0-2 | Ciclo de vida real de chaves e dados: inicialização, criptografia, rotação, exclusão, WAL, backup/restauração e migração | Testes instrumentados do app integrado, sem plaintext/segredos em logs, perda de energia simulada | **Pendente** |
| P0-3 | SEC-05K / autoridade independente para recuperação entre dispositivos e anti-rollback forte | Autorização do titular, identidade provisionada fora de banda, CAS+recibo linearizável, checkpoint não reversível e auditoria | **Laboratório, bloqueado** |
| P0-4 | Assinatura de distribuição e atualização segura | Keystore de release fora do Git, certificado estável; comparar com instalado; atualização sem perda e rollback seguro | **Pendente** |
| P0-5 | Homologação no Samsung com dados falsos | Executar QA-01 a QA-40, biometria forte/alteração de cadastro, screenshots, background, recuperação, instalação | **Pendente** |
| P0-6 | Auditoria final de segredos, dependências, permissões, logs e backups | Revisão OWASP MASVS/MASTG, riscos críticos encerrados, evidências de CI + teste físico | **Pendente** |
| P1-1 | Refatoração do grande `App.tsx` e desacoplamento visual/dados | Telas/modos isolados, arquitetura testável, navegação preservada | **Pendente** |

**Risco de dados existentes:** APKs de CI com assinatura Debug podem não compartilhar o certificado do aplicativo instalado. **Jamais desinstalar ou tentar forçar upgrade para trocar assinatura** sem plano de backup/restauração que já tenha sido validado.

## Caminho mais curto para um app utilizável sem contas bancárias

Este MVP **não é app bancário** e não inclui Pix real, agentes autônomos, sincronização de dispositivos ou proteção remota antirrollback anunciada como pronta.

1. Fechar os gates essenciais de armazenamento local cifrado, autorização nativa, backup e identidade de assinatura **antes** de permitir registros financeiros pessoais.
2. Entregar **Fase 2**: receitas, despesas, contas, categorias, parcelas, cartões, metas, filtros e relatórios **manuais/offline**, com testes de persistência e exportação segura.
3. Polir experiência e validar em dispositivo físico: erros, restauração, instalação e acessibilidade. Pode existir um *candidato de testes* antes de cumprir gates de lançamento; ele deve ser rotulado corretamente.

Se a arquitetura exigir recuperação **entre dispositivos com anti-rollback forte**, SEC-05K e as provas de segurança externas passam a ser gates explícitos desse recurso. Remover esse recurso do MVP não transforma automaticamente a segurança local em aprovada.

## Escopo completo depois do MVP (Fases 3–5)

- **Fase 3:** Negresco AI, CTO, Guardião e especialistas reais. A PR #17 documenta personagens e futura arquitetura, **nenhum agente funcional entregue**.
- **Fase 4:** backend e Open Finance/Pix/investimentos reais, **somente** via provedores autorizados, consentimento e revisão legal/técnica/segurança.
- **Fase 5:** acabamento, acessibilidade, QA multiplataforma e lançamento. Os **seis layouts aprovados** permanecem backlog na issue #13; a arte original horizontal precisa ser anexada ao GitHub para comparação 1:1.

## Próxima execução recomendada

1. Preservar PR #14 em draft, estabilizar sua CI, parar de tratar ensaios de fixture como recursos entregues ao usuário.
2. Desenhar **um vertical slice nativo local** com conta e registro sintéticos: bloqueio por operação → Keystore → SQLCipher → relançamento → registro acessível somente após autenticação, incluindo falhas e migração. Esse slice é o ponto de virada do laboratório para o produto.
3. Independente disso, prototipar o serviço/checkpoint de SEC-05K com contas fictícias e raízes autenticadas, sem alterar o fluxo de dados financeiros, até provar limites de restauração.
4. Planejar a coleta segura de evidências do teste Samsung e da assinatura de distribuição **com consentimento explícito**, sem instalar/desinstalar ou receber dados reais automaticamente.

**Regra de conclusão:** Fase 1 só pode ser encerrada com evidências de integração + segurança + QA físico, e não por CI de componentes isolados. O produto completo também requer Fases 2–5 e decisão explícita sobre integrações e IA.

**Referências:** [Fase 1](../docs/PHASE1_BASELINE.md) · [Roadmap](../docs/ROADMAP.md) · [PR #14](https://github.com/nego001/negresco-finance./pull/14) · [PR #6](https://github.com/nego001/negresco-finance./pull/6) · [Issue #13](https://github.com/nego001/negresco-finance./issues/13) · [PR #17](https://github.com/nego001/negresco-finance./pull/17).
