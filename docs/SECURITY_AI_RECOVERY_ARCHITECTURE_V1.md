# Negresco Finance | Arquitetura de segurança, recuperação e evolução de IAs V1

> **RFC de intenção arquitetural; não implementação aprovada.** Complementa [a visão de produto](PRODUCT_VISION_INTELLIGENT_ECOSYSTEM_V1.md). Proteções aqui descritas são requisitos a demonstrar com testes. Mantém os limites e gates existentes da Fase 1.

## 1. Modelo de confiança e ativos a proteger

Ativos: transações históricas, categorias/inferências de IA, documentos, preferências, credenciais de conectores, tokens de consentimento, segredos do cofre, chaves mestras e de recuperação, capacidade de executar operações, registros de auditoria e integridade de atualizações.

Adversários/erros: dispositivo roubado/desbloqueado, malware e app modificado, phishing de consentimento, adversário com token roubado, engenharia social e falsa biometria, USB perdido/clonado, banco malicioso/simulador de Open Finance, prompt injection em extrato ou documento, vazamento de provedor LLM, privilégios excessivos entre IAs, corrupção/rollback de dados, falha de backup e erros de sincronização.

Regras principais:
- A IA **nunca é autoridade final de autenticação, recuperação, criptografia ou transferência**.
- Um `ALLOW` só poderia existir no futuro em controle nativo/servidor projetado, auditado e apoiado em prova criptográfica por operação, **não** em boolean de JS ou sucesso do chatbot. Hoje o produto segue **DENY-only**.
- Separar cofres de dados financeiros, material de conectores bancários, perfil analítico da IA e memórias conversacionais. Chaves diferentes e permissões segmentadas.
- Não fazer log de senha mestra, tokens, passphrase SQLCipher, chaves privadas, CSV bancário integral, biometria ou transcrições sensíveis.
- Criptografia em repouso e trânsito, integridade autenticada, hardware-backed quando aplicável, tratamento de chaves e revogação, auditados independentemente. Esboço: Keystore e SQLCipher no Android, chaves de conteúdo aleatórias envelopadas e algoritmos consolidados como AES-256-GCM quando apropriados; Argon2id para derivação de senha conforme modelo de ameaça. **Não criar esquema criptográfico próprio.**
- Backups cifrados, chaves/identidade não exportadas a IA/JS e proteção contra restauração/rollback; definir semântica de rekey e perdas antes de produção.

## 2. 'Guardião que se fortalece' sem atualizar código sozinho

**Objetivo entendido:** Raul recebe inteligência sobre golpes, vazamentos e novas técnicas de ataque e sugere/reforça a segurança. O aplicativo permanece defensivo mesmo entre versões.

**Transformação segura:** inteligência de ameaças confiáveis -> coleta isolada (feeds/sinais com origem) -> normalização -> correlação com componentes instalados -> avaliação de impacto -> proposta de controle -> política determinística em sandbox -> teste de regressão e limite de falsos positivos -> aprovação por nível de risco -> regra assinada, versionada, implantável e reversível -> monitoramento contínuo.

Níveis recomendados:
1. **Automático, baixo risco:** melhorar alertas contextualizados, reduzir confiança em link suspeito, reforçar observabilidade sem coletar dados novos ou negar conta legítima.
2. **Automático somente com regras pré-aprovadas e prazo curto:** desacelerar operações sensíveis e exigir verificação adicional *já registrada*, sempre com mecanismo de recurso e prevenção a DoS de segurança.
3. **Somente com revisão humana e release assinado:** mudar algoritmos, permissões, política de recuperação, kernel/serviço, autenticação bancária, atualizar bibliotecas ou bloquear acesso de alto impacto.

Mudança de código, atualização de executáveis, modelos e parâmetros privilegiados **não são auto-modificação irrestrita**. AI pode criar proposta/PR e rodar testes em ambiente controlado; CI, revisão independente, assinaturas e rollback são obrigatórios. Observação de vazamento em site externo **não prova** comprometimento do usuário; não coletar credenciais vazadas em texto claro.

Definir resposta a incidente: detecção, contenção proporcional, preservação de evidência mínima, revogação de sessões no servidor (quando houver), reconexão consentida de bancos, revalidação e assistência de recuperação. Garantir fluxo de suporte offline/contingência sem permitir desbloqueio por conversa com a IA.

## 3. Recuperação multicaminho inspirada em gerenciadores de senha

**Objetivo:** usuário legítimo que perde aparelho, esquece senha ou perde chave física consegue tentar recuperação por métodos previamente cadastrados, sem entregar chave ao suporte ou a um modelo de IA.

### 3.1 Fatores propostos

- **Chave de recuperação de alta entropia** gerada pelo app, exibida uma única vez em linguagem acessível, com confirmação de que foi guardada; papel em local seguro, cofre externo ou mídia cifrada. **Não recomendar captura de tela ou armazenamento em texto simples no mesmo telefone como única cópia.**
- **Senha/segredo mestre**, usada em derivação de chave resistente a força bruta e com limites de tentativa. Distinguir senha de conta online, código de desbloqueio local e segredo de recuperação.
- **Biometria/facial** como autenticação de conveniência ou liberação de uso de chave protegida no hardware do dispositivo; **não se converte em backup da chave criptográfica** e não deve ser a única forma de recuperação após perda de aparelho.
- **Chave de segurança física** (preferencialmente autenticador FIDO2/WebAuthn dedicado) como fator de posse com autenticação adicional e plano de dispositivo alternativo.
- **Pendrive comum com contêiner cifrado de recuperação**, opcional, criado apenas em área escolhida com aviso e sem apagar outros arquivos; isso é armazenamento de segredo, **não** prova não clonável de posse física. Exigir PIN/segundo fator quando apropriado.
- **Outras vias cadastradas pelo titular**, como código offline secundário, dispositivos confiáveis e recuperação assistida com verificação robusta, se compatível com modelo de risco e legislação.

### 3.2 Pendrive que 'vira chave'

A ideia de mídia dedicada é válida como opção, com limites:
- **Jamais inutilizar/formatar o pendrive automaticamente.** Se houver modo 'pendrive dedicado', deve ser uma escolha explícita com avisos de perda de dados e backup testado, não padrão.
- Um USB de armazenamento pode ser **copiado**; não tratá-lo como autenticador de hardware. Preferir FIDO2 para prova de posse resistente a phishing, e contêiner criptografado se for apenas backup.
- **Não desbloquear automaticamente só ao conectar**: ter presença do token não equivale a identidade; exigir fatores locais apropriados. Celulares podem não aceitar USB/FIDO2 igualmente; testar OTG, passkeys e plataformas.
- Cadastro cria credencial individual por dispositivo com `credential_id`, rotação e possibilidade de revogação; nunca uma única chave universal reutilizada e impossível de invalidar.

### 3.3 Perda, roubo e revogação

1. Pelo dispositivo ainda autenticado, o titular escolhe **Dispositivos e chaves de recuperação -> Revogar credencial perdida**.
2. Exigir reautenticação forte apropriada, com antifraude e confirmação clara do efeito sobre dispositivos, banco de dados e backups.
3. Inutilizar identificador/tokens/sessões correspondentes no servidor quando existente, bloquear novas autorizações via credencial revogada e **rotacionar os invólucros de chaves** para que uma credencial removida não abra o cofre atual.
4. Onde material de chave anterior já possa ter sido copiado, estudar **recriptografia/rekey e revogação de acesso a cópias sincronizadas**; **não prometer destruir à distância um pendrive perdido, dados offline já copiados ou backups nas mãos do invasor**.
5. Confirmar um método alternativo ainda funcional e testar recuperação depois da revogação. Registrar evento auditável minimizado e aviso em canais já verificados.

Cenários obrigatórios: perdeu pendrive mas ainda tem o app; perdeu celular mas tem recuperação offline; perdeu os dois mas tem um terceiro fator previamente cadastrado; perdeu todos os fatores. Nesse último caso, em um cofre genuinamente zero-knowledge e sem mecanismo autorizado de custódia/reconstrução, **recuperação do conteúdo pode ser impossível**. Nunca criar backdoor 'mestre do aplicativo' para fingir capacidade de recuperação.

### 3.4 Modelo de reconstrução a decidir

Estudar recuperação com **múltiplos fatores independentes** e, onde fizer sentido, partilha de segredo com limiar `k-de-n` e autenticadores de dispositivos. A arquitetura precisa provar que **nenhuma única pessoa, IA, servidor ou chave roubada** reconstrói a chave sem requisitos explicitamente aceitos. Antes de escolher limiar, testar disponibilidade, perda simultânea, troca de celular, acessibilidade, tempo de recuperação, revogação, backup e ameaças de engenharia social.

## 4. Compartilhamento seguro entre as 17 IAs

Cada IA é um **principal lógico** com identidade, escopo, política e orçamento de dados. O 'conselho' é colaboração sob controle:
- Nilo gera plano de tarefa, pergunta consentimento quando necessário e comunica conclusões.
- Dante mede saúde do serviço, fluxos de dados, versões e custo, não concede autorização bancária.
- Raul recebe telemetria e metadados *minimizados*, não tokens, chaves ou dados de conta brutos por padrão.
- As outras 14 IAs recebem apenas o subconjunto autorizado pela pessoa e relevante ao pedido, com expiração, classificação de risco e obrigação de justificar fonte e inferência.
- Eventos assíncronos contêm referências e resumos de mínimo privilégio; ferramenta privilegiada verifica autorização independentemente de prompt/contexto. Uma instrução maliciosa embutida em extrato PDF não pode virar ordem de sistema.
- Memória por usuário é isolada e criptografada. Nada de treinar modelo global com transações identificáveis sem base legal e opt-in específico. A utilidade de um modelo pode crescer por atualizações avaliadas sem incorporar dados privados de outros usuários.
- Plano de uso, armazenamento e retenção por finalidade; console 'o que minha equipe sabe', exportar, corrigir, apagar e revogar.

**Separar tipos de evolução:** aprendizado de preferências/memória é diferente de fine-tuning, atualização de modelo, alteração de prompt de sistema, mudança de regras antifraude, rotação de chaves e implantação de código. Cada um possui fluxo, métricas, autorização e rollback próprios.

## 5. Testes pesados e exercícios de invasão autorizados

Somente ambientes próprios/homologados, **sem atacar sistemas de bancos ou terceiros**. Criar ambientes sintéticos e testes independentes:
- Unidade, integração, property-based e fuzz de parser de transações, serialização, consentimento e deduplicação.
- Instrumentação Android e ensaios reais com autorização: Keystore, SQLCipher, BiometricPrompt(CryptoObject), cancelamento, timeout, background, troca de cadastro, perda da chave, crash e reentrada.
- Modelos de ameaça STRIDE por componente, pentest por equipe autorizada, revisão de arquitetura, dependências e supply chain.
- Red team das IAs: prompt injection em descrições de compra/documentos/páginas, exfiltração entre especialistas, manipulação de conselho, fabricação de justificativas e fraude por voz gravada.
- Testes da recuperação: USB clonado/perdido, biometria inválida, backup corrompido, revogação offline, rollback de snapshot, hardware roubado e disponibilidade do titular legítimo.
- Estabilidade: memória/CPU em aparelhos modestos, bateria, internet intermitente, milhares de transações, concorrência e timeout.
- CI com artefatos sanitizados, inventário nominal de testes, `skip` justificado, análise estática e verificação da variante Release. Teste invasivo sobre banco real só com escopo e autorização formal do titular/fornecedor.

**Normas de referência:** [OWASP MASVS](https://mas.owasp.org/MASVS/03-Using_the_MASVS/), [OpenID FAPI 2.0](https://openid.net/specs/fapi-security-profile-2_0-final.html), [princípios LGPD](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/glossario-anpd) e normas de Open Finance vigentes.

## 6. Gates reais da etapa corrente

**Em 24/10/2026, Fase 1/5:** Issue [#18](https://github.com/nego001/negresco-finance./issues/18), [PR #14](https://github.com/nego001/negresco-finance./pull/14) (DRAFT), [PR #22](https://github.com/nego001/negresco-finance./pull/22) (DRAFT). O próximo avanço de código é a auditoria Android completa dos **4/4 métodos de tentativa sintética** no **SHA revisado `7dd4dfecc22e`** e demais gates nominais, não a implementação imediata do banco real.

**Continuam proibidos:** merge/release na `main`, instalação ou desinstalação do app pessoal, biometria positiva alegada apenas pelo emulador, credenciais reais, integração com Santander/Mercado Pago fora de parceiro autorizado, exportação de chaves, `financialStorageAllowed=true`, `keyReleaseAllowed=true`, `migrationAllowed=true`, autoaprendizado irrestrito e automodificação privilegiada.

Este RFC **não** muda o estado dessas flags, não passa testes Android, não aprova recuperação e não cria funcionalidade. As implementações exigirão novas PRs isoladas, revisão de segurança e provas independentes antes de promoção.
