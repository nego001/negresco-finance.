# P0-1 | Nomes de módulos provenientes do mapa Gradle do mesmo APK

PR experimental **empilhada sobre #87**, não integra `main` nem autoriza
release. Este teste aumenta a qualidade da análise de alcance do
JavaScript do APK sem divulgar código-fonte.

## Evidência nova
O Gradle `createBundleReleaseJsAndAssets` grava
`android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map`
na mesma compilação que gera `app-release.apk`. Os logs da execução
`40420753430` já demonstram a criação deste arquivo pelo Gradle.
Em vez de usar apenas o segundo `expo export` da PR #87, capturamos
um resumo local **desse mapa gerado pelo Gradle** após a build.

O relatório `GRADLE_PACKAGER_SOURCE_INVENTORY.json` contém hash
do mapa, hash/quantidade de nomes e contagens por pacote, mais SHA do
APK real, Hermes, lockfile e commit. Não inclui `sources` nem
`sourcesContent`. O job que baixa o APK valida novamente vínculos,
schema, contagens e bloqueio explícito de produção.

## Limites
O arquivo `packager.map` pertence ao estágio Metro/Gradle do **mesmo
build**. Ainda é uma descrição de fontes **pré-transformação Hermes**,
não um grafo de chamadas do bytecode final ou um teste de exploração.
A falta de nomes NÃO prova ausência da rotina vulnerável no APK e
muito menos ausência de uso de `node-forge` no host de build.
A leitura do mapa original ocorre apenas no runner: a reauditoria
independente **não consegue recalcular as contagens** sem compartilhar
os nomes brutos. A versão estável permanece bloqueada pela issue #83.
