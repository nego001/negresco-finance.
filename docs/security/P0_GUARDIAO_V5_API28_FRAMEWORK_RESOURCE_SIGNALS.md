# Android 9 P0 — sinais estruturais do framework no snapshot pré-retorno

## Evidência anterior

A [CI #44142336374](https://github.com/nego001/negresco-finance./actions/runs/44142336374) finalizou **SUCCESS, 1520/1520 contratos**. Na [matriz Android9 #44142336594](https://github.com/nego001/negresco-finance./actions/runs/44142336594), os trials 2 e 4 falharam fechados depois de PDFs sintéticos reais verificados; trial 1 passou e trial 3 estava pendente na última consulta desta etapa. Nos snapshots inválidos, a árvore não estava vazia: só continha nós do pacote framework exato `android`, com TextView, clickable, resource ID do Android e um nó ocupando >=60% da tela, sem foco marcado. No snapshot seguinte, as três abas do app voltaram a aparecer. A diferença NÃO é autorização para navegar.

## Próxima medição: indícios de seletor/resolvedor versus diálogo genérico

Sem coletar um único nó novo, a instrumentação categoriza os mesmos nós em memória:
- `framework-resolver-id`: presença de identificadores estruturais exatos de resolvedor, ex.: `resolver_list`.
- `framework-chooser-id`: presença de marcadores exatos de chooser, ex.: `chooser_grid`.
- `framework-dialog-id`: presença de identificadores genéricos de diálogo, ex.: `contentPanel`, `alertTitle`.
- `framework-listlike`: presença de GridView/ListView/RecyclerView.
- `framework-choice-control`: presença de RadioButton/CheckBox/CheckedTextView.
- `framework-click-targets`: nenhum, um ou múltiplos nós com `clickable=true`.

Os nomes são comparados em memória contra uma allowlist fixa, apenas para nós cujo pacote é exatamente `android`, com namespaces `android:id/` ou `com.android.internal:id/` quando aplicável. Nenhum identificador real, texto, XML, conteúdo de PDF, coordenada, pacote ou exceção será impresso. O código AOSP ResolverActivity tem referências a IDs como `resolver_list` e `contentPanel`; um marcador isolado não prova que a janela era a ChooserActivity, e nenhum marcador é prova de que ela não era.

Referência de engenharia (AOSP, implementação sujeita a variação no Android 9): https://android.googlesource.com/platform/frameworks/base/+/1dcdbb5af50053613d01710123b45e2463350ac7/core/java/com/android/internal/app/ResolverActivity.java

## Limites invariáveis

Todos os testes usam o mesmo APK experimental SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`, assinado Android Debug no build #43789332636. Quatro emuladores API28 independentes, fixture sintética, mesmos toques, os mesmos dois snapshots e o mesmo gate original. Nenhum ADB extra, sleep, gesto, restart, print de dados privados ou substituição de APK. Uma leitura inválida causa BLOCK ainda que a seguinte seja válida.

P0 #120/#126 OPEN; PR #125 Draft, main não modificada; `approvedForProduction=false`, `stableReleaseAllowed=false`. Sem pagamento real, liberação, OTA, merge ou instalação estável.
