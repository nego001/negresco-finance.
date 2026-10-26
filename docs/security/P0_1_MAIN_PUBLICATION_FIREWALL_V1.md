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
