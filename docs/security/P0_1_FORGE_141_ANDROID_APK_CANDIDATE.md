# P0-1 | APK experimental com node-forge 1.4.1

Branch isolado empilhado sobre a PR #94. Compila o candidato temporário
`postcss@8.5.23`, `image-size@2.0.3`, `node-forge@1.4.1` via resolução
transitiva, mantendo a versão Expo do projeto.

### Gates
- `npm audit --json` sem supressão, lockfile exato e prova de origem da
  distribuição npm versus a tag oficial `digitalbazaar/forge v1.4.1`.
- `npm ci`, TypeScript, geração nativa Expo, verificação da política OTA
  preview e Gradle `assembleRelease` com **assinatura Android Debug**,
  sem keystore de produção ou distribuição pelo GitHub Releases.
- Confere assinatura, conteúdo de APK, DEX/ELF e Hermes. Um segundo runner
  recalcula hash de APK e bundle e liga os bytes à prova de procedência.
- Artifact de laboratório com retenção curta, não um release/OTA.

**Não homologar:** o APK é **preview OTA habilitado**, não a variante
embedded-only da PR #85. A procedência do forge e `npm audit=0`
não provam ausência de vulnerabilidades ou compatibilidade financeira.
Revisão humana e testes de fluxo real permanecem necessários.
