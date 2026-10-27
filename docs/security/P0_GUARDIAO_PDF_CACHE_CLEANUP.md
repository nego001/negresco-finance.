# P0 | Descarte restrito de PDFs temporários do Guardião

Laboratório experimental baseado na PR #100. **Não aprova produção.**

## Evidência de origem do caminho

No Expo SDK 54, o arquivo nativo Android `packages/expo-print/android/src/main/java/expo/modules/print/FileUtils.kt`, no branch oficial `sdk-54`, constrói os PDFs em `context.cacheDir/Print/<UUID>.pdf`. O helper tenta apagar **somente esse formato exato**, sob o diretório `FileSystem.cacheDirectory` fornecido pelo próprio runtime do aplicativo, sem navegar acima do cache, sem aceitar URI remota/SAF e sem apagar diretórios.

O módulo `expo-file-system/legacy` foi usado explicitamente porque SDK 54 migrou as operações antigas da API principal para o namespace `/legacy`. Dependência direta `expo-file-system:~19.0.24` corresponde à versão atualmente publicada no branch upstream `sdk-54`. O manifesto Android versionado segue bloqueando `SYSTEM_ALERT_WINDOW` e `WRITE_EXTERNAL_STORAGE`; o APK compilado precisa provar que essa configuração continua eficaz após a inclusão da dependência.

## Comportamento

- Após `printToFileAsync`, se a autorização foi revogada por navegação, bloqueio, background, edição do boleto/CNPJ ou operação concorrente, tentar limpar **apenas o PDF daquele request**.
- Se não há compartilhamento disponível ou o arquivo local não passa pela validação, tentar o mesmo descarte restrito.
- **Nunca** apagar um arquivo caso `Sharing.shareAsync` tenha sido invocado, inclusive se o seletor falhou ou o usuário cancelou, pois o recebedor pode precisar de acesso após o retorno.
- Não há varredura de cache, exclusão de pastas, remoção de arquivos antigos indiscriminada, dados reais ou tentativa de revogar share já iniciado.
- Falhas de limpeza não substituem o resultado de segurança da operação nem aparecem como sucesso falso ao usuário. Um erro do renderizador antes de retornar URI pode deixar resíduo fora do alcance desta limpeza, e um arquivo cujo compartilhamento foi iniciado pode permanecer no cache. Ambos são limites reconhecidos.

## Gates

- [ ] Testes Node com entradas sintéticas, incluindo 14 novos casos de caminho fora do cache, travessia, contenção, erros e ciclo de vida.
- [ ] Verificação TypeScript e pipeline Android.
- [ ] Manifesto compilado do APK sem `SYSTEM_ALERT_WINDOW` e `WRITE_EXTERNAL_STORAGE`, mas mantendo `INTERNET` e `USE_BIOMETRIC`.
- [ ] Runner independente verifica novamente as declarações do APK baixado.
- [ ] Testes reais de geração e compartilhamento PDF Android 8 e 9 (API 26/28), antes de divulgação.
- [ ] Revisão humana e assinatura segura de OTA/release.

## Restrições

O teste sintético da limpeza não prova execução nativa correta de `expo-file-system`, nem proteção do conteúdo em um aplicativo terceiro após compartilhar. O aplicativo segue com OTA preview sem assinatura e APK Debug; `stableReleaseAllowed=false`, sem merge, distribuição financeira, publicação ou atualização OTA.
