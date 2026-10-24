# P0-1 | Bloquear publicação de APK assinado em modo Debug

O `android-apk.yml` permite montagens de teste com assinatura Android
Debug em push de branch, mas a opção manual `publish_release=true` na
`main` ainda podia ser selecionada com `stable_signing=false`.
Nesse cenário um APK Debug poderia ser enviado como GitHub Release.

Agora o job de publicação exige simultaneamente `workflow_dispatch`,
branch `main`, `publish_release=true` e `stable_signing=true`.
A tentativa de publicação sem assinatura estável falha explicitamente
no build. O job compilador continua com `contents:read`, enquanto
somente o job manual de publicação pode obter `contents:write`.

Os segredos de assinatura estável são condicionados ao acionamento
manual na `main`; a etapa `apksigner` confere o certificado esperado
por SHA-256 e recusa identidade Android Debug no modo estável. Testes
Node asseguram a existência das barreiras. **Não há publicação real
autorizada nem teste da via manual nesta fase.** Ainda faltam QA em
hardware e autoridade de chaves financeira real.
