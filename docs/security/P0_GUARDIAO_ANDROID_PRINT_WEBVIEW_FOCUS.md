# P0 | Android 8/9: identificar foreground e provedor WebView sem dados privados

**Lab de observabilidade. Nenhum reparo funcional é afirmado.**

## Motivação
- [PR #107, execução `40620699584`](https://github.com/nego001/negresco-finance./actions/runs/40620699584) executou o APK real SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` com 47 zeros sintéticos em Android 8 e 9.
- **Android 8/API 26:** análise sintética e botão PDF comprovados; relatório original e PDF mínimo falharam (`report-failed-minimal-failed`). Isso aponta para falha antes de `expo-sharing`, mas não distingue WebView ausente, adaptador de impressão ou arquivo local.
- **Android 9/API 28:** análise e toque no PDF confirmados; UI do aplicativo deixou de apresentar mensagens observáveis, e o chooser não foi detectado. Pode haver mudança de foco, crash ou falha da regra de detecção; o resultado anterior não distingue.

## Procedimento de observação seguro
- Reusar **exatamente o mesmo APK imutável** de PR #106 run `40617164086`, artefato `12786202004`. SHA ZIP `ec488b6ef3d276826e87182c7aee7f271d51903196090b1699e621aa7248c57d`, SHA APK `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`.
- Emular Android API 26 e 28, sem dados financeiros, internet de app desabilitada, bundle embarcado.
- Sem screenshots, XML de UI, logcat, PDF ou texto de exceção. O `adb dumpsys` é consultado **localmente** e reduzido a categorias fechadas antes de imprimir qualquer resultado.
- Indicadores permitidos exclusivamente: `appProcessAlive` (booleano), `foregroundCategory` (`system-chooser`, `negresco-app`, `system-ui`, `other-or-unknown`, `unknown`) e `webViewProvider` (`provider-reported`, `none-reported`, `unknown`).
- A instrumentação **não altera** `ChooserActivity` como único caminho de sucesso nem transforma relatórios de falha em PASS.
- A informação `provider-reported` mostra apenas que o sistema **lista** um provedor WebView, sem provar que ele está saudável. A categoria `unknown` não significa ausência.

## Critérios
- [ ] Contratos Node e restante da CI nativa no HEAD
- [ ] Android 8/API 26: identificar estado do processo e provedor no instante da falha de impressão
- [ ] Android 9/API 28: identificar se foco da janela passou para app/chooser/sistema/desconhecido
- [ ] Receptor externo abrir PDF real (não parte deste lab)
- [ ] Revisão humana e OTA assinada/release signing antes de produção

O pipeline mantém `approvedForProduction=false`, `stableReleaseAllowed=false`; nenhuma produção, merge, distribuição ou OTA.
