# P0 API28 — contrato permanente: primeiro snapshot do resolvedor BLOQUEIA

## Evidência reproduzida em 17/11/2026

Na [rodada de 8 emuladores #44148211865](https://github.com/nego001/negresco-finance./actions/runs/44148211865), **trial 5** terminou FAIL fechado depois que PDF A sintético foi validado por receptor independente. A primeira leitura anterior ao retorno à aba Início registrou:
- `tree=nonempty app=absent nonapp=present`;
- `foreign-framework=present` e outros grupos externos `absent`;
- `framework-nodes=present framework-text=present framework-clickable=present framework-resource=present framework-area=large-node-present`;
- `framework-resolver-id=present framework-dialog-id=present framework-listlike=present framework-click-targets=multiple`;
- nenhuma das três abas do app.

O segundo snapshot (~1,2s depois) retornou com o app e as três abas válidas, mas o atestado exige dois snapshots corretos e **bloqueou antes do PDF B**. Esses sinais são *compatíveis* com uma superfície de resolvedor/seleção de apps do Android, mas não confirmam a Activity no foreground. Não houve falha demonstrada na impressão de PDF A.

O resultado global da rodada de oito emuladores e a CI completa **ainda estavam em execução** quando a mudança foi preparada. A CI dos contratos do [HEAD de stress `56c6cdb`](https://github.com/nego001/negresco-finance./commit/56c6cdb6b81904f75df9ade1a9039f6a857bab28) passou **1528/1528**; não confundir com conclusão da CI inteira.

## Novo teste de regressão offline e determinístico

Cinco testes Node/Python verificam as seguintes invariantes SEM emulador:
1. Nós sintéticos do pacote exato `android` com `android:id/resolver_list` são classificados como `framework-resolver-id=present` e não satisfazem `scoped_triplet_category`.
2. **Resolver primeiro, app depois: BLOCK**, mesmo com a recuperação do segundo snapshot.
3. **App primeiro, resolver depois** e **resolver nos dois**: ambos BLOCK.
4. Dois snapshots válidos do app só PASS quando o mesmo PID é observado nas duas verificações; mudança do PID bloqueia.
5. Invariantes do runner (duas leituras completas, pre/post-retorno, sem bypass) continuam detectáveis no código.

Esses casos executam `attest_triplet` real com leituras e PID totalmente simulados; qualquer chamada ADB inesperada falha. O teste nunca instala APK, gera PDF, toca em app ou registra conteúdo de tela.

**Escopo:** a branch é independente para não cancelar a execução de oito emuladores. Nenhum workflow de emulador é acrescentado. Nenhum ajuste de timing, gesto, navegação, XML, limite ou decisão foi feito; apenas teste e documentação. A arquitetura de produção não muda.

A identidade do APK experimental permanece SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`. Release original histórico imutável; `main` intocada; PR #125 Draft; P0 #120/#126 OPEN, `approvedForProduction=false`, `stableReleaseAllowed=false`. Nenhuma aprovação, OTA, pagamentos ou dados reais.
