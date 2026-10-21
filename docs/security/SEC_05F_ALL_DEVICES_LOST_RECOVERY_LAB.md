# SEC-05F | Recuperação quando todos os dispositivos foram perdidos

**Data:** 21/10/2026  
**Módulo:** SEC-05, confiança e recuperação de dispositivos. Não misturar com SEC-06 (Modo Proteção Máxima).  
**Implementação:** `tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticAllDevicesLostRecoveryLab.kt`  
**Status:** **SOMENTE LABORATÓRIO / GATE DE PRODUÇÃO BLOQUEADO**.

> Este componente não fornece recuperação real, não identifica uma pessoa, não libera saldo/transações/dados financeiros, não emite token e **não cadastra nem considera confiável um aparelho novo**. Todo o material de teste é sintético e executado na JVM sem relação com celulares de usuários.

## A situação protegida

O proprietário perdeu/teve furtados/trocou todos os dispositivos registrados e tenta usar um aparelho novo. O protocolo normal de convite entre aparelhos **não serve**, pois já não existe um aprovador ativo. Também é proibido usar a posse de um novo telefone, uma restauração de DataStore, biometria configurada no novo Android, senha local isolada ou uma declaração `ownerAuthenticated=true` como substituto automático de identidade.

A recuperação precisa de **duas cerimônias independentes**, que neste estágio não estão implementadas como serviço de produção:

1. **Comprovação de identidade e revisão humana/externa:** a futura autoridade deverá autenticar o titular em um canal distinto dos dispositivos perdidos, aplicar autenticação forte e antifraude, tratar coerção e troca recente de credenciais e assinar a decisão a partir de uma chave confiável provisionada fora do aparelho. Em caso de dúvida, bloquear.
2. **Prova de posse do aparelho substituto:** o candidato gera sua própria chave nativa, assina um desafio efêmero com domínio separado da decisão de revisão e prova a posse da chave específica, não só do identificador declarado.

**Nem mesmo dois comprovantes válidos liberam o cofre no laboratório atual.** Eles só registram `PROOF_ONLY_RECORDED`, sem criar dispositivo ativo. Um backend real precisaria definir uma etapa posterior distinta, autenticada, persistente, auditável e transacional antes de qualquer matrícula.

## Máquina de estados testada

```text
Todos aparelhos previamente revogados, nenhum ativo
                        |
                 Abrir revisão (fixture)
                        |
                        v
                  PENDING_REVIEW
                 /      |        \
           prazo    mudança de     duas assinaturas válidas
         10 min     geração/epoch   e mesma conta + ticket
            |          |                  |
          EXPIRED  INVALIDATED    PROOF_ONLY_RECORDED
                                         |
                                  NÃO é ENROLLED
                                NÃO abre SQLCipher
                             NÃO cria token ou chave
```

Os recibos terminais têm nonce excluído da memória da fixture. Uma conta só mantém uma revisão pendente; ao registrar uma revisão, não abre outra na mesma geração de titular. O simulador exige `active.isEmpty()`, `revoked.isNotEmpty()` e estado consistente. Uma chave anteriormente revogada não pode se reapresentar como candidato.

O payload canônico de ambas assinaturas Ed25519 vincula domínio do papel, identificador opaco de conta, UUID de revisão, fingerprint do aparelho candidato, revisão, epoch, geração de titular, janela temporal e nonce aleatório de 32 bytes. A chave de revisão é **fixada no construtor da fixture**, nunca é escolhida pelo pedido de confirmação.

Se o relógio do laboratório retroceder, o fluxo nega. Após o prazo, o marcador `EXPIRED` não volta a `PENDING`. Alterar geração/epoch invalida a revisão pendente. O laboratório copia o nonce defensivamente e verifica ambos os papéis com assinaturas reais Ed25519 de chaves geradas exclusivamente no teste.

## Casos de regressão

`SyntheticAllDevicesLostRecoveryLabTest.kt` contém **25 cenários adversariais** envolvendo perda total, dispositivo ainda ativo, aparelho anteriormente revogado, chave incorreta, aprovação por autoridade não confiável, assinatura do candidato ausente/errada, conta ou ticket diferente, nonce adulterado, papéis invertidos, expiração exata, relógio retrocedendo, invalidação por mudança de geração, defensividade de memória, duas contas isoladas e oito confirmações concorrentes.

O número de testes não é prova de segurança operacional. A conclusão deve ser baseada nos resultados reais do CI da revisão atual.

## Decisões abertas antes de produção

- **Quem é a autoridade de identidade?** Escolher provedor, métodos de autenticação forte, eventual recuperação com credenciais pré-provisionadas, avaliação anti-SIM swap, revogação de sessões antigas, rate limiting, períodos de espera, canais de notificação previamente verificados e recurso de contestação. Não improvisar códigos de suporte como bypass.
- **Onde vive a chave da autoridade?** Exigir provisionamento/pinning, rotação, proteção em HSM ou equivalente, autorização de emissão, dupla aprovação para recuperação de alto risco e trilha de auditoria inviolável.
- **Como persistir o pedido?** Banco central transacional, nonce de uso único, relógio de servidor confiável, digest do desafio, tombstones duráveis, gerações monotônicas e recibos assinados. Nada disso é fornecido pela fixture em memória.
- **E se as chaves E2EE estiverem perdidas?** Autenticar o titular **não recria** automaticamente a chave que decifra dados zero-knowledge. Sem kit de recuperação previamente configurado ou método explicitamente previsto, dados criptografados podem permanecer inacessíveis. Não prometer restauração impossível.
- **E se um telefone furtado voltar?** Não confiar em snapshots antigos ou biometria antiga; revogações são autoritativas e devem ser propagadas a sessões/chaves após reconciliação.
- **Como testar fora do laboratório?** Múltiplas instâncias e falhas de rede, restauração de backup antigo, clock adversarial, tentativas repetidas, hardware Android físico, acessibilidade e auditoria independente antes de produção.

**Limite inegociável:** nunca disponibilizar a operação `invalidateGenerationFixtureOnly` nem `openReviewFixtureOnly` como endpoint/autorização de usuário. O projeto Negresco Finance segue separado do Security Black; cofre de senhas genérico continua fora de escopo.

**Gate SEC-05:** BLOQUEADO para produção até existir autenticação do titular, autoridade externa real, geração e guarda de chaves confiáveis, protocolo de recuperação ponta a ponta e auditoria.
