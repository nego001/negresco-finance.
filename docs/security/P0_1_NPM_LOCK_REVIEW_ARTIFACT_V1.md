# P0-1 | Candidato de package-lock para auditoria humana

**PR de laboratório empilhada sobre #69.** Esta etapa não integra a
`main`, não cria releases nem aprova automaticamente dependências.

## Lacuna concreta

A #69 bloqueia builds estáveis caso `apps/mobile/package-lock.json`
não exista, não esteja sincronizado ou contenha URLs/hashes inadequados.
O arquivo real ainda precisa ser gerado em ambiente controlado e
analisado antes de fazer parte da árvore de produção.

## Processo novo

O workflow `.github/workflows/mobile-npm-lock-review.yml` tem gatilho
**somente para pushes** na branch de laboratório
`lab/p01-npm-lock-review-artifact-v1`. Ele:

1. Usa GitHub Actions com `contents:read` e checkout sem credenciais
   persistentes, Node **22.16.0**, sem segredos;
2. Registra SHA-256 do `apps/mobile/package.json`;
3. Resolve a proposta de grafo com
   `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`,
   exigindo npm lock versão 3 e registry HTTPS oficial;
4. Reprova qualquer alteração do `package.json`;
5. Executa o verificador `verify_stable_npm_lock.cjs` da #69;
6. Produz `LOCK_REVIEW_MANIFEST.json` com SHA-256 do lockfile,
   SHA-256 do manifesto, commit/ref de origem, versões Node/npm,
   quantidade de dependências e status `reviewed:false`;
7. Consulta os advisories do registry npm sobre o lock proposto e incorpora
   `LOCK_AUDIT.json` com totais `info/low/moderate/high/critical`
   e hash próprio. Alertas não deixam o candidato automaticamente aprovado;
   falha no serviço de auditoria é bloqueante.
8. Publica apenas um **artefato temporário de Actions** de 7 dias
   (`mobile-npm-lock-unreviewed-candidate`) para auditoria.

`tests/android-npm-lock-review-artifact.test.mjs` verifica
que não existe gatilho de produção, permissão `contents:write`,
envio de tag, release ou alteração automática da `main`.

## Limites e próximos critérios

O artefato gerado é **CANDIDATO NÃO REVISADO**, mesmo que o relatório
`LOCK_AUDIT.json` registre zero vulnerabilidades conhecidas. O advisory
feed é limitado pelo momento de consulta, pela cobertura das bases e
pelas informações dos pacotes. O risco residual exige revisão humana.

O artefato gerado é **CANDIDATO NÃO REVISADO**. Os testes e o fato de
o npm gerar integridades criptográficas não garantem que pacotes
não sejam maliciosos, que não tenham vulnerabilidades ou que as
licenças e a árvore transitiva sejam aceitáveis. A geração também
não reproduz necessariamente os pacotes presentes em builds antigos.

Antes de adicionar esse lockfile ao repositório e permitir um
release estável, é necessário inspecionar as dependências e suas
licenças, identificar pacotes com scripts de instalação, verificar
vulnerabilidades e origens, executar `npm ci` em CI e revisar
as diferenças de código distribuído. Os pacotes Gradle e o SDK
Android exigem auditoria própria. Proibido tratar essa PR como
autorização de OTA sem assinatura.
