# Negresco Security Engine | Masterplan modular de segurança financeira

**Data:** 20/10/2026  
**Proprietário:** Negresco Finance, repositório `nego001/negresco-finance.`  
**Programa:** [Issue #15](https://github.com/nego001/negresco-finance./issues/15)  
**Branch de laboratório:** `release/3.1.3-security-preview` / [PR #14](https://github.com/nego001/negresco-finance./pull/14) (DRAFT)

> Este documento é um contrato de engenharia, não um atestado de segurança,
> promessa de equivalência ao Bitwarden, identificação de defesas internas de
> bancos, autorização para lançar APK ou indicação de que os módulos estejam
> protegendo transações bancárias reais.

## Plano de dez módulos, estado verificável

| Código | Módulo | Entregável de engenharia | Situação agora | Gate para integrar |
| --- | --- | --- | --- | --- |
| SEC-01 | Criptografia | SQLCipher no banco real + AES-GCM por anexo/exportação + ciclo de vida de chaves | Laboratório de banco/chaves sintéticas | migração de dados cifrada, teste do WAL, troca de chaves, dump offline |
| SEC-02 | Identidade forte | Keystore, `BiometricPrompt.CryptoObject` e reautenticação por operação | Laboratório Android; biometria manual não executada | API Android real, revogação em `onStop`, biometria e inscrição alterada |
| SEC-03 | Privacidade | Tela segura, anti-tapjacking, clipboard, notificações e revisão de backups | Bloqueio de captura parcial no app experimental | revisão por tela, teste de overlays/captura, acessibilidade |
| SEC-04 | Antifraude | Detecção de ações arriscadas e alertas locais, sem PII desnecessária | Sinais definidos no motor de política sintético | telemetria minimizada, qualidade dos sinais, resposta a falsos positivos |
| SEC-05 | Confiança de dispositivos | Credenciais por aparelho, registro aprovado, expiração e revogação | Planejado; sem backend autorizado | protocolo assinado, atestado contextual, replays e troca de aparelho |
| SEC-06 | Modo Proteção Máxima | Pré-verificação por risco e autenticação reforçada por ação | **Laboratório Kotlin `SecurityOperationPolicyLab` inicial** | entradas obtidas somente por módulos nativos, decisão revalidada na camada de chaves |
| SEC-07 | Recuperação | Backup cifrado + kit separado + recuperação verificada + anti-rollback | Protótipo sintético em memória | exportação segura, restauração segunda instalação e proteção contra replay |
| SEC-08 | Central de Segurança | Painel com estado real, alertas e auditoria sem segredos | Planejado | API de evidências verificadas, nenhum indicador visual fictício |
| SEC-09 | Comunicação | TLS, tokens seguros, idempotência, E2EE condicionado a sync | Planejado | especificação de servidor/protocolo e pentest, sem fluxo falso |
| SEC-10 | Verificação | OWASP MASVS/MASTG, SBOM, testes de falhas, QA físico e auditoria | CI JVM/Android/SQLCipher e assinaturas experimentais | auditoria por função, assinatura de produção, preservação do usuário |

O módulo de segurança do Negresco Finance **não contém um cofre genérico de senhas**. Esse escopo pertence ao projeto separado Security Black.

## Fluxo de confiança obrigatório

```
Tela / gesto do usuário
     |
     v
Sinais nativos autenticados (lifecycle, sessão, armazenamento, dispositivo)
     |
     v
Pré-avaliação determinística de risco (SEC-06)
     |        \__ DENY -> nenhum efeito, nenhum acesso ao banco
     |
     +---- REQUIRE_FRESH_STRONG_AUTH -> prompt nativo independente
     |
     +---- PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER
                    |
                    v
     autorização Keystore/CryptoObject por operação e revisão atual
                    |
                    v
     componente SQLCipher nativo abre recurso apropriado
```

**O pré-avaliador de risco nunca retorna ALLOW, tokens assinados, chave,
passphrase SQLCipher ou acesso financeiro.** O aplicativo futuro deve
revalidar geração, contexto, permissões e autenticador nativo, sem confiar
em parâmetros de JavaScript, IA, rede Wi-Fi ou telemetria como fontes finais
de autorização. A decisão de risco não substitui criptografia.

## Política do Modo Proteção Máxima (SEC-06)

**Operações modeladas:** ver resumo, revelar registro, exportar dados, cadastrar
dispositivo, revogar dispositivo, alterar recuperação, alterar contexto
confiável, desativar modo máximo, desativar biometria, restaurar backup, apagar
chaves de criptografia.

- Emergência, app em segundo plano, sessão ausente, armazenamento incerto,
  dispositivo não confiável ou overlay suspeito: **DENY**.
- Alteração de recuperação, exibição de item e exportação com proteção de
  captura indisponível: **DENY**.
- Cadastro de aparelho numa rede desconhecida: **DENY**. Rede conhecida sozinha
  **não** concede autorização.
- Operações críticas sob fraude suspeita ou detecção indisponível: **DENY**.
- Exportar, gerenciar dispositivos, mudar recuperação e desativar o modo máximo
  exigem autenticação forte recente e checagem nativa independente.
- No modo máximo, consulta de resumo financeiro também exige step-up quando
  contexto de rede/risco não está confiável.
- **Desativar biometria, apagar chaves e restaurar backup** são sempre
  **DENY neste protótipo**; cada uma exige seu protocolo transacional próprio.

**Limites:** sinais `Boolean` não são provas criptográficas; não são seguros
se originados em um componente arbitrário. A autorização forte recente aqui é
apenas um sinal para decidir o próximo passo; mesmo `true` só pode retornar
`PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER`. Esta primeira versão não implementa
sincronização, FIDO2, antifraude de produção ou nenhum dos controles da
plataforma necessários para garantir esses sinais.

## Qualidade e critérios de promoção

1. **LAB:** todos os testes Kotlin/Node relevantes verdes, matriz adversarial
   e contrato que impede associação inadvertida ao app Expo.
2. **ANDROID-LAB:** testes instrumentados com dados fictícios em emulador,
   token anterior revogado, armazenamento restaurável, comportamento de teclado,
   acessibilidade e ciclo de vida Android.
3. **FEATURE FLAG OFF:** integração nativa real, desligada por padrão e sem
   migração automática de bancos, dados ou chaves pré-existentes.
4. **QA/HARDWARE:** teste com autorização, instalação compatível pela assinatura,
   cenários de travamento, queda de energia simulada, biometria e recuperação.
5. **RELEASE CANDIDATE:** auditoria de segurança independente, SBOM,
   análise de privacidade, política LGPD, ameaça residual e plano de reversão.
6. **PRODUÇÃO:** consentimento específico do proprietário para publicar/mesclar,
   chaves de distribuição permanentes, monitoramento de falhas sem PII.

Até lá: **sem merge em `main`, sem alterar o APK 3.1.2 instalado,
sem instalar silenciosamente no Galaxy A55, sem dados bancários reais**.

## Trilhas já existentes

- [P0 SQLCipher e biometria: CI validado](https://github.com/nego001/negresco-finance./actions/runs/39382072099).
- [APK 3.1.3 de testes](https://github.com/nego001/negresco-finance./actions/runs/39376841287), gerado antes de integrar qualquer
  `tooling/*` ao aplicativo Expo.
- [Checagem de assinaturas 3.1.2 → 3.1.3](https://github.com/nego001/negresco-finance./actions/runs/39432982560):
  assinaturas públicas coincidem; smoke emulador estava bloqueado por shell
  de workflow e requer reexecução após correção.
