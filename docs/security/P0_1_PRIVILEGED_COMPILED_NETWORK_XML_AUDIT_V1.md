# P0-1 | Auditoria independente do XML de rede no publicador privilegiado

Esta etapa complementa a PR #53 do Negresco Finance. O fluxo de
compilação já verifica o XML de segurança de rede **compilado dentro
do APK**, em vez de confiar somente no código de origem, na
configuração Expo ou no manifesto.

## Ameaça coberta

O job privilegiado que eventualmente publica uma release baixa um
artefato do job de compilação. Ele já revalida manifestos de checksum,
assinatura, pacote, versão, certificados, ZIP, flags de backup, IDs das
regras de extração e a referência de `networkSecurityConfig`.

Antes desta etapa, o publicador não revalidava o **conteúdo do XML
compilado**. Uma eventual divergência no artefato ou uma futura regressão
entre build e publicador só seria detectada pela etapa de build.

## Implementação

Um passo novo, `Independently audit downloaded compiled network XML`,
roda no **próprio job privilegiado**, depois da reverificação do APK
baixado e **antes** de criar o rascunho da release, tags ou assets.

O código Python é declarado diretamente no workflow revisado. O
publicador não faz checkout de código e não executa scripts trazidos
pelo arquivo APK ou por artefatos fornecidos pelo job de build.

O passo exige:

- Presença do `aapt2` nas ferramentas Android do runner;
- Uma aplicação e uma referência válida `networkSecurityConfig` em
  `AndroidManifest.xml` compilado;
- Resolução **única** do ID na tabela `resources.arsc`, correspondendo
  a `xml/negresco_network_security`;
- Um único XML de destino regular, não vazio e de tamanho limitado
  dentro do ZIP APK;
- Estrutura estrita de quatro elementos
  `network-security-config > base-config > trust-anchors > certificates`;
- `cleartextTrafficPermitted` exatamente `false`, aceitando somente
  formatos de saída conhecidos do `aapt2`;
- Uma única fonte de certificados `system`, proibindo certificados de
  usuário, exceções por domínio ou `debug-overrides`.

Falhas interrompem o processo **antes de qualquer operação de
publicação**, sem modo permissivo e sem tocar em ativos remotos.

## Evidências e limites

`tests/android-publish-compiled-network-xml.test.mjs` executa o código
Python **retirado literalmente do passo do workflow** com `aapt2`
simulado, APKs ZIP sintéticos e variações maliciosas. Os testes
existentes do verificador de assinatura foram isolados do novo passo,
preservando a responsabilidade de cada controle.

Como o passo só é habilitado em despachos manuais sobre `main`, uma
CI de uma branch laboratório confirma os **testes da lógica e o APK de
teste**, mas não executa uma publicação real nem simula credenciais
de produção. São necessárias revisão humana e autorização explícita
antes de qualquer despacho manual ou integração.

Esta auditoria não intercepta conexões de rede efetivas e não protege
bibliotecas que ignorem Android Network Security Configuration.

Referências: PR #53; `tooling/android/verify_compiled_network_policy.py`;
https://developer.android.com/tools/aapt2

Gates: contratos Node completos, 9/9 jobs Android, APK de teste
compilado, job de publicação SKIPPED, revisão de segurança.
