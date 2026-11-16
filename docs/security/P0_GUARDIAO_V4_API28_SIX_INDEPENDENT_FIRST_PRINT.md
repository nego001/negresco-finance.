# P0 Guardião | 6 inicializações limpas independentes do PDF v4 no Android 9

## Motivação
A revisão histórica [run #40808040078](https://github.com/nego001/negresco-finance./actions/runs/40808040078) identificou **6 tentativas API28** do APK Release histórico imutável: três PDFs sintéticos realmente recebidos/validados e três tentativas com PDF não confirmado; o workflow global pode falhar por ausência de artefato de recibo API26 em reruns tardios. Evidência histórica separada em [commit `4550b05`](https://github.com/nego001/negresco-finance./commit/4550b057c69a4cc88c1eca92b859dfd6146e0fad).

O candidato v4 **não é o mesmo binário**. Já passou em 3 emuladores independentes API28, cada um gerando quatro PDFs no mesmo PID ([run #43780147915](https://github.com/nego001/negresco-finance./actions/runs/43780147915)), e em um API26 com quatro PDFs seguidos ([run #43782143406](https://github.com/nego001/negresco-finance./actions/runs/43782143406)).

## Novo ensaio: 6 *cold-first* sem reiniciar o mesmo emulador
- Matriz `trial: [1, 2, 3, 4, 5, 6]` com `fail-fast: false`; são **seis jobs independentes**, cada qual em **emulador API28 efêmero e limpo**, nunca seis chamadas em sequência no mesmo processo.
- Mesmos bytes do candidato fixado no artefato [#43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643), SHA-256 `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`, assinatura `CN=Android Debug` (Release-mode **experimental**, não produção).
- Executa **sem modificações** o runner existente `guardiao_candidate_release_root_v4_api28_pdf_lab.py`: única entrada 48-dígitos sintética inválida; apenas um toque PDF; chooser efetivo; receptor independente; PDF com todas as páginas renderizadas, checagem de texto, ausência de dados proibidos; arquivo/recibo/caches excluídos.
- PDF que não chega ao chooser/receiver e timeout **são falha**, jamais sucesso. Cada job precisa terminar SUCCESS e produzir os dois `PASS (LAB)` finais do runner. O workflow **só pode ser considerado aprovado com 6/6 SUCCESS**.
- Sem reconstrução de APK, troca de SHA, screenshot, XML, logcat bruto, dados financeiros, impressão de PDF/URI/HTML nem upload de artefatos, merge, OTA ou aprovação de produção.
- A expiração informada do artefato de laboratório é 29/11/2026. A ausência dos bytes no futuro deve causar **BLOCK no download**, não uma compilação substituta.

## Interpretação limitada

Não calcular equivalência causal entre **3/6 históricos** e **6 testes novos**; os binários diferem e os períodos/ambientes não foram controlados por pareamento. Mesmo 6/6 positivos **não demonstrariam correção do erro do APK antigo**, cujo SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` segue indisponível. Este teste acrescenta confiança sobre o *primeiro PDF após instalar/iniciar o candidato*.

**Bloqueio invariável**: #120/#126 OPEN; PR #125 DRAFT/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. Falta original idêntico, avaliação física e revisão humana antes de qualquer produção.
