# Negresco Finance | Replay pareado do APK Release imutável (laboratório)

Escopo: comparar API26 e API28 em **uma única execução** de GitHub Actions, usando exatamente o APK Release original `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. Não recompila o app, não assina Release, não faz OTA, não utiliza boleto ou pagamento real.

## Evidência que motivou o laboratório

O [run original #40808040078](https://github.com/nego001/negresco-finance./actions/runs/40808040078) apresentou resultados mistos: API28 ficou em `Gerando PDF local...` na tentativa 3; na tentativa 4 o **job API28 passou** com PDF real e semântica verificada, mas o gate de dois recibos falhou porque reexecução parcial publicou só o recibo de API28; na tentativa 5, API28 **falhou antes de solicitar PDF**, depois de observar o rótulo do input. Portanto, tentativa 5 não mede a etapa de PDF.

O testador antigo `guardiao_pdf_ui_emulator_smoke.py` faz `lookup("Linha digitável do boleto")` e pode recuperar primeiro um **TextView de rótulo** em vez do **EditText**; a rotina de input compara `populated["text"]` exatamente com a fixture e pode rejeitar um campo corretamente preenchido caso o lookup retorne o rótulo. **Possibilidade comprovada pelo código, mas não causa individual comprovada da tentativa 5**, que não imprime exceção por política de privacidade.

## Escopo técnico

- Novo workflow `guardiao-original-release-paired-replay-lab.yml` é isolado na branch Draft `lab/p01-guardiao-debug-metro-phase-v1`, com matriz [26,28] **na mesma tentativa** e gate pós-upload que exige os dois recibos. Não modifica o workflow original nem `main`.
- Runner `guardiao_original_release_input_replay_lab.py` reutiliza as provas originais de SHA/apk, receiver, UI, semântica e limpeza, porém seleciona o **único** EditText cujo `content-desc` corresponda ao rótulo esperado; após injeção, exige o texto sintético inteiro e exato. Não reenvia, altera ou mascara a fixture. Na ausência/ambiguidade/valor diferente, interrompe. Categorias impressas são fixas, sem valores, XML, PDF ou logcat bruto.
- A decisão de aprovação permanece **FAIL-CLOSED**. O resultado de um job API28 só vale para a geração do PDF quando a etapa de input for confirmada. O resultado do workflow pareado só vale quando ambos os recibos do mesmo run passarem independentemente.

A conclusão de produção permanece bloqueada pela [issue P0 #120](https://github.com/nego001/negresco-finance./issues/120). A instrumentação Debug da PR #125 passou duas vezes, mas isso não revela onde o Release original trava. `approvedForProduction=false`, `stableReleaseAllowed=false`.
