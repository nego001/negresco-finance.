# Guardião P0 | Contratos semânticos do HTML do relatório (LAB)

## Contexto

Após a PR #112 provar **somente** a renderização de três páginas sintéticas em Android 8/9, esta etapa testa uma fronteira diferente: o **conteúdo HTML produzido pelo código real** `apps/mobile/guardiao/report.ts` com entradas fictícias, antes de qualquer impressão nativa. Os testes importam as funções existentes `createLocalReport` e `renderReportHtml`, sem mocks que substituam o gerador.

## Escopo executável

- Arquivo `tests/guardiao-report-html-semantic-contract.test.mjs`, incluído automaticamente pelo `npm test` da CI.
- Linha digitável de 47 dígitos **deliberadamente inválida** (zeros sintéticos) não deve aparecer no HTML, nem mesmo quando a explicação de entrada a contém.
- Checksum consistente significa apenas consistência matemática; nunca autentica uma cobrança e não pode alterar `legitimacy:'unknown'` nem afirmar emissor ou beneficiário.
- Casos de cadastro `found`, `not-found` e `unavailable` devem contar respostas externas corretamente, manter a origem BrasilAPI como independente e evitar conclusões indevidas.
- CNPJ fictício completo e URL de origem jamais entram no HTML renderizado. Nome empresarial, situação, data, mensagem, tipo de documento e data local passam por escape de HTML; campos empresariais extensos têm limites de tamanho.
- O HTML final precisa manter aviso de conferência no banco e não conter scripts ativos, formulários, recursos remotos ou função de pagamento.

## Limites semânticos

**Não se testa nesta PR:** PDF binário, presença visual dos campos depois de `expo-print`, metadados do PDF, acessibilidade, renderização em telas físicas, consistência entre recibo e conteúdo nativo, ou integridade criptográfica de arquivo real. Nenhum Android APK financeiro é gerado ou alterado aqui. Os dados são somente sintéticos e não representam cobranças pagáveis.

**Resultado PASS não prova boleto válido, banco conectado, defesa contra toda injeção, compatibilidade visual ou proteção bancária de produção.** A cobertura de PDF real de uma página segue na #110/#111; a renderização multipágina sintética, na #112.

## Portões de aprovação

- [ ] `npm test` no commit atual da PR.
- [ ] CI push e pull_request revisadas.
- [ ] Revisão dos riscos semânticos, fontes externas e mensagens na UI.
- [ ] Prova da correspondência entre HTML e PDF gerado pelo APK financeiro real, com entradas sintéticas, em emuladores e QA físico.
- [ ] Homologação de assinatura/distribuição e revisão de segurança humana.

`approvedForProduction=false`, `stableReleaseAllowed=false`. Branch e PR Draft isoladas; nada na `main`, sem merge, release, OTA, senha, CPF/CNPJ real, conta bancária ou pagamento.
