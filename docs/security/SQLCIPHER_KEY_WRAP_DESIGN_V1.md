# Negresco Finance | Design de chave SQLCipher e Android Keystore (somente planejamento)

**Status: NÃO IMPLEMENTADO. Não habilita armazenamento financeiro de produção, biometria nativa nem recuperação.**
**Escopo:** Negresco Finance, sem tocar no Security Black ou APK 3.1.2.

## Separação obrigatória das chaves

| Material | Responsabilidade | Local permitido |
| --- | --- | --- |
| `sqlcipher-page-v1` | Segredo aleatório de 256 bits exclusivo do banco SQLCipher; nunca derivado da biometria | Em memória nativa somente durante sessão autorizada; em disco exclusivamente envelopado |
| `keystore-sqlcipher-wrap-v1` | Chave AES-GCM não exportável que envolve o segredo do banco | Android Keystore/KeyMint, com autorização forte por operação antes de uso de produção |
| `e2ee-root-v1` | Hierarquia independente para registros, anexos e sincronização E2EE futura | Gerência de chaves e recuperação próprias; jamais reutilizar a chave SQLCipher |
| `hmac-lock-integrity-lab` | Autenticação de registro de configuração experimental | Apenas laboratório, sem acesso à chave de banco |
| `lab-only-* ` | Dados sintéticos dos testes atuais | Emulador descartável, sem promover alias ou material para produção |

**Não gravar chave do banco em AsyncStorage, SecureStore sem revisão, SharedPreferences, SQL, Logcat, JavaScript, analytics, clipboard ou backups plaintext.** Não usar o texto da senha do usuário, PIN ou dados biométricos diretamente como segredo SQLCipher.

## Fluxo de criação proposto (ainda não executado)

1. Receber autorização nativa explícita do usuário para criar armazenamento financeiro; não criar banco durante simples leitura.
2. Gerar segredo `sqlcipher-page-v1` com CSPRNG nativo, com verificação da fonte/entropia; nunca reutilizar chave AES-GCM do laboratório de registros.
3. Provisionar uma chave `keystore-sqlcipher-wrap-v1` específica para envelopamento de chave, com requisitos `BIOMETRIC_STRONG` por operação, invalidação e disponibilidade avaliados no hardware real. `CryptoObject` deve vincular o uso criptográfico à sessão de biometria, não apenas retornar Boolean.
4. Envelopar o segredo SQLCipher usando AEAD com IV aleatório único, tag autenticada, domínio, versão, ID do banco e metadados verificados como AAD.
5. Preparar banco nativo criptografado usando o segredo temporário, validar `cipher_version`, `cipher_integrity_check` e `integrity_check`, e escrever manifesto de versão por transação. Não confundir `byte[]` passphrase com modo raw-key de SQLCipher sem avaliação.
6. Fazer publicação atômica do manifesto/chave envelopada e do banco; falhas em qualquer ponto mantêm o estado como **não inicializado**, sem abrir plaintext e sem apagar dados anteriores.
7. Limpar buffers que o processo controla, fechar handles SQLCipher ao sair da sessão e revogar operações pendentes ao mudar o ciclo de vida da Activity. A zeroização de toda a memória não pode ser prometida em JVM/Android.

## Fluxo de abertura proposto

- Bloquear UI e acesso aos dados enquanto não houver autorização criptográfica nativa vigente.
- Ler e validar o envelope/manifesto **sem** gerar ou substituir chaves ausentes.
- Após BiometricPrompt com operação vinculada a chave Keystore, desenvolver apenas em memória nativa o segredo SQLCipher; nunca expô-lo por ponte genérica JavaScript.
- Reabrir com SQLCipher nativo e executar leitura autenticada e verificações de integridade.
- Se falhar autenticador, chave, tag, revisão, WAL ou I/O: **não** criar outro banco, **não** migrar automaticamente, **não** voltar para SQLite comum, **não** desbloquear.
- A restauração de um manifesto antigo corretamente autenticado requer política adicional de anti-rollback entre processos. AEAD/Keystore sozinhos não solucionam replay.

## Gestão de recuperação

- Chave atrelada ao dispositivo pode tornar dados irrecuperáveis após troca/restauração, alteração de biometria ou perda de Keystore. Esse risco deve ser assumido e tratado **antes** de migrar dados.
- Recuperação offline deverá ser criptografada, independente, autenticada e testada por outra rota; não rebaixar `BIOMETRIC_STRONG` de forma oculta, não criar backdoor no backend.
- Separar controles da autenticação de sessão, cifragem em repouso, E2EE e exportação/backup, com revisão de modelo de ameaça.
- Nunca afirmar garantia de hardware-backed/StrongBox a partir de testes JVM, emulador, `getKey()` ou existência de Keystore: requer consulta e atestação conforme capacidade real do Samsung.

## Plano de provas ainda bloqueado

- [ ] Implementação nativa de envelopamento de chave de banco com chave Keystore distinta.
- [ ] Prova de uso de chave por `BiometricPrompt.CryptoObject`, incluindo cancelamento, `onStop`, biometria alterada e revogação.
- [ ] Testes instrumentados de envelope adulterado, chave removida/inválida, perda de energia simulada, boot e abertura concorrente.
- [ ] Crash-consistency do manifesto contra SQLCipher: jamais deixar estado sem chave com banco existente, nem publicar versão errada.
- [ ] Recuperação entre dispositivos sem exposição de segredos e sem apagar dados instalados.
- [ ] Inventário de bibliotecas, SBOM, licenças, Android 16 KiB, assinaturas e auditoria externa.
- [ ] Teste físico no Samsung com dados exclusivamente descartáveis e autorização explícita.

## Evidência já disponível, não suficiente para produção

O laboratório SQLCipher separado já compilou e teve **12/12 casos nativos no emulador** aprovados em revisão anterior. Foi adicionado um teste **13º** de `killProcess` de subprocesso privado durante WAL não confirmado; **não contar como aprovado até seu CI de emulador concluir**. Esse laboratório usa senha sintética fixa e não tem chave Keystore vinculada à biometria.

Referências: `docs/security/KEY_LIFECYCLE_V1.md`, `docs/security/BITWARDEN_GRADE_SECURITY_GATES.md`, `docs/security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md`, ADR 0001.

Documentação oficial Android: https://developer.android.com/privacy-and-security/keystore e https://developer.android.com/reference/android/hardware/biometrics/BiometricPrompt.CryptoObject
