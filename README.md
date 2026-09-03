# 🕰️ The Time Machine

> Um portal 2D e sonoro de descoberta musical através das décadas (1950 – 2010), sincronizado com o seu perfil do Spotify e filtros acústicos analógicos em Web Audio.

---

## 🧭 Visão do Projeto

O **The Time Machine** transporta o ouvinte para o passado musical sem perder a conexão com sua identidade sonora atual. A aplicação extrai o perfil de gosto do usuário, localiza faixas equivalentes em cada década e aplica a coloração sonora real da época (válvulas, fitas magnéticas, prensagens de vinil e compressão MP3) diretamente no fluxo de áudio.

---

## 🏛️ Arquitetura do Sistema

```mermaid
graph TD
    subgraph Frontend ["Front_end (React 18 + Vite + TS)"]
        UI[Arc Carousel & Nixie Clock]
        Cat[CatalogSection]
        Store[Zustand Store - useMachine]
        Audio[Web Audio Engine - Insert Filters]
    end

    subgraph Backend ["backend (FastAPI + Python 3.12+)"]
        API[FastAPI Routers]
        AuthRouter["/v1/auth (OAuth2 Spotify)"]
        DecadesRouter["/v1/decades (Faixas & Afinidade)"]
        TracksRouter["/v1/tracks (Audio & Capas Fallback)"]
        CuratorRouter["/v1/curate (Curadoria)"]
        Catalog[SpotifyTrackCatalog & Memory Cache]
        DeezerProxy[Deezer Matching Proxy]
    end

    subgraph External ["Serviços Externos"]
        SpotifyAPI[Spotify Web API]
        DeezerAPI[Deezer API - 30s Audio Previews]
        GroqAPI[Groq API - LLM Inference]
    end

    UI --> Store
    Cat --> Store
    Store -->|GET /v1/decades/{id}/tracks| DecadesRouter
    Store -->|POST /v1/curate| CuratorRouter
    Store --> Audio
    Audio -->|GET /v1/tracks/{id}/audio| TracksRouter

    DecadesRouter --> Catalog
    Catalog -->|OAuth2 / Client Credentials| SpotifyAPI
    Catalog -->|Enriquecimento Acústico| GroqAPI
    TracksRouter --> DeezerProxy
    DeezerProxy --> DeezerAPI
```

---

## ⚙️ Instalação e Execução

### 1. Pré-requisitos
- Node.js 18+
- Python 3.12+

### 2. Backend (FastAPI)
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
A API estará disponível em `http://localhost:8000`. Documentação Swagger em `http://localhost:8000/docs`.

### 3. Frontend (React)
```powershell
cd Front_end
npm install
npm run dev
```
A aplicação estará disponível em `http://localhost:5173`.

---

## 🔍 Observações & Débitos Técnicos Identificados

No estado atual do desenvolvimento, foram documentados três pontos fundamentais para as próximas iterações:

1. **Velocidade de Carregamento das Músicas:**
   - O processo atual de carregar uma década realiza buscas paginadas no Spotify somadas a chamadas externas para inferência de features acústicas. Isso gera uma latência de 3s a 6s ao trocar de época.
   - *Solução planejada:* Implementação de cache persistente (SQLite/Redis) e transição para o motor de ML local.

2. **Sincronização Visual do Carrossel em Arco (`ArcCarousel.tsx`):**
   - Os cartões do carrossel visual no topo da página utilizavam dados estáticos com IDs legados (`50s-0`), causando desconexão com as faixas reais e capas do catálogo dinâmico logo abaixo.
   - *Solução planejada:* Alimentar os cartões do carrossel diretamente a partir do estado dinâmico (`tracksMap`) ou do endpoint de destaques por década.

3. **Substituição da Curadoria LLM por Motor de Machine Learning:**
   - A dependência de LLMs remotos introduz instabilidade (depreciações de modelos de terceiros) e latência incompatível com uma experiência fluida.
   - *Plano aprovado:* Substituição por **Filtragem Baseada em Conteúdo (Cosine Similarity sobre Audio Features)**.
   - Veja a análise completa em [`docs/ML_ENGINE_ANALYSIS.md`](docs/ML_ENGINE_ANALYSIS.md).

---

## 🤖 Onboarding para Continuidade com Claude Code

Para instruções detalhadas de arquitetura, contratos de dados, guia de navegação na base de código e roadmap de implementação, consulte o arquivo mestre:

👉 **[`CLAUDE.md`](CLAUDE.md)**
