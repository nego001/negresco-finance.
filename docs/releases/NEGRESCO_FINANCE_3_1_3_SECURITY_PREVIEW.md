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


## APK 3.1.3 gerado e inspecionado (GitHub Actions)

- Build do commit `91076c56457902dfa007a330266c85b21d132d98`: [GitHub Actions #39376841287](https://github.com/nego001/negresco-finance./actions/runs/39376841287) — **SUCCESS**.
- `versionName=3.1.3`, `versionCode=34`, `package=com.negresco.finance`, confirmado por `aapt`.
- **SHA-256 do APK**: `f70ba5107c24e4e59c423ba898f281d9cc8aebc8852f4a0f999cb5923d1c0077`.
- **SHA-256 do certificado Android Debug**: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. O certificado é de **testes**, NÃO de release estável; não presumir que coincide com o da instalação existente.
- Artifacts do run: `negresco-finance-v313-test-apk` (APK, assinatura e hash); `negresco-finance-v313-security-preview` (pacote ZIP, APK, hashes, notas e certificado).
- As alterações posteriores no repositório foram restritas à documentação, testes de contrato e ferramenta Windows de pré-verificação; **o APK existente não foi recompilado a partir desses commits**.
- O laboratório SQLCipher/Keystore/recuperação não foi empacotado no APK 3.1.3. A suíte do laboratório passou **40 testes Android**, com **5 intencionalmente ignorados**, na revisão `731e772` do PR #6.

## Verificar o APK baixado ANTES de consultar o Samsung

O script `tooling/windows/compare-installed-apk.ps1` agora pode recusar arquivos com hash, certificado ou versão diferentes dos verificados acima. Executar em PowerShell com SDK Android (ADB, aapt, apksigner) instalado; apontar caminhos corretos:

```powershell
$projeto = Join-Path $HOME 'negresco-finance'
git -C $projeto fetch origin
git -C $projeto checkout release/3.1.3-security-preview
git -C $projeto pull --ff-only origin release/3.1.3-security-preview

$apk = Join-Path $HOME 'Downloads\Negresco-Finance-V3.1.3-preview.apk'
& (Join-Path $projeto 'tooling\windows\compare-installed-apk.ps1') `
  -ApkPath $apk `
  -ExpectedSha256 'f70ba5107c24e4e59c423ba898f281d9cc8aebc8852f4a0f999cb5923d1c0077' `
  -ExpectedCertSha256 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c' `
  -ExpectedVersionName '3.1.3' `
  -ExpectedVersionCode 34
```

O arquivo `$apk` acima é apenas exemplo de nome/local: depois de baixar um *Actions Artifact* ZIP, primeiro extrair o APK para esse caminho, conferindo o nome real. O script é SOMENTE leitura: compara pacote, versão e certificados com o `base.apk` instalado (copiado temporariamente ao PC), mas **NÃO instala, desinstala, limpa dados, altera PIN nem executa operações financeiras**. Mesmo resultado `COMPATIBILIDADE PROVAVEL` não constitui backup/migração garantidos. Resultado incompatível ou incerto significa **não instalar por cima, não desinstalar**.

Os testes Node de contrato asseguram que os quatro valores fornecidos ao verificador sejam checados **antes** da primeira consulta ADB, e que não haja comandos de instalação/remoção; eles **não** substituem executar/verificar esse PowerShell no Windows real e no Samsung com consentimento.

### Gate final ainda NÃO aprovado

- [ ] Comparar certificado de APK instalado e candidato via leitura do Samsung.
- [ ] Homologar migração do bloqueio local, preferências e Guardião num aparelho com **dados fictícios**, sem perda.
- [ ] Testar biometria forte e cancelamentos com hardware real, recuperação sem perda e assinatura permanente antes de release estável.
- [ ] Revisar anti-rollback e caminho de opt-out transacional nativo; ainda há limitações conhecidas no PR #6.


## Gate Android nativo adicional: DataStore real, sem biometria do usuário

O laboratório `tooling/native-lock-android-lab` passou a compilar uma suíte `androidTest` própria e executar o novo job `native-lock-android-emulator` no CI do PR, com um emulador Android API 35 descartável. **Essa integração não aparece nem é ativada no APK 3.1.3**.

Oito testes isolados verificam:
1. DataStore inexistente não significa `enabled=false` nem autorização implícita.
2. Migração legada bloqueada permanece persistida após fechar e reabrir o DataStore real.
3. Preparação de desligamento continua com `enabled=true` depois de reabrir e sua recuperação rearma o bloqueio.
4. Duas preparações simultâneas com a mesma revisão não podem confirmar duas gravações.
5. Estado contraditório `enabled=false` com `disablePending=true` é rejeitado mesmo após reabrir.
6. `enableIfCurrent` não pode alterar um registro já bloqueado nem oferecer operação de desativação.
7. Se o registro desaparecer depois de um desbloqueio, a nova chamada `unlock()` revoga imediatamente a autorização anterior; restaurar o arquivo não recupera a sessão sem autenticação nova.
8. Se o registro ficar parcial/corrompido depois de um desbloqueio, a nova chamada `unlock()` falha e revoga a sessão anterior no **DataStore Android real**.

Cada teste só usa um arquivo de preferência **descartável e único** no `noBackupFilesDir` do pacote do laboratório, e o apaga após cancelar os scopes DataStore próprios. Não lê/escreve preferências de produção, não acessa banco financeiro e **não registra a biometria do Samsung**.

A preparação de desativação ainda não fornece o commit final `enabled=false`: a desativação transacional vinculada ao ciclo de vida segue bloqueada, e o código Kotlin ainda não está integrado ao Expo. **Compilar os testes não equivale a executá-los**. A aprovação desta nova etapa depende de verificação explícita do job `native-lock-android-emulator` no HEAD do PR #14.

O `tests/native-lock-android-emulator-contract.test.mjs` exige que esse job continue restrito a PR, com dependência da compilação, runner fixado e sem inclusão do laboratório no APK. O CI em `push` compila a instrumentação e os testes; a execução no emulador ocorre apenas no CI de `pull_request`.

Referências: [PR #14](https://github.com/nego001/negresco-finance./pull/14) e [PR #6](https://github.com/nego001/negresco-finance./pull/6). A assinatura e a instalação no Galaxy A55 seguem pendentes de QA físico e consentimento.


## Revogação imediata após falha de releitura nativa

Foi identificado um risco lógico no laboratório Kotlin: se uma Activity já tivesse uma sessão autorizada e outra chamada `unlock()` encontrasse um registro ausente, uma exceção no `repository.read()` ou uma revisão de estado não utilizável, o retorno `STORAGE_ERROR`/`MIGRATION_REQUIRED`/`STALE` podia ocorrer sem revogar a **autorização anterior** em memória. A leitura por `snapshot()` já revogava, mas a chamada direta de `unlock()` não deveria depender de uma leitura posterior.

A correção em `SuspendingNativeLockCoordinator` introduz `revokeOnUnsafeRead`, que invalida a geração e a autorização anterior **sincronamente** antes de devolver erro/negação em leituras inseguras de `unlock()`. Uma leitura válida posterior não recicla o desbloqueio antigo: precisa de nova autenticação. O fluxo `disable()` ainda retorna `DENIED`; isto **não** implementa o commit final de desativação.

Três cenários JVM com transporte sintético `ReadFaultDataStore` verificam: falha em nova leitura após desbloqueio válido, ausência de registro após desbloqueio válido e falha da segunda leitura depois de autenticação. O total nominal da suíte JVM do laboratório cresce de **125 para 128 cenários**, além dos 6 testes Android de DataStore e 45 de SQLCipher (dos quais 5 de biometria manual são ignorados no CI comum).

**Gate:** não declarar esses três novos cenários aprovados até conferir `native-lock-spike` no **head** atual do PR #14. A correção permanece no laboratório: sem autolinking Expo, sem atualização de APK/OTA, sem QA físico, sem garantia de proteção bancária.


**Reforço de revogação:** a execução ampliada passa a conter **8 testes Android nativos**, além dos **128 cenários Kotlin/JVM** (3 testes novos de falha de leitura) e dos testes SQLCipher. Validar o CI e o job de emulador no commit exato antes de declarar esses oito aprovados; os novos testes nunca tocam a instalação pessoal ou o APK 3.1.3 já gerado.
