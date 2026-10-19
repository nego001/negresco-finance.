# Negresco Finance - planejamento por versao

## Principio
Cada versao tem um foco principal e entrega um pacote substancial de melhorias relacionadas. Nao misturar recursos bancarios reais com redesenho visual. Uma versao so fica concluida apos revisao, testes e validacao no Samsung.

## V3 - Aparencia e experiencia visual (escopo atual)
- Identidade OLED e componentes de design consistentes.
- Iconografia profissional e acessivel.
- Hierarquia visual, tipografia, espacamento e responsividade.
- Dashboard e telas de todos os modulos visualmente refinados.
- Animacoes e microinteracoes que nao prejudiquem acessibilidade.
- Temas, preferencias de apresentacao e visual da Negresco.
- Estados vazios, carregamento, erro e demonstracao com identificacao honesta.
- Verificacao TypeScript, compilacao Android e teste OTA no canal preview.

**Fora do escopo da V3:** Pix real, leitura de QR real, consulta a banco, conversa com IA real, operacoes financeiras, biometria e integracoes. Protótipos locais nao devem ser anunciados como funcionalidades prontas.

## V4 - Usabilidade
Onboarding, acessibilidade, preferencias persistentes, busca e organizacao de modulos.

## V5 - Contas e financas
Modelo de dados, historico, receitas/despesas e contas com dados de teste e autorizacoes explicitas.

## V6 - Pix e pagamentos
Fluxos de preparacao, revisao, validacao, QR e comprovantes com integracoes autorizadas e ambiente de teste.

## V7 - Negresco IA
Conversacao, identidade configuravel, CTO, agentes especializados, consentimento e limites deterministas.

## V8 - Seguranca
Guardiao, biometria, sessao, criptografia, auditoria e testes adversariais. Controles basicos de seguranca continuam obrigatorios desde P0.

## V9 - Investimentos e metas
Carteiras, graficos, metas e relatorios com fontes de dados verificadas.

## V10 - Integracoes
Open Finance e provedores financeiros autorizados, sujeitos a requisitos legais, tecnicos e de seguranca.

## Regras de entrega
1. Abrir o trabalho da versao com criterios de aceite.
2. Implementar o conjunto inteiro antes de anunciar a versao como concluida.
3. Rodar validacao estatica, testes e build Android quando aplicavel.
4. Publicar OTA apenas se a alteracao for compativel com o runtime instalado.
5. Confirmar recebimento no Samsung. Sem confirmacao, estado = nao validado.
6. Nao misturar credenciais nem dados financeiros reais em codigo, logs ou prints.
7. Manter versoes anteriores recuperaveis e documentar mudancas.

## Pacote visual unico V3 - verificacoes
- Icones vetoriais feitos com primitivas nativas do React Native, sem dependencias externas.
- Navegacao inferior, cartoes, dashboard, areas vazias e ajustes visuais padronizados.
- Transicoes com Animated, opcao para reduzir movimento e textos maiores.
- Pix e IA permanecem somente como previsualizacao, sem pagamentos ou IA conectada.
- Pendente: compilacao Android CI, verificacao de layout em aparelho e confirmacao OTA no Samsung. Nao declarar V3 concluida ate esses testes.

### V3 OLED - pacote de acabamento (OTA)
- Corrigir barra de status Android com espaco reservado ao cabecalho.
- Corrigir quebra de linha real do banner e impedir sobreposicao do selo com o texto.
- Redesenhar o icone de Inicio e realcar a aba ativa.
- Melhorar o comportamento do titulo em larguras pequenas e o acabamento da navegacao.
- Sem mudanca nativa nem alteracao de runtime; publicar no canal preview apos TypeScript/CI.
- Confirmacao no Samsung e revisao visual continuam necessarias apos publicacao.

### V3 - Negresco: acabamento visual e prototipo local
- Novo avatar vetorial com monograma N, halo e assinatura visual.
- Layout compacto, identificacao do modo demonstracao e hierarquia tipografica.
- Compositor e baloes locais de conversa (nao enviam dados nem consultam IA).
- Seletor de apresentacao visual acolhedora/objetiva (temporario).
- Estados e acessibilidade nos controles; nenhuma mudanca nativa.
- Testes de CI, Android e recebimento OTA no Samsung ainda devem ser confirmados.


## Gate de publicação de candidatos (Fase 1)

Alterações em branches e pushes de desenvolvimento podem compilar e preservar APKs
como artefatos de CI, mas **não** devem criar GitHub Releases automaticamente.
A etapa de publicação da workflow Android está condicionada ao uso manual
`workflow_dispatch` na branch `main` com `publish_release=true`.
A opção começa desligada. Mesmo um release marcado como *prerelease* não
substitui a homologação de assinatura, atualização segura e QA no Samsung.
Um push comum na `main` também não publica APK: exige intenção explícita.
