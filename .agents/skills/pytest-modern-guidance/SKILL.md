---
name: pytest-modern-guidance
description: >-
  Use esta skill para padronizar e aplicar os guidelines de testes automatizados do backend Python.
  Acione ao criar novas suítes de teste, mocks ou fixtures.
---
# Diretrizes para Testes Modernos (Pytest)

Assegura que o backend possua uma suíte de testes resiliente, determinística e capaz de rodar inteiramente em ambiente offline.

## Padrões de Qualidade e Isolamento

1. **Estrutura de Fixtures:**
   - Uso intensivo e estruturado de Pytest fixtures no `conftest.py`.
   - Gerenciamento explícito de escopos (`session`, `module`, `function`).

2. **Isolamento de Banco de Dados:**
   - Testes de integração devem rodar sobre um banco de dados de teste efêmero.
   - Aplicação de `database fixtures` executando migrations do Alembic limpas na inicialização (setup/teardown robusto).
   - Rollback automático de transações entre testes para garantir isolamento.

3. **Mocking Estrito (Zero I/O de Rede Real):**
   - Todos os testes devem rodar 100% offline.
   - Uso obrigatório de bibliotecas de simulação de rede (como `respx` ou mocks do `httpx`) para interceptar e emular APIs externas (ex: Spotify, Deezer, Gemini).
   - Chamadas HTTP não mockadas devem causar falha no teste.
