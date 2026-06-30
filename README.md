# Trade Scanner AI V1

O **Trade Scanner AI V1** é um sistema completo e automatizado para identificar oportunidades de valor (Value Betting) e trading esportivo em jogos de futebol diários. O sistema calcula a probabilidade real das partidas utilizando o modelo matemático de **Distribuição de Poisson** e compara com as odds de mercado das casas de apostas, apontando as melhores entradas para **BACK** (a favor) ou **LAY** (contra).

---

## 🚀 Como Rodar o Projeto Localmente

### 1. Requisitos Prévios
- [Node.js](https://nodejs.org/) (Versão 18 ou superior) instalado.
- [Python](https://www.python.org/) (Versão 3.10 ou superior) instalado.

---

### 2. Configurando o Backend (Python FastAPI)

1. Entre no diretório do backend:
   ```bash
   cd backend
   ```

2. Crie e ative um ambiente virtual (opcional, mas recomendado):
   ```bash
   python -m venv venv
   # No Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # No Linux/Mac:
   source venv/bin/activate
   ```

3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

4. Crie o seu arquivo de variáveis de ambiente:
   - Copie o arquivo `.env.example` e salve como `.env`
   - O arquivo `.env` já vem pré-configurado no **Modo Mock (MOCK_MODE=true)**. Esse modo gerará dados estatísticos consistentes e jogos diários simulados para que a plataforma funcione de imediato, mesmo sem chaves de API.
   - Para habilitar o chat com inteligência artificial no modal de análise profunda, configure sua `GEMINI_API_KEY` gerada no Google AI Studio.

5. Execute o backend localmente:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - O servidor FastAPI iniciará em `http://localhost:8000`.
   - Você pode testar e explorar os endpoints abrindo a documentação interativa em: `http://localhost:8000/docs`.

---

### 3. Configurando o Frontend (Next.js 14+)

1. Abra um novo terminal e entre no diretório do frontend:
   ```bash
   cd frontend
   ```

2. Instale as dependências do projeto:
   ```bash
   npm install
   ```

3. Crie o seu arquivo de variáveis de ambiente:
   - Crie um arquivo chamado `.env.local` na raiz da pasta `frontend/` e adicione:
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:8000
     ```

4. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   - O frontend abrirá em seu navegador no endereço: `http://localhost:3000`.

---

## ☁️ Guia de Deploy Grátis (Produção Híbrida)

Para colocar a plataforma online sem custo de hospedagem:

### 1. Banco de Dados (PostgreSQL Grátis)
- Crie uma conta gratuita no [Supabase](https://supabase.com/) ou [Neon](https://neon.tech/).
- Crie um banco PostgreSQL e copie a **Connection String** externa fornecida.

### 2. Backend (FastAPI no Render/Koyeb)
- Hospede seu código do backend no GitHub.
- Crie um serviço Web no [Render](https://render.com/) ou [Koyeb](https://www.koyeb.com/) conectado ao seu repositório.
- A plataforma detectará o arquivo `Dockerfile` automaticamente.
- Configure as variáveis de ambiente nas configurações do painel:
  - `DATABASE_URL`: Insira a Connection String do Supabase/Neon PostgreSQL.
  - `MOCK_MODE`: Defina como `false` (quando tiver chaves de API configuradas) ou mantenha `true` para rodar online com dados simulados ricos.
  - `GEMINI_API_KEY`: Insira sua chave do Google Gemini.
  - `THE_ODDS_API_KEY` e `FOOTBALL_DATA_API_KEY`: Suas chaves das fontes de dados reais.

### 3. Frontend (Next.js na Vercel)
- Crie um projeto na [Vercel](https://vercel.com/) e conecte à pasta `frontend` do seu repositório.
- Configure a variável de ambiente no painel da Vercel:
  - `NEXT_PUBLIC_API_URL`: O link do backend FastAPI gerado no Render/Koyeb (ex: `https://meu-backend.onrender.com`).
- Clique em **Deploy**. O site estará no ar gratuitamente!

---

## 🛠️ Tecnologias Utilizadas
- **Backend**: Python 3.10, FastAPI, SQLAlchemy, SQLite/PostgreSQL.
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS.
- **Modelo Estatístico**: Algoritmo de Distribuição de Poisson de gols esperados (xG).
- **IA**: Google Gemini API (`google-genai` com `gemini-2.5-flash`).
