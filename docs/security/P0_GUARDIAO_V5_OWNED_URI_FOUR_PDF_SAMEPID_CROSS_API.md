# Negresco Finance — v5: quatro PDFs no mesmo processo e barra inferior íntegra

## Ponto de partida comprovado
A [segunda rodada de Android 8 e 9 #43791151639](https://github.com/nego001/negresco-finance./actions/runs/43791151639) concluiu **4/4 SUCCESS** no commit `3b8991b`. Cada emulador independente recebeu um PDF sintético e verificou páginas e conteúdo, com remoção de cache. A [CI #43791151839](https://github.com/nego001/negresco-finance./actions/runs/43791151839) encerrou **SUCCESS, 1.488/1.488 contratos**. O primeiro ensaio [#43790557611](https://github.com/nego001/negresco-finance./actions/runs/43790557611) também concluíra 4/4 SUCCESS antes da correção de um teste de configuração.

## Nova pergunta experimental
Após a primeira exportação, o guardião de propriedade do PDF `isOwnedPrintPdfUri(uri,FileSystem.cacheDirectory)` continua funcionando sem reiniciar o processo e sem quebrar as três abas inferiores **Início, Pix, Negresco**?

Dois jobs efêmeros, **um Android8/API26** e **um Android9/API28**, reutilizam o MESMO APK compilado, sem reconstrução, com SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`, certificado `CN=Android Debug`, artefato do run [#43789332636](https://github.com/nego001/negresco-finance./actions/runs/43789332636).

Os runners já aprovados no v4 são reutilizados sem alterar seu código ou afrouxar sua política: em cada emulador, PDF sintético A/B/C/D recebido por aplicativo independente, PDF renderizado e conteúdo semântico validado, cache removido, **um único PID** para quatro ciclos e **três retornos à aba Início**. A geometria das abas é observada duas vezes ao entrar pela primeira vez e antes/depois de cada retorno; toda falha causa BLOCK.

Esta nova branch troca APENAS o SHA pinado do runner compartilhado antes de executar as verificações antigas (o SHA v4 anterior continua `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`; o Release histórico original não disponível continua `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`). O workflow verifica SHA e `CN=Android Debug` antes de iniciar o emulador. Nenhum conteúdo real, PDF, URI, UI XML, screenshot, logcat, credencial, arquivo financeiro, mídia ou usuário é registrado como artefato. **Os resultados reais só podem ser afirmados depois que os dois jobs terminarem e seus logs mostrarem os quatro PASS de cada ciclo, os três retornos e a geometria.**

## Limites: este não é o bug histórico
Este teste aumenta cobertura funcional do **candidato v5 experimental**, mas não diagnostica a falha intermitente (3/6 casos históricos Android9) do APK Release original com SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` indisponível. Também não testa aparelhos físicos nem prova a rejeição de URI forjada no Android (apenas testes de contrato do código).

**Bloqueios intocados:** #120/#126 OPEN; PR #125 DRAFT/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`; sem merge, OTA, assinatura estável, release pública, Pix/pagamento ou dados financeiros reais.
