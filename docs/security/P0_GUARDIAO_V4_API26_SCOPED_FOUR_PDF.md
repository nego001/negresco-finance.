# Negresco Finance | Guardião candidato v4 — Android 8 API26: quatro PDFs em um PID

**Evidências anteriores (experimentais, não produção):**
- [Android9 API28 integrado #43777952185](https://github.com/nego001/negresco-finance./actions/runs/43777952185) SUCCESS: A/B/C/D, três voltas Home, geometria de três abas antes/depois, PID preservado.
- [Android9 API28 3/3 repetibilidade #43780147915](https://github.com/nego001/negresco-finance./actions/runs/43780147915) SUCCESS: 12 PDFs sintéticos e nove retornos Home.
- [Android8 API26 PDF individual #43781271000](https://github.com/nego001/negresco-finance./actions/runs/43781271000) SUCCESS: um arquivo sintético recebido, renderizado, conteúdo verificado e cache limpo.
- [CI #43781270717](https://github.com/nego001/negresco-finance./actions/runs/43781270717) SUCCESS: 1.458/1.458.

## Escopo deste laboratório

Comparar também a persistência de processo e repetibilidade no **Android 8/API26** com o mesmo candidato v4 experimental, não com o Release histórico, e sem compilar novo APK. APK fixado no [build #43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643) SHA-256 `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`, certificado `CN=Android Debug`.

Duas camadas isoladas:
- O core adapta o runner v4 API28, mantendo os quatro ciclos sintéticos A/B/C/D, um único PID sem reinstalação, receptor independente, semântica de cada página, limpeza de cache e snapshot do Home real. Usa somente a função API26 que já passou no teste individual.
- O wrapper impõe geometria scoped de Início/Pix/Negresco **antes da primeira exportação**, e **duas leituras antes/depois** de cada um dos três retornos Home. Caso o layout API26 seja diferente/incomprovável, o job deve **BLOCK**, sem afrouxar geometria nem usar um toque substituto.

Nenhum retorno é forçado por tecla BACK, swipe ou coordenada arbitrária. Os wrappers restauram os métodos originais mesmo após falha. Sem PDF privado, screenshot, UI XML, logcat, exceções Android ou dados reais nos logs. Não há publicações, OTA, APK de produção ou alteração na main.

**Critério:** um job Android API26 concluído SUCCESS **e** todos os quatro PDFs e três voltas Home explicitamente confirmados nos logs (se não houver provas completas, permanece BLOCK). Não extrapolar sucesso ao Release histórico original, indisponível após expiração do artefato.

**Segurança:** issue #120 e #126 OPEN, PR #125 DRAFT/unmerged, `approvedForProduction=false`, `stableReleaseAllowed=false`. O defeito intermitente original de impressão permanece investigação separada.
