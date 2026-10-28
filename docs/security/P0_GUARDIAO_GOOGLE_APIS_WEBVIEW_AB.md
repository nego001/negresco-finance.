# P0 | Android 8/9: controle A/B da imagem do emulador com WebView

## Hipótese, não causa confirmada
Em [PR #108, UI `40621636115`](https://github.com/nego001/negresco-finance./actions/runs/40621636115), o Android 8 API 26 com imagem `target: default` informou `webViewProvider=none-reported`, continuou em `foregroundCategory=negresco-app` e mostrou `report-failed-minimal-failed`. Android 9 API 28 mostrou `webViewProvider=provider-reported`, `foregroundCategory=other-or-unknown` e nenhum chooser reconhecido. Nenhum dos dois passou no PDF.

A ausência de provedor listado é uma pista de configuração/ambiente. Não atesta que ele seja a única causa da falha de impressão. Um provedor listado também não garante que o motor está saudável.

## Única mudança do experimento
- A PR #108 testou com `reactivecircus/android-emulator-runner` matriz API 26, 28, `arch=x86_64`, `target=default`.
- Este laboratório troca **somente `target: google_apis`**, mantendo matriz, arquitetura, app, script, relatório sintético, configuração de rede do APK, `FLAG_SECURE`, permissões e certificados.
- APK **idêntico e SHA pinado**, produzido na PR #106, [run `40617164086`](https://github.com/nego001/negresco-finance./actions/runs/40617164086): `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. Artefato `12786202004`, assinatura Android Debug e OTA preview unsigned.
- O runner aborta antes de instalar se o hash não corresponder. Apenas 47 zeros sintéticos e leitura de categorias fixas WebView/foco/estado. Não captura XML, logcat, prints, HTML, PDF, URI ou exceções.
- Resultado de PDF mínimo falhando é **BLOCK**. Somente verificação de `ChooserActivity`/`ResolverActivity` nativa real permite PASS do smoke. Mesmo com PASS, receptor e conteúdo do PDF não ficam homologados.

## Gates
- [ ] Contratos Node e pipeline de segurança no HEAD
- [ ] Android 8 API 26 Google APIs: provider WebView e resultado sintético, comparado à imagem default
- [ ] Android 9 API 28 Google APIs: provider e categoria do foco, comparado à imagem default
- [ ] PDF real íntegro recebido por aplicativo externo, ainda pendente
- [ ] Revisão humana e assinatura/OTA seguros antes de produção

**Limites:** Disponibilidade ou falha no download da imagem `google_apis` torna teste **inconclusivo**, não uma falha do aplicativo. Uma imagem com WebView não significa que os usuários reais tenham essa configuração. `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem merge na `main`, release ou publicação.
