# Negresco Finance | Fase 1: Base confiável

Status: **em andamento**. Esta fase é pré-requisito para iniciar a Fase 2 (controle financeiro manual). O APK continua **candidato de testes**, não um produto bancário.

**Escopo formal:** [ADR 0001](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md): SQLCipher nativo e zero-knowledge exclusivos do Negresco Finance. Não fazer alterações no Security Black para entregar estes requisitos. A V3.1 ainda não usa SQLCipher.

**Rastreamento GitHub:** [Issue #1 — SQLCipher nativo e zero-knowledge exclusivos](https://github.com/nego001/negresco-finance./issues/1). Critérios pendentes ficam registrados ali e não são considerados concluídos sem testes reais.

## Implementado e verificado no CI
- [x] Compilação Android automatizada com assinatura técnica verificada e SHA256 do APK.
- [x] Limites de memória do Gradle para compilar módulos Kotlin/Expo.
- [x] Identificação nativa da versão atual `3.1.2` (`versionCode 33`), com runtime OTA separado dos APKs `3.1.0` e `3.1.1`.
- [x] Publicação OTA manual, sem instalar módulos nativos pela rede.
- [x] Guardião: histórico resumido em SecureStore, gravações e exclusões serializadas.
- [x] Proteção contra respostas atrasadas da consulta opcional de CNPJ; limite de espera.
- [x] Evidências não bancárias não autorizam confirmar beneficiário ou banco de boleto.
- [x] Ao alterar boleto, limpar contexto CNPJ anterior; botão para limpar campos e resultados da sessão.
- [x] Preferências de aparência com gravações ordenadas e avisos de erro de armazenamento.
- [x] Política de ciclo de vida para limpar campos temporários do Guardião e prévia de conversa ao sair das páginas ou colocar o app em segundo plano. Não bloqueia screenshots.
- [x] Testes unitários e verificação estática do aplicativo para as alterações acima.
- [x] Publicação de impressão digital pública do certificado de assinatura em APK-SIGNATURE.txt. **Isto não estabiliza a assinatura por si só.**
- [x] Pacote completo como artefato independente do GitHub Releases (APK, ZIP, SHA256 e impressão digital). Builds antigos são substituídos por execuções mais recentes na mesma branch; erros de permissão no Releases continuam visíveis.
- [x] Android Auto Backup desabilitado enquanto não houver backup criptografado e recuperação segura. Reinstalar o app pode eliminar o histórico e as preferências locais.
- [x] Decisão ADR 0001 de escopo exclusivo documentada e vinculada aos gates; **somente documentação, não implementação nativa**.
- [x] Configuração **opcional** de certificado Android persistente via Secrets implementada e protegida por testes; builds padrões continuam assinados como Debug e não são produção.
- [x] Bloqueio visual **opt-in** por biometria forte implementado em código e com testes de política; requer o APK nativo `3.1.1` (versionCode `32`). **Ainda não validado no Samsung, não protege o banco nem os arquivos criptograficamente.**
- [x] Diagnóstico opcional do SecureStore com `requireAuthentication=true` implementado com marcador **sintético**, leitura autenticada e tentativa de limpeza. **Não comprova hardware dedicado, Android Keystore suficiente para SQLCipher, recuperação ou E2EE**.
- [x] Diferenciação entre prompt nativo transitório (`inactive`) e saída real (`background`), invalidando desbloqueios e resultados atrasados do diagnóstico; testes de política no CI e QA físico pendente.
- [x] Proteção **nativa de tela** preparada com `expo-screen-capture` somente para o Guardião ou quando bloqueio biométrico estiver ativo. APK `3.1.2` / versionCode `33` pendente de homologação no Samsung; não protege PDFs exportados, telas externas nem dados armazenados.
  - [ ] [Issue #5](https://github.com/nego001/negresco-finance./issues/5): executar QA-35/QA-36 para screenshot, gravação e miniatura no Samsung. Ainda sem confirmação de proteção real em hardware.
  - [ ] [Issue #3](https://github.com/nego001/negresco-finance./issues/3): homologar autenticação Android real, e depois vincular chaves ao Keystore e ao futuro SQLCipher. Não declarar liberado apenas com CI verde.

- [x] Mitigação de desativação interrompida: diário independente `optout.v1=pending` com prioridade no boot, marcador `disable-pending`, tentativas de restauração e testes simulados de morte do processo. **Ainda não é transação atômica: encerramento durante a exclusão final do diário permanece risco residual de opt-out inesperado.**

- [x] Recuperação da leitura inicial da preferência após background: ao retornar ao primeiro plano, um novo carregamento substitui o resultado invalidado. Teste de regressão no CI, **QA-40 físico pendente**.
- [x] [Contrato nativo de persistência do bloqueio](security/NATIVE_LOCK_PERSISTENCE_V1.md) documentado com critérios de transação, migração e homologação. **É somente arquitetura: módulo Kotlin/DataStore ainda não implementado.**

- [x] Gate do GitHub Actions reforçado: builds de push/feature branch geram somente artefatos; GitHub Release candidato exige disparo manual em `main` com `publish_release=true`. Política testada no CI; **não revoga releases antigos automaticamente**.

- [x] Núcleo Kotlin experimental do bloqueio criado fora do app, com políticas de sessão e 10 cenários JVM, sem adaptadores de persistência/biometria e sem integração Expo. **Não é módulo Android nativo homologado, não habilita SQLCipher ou chaves reais.**

## Ainda pendente para concluir a Fase 1
- [ ] **Homologação no Samsung:** executar [roteiro de QA da V3.1](ANDROID_QA_V3.1.md), registrar falhas e corrigi-las. Sem execução física não declarar aprovado.
  - [x] Ferramenta **somente leitura** de pré-diagnóstico ADB/versão/hash preparada para Windows; sem validação física até o usuário executar no Samsung.
  - [x] [Comparador somente leitura de assinatura e versionCode](ANDROID_UPGRADE_PREFLIGHT.md) criado para Windows; consulta APK instalado e candidato sem modificar o celular, **não executado no aparelho nesta sessão**.
  - [ ] Executar QA-01 a QA-40 no aparelho e anexar relatório sem informações privadas (inclui biometria, Keystore, captura, prompts e assinatura de APK).
- [ ] **Identidade de assinatura estável:** configurar keystore de distribuição administrado com segurança fora do Git, com segredos no GitHub Actions; confirmar atualização sobre APK anterior **sem perder dados**. Nunca publicar chave privada no repositório.
  - [x] [Procedimento de configuração e migração documentado](ANDROID_SIGNING_V3_1.md), com exigência de hash SHA-256 do certificado.
  - [ ] Criar/provisionar chave permanente fora do GitHub, executar build opt-in e testar atualização entre duas versões com a mesma assinatura.
  - [ ] Tratar a instalação anterior Debug como migração separada. **Não desinstalar uma cópia com dados sem plano de backup/restauração validado.**
- [ ] **Autenticação e proteção local:** o bloqueio visual por biometria forte é apenas um protótipo. Validar o BiometricPrompt no Samsung, implementar vínculo real de chaves ao Android Keystore, recuperação e gestão de sessão antes de aceitar dados financeiros. Não chamar o protótipo de aplicativo bancário seguro.
- [x] Política **lógica e testada** de separação de chaves SQLCipher, E2EE e recuperação offline ([Key Lifecycle V1](security/KEY_LIFECYCLE_V1.md)); **não cria nem armazena chaves reais**, não aprova zero-knowledge.
- [ ] **Banco nativo + zero-knowledge:** cumprir [gates SQLCipher e E2EE](security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md) antes de habilitar qualquer biblioteca nativa, integração bancária ou armazenamento sensível real.
  - [ ] Executar no Samsung o diagnóstico Keystore com digital cadastrada, cancelamento e alteração de digitais; registrar resultado sem dados privados.
  - [ ] Projetar chaves independentes de SQLCipher e E2EE, provisionamento, rotação e recuperação offline antes de guardar informações financeiras reais.
- [ ] **Ciclo de vida dos dados:** testar armazenamento, exclusão, backup/migração, integridade e recuperação após falhas.
- [ ] **Teste de exposição de dados e permissões:** garantir que informações pessoais não apareçam em logs, relatórios ou interfaces sem ação do usuário.
- [ ] **Modularização básica:** reduzir dependência do grande componente App.tsx sem quebrar navegação.
- [ ] **Critérios de aceite:** CI verde, APK da revisão final validado, testes do Samsung aprovados e pendências críticas P0 zeradas.

## Próximas fases, nesta ordem

1. **Fase 2:** controle financeiro manual e offline (receitas, despesas, categorias, parcelas, cartões, metas, relatórios) com armazenamento e testes locais.
2. **Fase 3:** assistente Negresco e agentes CTO/Guardião funcionais, com escopos e autorização do usuário.
3. **Fase 4:** backend e integrações bancárias apenas com provedores autorizados e auditoria.
4. **Fase 5:** refinamento visual, acessibilidade e lançamento progressivo.

> Não coletar credenciais financeiras reais nos testes. O Guardião ainda **não certifica boletos**; dígitos ou CNPJ consistentes não comprovam legitimidade.
