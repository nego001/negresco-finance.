# Guardião de Boletos | Especificação funcional e de segurança

Status: **planejado / não implementado**. Este documento registra requisitos aprovados para o Negresco Finance. Não representa integração bancária, consulta online ou análise de fraude já operacional.

## Objetivo

Investigar automaticamente, quando houver acesso autorizado e dados suficientes, novas cobranças de boletos e explicar: **quem está cobrando, quem receberá, qual instituição registrou, qual compra/contrato/serviço originou a cobrança, quais evidências existem e qual o risco de fraude**. Não confundir banco que enviou uma notificação com banco emissor, beneficiário ou origem da compra.

## Fontes de entrada

- Boletos em PDF/imagem e linha digitável fornecidos voluntariamente.
- Novas cobranças e dados de boletos expostos por APIs bancárias autorizadas, quando efetivamente disponíveis.
- DDA somente quando a integração específica fornecer acesso autorizado. **Open Finance não garante acesso universal a boletos ou DDA**.
- Notificações Android somente com consentimento específico, com aviso de que podem conter apenas resumo e não dados completos; evitar coleta excessiva.
- Histórico financeiro, comprovantes, e-mails/documentos e contratos apenas com autorização granular e escopo limitado.

## Tela de investigação completa

1. **Identificação:** nome e CNPJ/CPF do emissor quando comprovados; beneficiário nominal e final; banco registrador/emissor; banco que notificou; valor, vencimento, linha digitável mascarada e identificador interno; status e horário da coleta.
2. **Por que recebi esta cobrança?** Possível compra, assinatura, contrato ou serviço; cruzamento com compras e pagamentos autorizados; distinguir *correspondência confirmada*, *hipótese com evidências* e *origem não identificada*. Nunca inventar compra ou vínculo.
3. **Investigação na internet:** Receita Federal e registros públicos oficiais para identificação cadastral; Reclame Aqui e outras plataformas de reclamações, notícias, alertas de fraude, reputação e histórico de denúncias. Registrar URL, data/hora, trecho relevante, fonte e limites de confiabilidade. Reclamações não são prova isolada de fraude. Não atribuir reclamações de homônimos a um CNPJ sem confirmação.
4. **Validação técnica:** consistência da linha digitável e dígitos verificadores, campos, datas, valor, divergência entre beneficiário informado e exibido no banco; quando disponível, validar dados registrados por fonte bancária autorizada. Dígitos válidos não garantem legitimidade.
5. **Resultado explicado:** indícios de fraude, sem indícios relevantes identificados ou inconclusivo; sinais observados, evidências verificáveis, dados ausentes, ações de confirmação e aviso de não pagar até esclarecer divergências relevantes. Nunca emitir selo de "100% verdadeiro".
6. **Histórico e notificações:** monitorar novos eventos somente em fontes conectadas; detectar alterações de dados e repetição de cobranças; avisos deduplicados e configuráveis; histórico auditável de verificações, com opção de desativar.

## Exemplo de referência (não analisado)

Notificação do aplicativo Santander: "Boleto disponível" emitido por "MAIS MOBI SERVI". A notificação **não demonstra** que Santander emitiu o boleto nem que a cobrança seja fraude. Sem acesso ao boleto, beneficiário, CNPJ e dados bancários, a origem da compra e a legitimidade permanecem **não confirmadas**. Nunca inferir dívida apenas da existência de DDA/notificação.

## Arquitetura e limites de autorização

- **Guardião:** coleta mínima, validação determinística, correlação de evidências e avaliação de risco.
- **CTO:** orquestra consultas permitidas a agentes especializados; decisão de IA não substitui autorização do usuário nem controles determinísticos.
- **Negresco:** apresenta explicações, fontes, incertezas e próximos passos, com personalidade personalizável sem mudar as regras de segurança.
- Conectores externos executados por backend seguro com autenticação forte, autorização explícita, segregação de permissões, criptografia em trânsito e repouso, gerenciamento seguro de chaves, auditoria sem dados sensíveis desnecessários, minimização e retenção configurável.
- Nunca enviar CPF, linha digitável completa, documentos, extratos ou outros dados sensíveis a buscadores públicos. Pesquisas públicas devem usar dados empresariais estritamente necessários, preferencialmente CNPJ/nome verificados.
- Nunca pagar, agendar, cancelar, bloquear ou contestar cobrança automaticamente; qualquer ação financeira exige fluxo próprio, consentimento explícito e verificações independentes.
- Proteger contra falsificação de resultados, conteúdo malicioso encontrado em páginas (prompt injection), URLs não confiáveis, homônimos e confusão entre emissor, beneficiário e notificante.
- Em falhas de consulta, exibir **fonte indisponível / análise inconclusiva**. Não afirmar pesquisa online quando não ocorreu.

## Entrega em fases (lançamentos agrupados)

1. **Interface e contratos:** tela detalhada, estados vazios e de risco, evidências e fontes, testes de interface, dados simulados identificados; sem alegar investigação real.
2. **Validação local:** parser seguro de código de barras/linha digitável, checagens determinísticas, testes com amostras sintéticas, sem afirmar autenticidade.
3. **Backend de investigação:** conectores oficiais e pesquisa pública verificável, consentimento, segurança, auditoria, limites e métricas de qualidade.
4. **Integração bancária e monitoramento:** provedores compatíveis, eventos/consultas autorizadas, deduplicação, alertas e testes de privacidade/segurança.

## Critérios de aceite

- Exibe separadamente *banco notificante*, *emissor/registrador*, *beneficiário* e *origem comercial*, inclusive quando desconhecidos.
- Toda afirmação factual sobre empresa, compra ou denúncia tem fonte rastreável ou fica explicitamente não confirmada.
- Mostra por que um boleto foi sinalizado e como verificar com canais oficiais.
- Nunca interpreta boleto tecnicamente válido como prova de segurança.
- Sem permissão ou integração, não monitora banco nem afirma ter monitorado.
- Nenhum dado financeiro é enviado a serviços públicos de pesquisa sem proteção e autorização adequadas.
- O usuário controla monitoramento, notificações e acesso aos dados.
