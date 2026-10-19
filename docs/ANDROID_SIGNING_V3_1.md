# Negresco Finance V3.1 | Assinatura Android e atualização segura

**Estado:** caminho de assinatura persistente implementado no GitHub Actions, **não ativado**. Nenhuma chave de distribuição foi provisionada ou aprovada nesta tarefa. APKs de `push` e `Run workflow` com `stable_signing=false` continuam **Android Debug** e são apenas candidatos de teste.

## Por que isso é um gate da Fase 1

O Android só permite atualizar o mesmo pacote instalado quando a **identidade de assinatura é compatível**, além de observar as regras de versão do sistema. Trocar a chave de Debug por uma chave permanente **não consegue atualizar automaticamente o APK antigo**. Forçar desinstalação apagaria os dados locais e hoje não existe backup/migração de dados aprovado.

A V3.1 usa `com.negresco.finance`, `versionName=3.1.0` e `versionCode=31`. Cada atualização distribuída precisa de `versionCode` apropriado. Não promover qualquer build sem teste de upgrade no Samsung.

## Fluxos de compilação

| Gatilho | Assinatura | Resultado |
| --- | --- | --- |
| Push normal na `main` | Debug (padrão) | APK candidato. Nunca tratar como release definitiva. |
| GitHub Actions → Run workflow → `stable_signing=false` | Debug | APK candidato para teste. |
| GitHub Actions → Run workflow → `stable_signing=true` | Chave privada vinda dos Secrets | **Só funciona depois** de provisionamento; falha se faltar segredo ou o SHA-256 do certificado não corresponder ao valor fixado. |

O script `tooling/android/configure-release-signing.cjs` altera somente o bloco de assinatura **release** do Gradle gerado pelo Expo. Não incorpora senhas em código ou arquivos Gradle. O arquivo de chave é criado temporariamente no runner com nome fixo, excluído após a etapa de compilação e está coberto pelo `.gitignore`. A verificação final do APK usa `apksigner`; detecta certificado Debug usado indevidamente.

## Provisionamento pelo responsável pelo projeto (ainda não realizado)

1. Gerar uma **nova chave de distribuição Android** em máquina confiável usando `keytool` do JDK e uma senha longa; não reutilizar `debug.keystore`. Exemplo em PowerShell, com senhas solicitadas interativamente:

   ```powershell
   $keystore = Join-Path $HOME "negresco-finance-release.jks"
   keytool -genkeypair -v -keystore $keystore -storetype PKCS12 -alias negresco-finance-release -keyalg RSA -keysize 3072 -validity 3650
   ```

2. Guardar cópia offline cifrada do arquivo e credenciais em locais separados, com procedimento de recuperação documentado. **Perder essa chave pode impedir atualizações futuras** dos APKs distribuídos com ela.
3. No GitHub do **Negresco Finance**, em `Settings → Secrets and variables → Actions`, configurar como **Repository secrets**:
   - `NEGRESCO_RELEASE_KEYSTORE_B64`: bytes completos da keystore em Base64, sem quebras de linha.
   - `NEGRESCO_RELEASE_STORE_PASSWORD`: senha do arquivo.
   - `NEGRESCO_RELEASE_KEY_ALIAS`: alias da chave criada.
   - `NEGRESCO_RELEASE_KEY_PASSWORD`: senha da chave.
4. Configurar como **Repository variable** `NEGRESCO_EXPECTED_CERT_SHA256`, com os 64 caracteres hexadecimais da impressão digital SHA-256 **do certificado público**, sem dois-pontos; calculá-la localmente via `keytool -list -v -keystore ... -alias ...`.
5. Jamais enviar o arquivo `.jks`, seu Base64, senhas, credenciais ou comandos com senha explícita para chats, Issues, commits ou logs. Não desabilitar os gates de comparação se um build falhar.

## Critérios antes de considerar a assinatura permanente pronta

- [ ] Secrets e variável de fingerprint foram provisionados pelo proprietário.
- [ ] Um build `stable_signing=true` concluiu com sucesso e `APK-SIGNATURE.txt` corresponde exatamente à variável esperada.
- [ ] Um **segundo APK** foi produzido com a **mesma chave** e `versionCode` apropriado; atualização sobre o primeiro foi testada em Samsung sem perda de dados sintéticos.
- [ ] Foi demonstrado e documentado que uma instalação antiga **Debug** não pode ser automaticamente substituída pela primeira versão assinada com chave permanente.
- [ ] Plano de backup/migração e recuperação foi validado antes de qualquer transição em dispositivos que já contenham dados locais.
- [ ] Testes de segurança e proteção de dados continuam obrigatórios; certificado permanente não transforma o protótipo em aplicativo financeiro aprovado.

**Não ativar SQLCipher nativo por causa deste documento.** Segurança do banco e assinatura do APK são gates independentes.
