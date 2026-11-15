## Alternativa: cópia original ainda instalada em um aparelho de teste

Caso um Android tenha **o mesmo Negresco Finance V3.1.3 original** instalado, a localização do código instalado poderá ser consultada via ADB sem ler dados financeiros, permissões pessoais ou arquivos internos do app. O Android pode negar a leitura e uma instalação atualizada ou com APKs divididos será rejeitada.

**Execução opcional e iniciada manualmente pelo proprietário, em um computador autorizado:**

```bash
python3 tooling/android/guardiao_recover_original_apk_from_device.py "SERIAL_ADB" "/pasta/privada/Negresco-Finance-V3.1.3-original.apk"
```

O procedimento limita os comandos ao pacote `com.negresco.finance`: `adb shell pm path` e, se houver um único `base.apk` em `/data/app`, um `adb pull` desse arquivo para diretório temporário privado. **Não** usa `adb install`, `run-as`, root, backup do sistema, extração de dados privados, `pm clear` ou reinicialização. Usa o verificador offline de SHA-256 fixo, estrutura do APK e verificação da cópia após salvar. Só cria o arquivo de saída pedido se a cópia temporária for idêntica ao SHA do original. Nunca sobrescreve arquivos existentes e remove cópia parcial na falha.

**Limites:** o caminho e a disponibilidade do APK instalado variam com o aparelho e a versão do Android; o acesso por ADB pode ser negado; uma instalação split/base diferente pode não corresponder ao artefato original. O script não tenta contornar essas restrições. Mesmo um PASS comprova identidade de bytes, não aprovação de produção.

Não execute se o aparelho não for seu ou se o usuário não tiver autorizado a depuração USB. Não conecte a dispositivos desconhecidos. A instalação original não será modificada.
