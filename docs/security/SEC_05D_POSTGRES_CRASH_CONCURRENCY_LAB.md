# SEC-05D | Concorrência e recuperação transacional de laboratório

**Data:** 21/10/2026  
**Módulo:** SEC-05, Confiança de dispositivos. **SEC-06 permanece Modo Proteção Máxima.**  
**Destino:** somente o PR de laboratório `release/3.1.3-security-preview`, sem integração Expo, APK, backend publicado ou dados financeiros.

> **Este estágio NÃO implementa autenticação de usuários, um servidor real, cadastro confiável, validação Ed25519 no banco, nem capacidade de acesso financeiro.** O script de SQL é uma função propositalmente **exclusiva de CI**, criada em PostgreSQL 16 descartável e não incluída no esquema de produção proposto.

## O que mudou

A entrega SEC-05C provou que o PostgreSQL aceita a estrutura e as restrições do futuro ledger. O SEC-05D testa uma propriedade adicional: **o mesmo dado não pode ser registrado duas vezes quando vários processos competem pelo mesmo convite**, e uma queda antes do commit não pode deixar um registro parcialmente aplicado.

Arquivos:

- `tooling/security-authority-protocol-lab/postgres/003_sec05d_ci_receipt_rehearsal.sql`: função `ci_rehearse_receipt_only` para exercitar bloqueio de linha por conta e operações de estado/recibo em uma única transação. **Proibido disponibilizar por API ou implantar.**
- `tooling/security-authority-protocol-lab/tests/sec05d_multi_connection_smoke.py`: usa apenas Python padrão e `psql`, com oito sessões distintas, uma por conexão no teste de concorrência.
- `.github/workflows/ci.yml`: executa os scripts dentro do job existente `authority-postgres-lab`, após o esquema e o smoke test de SEC-05C.

## Garantias que o teste tenta demonstrar

1. **Serialização por conta:** `SELECT ... FOR UPDATE` na linha de conta impede duas conexões de aplicar o mesmo incremento simultaneamente. O bloqueio é no PostgreSQL, não em mutex local do aplicativo.
2. **Confirmação única:** oito conexões de teste pedem o mesmo registro. Uma recebe `RECORDED_FIXTURE_ONLY`; as outras recuperam `ALREADY_RECORDED_NO_GRANT`. O banco conserva exatamente um recibo e um avanço de sequência/revisão/época.
3. **Rollback integral:** uma transação experimental avança os registros e em seguida executa `ROLLBACK`. Todos os campos e o convite devem permanecer inalterados, sem recibo; uma nova tentativa pode então registrar o teste.
4. **Resposta perdida após COMMIT:** nova requisição com o mesmo digest e mesmo convite apenas encontra o recibo, sem repetir a mutação. A mesma chave de idempotência usada em outro convite é negada.
5. **Isolamento entre contas:** o convite de uma conta não é encontrado sob outra conta. O digest de idempotência é limitado à conta, não uma credencial de acesso.
6. **Expiração:** o horário é lido do banco **depois** de adquirir os locks por `clock_timestamp()`, impedindo aceitar prazo antigo congelado antes da espera na fila. Convite expirado recebe tombstone `EXPIRED`.
7. **Falha fechada:** revogação do aprovador, sequência já usada, geração do titular divergente, UUID inexistente e convite terminal impedem alterações indevidas.
8. **Nenhuma matrícula:** o teste **não insere candidato em `devices`**. O recibo é um marcador da simulação, sem permissão ou prova de matrícula confiável.

## Limitações e bloqueios de produção

A função SQL **não recebe, valida ou comprova assinaturas**, nem sabe quem está autenticado. Ela não deve servir de modelo copiável de endpoint. O estágio atual não tem nenhuma superfície para gerar privilégios reais; os fixtures simulam somente a coerência transacional.

Ainda exigimos:

- Backend com autenticação de conta, autorização forte recente do titular, gestão de sessão, política de risco e rate limiting.
- Verificação Ed25519 de ambos os papéis no mesmo contexto da transação; chaves públicas autenticadas, conta/convite/dispositivo/nonce vinculados; validação de identidade e autorização no servidor.
- Registro de candidato verdadeiro somente depois de provas válidas e uma transação de ponta a ponta com unicidade e tombstones.
- Desenho e auditoria de papéis mínimos do PostgreSQL, revogação de privilégios diretos, observabilidade segura, segredo/cadeia de certificados, retenção e proteção contra múltiplos bancos divergentes.
- Testes de falhas de processo/nó, queda de rede, failover e restauração de backup em ambientes reais, não só `ROLLBACK` deliberado; recibos assinados e âncora monotônica independente.
- Recuperação após perda de todos os dispositivos com identidade segura e sem autoaprovação, além de Android físico e pentest.

**Alerta de idempotência:** `ALREADY_RECORDED_NO_GRANT` nunca é credencial. Mesmo informar a existência de um recibo exigirá autenticação account-bound no futuro serviço, para não vazar informações.

## Protocolo de QA

- O job `authority-postgres-lab` aplica primeiro o DDL isolado SEC-05C.
- Executa as constraints e o teste SEC-05D.
- Cada comando `psql` inicia sua própria conexão. O Python verifica concorrência, rollback, idempotência, falhas de autorização simuladas e invariância de `devices`.
- `tests/security-account-bound-invite-contract.test.mjs` verifica que a função só está no arquivo de CI, que não cadastra candidato e que o teste está ligado ao workflow.

**Status:** protótipo transacional de teste; autoridade remota real e SEC-05 de produção **BLOQUEADOS**. Só considerar o SEC-05D testado depois de obter sucesso no CI do commit correspondente.
