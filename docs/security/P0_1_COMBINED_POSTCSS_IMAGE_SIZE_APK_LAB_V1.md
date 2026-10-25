# P0-1 | APK isolado PostCSS + image-size

PR DRAFT empilhada sobre #74. Não há mudança no
`apps/mobile/package.json` versionado, nem em `main`. Não
publica APK, não usa assinatura estável nem secrets de release.

## Antecedentes

A #72 reduziu avisos npm de 8 para 6 utilizando
`postcss@8.5.23`, com apenas um pacote alterado.
A #74 reduziu de 6 para 5 HIGH adicionando
`image-size@2.0.3`; o único efeito transitivo adicional foi
a remoção comprovada do pacote `queue@6.0.2`, dependência
órfã exclusiva da versão anterior do image-size.

A #74 aprovou `npm ci`, TypeScript e Expo prebuild; faltava
compilar e auditar o APK Android completo com ambos os ajustes.

## Passos deste laboratório

O workflow `.github/workflows/image-size-major-lab.yml` passa
a responder também à branch
`lab/p01-postcss-image-size-combined-apk-v1` e acrescenta:

1. O job `assemble-combined-lab-apk`, dependente do smoke, baixa
   o lockfile do mesmo workflow, confere seu SHA-256 e exige
   diff exato (`image-size 1.2.1→2.0.3`, remoção de
   `queue 6.0.2` e base com PostCSS corrigido).
2. Aplica os dois overrides somente no runner e instala
   dependências com `npm ci`, roda TypeScript e gera Android
   com Expo prebuild, respeitando as travas de OTA.
3. Gera `assembleRelease` **com assinatura Android Debug**,
   sem keystore real; verifica ZIP, assinatura, runtimeVersion
   compilada 3.1.3, canal preview, endpoint Expo e o arquivo
   `assets/app.config` contido no APK.
4. Publica somente um artefato temporário de laboratório com
   APK, manifesto SHA-256 e relatório do candidato.
5. O job `reverify-downloaded-combined-apk`, em execução
   separada e somente leitura, baixa o APK da mesma execução,
   recusa caminhos ou checksums alterados e repete verificação
   da assinatura, superfície Android e runtimeVersion/OTA compilados.

## Limites

O APK não possui assinatura estável nem assinatura de código OTA
remoto; serve exclusivamente como evidência de compatibilidade.
A análise npm ainda aponta **5 avisos HIGH**, incluindo
`node-forge`. Não existe base para declarar release segura,
reprodutibilidade binária plena ou ausência de exploração.
Qualquer adoção futura depende de revisão independente e da
homologação Android integral.
