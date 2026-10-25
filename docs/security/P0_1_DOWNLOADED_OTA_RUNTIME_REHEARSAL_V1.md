# P0-1 | Rehearsal de auditoria OTA no APK baixado

PR de laboratorio empilhada sobre #64. **Nao habilita publicacao**,
nao muda a main, nao concede `contents:write` e nao injeta chaves.

## Qual a lacuna?

A #63 confere o `AndroidManifest.xml` e o `resources.arsc` do
APK produzido pelo Gradle. A #64 introduz a rechecagem no job
privilegiado de publicacao, mas corretamente deixa esse job como
`SKIPPED` nas builds de laboratorio.

Era necessario testar o caminho efetivo **artefato uploaded -> artefato
baixado -> auditoria independente**, sem ativar a release.

## Implementacao

Adicionamos o job `verify-downloaded-ota-runtime` no workflow
`Android APK (3.1.3 security preview)`, separado do build:

1. `needs: build-test-apk`, em runner efemero, usando
   `permissions: contents: read`.
2. Faz `actions/download-artifact@v4` do artefato
   `negresco-finance-v313-test-apk` desta mesma execucao.
3. Valida que o checksum `android-apk.sha256` possui formato
   canonico e somente o caminho esperado. **Nao** utiliza
   `sha256sum -c` sobre caminhos fornecidos pelo artefato;
   calcula o digest dos bytes do APK no caminho fixo.
4. Verifica a assinatura Android com `apksigner` e o conteudo
   `resources.arsc` com AAPT2.
5. Executa o auditor de runtime com Python inline pertencente ao
   workflow, em vez de importar scripts do build ou fazer checkout.
   Comprova que a string `expo_runtime_version` compilada tem uma
   unica configuracao default com valor `3.1.3`.
6. O job deve passar nas PRs e builds preview, sem `secrets.*` nem
   a identidade de publicacao do projeto.

O publicador privilegiado da #64 continua usando seu proprio
verificador inline independente e nunca e executado durante PRs.

## Testes

`tests/android-downloaded-apk-runtime-rehearsal.test.mjs`
assegura identidade entre os dois auditores inline e a versao
autoritativa do verificador, isolamento de permissoes/checkout,
etapas ordenadas, hash canonico e bloqueios de corrupcao, symlinks
e caminhos maliciosos.

A CI do novo job comprova o download e inspeção real do APK
do mesmo workflow; os testes Node isolados nao equivalem
a essa prova de integracao.

## Limites

A igualdade SHA-256 prova consistencia entre itens de um
mesmo artefato, nao que o produtor tenha uma identidade confiavel:
a assinatura, a origem do workflow, gates independentes do
publicador e a politica de distribuicao permanecem controles
separados.

A assinatura de laboratorio pode ser Android Debug;
o rehearsal nao transforma esse APK em release estavel. OTA
`preview` continua sem certificado e nao pode ser publicada
como release assinada de producao.

Este job read-only nao testa a publicacao com `contents:write`;
a homologacao real OTA em dispositivo e a revisao humana ainda
sao obrigatorias.
