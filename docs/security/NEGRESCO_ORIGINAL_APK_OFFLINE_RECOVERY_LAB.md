# Negresco Finance | Recuperação do APK V3.1.3 original (laboratório)

**Situação:** o artefato do GitHub Actions #40617164086 foi enviado em 28/10/2026, mas a retenção de 14 dias terminou aproximadamente em 11/11/2026. O artefato não constava na listagem em 15/11/2026. A recuperação depende de uma cópia guardada fora desse artefato expirado.

## Identidade que não pode mudar

- Artefato original de origem: `negresco-finance-v313-security-preview`.
- Commit do workflow original: `a01286f91c53a12e977c3e550300c872e5955d45`.
- **SHA-256 do arquivo APK original (não do ZIP do Actions):** `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`.

## Conferência de uma cópia local

O arquivo deve existir localmente como `.apk`, sem modificações. Execute a partir da raiz do repositório:

```bash
python3 tooling/android/guardiao_verify_original_apk_offline.py "/caminho/para/Negresco-Finance-V3.1.3-preview.apk"
```

O comando verifica o arquivo de forma local e somente leitura. Rejeita links simbólicos, arquivo fora do limite de tamanho, hash diferente, ZIP inválido, arquivos obrigatórios ausentes e entrada ZIP duplicada. **Não imprime caminho, hash calculado ou conteúdo.** Não copia, instala, envia, reempacota nem assina o arquivo.

Um `PASS (LAB): original-apk-exact-bytes-verified-for-lab-only` confirma apenas igualdade de bytes com o SHA fixado. Não comprova que o sistema esteja seguro nem libera produção. Um `BLOCK` exige outra cópia original. Não altere o SHA esperado para tornar uma cópia incompatível aceitável.

## Barreiras remanescentes

Mesmo após um PASS de identidade, a P0 de PDF intermitente deve ser revalidada com **esse mesmo APK** em Android 9, junto com as verificações de assinatura, política de permissões, recibos de PDF e navegação. PR #125 continua Draft; não fazer OTA, merge, pagamentos reais ou Release estável.
