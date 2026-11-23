# Guardião P0 | Bloqueio de vazamento do fixture formatado no texto de PDF (LAB)

## Contexto
Continuação **empilhada na PR #116**. Os PDFs nativos do APK financeiro imutável
passaram nos Android 8/9, mas a verificação por substring não rejeitava de
forma explícita o fixture caso o extrator de texto intercalasse separadores
entre dígitos. Esta etapa reduz **apenas essa lacuna específica**.

## Mudanças
- `tooling/android/guardiao_pdf_synthetic_privacy_gate.py` é uma rotina
  offline sem rede, recebendo somente texto já extraído do PDF **fictício**.
- Após NFKC, percorre o texto com buffer de até 47 dígitos; espaços,
  quebras de linha, pontuação e separadores invisíveis permitidos não
  escondem a sequência fixa de 47 zeros. Isso cobre também o fixture
  de arrecadação inválida `8` + 47 zeros.
- Letras interrompem a sequência para não juntar campos independentes.
- `guardiao_android_export_pdf_text_emulator_smoke.py` passa a bloquear
  relatórios que contenham a sequência formatada **antes** do recibo PASS.
  Mantém as validações anteriores de hash, páginas, avisos, conteúdo proibido
  e limpeza obrigatória.
- Dez testes adversariais Python (positivos e negativos), contrato Node de
  integração e workflow de laboratório isolado, branch-only e somente leitura.

## Limites e bloqueios
- Não testa documentos pagáveis, dados reais, CNPJ, serviços bancários ou
  fluxos financeiros legítimos.
- A detecção aborda somente as duas entradas sintéticas fixas. Não é um
  detector universal de dados pessoais nem demonstra ausência absoluta
  de vazamentos em um relatório arbitrário.
- Os testes Python com textos de laboratório não substituem emulador
  Android ou QA físico; CI geral e revisão humana continuam obrigatórias.
- Não altera `apps/mobile`, o APK SHA-pinado, `main`, assinatura,
  pagamentos, OTA, lançamento público ou armazenamento de clientes.
- Logs da ferramenta não incluem o texto analisado nem documento PDF.
- `approvedForProduction=false`; `stableReleaseAllowed=false`.

## Verificações
- [x] 10 testes unitários locais, apenas sobre textos sintéticos.
- [ ] Workflow GitHub Actions Python no HEAD da branch.
- [ ] Contratos Node/CI geral no HEAD.
- [ ] Auditoria dos artefatos, se houver: a etapa não publica documentos.
- [ ] QA em aparelhos físicos e revisão humana (fora do escopo).
