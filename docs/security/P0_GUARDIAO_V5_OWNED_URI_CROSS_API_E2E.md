# Negresco Finance P0 | Novo candidato Debug de ownership do PDF — Android 8 e 9

## Binário novo fixado
O workflow [#43789332636](https://github.com/nego001/negresco-finance./actions/runs/43789332636), compilado do commit [`a55cda2`](https://github.com/nego001/negresco-finance./commit/a55cda2bc2f3bc2e8b7cfffa7a7c6affb0b22c40), encerrou **SUCCESS**. O log de compilação informa SHA-256 do arquivo `app-release.apk` **`0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`** e certificado `CN=Android Debug`, apesar de compilação em modo Release. O próprio workflow conferiu ZIP e APK standalone com SHA idêntico e publicou dois artefatos apenas na área de testes do GitHub Actions. O arquivo de laboratório não contém assinatura de produção.

Novo artefato de referência:
- `negresco-finance-v313-security-preview` do run `43789332636`, ID `14192095927`, expira 30/11/2026 02:07:38 UTC
- `negresco-finance-v313-test-apk`, ID `14192150648`, expira 23/11/2026 02:07:29 UTC

**Hash antigo do candidato v4:** `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6` — NÃO é este arquivo.
**Hash histórico Release original:** `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` — CONTINUA INDISPONÍVEL, NÃO foi usado neste teste.

## Ensaio realmente executado
Este branch prepara quatro jobs em emuladores efêmeros: `api=26` e `api=28`, cada um com duas repetições de primeira exportação (matriz `api x trial=[1,2]`). Todos baixam exatamente o **novo artefato**, rejeitam SHA/certificado divergentes antes de instalar e reutilizam o runner de PDF de entrada sintética, seletor nativo, receptor independente, páginas não vazias, extração semântica, integridade e limpeza privada.

O objetivo especial é verificar que a **verificação de ownership de URI** não bloqueia o PDF legítimo produzido por `expo-print` em Android 8/9. O código atualizado no App obriga `isOwnedPrintPdfUri(uri,FileSystem.cacheDirectory)` antes de consultar disponibilidade ou abrir o chooser. O funcionamento já passou em 1.485/1.485 testes de contrato, mas **só será comprovado no APK** se os jobs acima receberem e validarem os PDFs reais. Não deduzir PASS do fato de a compilação ter sucedido.

Falha em qualquer job deve permanecer bloqueio do experimento, sem mudança automática de allowlist, apagamento de arquivos ou toques substitutos.

## Regras de interpretação
Os testes E2E validam o caminho legítimo e as propriedades da exportação em dois emuladores Android. A rejeição de URI falsa, de outros aplicativos, pastas e tentativas de travessia continua coberta por testes de contrato *simulados*, não por injeção de URI maliciosa em dispositivo. Não confundir com exploit test ou pentest completo.

Mesmo que 4/4 passem, isso **NÃO** demonstra a causa-raiz do antigo Print nativo intermitente no histórico 3/6; as versões diferem e o Release original não está disponível. Segurança: #120/#126 OPEN, PR125 DRAFT/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`, sem merge, OTA, assinatura estável, release pública, Pix ou pagamentos.
