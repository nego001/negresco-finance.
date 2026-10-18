# P0 - Fundação Android

## Objetivo único
Compilar um APK de depuração que abre a interface inicial em Android.

## Escopo
- Estrutura do projeto Expo + React Native + TypeScript.
- Typecheck automatizado.
- Compilação do APK debug via GitHub Actions.
- Download do APK como artifact da execução bem-sucedida.
- Teste manual de abertura e navegação em aparelho Android.

## Fora do escopo
Pix real, Open Finance, IA, biometria, Samsung Pass, backend, antivírus, proteção contra malware e release de produção.

## Critérios de aceite
1. Workflow `Android APK (P0)` passa.
2. Artifact `negresco-finance-p0-debug-apk` contém `app-debug.apk`.
3. APK instala em Android compatível.
4. App abre e navega sem travar.

## Estado
Workflow publicado. Compilação e instalação **ainda não verificadas**. Não declarar P0 concluída antes dos critérios de aceite.

## Como obter o APK
GitHub > Actions > Android APK (P0) > execução bem-sucedida > Artifacts > negresco-finance-p0-debug-apk.
Baixar o ZIP e extrair `app-debug.apk`. APK debug é somente para testes, não para distribuição pública.

## Observações
O projeto ainda usa `npm install` sem lockfile. Antes da versão de produção, fixar dependências e revisar permissões, assinatura e política de atualização.
