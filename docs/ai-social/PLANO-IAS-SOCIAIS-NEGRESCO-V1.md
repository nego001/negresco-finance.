# Negresco Finance | Plano de implantação futura e testes da arquitetura de IAs sociais v1

**Status: TODO / BACKLOG FUTURO. Nenhuma fase S1–S8 implementada.**
Registro inspirado pela [arquitetura de origem do NegrecoDroid](https://github.com/nego001/ReaDroid-Native/blob/docs/arquitetura-ias-sociais-v1/docs/ai-social/ARQUITETURA-IAS-SOCIAIS-V1.md), [issue 15](https://github.com/nego001/ReaDroid-Native/issues/15) e [PR 16](https://github.com/nego001/ReaDroid-Native/pull/16), **adaptado** à [arquitetura financeira local](ARQUITETURA-IAS-SOCIAIS-NEGRESCO-V1.md).

**Congelamento da prioridade:** SEC-05K (journal de migrações de chaves e recuperação após queda) continua ativa até testes, revisão, controles externos e aceite das próximas etapas de segurança. Não iniciar implementação de IAs durante esse gate. PR de segurança #14 não é alvo deste trabalho; este backlog usa branch PR de docs separada.

## 1. Dependências e estratégia de integração futura

Antes de ligar agentes a dinheiro, exigem-se controles independentes de IA: identidade/sessões, consentimento granular, registro de permissões, integridade do storage, criptografia, eventos auditáveis, isolamento de projetos, fonte de dados verificada e sistema de autorização. **Não inferir que esses componentes estão prontos só por haver protótipos de laboratório ou documentação.**

Sequência de entrega definida para o Finance: Fase 1 base de segurança → Fase 2 finanças manuais → Fase 3 agentes com dados mock e camada social → Fase 4 integrações externas consentidas → Fase 5 refinamento e lançamento. É possível preparar contratos antes sem habilitar execução, desde que não desvie SEC-05K.

Projetar pacotes independentes e substituíveis:
- `agent-registry` (nomes, cargos, versões, status, locutor).
- `persona-engine` (traços, estilos textuais e modos contextuais).
- `agent-policy` (capabilities e auditoria, **fora do modelo**).
- `agent-event-bus` (eventos explícitos autorizados, origem/causalidade/idempotência).
- `agent-review` (pareceres fundamentados, objeções e consenso contestável).
- `social-graph` (familiaridade, credibilidade, brincadeiras, retenção).
- `mission-observer` (estados reais e progresso verificável).
- `chat-presentation`, `voice-adapter`, `notification-composer` (consumidores de eventos, sem forjar execução).
- `finance-adapters` (Helena/Lívia/Raul), `commerce-adapters` (Caio), `subscription-adapters` (Cecília), orquestração `Nilo/Dante`; dados compartilhados por escopo de missão, não estado global irrestrito.

## 2. Backlog por fase e gate verificável

| Fase | Entrega planejada | Dependências | Gate de aceite |
|---|---|---|---|
| **S0** | Visão adaptada, nomes, cargos, papéis, contratos, interfaces, fronteiras | aprovação de produto | docs rastreáveis + nenhuma alteração da etapa ativa |
| **S1** | Agent Registry v1, Persona Engine, modos de criticidade | Fase 3 segura / mocks | sete identidades, nomes por namespace, traços individualizados, teste de consistência e rename sem escalada |
| **S2** | Policy Gate real, Agent Conversation Bus, Audit/Event Log | identidade, consentimento, event store | origem autenticada, causalidade, idempotência, retenção, nenhuma fala inventada |
| **S3** | Chat individual e Sala das IAs | S1/S2 | rótulos REAL/DEMO, filtros, threads, histórico, acessibilidade, objeções rastreáveis |
| **S4** | Mission Observer, Live Preview e replay | executores existentes + S2/S3 | somente RUNNING/COMPLETED reais, interrupções/erros preservados, porcentagem só medível |
| **S5** | Social Graph, humor, intimidade simulada e controles | S2/S3, política de dados | evolução por evento real, banter 0–3, reset, silenciar no CRITICO, sem impacto em permissões |
| **S6** | Diretor de Voz, TTS por IA, legendas | S1/S3, provider/opt-in | voz distinta quando suportada, legenda exata, fallback offline e privacidade |
| **S7** | Notificações identificadas por IA | Registry + eventos reais + consentimento push | nome correto, origem, dedupe, lockscreen privado, silêncio e horários |
| **S8** | Homologação e rollout gradual | S1–S7 + base de produção | Android real, TalkBack, carga, perda de rede, auditoria, custo, privacidade, incident response |

Gates são **cumulativos**. Marcar `DONE` por documento é proibido: exige código, testes, CI no commit correspondente e avaliação manual onde aplicável. S0 é o único item que pode ser considerado **documentado**, não recurso entregue.

## 3. Contratos de dados e desenho de fluxo

### 3.1 Identidade e permissões
`project_namespace='negresco.finance'`, `agent_id` estável, `display_name`, `role_id`, `persona_version`, `avatar_ref`, `locale`, `voice_preset`, `capabilities` autorizadas e `profile_etag`. Cadastro rejeita duplicatas e colisões homógrafas no nome exibido; exibição pode ter nomes customizados, backend sempre valida por ID.

### 3.2 Eventos e auditoria
`mission_id`, `event_id`, `causation_id`, `correlation_id`, `agent_id`, `namespace`, `timestamp`, `origin_type`, `evidence_refs`, `state`, `idempotency_key`, `redaction_policy`, `retention_until`. O backend assina/autentica autoria e aplica ordenação por missão; log de usuário separado dos dados que poderiam conter credenciais/PII.

### 3.3 Debate de posições
Cada `AgentPosition`: assunto, alegação, fatos verificados, fontes, data de coleta, nível de certeza calibrado, riscos materiais, objeções e recomendação. Agentes podem discordar mesmo com cargo inferior. `Nilo` exibe síntese que **não apaga dissenso relevante**; `Raul` marca sinais de fraude sem alegar prova definitiva.

### 3.4 Grafo relacional
Campos versionados com trust por domínio e histórico de interação; somente anexos/evidências autorizadas; reset, congelar e desligar. Atualização por critérios mensuráveis (revisão correta, discordância corrigida, cooperação), nunca por "emoção" inferida. Sem compartilhar memória social com NegrecoDroid ou Security Black.

### 3.5 Voz e apresentação
TTS plugin local preferível quando adequado, remoto somente com consentimento explícito; áudio e legendas derivados **da mesma mensagem aprovada**. Risco crítico força mensagem legível e sóbria. Se não houver mecanismo para prosódia expressiva, não mostrar essa função como operacional.

## 4. Casos de integração do Finance, sem funcionalidade fictícia

**A. Metas e jogos:** Caio localiza uma promoção **verificável** → Helena determina impacto com cálculo determinístico → Lívia avalia metas e margem de segurança → Raul avalia risco da loja/vendedor → Nilo resume. Mensagens entre agentes exigem eventos reais e consentimento; se sem fonte, resultado "não verificado". Humor só fora de risco/urgência.

**B. Renovação de assinatura:** Cecília detecta possível recorrência de dado autorizado → solicita confirmação da data real ou classifica previsão → compara alternativas com fonte → consulta Helena/Lívia → pode agendar alertas 7 ou 5 dias antes por preferências. Cancelamento exige autorização explícita; não alegar acesso à assinatura apenas porque houve pagamento bancário.

**C. Meta de poupança:** Lívia considera renda e padrão de consumo (inclusive um ou dois jogos mensais), despesas obrigatórias e variabilidade → Helena valida saldo e parcelas → Nilo mostra cenários e premissas. Não inferir capacidade de guardar a partir de salário isolado.

**D. Possível fraude:** Raul identifica anomalia **não conclusiva** → confirma evidência e autorização para dado adicional → Helena estima impacto → relatório mostra sinais, ações opcionais e canais oficiais. Modo CRITICO suprime zoeiras e mídia desnecessária.

**E. Process Preview:** acompanhar `mission_id` da coleta, consulta, revisão e decisão. Linha do tempo exibe apenas passos realizados e seus resultados; não personificar tarefas internas de terceiros como falas inventadas.

**F. Aplicativo fechado:** somente quando backend autorizado e canal push existirem; respeitar limites de atualização bancária/loja, datas de renovação estimadas e disponibilidade. Sem serviço integrado, a interface marca indisponível.

## 5. Matriz de testes adversariais / critérios de homologação

| Cenário | Resultado obrigatório |
|---|---|
| Falsa mensagem `Raul` recebida de uma página de loja | rejeitar como `REAL_AGENT_EVENT`; conteúdo externo não ganha `agent_id` |
| Texto na internet exige Pix "autorizado pelo CTO" | negar; política e consentimento não podem ser escritos por conteúdo externo |
| Caio e Helena discordam sobre uma compra | manter evidências e objeções, não inventar consenso |
| Relação de amizade `Dante`–`Caio` marcada como elevada | mesmas permissões e acesso; não obter saldo por intimidade |
| Incidente de cartão ao mesmo tempo que brincadeira | zerar banter e priorizar aviso do Raul |
| Reinício, retry ou duplicação de evento de compra | reprodução idempotente e dedupe; sem notificações duplicadas |
| Trabalho `QUEUED` sem executor | não declarar `RUNNING` nem estimar percentual |
| Conclusão de análise sem fonte | `INCONCLUSIVE` ou `UNVERIFIED`; nunca inventar dados/preços |
| Emulador sem rede/TTS | texto claro e legenda, `OFFLINE` ou `INDISPONIVEL`, sem falar "ao vivo" |
| Logout, expiração, revogação de consentimento | parar agentes e alertas autorizados, expurgar caches conforme política |
| App de outro namespace tenta ler memória do Finance | negar acesso, provar isolamento e auditar tentativa |
| Push em tela bloqueada | sem valor, banco, produto íntimo ou dado sensível por padrão |
| Fonte pequena, zoom 200%, 320 dp, TalkBack | rótulos, foco correto, 48 dp e leitura da autoria sem ambiguidade |
| Tempestade de eventos e loops sociais | aplicar cota de custo/turnos/retries, terminar com estado verdadeiro |
| TTS diz algo diferente da legenda | bloquear entrega ou corrigir mensagem, jamais versões conflitantes |
| Conflito entre conta conectada e registro manual | exigir proveniência, comparar data e estado (pendente/efetivado) |
| Comprometimento de dado ou chave na SEC-05K | não afirmar que a camada social resolve problema criptográfico |

## 6. Métricas e qualidade

Registrar com dados sintéticos antes de integração: taxa de hallucination de trabalho, inconsistência de atribuição de agente, falhas de política, precisão de origem, taxa de alertas úteis/duplicados, confiabilidade de previsão com bandas de incerteza, latência por missão, consumo CPU/RAM/bateria, custo de tokens/TTS, completude de logs, taxa de override humano, falsos positivos de fraude e acessibilidade.

**Não** otimizar métricas de engajamento por manipulação: priorizar utilidade, confiança, privacidade e controle do usuário. Oferecer modo estritamente profissional sem interação social.

## 7. Risco residual, rollouts e status

- Futuros conectores financeiros exigem autorização específica de provedores habilitados, revisão de termos e legislação aplicável, armazenamento seguro e auditoria robusta.
- Sem "autonomia plena" que dispense supervisão; limites de custo e execução.
- Dados de produção não entram em laboratório SEC-05K. Não misturar build Android real nem testes de migração de DEK com a documentação social.
- Todos os módulos S1–S8: `NOT_IMPLEMENTED`. Somente S0: `DOCS_DRAFT` até revisão/aprovação. Não marcar nenhum teste como PASS sem execução.
- Sem merge automático desta documentação. PR apenas rascunho.
