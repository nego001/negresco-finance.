# SEC-05I | Cerimônia de confirmação do kit de recuperação

**Data:** 21/10/2026  
**Módulo:** SEC-05, recuperação criptográfica de dados no Negresco Finance. SEC-06 continua Modo Proteção Máxima.  
**Branch:** `release/3.1.3-security-preview` (PR #14 em rascunho).  
**Estado:** somente laboratório Kotlin/JVM, sem backend, UI, APK ou dados financeiros reais.

> **NÃO é um sistema de backup funcional para usuários.** Não salva arquivo em disco, não autentica titular, não confere a segurança de um meio físico de armazenamento, não concede matrícula de aparelho, não desbloqueia dados e não realiza operação bancária.

## Problema resolvido parcialmente

Os experimentos SEC-05G e SEC-05H permitem criar um kit composto por **dois elementos independentes**: arquivo de envelope cifrado de 184 bytes e segredo aleatório de recuperação de 256 bits. O SEC-05I exercita uma **reentrada controlada** desses dois elementos para comprovar, em fixture, que ainda recuperam a mesma chave de dados sintética.

Não basta perguntar ao usuário "Você salvou o kit?" e aceitar um botão. Essa resposta não comprova a existência de uma cópia recuperável. Por outro lado, mesmo um teste criptográfico bem-sucedido **não prova armazenamento durável ou fisicamente independente**; isso dependerá de UX e políticas de backup auditadas antes de produção.

## Implementação

`SyntheticRecoveryKitCeremonyLab.kt` inclui duas estruturas separadas:

1. **`SyntheticRecoveryKitCeremonyLab`**: recebe uma chave de dados descartável e envelope cifrado de teste. Mantém apenas uma referência SHA-256 da chave e um hash do arquivo, identificadores de sessão/kit e janela de 15 minutos. Não retém o segredo de recuperação e não retorna chave de dados. Requer reapresentação do arquivo exato e de um segredo fornecido separadamente.
2. **`SyntheticCleanRoomRecoveryLab`**: opera como verificador de laboratório independente. Importa o envelope com o parser do SEC-05H, usa AES-GCM do SEC-05G com o segredo externamente fornecido e compara a chave sintética recuperada com um compromisso SHA-256 da chave esperada. Os buffers temporários explicitamente acessados no verificador são zerados após a comparação. A JVM não fornece garantia absoluta de limpeza de todas as cópias internas.

A comparação de hash de chave sintética **não é um protocolo de autenticação**. Sua validade depende do valor que a fixture entregou; no futuro seria necessário vincular o registro a identidade, conta, geração e backup autorizado por uma autoridade de confiança.

## Estados

| Estado | Significado |
| --- | --- |
| `PENDING_REENTRY` | Um ensaio de confirmação foi aberto; ainda não há restauração verificada |
| `VERIFIED_OFFLINE_ONLY` | Arquivo e segredo permitiram recuperar a chave sintética esperada, mas nada foi salvo/autorizado |
| `EXPIRED` | Passou a janela de 15 minutos do ensaio |
| `CANCELLED` | A sessão de teste foi cancelada, sem recuperar/acessar conta |

A função de verificação devolve `VERIFIED_OFFLINE_NOT_STORED_OR_AUTHORIZED` exclusivamente para restauro offline verificado. Repetição da confirmação após estado terminal recebe `DENY_TERMINAL`. O relógio injetado que retrocede é recusado com `DENY_BAD_CLOCK` antes de qualquer transição.

## Cobertura adversarial

`SyntheticRecoveryKitCeremonyLabTest.kt` executa **30 grupos de testes** integrados a `policyCheck`:

- Restauração por importação e segredo separado, com verificação do compromisso da chave;
- Arquivo de outra conta, arquivo diferente e modificação do arquivo com checksum público recalculado;
- Segredo nulo, curto, PIN de seis dígitos, segredo aleatório errado e compromisso da chave divergente;
- Fonte inválida, chave de origem malformada, arquivo truncado e conta não canônica;
- Cancelamento, prazo final, relógio retrocedendo, estado terminal e reapresentação;
- Oito tentativas simultâneas na mesma sessão com somente uma confirmação de teste;
- Recuperação offline ainda matematicamente possível de uma cópia antiga com seu segredo, independentemente da expiração de uma sessão.

**Importante:** O verificador pode testar uma recuperação de dados sintéticos, mas não demonstra que um novo dispositivo está autorizado nem que uma cópia de backup existe fora deste processo. Sucesso do teste não significa "backup seguro e salvo".

## Proteções ainda ausentes

- Exportação real para mídia ou gerenciador seguro, verificação de gravação e leitura após desconexão de dispositivo, proteção contra corrupção de mídia, duplicação e armazenamento separado de arquivo e segredo;
- Formato seguro e usável de segredo com checksum legível, confirmação de recuperação sem coleta de segredo por analytics, logs, suporte, teclado de terceiros, screenshots ou clipboard;
- Controles de UX/acessibilidade e prevenção de perda da única cópia, confirmação explícita do usuário sem alegação falsa de segurança;
- Autenticação verdadeira e independente do titular, inscrição e revogação de aparelhos, Keystore/SQLCipher integrados, custódia de chaves por usuário e política contra rollback;
- Gestão de rotação, recriptografia, backups antigos comprometidos, hardware físico e avaliação por profissionais de segurança.

**Gate de produção SEC-05: BLOQUEADO.** PR de rascunho. Sem merge, sem APK, sem instalação e sem acesso a dados reais.
