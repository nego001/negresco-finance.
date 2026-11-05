# P0 #120 | Android 9: matriz de evidências para intermitência do PDF Release

**Estado (05/11/2026): BLOQUEADO PARA PRODUÇÃO.** PR #125 continua Draft; `approvedForProduction=false`, `stableReleaseAllowed=false`. Este documento é de investigação; não é homologação, correção funcional, aceite de QA físico ou autorização de publicação.

## Identidade do binário e privacidade

- Sempre usar os **mesmos bytes originais** do APK Release do run [#40617164086](https://github.com/nego001/negresco-finance./actions/runs/40617164086), SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. A cópia `negresco-finance-v313-security-preview` (artefato `12785229732`) foi confirmada disponível em 05/11; expiração anunciada pelo GitHub: **11/11/2026 02:00:03 UTC**. Sem reconstrução, troca de binário, redistribuição ou assinatura de produção.
- Apenas entradas deliberadamente inválidas e sintéticas; verificar **EditText único e valor exato** antes de considerar qualquer tentativa de PDF. Sem boletos reais, captura de tela, XML bruto, texto de PDF, logcat bruto, dados bancários, nomes ou identificadores privados publicados.
- Toda declaração de PASS exige chooser Android real, receptor separado que abriu e renderizou o PDF gerado, verificação semântica independente, limpeza de cache e recibos pós-upload. Um indicador de UI ou callback isolado nunca é PASS.

## Matriz observada

| Observação | Evidência | Conclusão estrita |
| --- | --- | --- |
| Intermitência original API28 | [run #40808040078, tentativa 3](https://github.com/nego001/negresco-finance./actions/runs/40808040078/attempts/3), job `124604520513`: toque em 31/10 às 17:24:38 UTC; nenhum chooser até 17:25:42 UTC (~64 s); processo vivo, foco no app, provedor WebView reportado | **Falha real da prova de compartilhamento**. Não revela se `onPageFinished`, `onLayout`, `onWrite` ou callback de compartilhamento deixou de responder |
| Variabilidade de entrada de teste | [run #41961332101](https://github.com/nego001/negresco-finance./actions/runs/41961332101): API28 `synthetic-edittext-value-unconfirmed` antes de análise e exportação | **Não é falha do PDF**. Falha fechada por entrada não confirmada. Releituras somente passivas agora limitadas a três snapshots |
| Release dois ciclos no mesmo API28 | [run #42052802553](https://github.com/nego001/negresco-finance./actions/runs/42052802553): ciclos a/b PASS, chooser em `under-5s` cada, recibos independentes verificados | Prova duas execuções funcionais sob as condições dessa sessão, **não ausência de intermitência** |
| Release API28 x3 e controle API26 | [run #42052802066](https://github.com/nego001/negresco-finance./actions/runs/42052802066): 5/5 jobs PASS; samples API28 a/b/c com chooser `under-5s` ou `5-to-15s` | Testes independentes funcionaram; não identifica o mecanismo da tentativa antiga |
| Release pareado API26/API28 | [run #42052801927](https://github.com/nego001/negresco-finance./actions/runs/42052801927): 3/3 jobs PASS | Ambos os recibos testados e auditados, sem prova de correção causal |
| Debug API28 com instrumentação nativa | [run #42052802145](https://github.com/nego001/negresco-finance./actions/runs/42052802145): PASS; `native-render-completed`, PDF semântico e limpeza PASS, `native-renderer-exit-not-observed-in-window` | O marcador de saída não apareceu **na janela de log observada no Debug**. Não exclui saída fora da janela nem prova comportamento do Release imutável |
| Contratos e CI | [CI push #42052802291](https://github.com/nego001/negresco-finance./actions/runs/42052802291) PASS; 1311/1311 contratos. [CI PR #42052812095](https://github.com/nego001/negresco-finance./actions/runs/42052812095) tentativa 1 falhou no `native-lock-android-lab` ao resolver plugin Gradle `com.android.library` 8.8.2 | Incidente de resolução de dependência de CI, **não falha de PDF**. Falha precisa ficar visível até repetição satisfatória, sem apagar testes |

## Critérios para o próximo diagnóstico

1. **A etapa de entrada deve ser separada da etapa de PDF.** Se `synthetic-edittext-value-unconfirmed`, ação, análise ou botão PDF não foram confirmados, categorizar `pre-export-block`; nunca contar como timeout de PDF.
2. **Marcar o início no toque comprovado no botão PDF** e observar seletor com faixas fixas `under-5s`, `5-to-15s`, `15-to-30s`, `30s-or-more` ou `not-observed-before-block`. A faixa mede a observação via ADB, **não** o tempo do renderizador.
3. Caso `not-observed-before-block`, registrar somente as categorias autorizadas do processo, foco e provedor WebView. `provider-reported` não comprova renderização saudável e `negresco-app` não prova bloqueio de `expo-print`.
4. **Não inferir causalidade cruzada entre builds**. Fases `native-*` e `native-renderer-exit-*` vêm do Debug instrumentado e não existem no APK Release imutável. Usar o Debug para formular hipóteses, não para declarar corrigido o Release.
5. Para considerar uma correção funcional: mudança de código isolada, teste de falha reproduzível antes/depois, execução real em API28 e API26, receptor e recibos auditados, QA em aparelho físico, revisão de privacidade/segurança e autorização humana. Testes positivos sem reprodução do problema continuam evidência limitada.

## Bloqueios que permanecem

- Causa da intermitência Release original ainda **não demonstrada**.
- Homologação de Android 8/9 em dispositivos físicos e revisão humana ainda **pendentes**.
- APK original de teste pode expirar antes da causa-raiz ser isolada; a perda do artefato é bloqueio de infraestrutura, não regressão PDF. Retenção adicional ou redistribuição requer decisão explícita e revisão de segurança.
- Zero operações financeiras reais, zero produção, zero OTA e zero merge em `main`.

## 05/11/2026 | Novo experimento de uso repetido sem apagar dados locais

O laboratório anterior reinicia o estado do aplicativo entre dois PDFs com `pm clear`; isso testa instalações com dados recém-limpos, mas não o comportamento quando o usuário fecha e reabre o app **sem limpar seus dados**.

Experimento adicional exclusivo da branch Draft: `guardiao_original_release_retained_state_lab.py` executa duas verificações do **mesmo APK imutável no mesmo emulador API28**, sem `pm clear` nem uninstall. Entre os ciclos, faz `am force-stop` e comprova o fim do processo por `pidof`; o runner compartilhado instala novamente **com `adb install -r`**, relança o app e recria o receptor PDF sintético de uso único. A etapa `install -r` pretende preservar os dados locais, mas **não é prova criptográfica de que todo estado foi preservado**. A verificação é do fluxo de uso repetido sob essas condições.

O recibo de cada ciclo só é aceito após chooser real, PDF recebido, semântica e limpeza aprovadas; um auditor separado reabre **somente os dois metadados**, rejeitando saída ausente/extra, symlinks e conteúdo inválido. Nenhum resultado deste experimento poderá liberar produção ou declarar que a falha histórica foi corrigida, mesmo com PASS. O teste anterior de dois ciclos com dados limpos permanece **inalterado** como controle.
