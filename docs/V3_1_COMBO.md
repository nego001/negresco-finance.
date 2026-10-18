# V3.1 | Pacote único das dez frentes

**Critério de transparência:** interface não equivale a integração funcional. Esta entrega reúne as frentes em uma só mudança, sem anunciar consultas ou monitoramento que ainda não existem.

| Frente | Entrega no pacote | Limitação |
| --- | --- | --- |
| Interface do Guardião | Tela integrada | Precisa teste no Samsung |
| Validação de boletos | Dígitos 47/48 e testes | Não prova legitimidade |
| Personalização persistente | AsyncStorage para ajustes não sensíveis | Exige APK novo |
| Relatórios com evidências | Estrutura e resumo local visível | Fontes externas não conectadas |
| Histórico | Últimas verificações na sessão, sem linha completa | Não persistente |
| Exportação PDF | Aviso de indisponibilidade | Gerador PDF não implementado |
| Consulta CNPJ/empresas | Estado explícito de indisponibilidade | Sem conector oficial |
| Reclame Aqui | Estado explícito de indisponibilidade | Sem integração, autorização ou fontes |
| Monitoramento bancário | Estado desligado, sem coleta | Sem acesso autorizado a DDA/API |
| APK e release | Workflow com tag por commit candidato | Compilação e teste em aparelho pendentes |

## Próxima condição para funcionalidades online
Implementar backend com credenciais seguras, fonte oficial identificada, autorização granular, proteção de dados, testes de integração e revisão jurídica/técnica. Não enviar linha digitável, CPF ou extratos a buscadores públicos.

## Segurança e validação
O histórico é temporário e guarda somente metadados de resultado, nunca o boleto completo. O AsyncStorage existente serve apenas para preferências de aparência. Nenhum recurso financeiro sensível deve ser persistido sem solução de armazenamento criptografado e gerenciamento seguro de chaves.

A V3.1 não pode ser declarada concluída enquanto CI, build e testes no Samsung não forem aprovados.