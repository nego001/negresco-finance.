# Guardião P0 | Texto extraído de PDFs fictícios (LAB)

## Objetivo
Esta etapa sucede a PR #113. Executa as funções reais createLocalReport e renderReportHtml com dados estritamente sintéticos, imprime o HTML via Chrome headless no runner e inspeciona o PDF com pdfinfo e pdftotext. Ausência de navegador, falha na geração ou extração semântica impede PASS.

Os quatro cenários são: checksum sintético inconsistente; checksum marcado consistente mas sem prova de legitimidade; cadastro empresarial fictício localizado; e fonte de cadastro indisponível.

## Controles
- Boleto e CNPJ não pagáveis: todos os identificadores são fictícios e não há rede bancária, contas, CPF ou dados de usuários.
- HTML, PDF e perfis temporários do navegador existem apenas em diretório descartável. Os PDFs e textos extraídos NÃO são anexados nem exibidos em logs.
- O gerador recusa recursos remotos, tags ativas e a presença dos identificadores fictícios completos no HTML.
- O verificador exige cabeçalho e trailer PDF, contagem de páginas, limites de tamanho e texto esperado extraído da versão impressa.
- Todos os casos exigem aviso de legitimidade inconclusiva, beneficiário e emissor não identificados e ausência de autorização de pagamento.
- Artefato opcional da CI: somente JSON com status, tamanho, páginas, SHA-256 dos PDFs sintéticos e indicadores de bloqueio de produção, com retenção de 2 dias. PDF, HTML, bitmap, screenshots e texto extraído são proibidos.
- Workflow limitado à branch de laboratório, permissões GitHub somente de leitura, sem APK financeiro, secrets, OTA ou publicação.

## Limitações
**Chrome headless no Linux não é expo-print no Android.** A prova mede texto extraído de PDFs gerados por um motor de referência, a partir do HTML real do Guardião. NÃO demonstra que o APK financeiro produz exatamente o mesmo PDF, que o compartilhamento funciona, ou que quebra de página, fontes e legibilidade são idênticas no Android. Tampouco é conferência bancária de autenticidade.

A etapa futura precisa comparar o PDF efetivamente produzido pelo APK financeiro com entradas sintéticas, além de QA físico, assinatura/distribuição e revisão humana.

## Gates
- [ ] CI do HEAD com contratos Node aprovados.
- [ ] Quatro casos de renderização/extrator PDF aprovados no runner.
- [ ] Artefato JSON baixado e conferido independentemente.
- [ ] PDF real produzido pelo APK Android analisado semanticamente (fora do escopo atual).
- [ ] QA físico, revisão humana, publicação de produção.

approvedForProduction=false; stableReleaseAllowed=false. Nenhum merge em main, release, alteração de app financeiro ou credencial.

## Prova de referência verificada (28/10/2026)
A primeira execução completa do workflow de PDF, run 40697231005, passou no HEAD 4caf8ceeba988e5ada95fd9b9531a3b66fe8b421. Artefato ZIP 12820191017 foi baixado e aberto independentemente, contendo somente guardiao-report-pdf-text-receipt.json, com campos e limites auditados. Nenhum PDF ou HTML foi incluído.

| Caso sintético | Páginas PDF da prova inicial | Resultado |
| --- | ---: | --- |
| invalid | 1 | PASS |
| consistent | 1 | PASS |
| registry | 2 | PASS |
| unavailable | 1 | PASS |

Todos os recibos possuem SHA-256 hexadecimal, tamanho plausível, documentRetained=false e os dois indicadores de liberação de produção como false. O caso de cadastro gerou duas páginas no Chrome. Por isso, na revisão posterior foi acrescentada extração independente de texto de **cada página**, com falha para página vazia/inextraível; o resultado da CI do novo HEAD precisa ser conferido antes de marcar este gate concluído. A prova de referência NÃO utiliza o motor PDF do Expo Android.
