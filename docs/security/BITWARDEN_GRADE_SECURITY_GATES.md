# Negresco Finance | Meta de segurança comparável ao Bitwarden

**Classificação: requisito de engenharia e plano de verificação. NÃO é uma certificação de segurança.**
**Estado em 2026-10-19: NÃO ATENDIDO. Bloquear divulgação de "nível Bitwarden" ou "superior" até validação independente.**

## Referências verificáveis

- Bitwarden descreve criptografia no cliente, cofre zero-knowledge, AES-256-CBC com HMAC-SHA-256, KDFs PBKDF2/Argon2id e auditorias externas regulares.
- OWASP MASVS 2.1+ / MASTG: armazenamento, criptografia, autenticação, rede, plataforma, código, resiliência e privacidade.
- Android Keystore/KeyMint: chaves não exportáveis quando suportadas pelo hardware, autorização de uso, StrongBox se disponível. Capacidade real depende do dispositivo.

Fontes:
- https://bitwarden.com/help/what-encryption-is-used/
- https://bitwarden.com/help/kdf-algorithms/
- https://bitwarden.com/help/is-bitwarden-audited/
- https://mas.owasp.org/MASVS/
- https://developer.android.com/privacy-and-security/keystore

## Modelo de ameaça mínimo (a completar antes de qualquer dado real)

Ativos: lançamentos financeiros, saldos, anexos, dados pessoais, tokens,
chaves de criptografia, backups, metadados, registros de acesso e preferências.
Adversários: pessoa com o telefone desbloqueado, dispositivo perdido, backup
copiado, app malicioso, tráfego interceptado, processo Android comprometido,
software adulterado, dependência comprometida e eventual servidor/sincronizador
malicioso. Diferenciar atacante com root ativo de roubo de arquivo offline:
nenhuma garantia geral de inviolabilidade num dispositivo totalmente controlado
pelo adversário.

## Regras de arquitetura e critérios de aceite obrigatórios

| Gate | Requisito verificável | Evidência exigida | Estado |
| --- | --- | --- | --- |
| G01 Inventário e ameaça | Fluxos de dados e dependências documentados; STRIDE por função crítica; hipóteses e riscos residuais | Threat model revisado independentemente | BLOQUEADO |
| G02 Criptografia em repouso | Dados reais, SQLite/WAL/journal, anexos, caches e exportações protegidos por AEAD moderno (ex.: AES-256-GCM) e/ou camada SQLCipher apropriada; nonce único por chave e contexto | Testes de dump offline, restauração e corrupção | BLOQUEADO |
| G03 Gerência de chaves | Chaves de dados aleatórias e envelopadas; segredo mestre nunca salvo em texto; chaves hardware-backed/StrongBox quando atestado suportado; rotação e indisponibilidade tratadas | Testes reais de KeyStore/KeyMint e troca de aparelho | BLOQUEADO |
| G04 Autorização criptográfica | Biometria forte autentica uso de chave via CryptoObject ou protocolo equivalente avaliado; não somente muda status UI | Testes Android de prompt, suspensão, revogação e troca de digitais | BLOQUEADO |
| G05 Resiliência transacional | Bloquear acesso e negar desativação não autorizada após onStop, kill, falha I/O, restore, corrida e interrupção entre persistências | Testes adversariais e revisão de linearizabilidade | BLOQUEADO |
| G06 Anti-rollback | Integridade autenticada + política de revisão e âncora de monotonicidade fora do arquivo restaurável, quando capacidade disponível; ausência de âncora documentada como limite explícito | Teste de replay entre reinícios/dispositivos | BLOQUEADO |
| G07 Senha mestra e recuperação | Se houver senha mestra: Argon2id com salt único e parâmetros aferidos por aparelho; mecanismo separado e seguro para recuperação, sem bypass de biometria | Vetores KDF, desempenho, recuperação/sem recuperação, acessibilidade | BLOQUEADO |
| G08 Cloud e zero-knowledge | **Somente se houver sincronização**: E2EE de verdade e chaves de conteúdo indisponíveis ao servidor; criptografia antes do upload; autenticação independente | Pentest do protocolo, conta multi-dispositivo e servidor hostil | NÃO APLICÁVEL ATÉ SYNC |
| G09 Segredos e privacidade | Limpeza de dados em logs, analytics, clipboard, screenshots, notificações, arquivos temporários e backups; política LGPD | Capturas de rede/log/backup e MASTG | BLOQUEADO |
| G10 Cadeia de suprimentos | Dependências e licenças auditadas, SBOM, verificação de assinatura da distribuição, CI com scanners, verificação de OTA e política de incidentes | SBOM, builds assinados e testes de atualização | BLOQUEADO |
| G11 Testes de segurança | Cobertura OWASP MASVS/MASTG, instrumentação Android, fuzzing de formatos, testes de falha e injeção, revisão independente | Relatório técnico reproduzível | BLOQUEADO |
| G12 Auditoria externa | Auditoria independente de código, criptografia e aplicação móvel, com correções e reteste; política responsável de reporte de falhas | Relatórios datados e escopo publicado | BLOQUEADO |
| G13 Compatibilidade | Migração do APK 3.1.2 sem perda de dados e sem trocar assinatura; rollback e backup seguro validados | Testes reais em aparelho e instalação limpa | BLOQUEADO |

## Política de versões e alegações de segurança

1. **Nunca converter testes JVM ou compilação Android em alegação de segurança equivalente ao Bitwarden.**
2. **Nunca implantar experimentalmente no APK atual, habilitar desativação nativa ou migrar dados reais sem G01 a G05, G09 e G13 aprovados.**
3. Reavaliar G06 a G12 antes de qualquer promessa de "proteção de cofre", sync ou produção financeira. Itens não aplicáveis devem receber justificativa rastreável.
4. Estado atual: laboratório Android/JVM isolado, biometria UI JavaScript da versão 3.1.2 continua separada e **não é criptografia do banco financeiro**. HMAC de registro é teste de integridade, não proteção de confidencialidade.
5. "Igual ou superior ao Bitwarden" é meta aspiracional, **não fato**, e depende de arquitetura implementada, escopo de ameaças comparável e auditoria externa que fundamente a comparação.

## Próximas entregas seguras

1. Testes JVM de integridade HMAC e compilação Android Keystore sintética, sem integração de arquivo nem ativação do APK.
2. Modelo de chaves/criptografia do banco e migração sem perda de dados, com revisão de especialistas antes de implementar.
3. Protótipo Android instrumentado com dados descartáveis: biometria, lifecycle, KeyStore, StrongBox quando suportado, troca de inscrição biométrica, recuperação e integridade.
4. Auditoria OWASP MASVS/MASTG e avaliação independente antes de chamar o sistema de pronto.

## Atualização do laboratório: AES-GCM por registro

Foi adicionado `FinancialRecordEnvelopeV1.kt` com AES-256-GCM sintético e um
adaptador Android Keystore `AndroidKeystoreFinancialEnvelopeLab.kt`. Seu
escopo é unicamente a cifragem autenticada de **conteúdo descartável** em
memória; a versão 3.1.2 não tem banco financeiro persistente e o protótipo
não está integrado no Expo. O laboratório usa uma chave sem exigência de
biometria, de propósito, para testar isoladamente o primitive AEAD. Ele
não satisfaz G02 (banco/WAL/backups), G03 (gerência completa de chaves),
G04 (CryptoObject), G06 (rollback confiável), G08 (E2EE) ou G12 (auditoria).
Nenhum gate mudou de BLOQUEADO para aprovado.

Ver `FINANCIAL_RECORD_ENVELOPE_LAB_V1.md` para riscos residuais e testes.
