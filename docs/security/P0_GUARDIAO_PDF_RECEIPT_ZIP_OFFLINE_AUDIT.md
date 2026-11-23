# Guardião P0 | auditoria offline do ZIP de recibo Android (laboratório)

## Escopo

Esta etapa empilha sobre a PR #116; não altera o aplicativo, o APK financeiro,
o comportamento do PDF ou o fluxo de compartilhamento. Audita **somente o ZIP
de metadados** que uma execução GitHub Actions de laboratório publicou para
a linha sintética *inválida* de 48 dígitos.

Use o Python 3 local, sem rede ou credenciais:

```sh
python3 tooling/android/audit_guardiao_pdf_receipt_zip.py \
  caminho/para/artefato-api26.zip --api 26
python3 tooling/android/audit_guardiao_pdf_receipt_zip.py \
  caminho/para/artefato-api28.zip --api 28
```

O script aceita **apenas** um JSON de recibo com nome exato e pequeno; bloqueia
ZIPs com arquivos adicionais (PDF, HTML, capturas, logs), arquivos simbólicos,
campos inesperados, chaves JSON duplicadas, tipos inconsistentes e valores fora
dos limites. Requer identificação da API 26 ou 28, hash fixo do APK de teste,
fixture sintético inválido, todas as páginas com texto, hashes formalmente
válidos, exclusão da captura privada e cache limpo. Os campos
`approvedForProduction` e `stableReleaseAllowed` devem ser `false`.

Para rodar os testes negativos com **fixtures gerados localmente**:

```sh
python3 -m unittest discover -s tooling/android \
  -p 'test_guardiao_pdf_receipt_zip_audit.py'
npm test
```

## Evidências de referência (28/10/2026)

- PR de origem: #116, HEAD `c5933f5000cba354d71126103ef0c6645ae27f84`.
- Workflow Android: #40708437566; API 26 e 28 aprovadas.
- Artefato API 26: `12824688848`.
- Artefato API 28 (primeira aprovação no novo HEAD): `12826070835`.
- Artefato API 28 (repetição): `12826206379`.
- Uma falha anterior de API 28 no HEAD `433ecd20` continua sem causa-raiz provada.
  A repetição não demonstra confiabilidade em aparelho físico.

## Limites obrigatórios

**PASS apenas significa** que o ZIP é estruturalmente coerente com o contrato
de metadados. Uma pessoa poderia fabricar um JSON coerente. Por isso, confira
independentemente o ID do artefato, a execução GitHub Actions, a branch, o SHA
do código e a conclusão dos jobs nativos antes de considerá-lo evidência. O
script não verifica assinatura de origem do GitHub nem abre o PDF original.

Nenhum boleto pagável, dado de cliente, documento real, credencial, cobrança ou
endpoint bancário pertence a esta etapa. Nenhuma aprovação de produção,
assinatura de distribuição, merge em `main`, release ou OTA é concedida.

`approvedForProduction=false`
`stableReleaseAllowed=false`
