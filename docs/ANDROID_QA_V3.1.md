# Negresco Finance V3.1 | Roteiro de homologação no Samsung

**Escopo:** APK candidato para testes. Este roteiro não autoriza pagamentos e não exige dados bancários, CPF ou boletos reais.

## Antes de instalar

- [ ] Baixar o APK de um [GitHub Release oficial do repositório](https://github.com/nego001/negresco-finance./releases), conferir a tag/commit e o SHA256 publicado.
- [ ] Confirmar no GitHub Actions que **Android APK**, **CI** e **Mobile static check** passaram para o commit correspondente.
- [ ] Comparar o certificado em **APK-SIGNATURE.txt** com o APK já instalado antes de presumir que é possível atualizar sem reinstalar. Não confundir assinatura tecnicamente válida com identidade de assinatura estável.
- [ ] Se o Android recusar instalar sobre um APK antigo por assinatura diferente, **não desinstalar antes de decidir o que fazer com os dados locais**. O aplicativo não oferece backup/migração garantidos.
- [ ] O APK V3.1 desabilita o backup automático do Android: anotar que **reinstalar pode apagar histórico e preferências**, pois ainda não existe migração segura.
- [ ] Registrar modelo do Samsung, versão Android, tag do APK e resultado da instalação. Não capturar dados bancários reais em prints/logs.
- [ ] Executar opcionalmente o [diagnóstico somente leitura no Windows](../tooling/windows/android-v31-readonly-preflight.ps1) com o Samsung conectado. Ele não instala nem desinstala o aplicativo.

## Verificações funcionais

| ID | Etapa | Resultado esperado |
| --- | --- | --- |
| QA-01 | Abrir o app e alternar entre Início, Pix, Contas, Cartões, Investimentos, Metas, Negresco, Guardião e Ajustes | Navegação sem travar; operações financeiras permanecem demonstrativas |
| QA-02 | Alternar tema de destaque e preferências, fechar e reabrir | Preferências locais persistem |
| QA-03 | Guardião: analisar `123` | Formato inválido, sem alegar fraude; resumo com 3 dígitos no histórico |
| QA-04 | Guardião: analisar 47 zeros | Inconsistência, sem alegar proprietário ou origem |
| QA-05 | Reiniciar o app após QA-03 e QA-04 | O histórico preserva os resumos, inclusive análises inválidas, sem linha digitável completa |
| QA-06 | Pesquisar histórico por data, tipo e resultado | Lista filtrada, sem exibir números originais |
| QA-07 | Limpar histórico e fechar/reabrir | Os registros permanecem apagados |
| QA-08 | Abrir Guardião e inspecionar o **Mapa de evidências** sem consultar nada | Cálculo local só é marcado após análise; banco, beneficiário, origem e reputação permanecem “Não consultado” |
| QA-09 | Consultar CNPJ autorizado pelo usuário, com internet ativa | BrasilAPI retorna cadastro, não encontrado ou erro. Nunca afirma ligação com o boleto |
| QA-10 | Iniciar consulta CNPJ e desligar internet ou mudar o campo antes da resposta | A tela não fica carregando indefinidamente nem exibe resposta antiga como atual |
| QA-11 | Gerar PDF após análise local, **sem CNPJ consultado** | PDF pode ser compartilhado; mostra fontes externas 0, dados faltantes e legitimidade inconclusiva |
| QA-12 | Gerar PDF após consulta CNPJ opcional | PDF distingue consulta independente; não inclui CNPJ completo, linha digitável ou URL com CNPJ |
| QA-13 | Verificar blocos Pix, Negresco e integrações | Não apresenta operações reais, IA online ou dados bancários inexistentes |
| QA-14 | Testar com e sem internet, alternar telas e reabrir | O app não deve travar; consulta externa informa indisponibilidade quando falha |
| QA-15 | Consultar CNPJ, depois modificar a linha digitável | A consulta anterior desaparece; o mapa e o PDF não reutilizam evidência de outro boleto |
| QA-16 | Preencher dados e usar **Limpar dados da análise atual** | Linha digitável, CNPJ, resultados e estado de consulta são removidos da tela; histórico protegido e PDFs já compartilhados não são apagados |
| QA-17 | Conferir o resultado CNPJ na interface | Exibe BrasilAPI como fonte sem mostrar a URL contendo o CNPJ completo |
| QA-18 | Preencher boleto e CNPJ e pressionar Início/Ajustes | Ao voltar ao Guardião, campos e resultados temporários desaparecem; histórico resumido permanece |
| QA-19 | Escrever mensagem de demonstração na Negresco e mudar de aba | A mensagem temporária some ao voltar; nenhuma mensagem é enviada a um servidor |
| QA-20 | Abrir o alternador de apps e voltar ao Negresco Finance | Valores e textos temporários são apagados; o app não bloqueia capturas de tela nem substitui autenticação |
| QA-21 | Rodar o diagnóstico ADB somente leitura antes da homologação | Detecta modelo, Android e versão instalada; não instala nem apaga dados do aparelho |
| QA-22 | Verificar SHA-256 do APK baixado contra o Release | Hash do APK corresponde ao arquivo publicado; caso haja assinatura incompatível, não forçar reinstalação |

## Como registrar problemas

Informe **ID do teste, resultado, versão Android, modelo Samsung, tag do APK e sequência para reproduzir**. Caso haja travamento, inclua o texto do erro e um log Android anonimizado. Remova antes de compartilhar linhas digitáveis, CPF, CNPJ completo, nomes privados, números de conta, tokens e outros dados pessoais.

Classificação sugerida: **P0** = não abre, perde dados ou deixa dados privados expostos; **P1** = função do Guardião ou PDF falha; **P2** = problema visual ou de navegação.

## Critérios mínimos de aceite da candidata

- A compilação Android e a assinatura são aprovadas automaticamente.
- QA-01, QA-03, QA-05, QA-07, QA-08, QA-11 e QA-13 são aprovados no Samsung.
- Nenhum dado real é enviado sem ação explícita, e nenhum resultado matemático ou cadastro empresarial é apresentado como validação de pagamento.

**Limite:** aprovação deste roteiro confirma apenas funcionamento do protótipo testado, não auditoria de segurança bancária, prevenção efetiva de fraude ou prontidão para operações financeiras.

## Diagnóstico não destrutivo no PowerShell

Baixe o script `tooling/windows/android-v31-readonly-preflight.ps1` do repositório atualizado. Inspecione seu conteúdo e, com Android Platform Tools/ADB disponível no Windows e depuração USB autorizada no Samsung, rode a partir da raiz do projeto:

```powershell
$arquivo = ".\\tooling\\windows\\android-v31-readonly-preflight.ps1"
$tokens = $null
$erros = $null
[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $arquivo).Path, [ref]$tokens, [ref]$erros)
if ($erros.Count -gt 0) { throw ($erros -join "; ") }
powershell.exe -NoProfile -File $arquivo
# Opcional: acrescente -ApkPath "C:\\caminho\\app.apk" para conferir SHA256.
```

**Atenção:** este diagnóstico não confirma a compatibilidade do certificado de um APK com a instalação existente e não garante migração de dados. Comparar `APK-SIGNATURE.txt` dos dois builds antes de instalar. Não compartilhar número de série de dispositivo nem dados pessoais em logs públicos.
