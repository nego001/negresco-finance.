# P0-1 | Bloqueio de release estável com Expo OTA sem assinatura

Revisão de laboratório empilhada sobre a PR #56, sem publicar
APK/release, executar atualização OTA, configurar credenciais
ou alterar a `main`.

## Risco e comportamento atual

O aplicativo usa `expo-updates` para receber JavaScript e recursos
remotos do canal `preview`. O `app.json` atual declara
`updates.enabled=true`, um endpoint HTTPS e o canal `preview`,
mas **não declara** um `updates.codeSigningCertificate`.

Consequentemente, o sucesso da auditoria estática do APK não
demonstraria que JavaScript recebido posteriormente via OTA
teve assinatura independente verificada no dispositivo.

A documentação Expo explica que a assinatura ponta a ponta do
manifesto OTA usa um certificado público no app e uma chave privada
que deve permanecer fora do controle de versão. O certificado deve
ser incorporado à build que receberá atualizações assinadas.

Referência:
https://docs.expo.dev/eas-update/code-signing/

## Bloqueio de release estável

`tooling/android/verify_ota_release_signing.cjs` é um auditor
read-only. O workflow Android o chama **antes do Gradle e antes de
carregar credenciais estáveis** quando a ação é manual em `main`
e solicita `stable_signing` ou `publish_release`.

O auditor aceita somente dois estados:

1. **Embedded-only:** `updates.enabled=false` explícito, sem
   configuração de assinatura contraditória. O aplicativo usará
   apenas código e recursos compilados no binário.
2. **OTA assinada:** `updates.enabled=true`, endpoint HTTPS,
   `codeSigningCertificate` local apontando para um certificado
   X.509 público PEM único e válido, metadados
   `alg=rsa-v1_5-sha256` e `keyid` explícito. Exige RSA >= 2048
   bits e certificado válido por pelo menos 30 dias.

Rejeita configuração ambígua, certificado ausente, caminho absoluto,
`../` que escape do projeto, symlink, certificado expirando,
chave pública fraca ou PEM contendo chave privada.

**O projeto atual NÃO passa esse gate para lançamento estável**:
a configuração OTA preview existe sem certificado. Esta é uma
proteção proposital, não uma mudança automática no canal preview.
A equipe deve optar conscientemente por desabilitar OTA para releases
estáveis ou provisionar/validar o certificado, guardar a chave privada
fora do repositório e homologar updates assinadas.

O gate não modifica `app.json`, não cria chaves nem altera o
workflow manual de `Publish OTA Preview`.

## Testes e limites

`tests/android-ota-release-signing.test.mjs` executa o verificador
contra casos ausentes, configurações malformadas, caminho inseguro,
certificado ilegítimo, chaves efêmeras de testes, caducidade,
metadados errados e modo `embedded-only`.

O certificado público é necessário, mas não prova sozinho a
custódia da chave privada ou a política do servidor de updates.
São necessários um teste end-to-end de update assinado, rotação
de chaves, inspeção do manifesto compilado do APK de release
estável e revisão de segurança antes da distribuição.

A assinatura de código OTA no EAS pode depender de plano pago;
confirmar disponibilidade e custos antes da ativação.

Gates: testes Node, CI Android 9/9, APK de teste, publicador
SKIPPED e nenhuma publicação sem autorização explícita.
