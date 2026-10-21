# Negresco Finance | Catálogo futuro de 17 IAs: aparência, identidade social e notificações v1

**Estado: CONCEITO DE PRODUTO / NÃO IMPLEMENTADO.** 21/10/2026. Sem arquivos de modelos 3D, imagens de personagens, engines de avatar, personagens ativos, vozes implantadas ou push em produção por meio desta documentação.

**Etapa de desenvolvimento ativa:** SEC-05K, recuperação criptográfica de migrações interrompidas, inalterada. Este catálogo complementa [arquitetura social](ARQUITETURA-IAS-SOCIAIS-NEGRESCO-V1.md) e [plano de implementação S0–S8](PLANO-IAS-SOCIAIS-NEGRESCO-V1.md). Não permitir que arte ou notificações desviem a base de segurança.

## 1. Decisão de design

**Todas as 17 IAs terão uma aparência visual distinta, avatar identificável, cargo, personalidade, estilo textual e voz próprios.** Nome e cargo no produto não se confundem com aparência física. Os traços abaixo são **direções artísticas iniciais**, personalizáveis futuramente; não definem atributos humanos reais, raça, origem, idade exata ou consciência dos sistemas.

Estilo sugerido: personagens 3D **semirrealistas, modernos e expressivos**, com versão 2D leve do mesmo personagem; acabamento consistente em fundo OLED preto e superfícies grafite com iluminação suave, sem estética infantil. Proporções legíveis em foto pequena, paleta exclusiva por personagem e silhuetas não intercambiáveis. A identidade visual não altera acesso/autoridade e não é prova de trabalho executado.

### 1.1 Catálogo da equipe principal

| Agent ID proposto (não implementado) | Nome / cargo | Aparência proposta | Assinatura visual / expressão |
|---|---|---|---|
| `agent.assistant.primary` | **Nilo**, Assistente Virtual Principal | Cabelo escuro curto, corte moderno, casaco casual azul-marinho e camiseta neutra | Azul-petróleo, expressão acessível e atenta; gestos discretos de mediação |
| `agent.office.cto` | **Dante**, CTO / Diretor de Tecnologia | Cabelo preto ondulado penteado para trás, blazer grafite e camisa escura | Prata e azul profundo, postura firme, olhar concentrado; gestos objetivos |
| `agent.finance.director` | **Helena**, Diretora Financeira | Cabelo castanho em corte médio elegante, blazer claro de alfaiataria | Azul-safira, postura serena, expressão analítica e confiante |
| `agent.savings.specialist` | **Lívia**, Especialista em Economia e Metas | Cabelo castanho cacheado na altura dos ombros, roupa confortável verde-oliva | Verde-sálvia, gestos didáticos e expressão acolhedora sem euforia automática |
| `agent.security.guardian` | **Raul**, Guardião | Cabelo curto com detalhes grisalhos, jaqueta escura sem símbolos policiais | Cinza-aço, iluminação contida, expressão vigilante porém não intimidadora |
| `agent.gaming.specialist` | **Caio**, Especialista Gamer | Cabelo escuro com textura e volume, hoodie moderno discreto | Azul-elétrico suave, postura descontraída e expressões energéticas fora de alertas |
| `agent.subscriptions.director` | **Cecília**, Diretora de Assinaturas | Cabelo ruivo-escuro de comprimento médio, blazer vinho com roupa minimalista | Vinho/ametista, gestos comunicativos e expressão perspicaz |

### 1.2 Expansão aprovada conceitualmente (10 especialistas)

| Agent ID proposto | Nome / cargo | Aparência proposta | Assinatura visual / expressão |
|---|---|---|---|
| `agent.shopping.director` | **Valentina**, Diretora de Compras Inteligentes | Cabelo preto liso longo, jaqueta bege estruturada, acessórios discretos | Dourado-areia, olhar investigativo e confiança ao comparar ofertas |
| `agent.deals.specialist` | **Yasmin**, Especialista em Promoções e Cupons | Cabelo escuro curto cacheado, look urbano de contraste moderado | Coral/âmbar, sorriso rápido, gestos animados; seria ao desconfiar de fraude |
| `agent.open_finance.specialist` | **Isabela**, Especialista em Open Finance | Cabelo castanho preso em coque baixo, roupa técnica sofisticada | Ciano-profundo, expressão reservada e precisa, sem visual bancário institucional |
| `agent.cards.specialist` | **Beatriz**, Especialista em Cartões | Cabelo castanho curto em camadas, óculos leves, blazer casual | Lilás frio, expressão organizada e foco em datas, limites e parcelas |
| `agent.payments.specialist` | **Enzo**, Especialista em Pix e Pagamentos | Cabelo curto com corte marcado, camisa azul-escura moderna | Azul-celeste, postura atenta e comunicação clara em prévias de pagamento |
| `agent.investments.specialist` | **Arthur**, Especialista em Investimentos | Cabelo ondulado com discretas mechas claras, blazer sóbrio | Verde-esmeralda escuro, expressão calma e cautelosa diante de incerteza |
| `agent.credit.specialist` | **Gabriel**, Especialista em Crédito e Dívidas | Cabelo castanho curto e volumoso, camisa com blazer cinza suave | Cobre/terra, postura direta porém não julgadora |
| `agent.documents.specialist` | **Clara**, Especialista em Documentos Financeiros | Cabelo acobreado em corte na altura dos ombros, óculos de armação fina | Azul-claro/pérola, expressão detalhista; gestos sutis de organização |
| `agent.bills.specialist` | **Bianca**, Especialista em Contas e Vencimentos | Cabelo castanho em corte reto à altura do queixo, casaco verde-escuro | Turquesa profundo, expressão objetiva; foco visual em agenda |
| `agent.forecasting.analyst` | **Leonardo**, Analista de Previsões Financeiras | Cabelo escuro de comprimento médio, óculos retangulares, camisa neutra | Índigo, expressão contemplativa e comunicação analítica |

**Nomes dos 10 especialistas:** seleção aprovada conceitualmente pela solicitação de avançar com "essas IAs"; ajustáveis depois. São propostas de apresentação, não identidades já provisionadas. A marca do aplicativo continua **Negresco Finance**, mesmo que o assistente principal se chame **Nilo**.

## 2. Aparência, personalização e continuidade

Cada `AgentAppearanceProfile.v1` futuro terá `namespace`, `agent_id`, `appearance_version`, `render_variant` (2D/3D), `avatar_asset_id`, `palette_tokens`, `silhouette`, `outfit_preset`, `accessibility_alt`, `animation_policy` e `user_override_refs`.

- O usuário poderá trocar cabelo, tom de pele, roupas, acessórios, estilos de expressão, animações e avatar personalizado por agente, dentro de uma política clara de conteúdo e direitos de imagem. Essas opções **não estão operacionais**.
- Aparência deve se manter coerente entre chat, sala coletiva, preview de processo, perfil e notificações; usar mesma `agent_id` e asset versionado, com fallback 2D ou monograma colorido se 3D indisponível.
- Expressões animadas sinalizam apenas **estado comunicacional/operacional** de UI, não sentimentos reais. Lip-sync só quando há saída TTS verificavelmente em reprodução; nunca simular "trabalhando" quando nenhum job existe.
- Evitar consumo excessivo: render 3D sob demanda, FPS limitado, alternativa sem movimento, economia de bateria, cache autorizado, fallback para aparelhos modestos.
- Prioridade para legibilidade em OLED, alto contraste, leitor de tela e avatares pequenos. Não depender apenas de cor para diferenciar autores.
- Não produzir modelos visuais usando identidades de pessoas reais sem direitos/autorização apropriada; não copiar personagens protegidos de outros produtos.

## 3. Integração com as fases de implementação

- **S0 (docs):** este catálogo e escolha inicial das identidades, SEM assets ou runtime.
- **S1 (Agent Registry e Persona Engine):** relacionar nome + cargo + `agent_id` + assinatura visual e fallback; perfil de aparência começa por esquema e mock sintético, não por animações caras.
- **S3 (Chat individual/Sala das IAs):** mostrar autor validado, rosto/ícone correspondente, alternativas de leitura, DEMO claramente sinalizada.
- **S4 (Mission Observer):** exibir o avatar somente do agente que emitiu evento real; movimentos e rótulos respeitam eventos verificáveis.
- **S6 (TTS):** usar `voice_preset` de cada agente, permitindo expressividade apenas quando o provedor sustenta; lip-sync/legendas do texto aprovado. Estado de fala real, nunca efeito de "falando" falso.
- **S7 (Notification Composer):** emissor e avatar/ícone opcionais da IA em notificações, respeitando APIs e limites do sistema; privacidade por padrão, controles por agente e notificações confiáveis.
- **S8 (homologação):** revisar UI/UX, consentimentos, desempenho, acessibilidade, privacidade e consistência da identidade entre telas.

**Importante:** o design não precisa esperar todos os agentes para definir a identidade, mas **implementação S1–S8 não pode começar enquanto SEC-05K e outros gates de segurança estiverem pendentes**, salvo aprovação explícita de replanejamento.

## 4. Etapa S7: notificações individuais por IA

### 4.1 Como devem parecer

- App Android emissor: **Negresco Finance**. Dentro do corpo/título, o locutor exibido é a IA real: **Cecília**, **Caio**, **Raul**, **Helena** etc.
- `title`: `Cecília • Diretora de Assinaturas`; `body`: `Sua assinatura pode renovar em 5 dias; confira a data estimada.` quando há fonte apropriada. Nunca garantir data estimada como contrato confirmado.
- `largeIcon` / ícone visual **se a plataforma permitir**, do avatar da agente; `smallIcon` e a identidade do app respeitam exigências do Android. Não prometer imagem personalizada em todos os aparelhos, versões e estados de notificação.
- `deepLink` autorizado abre a missão, a conversa atribuída ou a análise original, já filtrada por `mission_id`; nunca realiza pagamento ou compra automaticamente.
- Notificações são prévias resumidas, não mensagens completas confidenciais em lockscreen.

### 4.2 Casos por especialista

| Evento real e consentido | Nome no aviso | Comportamento pretendido |
|---|---|---|
| Falha técnica comprovada de integração | Dante | informar incidente sem alegar resolução não concluída |
| Análise financeira concluída | Helena | tendência com fonte e dados restritos na tela bloqueada |
| Meta atingida no cálculo | Lívia | comemorar resultado e indicar a meta realmente atingida |
| Indício de fraude revisado | Raul | alerta proporcional e indicação de conferir canal oficial |
| Jogo da lista em oferta verificada | Caio | edição, plataforma, data e preço confirmado |
| Assinatura próxima da data confirmada/estimada | Cecília | avisos 7/5 dias antes, rotular estimativa quando necessário |
| Produto da lista em preço-meta | Valentina | nome abreviado, preço/fonte e comparação autorizada |
| Cupom realmente aplicável | Yasmin | condição e validade, não inventar porcentagem |
| Conexão Open Finance com consentimento vencendo | Isabela | solicitar nova autorização sem falsificar estado bancário |
| Fatura e parcela com data verificada | Beatriz | valor detalhado apenas após desbloqueio |
| Pix solicitado ainda não autorizado | Enzo | **não executa Pix**; solicitar revisão com autenticação adequada |
| Simulação de investimento concluída | Arthur | destacar hipóteses/riscos, sem promessa de retorno |
| Mudança de custo de uma dívida | Gabriel | juros/cenário conferidos, sem alarmismo |
| Documento solicitado processado | Clara | avisar status verdadeiro e link autorizado |
| Conta próxima do vencimento | Bianca | aviso com data/fonte e ação de abrir detalhes |
| Previsão de caixa recalculada | Leonardo | projeção com incerteza e premissas |
| Conclusão de missão multissetorial | Nilo | síntese com autores e divergências preservadas |

### 4.3 Contratos propostos

`AgentNotification.v1`: `project_namespace`, `agent_id`, `appearance_version_optional`, `mission_id`, `event_id`, `source_evidence_ref`, `delivery_status`, `kind`, `urgency`, `title_redacted`, `body_redacted`, `deep_link`, `dedup_key`, `expires_at`, `privacy_level`, `locale`, `recipient_opt_in`.

Pipeline: **evento financeiro/comercial real → autorização e preferência → vínculo causal com agente validado → composição textual pela persona sob policy → redação de PII → controle de frequência e dedupe → fila legítima de push → resultado de entrega registrado**.

- Notificações por agente podem ser desativadas ou ajustadas individualmente. Modos `silencioso`, `normal`, `urgente` por categoria, com **urgência sujeita a regra objetiva**, não a desejo de um personagem.
- Janelas de silêncio e canais específicos, controle de spam, idempotência/retry, TTL, consentimento e revogação. Perder rede ou fechar app não autoriza afirmar que uma notificação foi entregue.
- O estilo de cada IA influencia a redação, não o fato nem os riscos. Em fraude e segurança, suppress humor independente de perfil.
- Serviços de monitoramento com o aplicativo fechado só se houver backend, integração autorizada e push real; cronologia e latência dependem do provedor.
- Bloqueio de tela oculta banco, saldo, CPF, detalhes de Pix, jogo/produto sensível e informações financeiras por padrão. O usuário poderá escolher nível de exposição com consentimento informado.
- Notificações agrupáveis por missão/categoria, escolha do agente emissor e registro de falhas; sem falsificar origem, cargo ou avatar.
- **S7 é futuro, não implementado.** Documentação não confere permissão de notificação do Android ou criação de tarefas.

## 5. Critérios de teste e aceitação adicionais

1. **17 identidades distintas:** unicidade de `agent_id`, `display_name`, cargo, avatar asset/fallback e estilo em namespace `negresco.finance`.
2. Mudança de nome/roupa/avatar não muda autorização, trust nem memória de outro agente; todas as versões de arte mantêm atribuição correta.
3. Chat, sala das IAs, preview e push usam o mesmo `agent_id`/assinatura visual, inclusive após rename ou seleção do usuário.
4. Em incidente `CRITICO`, expressões/vozes e notificações abandonam humor/zoeira sem alterar fatos.
5. Avatar estático funciona offline/baixa memória; opção reduzir animação, TalkBack, nomes acessíveis e contraste.
6. Testar sem permissão de push, push perdido, mensagem duplicada, source timestamp obsoleto, falha de backend, celular reiniciando e lockscreen privado.
7. Títulos Android com nome correto; respeitar `smallIcon`, canais e limitações da plataforma, sem simular formato não suportado.
8. Nunca enviar alerta de renovação estimada como vencimento confirmado, aviso de fraude sem evidência, ou "Pix concluído" sem confirmação do serviço autorizado.
9. Conferir que o Nome `Negresco Finance` não é trocado por `Nilo` como identificação de aplicativo.
10. Documentação `PLANNED`; testes `NOT_RUN` até código/CI/homologação, nunca declarar pronto sem evidência.

**Nenhuma aparência foi gerada como arquivo visual e nenhuma notificação foi enviada por este documento.**
