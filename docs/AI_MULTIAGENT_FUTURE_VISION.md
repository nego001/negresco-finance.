# Negresco Finance | Visão futura das inteligências multiagentes

**Estado: PLANEJAMENTO FUTURO, NÃO IMPLEMENTADO.** Documento de produto e arquitetura aspiracional. Não constitui serviço ativo, funcionalidade disponível, implementação aprovada para produção ou mudança de prioridade. A etapa em execução é **SEC-05K**, laboratório de segurança. A aplicação atual não conecta contas bancárias reais, não possui monitoramento autônomo por IA e não executa compras, Pix, investimentos ou cancelamentos.

## Identidade de apresentação e cargos

O **nome** identifica quem fala e aparece no chat, avatar, mensagens e título das notificações. O **cargo** define funções, responsabilidades técnicas e permissões. Identificadores internos estáveis não mudam com o nome exibido.

| Nome | Cargo e atribuição |
| --- | --- |
| **Negresco** | Assistente Virtual Principal: diálogo, coordenação de conversa e apresentação de recomendações |
| **Negão** | CTO, Diretor de Tecnologia: arquitetura, coordenação técnica e avaliação de operações |
| **Sophia** | Diretora Financeira: gastos, renda, orçamento, dívidas e projeções |
| **Amanda** | Especialista em Economia e Metas: poupança, metas, reservas e escolhas sustentáveis |
| **Flávio** | Guardião: prevenção de fraudes, privacidade e riscos |
| **Igor** | Especialista Gamer: compras de jogos, DLCs, edições, plataforma e confiabilidade |
| **Michelle** | Diretora de Assinaturas: recorrências, renovações e comparação de planos |

Novas especialidades poderão receber identidades próprias. Nome, cargo, perfil de voz e avatar serão editáveis sob política de permissões, preservando logs e identificadores estáveis.

## Missão compartilhada e discordância responsável

**Toda inteligência existe para proteger os interesses e bem-estar do usuário, minimizar prejuízos e preservar sua autonomia.** Nenhuma deve concordar para agradar, mascarar riscos, presumir autorização financeira ou priorizar comissões de parceiros em detrimento do usuário.

- Cada especialista pode produzir **avaliações próprias** com evidências e grau de confiança, e discordar de qualquer outra, incluindo CTO e Negresco.
- Discordâncias significativas são examinadas por especialidade, evidência, contexto e impacto. Hierarquia organiza responsabilidade, **não** determina que o argumento de maior cargo esteja correto.
- Alertas devem ser proporcionais ao risco, sem paternalismo, spam, alarmismo ou manipulação. O usuário decide compras legítimas após receber informação.
- Restrições rígidas de autenticação, consentimento, política de acesso e autorização de ações críticas não podem ser contornadas por nenhuma personalidade ou maioria de agentes.
- Opinião de um modelo não é fato provado: exigir fontes, detectar dados insuficientes e distinguir previsão, hipótese, opinião e confirmação.

## Personalidades complexas e expressões coerentes

Cada agente terá configuração própria de **traços estáveis** (formalidade, assertividade, curiosidade, humor, empatia comportamental, cautela, iniciativa, tolerância à incerteza), **contexto transitório** (urgência e severidade do risco), **limites profissionais**, **maneira de discordar**, **preferências aprendidas com consentimento** e **expressão vocal** (voz/locução, ritmo, pausas, entonação e intensidade, conforme suporte do provedor).

Perfis iniciais, revisáveis:
- **Negão:** estrategista, exigente, transparente sobre falhas, pragmático e direto; humor seco fora de incidentes.
- **Sophia:** disciplinada, equilibrada, rigorosa com números, prudente sem proibir lazer.
- **Amanda:** paciente, criativa e motivadora, capaz de ajustar metas sem culpa.
- **Flávio:** vigilante, metódico, proporcional e objetivo, sem transformar suspeita em certeza.
- **Igor:** entusiasmado, técnico e descontraído, mas crítico com falsas promoções.
- **Michelle:** comunicativa, organizada e criteriosa quanto a benefícios, renovações e ofertas.
- **Negresco:** versátil, curioso, sociável e honesto quanto às limitações dos especialistas.

Os modelos **não têm emoções humanas reais**. Personalidade modula a forma da comunicação, nunca modifica fatos, consentimento, protocolos de segurança, finanças ou cargo. Memória deve ser seletiva, revogável, auditável e isolada por autorização.

## Módulos futuros e casos de uso

### Savings Intelligence | Economia orientada ao comportamento
Com dados consentidos, estimar capacidade de poupança por salário, rendimento variável, faturas, despesas fixas e **padrão de consumo** (por exemplo, um ou dois jogos mensais), distinguir gasto eventual/recorrente, calcular contribuição necessária para metas e períodos, sugerir cenários conservador/equilibrado/acelerado, considerar reserva de emergência, incerteza de renda, juros e inflação. Recalcular sem exigir austeridade irreal.

### Shopping Intelligence | Produtos, preços e cupons
Lista de desejos selecionada pelo usuário, monitoramento de histórico de preço, metas individuais, cupons com regras reais, comparação de preço final, frete, cashback e impostos, previsão com intervalo de incerteza, fraude e confiabilidade de **loja e vendedor** separadamente, segurança de aplicativos e notificação quando encontrar oferta relevante. Não declarar preço histórico sem fonte verificável.

### Gaming Intelligence | Jogos
Vigiar jogos selecionados, bundles, DLCs, edições e plataformas, alertas de descontos e jogos gratuitos (separar resgate gratuito, teste gratuito e acesso via assinatura), região, DRM, legitimidade da chave, compatibilidade com hardware informado e biblioteca opcional consentida. Igor consulta Sophia/Amanda e Flávio antes de recomendar ofertas de risco.

### Subscription Intelligence | Assinaturas
Detectar **possíveis** cobranças recorrentes em dados autorizados, confirmar periodicidade e data com o usuário ou fornecedor, alertar **7 ou 5 dias antes** da renovação (ou preferência configurável), acompanhar aumento de preço, trial, assinaturas pouco usadas e alternativas por benefícios/custo. Uso do serviço só quando integrado legitimamente ou informado. Michelle compara os planos; não cancela sem autorização.

### Transações e segurança
Com conexão **futura e consentida** a provedores autorizados, sincronizar eventos de bancos (com latência e limitações conhecidas), categorizar compras, detectar sinais de anomalia e encaminhar ao Flávio e à Sophia. Serviço externo seguro de agendamento e notificações push permite atividades com o app fechado, sem prometer vigilância instantânea 24/7. Revogação de consentimento corta o fluxo; limitar retenção, custos e exposição de dados a provedores de IA.

## Arquitetura e ordem de implantação

1. Permanecer na **SEC-05K** e demais gates de segurança, sem incorporar esses agentes ao APK atual.
2. Definir contratos, IDs e escopos, autorização determinística, isolamento de memória, evidência, auditoria e tratamento de prompt injection em páginas/lojas externas.
3. Desenvolver simuladores offline com dados sintéticos e avaliação comparativa de agentes; medir precisão de preços, alertas falsos, qualidade da discordância e custo por tarefa.
4. Quando a base e os controles estiverem aprovados, implementar apresentação com nomes/cargos, texto, notificações e voz, apoiada por componentes de TTS com limites explicitados.
5. Só depois integrar, gradualmente, provedores externos permitidos e monitoramento consentido, com botão de pausa, limites de alertas e custos, opt-out, aprovação obrigatória antes de compras/pagamentos/investimentos.
6. Testes adversariais de vazamento entre agentes, conselhos contraditórios, fraude, stale pricing, dados ausentes e falhas de fontes. Nenhum agente deve autoatribuir permissão superior.

**Não misturar escopos:** Negresco Finance contém finanças e recursos de compra/economia; Security Black é um projeto independente de cibersegurança.
