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

**Assinatura Android:** os APKs automáticos continuam Debug. A [configuração opcional de assinatura permanente](docs/ANDROID_SIGNING_V3_1.md) foi preparada, mas sua chave e a migração segura ainda não foram validadas.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)

**Segurança:** não adicione credenciais bancárias, senhas, tokens nem outros segredos ao repositório.
