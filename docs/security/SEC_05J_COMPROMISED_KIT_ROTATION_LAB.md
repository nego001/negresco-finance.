# SEC-05J | Rotação do kit comprometido e recriptografia de dados

**Data:** 21/10/2026  
**Área:** SEC-05 do Negresco Finance. SEC-06 permanece reservado ao Modo Proteção Máxima.  
**Ambiente:** JVM descartável, sem APK, autenticação, backend, conta real ou dados financeiros.

> **NÃO É RECUPERAÇÃO EM PRODUÇÃO.** A rotina `SyntheticCompromisedKitRotationLab` não tem permissões financeiras, não autentica titular, não concede confiança a aparelho, não persiste em disco nem sincroniza dispositivos. Os registros usados nos testes são frases fictícias, não extratos bancários.

## Problema e risco

Reemitir um novo segredo de recuperação e continuar utilizando a **mesma chave de dados (DEK)** não protege dados futuros se a chave antiga também tiver sido comprometida. Este laboratório testa o fluxo de **substituir a DEK**, não apenas a frase/kit que a protege.

Revogar administrativamente o kit antigo impede sua utilização futura **somente quando um serviço online confiável verifica o registro vigente**. Um atacante que já copiou um backup antigo, seu segredo e a respectiva DEK continua podendo descriptografar os dados antigos **offline**. Isso é uma limitação matemática, não um bug que uma flag `revoked` consiga consertar.

## Implementação em etapas

Código: `tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticCompromisedKitRotationLab.kt`.

1. **Comprovar a fixture anterior:** exigir identificador de conta e kit ativos, envelope portátil idêntico ao registrado, segredo separado válido, versões positivas e espaço para avanço dos contadores. Na aplicação real, autenticação de titular seria uma condição adicional obrigatória e ainda não existe.
2. **Recuperar a DEK antiga somente em memória sintética:** importar e verificar o envelope SEC-05H com segredo de recuperação SEC-05G. Nunca usar esse resultado como autorização de pessoa ou dispositivo.
3. **Gerar uma nova DEK aleatória:** `SecureRandom`, 256 bits, diferente do material anterior com probabilidade criptográfica.
4. **Recriptografar todos os registros de teste:** validar AES-256-GCM de cada um com a chave anterior, usar novo nonce aleatório por registro e autenticar como AAD o domínio do dado, a conta, o ID do registro, a versão e a nova geração.
5. **Estagiar a atualização:** montar um mapa novo e um novo kit, sem modificar o registro vigente até todos os dados e a recuperação da DEK nova estarem verificados.
6. **Publicar atomicamente apenas dentro da mesma JVM:** substituir conjunto cifrado, ID do kit, versão, geração e envelope. O ID do kit antigo entra no conjunto de aposentados. `REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION` não significa permissão financeira nem confirmação de backup.
7. **Falhar sem publicação:** falhas de segredo, arquivo, conta, ciphertext, versão ou injeções de interrupção após um, dois ou três registros devem deixar a fotografia anterior intacta.

A proteção criptográfica individual contra troca de registros também importa: um ciphertext válido do registro `note_2` não pode ser apresentado como `note_1`, mesmo quando foi cifrado com a mesma DEK.

## Regressões

`SyntheticCompromisedKitRotationLabTest.kt` contém **34 grupos**, entre eles:

- conferência de todas as DEKs e registros sintéticos antes/depois da rotação;
- recusa de segredo nulo, PIN curto, arquivo truncado, arquivo adulterado com checksum recalculado e conta/kit incorretos;
- interrupções depois de 1, 2 e 3 registros recriptografados sem publicação parcial;
- recriptografia com nonces novos, nova versão e nova geração;
- chave antiga incapaz de decifrar os novos registros; chave nova incapaz de decifrar os ciphertext antigos;
- rejeição de trocas de conta, ID de registro, versão e geração por falha de AAD;
- corrupção injetada de um registro cifrado anterior bloqueando a rotação;
- segunda rotação sobre o kit novo e oito tentativas simultâneas com um único sucesso;
- **prova de que ciphertext antigos continuam legíveis com a antiga chave de dados**, mesmo após sucessivas rotações.

O código está ligado ao `policyCheck` JVM. Um teste de contrato JavaScript impede importação inadvertida no aplicativo mobile.

## Ausências antes de produção

O `synchronized` local não é transação durável entre processos. O SEC-05J não possui journal, banco autenticado, recuperação de crash real, replay de comandos após commit, múltiplas instâncias com lock persistente, política de autorização do titular, geração de nova DEK em hardware confiável, rotação segura de backups remotos, ciclo de vida de segredos em memória nativa, migração de bancos SQLCipher e teste de hardware físico.

Para migrar dados reais, será necessário coordenar a troca de chaves com uma transação durável (ou um processo de migração reentrante com journal e rollback seguro), identificadores de gerações em todos os registros, cotas e limites de tamanho, tratamento de falta de espaço, restauração sem vazamento e **validação de um novo backup antes de aposentar o anterior**. Exigir autenticação forte separada do kit e auditoria independente.

A função de corrupção `corruptRecordFixtureOnly` é exclusivamente injeção de falha; **não pode** ser conectada a uma interface do usuário ou serviço real.

**Gate de produção SEC-05: BLOQUEADO.** PR #14 continua em rascunho; sem merge, APK, instalação nem alteração financeira.
