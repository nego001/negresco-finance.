# P0-1 | SBOM npm determinística do APK combinado

PR DRAFT empilhada sobre #76. **Nenhum pacote foi integrado
ao aplicativo de produção e nenhuma release foi publicada.**

## Evidência

A #76 já valida o vínculo APK ↔ package-lock.json ↔ commit
de origem com hashes SHA-256. O lockfile candidato contém
**746 entradas npm** no grafo transitivo, incluindo
dependências de build, desenvolvimento e possíveis bibliotecas
de runtime.

Esse grafo ainda contém **cinco advisories HIGH**, relacionados
à cadeia `node-forge` / certificados Expo. Eles não desaparecem
só porque o APK é compilável.

## Nova capacidade

`tooling/android/npm_lock_cyclonedx_sbom.cjs` transforma
diretamente o lockfile npm v3 no inventário
`NPM_BUILD_GRAPH_CYCLONEDX.json` compatível com
**CycloneDX 1.6**, sem instalar pacotes adicionais.

Para cada entrada npm, ele exporta:
- nome e versão do pacote, identificador purl e localização
  exata no `node_modules` do lockfile;
- SHA-512 do tarball conforme o hash de integridade npm;
- URL do registry, flags de dev/optional, e licença quando
  declarada na entrada do lockfile.

Valida URLs HTTPS do registry npm, hashes SHA-512,
duplicidades de chaves no JSON, links locais, entradas
irregulares e caminhos de dependência inválidos.

A geração é **determinística**: não inclui relógio do
runner nem UUID aleatório. O SHA-256 do lockfile fica
registrado nos metadados.

## Conferência independente

O mesmo APK experimental passa a carregar o SBOM no
artefato temporário. O job de leitura independente:

1. verifica APK/lockfile/commit pelo manifesto da #76;
2. **regera o SBOM a partir do lockfile baixado e exige
   correspondência byte a byte**;
3. só depois repete a assinatura Android e a auditoria
   binária do canal OTA `preview`.

`tests/android-downloaded-apk-npm-sbom.test.mjs`
testa adulteração, bibliotecas extras, URLs falsas,
integridade truncada, symlinks e determinismo.

## Advertência de segurança

**Inventário npm de build não é um inventário de todos os
componentes executáveis dentro do APK.** Não contempla
automaticamente a árvore Gradle/AAR/JNI, SDK Android,
componentes gerados, código minificado Hermes ou o runtime
de uma OTA remota. O arquivo não é atestação SLSA assinada
nem garante ausência de malware.

O SBOM ajuda uma futura análise de licenças,
vulnerabilidades e proveniência, mas a release estável
continua **BLOQUEADA** pelos cinco avisos HIGH, falta
de assinatura OTA estável e revisão independente.
