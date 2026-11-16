# Guardião P0 #120 | reconstrução dos seis históricos Android 9 do APK original

Este documento separa **a execução do app**, **a recepção do PDF** e **a verificação dos metadados publicados no GitHub**. É uma auditoria de fatos já registrados — **não** altera app, não recupera APK e não resolve a impressão nativa.

## Identidade realmente usada no laboratório histórico

GitHub Actions [run #40808040078](https://github.com/nego001/negresco-finance./actions/runs/40808040078), HEAD `767ceb17a6c7b0c188bb039062edb16a4840067e`, seis tentativas, workflow `.github/workflows/guardiao-android-collection48-pdf-text-lab.yml`.

O próprio workflow fixa o APK SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`, baixa os bytes do run histórico `40617164086` e valida por `sha256sum --check --strict`. O APK original não está mais disponível nos artefatos atuais.

| Tentativa | API28 Android 9 | Job API28 | Gate de par API26/API28 | Evidência classificada |
|---|---|---:|---|---|
| 1 (29/10) | FAIL | 123231576126 | SKIPPED | PDF original **não verificado** |
| 2 (29/10) | SUCCESS | 123235275913 | SUCCESS — **2 artefatos** | PDF e par de recibos verificados |
| 3 (31/10) | FAIL | 124604520513 | SKIPPED | PDF original **não verificado** |
| 4 (02/11) | SUCCESS | 125537592012 | FAILURE — **só API28** | PDF verificado; falta recibo API26 no gate |
| 5 (02/11) | FAIL | 125544912704 | SKIPPED | PDF original **não verificado** |
| 6 (02/11) | SUCCESS | 125591880603 | FAILURE — **só API28** | PDF verificado; falta recibo API26 no gate |

Confirmação: [jobs por tentativa 1–6](https://api.github.com/repos/nego001/negresco-finance./actions/runs/40808040078/attempts/2/jobs), logs específicos e logs dos jobs de par:
- Tentativa **2** gate job `123236714745`: `Found 2 artifact(s)`, baixou API26 e API28, `PASS (LAB): both published synthetic Android receipts checked after upload`.
- Tentativa **4** gate job `125540178974`: `Found 1 artifact(s)`, baixou **só API28**, rejeitou ausência do API26.
- Tentativa **6** gate job `125594024444`: `Found 1 artifact(s)`, baixou **só API28**, rejeitou ausência do API26.
- O workflow fixa `retention-days: 2`; o comprovante API26 originou-se em 29/10, enquanto o gate de 02/11 rodou dias depois. A ausência **é consistente com expiração**, mas os logs não provam exclusivamente a causa da indisponibilidade do artefato. **Não atribuir essa falha ao motor de impressão.**

### O que estes dados dizem sobre o bug real

Foram **três execuções API28 com PDF e recibo verificados** e **três execuções API28 com PDF não verificado**. Nas tentativas 1 e 3, os logs categorizam o app como ainda vivo, foreground `negresco-app`, provedor WebView informado, enquanto o chooser não foi confirmado. Isso **não prova** que a chamada nativa `Print.printToFileAsync` é a causa; ausência de chooser também pode esconder problema de foco/compartilhamento. A tentativa 5 também falhou, mas não devemos atribuir-lhe exatamente o mesmo estágio sem evidência específica.

O job API26 apareceu como SUCCESS em todas as tentativas porque sua execução de 29/10 foi preservada/reutilizada pelo GitHub; **isso NÃO representa seis novas execuções API26**. Os nomes de jobs em reruns podem ser materializados de novo, mas o início API26 permanece `2026-10-29T02:43:32Z`.

Há duas classes de falhas, e elas não devem ser misturadas:
1. Falha real/intermitente de verificação PDF em API28: #120 continua OPEN, sem causa-raiz.
2. Falha de custódia de artefatos em reruns tardios: gate de par teve só um dos dois recibos, embora o PDF API28 tenha sido validado. O gate agiu corretamente ao bloquear, mas o resultado global de run vermelho **não equivale** a falha do PDF.

## Reprodução da classificação apenas com metadados seguros

```sh
python3 tooling/android/guardiao_original_release_attempts_audit.py docs/security/P0_GUARDIAO_ORIGINAL_RELEASE_SIX_ATTEMPTS_AUDIT.json
```

Este verificador sem rede é propositalmente **estreito**: valida esquema exato, IDs de jobs históricos e sequências coerentes de resultados. Usa somente classes `success/failure/skipped` e a presença dos metadados API26/API28. Não tem conexão com GitHub; **não atesta autenticidade dos logs**, só impede que o resumo curado seja transformado em aprovação falsa. Toda adulteração/inconsistência em campos obrigatórios resulta em `BLOCK`.

## Próximo gate que realmente falta

1. Recuperar uma cópia verificada pelo **hash histórico exato** — sem transformar APK refeito em original.
2. Reproduzir o travamento em Android 8/9 com a mesma entrada sintética, registrando códigos fechados para fase antes/depois do await nativo de impressão, estado de WebView/foreground e chooser (sem texto privado).
3. Provar resultado e descarte com receptor independente; validar em dispositivo físico e com revisão humana.

**Estado invariável:** #120/#126 OPEN; PR #125 DRAFT/unmerged; `approvedForProduction=false`; `stableReleaseAllowed=false`. Nenhum merge, OTA, Release pública, assinatura estável, dado financeiro real, Pix ou pagamento.
