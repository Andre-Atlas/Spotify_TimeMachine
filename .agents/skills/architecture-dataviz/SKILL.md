---
name: architecture-dataviz
description: >-
  Use esta skill para gerar diagramas de arquitetura, fluxos de engenharia de dados
  e representações visuais do motor de correlação acústico/semântico.
---
# Visualização de Arquitetura e Engenharia de Dados

Estabelece a padronização para a modelagem visual do projeto, evitando overhead de explicações verbais sobre fluxos sistêmicos críticos.

## Diagramas Exigidos

Sempre que a arquitetura for discutida ou modificada, utilize Mermaid ou PlantUML para renderizar os seguintes diagramas:

1. **Modelo de Duas Torres:**
   - Representação visual clara distinguindo o Catálogo Acústico do Gosto Semântico.
   
2. **Cálculo de Score e Pesos:**
   - Fluxograma detalhando o algoritmo de similaridade.
   - Exibição explícita da ponderação das variáveis (`w_ac`, `w_txt`, `w_pop`, `w_div`).

3. **Pipeline de Ingestão de Dados:**
   - Mapeamento passo a passo da esteira de dados:
     `MusicBrainz` → `AcousticBrainz` → `Extração de Embeddings` → Ingestão no `pgvector` (PostgreSQL).
