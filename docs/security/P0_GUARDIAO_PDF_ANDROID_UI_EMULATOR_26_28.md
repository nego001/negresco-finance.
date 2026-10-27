# P0 | Guardião: teste de compartilhamento real no Android 8 e 9

**Status: laboratório, não homologação do aplicativo financeiro.** Executa um teste real de interface do aplicativo instalado, não apenas mocks Node e não apenas o emulador de módulo nativo.

## APK exatamente fixado

- Fonte da compilação: PR #102, workflow Android `40573549033`, commit de código `f9cd4a5cc010750afbfdb69f6d333ccfac1b775a`.
- Artifato baixado de modo read-only via `actions/download-artifact@v4` e `run-id` fixo.
- SHA-256 do APK: `668fabea94131b41e5d4e50e3c1a543df2546da295981aefa1b3d77a66c43c88`. Verificado antes de instalar e novamente pelo script Python.
- Manifesto real sem `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `WRITE_EXTERNAL_STORAGE` e `SYSTEM_ALERT_WINDOW`. Assinado Android Debug e OTA preview unsigned, portanto não liberar produção.

## Teste em API 26 e API 28

1. Inicializar Android descartável, sem ligação com dispositivo real e sem enviar dados financeiros.
2. Instalar APK SHA-fixado e executar app offline com o bundle embarcado.
3. Abrir módulo **Guardião**, inserir linha de boleto **deliberadamente inválida** `000000…` de 47 dígitos, acionar verificação de estrutura e o botão PDF.
4. Confirmar que o Android realmente exibiu `ChooserActivity`/`ResolverActivity` em primeiro plano, falhando fechado se não houver evidência.
5. Publicar apenas relatório mínimo por API e SHA, sem screenshot, XML de interface, arquivo PDF ou dados de aplicativo, retenção de dois dias.

## Limitações rigorosas

Este primeiro smoke de interface **não demonstra** a recepção do conteúdo por outro aplicativo nem validade do PDF exportado. Pode falhar por problemas de UIAutomator ou animações, que devem ser diagnosticados e documentados sem transformar falhas em `PASS`. FLAG_SECURE do Guardião é preservado; não desabilitar proteções para fazer screenshot. O teste também **não prova** que todos os aparelhos Android antigos funcionam.

## Gates

- [ ] Contratos Node de escopo, hash, APIs e proibição de screenshots/produção.
- [ ] Emulador API 26: fluxo real até o seletor de compartilhamento.
- [ ] Emulador API 28: fluxo real até o seletor de compartilhamento.
- [ ] Validação de leitura real do PDF por um aplicativo receptor e integridade de `%PDF-`, em etapa futura.
- [ ] Revisão humana, OTA assinado ou embedded-only e release-signing antes de distribuição.

Não há secrets, assinatura estável, `publish`, `merge` ou OTA update neste fluxo.
