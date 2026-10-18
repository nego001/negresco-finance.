# Atualizacoes OTA - Negresco Finance

## Estado atual
A dependencia `expo-updates` foi adicionada e o runtime foi vinculado a versao do aplicativo. **OTA remoto ainda nao esta operacional**: falta conectar o projeto a um provedor de atualizacoes e publicar uma build nativa contendo a URL/canal corretos. O APK P0 ja instalado nao recebe OTA retroativamente.

## Configuracao antes de distribuir uma nova build
1. Criar ou selecionar um projeto no Expo/EAS, com autorizacao do proprietario.
2. Executar `npx eas-cli update:configure` em `apps/mobile` com a conta correta. Conferir as mudancas geradas, inclusive `expo.extra.eas.projectId` e `expo.updates.url`.
3. Configurar canais separados, como `preview` e `production`, e vincular o canal desejado ao binario.
4. Gerar e instalar uma **nova build Android** com essas configuracoes nativas.
5. Publicar atualizacoes compativeis com `npx eas-cli update --channel preview --message "descricao"` apos revisao.
6. Testar entrega, reinicio, rollback e compatibilidade em dispositivo real antes de habilitar distribuicao ampla.

## Regras
- Mudancas nativas, permissoes, SDK ou bibliotecas com codigo nativo exigem novo APK.
- A politica `runtimeVersion: appVersion` exige aumentar `expo.version` quando houver alteracao nativa incompativel; versoes diferentes nao devem compartilhar runtime por engano.
- Nao publicar segredos ou credenciais nos bundles OTA.
- Mudancas financeiras sensiveis precisam de testes, controles de autorizacao e liberacao gradual.
- Em ausencia de atualizacao remota, a versao embarcada deve continuar funcionando.
