# Guardião | Diagnóstico de fase de falha do PDF (somente laboratório)

## Evidência que motivou este experimento
Na [PR #103, run de UI real `40591200018`](https://github.com/nego001/negresco-finance./actions/runs/40591200018), o aplicativo embarcado da PR #102 em Android 8 (API 26) confirmou entrada sintética de boleto, resultado inválido real, presença do botão de PDF, toque real, e mensagem **"Não foi possível gerar ou compartilhar o PDF."**. Esta mensagem conflui erros de renderização de PDF, verificação de disponibilidade e falha do compartilhamento Android. O Android 9 (API 28) chegou ao toque de PDF, mas não comprovou seletor nem erro visível por 55 segundos. Ambos os testes terminaram bloqueados, sem homologação funcional.

## Escopo de instrumentação segura
- `apps/mobile/guardiao/pdfExport.ts` mantém todos os bloqueios de token, background e biometria, URI `file://`, preservação de arquivos após native share e limpeza restrita de cache quando a tentativa não chegou ao chooser.
- Acrescenta **somente quatro códigos fixos e não sensíveis** para discriminar fronteiras de falha: `print`, `invalid-uri`, `availability`, `share`.
- O retorno principal continua `shared`, `unavailable`, `cancelled`, `failed`; o observador de diagnóstico nunca recebe o erro de Java/Kotlin/JS, URL, HTML, linha digitável, CNPJ, nome ou valores. Um observador com exceção não pode quebrar a proteção.
- `App.tsx` mostra mensagens em português apenas de uma tabela fixa de fase. Nenhum dado real ou rastreamento foi habilitado.
- Nove testes sintéticos novos de classificar exceções e impedir vazamento de dados.

## Gates obrigatórios
- [ ] Contratos Node e verificação TypeScript, sem qualquer regressão.
- [ ] Android Debug-signed APK experimental, idênticas restrições de quatro permissões externas, HTTPS/backup e OTA Preview apenas em laboratório.
- [ ] Reauditoria independente dos bytes do APK e da assinatura.
- [ ] Instalar novo APK em Android 8/9 e obter distinção real entre `print` versus `availability` versus `share`, sem dados reais.
- [ ] Confirmar arquivo PDF íntegro com receptor de teste isolado, sem permissões adicionais.
- [ ] Revisão humana, assinatura de release, OTA assinado ou embedded-only e gates restantes antes de produção.

## Restrições explícitas
**Não é uma correção funcional comprovada**; instrumenta a fronteira da falha para que a próxima correção seja específica. Android 8/9 permanece **BLOCKED** até teste de PDF completo, com compartilhamento. Nada é publicado e `approvedForProduction=false`, `stableReleaseAllowed=false`.
