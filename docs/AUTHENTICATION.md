# Negresco Finance | Autenticação Android

**Estado atual:** bloqueio **opcional da interface** por biometria forte, em código no APK candidato `3.1.1`. Necessita validação no Samsung. **Não é criptografia de dados nem autenticação bancária**.

## Implementado em código

- Módulo `expo-local-authentication` com autenticação nativa Android via BiometricPrompt.
- Preferência de habilitação em AsyncStorage (apenas marcador `enabled`, nenhuma senha/chave biométrica).
- Primeira ativação e desativação exigem resposta positiva de biometria **forte** e cadastrada.
- App habilitado inicia bloqueado, só exibe a interface após autenticação; sem fallback automático de PIN ou biometria fraca.
- Ao perder primeiro plano, volta à tela de bloqueio e descarta autenticações anteriores. Erro na leitura da preferência falha fechado em tela de recuperação/retry.
- `apps/mobile/security/localLockPolicy.ts` contém regras unitárias de privacidade, força biométrica e validade de sessão de interface.

## Diagnóstico experimental de armazenamento autenticado

Na tela Ajustes, depois de ativar e desbloquear a proteção da interface, é possível executar **Testar proteção do Keystore**. Usa o módulo já integrado `expo-secure-store` no Android com `requireAuthentication: true` para escrever e ler **somente um marcador fictício**, depois tenta apagá-lo. Esse teste é manual e a confirmação exige o Samsung real. Cancelamento, falha de leitura e falha na exclusão não geram aprovação.

**Escopo:** o diagnóstico verifica o caminho de armazenamento autenticado do SDK, não a existência de hardware StrongBox, chaves E2EE, banco SQLCipher, backup nem proteção contra aparelho comprometido. Mudar as digitais pode invalidar entradas autenticadas, e dados do Android SecureStore não sobrevivem a desinstalações. 

## Limites fundamentais

1. O marcador em AsyncStorage pode ser adulterado em aparelho comprometido. **Não é barreira criptográfica.**
2. A preferência vem **desativada por padrão** para não bloquear instalações existentes. Somente o usuário ativa em Ajustes.
3. Se a biometria forte for removida depois da ativação, o bloqueio não pode ser contornado pelo aplicativo. Uma recuperação segura dos dados ainda não existe: **não desinstalar sem plano de recuperação**.
4. Troca de telas e segundo plano não apagam PDFs já exportados e não garantem ausência de dados na captura de aplicativos recentes. Ainda falta política nativa de `FLAG_SECURE` e revisão de caches.
5. Não existe integração de chaves reais ao Android Keystore, `setAuthenticationRequired`, SQLCipher, WebAuthn, backend, tokens de banco ou fluxo Samsung Pass.
6. Alterações do módulo biométrico são **nativas**. Por isso o versionamento subiu para `3.1.1`/`versionCode 32` e requer novo APK; OTA para o runtime `3.1.0` não instala essa dependência.

## Homologação no Samsung

Usar apenas dados fictícios: verificar primeira abertura sem bloqueio, ativação mediante digital forte, reinício bloqueado, cancelamento, impressão errada, envio para segundo plano, retorno, bloqueio manual e desativação autenticada. Testar aparelho sem impressão cadastrada e reconhecer mensagem clara, sem abrir indevidamente após tentativas falhas.

## Próxima camada obrigatória

Implementar proteção hardware-backed **das chaves criptográficas**, com vínculo à sessão Android, alternativa de recuperação E2EE independente e um banco nativo SQLCipher. O [escopo exclusivo](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md) pertence ao Negresco Finance e não envolve Security Black.
