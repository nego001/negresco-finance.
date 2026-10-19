# ADR 0001 — SQLCipher nativo e zero-knowledge exclusivos do Negresco Finance

**Status:** decisão de escopo aprovada pelo proprietário em 18/10/2026; implementação e testes nativos pendentes.

## Decisão vinculante

1. O banco **SQLCipher nativo**, as chaves de página independentes, o **Android Keystore**, a arquitetura de **criptografia ponta a ponta (E2EE)** e a futura sincronização **zero-knowledge** serão desenvolvidos e validados **somente no repositório `nego001/negresco-finance.`**.
2. **Não modificar, migrar, reutilizar como dependência operacional, nem redirecionar esse trabalho ao Security Black** (`nego001/personal-security-ai`). Os dois projetos têm escopos e roteiros separados. Qualquer alteração futura nele exige solicitação independente e explícita.
3. Esta decisão **não significa que o SQLCipher ou a arquitetura zero-knowledge já estão implementados ou aprovados**. O APK V3.1 atual usa apenas componentes de demonstração e armazenamento local limitado.
4. Seguir a ordem de entrega acordada: **Fase 1 — fundação confiável**, **Fase 2 — finanças manuais**, **Fase 3 — IA/agentes**, **Fase 4 — integrações autorizadas**, **Fase 5 — acabamento e lançamento**. Os requisitos de segurança relevantes bloqueiam coleta de dados sensíveis nas fases seguintes.
5. Toda nova dependência SQLCipher/Rust/bridge Android necessita inventário de licenças, hashes, build nativo controlado, testes no aparelho, gestão independente de chaves, migração/recovery e auditoria. **Nunca habilitar SQLite plaintext como fallback**.
6. Zero-knowledge significa que o **backend do próprio Negresco não deve ter chaves ou dados financeiros em claro**. Não prometer invisibilidade completa de metadados, de dados compartilhados com instituições financeiras autorizadas ou de conteúdos expostos no aparelho desbloqueado.

## Como executar sem pular a Fase 1

- Estabilizar builds, certificado Android e instalação por atualização sem perder os dados existentes.
- Homologar Guardião, preferências e privacidade no Samsung com **dados fictícios**.
- Definir e testar política de desbloqueio e recuperação de chaves antes de introduzir banco SQLCipher nativo.
- Implementar e auditar camada nativa SQLCipher em módulo isolado, sem ativação prematura no APK de teste e sem mudanças no Security Black.
- Verificar testes negativos: banco SQLite comum, chave incorreta, adulteração, corrupção, queda de energia, rollback e recuperação em um segundo dispositivo.
- Aprovar formalmente a implementação antes de armazenar credenciais ou informações bancárias reais.

## Rastreabilidade

- [Checklist da Fase 1](../PHASE1_BASELINE.md)
- [Gates SQLCipher e zero-knowledge](../security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md)
- [Roteiro de homologação Android](../ANDROID_QA_V3.1.md)

**Estado:** decisão registrada; desenvolvimento permanece na Fase 1, **sem integração SQLCipher nativa em produção**.
