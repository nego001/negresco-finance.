# Guardião P0 | Resultado de seis primeiras exportações — custódia offline

Este pacote guarda apenas **categorias não sensíveis** dos seis jobs Android9 de [workflow #43785823881](https://github.com/nego001/negresco-finance./actions/runs/43785823881), concluído **SUCCESS**, e [CI #43785823825](https://github.com/nego001/negresco-finance./actions/runs/43785823825), concluída **SUCCESS** (**1.467/1.467 contratos**). A auditoria original de [workflow #40808040078](https://github.com/nego001/negresco-finance./actions/runs/40808040078) continua independente.

## Observações verificadas nos logs

| Primeira impressão | Job ID | PDF recebido/renderizado | Semântica e cache | Chooser observado |
|---|---:|---|---|---|
| Trial 1 | 133033094942 | PASS | PASS | 5–15 s |
| Trial 2 | 133033094756 | PASS | PASS | 5–15 s |
| Trial 3 | 133033094698 | PASS | PASS | 5–15 s |
| Trial 4 | 133033094434 | PASS | PASS | abaixo de 5 s |
| Trial 5 | 133033094788 | PASS | PASS | abaixo de 5 s |
| Trial 6 | 133033094728 | PASS | PASS | abaixo de 5 s |

Cada job usou emulador limpo API28, o mesmo APK **experimental** do build #43772274643 SHA `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`, assinatura **Android Debug**, um único PDF sintético inválido, receptor independente com todas as páginas renderizadas e conteúdo/limpeza conferidos. Todas as seis execuções exibiram os quatro marcadores PASS requeridos e nenhum BLOCK.

**Importante:** as faixas medem o tempo até o seletor nativo ser **observado**, não o tempo isolado de `Print.printToFileAsync`.

A planilha de categorias `P0_GUARDIAO_V4_API28_SIX_COLD_EVIDENCE.json` é um registro curado dessas observações. O script offline verifica a **consistência da cópia curada**, sem consultar o GitHub e sem atestar criptograficamente a autenticidade dos logs remotos:

```sh
python3 tooling/android/guardiao_v4_api28_six_cold_evidence.py docs/security/P0_GUARDIAO_V4_API28_SIX_COLD_EVIDENCE.json
```

Suas saídas finais preservam `approvedForProduction=false` e `stableReleaseAllowed=false`. As provas continuam disponíveis nos links de workflow/job do GitHub e foram anotadas na [issue #120](https://github.com/nego001/negresco-finance./issues/120).

## Evidência histórica que NÃO foi modificada

O APK histórico imutável SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` continua indisponível. As seis tentativas históricas no Android9 de outubro/novembro forneceram três PDFs confirmados e três não confirmados; duas falhas posteriores de gate foram ausência de metadados API26, não impressão comprovadamente falha. Estas séries NÃO formam experimento A/B e não autorizam afirmar que v4 corrigiu o travamento.


**Sobre o Android 8 no histórico:** os reruns 1–6 do workflow original preservaram o mesmo job API26 iniciado em 29/10. O resultado SUCCESS ali representa uma execução validada, **não seis novos emuladores Android 8 independentes**. Essa diferença importa na comparação de estabilidade entre APIs.

**Próxima necessidade real:** recuperar binário histórico pelo hash exato e executar testes físicos sob revisão humana; se impossível, manter o defeito histórico não resolvido.

**P0:** #120/#126 OPEN; PR #125 DRAFT/unmerged; sem merge, OTA, assinatura estável, aprovação, dados financeiros reais ou pagamento.
