# P0-1 | Conteúdo binário empacotado no APK experimental

**PR Draft empilhada sobre #81**, mantendo `main` e a publicação estável intactas.

## Distinção de evidência

A PR #81 validou 139 módulos Maven e 11 projetos selecionados em
`releaseRuntimeClasspath`. Isso não demonstra quais objetos entraram no APK.
Esta etapa abre o APK **exato** produzido pela build de laboratório e registra:
- arquivos `lib/{ABI}/*.so` e `classes*.dex` presentes no ZIP do APK;
- SHA-256 e tamanho descompactado de cada arquivo, ordenados deterministicamente;
- ABIs, quantidade total de membros ZIP, quantidade de bibliotecas e DEX;
- SHA-256 do APK, do inventário Gradle original e do relatório Gradle;
- SHA do commit e sinal obrigatório `approvedForProduction: false`.

O novo `tooling/android/apk_packaged_binary_inventory.py` captura
`APK_PACKAGED_BINARY_INVENTORY.json` durante a mesma execução que compila
o APK. Um job independente, sem npm, Gradle ou segredos de release, baixa
novamente **o próprio APK** e rederiva byte a byte o inventário.

## Controles negativos

São rejeitados membros ZIP repetidos, caminhos absolutos e `..`,
barras invertidas, controles, entradas especiais/symlinks, conteúdo
nativo em locais inesperados, DEX ou .so ausentes, tamanhos além dos
limites, hashes alterados, inventário Gradle incoerente e commit incorreto.
Testes sintéticos cobrem essas condições.

## Limitações mantidas

Uma lista de arquivos .so e DEX **não identifica automaticamente os AARs,
Maven packages ou fontes de cada classe**, não substitui SBOM nativo
completo, auditoria de SDKs, análise de código, SLSA ou revisão humana.
Continuam as cinco vulnerabilidades HIGH npm/Expo/node-forge.
O APK usa assinatura Android de **teste**, OTA `preview` sem assinatura
remota de produção e artifact temporário. Não há aprovação para release.
