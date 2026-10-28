# P0 | Isolamento do renderizador PDF Android 8 (somente laboratório)

## Evidência
A [PR #105](https://github.com/nego001/negresco-finance./pull/105) executou o APK da PR #104 com SHA-256 `642707ba661fa2b5bc547225b49587827b47de6412634211164338aa63388f19` em Android 8 (API 26). Após boleto com 47 zeros sintéticos, análise local e toque no botão, o app informou o código fixo **`print`** (falha no `Print.printToFileAsync`) **antes** de `Sharing.isAvailableAsync`. No Android 9 (API 28), o seletor não foi observado após o toque, mas nenhuma fase de erro foi exposta pela árvore UI; **causa ainda desconhecida**.

Isso isola o ponto de falha em API 26, mas não demonstra se é devido ao HTML/CSS do relatório, WebView, spooler/adapter, diretório do cache, perfil do emulador ou falha da biblioteca.

## Experimento A/B, sem dados reais
- Em APK **exclusivamente experimental** gerado desta branch, tentar o relatório original como anteriormente.
- **Somente se a impressão original lançar erro** e a análise ainda estiver em primeiro plano e desbloqueada, invocar `Print.printToFileAsync` uma vez com um HTML minúsculo, fixo e sintético que **não contém nenhum dado real**.
- Confirmar que o PDF mínimo retornou um arquivo pertencente a `cache/Print/<UUID>.pdf` e que o arquivo possui tamanho observável superior a 200 bytes. O arquivo é descartado por `discardUnsharedPrintPdf` de forma restrita.
- Proibir o envio desse PDF mínimo ao seletor Android: **a exportação do relatório original continua retornando `failed`** e nunca é substituída por documento fictício.
- UI comunica apenas três resultados fixos do teste: mínimo criado, mínimo também falhou, mínimo não verificável. Sem erro nativo bruto, PDF, URI, screenshot ou boleto.
- Não rodar se houver background, bloqueio biométrico ou nova análise em curso.

## Gates
- [ ] Testes de contrato e 8 testes sintéticos novos de isolamento/privacidade.
- [ ] Verificação TypeScript e CI nativo.
- [ ] Build Android Debug assinado só para laboratório, quatro permissões externas ausentes, backup/rede/OTA em política de preview.
- [ ] Auditoria independente dos bytes do APK.
- [ ] Testar original e HTML mínimo em Android API 26 e 28 com APK novo, identificar se mínima geração falha.
- [ ] Testar PDF real e compartilhamento por aplicativo receptor antes de quaisquer liberações.

## Bloqueios
Esta instrumentação **não é um reparo** e não deve ser publicada. `approvedForProduction=false`, `stableReleaseAllowed=false`. OTA Preview permanece sem assinatura, APK usa certificado Debug. Sem merge em `main`, sem release, sem dados bancários reais.
