# Guardião P0: gate de estabilidade do PDF de arrecadação sintética (Android 8/9)

## Evidências reproduzíveis

- PR #116, HEAD c5933f5000cba354d71126103ef0c6645ae27f84.
- Workflow 40708437566, tentativas 1 e 2: API 26 e API 28 PASS.
- CI push 40708437536 e CI PR 40708450967: PASS.
- Primeiro FAIL da API 28: run 40703421063. O seletor Android abriu, mas a captura do recibo não foi verificada; a causa-raiz não foi isolada.
- Artefatos: recibos JSON de metadados; não arquivar PDFs, XML, screenshots, logcat, textos extraídos nem dados reais.

## Critérios de decisão

1. Não declarar correção definitiva de intermitência apenas com duas execuções verdes. Registrar a falha anterior como não reproduzida, causa desconhecida.
2. Uma regressão deve distinguir falha na localização do alvo do chooser, toque, entrega ao receptor, recibo, SHA/tamanho, semântica do texto e limpeza do cache, com mensagens fixas sem valores financeiros.
3. Manter fixture imutável e inválida de 48 dígitos, APK previamente auditado e pinado; nunca usar documento pagável.
4. Repetir em dispositivo físico Android 8/9 antes de qualquer alegação de homologação em hardware real. Registrar modelo, versão e resultado, nunca identificadores pessoais.
5. Qualquer falha adicional bloqueia avanço e exige investigação; nunca suprimir erro, afrouxar asserções ou tratar timeout como PASS.
6. Esta PR continua em draft, apenas laboratório. Não autoriza merge na main, release, OTA, uso de dados reais ou aprovação de produção.

## Estado em 28/10/2026

E2E e CI verdes no HEAD, repetição verde na API 28. Estabilidade em aparelhos físicos e causa-raiz do FAIL inicial pendentes.
