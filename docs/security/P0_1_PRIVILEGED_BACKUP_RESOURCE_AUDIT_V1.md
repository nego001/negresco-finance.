# P0-1 | Auditoria independente das regras de backup na publicação

Revisão de laboratório empilhada sobre a PR #50. Nenhuma release foi
publicada, nenhum segredo consultado, nenhuma alteração na `main`.

## Lacuna

A PR #50 valida os arquivos de política que o Expo gera para backup em
nuvem e transferência entre dispositivos, e confere que o APK compilado
referencia recursos válidos. O job com autorização para publicar, porém,
ainda validava apenas `allowBackup=false` e não exigia novamente a
presença das duas referências no APK baixado.

Em um projeto financeiro, a transição para uma release pública deve
falhar se o manifesto do binário recebido não referenciar as políticas
de exclusão tanto no Android 12+ quanto no Android 11 e anteriores.

## Reforço

Dentro do publicador, antes de verificar a assinatura e muito antes de
criar uma tag, o comando `aapt dump xmltree` continua analisando o
`AndroidManifest.xml` compilado, mas passa a exigir também:

- **Exatamente uma** referência de recurso compilado
  `android:dataExtractionRules`;
- **Exatamente uma** referência de recurso compilado
  `android:fullBackupContent`;
- Formato `@0x...` de referência Android válida, rejeitando strings,
  campos vazios e atributos duplicados;
- IDs distintos para os recursos moderno e legado;
- Atributos encontrados exclusivamente no elemento `application`,
  nunca em componentes filhos.

As checagens anteriores do publicador para `allowBackup=false`,
`debuggable`, `testOnly`, pacote/versão, biometria, assinatura, ZIP,
SHA256, tag e imutabilidade seguem intactas.

Os testes executam o trecho privilegiado real com `aapt` simulado e
cenários adversariais de referência ausente, duplicada, malformada,
reutilizada ou posicionada em atividade aninhada.

## Limites e gates

A auditoria prova que o manifesto compilado contém **referências** aos
recursos XML esperados. O conteúdo exato dos XML gerados continua sendo
validado pela CI da PR #50; a política carregada pelo sistema e o
comportamento de transferência real em diferentes fabricantes ainda
exigem avaliação específica.

A publicação real continua limitada a um despacho manual em `main`,
com assinatura estável, certificado fixado e os controles de
imutabilidade habilitados. Uma aprovação no teste simulado não autoriza
qualquer publicação.

Gates: suíte Node completa, CI Android 9/9 e APK do SHA final.
