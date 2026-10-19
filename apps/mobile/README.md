# Aplicativo Android (prévia)

Expo SDK 54 + React Native. Interface OLED preta com azul.

## Executar
```bash
cd apps/mobile
npm install
npx expo start
```

No Android, abrir com Expo Go compatível. Nenhuma integração bancária ou IA real nesta prévia.

## Limites
A navegação é local, com telas demonstrativas e sem dados financeiros reais. O APK de produção exigirá configuração de build e validação específica.

## Privacidade de telas Android 3.1.2 (candidata)

`expo-screen-capture` (Expo SDK54) aplica bloqueio nativo de captura quando o Guardião está visível ou o bloqueio biométrico está ligado. Esse recurso **não substitui E2EE, SQLCipher nem Keystore de produção** e exige APK recompilado com o novo runtime. Testes de screenshot, gravação e miniaturas em Samsung continuam pendentes. A exportação de PDF para outros aplicativos não herda essa proteção.
