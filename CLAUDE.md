# 🕰️ The Time Machine — Guia de Onboarding & Contexto para Claude Code

Este documento serve como o ponto de entrada e contexto mestre para o desenvolvimento contínuo no **Claude Code**. Contém a arquitetura atual, estado das implementações, pontos de atenção imediatos e o plano de migração para o motor de ML.

---

## 📌 1. Visão Geral do Projeto

**The Time Machine** é uma aplicação web imersiva de descoberta musical por décadas (de 1950 a 2010). O sistema analisa o perfil sonoro e o gosto contemporâneo do usuário e o transporta no tempo, recomendando faixas de épocas passadas com a mesma "vibe", aplicando filtros analógicos de áudio específicos de cada era via Web Audio API.

### 🏛️ Estrutura do Repositório

```
"The Time Machine"/
├── Front_end/                  # Aplicação React 18 + Vite + TypeScript + TailwindCSS
│   ├── src/
│   │   ├── components/         # ArcCarousel, CatalogSection, CuratorSection, PlayerBar, etc.
│   │   ├── store/useMachine.ts # Store central Zustand (estado da máquina, áudio e tracks)
│   │   ├── lib/                # audioEngine.ts (Web Audio API), covers.ts, math.ts
│   │   └── data/               # decades.ts (definições das 7 décadas)
│   └── package.json
│
├── backend/                    # API FastAPI (Python 3.12+)
│   ├── app/
│   │   ├── main.py             # Entrada FastAPI, CORS e lifecycle (lifespan)
│   │   ├── config.py           # Configurações e variáveis de ambiente (Pydantic Settings)
│   │   ├── deps.py             # Injeção de dependências dos Providers
│   │   ├── providers/          # SpotifyTrackCatalog, CuratorProvider, Mock
│   │   ├── routers/            # decades.py, tracks.py, curator.py, auth.py, playlists.py
│   │   ├── schemas/            # Schemas Pydantic (Decade, Track, Curator, Taste)
│   │   └── services/           # affinity.py (cálculo de afinidade Manhattan)
│   ├── pyproject.toml
│   └── .env                    # Chaves de API (Spotify, Groq, LastFM)
│
└── docs/                       # Documentação técnica e especificações
```

---

## 🚀 2. Como Executar o Projeto

### Backend (FastAPI)
Local: `backend/`
```powershell
cd backend
# Ativar venv caso exista ou usar python global:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Docs: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/healthz`

### Frontend (React / Vite)
Local: `Front_end/`
```powershell
cd Front_end
npm install
npm run dev
```
- Acesso Web: `http://localhost:5173`

---

## 🧭 3. Estado Atual da Implementação (Status Quo)

1. **Frontend Desacoplado do Mock:**
   - O frontend carrega faixas assincronamente via `loadDecadeTracks(decade)` em `useMachine.ts`, consumindo `GET /v1/decades/{decade}/tracks?taste=1`.
   - Autenticação Spotify OAuth2 implementada: usuário conecta sua conta no TopBar, gerando token JWT/Access Token do Spotify armazenado em `localStorage.getItem('spotify_token')`.

2. **Backend e Catálogo Spotify:**
   - `SpotifyTrackCatalog`: Quando recebe o token do usuário, busca os top gêneros (`/v1/me/top/artists`) e monta queries segmentadas por década (ex: `year:1980-1989 genre:"rock"`).
   - Busca em blocos sequenciais de 10 faixas (limite imposto pelo endpoint `/v1/search` do Spotify em credenciais recentes) com retry para evitar erros `502 Bad Gateway`.
   - `get_track(track_id)` com dicionário global em memória `_all_tracks` para lookup O(1) de metadados, capas e áudio.

3. **Áudio e Capas:**
   - Como o Spotify Web API depreciou o retorno de `preview_url` (MP3 de 30s) para a maioria das faixas, o backend utiliza um proxy fallback no Deezer (`/v1/tracks/{id}/audio` e `/v1/tracks/{id}/cover`) que faz matching por artista + título.
   - O Web Audio API no frontend intercepta o fluxo de áudio via `MediaElementSource` e aplica filtros acústicos por década (Válvula nos anos 50, Fita nos 60, Vinil nos 70/80, Compressão nos 90).

---

## ⚠️ 4. Observações Críticas & Débitos Técnicos Identificados

> **Atualização:** as três observações abaixo e os passos 1–3 da seção 6 foram
> implementados. Texto original preservado para contexto; ver anotações
> "✅ Resolvido" em cada item.

### 🔴 Observação 1: Latência no Carregamento de Faixas (Performance) — ✅ Resolvido
- **Problema:** A troca de décadas pode demorar entre 3s e 6s.
- **Causa Raiz:** O backend faz 4 requisições HTTP sequenciais para o Spotify Search + 1 requisição para o LLM estimar features acústicas de 20 faixas antes de responder o endpoint `/tracks`.
- **Ação tomada:** `TTLCache` com persistência em JSON (`app/services/cache.py`, TTL de 6h) substituindo os dicts em memória sem expiração de `SpotifyTrackCatalog` e `SpotifyTasteSource`; offset de busca passou de aleatório (`random.randint(0,300)`, podia estourar resultados de queries estreitas) para determinístico por década (`crc32`). Prefetch de décadas vizinhas adicionado em `useMachine.ts::goToDecade` e no mount de `ArcCarousel.tsx`.

### 🔴 Observação 2: Desconexão entre Músicas e Capas no Carrossel em Arco — ✅ Resolvido
- **Problema:** O carrossel em arco (`ArcCarousel.tsx`) renderiza capas procedurais/estáticas de `src/data/tracks.ts` (ex: `50s-0`), enquanto o catálogo logo abaixo exibe as músicas reais do Spotify.
- **Ação tomada:** `slots` em `ArcCarousel.tsx` agora lê de `tracksMap` (store `useMachine`) quando a década já carregou, caindo no mock só como fallback de loading. O componente dispara `loadDecadeTracks` para as 7 décadas no mount.

### 🔴 Observação 3: Substituição da Curadoria LLM pelo Motor de ML (Cosine Similarity) — ✅ Resolvido
- **Diretriz:** Substituir a curadoria LLM por **Filtragem Baseada em Conteúdo (Content-Based Filtering)** utilizando **Similaridade de Cosseno** sobre as *Audio Features*.
- **Ação tomada:** `app/services/ml_recommender.py` (`MusicRecommender`: centroide + `sklearn.metrics.pairwise.cosine_similarity` + MMR para diversidade) e `app/providers/ml_curator.py` (`MLCurator`, sem dependência de API externa). `app/main.py` registra `MLCurator` incondicionalmente — não depende mais de `GROQ_API_KEY`. `curator_llm.py` (Groq) não foi apagado, só deixou de ser o caminho padrão.

---



## 🔬 5. Análise de Viabilidade Técnica: Motor de ML (Audio Features + Cosine Similarity)

### Resumo da Proposta do Usuário
A proposta sugere criar um pipeline determinístico em Python:
1. **User Taste Vector:** Extrair as *Top Tracks* do usuário (`/v1/me/top/tracks`) e suas *Audio Features* (`danceability`, `energy`, `valence`, `acousticness`, `instrumentalness`, `tempo`, `loudness`).
2. **Centróide Vetorial:** Normalizar os atributos (ex: `MinMaxScaler` ou `StandardScaler`) e calcular a média vetorial das top faixas:
   $$\vec{u} = \frac{1}{N} \sum_{i=1}^N \vec{x}_i$$
3. **Filtro de Década:** Isolar as músicas candidatas da década selecionada no dataset.
4. **Cálculo de Proximidade:** Calcular a Similaridade de Cosseno entre $\vec{u}$ e cada faixa candidata $\vec{v}$:
   $$\text{sim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}$$
5. **Ranking:** Retornar o ranking ordenado de forma determinística em < 10ms.

### ⚖️ Avaliação de Viabilidade e Ponto de Atenção Crítico

| Critério | Avaliação | Detalhes |
| :--- | :---: | :--- |
| **Latência** | ⭐⭐⭐⭐⭐ (Excelente) | Inferência via `scikit-learn` / `numpy` roda em **menos de 5 milissegundos**, eliminando os 3 segundos de espera do LLM. |
| **Custo & Disponibilidade** | ⭐⭐⭐⭐⭐ (Excelente) | Custo zero de API externa para inferência; sem risco de "model deprecated" quebrando a produção. |
| **Precisão de Afinidade** | ⭐⭐⭐⭐⭐ (Excelente) | Matemático e contínuo; substitui a fórmula de Manhattan empírica por projeção vetorial no hiper-espaço sonoro. |
| **Ponto de Atenção: Spotify API** | ⚠️ (Crítico) | Em nov/2024 a Spotify Developer Platform começou a restringir o endpoint `/v1/audio-features` para contas sem aprovação estendida comercial. |

### 🛠️ Estratégia de Implementação Recomendada (Arquitetura Híbrida Robusta)

1. **Dataset Histórico Pré-indexado (Kaggle Spotify 1.2M Tracks):**
   - Em vez de consultar o Spotify em tempo real a cada clique de década e tentar enriquecer faixas, carregar um dataset pré-processado (formato Parquet ou SQLite leve com `pgvector`/índice columnar) contendo as faixas mais representativas de cada década de 1950 a 2019 com suas *Audio Features* reais já extraídas.
   - Isso garante **latência sub-10ms** e imunidade total a falhas de rate limit do Spotify.

2. **Extração do Gosto do Usuário (Spotipy / Spotify Web API):**
   - Obter as top faixas do usuário autenticado via `GET /v1/me/top/tracks?limit=20`.
   - Se o token do usuário tiver permissão para `audio-features`, puxa diretamente. Se a API de audio-features retornar 403 (restrição recente da API), faz o match das faixas do usuário contra o dataset local (via ISRC ou nome do artista/título) para obter seus vetores acústicos.

3. **Módulo de Recomendação (`backend/app/services/recommender.py`):**
   - Classe `MusicRecommender` encapsulando:
     - `fit_user_taste(tracks_features_list)` -> gera vetor centróide.
     - `recommend_for_decade(decade_id, top_n=15)` -> aplica máscara de ano e calcula cosine similarity via `sklearn.metrics.pairwise.cosine_similarity`.

---

## 📋 6. Roteiro Passo-a-Passo para o Claude Code Prosseguir

1. **Passo 1 (Performance & Cache):**
   - Implementar cache em disco/memória no `backend/app/providers/spotify_catalog.py` para evitar refazer buscas no Spotify a cada requisição de década.
   
2. **Passo 2 (Sincronização Visual do Carrossel):**
   - Ajustar `Front_end/src/components/ArcCarousel.tsx` para sincronizar os cartões com as músicas reais carregadas na store `useMachine.ts`, corrigindo a desconexão de capas e títulos.

3. **Passo 3 (Construção do Motor de ML):**
   - Adicionar dependências no `backend/pyproject.toml`: `scikit-learn`, `pandas`, `numpy`.
   - Criar o serviço `backend/app/services/ml_recommender.py` implementando a lógica de Centróide + Cosine Similarity.
   - Criar endpoint `POST /v1/curate/ml` ou substituir o endpoint atual `POST /v1/curate` para retornar a playlist ranqueada pelo motor de ML.
