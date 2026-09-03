---
name: fastapi-modern-guidance
description: >-
  Use esta skill para orientar a implementação e o code review do backend FastAPI (BFF).
  Aplicável ao criar novos endpoints, middlewares ou refatorar o código da API.
---
# Diretrizes Modernas para FastAPI (BFF)

Esta skill estabelece os padrões técnicos obrigatórios para o desenvolvimento do backend em FastAPI.

## Padrões Exigidos

1. **Design RESTful:**
   - Adote convenções estritas de nomenclatura de recursos.
   - Utilize métodos HTTP corretos (GET, POST, PUT, PATCH, DELETE).

2. **Assincronismo:**
   - O uso de `async`/`await` é obrigatório em todos os I/O boundaries (banco de dados, requisições HTTP, leitura de arquivos).
   - Proibido o uso de chamadas bloqueantes na thread principal.

3. **Validação e Tipagem:**
   - Validação estrita utilizando Pydantic v2.
   - Todo endpoint deve declarar explicitamente `response_model`.
   - Utilize type hints rigorosos em toda a base de código.

4. **Tratamento de Erros:**
   - Implemente exceções customizadas herdando de classes base do projeto.
   - Registre handlers globais para mapear exceções de domínio em códigos HTTP consistentes.

5. **Middlewares e Segurança:**
   - Implementação padronizada de middlewares (tempo de resposta, logging de requisições).
   - Exigido a configuração de CORS (Cross-Origin Resource Sharing) estrito.
   - Injeção obrigatória de security headers.
   - Implementação de Rate Limiting via injeção de dependência ou middleware.
