# Negresco Security Engine | Masterplan modular de segurança financeira

**Data:** 20/10/2026  
**Proprietário:** Negresco Finance, repositório `nego001/negresco-finance.`  
**Programa:** [Issue #15](https://github.com/nego001/negresco-finance./issues/15)  
**Branch de laboratório:** `release/3.1.3-security-preview` / [PR #14](https://github.com/nego001/negresco-finance./pull/14) (DRAFT)

> Este documento é um contrato de engenharia, não um atestado de segurança,
> promessa de equivalência ao Bitwarden, identificação de defesas internas de
> bancos, autorização para lançar APK ou indicação de que os módulos estejam
> protegendo transações bancárias reais.

## Plano de dez módulos, estado verificável

| Código | Módulo | Entregável de engenharia | Situação agora | Gate para integrar |
| --- | --- | --- | --- | --- |
| SEC-01 | Criptografia | SQLCipher no banco real + AES-GCM por anexo/exportação + ciclo de vida de chaves | Laboratório de banco/chaves sintéticas | migração de dados cifrada, teste do WAL, troca de chaves, dump offline |
| SEC-02 | Identidade forte | Keystore, `BiometricPrompt.CryptoObject` e reautenticação por operação | Laboratório Android; biometria manual não executada | API Android real, revogação em `onStop`, biometria e inscrição alterada |
| SEC-03 | Privacidade | Tela segura, anti-tapjacking, clipboard, notificações e revisão de backups | Bloqueio de captura parcial no app experimental | revisão por tela, teste de overlays/captura, acessibilidade |
| SEC-04 | Antifraude | Detecção de ações arriscadas e alertas locais, sem PII desnecessária | Sinais definidos no motor de política sintético | telemetria minimizada, qualidade dos sinais, resposta a falsos positivos |
| SEC-05 | Confiança de dispositivos | Credenciais por aparelho, registro aprovado, expiração e revogação | Laboratórios Ed25519, DataStore de uso único e verificador de testemunho remoto assinado (ainda sem emissor real) | cadastro autenticado, autoridade remota, âncora monotônica real, integração nativa e QA de hardware |
| SEC-06 | Modo Proteção Máxima | Pré-verificação por risco e autenticação reforçada por ação | **Laboratório Kotlin `SecurityOperationPolicyLab` inicial** | entradas obtidas somente por módulos nativos, decisão revalidada na camada de chaves |
| SEC-07 | Recuperação | Backup cifrado + kit separado + recuperação verificada + anti-rollback | Protótipo sintético em memória | exportação segura, restauração segunda instalação e proteção contra replay |
| SEC-08 | Central de Segurança | Painel com estado real, alertas e auditoria sem segredos | Laboratório de eventos minimizados `SecurityAuditEventLab` (sem persistência) | API de evidências verificadas, armazenamento cifrado, nenhum indicador visual fictício |
| SEC-09 | Comunicação | TLS, tokens seguros, idempotência, E2EE condicionado a sync | Planejado | especificação de servidor/protocolo e pentest, sem fluxo falso |
| SEC-10 | Verificação | OWASP MASVS/MASTG, SBOM, testes de falhas, QA físico e auditoria | CI JVM/Android/SQLCipher e assinaturas experimentais | auditoria por função, assinatura de produção, preservação do usuário |

O módulo de segurança do Negresco Finance **não contém um cofre genérico de senhas**. Esse escopo pertence ao projeto separado Security Black.

## Fluxo de confiança obrigatório

```
Tela / gesto do usuário
     |
     v
Sinais nativos autenticados (lifecycle, sessão, armazenamento, dispositivo)
     |
     v
Pré-avaliação determinística de risco (SEC-06)
     |        \__ DENY -> nenhum efeito, nenhum acesso ao banco
     |
     +---- REQUIRE_FRESH_STRONG_AUTH -> prompt nativo independente
     |
     +---- PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER
                    |
                    v
     autorização Keystore/CryptoObject por operação e revisão atual
                    |
                    v
     componente SQLCipher nativo abre recurso apropriado
```

**O pré-avaliador de risco nunca retorna ALLOW, tokens assinados, chave,
passphrase SQLCipher ou acesso financeiro.** O aplicativo futuro deve
revalidar geração, contexto, permissões e autenticador nativo, sem confiar
em parâmetros de JavaScript, IA, rede Wi-Fi ou telemetria como fontes finais
de autorização. A decisão de risco não substitui criptografia.

## Política do Modo Proteção Máxima (SEC-06)

**Operações modeladas:** ver resumo, revelar registro, exportar dados, cadastrar
dispositivo, revogar dispositivo, alterar recuperação, alterar contexto
confiável, desativar modo máximo, desativar biometria, restaurar backup, apagar
chaves de criptografia.

- Emergência, app em segundo plano, sessão ausente, armazenamento incerto,
  dispositivo não confiável ou overlay suspeito: **DENY**.
- Alteração de recuperação, exibição de item e exportação com proteção de
  captura indisponível: **DENY**.
- Cadastro de aparelho numa rede desconhecida: **DENY**. Rede conhecida sozinha
  **não** concede autorização.
- Operações críticas sob fraude suspeita ou detecção indisponível: **DENY**.
- Exportar, gerenciar dispositivos, mudar recuperação e desativar o modo máximo
  exigem autenticação forte recente e checagem nativa independente.
- No modo máximo, consulta de resumo financeiro também exige step-up quando
  contexto de rede/risco não está confiável.
- **Desativar biometria, apagar chaves e restaurar backup** são sempre
  **DENY neste protótipo**; cada uma exige seu protocolo transacional próprio.

**Limites:** sinais `Boolean` não são provas criptográficas; não são seguros
se originados em um componente arbitrário. A autorização forte recente aqui é
apenas um sinal para decidir o próximo passo; mesmo `true` só pode retornar
`PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER`. Esta primeira versão não implementa
sincronização, FIDO2, antifraude de produção ou nenhum dos controles da
plataforma necessários para garantir esses sinais.


## Protótipo de confiança e revogação de dispositivos (SEC-05)

`tooling/native-lock-spike/.../SyntheticDeviceTrustLab.kt` modela **um laboratório sem chaves privadas, comunicação de rede, contas ou aparelhos reais**. O protótipo usa um identificador de chave pública de 32 bytes representado em hexadecimal para testar transições de estado; a existência de um identificador **não** comprova posse da chave. Não registra biometria nem provisiona aparelhos.

- Estado `revision`, `epoch`, conjunto de aparelhos ativos, tumbas de revogação e último número de sequência por chave.
- Estado ausente, corrompido ou mais antigo que um **limite de confiança externo** é negado. O limite não foi implementado em Keystore/backend; nestes testes ele é fornecido como entrada confiável fictícia.
- Pedido de operação com `revision` ou `epoch` antigo é negado; dispositivo desconhecido ou revogado permanece negado.
- O contador de sequência não pode ser reutilizado na mesma instância JVM; o commit de laboratório usa compare-and-set para reduzir corrida de requisições. O laboratório copia defensivamente mapas/conjuntos externos, para que o chamador não modifique a confiança por referência.
- Revogação sintética remove o aparelho do conjunto ativo, grava um marcador de revogado e incrementa a época. Revogar o último aparelho mantém o estado **bloqueado**, sem reativação ou geração silenciosa de novo dispositivo.
- `proofVerified: Boolean` é um **substituto artificial para testes**, jamais prova assinatura. Nenhum método concede acesso aos dados, abre SQLCipher, autoriza pagamento, exportação ou altera o aplicativo.
- São **21 cenários adversariais**, incluindo corrida de 16 tentativas concorrentes, e **256 combinações de estados**. Os resultados só devem ser chamados aprovados após verificar `native-lock-spike` no CI do HEAD.

**Bloqueios para produção:** identidade autenticada de chave pública, prova de posse por desafio assinado com domínio/operação/nonce, vínculo ao titular, contador transacional persistente, valor monotônico protegido fora do banco sujeito a rollback, rotação, recuperação de aparelhos perdidos, política offline e proteção contra clonagem. O projeto atual **não** protege replays após morte do processo ou restauração de um backup antigo: compare-and-set em memória não resolve essa ameaça. Não conectar esse protótipo ao JavaScript como permissão de acesso.

### Prova criptográfica vinculada à operação (Ed25519, somente JVM)

`SyntheticSignedDeviceProofLab.kt` valida assinaturas **Ed25519 reais** e
impede que uma operação assinada seja substituída por outra de tipo diferente,
dispositivo, revisão, epoch ou contador diferente. Codificação canônica
binária com identificadores estáveis por operação, domínio criptográfico e
desafio de 32 bytes. Fingerprint SHA-256 é calculado a partir da chave pública
X.509 fornecida pelo laboratório; a chave privada só existe em
`SyntheticSignedDeviceProofLabTest.kt`, gerada em memória.

O `SyntheticDeviceTrustCoordinator.recordSignedSyntheticOperation` associa a
verificação criptográfica ao registro atômico do número de sequência de
laboratório. Uma assinatura válida **não** desbloqueia nada, nem retorna
`ALLOW`. A mesma sequência só pode ser consumida uma vez **enquanto durar a
instância JVM**. Há 22 novos cenários JVM de assinatura adulterada, chave
errada, nonce diferente, ação alterada, revisão alterada, revogação posterior,
replay e concorrência.

**Atenção:** este NÃO é um autenticador de produção. O parâmetro
`enrolledPublicKey` deve, no futuro, ser lido de cadastro de chave previamente
autorizado e autenticado, nunca de payload controlado por quem pede acesso.
O `independentlyIssuedNonce` deve vir de emissor seguro com validade e
consumo único persistido. O laboratório não tem essas duas autoridades,
vínculo à conta, antirreplay depois de processo reiniciado, Keystore
hardware-backed, validação de Play Integrity, assinaturas reais em Android
nem conexão segura com serviço de dispositivos. Seu resultado continua
**pré-requisito de uma autorização separada**, não autorização financeira.

### Persistência de desafio e contador no DataStore (SEC-05, laboratório)

`SyntheticDeviceChallengeDataStoreLab.kt` acrescenta um fluxo **single-device
descartável**, sem dados bancários:

- Cadastro inicial **somente sintético** pelo método explícito
  `seedForDisposableLab`, que aceita um fingerprint não autenticado.
  **NÃO é um cadastro de aparelho seguro para produção**.
- Um desafio `SecureRandom` de 32 bytes é guardado em Jetpack DataStore
  com a operação, sequência, revisão e epoch específicos.
- Não há sobrescrita de desafio pendente. Operação, identidade ou sequência
  incorretas e arquivo ausente/inválido falham sem criar novo registro.
- A verificação Ed25519, comparação com o desafio persistido, avanço do
  contador e exclusão do desafio acontecem **na mesma transação
  `DataStore.updateData`**. Duas chamadas concorrentes não conseguem consumir
  o mesmo desafio mais de uma vez na mesma instância do DataStore.
- O desafio e o contador persistem após fechar e reabrir o DataStore,
  permitindo rejeitar a sequência já consumida após a reabertura normal.
- **14 cenários JVM** e **3 testes instrumentados Android adicionais**:
  persistência/reabertura, assinaturas falsas, operação diferente, desafio
  alterado, concorrência, corrupção e arquivo não inicializado. A suíte
  instrumentada de bloqueio/DataStore passa de 10 para **13 casos**.
  Contagens só valem como resultados depois de CI concluído.

### Cancelamento transacional de desafios pendentes

Adicionado `cancelPendingForDisposableLab(expectedRevision, expectedEpoch, floor)`
ao ledger de teste. Após um cancelamento explícito de desafio pendente,
uma única transação DataStore apaga o nonce e seus vínculos e incrementa
**revision + epoch**. Uma assinatura Ed25519 anteriormente emitida continua
criptograficamente válida para seus bytes, mas **não atende mais à revisão**
que o verificador de estado exige, portanto o ledger a recusa. Um segundo
cancelamento ou uma chamada com revisão incorreta não pode incrementar o
estado silenciosamente. A operação é somente de revogação: não expõe token
de acesso nem autoriza transações financeiras.

O laboratório inclui **mais quatro cenários Kotlin/JVM** de cancelamento e
reabertura, e **mais um teste Android instrumentado** em arquivo descartável,
elevando a matriz específica do ledger para **18 casos JVM** e a suíte Android
de bloqueio/dispositivos para **14 testes**. Esses resultados só podem ser
marcados aprovados após execução efetiva no CI do HEAD atual.

**Não é um callback automático de lifecycle:** o produto ainda precisará
ligar `onStop` e as revogações do autorizador nativo a esta operação.
O estado não está protegido contra restauração de arquivo, relógio alterado
ou backup antigo; anti-rollback remoto/protegido continua pendente.

**Limites críticos:** DataStore não é armazenamento anti-rollback. Restaurar
o arquivo para uma versão antiga pode restaurar desafios/contadores
antigos. Falta uma âncora independente, monotônica, durável, autenticada
e um serviço de cadastro de chaves públicas previamente verificadas. Os
desafios não têm expiração de tempo (um bloqueio intencionalmente conservador
até recuperação segura), não há reconhecimento do titular, nem hardware
Keystore ou token de autorização final. Nenhuma migração real ou integração
Expo foi realizada. O teste de reinicialização fecha e reabre o DataStore,
mas não simula um reset completo do sistema ou restauração de backup antigo.

### Gate Android: provedor de assinatura e algoritmo real

No emulador Android API 35, o gerador `AndroidKeyStore` acionado por
`KeyPairGenerator("Ed25519")` sem `KeyGenParameterSpec` falhou como
`Not initialized`. Com inicialização explícita do alias, o emulador devolveu
uma chave pública **EC com SPKI DER de 91 bytes**, incompatível com Ed25519.
A política **recusou** esse material: não é permitido renomeá-lo, aceitar
algoritmos de curva distintos ou anunciar Ed25519 hardware-backed sem prova.

A partir desta revisão, **apenas os testes instrumentados Android de desafios
Ed25519** usam o provedor criptográfico Bouncy Castle `bcprov-jdk18on:1.86`,
declarado **exclusivamente em `androidTestImplementation`**. As chaves de
teste são criadas em memória, sem hardware Keystore, sem cadastro e sem
matrícula biométrica. A verificação normal do `SyntheticSignedDeviceProofLab`
continua exigindo um SPKI RFC 8410 canônico de 44 bytes e uma assinatura
Ed25519 real, nunca um teste baseado só no rótulo da API.

Para demonstrar que o mesmo provedor de software verifica a assinatura
produzida pelo teste, `SyntheticDeviceChallengeDataStoreLab` aceita uma
**instância JCA `Provider` injetável somente no laboratório**. O teste Android
passa explicitamente o mesmo objeto Bouncy Castle para geração, assinatura e
verificação. `Signature.verify` continua indispensável; o teste nega chave,
assinatura, nonce ou operação adulterados. Essa injeção **não deve fazer parte
de um autorizador de produção**, pois um chamador não confiável poderia
escolher um provedor malicioso. A versão real deve fixar uma implementação
revisada e não aceitar parâmetros de provedor de JavaScript, IA ou rede.

**Nenhuma conclusão de proteção por hardware** pode ser tirada dos 14 testes
de DataStore e desafios assinados. Um módulo futuro separado deve demonstrar
material de chave não exportável, atestado quando disponível, algoritmo
realmente suportado no hardware (possivelmente ECDSA P-256 com domínio
específico, distinto de Ed25519) e integração com ciclo de vida e biometria
forte. O SEC-05 permanece LAB até lá.

### Verificação de âncora remota assinada (SEC-05, estudo isolado)

`SyntheticSignedTrustFloorLab.kt` usa assinatura **Ed25519 real** para
verificar, num laboratório offline JVM, um testemunho de confiança contendo
fingerprint da chave pública do dispositivo, `revision`, `epoch`,
`minLastSequence` e um desafio aleatório **novo** de 32 bytes. O objetivo
é identificar restauração de um arquivo DataStore mais antigo que o último
estado conhecido por uma autoridade independente. A codificação é binária,
versionada e isolada por domínio criptográfico.

Quando a assinatura é válida e está vinculada ao desafio solicitado, o
verificador compara o estado observado com o testemunho:
- estado ausente, chave da autoridade ausente, assinatura inválida,
  outro dispositivo ou desafio divergente: **nega**;
- revisão ou época diferente da assinada: **nega** e exige uma conciliação
  independente, nunca cria ou corrige registros automaticamente;
- último contador local inferior ao mínimo assinado: **nega**;
- somente uma resposta verificada com dados consistentes retorna
  `PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER`, **não acesso financeiro**.

Foram adicionados **22 cenários Kotlin/JVM** sintéticos e dois contratos Node
contra troca de chave, assinatura adulterada, desafio antigo, replay de
resposta, dispositivo diferente e arquivos antigos.

**Controle essencial NÃO IMPLEMENTADO:** não existe, neste repositório,
servidor que mantenha os contadores atuais, fluxo HTTPS autenticado,
provisionamento de chave da autoridade, autenticação de cadastro de
aparelhos, rotação/revogação dessa chave, emissor de desafios com garantia
de unicidade nem persistência do testemunho fora do arquivo sujeito a
rollback. A injeção de uma chave pública arbitrária como autoridade destrói
a segurança deste desenho. O teste gera chaves de autoridade fictícias e
verifica apenas as propriedades criptográficas dos bytes.

Uma assinatura antiga válida sobre um desafio antigo **continua válida
criptograficamente**. Ela só deve ser recusada quando o cliente consegue
garantir desafio novo e obter da autoridade legítima o **estado atual**.
Sem conexão, ou se o próprio emissor responder com estado antigo, este
laboratório **NÃO prova resistência real a rollback**. Não existe ligação
com `SyntheticDeviceChallengeDataStoreLab.issue/consume` nesta fase;
a ligação futura terá de ser nativa e auditar atomicidade, cancelamento,
expiração, revogação e o estado remoto antes de qualquer acesso.

### Verificação dupla na mesma transação DataStore (SEC-05)

A revisão atual adiciona
`SyntheticDeviceChallengeDataStoreLab.consumeWithSignedAuthorityFloorForDisposableLab`.
Na **mesma transação DataStore.updateData**, essa função lê a versão
persistida, verifica o testemunho de estado assinado pela autoridade
(`SyntheticSignedTrustFloorLab.inspect`) e valida a assinatura Ed25519
da operação do dispositivo antes de consumir o desafio e avançar o
contador. Um desafio inválido, chave de autoridade ausente, revisão ou
epoch divergente, assinatura adulterada, dispositivo trocado, revogação
feita entre emissão e consumo ou sequência duplicada não alteram o estado.

A chave da autoridade sintética é fornecida no **construtor de laboratório**,
e não por cada requisição de consumo. **Isto não substitui provisionamento
autenticado**: o teste ainda escolhe a chave e não existe servidor que
garanta que a resposta represente o estado atual. O desafio de autoridade
também é fornecido pelo chamador e não possui emissão única, validade
temporal ou confirmação de consumo por uma autoridade independente.
O fluxo ainda não é um mecanismo de autenticação confiável para produção.

Foram adicionados **12 cenários de integração Kotlin/JVM**, um novo teste
instrumentado Android em diretório descartável (suíte total **15 casos**)
e testes de contrato Node. Em Android, tanto a geração quanto a
verificação das duas assinaturas usam provedor Bouncy Castle de **software
somente na suíte de testes**. Nenhuma chave de usuário, banco financeiro ou
permissão real é envolvida. As contagens devem ser consideradas aprovadas
somente após o CI da revisão corrente terminar.

**Promover somente depois de:** serviço que realmente mantenha versão,
epoch e contadores atuais, cliente que valide chave pública de autoridade
confiável, protocolo de nonce de uso único com expiração vinculada à
conta e dispositivo, autenticação nativa Android/Keystore, prova de
persistência anti-rollback fora do DataStore e auditoria independente.

## Laboratório de auditoria, sem coleta de dados pessoais (SEC-08)

`SecurityAuditEventLab` gera somente eventos estruturados com código,
gravidade e enumerações da operação e motivo. O evento não admite texto livre,
valor financeiro, CPF, CNPJ, token, identificador de dispositivo, localização,
captura de tela ou conteúdo do banco. A função é pura: não transmite, não
armazena e não aciona IA. Dez testes de contrato exercitam os códigos de
emergência, bloqueio de exportação, cadastro de aparelhos, recuperação e
ausência de `String`/`ByteArray` na estrutura do evento.

**Não equivale ao histórico de segurança do aplicativo.** Antes de um
histórico persistente, faltam retenção limitada, criptografia e integridade
do registro, tratamento de exclusão/LGPD, controle de acesso e garantia de
que uma notificação visível não revela informações privadas.

## Qualidade e critérios de promoção

1. **LAB:** todos os testes Kotlin/Node relevantes verdes, matriz adversarial
   e contrato que impede associação inadvertida ao app Expo.
2. **ANDROID-LAB:** testes instrumentados com dados fictícios em emulador,
   token anterior revogado, armazenamento restaurável, comportamento de teclado,
   acessibilidade e ciclo de vida Android.
3. **FEATURE FLAG OFF:** integração nativa real, desligada por padrão e sem
   migração automática de bancos, dados ou chaves pré-existentes.
4. **QA/HARDWARE:** teste com autorização, instalação compatível pela assinatura,
   cenários de travamento, queda de energia simulada, biometria e recuperação.
5. **RELEASE CANDIDATE:** auditoria de segurança independente, SBOM,
   análise de privacidade, política LGPD, ameaça residual e plano de reversão.
6. **PRODUÇÃO:** consentimento específico do proprietário para publicar/mesclar,
   chaves de distribuição permanentes, monitoramento de falhas sem PII.

Até lá: **sem merge em `main`, sem alterar o APK 3.1.2 instalado,
sem instalar silenciosamente no Galaxy A55, sem dados bancários reais**.

## Trilhas já existentes

- [P0 SQLCipher e biometria: CI validado](https://github.com/nego001/negresco-finance./actions/runs/39382072099).
- [APK 3.1.3 de testes](https://github.com/nego001/negresco-finance./actions/runs/39376841287), gerado antes de integrar qualquer
  `tooling/*` ao aplicativo Expo.
- [Checagem de assinaturas 3.1.2 → 3.1.3](https://github.com/nego001/negresco-finance./actions/runs/39432982560):
  assinaturas públicas coincidem; smoke emulador estava bloqueado por shell
  de workflow e requer reexecução após correção.
