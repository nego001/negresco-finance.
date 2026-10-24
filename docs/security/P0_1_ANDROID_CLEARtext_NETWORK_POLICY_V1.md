# P0-1 | Rede Android sem HTTP não criptografado

Revisão de laboratório empilhada sobre a PR #51. Não altera `main`,
não aciona uma release pública e não cria, lê nem publica credenciais.

## Risco

Informações financeiras podem ser interceptadas ou modificadas quando
clientes HTTP transmitem dados por conexões sem TLS. Em Android 9+ o
padrão para apps com target SDK moderno já bloqueia parte do tráfego
HTTP, mas atributos do manifesto e um arquivo de Network Security
Configuration podem reabrir exceções. A política não deve depender
apenas de valores implícitos do sistema operacional.

A partir de target API 38, o atributo
`android:usesCleartextTraffic` está em processo de obsolescência.
Uma configuração explícita `networkSecurityConfig` é o mecanismo
preferido para APIs compatíveis.

## Implementação

O novo plugin Expo local
`apps/mobile/plugins/withNegrescoNetworkPolicy.js`
é executado durante o prebuild, **depois** do plugin de backup.

Adiciona ao elemento `application`:

- `android:usesCleartextTraffic="false"`;
- `android:networkSecurityConfig="@xml/negresco_network_security"`.

O XML gerado é estrito:

```xml
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system"/>
    </trust-anchors>
  </base-config>
</network-security-config>
```

Não define exceções de domínios, `debug-overrides`, certificados
instalados pelo usuário ou confiança em CAs de depuração.

Um recurso preexistente com conteúdo diferente ou symlink
provoca falha, em vez de uma substituição silenciosa. Um
`networkSecurityConfig` diferente já declarado no manifesto
também bloqueia o plugin.

## Três verificações no pipeline

1. **Expo prebuild:** manifesto Android gerado deve conter os
   dois atributos; XML gerado deve coincidir byte a byte com a
   política do plugin.
2. **APK compilado:** `aapt dump xmltree` confirma que o
   `application` possui exatamente uma referência compilada
   `networkSecurityConfig=@0x...` e
   `usesCleartextTraffic` explicitamente `false`.
3. **Publicador privilegiado:** repete essas verificações no
   APK baixado, rejeitando referência ausente ou duplicada,
   IDs de recursos compartilhados com as regras de backup,
   e quaisquer flags de cleartext `true`.

Os testes simulados incluem versões adulteradas dos atributos,
configuração em texto, IDs duplicados, configuração concorrente,
alteração e symlink do arquivo XML. Os testes não abrem conexões
reais nem tornam a release pública.

## Limites

Network Security Configuration e o sinal `usesCleartextTraffic`
não constituem firewall universal: bibliotecas que abrem sockets
brutos podem ignorar a política, e versões Android antigas ou
implementações OEM podem ter comportamento próprio.
A revisão não adiciona *certificate pinning*, não avalia APIs
remotas e não garante criptografia ponta a ponta para todos os
canais. Continuam necessários testes reais de rede e TLS.

Fontes:
- https://developer.android.com/privacy-and-security/security-config
- https://developer.android.com/guide/topics/manifest/application-element
- https://mas.owasp.org/MASTG/tests/android/MASVS-NETWORK/MASTG-TEST-0235/

Gates: testes Node, CI Android 9/9, compilação do APK no SHA
final, job de publicação SKIPPED e aprovação humana para
qualquer integração ou lançamento.
