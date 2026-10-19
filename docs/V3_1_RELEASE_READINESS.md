# Negresco Finance V3.1 | Estado de entrega e segurança

**Status: CANDIDATO DE TESTES.** O aplicativo ainda não foi homologado em Samsung real nesta etapa e não é adequado a pagamentos, acesso bancário ou armazenamento de credenciais reais.

## Entregue em código e CI

- APK Android Expo/React Native `com.negresco.finance`, `3.1.0` (`versionCode 31`), com atualização OTA manual em canal `preview`.
- Interface OLED, navegação e preferências visuais locais.
- Guardião com inspeção **matemática** de linhas digitáveis, histórico resumido em SecureStore, PDF local e CNPJ **opcional** por BrasilAPI.
- Mapa de evidências com fontes explícitas, resultados inconclusivos e limites de consulta bancária.
- Proteção de dados temporários ao sair de páginas ou colocar o app em segundo plano; **ainda não bloqueia screenshots nem autentica o usuário**.
- Android Auto Backup desativado temporariamente. **Desinstalação pode causar perda permanente do histórico e das preferências**.
- CI, TypeScript e geração de APK automatizados; hash SHA-256 do APK e identificação pública do certificado.
- Fluxo **opt-in** de assinatura Android persistente implementado, mas **sem chave configurada e sem teste de atualização no aparelho**. Por padrão o APK continua com certificado Android Debug.

## Pendências obrigatórias da Fase 1

1. Homologar no Samsung todos os cenários do [roteiro Android](ANDROID_QA_V3.1.md).
2. Provisionar chave Android permanente em ambiente seguro e seguir [procedimento de assinatura](ANDROID_SIGNING_V3_1.md). Comparar certificados e `versionCode` antes de qualquer atualização.
3. Implementar bloqueio local real, Android Keystore, política de recuperação e migração sem perder dados.
4. Implementar e testar **SQLCipher nativo e arquitetura zero-knowledge exclusivamente neste repositório**, cumprindo [ADR 0001](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md) e os [gates de segurança](security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md). Não modificar o Security Black para cumprir esse requisito.
5. Validar comportamento offline, falha de armazenamento, privacidade, estabilidade e ausência de exposição de dados reais.

## O que ainda não está disponível

- Pagamentos Pix reais, Open Finance, monitoramento bancário, Reclame Aqui e consultas diretas à Receita Federal.
- IA Negresco/CTO remota funcional, voz conversacional e ações bancárias.
- SQLCipher nativo ativo, sincronização zero-knowledge, recuperação segura de chave ou autenticação biométrica.
- Assinatura Android de distribuição validada, testes de migração e auditoria de segurança independente.

## Critério para anunciar V3.1 homologada

**Não basta CI verde.** É indispensável testar APK e atualização no Samsung, registrar resultados, preservar dados, verificar assinatura e resolver pendências críticas. O Guardião matematicamente consistente não autentica boletos.
