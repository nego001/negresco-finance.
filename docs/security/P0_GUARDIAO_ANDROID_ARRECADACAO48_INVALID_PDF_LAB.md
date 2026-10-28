# Guardião P0 | PDF nativo de arrecadação sintética inválida (48 dígitos)

## Objetivo

Esta etapa é empilhada sobre a PR #115. A PR #115 comprovou em Android 8/9 o PDF gerado pelo APK financeiro de teste com **47 zeros**, um boleto bancário inválido. Esta etapa amplia a cobertura para o caminho de **ARRECADAÇÃO** com **48 dígitos**, ainda usando documento matematicamente inválido e não pagável.

## Fixture e invariantes

- Entrada fixa: prefixo 8 seguido de 47 zeros. Possui 48 dígitos, mas a referência de módulo de verificação é 0, fora da allowlist aceita de 6, 7, 8, 9 no código real do Guardião. **Não representa cobrança pagável.**
- O teste Node invoca `inspectBoleto` e exige tipo ARRECADAÇÃO, `valid=false` e explicação específica de referência inválida. O HTML resultante jamais contém a linha digitável completa e mantém legitimidade inconclusiva.
- O script de emulador só aceita o fixture fixo, sem argumentos externos. Reutiliza o mesmo APK pinado pelo SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` e a navegação real por UI + compartilhamento do Android já auditados na PR #115.
- O receptor independente compila sem permissões Android e mantém a captura privada por marcador one-shot que só o runner cria com `adb run-as`. A cópia do documento é eliminada obrigatoriamente no final.
- Verifica a integridade do PDF nativo por tamanho e SHA-256, renderiza todas as páginas, extrai seu texto e exige `ARRECADAÇÃO`, 48 dígitos, 0 fontes externas consultadas, checksum inconsistente, beneficiário/emissor não identificados e advertência de legitimidade inconclusiva.
- O workflow tem permissão de leitura, matriz Android 8/API 26 e Android 9/API 28 e só publica recibo JSON de metadados por 2 dias, nunca o PDF, screenshots, XML, logcat, textos extraídos, dados reais ou arquivos do app.

## Limites

Esta etapa só pode confirmar o funcionamento para uma linha de arrecadação **inválida e sintética**. Não valida o processamento de uma arrecadação genuína, autorização de pagamento, consentimento, conteúdo empresarial externo, dispositivos físicos ou produção. A construção da PR não modifica o APK financeiro nem publica nenhuma versão.

## Gates

- [ ] Contratos Node confirmam fixture inválido e sem vazamento.
- [ ] CI Android API 26 com PDF nativo e texto correto; SHA e limpeza confirmados.
- [ ] CI Android API 28 com PDF nativo e texto correto; SHA e limpeza confirmados.
- [ ] Inspeção independente dos dois JSONs de metadados publicados.
- [ ] QA físico, assinatura e revisão humana para produção, em outra etapa.

`approvedForProduction=false`; `stableReleaseAllowed=false`. PR Draft, sem merge em `main`, release, credenciais bancárias, OTA ou distribuição.
