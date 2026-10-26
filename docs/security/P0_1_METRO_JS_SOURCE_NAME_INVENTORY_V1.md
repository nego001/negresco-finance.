# P0-1 | Observação dos módulos JS no grafo Metro (laboratório)

**PR Draft empilhada sobre #84**, sem modificar `main`, instalar releases
nem liberar qualquer chave. GHSA-86w9-cpqp-85rv continua sem patch.

## Por que existe
A PR #84 registra o hash do Hermes **exato dentro do APK**, mas nomes de
módulos JS não são recuperáveis com segurança apenas varrendo seus bytes.
Este experimento executa `npx expo export --platform android
--source-maps --no-bytecode` no mesmo checkout e na mesma árvore npm
temporária usada para produzir o APK, após o `npm ci` experimental.
O mapa é analisado localmente no runner, sem publicar conteúdos de fonte.

O arquivo agregado `METRO_JS_SOURCE_NAME_INVENTORY.json` grava:
- hashes SHA-256 de mapa/nomes de módulos (sem o conteúdo);
- contagem de ocorrências nos caminhos `node-forge`, `@expo/cli`,
  `@expo/code-signing-certificates`, `expo-updates`;
- SHA de commit, lockfile, APK empacotado e bundle Hermes da PR #84;
- `approvedForProduction: false` e `productionReleaseAllowed: false`.

## Limitação explícita e importante
**O `expo export` é uma segunda compilação Metro independente**.
Mesmo com lockfile e commit iguais, ela **não é o bundle byte a byte
que o Gradle incorporou ao APK**. O resultado pode sugerir onde procurar
funções, mas presença/ausência de caminhos **não prova alcance de
rotinas criptográficas nem ausência de vulnerabilidade** no APK.
A execução de `node-forge` em ferramentas npm no host de build é
outro vetor, diferente da execução no celular.

Não suprimir advisories, forçar `node-forge@1.4.0`, distribuir mapa
bruto com `sourcesContent` ou declarar a release pronta.

## Gate
O export precisa ter ao menos um mapa com fontes válidas; entradas
inesperadas/ausentes falham. Os relatórios não incluem caminhos brutos.
Testes verificam diffs de origem, ausência de mapas e alteração de
vínculo com o APK. Os mapas brutos ficam apenas no runner e **não**
integram o artifact público de três dias.

## Reauditoria do relatório baixado

Um job separado, **depois** de verificar o APK e Hermes diretamente
dos bytes recebidos, executa `metro_source_name_inventory.cjs verify`.
Ele valida os hashes e vínculos do relatório Metro com o **APK baixado**,
Hermes, lockfile e commit; também verifica o formato dos campos, a
proibição explícita de produção e a inexistência de campos adicionais
(como `sourcesContent`). Os testes simulam alterações nos metadados,
contagens e APK.

**Limitação irredutível:** como os mapas brutos ficam privados no job de
origem, o verificador independente **não consegue recalcular as
contagens de fontes**. Ele apenas valida estrutura e identidade do
relatório transferido. A conclusão de alcance JavaScript permanece
intencionalmente inconclusiva.
