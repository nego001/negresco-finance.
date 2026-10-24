# P0-1 | Impedir backup e depuração no APK publicado

Laboratório de segurança empilhado sobre a PR #48. Não realiza publicação,
não configura segredos nem altera a branch principal.

## Problema

A identidade, a versão e o certificado já são conferidos duas vezes, mas
isso não garante que o **AndroidManifest.xml realmente compilado** não
ative backups de dados ou uma aplicação depurável. Uma alteração inesperada
no manifesto durante o build pode colocar dados locais sensíveis em risco.

A configuração-fonte atual define \`android.allowBackup: false\`, mas
a decisão de publicar deve se basear no APK final baixado pelo job
privilegiado, não apenas nas configurações de Expo.

## Nova validação

O job privilegiado, antes de qualquer criação de tag, executa:

\`aapt dump xmltree Negresco-Finance-V3.1.3-preview.apk AndroidManifest.xml\`

Um verificador Node incorporado diretamente ao workflow analisa o elemento
\`application\` no XML compilado e exige:

- Exatamente um elemento \`application\` reconhecível;
- \`android:allowBackup\` **explicitamente presente** e \`false\`;
- \`android:debuggable\` ausente (default false) ou explicitamente \`false\`;
- \`android:testOnly\` ausente (default false) ou explicitamente \`false\`;
- Nenhum desses atributos duplicado;
- Ausência do sinal \`application-debuggable\` no badging do APK.

Os valores devem aparecer como booleanos compilados Android
\`(type 0x12)0x0\`. Valores \`true\`, strings, XML incompleto, falha
da ferramenta ou atributos encontrados apenas em componentes filhos
impedem o avanço do fluxo. A inspeção continua no publicador **sem
checkout** e não executa scripts carregados junto dos artefatos.

A verificação pré-existente de pacote \`com.negresco.finance\`,
\`versionCode 34\`, versão \`3.1.3\`, permissão biométrica única,
certificado esperado e integridade do APK/ZIP permanece ativa.

## Validação

Os testes usam \`aapt\` simulado e a etapa privilegiada real do
workflow com APK sintético. Abrangem valores ausentes, verdadeiros,
strings, duplicatas, componentes filhos, duas aplicações, badging
indicando depuração, e cenários autorizados com defaults seguros.
Nenhum APK sintético é instalado ou publicado.

## Limites conhecidos

Conforme a documentação Android, o valor padrão de \`allowBackup\`
é \`true\`. O atributo em \`false\` reduz a possibilidade de cópia
de dados pelo mecanismo de backup do Android, mas em aparelhos
Android 12+ de alguns fabricantes pode não impedir **transferência
direta de dispositivo para dispositivo**. Portanto esta revisão
não equivale a uma garantia universal de que nenhum dado possa ser
extraído. As regras de extração de dados, a proteção criptográfica
e a avaliação em dispositivo físico continuam atividades separadas.

Referências:
- https://developer.android.com/guide/topics/manifest/application-element
- https://developer.android.com/identity/data/autobackup

Gates de integração: teste Node, CI Android, APK da revisão final,
auditoria independente e nenhuma publicação sem aprovação expressa.
