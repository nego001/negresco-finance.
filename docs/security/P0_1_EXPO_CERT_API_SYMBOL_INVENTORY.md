# P0-1 | Referências às funções de certificados Expo no npm exato

PR Draft sobre #91. Esta análise inspeciona os arquivos JS/TS de pacotes
realmente instalados no `npm ci --ignore-scripts` isolado do laboratório.
Conta referências textuais a `validateSelfSignedCertificate`,
`signBufferRSASHA256AndVerify`, `generateDevelopmentCertificateFromCSR`,
`generateCSR`, `generateKeyPair` e conversores de certificados/chaves.
Distingue menções simples, sintaxe de chamada, sintaxe de membro,
declaração de função e arquivos com o nome.

Dois runners independentes reproduzem todos os hashes do lockfile e
das árvores de fontes da PR #90, recalculando um JSON idêntico.
Somente contagens e hashes agregados são publicados. Não há
execução das bibliotecas auditadas, manipulação de chaves, fontes
brutas ou nomes de arquivos.

**Isso não é análise de fluxo de dados, grafo de chamadas, teste de
exploração nem prova de execução.** A contagem de chamadas também pode
incluir declarações e comentários. Uma função visível não prova
que o `expo prebuild` a utiliza ou aceite dados não confiáveis.
A verificação de certificados e CSR pode ser invocada por aliases.
A versão estável permanece bloqueada pela GHSA-86w9-cpqp-85rv
e pelos cinco registros HIGH. Não aprovar APK por este resultado.
