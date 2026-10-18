# Negresco Finance: modelo inicial de ameaças

## Escopo e limites
Este documento é uma proposta de defesa em profundidade. O módulo security-core atual é uma política determinística testável, NÃO um detector real de malware, NÃO um antivírus e NÃO um controle de backend. Os sinais ainda não são coletados pelo Android nem atestados por servidor. A ausência de sinais não comprova dispositivo seguro.

## Ameaças e controles planejados
| Ameaça | Controle planejado | Limitação |
| --- | --- | --- |
| APK adulterado/reempacotado | assinatura de release, Play Integrity com verificação server-side, proteção de distribuição | sinais não garantem ausência de malware |
| Trojan bancário, sobreposição e abuso de acessibilidade | revisão reforçada de operações, proteção de telas sensíveis, detecção de sobreposição onde APIs permitirem | aplicativos maliciosos podem contornar sinais locais |
| Captura de tela e gravação | FLAG_SECURE nas telas sensíveis via módulo Android nativo | não protege contra câmera externa ou dispositivo comprometido |
| Rede hostil e MITM | HTTPS TLS, configuração de segurança de rede bloqueando cleartext, validação de certificados e domínio | não confiar apenas em heurísticas de Wi-Fi |
| Roubo de tokens | Android Keystore, tokens curtos e revogáveis, autorização backend | cliente comprometido pode ainda operar na sessão |
| Phishing e troca de destinatário | confirmação de valor e destinatário, step-up, validação no servidor | engenharia social não é eliminada |
| API e abuso de agentes | autenticação, autorização por recurso, rate limits, escopos mínimos e logs auditáveis | políticas locais não substituem backend |
| Dependências maliciosas | lockfiles, SCA, secret scanning, revisão de atualização, CI com permissões mínimas | ferramentas de auditoria não detectam tudo |

## Política de bloqueio
Falha confirmada de integridade do app: bloquear operações sensíveis e revalidar no servidor.
Integridade não verificada ou sinal de rede hostil: revisar risco, não afirmar infecção.
Sinal de overlay: bloquear pagamentos até verificação adicional e avaliação server-side.
Jamais confiar em um booleano enviado pelo cliente para autorizar pagamento.

## Próximos passos de implementação
1. Adicionar segurança de rede Android e proteção de captura em telas sensíveis.
2. Integrar Play Integrity e validação de nonce/desafio no backend.
3. Adicionar autenticação biométrica/passkeys e armazenamento seguro.
4. Implementar auditoria, telemetria mínima e resposta a incidentes.
5. Testes dinâmicos, SAST/SCA e revisão OWASP MASVS/MSTG antes de produção.

## Privacidade
Não varrer arquivos pessoais, não solicitar permissões invasivas de acessibilidade e não coletar lista de apps instalados sem necessidade legítima, transparência e conformidade com regras da plataforma.
