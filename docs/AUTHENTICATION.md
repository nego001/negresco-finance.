# Autenticação Android e Samsung Pass

## Implementado nesta etapa
O módulo `packages/auth-core` fornece apenas regras puras de sessão, expiração, consentimento e autenticação reforçada (step-up). Não realiza autenticação biométrica, não emite sessão e não executa Pix. Os testes cobrem as regras de autorização.

## Integração Android planejada
1. Usar Android BiometricPrompt por API compatível no React Native, com opção de credencial do dispositivo conforme suporte. Biometria retorna confirmação local, nunca dados biométricos.
2. Usar Android Credential Manager para passkeys (WebAuthn/FIDO2) com desafio emitido por backend e validação de origem, RP ID, desafio e assinatura no servidor. O Samsung Pass pode ser provedor de credenciais conforme aparelho/configuração, mas não deve ser presumido.
3. Vincular sessão a identidade validada pelo servidor, aplicar expiração e revogação. Proteger tokens no Android Keystore, sem salvar senhas em texto claro.
4. Para operações sensíveis exigir autorização de backend, consentimento explícito, step-up recente e validações antifraude. O resultado de `authorizeSensitiveAction` não substitui controles do servidor.
5. Não incluir senha, PIN, segredo, chaves ou dados bancários reais em repositório público.

## Não implementado
BiometricPrompt nativo, Credential Manager, backend WebAuthn, tokens reais, armazenamento Keystore, integração com Samsung Pass e autenticação real de pagamentos.

## Ameaças e observações
O tempo informado pelo cliente pode ser manipulado. Sessões, consentimento e step-up devem ser atestados no backend em produção. Nunca confiar apenas em verificações de interface ou neste módulo de exemplo.
