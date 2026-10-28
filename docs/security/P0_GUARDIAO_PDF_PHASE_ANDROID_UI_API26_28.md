# P0 | Guardião: diagnóstico real de erro PDF no Android 8 e 9

## Contexto verificável
- PR #103, execução real `40591200018`: API 26 alcançou o botão e informou falha genérica de exportação; API 28 não exibiu seletor. A mensagem agrupava renderização e compartilhamento.
- PR #104, `40592242061`: Android APK compilado em commit `83cd54f9d2ded0f0468f960811147f9bf459e053`, com fase de erro estática `print`, `invalid-uri`, `availability` ou `share`. O build e a reauditoria independente passaram 2/2. PR #104 HEAD posterior `cd08521adfcf845f47873932e85cec87fc8e3d0e` apenas alterou testes e documentação.
- Artefato `12774118899`, ZIP SHA-256 `57970de71c611655cf34b498885ac307f8399585b1f4c2bba2eeca37888f92f5`; APK SHA-256, verificado diretamente lendo o ZIP, **`642707ba661fa2b5bc547225b49587827b47de6412634211164338aa63388f19`** (61.367.269 bytes, 720 entradas). Manifesto SHA-256 `b2febd86130c30449af94501678d4b6d52467e443c3a305c54d7095a4a823166` (mesmo manifesto da PR #102). Certificado **Android Debug**, OTA preview unsigned.

## Ação do laboratório
Apenas em branch e GitHub Actions com acesso de leitura:
1. `actions/download-artifact@v4` recupera o artefato específico da run exata `40592242061`, abortando se SHA do APK não corresponder ao fixado acima.
2. Android 8 (API 26) e Android 9 (API 28) descartáveis, offline, sem permissões financeiras. Inserir **47 zeros sintéticos deliberadamente inválidos**, validar a mensagem de resultado na tela e acionar botão de PDF quando visível.
3. Ler somente **booleanos de mensagens públicas fixas** para separar falha de renderização `print`, URI inválida, disponibilidade e compartilhamento nativo. Nunca capturar dump XML, logcat, screenshot, URI gerada, PDF nem entrada sensível.
4. Abertura do verdadeiro ChooserActivity/ResolverActivity permanece a única condição de aprovação do smoke. Mensagem de erro é **BLOCK**, não PASS.
5. Upload apenas do resumo sem PII se houver PASS e retenção 2 dias. Nada de release, merge ou OTA.

## Gates
- [ ] Contratos e testes do Guardião, incluindo verificação da identidade do APK e ausência de dados nos logs
- [ ] Emulador API 26 com resultado classificado e, se possível, chooser
- [ ] Emulador API 28 com resultado classificado e, se possível, chooser
- [ ] Receptor de teste independente comprova PDF íntegro em etapa posterior
- [ ] Assinatura release, OTA assinada ou embedded-only e revisão humana para produção

**Importante:** classificação de erro neste laboratório não significa que o PDF foi reparado. Produção segue expressamente bloqueada (`approvedForProduction=false`, `stableReleaseAllowed=false`).
