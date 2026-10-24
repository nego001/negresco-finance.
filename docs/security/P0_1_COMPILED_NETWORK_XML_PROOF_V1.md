# P0-1 | Conferência do XML de rede compilado no APK

Esta revisão, empilhada sobre a PR #52, acrescenta uma prova
independente da configuração de rede realmente incorporada
no binário Android. Não altera `main`, não cria releases
e não acessa credenciais financeiras.

## Falha de cobertura

A PR #52 verifica os bytes do XML criado no Expo prebuild e
a referência `networkSecurityConfig=@0x...` no AndroidManifest
compilado. Isso não demonstra, isoladamente, que o ID aponta
para um XML binário com `cleartextTrafficPermitted=false`
e somente CAs de sistema. Uma sobreposição posterior ao prebuild
poderia introduzir exceções HTTP ou certificados confiáveis extras.

## Nova verificação

A execução do build Android usa
`tooling/android/verify_compiled_network_policy.py` com o
`aapt2` dos Android build-tools do runner, sobre o APK
**já assinado**, antes de gravar os artefatos:

1. Extrai do `AndroidManifest.xml` compilado o ID numérico
   de `networkSecurityConfig` do elemento `application`.
2. Resolve exatamente esse ID na tabela `resources.arsc`,
   exigindo o recurso `xml/negresco_network_security`,
   sem assumir um caminho fixo dentro do ZIP Android.
3. Exige que o caminho resultante exista uma única vez
   no APK, como arquivo regular, não vazio e limitado.
4. Decodifica o XML compilado com `aapt2 dump xmltree
   --file <caminho-resolvido>`.
5. Exige apenas a estrutura `network-security-config`,
   `base-config`, `trust-anchors` e `certificates`;
   `cleartextTrafficPermitted` explicitamente booleano
   `false`; e exatamente uma fonte de certificados `system`.

Rejeita configurações específicas por domínio,
`debug-overrides`, CAs do usuário, hashes XML ambíguos,
referências trocadas, metadados inválidos e falhas no
`aapt2`. Qualquer falha impede o upload de candidato
para o publicador.

## Testes

`tests/android-compiled-network-policy.test.mjs` executa
o verificador Python real contra APKs ZIP sintéticos e
saídas `aapt2` simuladas. Inclui casos de adulteração
do ID, recurso, caminho, XML, emissor, HTTP e de exceções.

A PR #52 continua exigindo que o publicador privilegiado
reconfirme o ID do recurso, `usesCleartextTraffic=false`,
assinatura e SHA-256, sem executar scripts contidos
nos artefatos.

## Limites

A implementação verifica a configuração declarativa compilada,
mas não equivale a monitoramento de rede e não bloqueia
bibliotecas nativas que ignoram a API de segurança de rede.
Como saídas de `aapt2` dependem da versão da ferramenta,
a CI do APK **deve** confirmar compatibilidade usando
um APK verdadeiro antes de integrar.

Referências:
- https://developer.android.com/tools/aapt2
- https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0151/

Gates: Node, nove jobs Android, APK da revisão final,
publicação SKIPPED e revisão humana independente.
