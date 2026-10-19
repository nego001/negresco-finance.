# Negresco Finance | Fase 1: Base confiável

Status: **em andamento**. Esta fase é pré-requisito para iniciar a Fase 2 (controle financeiro manual). O APK continua **candidato de testes**, não um produto bancário.

## Implementado e verificado no CI
- [x] Compilação Android automatizada com assinatura técnica verificada e SHA256 do APK.
- [x] Limites de memória do Gradle para compilar módulos Kotlin/Expo.
- [x] Identificação nativa `3.1.0`, com runtime OTA distinto da versão `0.2.0`.
- [x] Publicação OTA manual, sem instalar módulos nativos pela rede.
- [x] Guardião: histórico resumido em SecureStore, gravações e exclusões serializadas.
- [x] Proteção contra respostas atrasadas da consulta opcional de CNPJ; limite de espera.
- [x] Evidências não bancárias não autorizam confirmar beneficiário ou banco de boleto.
- [x] Ao alterar boleto, limpar contexto CNPJ anterior; botão para limpar campos e resultados da sessão.
- [x] Preferências de aparência com gravações ordenadas e avisos de erro de armazenamento.
- [x] Política de ciclo de vida para limpar campos temporários do Guardião e prévia de conversa ao sair das páginas ou colocar o app em segundo plano. Não bloqueia screenshots.
- [x] Testes unitários e verificação estática do aplicativo para as alterações acima.
- [x] Publicação de impressão digital pública do certificado de assinatura em APK-SIGNATURE.txt. **Isto não estabiliza a assinatura por si só.**
- [x] Pacote completo como artefato independente do GitHub Releases (APK, ZIP, SHA256 e impressão digital). Builds antigos são substituídos por execuções mais recentes na mesma branch; erros de permissão no Releases continuam visíveis.

## Ainda pendente para concluir a Fase 1
- [ ] **Homologação no Samsung:** executar [roteiro de QA da V3.1](ANDROID_QA_V3.1.md), registrar falhas e corrigi-las. Sem execução física não declarar aprovado.
- [ ] **Identidade de assinatura estável:** configurar keystore de distribuição administrado com segurança fora do Git, com segredos no GitHub Actions; confirmar atualização sobre APK anterior **sem perder dados**. Nunca publicar chave privada no repositório.
- [ ] **Autenticação e proteção local:** escolher e implementar bloqueio do app, recuperação e gestão de sessão compatíveis com Android. Não chamar o protótipo de aplicativo bancário seguro.
- [ ] **Ciclo de vida dos dados:** testar armazenamento, exclusão, backup/migração, integridade e recuperação após falhas.
- [ ] **Teste de exposição de dados e permissões:** garantir que informações pessoais não apareçam em logs, relatórios ou interfaces sem ação do usuário.
- [ ] **Modularização básica:** reduzir dependência do grande componente App.tsx sem quebrar navegação.
- [ ] **Critérios de aceite:** CI verde, APK da revisão final validado, testes do Samsung aprovados e pendências críticas P0 zeradas.

## Próximas fases, nesta ordem

1. **Fase 2:** controle financeiro manual e offline (receitas, despesas, categorias, parcelas, cartões, metas, relatórios) com armazenamento e testes locais.
2. **Fase 3:** assistente Negresco e agentes CTO/Guardião funcionais, com escopos e autorização do usuário.
3. **Fase 4:** backend e integrações bancárias apenas com provedores autorizados e auditoria.
4. **Fase 5:** refinamento visual, acessibilidade e lançamento progressivo.

> Não coletar credenciais financeiras reais nos testes. O Guardião ainda **não certifica boletos**; dígitos ou CNPJ consistentes não comprovam legitimidade.
