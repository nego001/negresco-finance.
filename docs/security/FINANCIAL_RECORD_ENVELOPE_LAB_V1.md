# Negresco Finance | Envelope AEAD de registros financeiros (laboratório)

**Status: PROTÓTIPO ISOLADO, NÃO AUTORIZADO PARA DADOS REAIS.**
**Não é SQLCipher, não constitui E2EE de produção, não integra a versão 3.1.2 e não atinge os gates de segurança comparável ao Bitwarden.**

## Constatação do estado atual (outubro/2026)

A versão Expo 3.1.2 não possui banco financeiro persistente, contas bancárias conectadas ou transações reais. O saldo da tela inicial ainda aparece como indisponível. As preferências de aparência ficam no AsyncStorage, o histórico mínimo de metadados do Guardião usa Expo SecureStore, e o bloqueio biométrico da interface usa AsyncStorage + LocalAuthentication. Nenhuma dessas camadas é um banco SQLCipher protegido por chave criptográfica de dados.

Consequentemente, **não existe banco financeiro a criptografar em uma instalação atual**. Antes de adicionar transações financeiras, criar e auditar a persistência nativa conforme o ADR 0001, sem migração automática de dados desconhecidos.

## Contratos implementados no laboratório

- `tooling/native-lock-spike/.../FinancialRecordEnvelopeV1.kt`: envelope binário com cabeçalho e versão exatos, identificador de chave limitado, **AES-256-GCM** (nonce de 96 bits gerado pelo provedor, tag de 128 bits) e limite de 1 MiB de registro sintético.
- AAD inclui domínio `negresco.finance.record.aead.v1`, versão, identificador de chave, tipo, identificador lógico e revisão. Destinatário deve conhecer independentemente o tipo/ID/revisão esperados; esses campos não são aceitos apenas porque aparecem no envelope.
- Decifragem sem fallback plaintext. Chave ausente, formato desconhecido, contextos divergentes, tag adulterada e material incompleto são falhas.
- `tooling/native-lock-android-lab/.../AndroidKeystoreFinancialEnvelopeLab.kt`: chave **AES-256-GCM AndroidKeyStore** independente de HMAC e SQLCipher, com provisionamento explícito apenas para dados sintéticos, sem geração no caminho de decifragem.
- `FinancialRecordEnvelopeV1Test.kt`: 23 cenários JVM sintéticos, incluindo falsificação de contexto, nonce alterado, truncamento, tipo/ID/revisão incorretos, identificador de chave alterado e replay válido.

## O que esse protótipo NÃO oferece

1. **Não criptografa SQLite/SQLCipher, WAL, índices, PDFs, imagens, caches nem backups reais.** O envelope é uma unidade de conteúdo para registros, não um banco.
2. **Não vincula chave Keystore à biometria.** A chave Android usada aqui foi gerada especificamente sem exigência de autenticação do usuário para isolar o teste de AEAD. Ela não pode virar chave de produção por simples configuração.
3. **Não bloqueia replay entre reinicializações** quando atacante restaura envelope + revisão antiga corretamente autenticada. É necessária uma âncora confiável de versão/transação fora dos dados restauráveis, projetada e validada separadamente.
4. **Não constitui recuperação entre dispositivos.** Perder a chave Keystore significa falha de decifragem. Não apagar registros, recriar a chave nem afirmar recuperação automática.
5. **Não oferece zero-knowledge de servidor.** Não há protocolo de sincronização nem identidade de dispositivo, derivação ou gerenciamento de chaves E2EE.
6. **Não garante unicidade absoluta de nonce por conta própria.** A implementação exige nonce gerado pelo provedor em cada chamada; qualquer política de rotação, colisão, backup ou uso maciço por chave requer limites definidos e auditoria.
7. **Não autentica validade financeira da transação.** AEAD impede modificação criptográfica não detectada, mas não valida saldo, autorização bancária ou fraude.

## Separação futura de chaves

- `sqlcipher-page`: chave aleatória exclusiva para banco de páginas SQLCipher, envolvida por componente Keystore/recuperação próprio.
- `e2ee-root`: chave raiz independente da página SQLCipher, com derivação de subchaves por domínio/registro usando KDF auditada.
- `offline-recovery-wrap`: chave e protocolo de recuperação offline separados, para exportação/importação autenticada e consentida.
- `lab-financial-aead-v1`: **alias sintético e descartável** deste protótipo, proibido para qualquer valor real.

O banco SQLCipher e o envelope devem ser **duas camadas distintas**. Não reutilizar a mesma chave em Keystore/HMAC, SQLCipher, backup e registro. Não exportar chaves nem logs de conteúdo em claro. O schema, manifest de versões, transação de migração e políticas de exclusão ainda requerem projeto próprio.

## Gates técnicos ainda bloqueados

- [ ] Integração independente SQLCipher nativa com build reproduzível e inventário de bibliotecas/licenças.
- [ ] Planejamento de hierarquia de chaves e provisionamento autenticado por `BiometricPrompt.CryptoObject` ou mecanismo equivalente auditado.
- [ ] Criptografia ponta a ponta de verdade, derivação de chaves separadas e isolamento de backend.
- [ ] Armazenamento somente cifrado incluindo WAL, cache, anexos, exportação e backup.
- [ ] Anti-rollback entre processos e dispositivos, revisão monotônica verificável e recuperação segura.
- [ ] Testes instrumentados Android com APK assinado, Samsung e perda/troca de biometria.
- [ ] Auditoria independente, reexecução dos testes e evidências OWASP MASVS/MASTG.

**Conclusão:** esta etapa implementa apenas o envelope AEAD sintético e um adaptador Keystore experimental. Não incorporar `AndroidKeystoreFinancialEnvelopeLab` ao APK atual e não armazenar dados financeiros no laboratório.

Referências internas: `docs/decisions/0001-sqlcipher-zero-knowledge-negresco-only.md`, `docs/security/SQLCIPHER_ZERO_KNOWLEDGE_GATE.md`, `docs/security/KEY_LIFECYCLE_V1.md` e `docs/security/BITWARDEN_GRADE_SECURITY_GATES.md`.
