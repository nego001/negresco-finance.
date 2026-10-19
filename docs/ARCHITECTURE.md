# Arquitetura inicial

O aplicativo **React Native + TypeScript (Expo)** já possui uma versão Android **V3.1 candidata**. A API NestJS continua planejada e não existe backend financeiro funcional.

## Agentes
Negresco é a interface conversacional. CTO coordena solicitações. Guardião avalia riscos de segurança. Especialistas: Open Finance, Pix, investimentos, cartões, metas e auditoria.

Delegações exigem sessão válida, escopos concedidos e aprovação por políticas determinísticas. Nenhum agente pode executar Pix ou investimentos autonomamente.

## Módulos
Habilitados: IA, Open Finance, Pix, Investimentos, Cartões, Metas. Os demais ficam opcionais.

## Voz
Identidade feminina seleciona voz feminina; masculina seleciona masculina; neutra seleciona neutra quando disponível.

## Estado
Há APK candidato, Guardião com validação matemática local, preferências e histórico limitado; ainda **sem SQLCipher nativo**, banco financeiro persistente, backend funcional ou integrações bancárias reais. O [ADR 0001](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md) define SQLCipher/E2EE **exclusivos do Negresco Finance**, sem alterar o Security Black.
