# P0-1 | Publicação automática e assinatura estável bloqueadas na main (proposta)

**PR DRAFT baseada na main** `0b751fddfac98ea9e27a01db92d3c7a7e1dd378b`.
A alteração ainda não está integrada à `main`.

## Risco confirmado
O workflow `.github/workflows/android-apk.yml` da `main` concedia
`contents: write`, instalava pacotes usando `npm install --no-audit`
e executava `gh release create/edit/upload` ao fim do build sem
condição de despacho manual. Um evento `push` nos caminhos observados
poderia produzir uma nova *prerelease* sem revisão de dependências.
`stable_signing=true` também podia alcançar credenciais sem o gate
`verify_stable_npm_audit.cjs` presente apenas nos branches Draft.

## Bloqueio mínimo e reversível proposto
- Permissão de todo o workflow reduzida a `contents: read`.
- Removida a etapa de criação/edição/upload em GitHub Releases.
- Qualquer pedido `stable_signing=true` falha **antes do npm install,
prebuild, Gradle ou acesso às credenciais**.
- Continua disponível somente o artifact temporário de candidato de
teste com assinatura Debug para análise e auditoria, sem publicação pública.
- Testes negativos travam regressões de permissão, publicação e gate.

## Saída deste bloqueio
Um workflow estável **novo**, revisado, deverá exigir lockfile auditado,
zero advisories conhecidos sem revisão, assinatura real comprovada,
política OTA assinada ou embedded-only, verificação independente do
APK baixado, identidade de certificado, aprovação manual e
permissões write somente no job publicador explicitamente autorizado.

As **cinco entradas HIGH** transitivas de `node-forge` ainda
impedem aprovação. A issue #83 acompanha o patch upstream.

## Defesa em profundidade: nenhuma credencial de produção

O workflow candidato não referencia mais variáveis ou secrets de assinatura
estável: apenas `NEGRESCO_USE_STABLE_SIGNING: 'false'`. Uma segunda barreira
aborta `stable_signing=true` antes do Gradle, mesmo se a verificação inicial
for removida. A checagem do APK exige assinatura Android Debug e não contém
ramo que aceite certificado estável. Os textos do pacote falam somente em
artifact temporário, sem GitHub Releases.

## Bloqueio temporário de publicação OTA Preview

Outra rota encontrada: `.github/workflows/ota-preview.yml` tinha despacho manual
que instalava pacotes npm sem audit e utilizava `EXPO_TOKEN` para enviar
JavaScript remoto ao canal `preview`. Isso não publicava um APK, mas
**podia distribuir código** aos dispositivos inscritos nesse canal.

A PR propõe substituir esse job por uma resposta fail-closed, sem checkout,
sem pacote npm, sem `EXPO_TOKEN` e sem `eas-cli update`. É possível
acionar manualmente o workflow, mas ele **falha sem publicar**. Uma alteração
futura nesse arquivo dispara também a verificação do APK candidato.
Essa mudança **não remove atualizações OTA já publicadas**. Uma retomada
requer dependências revisadas, política de atualização assinada, rastreio de
versão e aprovação humana explícita.

## Teste negativo executável sem segredos

O gate interno de compilação agora permite **somente o valor literal `false`**;
`true`, letras maiúsculas, valor vazio e ausência de entrada falham
antes de chamar Gradle. Os contratos de CI executam os **mesmos trechos Bash**
da proteção de build, da barreira anterior ao npm e do workflow OTA sem
acessar chaves, baixar dependências ou publicar qualquer atualização. Esses
testes não simulam o serviço `workflow_dispatch` do GitHub integralmente:
para isso, seria necessária execução manual independente no branch.

## Remoção da opção manual de assinatura estável

O próprio formulário de `workflow_dispatch` agora **não possui o campo
`stable_signing`**: o comando manual pode acionar somente um build de
testes com identidade Debug. A verificação no início do workflow e a
segunda barreira no script de build permanecem para falhar se alguém
reintroduzir um parâmetro de assinatura de produção sem revisar a
política. Portanto, não há mais ação manual `stable_signing=true`
disponível **nesta revisão do workflow**. Isto só se torna a configuração
operacional da `main` após revisão e integração da PR.
