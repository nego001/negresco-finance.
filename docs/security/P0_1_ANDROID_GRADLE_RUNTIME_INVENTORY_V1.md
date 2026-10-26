# P0-1 | Inventário nativo Android Gradle de release

**PR DRAFT empilhada sobre a #80.** A build de laboratório continua
com assinatura Debug, canal OTA `preview`, sem merge na `main`,
sem segredos de produção e sem publicação.

## Lacuna verificada

As PRs #77–#80 documentam o grafo de **746 dependências npm**
e as relações transitivas que levam a `node-forge`.
Entretanto, bibliotecas Maven/AAR/JAR e módulos Gradle usados
na resolução de `releaseRuntimeClasspath` não aparecem
necessariamente nesse inventário.

## Nova evidência técnica

Depois de compilar o APK experimental com as mesmas versões
PostCSS/image-size e executar a verificação OTA, o workflow
executa, no **mesmo runner com o mesmo projeto Android**:

`./gradlew :app:dependencies --configuration releaseRuntimeClasspath --console=plain --no-daemon`

O relatório bruto `ANDROID_RELEASE_RUNTIME_DEPENDENCIES.txt`
é processado por
`tooling/android/gradle_release_runtime_inventory.cjs`, que gera
`ANDROID_RELEASE_RUNTIME_INVENTORY.json` com:

- módulos Maven resolvidos, com grupo, artefato e versão final;
- referências a módulos locais Gradle e quantidade de arestas;
- contagem de restrições de versão;
- SHA-256 do texto original, SHA-256 do APK e SHA do commit;
- marcador obrigatório `approvedForProduction:false`.

Falhas de resolução (incluindo `FAILED`), coordenadas
irregulares e versões não concretas bloqueiam a etapa.
A entrada é local, limitada em tamanho, sem links simbólicos
e o JSON é gerado sem timestamp aleatório.

**Correção após execução real:** mesmo com `--console=plain`, o Gradle
ou plugins podem emitir estilos ANSI SGR. O parser ignora apenas
sequências de cor/estilo SGR durante a extração do grafo, sem alterar
os bytes do relatório bruto usados no SHA-256. Controles de cursor,
OSC, NUL e outras sequências não permitidas continuam bloqueados.
Isso evita rejeição de relatório legítimo colorido sem abrir espaço
para normalização arbitrária de evidência.

Outra execução real (`40268362626`) revelou coordenadas Gradle válidas no
formato `com.facebook.react:react-android -> 0.81.4`, sem versão
solicitada à esquerda. O parser aceita esse formato sem inventar uma
versão de origem; **a versão selecionada à direita continua obrigatória
e deve ser concreta**. Um teste de regressão cobre a captura e a
rejeição de seletores como `latest`.

O run `40269541437` revelou também substituição de **módulo e versão**:
`com.facebook.react:react-native:+ -> com.facebook.react:react-android:0.81.4 (*)`.
O inventário agora interpreta a coordenada final escolhida pelo Gradle,
não registra o apelido solicitado como componente instalado e continua
bloqueando coordenadas inválidas ou versões resolvidas não concretas.
Testes de regressão cobrem substituições legítimas e falsificadas.

## Conferência após download

No artifact temporário (3 dias), os arquivos aparecem junto
do APK, lockfile, SBOM CycloneDX npm, ledger de advisories,
caminhos `node-forge` e prova de proveniência.

Um **segundo job read-only** baixa esses arquivos e refaz
o inventário a partir do texto Gradle, do APK e do SHA
do commit. Exige igualdade byte a byte do inventário
antes de executar as verificações binárias Android e OTA.

## Limites importantes

Um relatório `releaseRuntimeClasspath` mostra **resolução de
dependências Gradle**, não comprova que cada classe ou arquivo
dessas bibliotecas acabou dentro do APK final. Componentes
removidos por R8, transformados durante a build, embutidos
manualmente, bibliotecas nativas empacotadas e artefatos
de plugins Gradle podem exigir auditorias adicionais.
A integridade de tarballs npm e arquivos Gradle/AAR não
fica automaticamente comprovada por esse relatório.

Não é SBOM completo do Android, atestação SLSA assinada,
nem correção de qualquer advisory. Persistem cinco HIGH
Expo/`node-forge`. Assinatura de código OTA remota e
revisão independente continuam pendentes.
