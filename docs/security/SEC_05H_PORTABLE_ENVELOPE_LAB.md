# SEC-05H | Formato portátil do envelope de recuperação

**Data:** 21/10/2026  
**Área:** SEC-05, recuperação de dados cifrados no Negresco Finance. Não confundir com SEC-06, Modo Proteção Máxima.  
**Branch:** `release/3.1.3-security-preview`, PR #14 em rascunho.  
**Status:** somente laboratório; **produção BLOQUEADA**.

> O projeto não cria arquivos reais no celular, não constrói uma tela de recuperação, não envia material pela internet e não implementa login, autorização de dispositivo, recuperação autenticada ou movimentação de dinheiro.

## Objetivo

Fazer com que a cópia **criptografada** da chave de dados criada no SEC-05G possa ser transferida entre dispositivos em um **formato binário determinístico**, com importação estrita e rejeição de arquivos truncados ou corrompidos.

**O arquivo NUNCA armazena o segredo de recuperação de 256 bits.** O titular teria de guardar esse segredo separadamente, seguindo uma cerimônia segura de provisionamento e confirmação ainda não implementada. Quem obtém o arquivo junto do segredo válido pode descriptografar sua antiga chave de dados **offline**, mesmo depois de uma revogação administrativa.

## Formato fixo v1

`SyntheticPortableRecoveryEnvelopeLab.kt` implementa um codec de **184 bytes exatos**, big-endian, sem JSON, sem compressão, sem leitura de caminhos e sem estruturas de tamanho variável fornecidas pelo arquivo.

| Offset | Bytes | Conteúdo |
|---|---:|---|
| 0–7 | 8 | Magic ASCII `NGFRCV01` |
| 8–11 | 4 | Versão do arquivo: inteiro 1 |
| 12–27 | 16 | Conta sintética opaca |
| 28–43 | 16 | UUID do kit |
| 44–51 | 8 | Versão da chave de dados, positiva |
| 52–59 | 8 | Geração do titular, positiva |
| 60–91 | 32 | Salt de HKDF |
| 92–103 | 12 | Nonce AES-GCM |
| 104–151 | 48 | Chave de dados cifrada (32 bytes + tag de 16 bytes) |
| 152–183 | 32 | SHA-256 do cabeçalho e envelope anteriores |

O parser recebe obrigatoriamente um **identificador de conta esperado**; no laboratório isso é um argumento não autenticado, portanto **não valida identidade**. Ele verifica formato, versão, tamanho, escopo, checksum, números positivos e retorna `PARSED_ONLY_NOT_AUTHENTICATED`.

### Integridade não é autenticação

O SHA-256 público apenas detecta dano acidental. Um invasor que substitui bytes consegue recalcular esse checksum; ele **não é assinatura digital nem MAC**.

Somente uma tentativa posterior de descriptografar com o segredo correto, o AES-256-GCM e os metadados AAD do SEC-05G pode detectar adulteração criptográfica e obter uma chave de dados válida. Sucesso na descriptografia **também não autentica o titular nem aprova um celular**.

Em particular, mesmo após revogar o kit e avançar a geração da conta, o arquivo antigo ainda pode ser importado e descriptografado offline por quem já possuía o segredo antigo. Um registro central de confiança precisa barrar sua utilização operacional, mas não pode apagar cópias externas.

## Testes de laboratório

`SyntheticPortableRecoveryEnvelopeLabTest.kt` contém **28 grupos**, entre eles:

- ida/volta binária determinística e recuperação de chave fictícia com o segredo guardado separadamente;
- rejeição de todos os 184 comprimentos truncados, conteúdo adicional, cabeçalho/versão incorretos e conta diferente;
- rejeição de chave/geração zeradas e de checksum alterado;
- adulteração de UUID, salt, nonce, ciphertext e tag **com checksum recalculado**, demonstrando a barreira de autenticação do AES-GCM;
- cópias defensivas, oito importações simultâneas e prova de que revogação não destrói backups antigos.

O runner Kotlin `policyCheck` inclui os testes; contratos JavaScript verificam a separação de módulos.

## Limitações, decisões pendentes e requisitos de segurança

A implementação é **somente em memória**, não faz exportação em disco, não tem sistema de permissões de arquivos, UI, backup em nuvem, scanner, QR, frase legível, impressão, canal de suporte, recuperação com senha humana ou recuperação de dados reais. O formato é uma proposta v1, sujeito a auditoria e mudanças incompatíveis.

Antes de produção precisamos validar a ameaça completa de roubo do arquivo + segredo; design do armazenamento offline, checksum legível e cerimônia de exportação; proteção de tela/clipboard, limites de retenção; autenticação forte de conta e dispositivo; integração real com Keystore/SQLCipher; recuperação de dados E2EE; anti-rollback central e política de troca de DEKs com recriptografia.

**Gate de produção SEC-05: BLOQUEADO.** O SEC-05H cria somente uma representação binária de teste para o envelope cifrado.
