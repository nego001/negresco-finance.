# Guardião P0 | Texto do PDF gerado pelo APK Android imutável (LAB)

## Diferença em relação à PR #114

A PR #114 validou o HTML do Guardião quando convertido em PDF pelo Chrome Linux. Isso **não demonstra** o texto do PDF gerado pelo Android. Este laboratório usa o **APK financeiro de teste previamente auditado**, fixado pelo SHA-256 29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a (artefato da CI 40617164086, originalmente PR #106), sem recompilação, release ou mudanças no app financeiro.

No emulador Android 8 (API 26) e Android 9 (API 28), a automação já existente abre o Guardião, insere **exatamente 47 dígitos zero** (entrada sintética intencionalmente inválida), observa o resultado da análise, aciona o botão real de gerar e compartilhar PDF e seleciona pelo chooser do Android o receptor independente de laboratório.

## Nova validação semântica

O receptor é um APK **separado, descartável, sem permissões Android, com debuggable=true**. Por padrão, ele verifica o PDF com PdfRenderer e destrói sua cópia privada antes de emitir o recibo, como nas PRs #110-112. **Somente no novo CI de teste**, a automação usa adb run-as para criar um marcador de uso único na pasta privada do receptor. Quando o receptor recebe o PDF, consome e apaga o marcador, valida todas as páginas e cria uma cópia privada temporária cujo tamanho corresponde ao fluxo recebido. Nenhum Intent externo habilita essa captura; a opção não existe no APK financeiro.

O runner do GitHub, ainda no ambiente descartável, usa adb exec-out + run-as para ler **exclusivamente essa cópia fictícia** na memória do processo. Antes de confiar no conteúdo, compara SHA-256 e tamanho do arquivo com os metadados do receptor e confere os limites PDF. Em diretório temporário Linux com permissão restrita, executa pdfinfo e pdftotext offline para cada página e exige as advertências: checksum inválido, 0 consultas externas, emissor/beneficiário não identificados, autenticidade inconclusiva, registro bancário não consultado e nenhuma operação de pagamento efetuada. Nega sucesso se detectar afirmações de autenticidade ou a linha digitável completa.

O runner **apaga a cópia privada no Android em finally**, verifica sua ausência e também elimina o arquivo temporário Linux automaticamente. Se faltar recibo, arquivo, ferramenta, texto, hash, campo obrigatório ou limpeza, o teste é bloqueado. O workflow só pode publicar por 2 dias um JSON de metadados e flags; **nunca publica PDF, HTML, screenshot, dump de UI, texto extraído, path de documentos, logcat ou dados de pagamento.**

## Limites da prova

PASS validaria o conteúdo textualmente extraível de **um PDF real originado por um APK Android específico**, produzido com uma **única entrada inválida e totalmente sintética** em dois emuladores. Não prova assinatura de release de produção, autenticidade de boleto, funcionamento com dados reais, ausência de vazamentos em todo o app, acessibilidade, layout perfeito, fluxos de contas e pagamentos, compatibilidade em todos os dispositivos ou QA físico.

Para produção permanecem obrigatórios QA físico, análise de outros cenários sintéticos válidos e de arrecadação, revisão de assinatura/release e validação de segurança humana. O receptor de laboratório nunca deve ser distribuído com o app.

## Gates

- [ ] Contratos Node e compilação do receptor novo.
- [ ] API 26: PDF real do APK pinado, URI concedida, páginas renderizadas, extração de texto, semântica e limpeza privada.
- [ ] API 28: as mesmas verificações.
- [ ] Artefatos JSON de ambas as APIs inspecionados independentemente.
- [ ] QA físico, assinatura/distribuição e revisão humana (fora do escopo).

approvedForProduction=false. stableReleaseAllowed=false. Sem merge em main, sem OTA, sem APK financeiro novo e sem publicação.
