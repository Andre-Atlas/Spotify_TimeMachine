---
name: api-design-handoff
description: >-
  Use esta skill para gerar, auditar e manter a documentação da superfície da API.
  Acione ao desenhar novos módulos, integrar com frontend ou especificar contratos.
---
# Handoff de Design de API

Garante a documentação estruturada, preditiva e manutenível de toda a superfície da API do sistema.

## Requisitos de Especificação

Todo documento de handoff ou especificação de API deve conter obrigatoriamente:

1. **Catálogo de Endpoints:**
   - Especificação técnica dos mais de 15 endpoints.
   - Definição exata de Verbos HTTP e Paths (com estratégia clara de versionamento, ex: `/v1/`).
   - Listagem de parâmetros (Query, Path, Body, Headers).

2. **Schemas e Contratos:**
   - Detalhamento de Schemas de Request e Response (baseados em Pydantic).
   - Inclusão de payloads JSON reais como exemplos práticos.

3. **Mapeamento de Erros:**
   - Tabela de Error Codes.
   - Mapeamento de status HTTP esperados para falhas conhecidas.
   - Definição de estratégias de fallback sugeridas para os clientes da API.
