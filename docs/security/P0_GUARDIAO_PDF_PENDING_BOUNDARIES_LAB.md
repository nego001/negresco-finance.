# Guardião | Marcadores de etapas pendentes do PDF (laboratório isolado)

## O que este patch resolve e o que não resolve

A [issue #120](https://github.com/nego001/negresco-finance./issues/120) documenta a exportação intermitente no Android 9. A [PR #121](https://github.com/nego001/negresco-finance./pull/121) só observa UI, processo e foco do Android; não identifica qual chamada assíncrona aguarda resposta.

Esta etapa adiciona um **observador opcional de transição** em `exportPdfWithLifecycleGuard`. Ele emite exclusivamente `print`, `availability` ou `share` **antes** de cada `await`, sem acesso a HTML, entrada financeira, URI, erro ou dados pessoais. Um observador que lança erro não altera a conclusão nem o bloqueio de segurança. Um cancelamento de autorização impede etapas posteriores.

O aplicativo exibe rótulos de etapa **apenas em builds de desenvolvimento** (controle `__DEV__`), e só com autorização atual de foreground e de bloqueio biométrico. Nenhum log ou telemetria remota foi criado. A UI continua com `Gerando PDF local...` e um sufixo LAB fixo.

O runner de emulador reconhece três rótulos de desenvolvimento e emite categorias fechadas `lab-print-pending`, `lab-availability-pending` ou `lab-share-pending` se um timeout ocorrer. Caso o APK não contenha os rótulos, mantém a classificação genérica da PR #121.

**Esses marcadores indicam o último `await` iniciado pelo JavaScript. Não provam qual parte nativa está travada, e não resolvem a intermitência.** O único resultado positivo continua a exigir chooser real, receptor independente, semântica do PDF, cache limpo e reabertura de ambos os recibos.

## Isolamento do binário

O workflow atual continua verificando o **mesmo APK imutável** SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. Portanto os testes atuais **não** exercitam os rótulos LAB no dispositivo: eles só podem ser observados em um APK de desenvolvimento **separadamente compilado, assinado para teste e re-auditado**, com workflow novo. Esse artefato novo não será publicado como release nem substituirá o APK pinado.

## Gates

- [ ] Testes de contratos de ordem, privacidade, cancelamento e falha fechada.
- [ ] Compilação TypeScript e CI da nova branch em laboratório.
- [ ] Novo APK exclusivamente de teste, hash e permissões re-auditados, rodando Android 8 e 9, sem quaisquer dados reais.
- [ ] Identificação reprodutível da etapa pendente em caso de timeout.
- [ ] Revisão humana e testes físicos necessários antes de produção.

Sem merge na `main`, OTA, assinatura de release, transações, dados financeiros reais ou aprovação de produção.
