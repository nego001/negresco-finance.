# Guardião P0 #120 | conferência offline de cópia do APK Release original

A falha intermitente original de PDF ocorreu no **APK histórico imutável de SHA-256**:

`29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`

O artefato histórico do GitHub Actions expirou. Nenhum dos 23 APKs listados em releases da consulta de 16/11/2026 tem esse hash. Os ensaios do candidato v4 são úteis, mas não substituem esse objeto histórico.

## Verificar somente uma cópia que já esteja sob controle do usuário

Com uma cópia `.apk` disponível localmente e escolhida manualmente, executar:

```sh
python3 tooling/android/guardiao_original_release_local_custody.py "/CAMINHO/ESCOLHIDO/PELO_USUARIO/arquivo.apk"
```

O script **não procura arquivos**, não grava, não instala, não envia dados, não abre rede e não imprime caminho, tamanho, erro nativo nem hash calculado. Recebe um único caminho apenas quando invocado pelo usuário. Abre com `O_NOFOLLOW`, exige arquivo regular de 25–200 MiB com um link físico, lê até o limite, verifica estabilidade por descritor e compara exclusivamente com o hash histórico constante.

Saídas permitidas:
- `MATCH_ORIGINAL_SHA` / exit 0: **somente correspondência do hash SHA-256**. Guardar cópia offline e só então planejar teste controlado; **não** equivale a aplicativo corrigido/homologado.
- `DIFFERENT_SHA` / exit 2: não usar este arquivo como Release original.
- `REFUSED_UNSAFE` / exit 3: estrutura/tamanho/identidade não verificáveis ou entrada inválida.
- `UNAVAILABLE` / exit 4: arquivo não encontrado.

Testes sintéticos validam o detector sem criar um APK histórico fictício. Um arquivo com nome parecido, um ZIP de release, um artefato de build recente ou mesmo uma assinatura release diferente **não** provam identidade sem igualdade de SHA.

**Sem acesso ao dispositivo ou ao backup do usuário, o original não foi recuperado.** O laboratório não executa cópia do arquivo, instalação, exportação de PDF nem testes Android; serve só para guardar evidência local íntegra, caso um backup real seja encontrado.

**P0 #120 e #126 permanecem OPEN; PR125 DRAFT/unmerged.** `approvedForProduction=false`, `stableReleaseAllowed=false`; sem merge, OTA, assinatura estável, dados de clientes ou pagamentos/Pix reais.
