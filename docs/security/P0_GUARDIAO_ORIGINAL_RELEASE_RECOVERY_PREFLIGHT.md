# P0 Guardião — preflight de recuperação autorizada do APK Release histórico

## Estado verificado

O arquivo do workflow histórico [#40617164086](https://github.com/nego001/negresco-finance./actions/runs/40617164086) retornou **zero artefatos disponíveis** na listagem consultada. Portanto, não há cópia comprovada para reexecutar o P0 #120 no APK original. Nenhum APK de teste v5 ou build reconstruído é substituto para o SHA-256 histórico `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`.

## Preflight opcional do dispositivo pertencente ao usuário

Só considerar esta opção **se o próprio usuário confirmar que o APK antigo está atualmente instalado num dispositivo ao qual tem autorização de acesso e aprovar explicitamente a consulta via ADB**. Não instalar, desinstalar, atualizar nem limpar dados do aplicativo para tentar recuperá-lo. Usar somente ferramenta local `tooling/android/guardiao_recover_original_apk_from_device.py`, com `adb -s <serial> shell pm path com.negresco.finance` e `adb -s <serial> pull <instalacao-base.apk> <candidato-temporario>`. A ferramenta rejeita paths com múltiplos APKs/splits, travessia ou caminhos de dados privados. Não executar ADB sem autorização do proprietário.

Num terminal de computador Linux com ADB instalado, criar diretório privado novo, por exemplo com `mkdir -m 700 -p ~/Documentos/guardiao-apk-recuperacao`, e selecionar um **arquivo de destino que ainda não existe**. Usar a identificação ADB local do dispositivo autorizado e executar a CLI passando seu serial e caminho novo, sem colocar credenciais nos argumentos. **Não colar no chat o serial ADB, nomes privados do dispositivo ou caminhos reais.** Em caso de recusa, interromper; não usar root, extração de dados do app ou bypass de permissões. O script só reporta `PASS (LAB)` se verificar o SHA original e a estrutura ZIP/APK duas vezes; saída usa modo privado 0600 e um arquivo parcial é descartado.

O verificador de cópia offline `python3 tooling/android/guardiao_verify_original_apk_offline.py <arquivo-novo.apk>` pode ser usado depois. PASS prova **identidade de bytes e integridade estrutural**, nunca que o APK é seguro para produção, que impressão funciona ou que foi aplicado um conserto. Nenhum APK deve ser anexado ou publicado sem decisão expressa do proprietário.

## Contratos adversariais novos (offline)

A suíte `tests/guardiao-original-release-recovery-adversarial.test.mjs` simula a execução de `pm path` e `adb pull` **sem tocar em nenhum dispositivo**. Ela cobre: caminho único do APK base, recusas de split/travessia/path privado, duas verificações de integridade, permissão 0600, preservação de arquivos já existentes e descarte de cópia parcial quando a segunda checagem falha. Os dados de simulação usam bytes fictícios, não um APK real; o verificador de produção continua fixado no SHA histórico.

## Critérios de bloqueio

Se o usuário não tiver o APK antigo instalado em dispositivo autorizado, a investigação do binário original permanece **bloqueada por ausência de custódia**, mesmo que a CI passe. Não reconstruir APK, não tentar cópia de outros aplicativos e não substituir pelo candidato Debug. A issue #126 é distinta: seus bloqueios de navegação após PDF já verificado não equivalem a travamento de Print do Release histórico.

P0 #120 e #126 OPEN, PR #125 Draft, `approvedForProduction=false`, `stableReleaseAllowed=false`, main intocada. Sem dados financeiros reais, assinatura nova, merge, OTA ou pagamentos.
