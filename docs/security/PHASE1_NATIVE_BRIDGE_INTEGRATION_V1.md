# Negresco Finance | Fase 1: fronteira da integração nativa com Expo

**Status em 22/10/2026:** diagnóstico integrado na tela Ajustes do código-fonte Android/Expo; **NÃO** existem chaves financeiras, banco SQLCipher operacional, módulo Kotlin autolinkado ou release seguro. Sem autorização para dados reais, merge ou atualização de APK. PR #14 continua em draft.

## Mudança efetivamente realizada nesta revisão

- `apps/mobile/security/nativeFinanceReadiness.ts` introduz inspeção manual e somente leitura de uma eventual interface diagnóstica `NativeModules.NegrescoFinanceSecurityV1.getIntegrationInfo()`.
- `apps/mobile/App.tsx` inclui botão em **Ajustes → Segurança financeira nativa**. A inspeção ocorre apenas depois do toque do usuário, sem argumentos financeiros. Ausência do módulo é exibida claramente, não interpretada como proteção.
- O resultado do host é **descartado**: mesmo que ele alegue `ready`, `VERIFIED_LIVE_CURRENT`, KeyStore ou SQLCipher, todas as saídas retornam `financialStorageAllowed=false`, `keyReleaseAllowed=false`, `migrationAllowed=false`. Erro ou host ausente também fecham.
- Respostas assíncronas após saída de Ajustes ou background são ignoradas por uma época local. Nenhuma operação de segurança toma decisão com base nesse valor JS.
- `tests/native-finance-readiness.test.mjs` cobre ausência, plataformas diferentes, host falso, exceções e isolamento da UI.
- **Não há um módulo Android real implementando esse método nesta revisão.** A interface é um ponto de diagnóstico explícito para futura integração, e não um controle criptográfico, de acesso, de biometria ou cofre.

## Tratamento de falhas na consulta diagnóstica

A inspeção manual do módulo opcional agora possui **limite máximo de cinco segundos** e captura também falhas ao consultar a propriedade `getIntegrationInfo` em objetos hostis ou proxies JS. Exceção nativa, getter que lança erro, promessa que nunca resolve e resposta atrasada **não** concedem acesso: `financialStorageAllowed=false`, `keyReleaseAllowed=false` e `migrationAllowed=false` permanecem fixos. Erros internos não mostram mensagens potencialmente sensíveis na UI.

A expiração encerra apenas a **espera da interface**; não cancela nem reverte uma operação Kotlin. Isso é aceitável aqui somente porque a futura interface `getIntegrationInfo` está contratualmente limitada a diagnóstico **sem mutação**. O módulo nativo real deverá ter cancelamento/ciclo de vida próprios e nunca reutilizar esse resultado como autorização de chave ou banco. Testes regressivos específicos estão em `tests/native-finance-readiness.test.mjs`. Nenhum binário nativo novo foi conectado nesta revisão.

## Interface futura mínima (NÃO DISPONÍVEL)

A próxima implementação real deve usar um módulo local Expo Kotlin **identificado por versão** e registrado apenas depois de cumprir os gates abaixo. A superfície JS deve ser mínima:

| Operação | Resultado para JS | Autoridade |
| --- | --- | --- |
| `getIntegrationInfo()` | Diagnóstico de versão/instalação, somente informativo | Não pode habilitar banco/chaves; resposta não confiável |
| `readPublicLockPresentation()` (eventual) | Estado de UI sem segredo, sem capability de autenticação | Nativo DataStore é fonte de verdade; JS apenas desenha |
| `requestUnlock()` (futuro e condicionado) | UI pode pedir operação, mas nunca fornecer `authenticated=true` | BiometricPrompt/CryptoObject e sessão/KeyStore nativos |
| `requestDisable()` (futuro e condicionado) | Não expor enquanto opt-out transacional não for comprovado | Atualmente `disable()` deve permanecer DENIED |
| Acesso à base financeira (futuro) | Somente comandos de negócio limitados e autorizados | Chave e banco permanecem exclusivamente no processo nativo, sem API `getKey` |

**Proibido:** método JS `unlockWithBoolean`, `forceDisable`, chave da base em memória JS, fallback para AsyncStorage/SQLite comum, re-enrollment automático após corrupção, recuperação por alegação de assinatura/nonce de fixture ou leitura do banco em claro sem autorização nativa.

## Dependências concretas antes de conectar Kotlin ao produto

1. **Compilar módulo local Expo para Android**, em projeto específico do app e com versionamento/compatibilidade ABI; manter `tooling/native-lock-android-lab` e `tooling/sqlcipher-android-lab` como fixtures separadas.
2. **Autenticação e opt-out**: integrar DataStore e BiometricPrompt à Activity, controlar background/restart, autenticação por operação e revogação; concluir fluxo de desativação sem lacuna de commit. NUNCA usar retorno de login visual como chave de dados.
3. **Proteção criptográfica**: gerar e envelopar chave SQLCipher separada com Android Keystore; testar CryptoObject, mudança de biometria, perda de chave, fallback e política de backup.
4. **Banco financeiro**: SQLCipher real dentro do app, chave errada/ausente não cria banco novo, integridade WAL, esquema/migrações e operação offline com dados sintéticos.
5. **Assinatura e migração**: identidade de assinatura permanente, pré-verificação de APK existente, preservação de preferências/Guardião e plano de recuperação antes de trocar o binário. APK atual é Debug e não pode receber atualização se certificados forem incompatíveis.
6. **QA/auditoria**: testes CI Kotlin/Node/emulador **e** Samsung físico com consentimento e dados fictícios, ameaças, privacy/logs, auditoria de dependências. Guardar evidência do commit, certificado e modelo testado.

**Critério de saída:** só chamar “integrado” quando existir binário compilado, instalação homologada, chaves, banco e regras de autenticação nativas validadas. A nova UI diagnóstica isolada não satisfaz nenhum dos gates de criptografia ou release.

## Próxima entrega de código recomendada

Extrair interfaces nativas testáveis de `tooling/native-lock-android-lab` para um módulo local Expo **desabilitado por padrão**, começar pelo caminho de leitura do DataStore e diagnósticos, e implementar o ciclo de vida/opt-out com testes instrumentados antes de criar métodos para manipular bancos. Não publicar APK, não mesclar PR #14 nem tocar na PR #17 até confirmação do usuário e revisão específica.
