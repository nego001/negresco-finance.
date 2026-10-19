# Negresco Finance

Aplicativo financeiro modular em desenvolvimento. **V3.1 é uma versão candidata para testes**, não um aplicativo bancário pronto para operações reais.

## Estado atual

- **APK Android V3.1:** o instalador é produzido pelo workflow [Android APK](.github/workflows/android-apk.yml), com checagem de assinatura e publicação em [Releases](https://github.com/nego001/negresco-finance./releases).
- **Guardião:** verificação matemática local de linhas digitáveis, histórico resumido no armazenamento seguro, PDF local e consulta **opcional** de CNPJ via BrasilAPI.
- **Interface:** tema OLED, preferências visuais e módulos de demonstração (Pix, Contas, Cartões, Metas, Investimentos e Negresco).
- **OTA:** fluxo de publicação manual; novas dependências Android exigem novo APK. A V3.1 usa runtime `3.1.0` para não receber atualizações destinadas a APKs `0.2.0`.
- **Integrações não disponíveis:** acesso bancário, pagamentos Pix reais, Reclame Aqui, classificação automática de fraude e IA conversacional remota.

> Uma linha digitável matematicamente correta e um CNPJ cadastrado **não comprovam a legitimidade de um boleto**. Não utilize o protótipo para decidir pagamentos ou enviar informações bancárias.

## Decisão de segurança e escopo

O banco **SQLCipher nativo** e a arquitetura **zero-knowledge** serão implementados **somente no Negresco Finance**, sem alterar nem depender do projeto Security Black. **Não estão ativos na V3.1**. A [decisão de arquitetura](docs/decisions/0001-sqlcipher-zero-knowledge-negresco-only.md) registra o compromisso e os requisitos verificáveis, preservando a ordem da [Fase 1](docs/PHASE1_BASELINE.md).

**Proteção local 3.1.1 (candidata):** bloqueio da interface por biometria forte, opcional em Ajustes, com bloqueio quando o app perde primeiro plano. Requer **novo APK nativo**, não funciona em builds `3.1.0` por OTA. Não equivale a Android Keystore protegendo chaves nem a SQLCipher. [Autenticação](docs/AUTHENTICATION.md) · [Teste no Samsung](docs/ANDROID_QA_V3.1.md).

## Componentes planejados

- **Negresco:** assistente pessoal personalizável.
- **CTO:** coordenação de agentes subordinada a permissões determinísticas.
- **Guardião:** segurança financeira e análise de evidências.
- **Especialistas:** Open Finance, Pix, Investimentos, Cartões, Metas e auditoria.

Esses agentes e integrações estão previstos na arquitetura, mas **não estão ativos** no APK atual.

## Testes

Requer Node.js 22 ou superior:

```bash
npm test
```

Para gerar o aplicativo Android, consulte [GitHub Actions](https://github.com/nego001/negresco-finance./actions). Um CI aprovado não substitui os testes em aparelho físico.

**Privacidade de captura no Android 3.1.2:** Guardião e sessões com biometria ativa não devem aparecer em prints, gravações ou prévias dos aplicativos recentes. Depende de novo APK nativo e de validação no Samsung; não protege PDFs já exportados.

**Diagnóstico experimental Android Keystore:** opção manual em Ajustes para testar gravação, leitura autenticada e limpeza de um marcador fictício via SecureStore. Não usa chaves financeiras reais nem prova segurança criptográfica do futuro SQLCipher. Teste ainda **não executado no Samsung**.

**Checagem não destrutiva de atualização:** a [ferramenta Windows](docs/ANDROID_UPGRADE_PREFLIGHT.md) pode comparar a assinatura e a versão do APK baixado com o aplicativo já instalado no Samsung antes de tentar atualizar. Exige Android SDK e validação local; não instala o APK nem comprova recuperação dos dados.

**Assinatura Android:** os APKs automáticos continuam Debug. A [configuração opcional de assinatura permanente](docs/ANDROID_SIGNING_V3_1.md) foi preparada, mas sua chave e a migração segura ainda não foram validadas.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)

**Segurança:** não adicione credenciais bancárias, senhas, tokens nem outros segredos ao repositório.
