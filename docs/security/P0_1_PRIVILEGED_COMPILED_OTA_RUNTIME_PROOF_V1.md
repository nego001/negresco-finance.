# P0-1 | Reauditoria independente do runtime OTA no publicador

**PR draft empilhada sobre #63.** Sem merge na `main`, sem release,
sem permissao extra nos jobs de build e sem chaves privadas.

## Modelo de confianca

O build da #63 valida o AndroidManifest compilado e a tabela
`resources.arsc` antes de enviar o artefato. Uma release estavel deve
repetir esse controle sobre o **APK baixado** no publicador privilegiado,
sem confiar apenas no status do build ou em scripts que acompanham o
artefato.

O job `publish-test-prerelease` e exclusivo de
`workflow_dispatch` manual na `main` com `stable_signing` e
`publish_release` habilitados. Continua desabilitado nas branches
e PRs de laboratorio.

## Mudanca

O workflow contem um novo passo, antes de qualquer tag/release:
`Independently audit downloaded compiled OTA runtime resource`.

- Nao usa `actions/checkout` e nao executa codigo do APK/ZIP.
- Inclui o auditor Python inline no proprio workflow, nao em script
  confiado ao artefato; usa apenas o AAPT2 instalado no SDK do runner.
- Confere ZIP: exatamente um `AndroidManifest.xml` e
  `resources.arsc` regulares, com limites e sem duplicatas.
- Segue a referencia tipada `EXPO_RUNTIME_VERSION` no manifesto
  compilado ate o resource ID correspondente em `resources.arsc`.
- Exige somente `string/expo_runtime_version`, com um valor
  default `3.1.3` e nenhuma variante de idioma ou configuracao.
  A versao fixa e confiavel pertence a politica de publicacao
  independente, nao e lida de um arquivo recebido do build.
- Nega IDs trocados, nomes modificados, locais adicionais,
  versoes divergentes, valores indiretos e parser AAPT2 indisponivel.

## Testes

`tests/android-publisher-ota-runtime-proof.test.mjs` extrai o
**Python real do workflow**, verifica equivalencia exata com o
auditor de laboratorio e executa cenarios positivos e adversariais
com APKs ZIP e saidas simuladas do AAPT2.

Os testes Node nao usam `contents:write` nem criam releases. O
publicador real permanece `SKIPPED` neste ambiente de PR.
Alem do contrato sintetico e necessaria validacao com o APK real
pela CI Android da #63, seguida de revisao de codigo e homologacao
OTA assinada em dispositivos.

O app continua em canal `preview`, sem credenciais de assinatura
OTA de producao. Esta etapa nao autoriza publicar.
