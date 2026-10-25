# P0-1 | Auditoria OTA independente no publicador privilegiado

PR em rascunho empilhada sobre #59, sem merge ou publicação.

## Problema

O build da #59 inspeciona `AndroidManifest.xml` compilado, mas o job
privilegiado de release pode receber um APK diferente. O job não pode
confiar apenas no resultado do build, nem executar scripts do ZIP de
artefato ou fazer checkout de código do candidato.

## Verificação no próprio workflow

Novo passo `Independently audit downloaded compiled OTA policy`
no publicador, **depois das verificações de assinatura Android, checksum,
XML de rede compilado e políticas de backup** e antes de criar tags
ou releases. O código Python é armazenado inline no workflow que
executará o publicador, sem checkout e sem execução de código baixado.
A inspeção abre apenas o `AndroidManifest.xml` binário do APK que
acabou de ser baixado do artifact, com limites de tamanho e estrutura.

- `embedded-only`: exige boolean compilado
  `expo.modules.updates.ENABLED=false`, sem metadados
  `CODE_SIGNING_*`. Não requer configuração de certificado OTA.
- OTA assinada: exige `ENABLED=true`, certificados PEM literais,
  JSON com `rsa-v1_5-sha256` e um `keyid` exatamente igual ao valor
  aprovado na variável `NEGRESCO_OTA_KEYID`.
- O certificado PEM embutido é transformado em DER localmente
  (sem rede e sem executá-lo) e SHA-256 do DER deve coincidir com
  a variável independente `NEGRESCO_OTA_CERT_DER_SHA256`.
- A ausência das variáveis para OTA assinada é motivo de bloqueio;
  não há valor padrão permissivo nem certificados autoassinados
  criados nesta alteração.
- Metadados inesperados, duplicados, aninhados, malformados,
  certificados divergentes e ZIPs suspeitos bloqueiam publicação.

As variáveis confiáveis acima devem ser provisionadas por revisão
de segurança quando for escolhida uma release OTA assinada. O
certificado **público** pode estar no app; a chave privada de
assinatura OTA jamais deve entrar no repositório, artefatos ou
variáveis de configuração públicas.

## Testes

`tests/android-publish-compiled-ota-policy.test.mjs` extrai o
**código Python verdadeiro do workflow**, constrói APKs ZIP
sintéticos contendo AXML, gera certificados efêmeros de teste
e comprova os fluxos permitidos e negações adversariais.

O teste não executa o publicador com `contents:write` e não
publica nenhuma release. O publicador só pode iniciar em
`workflow_dispatch` manual na `main` com assinatura estável
e autorização de publicação explicitamente ativadas.

## Limites e próximas provas

O bloqueio de release estável sem assinatura OTA, a validação
X.509 no build e o teste real OTA assinado em aparelho são controles
separados. O parser do APK por si só não demonstra o funcionamento
end-to-end do Expo Updates, nem governança de chave privada.
Também são necessárias aprovação humana das variáveis independentes,
homologação de update assinado e política de revogação/rotação.

Estado atual: OTA preview sem certificado, portanto
**sem autorização para distribuição estável**. CI Android/testes,
publicador SKIPPED e revisão humana continuam gates obrigatórios.
