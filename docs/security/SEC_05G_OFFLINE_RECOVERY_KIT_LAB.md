# SEC-05G | Kit de recuperação criptográfica offline (laboratório)

**Data:** 21/10/2026  
**Trilha:** SEC-05, confiança de dispositivos e continuidade E2EE. SEC-06 permanece Modo Proteção Máxima.  
**Branch:** `release/3.1.3-security-preview` / PR #14 em rascunho.  
**Status:** **PRODUÇÃO BLOQUEADA**; não gerar APK, não instalar no celular, não criar conta ou backup real.

> Este é apenas um laboratório Kotlin/JVM com chaves de dados descartáveis. Nenhuma conta ou identidade é autenticada, nenhum dispositivo é cadastrado, nenhuma operação financeira é autorizada e nenhuma interface de exportação ao usuário existe. O código não integra o Expo, SQLCipher real, servidor nem Keystore Android.

## Problema e separação de responsabilidades

Na perda total de aparelhos, comprovar a identidade da pessoa perante uma autoridade externa (SEC-05F) não reconstitui, sozinho, a chave E2EE de dados. O SEC-05G demonstra **um material de recuperação previamente provisionado**: um segredo de alta entropia que permite decifrar, de forma offline, uma cópia protegida da chave de dados.

As duas camadas são independentes:

- **Autenticação e matrícula:** titular, revisão antifraude, autorização do novo dispositivo, revogação, geração de conta, auditoria e transação de servidor. O kit **não é uma prova de identidade** e nunca fornece matrícula.
- **Criptografia offline do material de recuperação:** portador da cópia cifrada e do segredo aleatório consegue tecnicamente decifrar a chave de dados referente àquele envelope. **Esse poder de decifração não pode ser revogado retroativamente** se o segredo e o ciphertext antigos já foram copiados.

Esse último limite é fundamental: o kit **não** substitui login, biometria ou decisão de uma autoridade. Por outro lado, não seria honesto afirmar que um servidor consegue impedir a decifração offline de dados antigos por quem já tem o segredo e o backup. Somente **nova chave de dados + recriptografia + interrupção de distribuição de backups antigos** mitiga futuros vazamentos; cópias antigas continuam potencialmente acessíveis.

## Criptografia exercitada no laboratório

Arquivo: `tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticOfflineRecoveryKitLab.kt`.

| Parâmetro | Laboratório |
| --- | --- |
| Segredo do kit | 32 bytes (256 bits) de `SecureRandom`; não aceita PIN/senha humana curta |
| Salt | 32 bytes novos por kit |
| Derivação | HKDF `HmacSHA256`, extract/expand conforme RFC 5869, domínio próprio v1 |
| Cifra | `AES/GCM/NoPadding`, chave de 256 bits, nonce novo de 12 bytes, tag de 128 bits |
| Chave de dados protegida | Apenas 32 bytes de DEK sintética, nunca chaves bancárias reais |
| AAD autenticado | Domínio e versão, conta opaca, UUID canônico do kit, versão da chave, geração do titular, salt e nonce |
| Envio/armazenamento | **Não implementado**. Não imprime o segredo; objetos usam cópias defensivas e `toString` censurado |
| Autenticação | **Nenhuma**. Descriptografar o envelope não prova titularidade |

O método `sealFixtureOnly` cria um segredo aleatório descartável e um envelope autenticado. `recoverDataKeyFixtureOnly` decifra **somente em laboratório**, se o segredo original e todos os campos corresponderem. A interface `SyntheticRecoveredDataKeyFixtureOnly` explicita que retornar bytes não é login, desbloqueio ou privilégio.

Testes de alteração de conta, UUID, geração, versão, salt, nonce, ciphertext e tag rejeitam envelopes adulterados. Salt e nonce são componentes públicos; sua autenticação pelo AAD e AEAD impede substituição silenciosa. A implementação zera alguns buffers temporários como defesa em profundidade, mas **a JVM não garante eliminação completa de cópias da memória**.

## Rotação, revogação e riscos

`SyntheticRecoveryKitRegistryLab` é **um registro volátil de metadados, não um servidor**. Ele distingue kit vigente, kit revogado e geração obsoleta, modelando rotação e invalidação. Seu retorno `ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION` não autoriza nada.

O experimento demonstra que:

1. Um kit substituído é considerado revogado **pela fixture**.
2. Quando a geração avança, o kit corrente é invalidado pela fixture.
3. **Um segredo e envelope antigos ainda podem decifrar a antiga DEK offline**, apesar da revogação registrada. Isso precisa aparecer em UX, arquitetura, auditoria e modelo de ameaças.
4. O vazamento do segredo do kit pode permitir acesso offline ao material criptográfico antigo, independentemente da senha da conta. O kit deve ser protegido como chave sensível de alto valor.
5. Se o titular perde tanto os dispositivos quanto **todas as cópias válidas do kit**, sem outro método E2EE previamente provisionado, não existe procedimento legítimo para recuperar matematicamente os dados cifrados.

**Não usar** um código de seis dígitos, OTP, PIN ou senha humana como substituto dos 256 bits: HKDF não protege uma senha de baixa entropia contra ataques offline. Um sistema de passphrase exigiria projeto distinto com KDF memory-hard (ex.: Argon2id), parâmetros auditados, limites e avaliação específica. Isso não foi implementado.

## Testes do SEC-05G

`SyntheticOfflineRecoveryKitLabTest.kt` contém 37 grupos de verificações de cifra, integridade, copy-defense, adulterações, erros de segredo, segregação entre contas, versão/epoch, registro, rotação, revogação offline e oito recuperações simultâneas. Integrado a `policyCheck` da JVM. O contrato `tests/security-offline-recovery-kit-contract.test.mjs` impede integração acidental na aplicação móvel e exige documentação explícita dos bloqueios de produção.

Só considerar a fase validada após execução real da CI do commit correspondente. Não interpretar o sucesso da CI como auditoria criptográfica independente.

## Portões antes de produção

- Cerimônia de **criação, exportação e confirmação** do kit com formato legível e checksum, exigência de armazenagem offline, proteção visual e educação sobre perda do kit.
- Proteção de screenshots, clipboard, notificações e armazenamento, com acessibilidade e instruções de backup fisicamente separadas; avaliar ameaça de exfiltração. Nunca mandar segredo para logs, analytics ou servidor desnecessariamente.
- Integração com Android Keystore e arquitetura real de envelope/backup, separando contas, datasets e versões sem copiar chaves financeiras para o backend.
- Autenticação forte real do titular, fluxos de recuperação por autoridade independente do aparelho, atestação e revogação de sessões. Não confundir sucesso da cifra com aprovação do dispositivo.
- Registro central durável e autenticação de recibos/gerações, tratamento de rollback de backup, troca de DEK e recriptografia do material comprometido.
- Resistência a ataques de cópia de backups antigos, armazenamento vulnerável, canais de suporte, coação, perda de todos os fatores e vazamento do kit.
- Revisão criptográfica e pentest independentes, teste Android físico e backup/restauração sem dados reais durante o desenvolvimento.

**Resultado pretendido:** recuperar um **segredo de dados de teste**, nunca uma autorização de conta. SEC-05 continua **BLOQUEADO** em produção.
