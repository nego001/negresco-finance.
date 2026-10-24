# P0-1 | Identidade do APK verificada também no publicador

Esta revisão de laboratório é empilhada na PR #47. Não publica releases,
não altera a branch `main` nem gerencia credenciais.

## Lacuna

O job de build já usa a ferramenta Android `aapt` para confirmar
`com.negresco.finance`, `versionCode=34`, `versionName=3.1.3`
e a permissão `USE_BIOMETRIC`. A etapa privilegiada, no entanto,
analisava principalmente a assinatura e o ZIP após baixar o artefato.
Um certificado válido, por si só, não identifica o pacote ou sua versão.

## Correção

Antes da verificação `apksigner`, o job de publicação obtém o
`aapt` dos Android build-tools confiáveis do runner, executa
`dump badging` e `dump permissions` sobre o **APK baixado**
e faz validações estritas em Node inline:

- Exatamente uma linha `package:`, com identificação
  `com.negresco.finance`, versão de código `34` e versão
  de exibição `3.1.3`;
- Exatamente uma entrada `uses-permission` para
  `android.permission.USE_BIOMETRIC`;
- Qualquer arquivo malformado, `aapt` ausente ou comando com
  erro bloqueia o fluxo antes de criar tags e releases.

O script não é obtido do artefato: está incorporado na etapa
de workflow revisada e o job continua **sem checkout**.

## Evidências de testes

A suíte extrai o shell real de reverificação privilegiada e
executa fixtures sintéticas com `aapt` e `apksigner` falsos.
Confere sucesso, pacote diferente, versionCode e versionName
incorretos, duas linhas de package, badging inválido,
permissão biométrica ausente/duplicada e binário `aapt`
indisponível. Nenhuma fixture contém APK real.

A proteção não substitui a inspeção do surface APK do job de
build, assinatura estável com certificado fixado, a verificação
do manifesto SHA256, o ZIP, a identidade Git ou os digests
dos quatro assets REST.

## Limitações e gates

A análise cobre identificador/versão/permissão expressamente
esperados, não a lista completa de permissões do Android nem
uma avaliação funcional de instalação. Antes de qualquer
publicação, a CI de contratos, build Android e a matriz de
emuladores do SHA final devem passar; a configuração de
releases imutáveis e a credencial de leitura precisam de
aprovação administrativa separada.
