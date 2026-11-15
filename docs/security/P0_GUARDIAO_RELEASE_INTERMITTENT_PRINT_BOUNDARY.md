# P0 | Evidência comparativa do Release original e fronteira da impressão nativa

**Status: BLOQUEADO PARA PRODUÇÃO.** Este documento registra somente uma análise de
evidências já existentes. Não reproduz a falha no binário original, não corrige
o renderer e não autoriza uma publicação.

## Evidência do mesmo APK Release no Android 9

O workflow [#42155990322](https://github.com/nego001/negresco-finance./actions/runs/42155990322),
de 06/11/2026, terminou **FAILURE**. O instalador de laboratório confirmou o
APK original previamente fixado por SHA-256
`29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`
em cada cenário. Os quatro jobs independentes registraram:

| Sistema | Job GitHub | Resultado do job | Fronteira observada |
|---|---:|---|---|
| Android 8 / API26, controle | `127690549637` | SUCCESS | PDF real chegou ao receptor, com verificação semântica e limpeza |
| Android 9 / API28, amostra A | `127690550134` | SUCCESS | PDF real chegou ao receptor, com verificação semântica e limpeza |
| Android 9 / API28, amostra B | `127690550373` | **FAILURE** | Após um toque delimitado de exportação, chooser nunca observado; `ui-loading-app-foreground` |
| Android 9 / API28, amostra C | `127690550231` | SUCCESS | PDF real chegou ao receptor, com verificação semântica e limpeza |

Na amostra B, o aplicativo continuou vivo e em primeiro plano e o sistema
relatou provedor de WebView. Esses fatos **não** demonstram que a WebView
esteja saudável. Sem recibo, não há comprovação de PDF gerado ou de
compartilhamento. A amostra B nunca deve ser tratada como sucesso.

Os resultados A/C mostram que falhar não é inevitável em API28, sob
circunstâncias parecidas. A comparação **não** determina a causa da
intermitência nem demonstra influência de timing, scheduler, cache, WebView,
React Native, `expo-print` ou `expo-sharing`.

## Tempos medidos nos quatro jobs originais

Os timestamps UTC permitem calcular do toque comprovado ao primeiro chooser,
ou ao bloqueio, sem emitir qualquer conteúdo de PDF ou dado financeiro:

| Amostra | Intervalo observado | Evidência |
|---|---:|---|
| Android 8 / API26 | 1,16 s | Chooser e recibo válido |
| Android 9 / API28 A | 1,30 s | Chooser e recibo válido |
| Android 9 / API28 B | 65,00 s | Timeout sem chooser e sem recibo |
| Android 9 / API28 C | 6,55 s | Chooser e recibo válido |

O tempo de 65 segundos representa a janela de observação até o bloqueio,
não a duração conhecida da execução interna do renderer.

O arquivo tooling/android/guardiao_original_release_phase_differential.py
produz apenas categorias fixas e durações delimitadas a partir de logs locais.
Ele não atesta origem de logs, identidade de APK, causa-raiz nem produção.
## O que o código permite concluir

No caminho do app, `App.tsx` chama
`exportPdfWithLifecycleGuard` em `apps/mobile/guardiao/pdfExport.ts`.
A sequência tem as seguintes fronteiras em ordem:

1. **`print`:** o app aguarda `Print.printToFileAsync`, ainda sem URI.
2. **`invalid-uri`:** só após `print` resolver há uma checagem da URI local.
3. **`availability`:** o app aguarda a disponibilidade do compartilhamento.
4. **`share`:** só depois é iniciada a chamada ao chooser nativo.

Se a promessa de `print` nunca resolver nem rejeitar, não haverá retorno do
exportador, atualização para resultado final nem execução do `finally`
responsável por liberar o bloqueio de exportação. **Esse é um mecanismo
plausível para a tela permanecer pendente, não a prova de que ocorreu
exatamente na amostra B.** Uma espera em `availability` ou `share` também
pode produzir ausência de conclusão sem diagnóstico nativo suficiente.

O bloqueio `pdfSingleFlight` é intencional e impede impressão nativa
sobreposta. Um timeout JavaScript que libere a proteção enquanto o renderer
nativo pode ainda estar executando **não** corrige a operação inacabada.
Timeout não deve produzir `shared`, disparar automaticamente uma segunda
exportação ou apagar PDF que um chooser nativo já possa estar lendo.

## Experimento isolado: aviso informativo durante impressão pendente

Na branch experimental `lab/p01-guardiao-pdf-pending-ux-warning-v1`,
o aplicativo mostra, após 30 segundos com a operação nativa ainda ocupada,
um aviso de que **o arquivo PDF ainda não foi confirmado** e que a segunda
exportação permanece bloqueada. O aviso é apenas de interface e também pode
ser acessado por leitores de tela. O tempo de 30 segundos **não** classifica
a exportação como falha, não emite recibo e não aciona compartilhamento.

O relógio informativo é cancelado quando a tentativa realmente termina; ele
**não** destrava `pdfSingleFlight`, não resolve/rejeita a promessa de
`Print.printToFileAsync()`, não faz nova impressão, não apaga arquivos
temporários e não realiza operações financeiras. O cenário de travamento
permanece bloqueado e precisa de correção nativa comprovada. Esta alteração
não foi integrada à `main` nem ao APK Release imutável.

## Lacuna real de evidência e plano de retomada

O artifact do workflow histórico [#40617164086](https://github.com/nego001/negresco-finance./actions/runs/40617164086)
não está mais disponível na listagem. Os 23 APKs publicados nas Releases
consultadas não apresentam o digest esperado. Por isso, nenhuma cópia atual
do binário imutável foi comprovada para nova reprodução.

**Já há um caminho de recuperação controlado no repositório:**
`tooling/android/guardiao_recover_original_apk_from_device.py`, que
consulta somente o código de um `com.negresco.finance` instalado em um
dispositivo autorizado pelo proprietário, e só preserva uma cópia quando
`guardiao_verify_original_apk_offline.py` confirma o SHA-256 fixado. O
procedimento precisa de acesso ao dispositivo; não foi executado nesta
investigação. Não coletar dados privados, logs brutos, PDFs ou screenshots.

**Próxima reprodução, somente depois da recuperação byte a byte:**
mesmo APK, entrada sintética, API26 de controle e múltiplas amostras API28
independentes; observar por categorias fixas qual fronteira falhou
(`print`, `invalid-uri`, `availability`, `share`) e a sequência do
renderer nativo, sem aumentar o tempo como substituto de comprovação.
Exigir recibo independente de PDF + limpeza e dispositivo físico depois da
correção. O sucesso dos APKs **Debug** API26 e API28 é evidência separada:
não atesta correção do Release.

## Gates que não podem ser removidos

- Issue #120 **OPEN**; PR #125 **DRAFT**; nenhuma aprovação de produção.
- `approvedForProduction=false`; `stableReleaseAllowed=false`.
- Sem merge na `main`, OTA, Release novo, pagamento real ou dados financeiros.
- A classificação de falha não deve incluir informações de cliente, boletos,
  IDs de processo, exceções nativas, arquivos privados ou HTML/PDF.
