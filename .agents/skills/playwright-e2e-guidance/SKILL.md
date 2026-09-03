---
name: playwright-e2e-guidance
description: >-
  Use esta skill para padronizar e aplicar os guidelines de testes End-to-End (E2E) com Playwright.
  Acione ao configurar o ambiente de teste de UI, criar page objects ou validar fluxos críticos do frontend.
---
# Diretrizes Modernas para Testes E2E (Playwright)

Assegura que a aplicação frontend (Vite/React) possua testes E2E robustos, resilientes e imunes a flakiness (falsos negativos).

## Padrões Exigidos

1. **Page Object Model (POM):**
   - É obrigatório isolar seletores e ações dentro de classes de Page Objects.
   - Os testes não devem conter seletores CSS crus ou XPaths injetados diretamente na lógica de asserção.

2. **Resiliência e Locators:**
   - Proibido o uso de `setTimeout` ou esperas arbitrárias.
   - Utilize a API de "auto-waiting" do Playwright (ex: `expect(locator).toBeVisible()`).
   - Priorize web-first assertions e locate por roles acessíveis (ex: `getByRole`, `getByText`, `getByTestId`).

3. **Isolamento de Estado (Mocking):**
   - Intercepte requisições do BFF (FastAPI) via `page.route()` para isolar cenários de testes de rede (falhas de API, instabilidades).
   - Simule o comportamento do Gemini e da API do Spotify para garantir que os testes rodem de forma previsível no CI/CD.

4. **Gerenciamento de Contexto:**
   - Cada teste deve rodar em um Browser Context limpo e isolado (isolamento de estado de cookies e localStorage por padrão).
