# Negresco Finance | Visão de produto e ecossistema inteligente V1

> **Documento de visão, não relatório de funcionalidades entregues.** Registrado em 24/10/2026 a partir da visão do idealizador, preservando a atual Fase 1 de 5. Os requisitos aqui são metas arquiteturais e de experiência sujeitas a validação, consentimento, orçamento, normas, testes e homologação. Nenhum item autoriza operações bancárias reais.

## 1. Proposta de valor e princípios inegociáveis

**Missão:** ser um centro financeiro pessoal acessível, elegante, profundamente protegido e capaz de acompanhar a evolução do usuário durante anos. O Negresco Finance não deve apenas exibir saldos: deve aprender padrões, explicar escolhas, antecipar necessidades legítimas, trabalhar em equipe e deixar a decisão final nas mãos da pessoa.

**Visão de longo prazo:** combinar a facilidade de conversar com um assistente avançado, a experiência de interface de um produto excepcional e padrões de engenharia de segurança comparáveis aos exigidos em serviços financeiros. **Isso é uma ambição de qualidade, não uma alegação de certificação bancária ou de segurança absoluta.**

Princípios:
1. **Segurança por arquitetura e teste, não por promessa.** Segurança forte precede qualquer dado real.
2. **Usuário no controle.** A pessoa decide quais contas conecta, o que cada IA vê e o que pode mudar. Revoga consentimentos e corrige conclusões.
3. **Simplicidade radical na apresentação; complexidade isolada por dentro.** É possível ser poderoso sem confundir quem nunca usou um gestor financeiro.
4. **Aprendizado contínuo, nunca um rótulo permanente.** O perfil é probabilístico, versionado, reversível e se adapta a eventos novos.
5. **IAs cooperativas, com fronteiras.** Compartilham apenas dados mínimos para tarefas autorizadas; nenhum agente recebe acesso irrestrito.
6. **Crescimento responsável.** Bancos, modelos, conectores e automações entram mediante gates independentes; nenhuma CI ou IA pode habilitar dinheiro real sozinha.
7. **Recuperação sem armadilhas.** Criar múltiplos caminhos seguros, acessíveis e auditáveis para quem perde um fator; esclarecer os casos matematicamente irrecuperáveis.

## 2. Jornada de um novo usuário

### 2.1 Primeiro acesso e pré-configuração guiada

Onboarding curto, opcional e progressivo. Primeiro o aplicativo oferece:
- Perfil de uso **escolhido pela pessoa**: essencial, completo ou personalizado; jamais presumir renda, saúde ou identidade sensível.
- Objetivos: orçamento, sair das dívidas, poupança, metas, investimentos, assinaturas ou simplesmente entender os gastos.
- Preferência de apresentação: interface simplificada, densidade de informações, modo OLED/claro, contraste, tamanho de texto, idiomas e acessibilidade.
- Conversa/voz: ativar ou não microfone, estilo de explicações, nível de proatividade, notificações e memória pessoal.
- Privacidade: processamento local sempre que possível, controle de envio para modelos remotos, duração da retenção e exportação/exclusão.
- Segurança e recuperação: criar credencial de recuperação e cadastrar pelo menos mais uma via de proteção, sem impedir exploração de funcionalidades demonstrativas.

Nenhum questionário enorme na primeira tela. Perguntar apenas o suficiente, explicar por que, permitir pular e completar depois. Antes da ligação bancária, mostrar demonstração com registros **fictícios**.

### 2.2 Conexão gradual de contas financeiras

**Alvos iniciais de produto:** Mercado Pago e Santander; depois, outras instituições conforme viabilidade regulatória, comercial, técnica e consentimento.

Planejar uma camada de conectores por instituição sobre padrões autorizados de **Open Finance do Brasil** ou parceiros elegíveis. Não armazenar senhas do internet banking, não imitar login, não raspar aplicativo ou contornar proteção do banco. Antes de declarar qualquer integração disponível, confirmar participação, modalidade, credenciamento/parceria e escopo legal. Compartilhamento exige consentimento específico, revogável e informado.

**Primeira compra / histórico:** buscar a **transação mais antiga efetivamente disponibilizada e autorizada** pela instituição e pela API; jamais prometer obter a primeira compra da vida se o banco não fornecer todo o histórico. Exibir intervalo real de cobertura por conta, lacunas e fontes. Por exemplo: se houver dados disponíveis desde cinco anos atrás, reconciliar de lá até hoje; se houver apenas meses, informar isso claramente.

Pipeline previsto: ingestão consentida -> validação de proveniência -> deduplicação idempotente -> normalização com fuso/data/moeda/status -> conciliação -> classificação revisável -> métricas agregadas -> armazenamento cifrado -> aprendizado contínuo. Diferenciar autorização, compra pendente, estorno, devolução, transferência própria e despesa real para não distorcer o perfil.

**Fase inicial de conexão é somente leitura.** Pix, ordens de investimento, pagamentos, crédito ou movimentação ficam explicitamente fora do primeiro lançamento e requerem autorização humana específica, integração regulada e nova auditoria.

### 2.3 Conhecimento financeiro que amadurece

O perfil deve evoluir com as experiências da pessoa: semanas, meses e anos. Detectar tendências, sazonalidade, metas, assinaturas, mudanças de hábito e prioridades, **sem congelar o usuário em uma categoria**.

Projeto de memória em camadas:
1. **Fatos autorizados:** transações, metas e preferências fornecidas; origem, data e escopo registrados.
2. **Hipóteses revisáveis:** 'talvez prefira transporte público', 'pode estar economizando para X'; sempre confiança, validade, evidência e alternativa.
3. **Preferências explícitas:** correções da pessoa prevalecem sobre inferências automáticas.
4. **Histórico temporal:** aplicar recência e mudanças de comportamento sem apagar o passado necessário a auditoria; permitir explorar padrões novos e contraditórios.
5. **Direito de rever e apagar:** explicar 'por que eu acho isso?', corrigir categoria, pausar aprendizado, desvincular banco, exportar e excluir dados segundo política aplicável.

O usuário pode se ausentar por um ano. Aprendizado proativo em segundo plano **não significa vigilância ininterrupta**: só há tarefas autorizadas, finalidade clara, limites de frequência/custo, respeito ao consentimento e funcionamento compatível com sistema operacional. Ausência de novas observações deve reduzir a confiança de hipóteses, não inventar informação.

## 3. Equipe de 17 IAs: especializações preservadas

Recuperado do quadro de produto 'Equipe IA para Bem-Estar Financeiro'. Os nomes são uma visão de personagens/funções, **não agentes inteligentes já implantados**.

| IA | Responsabilidade principal | Exemplos de contribuições | Limite de autoridade |
|---|---|---|---|
| **Nilo** | Assistente virtual principal | Conversa, voz, entende pedidos, reúne análises e coordena o conselho | Nunca opera conta/chaves só por conversa |
| **Dante** | CTO / diretor de tecnologia | Monitora qualidade operacional, saúde dos conectores, desempenho, contratos e versionamento | Não instala código, muda política ou publica sem aprovação técnica |
| **Helena** | Diretora financeira | Panorama de gastos, fluxo de caixa, organização e bem-estar financeiro | Análise não equivale a conselho regulado ou ordem de pagamento |
| **Lívia** | Economia e metas | Cria metas, orçamentos, simula cenários e acompanha progresso | Não altera meta sem transparência/consentimento |
| **Raul** | Guardião e segurança | Fraude, anomalias, vazamentos conhecidos, recomendações de proteção | Não recebe segredo bruto; não bloqueia recuperação legitimamente sem recurso |
| **Caio** | Especialista gamer | Compatibilidade, promoções, DLCs e impacto de compras de jogos | Só usa dados de interesse/compra autorizados |
| **Cecília** | Diretora de assinaturas | Recorrências, vencimentos, alternativas econômicas | Nunca cancela assinatura sem fluxo confirmado |
| **Valentina** | Compras inteligentes | Compara preços, fretes, lojas e histórico autorizado | Não faz compra nem fornece dados de cartão |
| **Yasmin** | Promoções e cupons | Ofertas, cashback, validade e histórico de preços | Evita incentivos manipulativos e links de risco |
| **Isabela** | Open Finance | Conexões consentidas, reconciliação e qualidade dos dados bancários | Sem credenciais do banco ou grant em nome da pessoa |
| **Beatriz** | Cartões | Faturas, limites, parcelamentos, vencimentos | Não expõe PAN/CVV nem autoriza transações |
| **Enzo** | Pix e pagamentos | Orienta verificações, prazos e riscos de pagamentos | Não executa Pix real no escopo inicial |
| **Arthur** | Investimentos | Educação, cenários, diversificação e risco | Sem ordens reais; recomendações reguladas exigem avaliação |
| **Gabriel** | Crédito e dívidas | Compara custos, amortização, juros e estratégias | Não contrata crédito em nome do usuário |
| **Clara** | Documentos | Organiza comprovantes, boletos e recibos com privacidade | Não publica arquivos nem extrai além do consentido |
| **Bianca** | Contas e vencimentos | Agenda de contas, compromissos e pagamentos programados | Notifica, não movimenta recursos sem autorização |
| **Leonardo** | Previsões financeiras | Projeções e cenários com faixas de incerteza | Previsão não é certeza nem promessa de retorno |

### 3.1 Conselho e troca de conhecimento

Uma tarefa pode juntar várias IAs em uma **sessão coordenada** por Nilo. Exemplo: compra de um jogo: Caio avalia compatibilidade, Valentina compara preço, Yasmin verifica promoção, Helena avalia orçamento, Lívia avalia efeito na meta e Raul checa sinais de golpe; Nilo sintetiza **com divergências** e razões.

Troca **de conclusões mínimas com origem e finalidade**, não cópia irrestrita da vida financeira. Comunicação preferencial por eventos versionados: `subject_pseudonym`, `purpose`, `consent_scope`, `source_ref`, `classification`, `confidence`, `expires_at`, `correlation_id`, e referência a dado cifrado que exige nova checagem para leitura.

Proibição de que um agente aumente suas próprias permissões, altere conclusões de outro como fatos, invente dados, execute comandos arbitrários, divulgue registros de uma pessoa para outra ou aprove uma transação bancária. Dante orquestra aspectos técnicos; **Raul é monitor/analista, não autoridade de desbloqueio criptográfico**. Políticas determinísticas nativas/servidor conferem direitos antes e depois da IA.

### 3.2 Evolução que não vira perda de controle

'IAs evolutivas' significa melhora contínua de contexto, avaliação, roteamento, aprendizado autorizado e versões de modelos. **Não** permitir que um agente altere sozinho seu código, modelo executável, criptografia, permissões ou dependências em produção.

Ciclo: observar -> avaliar qualidade/fonte -> propor hipótese -> testar contra dados fictícios -> registrar evidência -> aprovação proporcional ao risco -> implantação assinada e reversível -> acompanhar e desfazer quando necessário. Manter versões e métricas de alucinação, privacidade, falhas, falsos alertas, acessibilidade, latência, custo e satisfação.

## 4. Nilo: assistente de voz de alta capacidade

Alvo: experiência conversacional natural, multimodal conforme plataforma, com raciocínio avançado, memória consentida, personalização profunda e compreensão do contexto financeiro do Negresco. Buscar capacidade próxima a modelos de ponta sem prometer **inteligência idêntica a um ChatGPT específico**; a qualidade depende de provedores, modelos, custo, conectividade e avaliação.

Arquitetura recomendada: detecção de palavra de ativação somente se aceita -> microfone com indicador -> reconhecimento de fala -> roteador de intenções -> motor conversacional de alta capacidade -> ferramentas declaradas (somente leitura por padrão) -> revisão de autorização determinística -> resposta falada e visual com confirmações. Preferir modo híbrido: tarefas básicas locais e funções avançadas em modelos remotos **apenas com consentimento e minimização**. Guardar transcrições somente se autorizado; nunca enviar senhas, tokens ou chaves a um modelo remoto.

Personalização: voz, personalidade, tom, duração, proatividade e acessibilidade ajustáveis. Oferecer 'não sei', fontes, nível de confiança e confirmação antes de qualquer ação sensível. Comandos como 'envie Pix' devem permanecer indisponíveis até fases reguladas e autorização per-operação, jamais por convicção da IA.

## 5. Experiência visual e acessibilidade

**Direção visual:** alta qualidade de acabamento, tema escuro OLED bem contrastado, opções claro/alto contraste, tipografia legível, hierarquia consistente, microinterações discretas, painéis explicáveis e telas de conta claras. A beleza é uma vantagem, mas o usuário deve entender o que tocar, o que foi analisado e o que a IA *não* fez.

Requisitos: leitores de tela, textos redimensionáveis, alvos de toque amplos, navegação sem depender de cores, linguagem simples, português natural, consentimentos legíveis, onboarding gradual, fluxo de ajuda sem exigir voz e modos essencial/completo. Evitar dashboards lotados, alertas intermináveis, rankings invasivos e gamificação de dívidas.

## 6. Valor mensurável e não metas impossíveis

- Tempo para configurar primeira meta e encontrar uma despesa sem assistência.
- Cobertura comprovada por instituição, intervalo histórico efetivamente importado e taxa de duplicatas.
- Correção de categorização, calibração de previsões e taxa de sugestões aceitas sem pressão.
- Tempo de revogar consentimentos e recuperar acesso em cenários de perda de aparelho/pen drive.
- Zero operações financeiras não autorizadas nos testes; incidentes, regressões, falhas de autorização.
- Proporção de respostas do assistente sustentadas por dados e qualidade dos encaminhamentos entre IAs.
- Usabilidade com leitores de tela, smartphones modestos, internet fraca e pessoas menos familiarizadas.

## 7. Roadmap de entrega sem desorganizar a etapa atual

**Etapas de produto**, distintas dos grupos técnicos P0–P5 já existentes no repositório:

| Fase | Entrega-alvo | Critério de avanço |
|---|---|---|
| **1. Base confiável (ATUAL)** | Coleta fictícia, criptografia nativa experimental, autenticação por operação DENY-only, revogação, auditoria e QA Android | CI+JUnit nominal+QA humano físico+revisão de ameaça; sem finanças reais |
| 2. Finanças manuais e experiência | Onboarding, orçamento/metas, lançamentos fictícios e depois manuais autorizados, acessibilidade, UX | Persistência segura auditada e retorno legível do usuário |
| 3. Nilo, Dante, Raul e conselho inicial | Assistente conversacional, voz consentida, memória revisável, delegação e isolamento de dados | Avaliação de IA, custos, ferramentas, permissões, proteção contra prompt injection |
| 4. Mercado Pago, Santander e próximos bancos | Provedores/contratos autorizados, consentimento revogável, ingestão histórica disponível, conexões somente leitura | Elegibilidade legal e comercial, segurança FAPI/OAuth, auditoria, dados reais só após homologação |
| 5. Ecossistema e acabamento | Todas as 17 especializações, colaboração supervisionada, recuperação resiliente, automações opt-in, polimento | Testes de ponta a ponta, recuperação em dispositivo, acessibilidade, privacidade e revisão independente |

Funcionalidades de recuperação e segurança são transversais: **projetá-las na Fase 1**, implementar primeiro com simulações, homologá-las antes de bancos reais; não adiar todo o sistema de recuperação à Fase 5. Uma parte útil da interface e do assistente pode evoluir em paralelo em branches experimentais, **sem atravessar gates**.

**Trabalho ativo não pode ser perdido:** [Issue #18](https://github.com/nego001/negresco-finance./issues/18) (P0-1), [PR #14 DRAFT](https://github.com/nego001/negresco-finance./pull/14), [PR #22 DRAFT](https://github.com/nego001/negresco-finance./pull/22) (tentativa sintética com 4/4 testes instrumentais ainda exigidos no SHA `7dd4dfe` na ocasião da criação desta visão). Esta documentação não altera código, não promove branch e não declara CI nova aprovada.

## 8. Fontes e limites regulatórios a confirmar em cada entrega

- Banco Central: [consentimento e transmissão direta do Open Finance](https://www.bcb.gov.br/meubc/faqs/p/como-levar-seus-dados-de-um-banco-para-outro); [dados compartilháveis](https://www.bcb.gov.br/meubc/faqs/p/tipos-de-dados-e-servicos-que-podem-ser-compartilhados-com-o-open-finance).
- [OWASP MASVS](https://mas.owasp.org/MASVS/03-Using_the_MASVS/) para armazenamento, criptografia, autenticação, rede, código, resiliência e privacidade.
- [OpenID FAPI 2.0 Security Profile (final)](https://openid.net/specs/fapi-security-profile-2_0-final.html) para sistemas de API financeira de alto valor.
- [LGPD, princípios do art. 6º](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/glossario-anpd): finalidade, necessidade, transparência, segurança e direitos da pessoa.

**Atenção:** nada aqui constitui autorização jurídica para o Negresco receber Open Finance diretamente; viabilidade exige parceiros/instituição autorizada e análise regulatória antes de integrar provedores.
