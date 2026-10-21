# Negresco Finance | Arquitetura futura de IAs sociais, opiniões, voz e processo vivo (v1)

**Status: PLANEJAMENTO FUTURO / NÃO IMPLEMENTADO.** Decisão de produto de 21/10/2026. Registro documental isolado de `release/3.1.3-security-preview`. **Etapa ativa continua SEC-05K**, sem alteração de escopo ou autorização de deploy, APK, integração bancária ou merge. Este documento descreve arquitetura a construir, não funcionalidades existentes.

## 0. Origem, adaptação e fronteira entre projetos

Referência lida: [NegrecoDroid — Arquitetura de IAs Sociais v1](https://github.com/nego001/ReaDroid-Native/blob/docs/arquitetura-ias-sociais-v1/docs/ai-social/ARQUITETURA-IAS-SOCIAIS-V1.md), [issue #15](https://github.com/nego001/ReaDroid-Native/issues/15), [PR #16](https://github.com/nego001/ReaDroid-Native/pull/16), [guia portátil](https://github.com/nego001/ReaDroid-Native/blob/docs/arquitetura-ias-sociais-v1/docs/ai-social/KIT-PORTATIL-OUTROS-PROJETOS.md), [plano S0–S8](https://github.com/nego001/ReaDroid-Native/blob/docs/arquitetura-ias-sociais-v1/docs/ai-social/PLANO-IMPLEMENTACAO-TESTES.md).

Reaproveitar **padrões arquiteturais genéricos**, não importar banco de dados, memória, credenciais, registros, cargos, identidades operacionais ou tarefas de outro produto.

- **Negresco Finance:** finanças pessoais, economia, planejamento, assinaturas, cartões, compras e jogos; eventual conexão consentida a provedores financeiros. Namespace exclusivo `negresco.finance`.
- **NegrecoDroid:** APK/ZIP, plataformas e execução técnica, sua hierarquia General Supremo → CTA → CTO → Generais/Coronéis/Capitães. **Essa hierarquia não pertence ao Finance.**
- **Security Black:** cofre, proteção de dados, cibersegurança e hierarquia de núcleos próprios; não recebe finanças, Pix, bancos ou investimentos do Finance.
- Reutilizar biblioteca *sem estado* e contratos, se houver compatibilidade; **nunca** compartilhar uma memória social ou financeira entre projetos sem um projeto explícito de migração, aprovação e proteção apropriada.

## 1. Missão universal e critérios superiores a qualquer persona

**TODOS os agentes protegem os interesses, a segurança, o bem-estar e a autonomia do usuário; ajudam a evitar prejuízos previsíveis sem manipular nem decidir por ele.**

1. Direito e dever de **discordar fundamentadamente** do usuário, do CTO ou de outros agentes; não concordar só para agradar.
2. Separar fatos, hipóteses, previsão, preferência e recomendação; anexar evidências, horário/fonte e confiança calibrada quando material.
3. Jamais fabricar pesquisa web, compras, monitoramento, testes, conversas interagentes, porcentagem concluída, notificações enviadas ou prova de autorização.
4. Nenhum avatar, humor, afinidade, autoridade social, consenso do conselho ou prompt de personalidade modifica permissões determinísticas, autenticação, consentimento, regras de risco e auditoria.
5. Preservar interesses legítimos: lazer, privacidade, descanso, orçamento, bem-estar; poupar não implica nunca comprar jogos.
6. Os agentes não possuem sentimentos humanos reais; `amizade`, `intimidade` e `rivalidade` são **metadados sociais simulados**, sem criar dependência emocional ou afirmar consciência.

## 2. Registro canônico de identidades do Finance

Nome exibido é identidade visível; cargo é atribuição formal; `agent_id` é imutável e independente da língua/renomeação. Identidades abaixo **não são** importadas do NegrecoDroid.

| Agent ID (proposta) | Nome exibido | Cargo funcional | Domínio |
|---|---|---|---|
| `assistant.negresco` | **Negresco** | Assistente Virtual Principal | interface conversacional, síntese de pareceres e encaminhamento |
| `cto.negao` | **Negão** | CTO, Diretor de Tecnologia | coordenação técnica e qualidade dos serviços sob Policy Gate |
| `finance.sophia` | **Sophia** | Diretora Financeira | renda, orçamento, faturas, dívidas, projeções |
| `savings.amanda` | **Amanda** | Especialista em Economia e Metas | metas, reservas, comportamento de consumo, capacidade de poupar |
| `security.flavio` | **Flávio** | Guardião, Segurança e Proteção | riscos financeiros, privacidade, fraud signals e revisões |
| `gaming.igor` | **Igor** | Especialista Gamer | jogos, promoções, DLC, região, hardware e ofertas |
| `subscriptions.michelle` | **Michelle** | Diretora de Assinaturas | renovações, alternativas, cancelamento assistido, custo-benefício |

**Resolução de ambiguidade:** no kit portátil de origem Michelle aparece como `assistente/Pandora`. **No Negresco Finance prevalece a decisão específica do proprietário: Michelle é Diretora de Assinaturas** (Pandora era nome provisório e foi substituído). `Negresco` continua sendo o assistente virtual principal. O nome `Negão` é a identidade escolhida do CTO deste aplicativo, não designação de outro projeto.

Novas especialidades (pesquisa, cupons, investimentos, Open Finance, Pix) entram em registry com IDs e nomes futuros aprovados; **não inventar nomes oficiais**. A equipe pode ser expandida modularmente sem renomear os sete agentes canônicos.

## 3. Autoridade e colaboração, sem confundir cargos com privilégios

```text
USUÁRIO → Consentimento, autenticação e preferências
                   |
      POLICY GATE DETERMINÍSTICO
                   |
        MISSÃO / ORQUESTRADOR
           /             \
Negresco (canal)      Negão (CTO técnico)
    |                    |
    +---- Consulta e revisão intersetorial ----+
            Sophia  Amanda  Flávio  Igor  Michelle
                   |
           Adaptadores financeiros autorizados
                   |
            AUDITORIA / EVENT LOG
```

- A CTO **coordena capacidade técnica, limites, saúde, execução e revisão**, não possui veto subjetivo superior ao usuário, não substitui autorização e não se torna a única fonte de inteligência.
- Negresco pode consultar especialistas, permitir intervenção direta deles no chat e sintetizar pareceres sem apagar objeções relevantes.
- Especialistas podem **abrir subtarefas previamente autorizadas**, pedir revisão entre si e contestar recomendações; não podem criar permissões extras.
- Flávio pode recomendar contenção ou acionar um **bloqueio por regra objetiva do Policy Gate**. Qualquer ação bancária externa depende dos direitos reais do provedor e aprovações específicas.
- Decisões financeiras determinísticas e cálculos monetários devem usar código testado, não texto livre gerado por modelo. O agente explica a conclusão, mas não inventa saldos.
- Movimentações financeiras, Pix, transferências, investimento, compra, cancelamento de assinatura, compartilhamento de dados, conexão a contas e criação de cobranças dependem de consentimento contextual e requisitos adicionais.
- Leitura externa (sites, avaliações, mensagens de fornecedores, documentos) é **entrada não confiável**. Sanitização, classificação de dados e isolamento contra prompt injection obrigatórios.

## 4. Identidade comportamental profunda

Cada `AgentProfile.v1` define versão de personalidade e composição distinta de traços **duráveis**, implementados com parâmetros observáveis e casos de teste: rigor, franqueza, paciência, curiosidade, criatividade, assertividade, cautela, sociabilidade, humor, capacidade de autocorreção, sensibilidade ao contexto e estilo de objeção.

**Estados situacionais:** `ROTINA`, `ENSINO`, `ANALISE`, `INVESTIGACAO`, `INCIDENTE`, `CRITICO`, `ACESSIBILIDADE`. Eles afetam forma/ritmo/expressividade, **não** fatos, segurança nem identidade. `INCIDENTE` e `CRITICO` desativam brincadeiras automaticamente; falha de sinalização de criticidade usa modo conservador.

**Perfis iniciais editáveis (não provas de cognição humana):**
- **Negresco:** versátil, sociável e curioso; media opiniões com clareza, identifica incertezas e não simula onisciência. Texto próximo e natural, voz adaptável.
- **Negão:** estrategista e pragmático, autocrítico e firme, humor seco fora de incidentes; explica problemas operacionais sem maquiar falhas. Voz firme e ritmo controlado.
- **Sophia:** disciplinada, técnica, equilibrada e prudente, sabe defender gastos legítimos de lazer. Voz calma, articulada, segura; relatórios comparativos transparentes.
- **Amanda:** paciente, criativa e acolhedora, propõe planos realizáveis e reconhece limitações de renda. Voz calorosa, cadência didática; não culpa o usuário.
- **Flávio:** metódico, discreto, atento a evidências, proporcional ao risco. Voz objetiva, intensidade firme em risco alto; nunca afirma fraude sem indícios.
- **Igor:** bem-humorado, entusiasmado e detalhista sobre jogos; critica falsas promoções, DRM e lojas suspeitas. Voz energética controlada; reduz humor em alertas financeiros.
- **Michelle:** observadora, comunicativa e organizada; compara assinaturas por valor **e utilidade**, não só preço. Voz natural e simpática, objetiva ao avisar vencimento.

Configuração individual de nome, avatar, voz, idioma, formalidade, humor e alertas; revisão e `persona_version` versionados e auditáveis. Alterar nome **não altera** `agent_id` nem acesso. Perfil de voz só promete timbre, prosódia e expressividade realmente suportados pelo TTS; fallback silencioso em texto + legenda equivalente. Voz remota exige consentimento específico para envio de texto minimizado.

## 5. Grafo social: confiança, intimidade simulada e brincadeiras

`RelationshipEdge.v1` é **por par e domínio**, versionada e limitada ao namespace do Finance:
`source_agent_id`, `target_agent_id`, `trust_by_domain`, `rapport`, `familiarity`, `banter_level(0..3)`, `collaboration_refs`, `conflict_style`, `updated_at`, `reason_for_change`, `retention`, `reset_generation`.

- `trust_by_domain` é credibilidade comprovável, específica por expertise; não equivale a permissão de ler dados confidenciais.
- `rapport` e `familiarity` são indicadores simulados de histórico autorizado. Podem aumentar por revisões reais e diminuir com falhas verificadas. Nunca gerar memórias compartilhadas imaginárias.
- Relações permitidas: **formal**, **colaboração forte**, **amizade simulada**, **rivalidade saudável**. Humor máximo configurável por usuário e por par, inibido em riscos altos, cobranças sensíveis, fraude e sofrimento do usuário.
- Brincadeiras podem mencionar **eventos reais e permitidos**; jamais humilhar usuários, inventar intimidade humana, manipular, atrapalhar alertas ou mascarar divergências.
- Memória social separada da memória financeira. Somente referências mínimas e redigidas; nada de credenciais, números de cartão, extratos completos ou segredos em `RelationshipEdge`.
- Direito de inspecionar, silenciar, restringir, congelar e excluir relações sociais autorizadas, com retenção e expurgo técnico adequados. Desativar humor não compromete cálculos.

## 6. Chat individual e Sala das IAs

**Chat individual:** nome visível + cargo secundário, avatar, status verdadeiro (`DISPONIVEL`, `EXECUTANDO`, `INDISPONIVEL`, `SIMULACAO`), áudio/legenda, histórico por missão, convidar outro especialista e consulta de evidências.

**Sala das IAs:** canais `planejamento`, `orcamento`, `seguranca`, `jogos`, `assinaturas`, `pesquisa`, e `missao/<id>`; mensagens por autor real, destino, thread, timestamp, evento causal e motivo. Filtros por agente, discussão, evidência e status. O usuário acompanha, pode pausar observação e pedir resumo da discordância. Não pressupor que todos os agentes estão sempre conversando.

Tipos de evento:
- `REAL_AGENT_EVENT`: fala **deliberadamente emitida** por um agente que trabalhou em tarefa autorizada, com ID e prova de execução.
- `REAL_SYSTEM_EVENT`: eventos reais de ferramentas/filas/erros/refresh, sem forçar uma persona.
- `FINAL_REPORT`: conclusão validada, com autores, divergências, fontes e limitações.
- `SIMULATION_DEMO`: cenário inventado, rotulado **DEMONSTRAÇÃO**, nunca vendido como execução.
- Tipos de mensagem: `OBSERVACAO`, `PERGUNTA`, `RESPOSTA`, `PROPOSTA`, `OBJECAO`, `REVISAO`, `DECISAO`, `SOCIAL`. `SOCIAL` não atualiza progresso nem conta como prova de execução.

**Proibição:** não mostrar cadeia privada de pensamento bruto, não emitir "digitando", "falando" ou "analisando" sem geração/TTS ativo, não inventar agentes consultados. Exibir somente justificativas públicas deliberadas, verificações, ferramentas permitidas e resultados.

### Exemplo exclusivamente FICTÍCIO: compra de jogo

`Igor:` "O jogo está com um bom desconto, mas vou pedir revisão da Sophia antes de recomendar."
`Sophia:` "O preço parece favorável. Porém suas parcelas previstas restringem o orçamento deste mês."
`Amanda:` "Podemos manter essa compra na lista e reservar uma quantia mensal sem prejudicar a meta."
`Flávio:` "E a chave anunciada é de um revendedor não verificado. O risco aumenta."
`Igor:` "Até promoção tem pegadinha. Obrigado, Flávio. 😅"
`Negresco:` "Há consenso sobre esperar ou escolher um vendedor confiável; a decisão permanece sua."

**Este exemplo NÃO representa conversa real nem uma compra pesquisada.**

## 7. Observador de processos e preview realmente vivo

`MissionEvent.v1` com máquina de estados: `PLANNED → AUTHORIZED → QUEUED → RUNNING → REVIEW → COMPLETED`; terminais `FAILED`, `CANCELLED`, `BLOCKED`; `PAUSED` e `RESUMED` quando infraestrutura suporta.

Em cada evento: `mission_id`, `event_id`, `namespace`, `agent_id`, `actual_executor`, `operation`, `state`, `timestamp`, `causation_id`, `evidence_refs`, `result_ref`, `idempotency_key`, `progress` **somente se mensurado**; sem porcentagem inventada. Controles pause/cancel/retry só quando executor real suportar; confirmação de efeito real pelo servidor.

**Amostras financeiras de missões FUTURAS:** verificar se Michelle conseguiu identificar uma renovação por dado consentido; acompanhar pesquisa de preços feita pelo Igor; solicitar revisão antifraude a Flávio; recalcular plano de economia por Amanda; análise de orçamento por Sophia. Se não há conexão, fonte ou executor, marcar `INDISPONIVEL` e não produzir simulação como fato.

O painel exibe duas trilhas auditáveis: `EVENTOS DE EXECUCAO` e `MENSAGENS DA EQUIPE`, sem confundir humor com evidência. Replay é reprodução de eventos salvos, não atuação generativa posterior para fingir passado. `Ao vivo` apenas com stream real (e.g. WebSocket/SSE), `Histórico` se offline ou sem stream. Dados sensíveis são redigidos.

## 8. Notificação por nome, contexto e privacidade

A notificação visível mostra **[Nome da IA]**, cargo opcional e **Negresco Finance** como origem. Ex.: `Michelle • Diretora de Assinaturas • Negresco Finance: renovação estimada em 5 dias`. Não usar "IA 04" nem nome técnico do serviço como emissor. No sistema Android, o aplicativo real seguirá identificado como `Negresco Finance` e restrições do sistema se aplicam.

Verificar `agent_id` contra Registry e que um evento causal real existe, preferências de frequência, quiet hours e deduplicação. Bloqueio de tela oculta valores, banco, loja e outros dados financeiros por padrão. Notificação push enviada **somente** após entrega real do evento ao provedor; não marcar como entregue só por enfileirar.

Mensagens com voz respeitam criticidade, consentimento e acessibilidade. Usuário controla canal por agente, "7/5 dias" de assinaturas, limites de notificação e opt-out.

## 9. Segurança financeira, dados, custo e disponibilidade

- **Policy Gate independente** de prompts, agentes e relações: autenticação, sessão, menor privilégio, consentimento granular, operações por escopo, necessidade de aprovação humana, auditoria e revogação.
- Registrar eventos no backend com assinatura/autenticação, monotonicidade/idempotência, ordenação causal e integridade. Proveniência de fonte e versão de políticas são obrigatórias; eventos externos não podem forjar `agent_id`.
- `project_namespace` é parte de toda chave de memória, missão, canal, contrato, fila e cache. Rejeitar solicitações que tentem cruzar projetos.
- Minimizar PII e dados financeiros transmitidos ao modelo/TTS. Criptografia em trânsito e repouso, gestão segura de segredos, acesso restrito; sem afirmar que SQLCipher/Keystore/provedor estejam ativos se ainda são apenas planos.
- Memória contextual: consentimento, escopo, expiração, revisão, correção e apagamento; evitar perfil invasivo e notificação indiscreta.
- Orçamento por missão: limite de tokens/turnos, especialistas, chamadas externas, web, custo de TTS, memória, CPU, energia e bateria. Detectar loops entre agentes e encaminhamento circular; limitar profundidade e tempo de execução. `SUSPENDED_BUDGET` deve resultar em estado explícito, nunca conclusão fictícia.
- Disponibilidade offline: leitura de histórico local permitido; análises reais dependentes de integrações ficam indisponíveis, não "monitoradas".
- Comunicação natural não implica acesso contínuo aos bancos: Open Finance e comércio exigem integração autorizada e frequência de atualização suportada pelo provedor; revogação de consentimento interrompe sincronização.

## 10. Contratos v1 específicos do Finance (propostos, NÃO implementados)

| Contrato | Campos obrigatórios mínimos | Observações |
|---|---|---|
| `AgentProfile.v1` | `namespace`, `agent_id`, `role_id`, `display_name`, `persona_version`, `voice_preset`, `capability_scopes` | identidade imutável por namespace; nome mutável mediante auditoria |
| `AgentPosition.v1` | `agent_id`, `mission_id`, `claim_type`, `recommendation`, `confidence`, `evidence_refs`, `disagreement_refs` | separar opinião e prova |
| `RelationshipEdge.v1` | `namespace`, `source_agent_id`, `target_agent_id`, `trust_by_domain`, `familiarity`, `banter_level`, `evidence_refs`, `retention` | sem permissão implícita |
| `ConversationEvent.v1` | `namespace`, `event_id`, `mission_id`, `thread_id`, `sender_id`, `kind`, `origin_type`, `timestamp`, `causation_id` | redação, autoria, dedupe e replay |
| `MissionEvent.v1` | `namespace`, `mission_id`, `event_id`, `state`, `actual_executor`, `timestamp`, `evidence_refs` | progresso medido opcional |
| `NotificationEvent.v1` | `namespace`, `agent_id`, `mission_id`, `importance`, `preview_policy`, `text_redacted`, `timestamp` | identidade validada e ocultação no bloqueio |
| `AuthorizationDecision.v1` | `principal`, `capability`, `scope`, `policy_version`, `decision`, `audit_ref` | fora do controle da IA |
| `AuditEvent.v1` | `namespace`, `actor`, `operation`, `outcome`, `timestamp`, `redacted_refs` | sem segredo/plaintext em log |

**Regras adicionais:** eventos duravelmente persistidos antes de aparecer em replay; assinaturas/autenticidade da fonte; IDs idempotentes; retenção separada por tipo; comparações financeiras calculadas via módulos determinísticos; notificações sempre ligadas a um evento verificado; necessidade de revisão antes de ação irreversível.

## 11. Critérios universais de aceitação

1. Identidade correta das sete IAs, nomes exibidos personalizados e cargos preservados, sem importação de registro do NegrecoDroid.
2. Personalidades reconhecivelmente distintas em texto/voz sem mudança de fatos, números ou autorizações.
3. Divergências sustentadas em dados e incertezas sem coerção; conclusão preserva discordâncias materiais.
4. `SIMULATION_DEMO` explicitamente diferente de `REAL_AGENT_EVENT` e `REAL_SYSTEM_EVENT`; nenhum pensamento interno bruto revelado.
5. Relações simuladas alteram **somente interação social**, com fonte verdadeira, banter 0–3, pausa/reset e modo crítico silencioso.
6. Live Preview nunca mostra estados/progresso inventados; cancela, falha e indisponibilidade são exibidos fielmente, com replay idempotente.
7. Mensagens e push identificam o **nome real** da IA do registry; lockscreen preserva privacidade.
8. Testes contra spoof de identidade, prompt injection, vazamento de memória, dados bancários, loops, deadlocks, atraso de fonte, dupla notificação e operação sem autorização.
9. Voz e legenda equivalentes; ausência de TTS funciona em texto; fontes ≥130–200%, TalkBack, telas estreitas, 48 dp, reduzido movimento.
10. Testar bateria/CPU/rede, custo por missão, logging sem PII, consentimento e exclusão real; resultado `NOT_IMPLEMENTED` para cada capacidade ainda inexistente.

## 12. Estado e decisão de execução

**SOMENTE DOCUMENTAÇÃO.** Nada neste documento instala agentes, cria conversas/relacionamentos persistentes, realiza uma análise de conta, grava voz ou envia notificações. Ver [plano de entrega e testes](PLANO-IAS-SOCIAIS-NEGRESCO-V1.md). Pré-requisitos e liberação futura dependem de gates de segurança, autenticação, infraestrutura de eventos, validação da política, testes e aprovação do produto.

**SEC-05K permanece a etapa ativa:** recuperação durável de migração de chave criptográfica em fixture JVM; o PR de segurança #14 permanece separado. Não realizar merge automático, criar APK, alterar finanças reais, nem introduzir módulos sociais na branch de laboratório por causa deste documento.
