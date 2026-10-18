# Negresco Finance | V3.1 - Entrega técnica e limitações

## Entregue em código
- Tela do Guardião com inspeção **local** de linha digitável de 47 e 48 dígitos.
- Verificações de dígitos de controle com testes automatizados de exemplos sintéticos.
- Estados explícitos de identificação desconhecida e fontes não consultadas.
- Preferências visuais e apresentação da Negresco armazenadas no dispositivo via AsyncStorage.
- Contrato de evidências para investigação futura, com rastreabilidade e recusa de alegações confirmadas sem evidências.

## Não entregue / não anunciar como funcional
- Consulta a CNPJ, Receita Federal, Reclame Aqui, notícias ou bancos.
- Descoberta automática da compra ou contrato original.
- Monitoramento de DDA, notificações bancárias ou Open Finance.
- IA real, pagamento Pix, autenticação bancária e decisões de risco verificadas.
- Armazenamento criptografado de dados financeiros. AsyncStorage é usado **somente para preferências visuais não sensíveis**.

## Aceite de versão
1. CI e TypeScript aprovados no commit candidato.
2. APK compilado e assinado com sucesso. Dependência nativa AsyncStorage exige **APK novo**, não somente OTA.
3. Instalação no Samsung, abrir Guardião, validar amostras sintéticas, mudar preferências, fechar e reabrir, confirmar persistência.
4. Confirmar que o OTA funciona **apenas após instalação do APK compatível**.
5. Sem validação em aparelho, status: **candidato técnico, não versão final validada**.

## Publicação
Não anunciar conclusão da V3.1 enquanto os passos de aceite não estiverem concluídos. O workflow atual de APK publica sob a tag de teste v0.2.0-p0 e sobrescreve seus artefatos; antes de promover uma versão oficial, ajustar o workflow para tag imutável por versão e notas de lançamento fiéis ao pacote.
