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
4. No APK **3.1.2**, o `expo-screen-capture` usa a proteção nativa de captura do Android nas telas do Guardião e enquanto a opção biométrica estiver ativa. **Ainda precisa de testes no Samsung**; PDFs já exportados, fotografias externas e aplicativos de terceiros não ficam protegidos por essa política. A revisão de caches continua pendente.
5. Não existe integração de chaves reais ao Android Keystore, `setAuthenticationRequired`, SQLCipher, WebAuthn, backend, tokens de banco ou fluxo Samsung Pass.
6. Alterações do módulo biométrico são **nativas**. Por isso o versionamento subiu para `3.1.1`/`versionCode 32` e requer novo APK; OTA para o runtime `3.1.0` não instala essa dependência.

## Segurança de concorrência entre prompts e segundo plano

Os prompts biométricos nativos podem produzir um estado Android `inactive` transitório. Enquanto um prompt controlado está em andamento, esse estado não é interpretado como abandono da aplicação; já `background` sempre revoga a autorização de interface. Um resultado de desbloqueio pendente é aceito apenas se a mesma tentativa ainda estiver vigente e o Android tiver retornado para `active`.

O diagnóstico SecureStore também descarta seu resultado visual se o usuário sair dos Ajustes ou colocar o app em segundo plano. A limpeza do marcador fictício continua sendo tratada pelo diagnóstico, mesmo quando seu resultado não pode mais ser exibido. O teste não cria autorização para usar chaves reais.

## Desativação biométrica interrompida (prévia)

Para reduzir o risco de desligamento inesperado após uma interrupção, o opt-out usa agora **dois registros persistentes** no AsyncStorage:

1. Primeiro grava o diário de operação `negresco.local_lock.optout.v1=pending`. Se existir, o início do app permanece bloqueado, **mesmo** com a preferência principal em `disabled`.
2. Depois escreve `disable-pending` e `disabled` na preferência principal. Interrupções ainda conservam o diário, então o aplicativo volta bloqueado.
3. Somente após revalidar a sessão tenta excluir o diário. A ausência dele permite respeitar a preferência `disabled`. Se a exclusão falhar ou a sessão for revogada, o app tenta recriar o diário e restaurar `enabled`.

Leituras de armazenamento e alterações simultâneas de preferência são isoladas. O diário é uma **mitigação de consistência**, não uma chave criptográfica ou confirmação de autenticação. Não se devem apagar manualmente as preferências do app.

**Risco residual:** AsyncStorage não garante transação atômica entre esses registros. Se o processo morrer **durante a exclusão final do diário** ou a perda de foco ocorrer no intervalo entre a validação e o término da exclusão, o marcador `disabled` ainda pode persistir sem o diário. A correção definitiva exige um serviço Android nativo que serialize autenticação, ciclo de vida e commit transacional. Este APK não o possui e não está homologado para dados financeiros reais.

## Homologação no Samsung

Usar apenas dados fictícios: verificar primeira abertura sem bloqueio, ativação mediante digital forte, reinício bloqueado, cancelamento, impressão errada, envio para segundo plano, retorno, bloqueio manual e desativação autenticada. Testar aparelho sem impressão cadastrada e reconhecer mensagem clara, sem abrir indevidamente após tentativas falhas.

## Próxima camada obrigatória

Implementar proteção hardware-backed **das chaves criptográficas**, com vínculo à sessão Android, alternativa de recuperação E2EE independente e um banco nativo SQLCipher. O [escopo exclusivo](decisions/0001-sqlcipher-zero-knowledge-negresco-only.md) pertence ao Negresco Finance e não envolve Security Black.

## Proteção de capturas 3.1.2

A regra de privacidade da tela foi isolada em `apps/mobile/components/ProtectedScreenCapture.tsx`. O Guardião fica protegido mesmo sem bloqueio biométrico; ativar a biometria protege também as outras telas. O módulo `expo-screen-capture` usa a sinalização nativa `FLAG_SECURE` no Android, mas não protege o arquivo PDF depois de compartilhado nem substitui autenticação/criptografia. A proteção ativa impede capturas de tela feitas para demonstrar a interface, motivo pelo qual os testes de UX devem usar telas sem dados sensíveis ou a permissão apropriada do próprio proprietário para versões sem proteção.
