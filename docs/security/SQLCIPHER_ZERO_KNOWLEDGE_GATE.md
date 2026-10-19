# Negresco Finance | SQLCipher nativo + zero-knowledge

**Status: REQUISITO APROVADO PARA PLANEJAMENTO / IMPLEMENTAÇÃO AINDA BLOQUEADA.**
O APK V3.1 atual **não usa SQLCipher** nem oferece zero-knowledge completo.
Este documento não autoriza armazenar credenciais, transações bancárias ou
segredos reais, nem mudar o status da auditoria CP-0163 do Security Black.

## Propriedades obrigatórias

1. **Banco local:** SQLCipher nativo para as páginas e os índices locais,
   sem fallback para SQLite comum. Falhar fechado quando não houver
   implementação cifrada, chave ou versão nativa suportada.
2. **Cifragem de ponta a ponta por registro:** XChaCha20-Poly1305 (ou
   biblioteca AEAD equivalente auditada), com chave de conteúdo aleatória
   por registro, chaves independentes por domínio e autenticação de
   metadados. SQLCipher não substitui esse envelope E2EE.
3. **Chaves fora do backend:** raiz E2EE criada/desbloqueada no dispositivo,
   nunca entregue ao nosso servidor, CTO, Negresco IA ou provedor de analytics.
   Chave de página SQLCipher distinta da raiz E2EE. Biometria é mecanismo de
   autorização local, nunca a chave de criptografia em si.
4. **Android:** adaptador Rust via JNI/UniFFI ou módulo Expo nativo auditado;
   Android Keystore (StrongBox somente quando realmente suportado) para
   envolver/liberar material de chave; teste nas ABIs arm64-v8a e demais
   arquiteturas suportadas. Uma mudança nativa exige novo APK assinado,
   não atualização OTA de JavaScript.
5. **Sem acesso de servidor a dados financeiros em claro:** sincronização
   feita com envelopes cifrados e dispositivos previamente autorizados,
   assinatura/autenticação de mensagens, verificação de replay, rollback,
   conflitos e revogação. A API só manipula identificadores mínimos.
6. **Limites honestos de zero-knowledge:** IP, tempo de acesso, tamanho
   aproximado, identificadores e padrões de sincronização podem continuar
   visíveis. Open Finance, banco e processadores externos recebem informações
   necessárias ao serviço sob consentimento explícito; a expressão
   zero-knowledge não abrange essas instituições nem o aparelho desbloqueado.
7. **Recuperação independente:** backup E2EE autenticado, recuperação em
   aparelho novo sem envio de chaves ao servidor, migração com reversão segura,
   testes de dados truncados e PIN/senha errados. Nunca prometer recuperação
   sem chave de recuperação ou dispositivo autorizado.
8. **Módulos IA:** CTO e agentes usam permissões determinísticas e dados
   minimizados; nenhum agente recebe raiz ou chave de banco. Processamento
   remoto de dados claros depende de autorização específica e impede a
   afirmação de zero-knowledge para aqueles dados.
9. **Arquivos auxiliares:** journal/WAL, cache, logs, PDFs temporários,
   anexos, clipboard e backups recebem proteção e política de exclusão
   testadas; desativar Android Auto Backup é provisório, não plano de recovery.

## Critérios de aceite verificáveis (nenhum concluído)

- [ ] Inventário de dependências, licenças, hashes, SBOM e auditoria externa
  de SQLCipher/OpenSSL e bindings Android.
- [ ] Compilação nativa reprodutível + testes reais: chave errada, plaintext
  SQLite, adulteração, corrupção, reinício, transações e falha de energia.
- [ ] Bloqueio por Keystore e recuperação independente em aparelho novo.
- [ ] Prova ponta a ponta do armazenamento local SQLCipher e envelopes E2EE,
  sem vazamento de chaves em FFI, logs, dumps e servidor.
- [ ] Simulação de servidor malicioso: replay, rollback, perda de pacotes,
  forks, edição concorrente e dispositivo revogado.
- [ ] Teste em Samsung real, com APK assinado de forma estável, migrando
  dados sintéticos entre versões.
- [ ] Revisão criptográfica independente e liberação formal antes de qualquer
  dado pessoal/financeiro real.

## Reutilização do Security Black

O ramo experimental `audit/sqlcipher-cp0163-readiness-20261018`
do repositório `nego001/personal-security-ai` contém protótipos Rust
de E2EE e SQLCipher, ambos **não aprovados para produção**.
Reutilizar somente componentes com licenças compatíveis, testes
reproduzíveis e revisão de dependências. **Não importar/ativar
`sqlcipher-bundled` no APK V3.1 apenas por existir código experimental.**

A prioridade segue: estabilizar V3.1, homologar Samsung,
concluir gestão de chaves/recovery e compilar/testar SQLCipher nativo,
depois construir módulos financeiros e integrações reais.
