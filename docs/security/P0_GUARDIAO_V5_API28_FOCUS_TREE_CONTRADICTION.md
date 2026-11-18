# API28 — foco do aplicativo dos dois lados, árvore do resolvedor no meio

## Evidência reproduzida em 17/11/2026

- [CI #44220538612](https://github.com/nego001/negresco-finance./actions/runs/44220538612): **SUCCESS, 1546/1546 contratos**, sem falhas ou skips.
- [Oito emuladores #44220538604](https://github.com/nego001/negresco-finance./actions/runs/44220538604): **5 PASS (1,2,3,4,5) / 3 BLOCK (6,7,8)** no Android9/API28 com APK test-only SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`.
- Nos trials 6,7,8, o PDF anterior tinha passado no receptor independente, o foco *antes* do primeiro UIAutomator snapshot era `window-focus-app`, o primeiro dump trouxe **somente o pacote `android`** com `resolver-id=present`, `dialog-id=present`, `listlike=present` e múltiplos clicáveis, o foco consultado *depois* já era `window-focus-app`, e o segundo snapshot da mesma checagem mostrou as abas do Negresco Finance. A primeira leitura inválida impôs **BLOCK** antes do próximo toque/PDF.
- Estes dados **não são atômicos** e não provam que o UiAutomator tenha armazenado uma árvore defasada, que o resolver estava em primeiro plano, nem que o PDF válido tenha travado. A consulta read-only extra *antes* do snapshot interfere no timing da própria corrida.

## Contrato de regressão, sem mais leituras reais

O teste offline novo chama as implementações reais `pre.sample`, `after.observe` e `gate.attest_triplet` sobre fixtures sintéticas e mocks ADB. Exige:
1. foco app antes / árvore do resolvedor primeiro / foco app depois / árvore do app segundo: **BLOCK**, sem tocar na Home;
2. resolver-resolver ou app-resolver: **BLOCK**, mesmo com os dois focos no app;
3. dois snapshots de app: **PASS só com PID estável**;
4. nenhuma alteração na implementação do aplicativo, nos callbacks de impressão, nos gates de impressão ou no tempo/gesto do teste.

A nova branch tem apenas teste e relatório. Não coleta dado real, não refaz emulador, não altera o APK ou `main`.

## Distinção vital: P0 original de impressão

A issue #120 registra o APK Release histórico original SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` que travou ocasionalmente em `Gerando PDF local...` **sem chooser**. O endpoint atual do run original [#40617164086](https://github.com/nego001/negresco-finance./actions/runs/40617164086) retornou zero artefatos disponíveis. Não substituir pelo APK experimental v5 para declarar cura. Se houver recuperação do binário instalado num dispositivo autorizado, exigir SHA idêntico e validar API26/28 com teste independente. Uma Release reconstruída não é evidência equivalente à original.

P0 #120/#126 OPEN, PR #125 Draft, `approvedForProduction=false`, `stableReleaseAllowed=false`, sem merge, OTA, instalação estável, pagamentos ou dados financeiros reais.
