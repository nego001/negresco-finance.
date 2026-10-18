# Negresco Finance

Plataforma financeira modular em desenvolvimento. **Protótipo inicial: sem APK, sem integração bancária real e sem movimentação de dinheiro.**

## Componentes
- **Negresco**: assistente pessoal personalizável (voz vinculada à identidade escolhida).
- **CTO**: coordenação de agentes, sempre submetida às políticas determinísticas.
- **Guardião**: especialista em segurança e criptografia.
- **Especialistas**: Open Finance, Pix, Investimentos, Cartões, Metas e auditoria.

## Módulos iniciais
IA, Open Finance, Pix, Investimentos, Cartões e Metas. Outros recursos permanecem opcionais.

## Executar testes
Requer Node.js 22 ou superior.

```bash
npm test
```

## Documentação
- [Arquitetura](docs/ARCHITECTURE.md)
- [Segurança](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)

**Importante:** não adicione credenciais bancárias nem segredos ao repositório. Criptografia, React Native, NestJS e provedores bancários ainda precisam ser implementados e auditados.
