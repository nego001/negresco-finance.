# P0-1 | Revalidação independente no job privilegiado de publicação

**Escopo:** PR draft empilhada sobre #35, sem mudança na main e sem executar
publicação. O candidato Android de push continua descartável e assinado
com Android Debug; não recebe permissão de escrita.

## Risco tratado

O job que compila o APK verifica o certificado fixado e compara o ZIP,
mas o job separado que recebe `contents:write` até então só conferia
checksums que acompanhavam o próprio artefato baixado. Checksums
autodeclarados não provam a identidade do certificado Android, nem impedem
substituição consistente de APK + manifesto antes de publicar.

## Defesa acrescentada

Após baixar o candidato e conferir hashes, o job de publicação:

1. Exige que todos os cinco arquivos de distribuição sejam regulares,
   não sejam symlinks e não estejam vazios.
2. Invoca `apksigner verify --verbose --print-certs` **novamente** sobre
   o APK efetivamente baixado e exige **exatamente um certificado de
   assinante**, com SHA-256 igual à variável fixa
   `NEGRESCO_EXPECTED_CERT_SHA256`.
3. Compara também o certificado declarado em `APK-SIGNATURE.txt`
   com a mesma identidade e rejeita certificados Android Debug.
4. Reabre o ZIP e valida lista estrita de nomes, ausência de symlinks,
   arquivos especiais e criptografia, métodos de compressão conhecidos,
   limites de tamanho e razão 200:1; compara o APK dentro do ZIP, o
   relatório de assinatura e o SHA original com as versões externas.
5. Apenas após essas verificações pode alcançar o comando `gh release`.

O código de revalidação é embutido no próprio workflow: **não há
`actions/checkout` nem execução de scripts baixados de artefatos no
job que possui `contents:write`.**

## Testes e limites

`tests/android-publish-artifact-reverification.test.mjs` executa o
bloco exato de auditoria do workflow com ferramenta `apksigner`
simulada e ZIPs de teste: fluxo nominal, fingerprint incorreto, Debug,
assinatura múltipla, APK divergente, symlink e compressão anormal.

O teste simulado valida os bloqueios, mas **não comprova integração
do job de publicação com o SDK ou chaves reais**. O job privilegiado
continua propositalmente SKIPPED em branches. A compilação Android
real e todos os gates CI devem passar no SHA final antes de considerar
integração. Nenhum `workflow_dispatch` com publicação será acionado
sem autorização explícita do titular.
