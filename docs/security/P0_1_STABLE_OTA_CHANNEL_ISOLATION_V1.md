# P0-1 | Canal OTA de producao isolado do preview

PR de laboratorio empilhada sobre #60. Sem alterar a `main`,
sem atualizar aplicativos instalados e sem publicar releases.

## Risco

Uma build estavel com certificado de assinatura OTA, porem apontando
ao canal Expo `preview`, pode consumir atualizacoes feitas para testes.
A assinatura protege integridade e autenticidade da atualizacao,
mas nao define sozinha a politica de promocao entre ambientes.

O projeto usa a configuracao:
- Expo endpoint: `https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95`
- Canal dos APKs de laboratorio: `preview`
- Versao nativa 3.1.3, runtime policy `appVersion`

## Medidas

1. O gate de origem `verify_ota_release_signing.cjs` continua
   aceitando `updates.enabled=false` para `embedded-only`.
   Em OTA assinada estavel ele exige **exatamente** o endpoint
   Expo confiavel acima e apenas
   `updates.requestHeaders['expo-channel-name']='production'`.
   Rejeita preview, staging, URL de outro projeto e headers extras.
2. A leitura `expo config --json` no workflow distingue
   `workflow_dispatch` manual estavel na `main` de build
   normal de laboratorio. Assim, preview permanece preview
   nas branches de testes, sem transformar APKs de teste em
   APKs de producao acidentalmente.
3. A auditoria do manifesto Android **gerado** verifica os
   metadados `EXPO_UPDATE_URL` e
   `UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY`, exigindo
   endpoint e canal de producao nas builds assinadas estaveis.
4. A auditoria do AndroidManifest **binario compilado no APK**
   repete essas exigencias sobre os bytes reais empacotados.
5. O publicador privilegiado repete a prova sobre o APK
   baixado com codigo inline fixo no workflow, sem checkout
   nem executar scripts contidos no artefato.

## Evidencias e testes

Os testes exercitam configuracao e manifests sinteticos
validos e adulterados, incluindo canal preview, endpoint
substituido, headers ausentes/malformados/extras, divergencia
entre app.json e APK, e equivalencia no publicador.
Alem dos testes Node, a CI Android deve passar com o canal
preview atual; isto NAO atesta um release OTA estavel.

## Limites

**A configuracao atual NAO esta pronta para distribuicao estavel.**
O app usa OTA preview sem certificado publico configurado.
Para distribuir uma build estavel OTA assinada e necessario:
provisionar certificado e chave privada gerenciada, mudar
conscientemente o canal para producao, confirmar as politicas
e validar updates assinadas ponta a ponta em dispositivos.
Nenhuma chave privada foi adicionada. Nenhuma release publica
pode ocorrer sem revisao de seguranca e autorizacao explicita.

Esta etapa verifica apenas a configuracao estatica embutida.
Uma auditoria de overrides de canal/URL em tempo de execucao
continua recomendada antes de producao.

Referencia:
https://docs.expo.dev/eas-update/deployment/
https://docs.expo.dev/versions/latest/sdk/updates/
