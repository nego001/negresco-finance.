# P0 | Guardião Android 8/9: observação real da sonda de impressão mínima

**Ambiente descartável de laboratório. NÃO é uma homologação financeira.**

## Proveniência do APK
- PR #106, [run `40617164086`](https://github.com/nego001/negresco-finance./actions/runs/40617164086), commit do código `a01286f91c53a12e977c3e550300c872e5955d45`: build + reauditoria independente ambos **SUCCESS**, sem publicação.
- Artefato GitHub `12786202004`, ZIP SHA-256 `ec488b6ef3d276826e87182c7aee7f271d51903196090b1699e621aa7248c57d`.
- APK interno `android/app/build/outputs/apk/release/app-release.apk`, SHA-256 **`29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`**, 61.369.593 bytes. SHA inspecionado diretamente dos bytes extraídos do arquivo real e validado outra vez pelo runner, antes de instalar.
- Exige quatro permissões externas ausentes no APK, backup e cleartext bloqueados, Expo OTA preview unsigned, certificado Android Debug. Nenhuma chave de produção ou release.

## Testes de UI
- Instalar APK exato em emuladores Android 8 (API 26) e Android 9 (API 28), offline, somente com 47 zeros de boleto sintético deliberadamente inválido.
- Percorrer Guardião → análise local → mensagem de invalidez → botão real de PDF.
- Quando o relatório original falhar em `expo-print`, a PR #106 executa uma geração extra com HTML **mínimo e fixo**. O experimento não substitui, disponibiliza nem compartilha esse PDF mínimo. Só inspeciona uma URI sob cache privado `Print/<UUID>.pdf`, checa existência/tamanho e tenta descartar o arquivo.
- Observar somente uma entre três mensagens fixas e retornar **BLOCK**: `report-failed-minimal-created`, `report-failed-minimal-failed`, `report-failed-minimal-unverified`.
- Se aparecer `ChooserActivity`/`ResolverActivity` para relatório original, informar `PASS (LAB)` unicamente para abertura do chooser, sem atestar validade/recebimento do PDF.
- O teste não registra nem faz upload de screenshot, hierarquia de UI, logcat, PDF, linha digitável real, endereço do PDF ou erros nativos.

## Critérios de aceitação
- [ ] Testes de contratos e validação estática no HEAD
- [ ] Resultado sintético real Android API 26, sem classificar falha como aprovação
- [ ] Resultado sintético real Android API 28, sem classificar ausência de chooser como aprovação
- [ ] Teste do PDF real recebido e renderizado em app receptor independente, depois que renderer principal for reparado
- [ ] Revisão humana e release signing/OTA assinado ou embedded-only antes de liberar produção

## Limites
Um PDF mínimo gerado com sucesso é **diagnóstico do renderizador**, não evidência de relatório real correto. Falha de impressão mínima indica que até um HTML simples falhou, mas não identifica automaticamente WebView, spooler, permissões ou cache como causa raiz. O projeto permanece `approvedForProduction=false`, `stableReleaseAllowed=false`. PR Draft e nenhum merge na `main`.
