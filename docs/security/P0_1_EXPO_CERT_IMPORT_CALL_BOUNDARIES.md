# P0-1 | Fronteiras textuais de importação e chamada de certificados Expo

PR Draft empilhada sobre #92. Inventário lexical reproduzível nos pacotes npm EXATOS, com `npm ci --ignore-scripts` em dois runners independentes.

Separa arquivos com menção a funções nomeadas, sintaxe de chamada, referência ao módulo `@expo/code-signing-certificates` e a **coincidência desses sinais no mesmo arquivo**. A comparação cruza as contagens de arquivos com o relatório anterior e conserva as versões e o SHA da árvore npm.

**Limites:** uma chamada textual pode ser uma declaração de função, comentário ou código inativo; mesmo importar e chamar no mesmo arquivo não comprova fluxo executado, origem dos certificados ou possibilidade de exploração RSA. Nenhum pacote instalado é executado pela análise, nenhum certificado, chave ou trecho de código é publicado. Não permite conclusão de ausência de vulnerabilidade. Os cinco HIGH e o bloqueio de versão estável permanecem.
