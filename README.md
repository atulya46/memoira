# Memoira

**Journaling with AI powered scrapbooks.** A Journal cum Scrapbook with a minimalistic interface to help you capture raw emotions via notes, voice-notes and pictures. Upload your photos, voice notes, and memories — Memoira reconstructs your trip into a beautiful, shareable digital scrapbook.

<!-- Demo video — Coming Soon (below is just a placeholder) -->
<!--
[![Memoira Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
-->

---

## What it does

1. **Create a journal entry** — give it a name and dates (optional)
2. **Upload memories** — photos, voice notes, and written notes
3. **AI reconstruction** — Gemini categorizes your images (food, monuments, nature, selfies…), Groq/Whisper transcribes your voice notes, and the AI groups everything into a day-by-day timeline
4. **Scrapbook generation** — your memory becomes a themed scrapbook you can edit and customize/you can also choose to just keep written notes
5. **Share** — publish a public link to share your scrapbook with anyone (or maybe just your friends?)

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.11+ |
| Database & Auth | Supabase (Postgres + Auth + Storage) |
| AI — image analysis | Google Gemini API |
| AI — voice transcription | Groq (Whisper) |
| Hosting | Vercel (frontend) · Railway (backend) |

---

## Getting started (local development)

### Prerequisites

- Node.js 20+
- Python 3.11+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) key (Gemini)
- A [Groq](https://console.groq.com) key (Whisper transcription)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/memoira.git
cd memoira
```

### 2. Set up the database

In your Supabase project's **SQL editor**, run:

```bash
supabase/schema.sql
supabase/hardening_migration.sql
```

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your_google_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
FRONTEND_URL=http://localhost:3000
```

Start the API:

```bash
uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

### 4. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
# Runs on http://localhost:3000
```

---

---

## Project structure

```
memoira/
├── frontend/          # Next.js app
│   └── app/
│       ├── trips/     # Trip detail, scrapbook, reconstruction views
│       ├── s/[token]  # Public shared scrapbook page
│       └── (auth)/    # Login / auth flows
├── backend/           # FastAPI app
│   └── app/
│       ├── routers/   # trips, memories, scrapbooks endpoints
│       ├── services/  # Gemini + Groq/Whisper integrations
│       └── models/    # Pydantic schemas
└── supabase/          # DB schema and migrations
```

---

## Contributing

Contributions are welcome. A few guidelines:

1. **Fork** the repo and create a feature branch (`git checkout -b feat/your-feature`)
2. **Keep PRs focused** — one feature or fix per PR
3. **Test locally** before opening a PR
4. Open a **GitHub Issue** first for anything non-trivial so we can discuss approach
5. Be respectful — this project follows the [Contributor Covenant](https://www.contributor-covenant.org/)

---

## License

[MIT](LICENSE)
