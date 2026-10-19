# Atualizacoes OTA - Negresco Finance

## Estado atual
Projeto Expo ID: `a506611f-a159-4341-bed7-28dcbd47bf95`.
O aplicativo Android V3.1.0 esta configurado para `https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95`, runtime pela versao do app e canal `preview`.
**Ainda nao ha confirmacao de APK OTA instalado, canal ligado a branch ou atualizacao recebida no dispositivo.**

## Preparacao segura
1. Confirmar no painel Expo que o proprietario da organizacao em `app.json` corresponde ao slug real da organizacao. Se diferente, corrigir `expo.owner` antes de publicar.
2. Em Expo > Updates, configurar o canal `preview` para a branch `preview`. Canal e branch sao objetos distintos.
3. Criar um token de acesso Expo de escopo minimo apropriado. Adiciona-lo **somente** como secret `EXPO_TOKEN` no repositorio GitHub (Settings > Secrets and variables > Actions). Nunca colocar o token no codigo, prints ou chat.
4. Acessar Actions > Android APK (V3.1 candidate) e verificar se a compilação publicada corresponde ao APK de teste desejado. Conferir **certificado e versionCode** antes de instalar sobre qualquer app existente; assinatura Debug pode ser incompatível com o APK atual. Consulte [assinatura Android](ANDROID_SIGNING_V3_1.md).
5. Somente depois de confirmar runtime `3.1.0`, conta Expo, canal e instalação compatível no Samsung, executar Actions > Publish OTA Preview > Run workflow, fornecendo mensagem de alteração. Não tentar usar OTA para adicionar bibliotecas Android nativas.
6. Abrir o app, reiniciar conforme necessario, conferir se recebeu a atualizacao, e testar recuperacao. So depois considerar outros canais.

## Limites e protecoes
- O workflow de OTA e manual, exige `EXPO_TOKEN`, verifica ID/URL/runtime/canal e publica **apenas Android na branch preview**.
- A branch `preview` deve estar vinculada ao canal `preview` no EAS.
- Mudancas nativas exigem novo APK e incremento de versao/runtime quando incompativeis.
- A assinatura digital e a origem de atualizacoes devem ser verificadas antes de distribuir amplamente.
- Nao usar dados bancarios reais neste prototipo.
- GitHub Actions e EAS tem cotas gratuitas sujeitas a alteracao.
