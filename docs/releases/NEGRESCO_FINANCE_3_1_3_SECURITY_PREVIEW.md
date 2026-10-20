# Negresco Finance 3.1.3 | Candidato de testes (20/10/2026)

**Status:** build de testes; **NÃO** versão estável, financeira ou bancária. Esta versão não foi instalada nem homologada no Samsung do titular. A branch `main` mantém a versão anterior. Os módulos de laboratório continuam fora do binário Expo.

## Incluído no APK de testes

- Fonte React Native/Expo existente, com as correções do PR #6 relativas ao bloqueio biométrico **da interface**: prevenção de leituras antigas de preferências, cancelamento de operações obsoletas, serialização de mudanças e tentativa de recuperação após bloqueio interrompido.
- Interface OLED, Guardião local, configurações e proteção de captura do protótipo existentes.
- Versão Android `3.1.3`, `versionCode=34`. A mudança de versão evita que um build `3.1.2` receba acidentalmente atualizações OTA com runtime nativo incompatível.

**Limite crítico:** o bloqueio da interface e a guarda de preferências têm lacunas nativas conhecidas e ainda requerem QA físico. Não garantem criptografia de informações financeiras.

## Registrado no repositório, mas NÃO integrado ao APK

- Laboratórios Kotlin DataStore, revogação do desbloqueio e políticas de configuração biométrica.
- Laboratório Android Keystore com `BiometricPrompt.CryptoObject` e autorização de uso único.
- Banco SQLCipher Zetetic em arquivos **sintéticos**, integridade e comportamento de WAL sob falha de subprocesso.
- Envelopamento biométrico de chave de teste e verificação de invalidação de biometria por etapa manual.
- Protótipo **em memória** de recuperação offline independente via AES-256-GCM com identidade de banco.
- A suíte do PR #6 em `731e772` passou **40 testes automáticos Android**, com **5 testes manuais ignorados por padrão** e nenhum teste falho. A evidência NÃO inclui aceitação biométrica real.
- Os seis layouts aprovados, personalização e ícones/logo ficam planejados na [issue #13](https://github.com/nego001/negresco-finance./issues/13), **não incluídos no APK**.

## Como obter este candidato

O workflow `Android APK (3.1.3 security preview)`, na branch `release/3.1.3-security-preview`, deverá gerar dois artefatos do GitHub Actions:
- `negresco-finance-v313-test-apk`: APK de testes, SHA256 e certificado.
- `negresco-finance-v313-security-preview`: pacote ZIP, APK, hash, assinatura e notas.

O disparo por push **não publica Releases**. Publicar no GitHub Releases é manual e protegido por `workflow_dispatch` com `publish_release=true` na `main`. **Esta branch não é a `main` e não publica lançamento estável.**

## Atenção à instalação

**NÃO instalar por cima da versão existente no Samsung antes de comparar o SHA-256 dos certificados.** O build automático usa certificado Android Debug por padrão, que pode ser diferente da assinatura da instalação atual. Uma tentativa incompatível pode exigir desinstalação com risco de perda de dados. `versionCode` maior NÃO resolve assinatura divergente.

Antes de promover a atualização ao canal normal, exigir testes reais do bloqueio local e recuperação sem perda de dados, revisão de assinatura, avaliação dos riscos, restauração, testes físicos consentidos e auditoria independente.

**Nenhuma credencial, dado bancário ou chave do titular foi usado nesta distribuição.**
