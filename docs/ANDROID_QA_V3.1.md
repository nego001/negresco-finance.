# Negresco Finance V3.1 | Roteiro de homologação no Samsung

**Escopo:** APK candidato para testes. Este roteiro não autoriza pagamentos e não exige dados bancários, CPF ou boletos reais.

## Antes de instalar

- [ ] Baixar o APK de um [GitHub Release oficial do repositório](https://github.com/nego001/negresco-finance./releases), conferir a tag/commit e o SHA256 publicado.
- [ ] Confirmar no GitHub Actions que **Android APK**, **CI** e **Mobile static check** passaram para o commit correspondente.
- [ ] Comparar o certificado em **APK-SIGNATURE.txt** com o APK já instalado antes de presumir que é possível atualizar sem reinstalar. Não confundir assinatura tecnicamente válida com identidade de assinatura estável.
- [ ] Se o Android recusar instalar sobre um APK antigo por assinatura diferente, **não desinstalar antes de decidir o que fazer com os dados locais**. O aplicativo não oferece backup/migração garantidos.
- [ ] Registrar modelo do Samsung, versão Android, tag do APK e resultado da instalação. Não capturar dados bancários reais em prints/logs.

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

## Como registrar problemas

Informe **ID do teste, resultado, versão Android, modelo Samsung, tag do APK e sequência para reproduzir**. Caso haja travamento, inclua o texto do erro e um log Android anonimizado. Remova antes de compartilhar linhas digitáveis, CPF, CNPJ completo, nomes privados, números de conta, tokens e outros dados pessoais.

Classificação sugerida: **P0** = não abre, perde dados ou deixa dados privados expostos; **P1** = função do Guardião ou PDF falha; **P2** = problema visual ou de navegação.

## Critérios mínimos de aceite da candidata

- A compilação Android e a assinatura são aprovadas automaticamente.
- QA-01, QA-03, QA-05, QA-07, QA-08, QA-11 e QA-13 são aprovados no Samsung.
- Nenhum dado real é enviado sem ação explícita, e nenhum resultado matemático ou cadastro empresarial é apresentado como validação de pagamento.

**Limite:** aprovação deste roteiro confirma apenas funcionamento do protótipo testado, não auditoria de segurança bancária, prevenção efetiva de fraude ou prontidão para operações financeiras.
