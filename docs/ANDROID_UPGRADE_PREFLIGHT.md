# Negresco Finance | Verificação de atualização no Samsung (somente leitura)

**Estado:** script Windows para diagnóstico, **não executado no Samsung nesta sessão**.
Ele não instala, desinstala, limpa nem grava arquivos no celular. Requer Android SDK
**Platform Tools** (`adb`) e **Build Tools** (`aapt`, `apksigner`) no Windows.

## Antes de instalar a versão 3.1.2

No PowerShell, atualize o clone do **Negresco Finance** e execute após ler o script:

```powershell
$projeto = Join-Path $HOME "negresco-finance"
git -C $projeto pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "Falha no git pull" }

$script = Join-Path $projeto "tooling\windows\compare-installed-apk.ps1"
$tokens = $null
$erros = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
  $script, [ref]$tokens, [ref]$erros
)
if ($erros.Count -gt 0) { throw ($erros -join "; ") }

$apk = Join-Path $HOME "Downloads\Negresco-Finance-V3.1-candidate.apk"
powershell.exe -NoProfile -File $script -ApkPath $apk
```

**Ajuste o caminho do projeto** para a pasta real onde você clonou o Negresco
Finance, e o caminho `$apk` para o arquivo efetivamente baixado. O programa
nunca usa um download de origem desconhecida e não pressupõe que exista
qualquer arquivo nesse caminho.

## O que é conferido

1. Integridade do APK via `apksigner`, código/nome da versão, pacote Android
   obrigatório `com.negresco.finance` e SHA-256 do arquivo.
2. Uma conexão ADB autorizada com exatamente um aparelho. Não publica serial.
3. Se existe instalação antiga, lê somente o caminho do código público
   `base.apk` e copia **temporariamente ao PC** para examinar assinatura.
   O arquivo temporário é apagado ao final, inclusive em caso de falha.
4. Compara identidade do certificado SHA-256 e exige um `versionCode` maior.
   Diferenças retornam erro **sem realizar instalação**.

A verificação é conservadora. Mudanças legítimas de identidade de assinatura
com *signing lineage* e `versionCode` igual são tratadas como não comprovadas.
Mesmo um resultado de compatibilidade provável **não garante** atualização:
o Android pode impor outras restrições. Sem backup/migração confiáveis,
nunca desinstale um APK que contenha dados locais para forçar outra instalação.

## Segurança

O script não coleta dados de boletos, contas, histórico, chaves, token, CNPJ,
nem acessa o diretório privado do aplicativo. A única cópia local é do APK
instalado, sem arquivos de usuário. Execute com dados fictícios e não
compartilhe screenshots com serial, logs privados ou conteúdo financeiro.

**SQLCipher nativo e zero-knowledge permanecem requisitos exclusivos do
Negresco Finance e não são ativados por esse teste.**
