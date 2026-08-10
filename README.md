# 🎓 DegreeTrack & Quiz

A privacy-focused, local-first web application that helps self-learners structure their online degree curriculum, track study progress, and generate AI-powered self-assessment quizzes.

> **All data stays on your device.** DegreeTrack uses IndexedDB for persistent storage—no account required, no data leaves your browser.

---

## ✨ Features

### 📚 Curriculum & Progress Tracker
- **Three-level hierarchy** — Courses → Modules → Topics/Lessons (e.g. *"Computer Science > Data Structures > Trees"*)
- **Status tracking** per topic: Not Started · In Progress · Needs Review · Completed
- **Resource links** attached to each topic (videos, PDFs, articles, textbooks)
- **Per-topic notes** with inline editing
- **Progress bars** at every level (course, module) with real-time calculations
- **Color-coded course icons** from the Lucide icon library

### 🧠 AI-Powered Quiz Engine
- **Gemini 2.0 Flash** integration for dynamic quiz generation
- **Two input modes**: paste study notes or select a curriculum topic
- **Configurable quizzes**: choose 5, 10, or 15 questions at Easy / Medium / Hard difficulty
- **Mixed question types**: ~70% multiple-choice, ~30% short-answer
- **Detailed explanations** for every answer (correct and incorrect)
- **Spaced-repetition feedback**: topics scoring below 70% are automatically flagged as "Needs Review"

### ⏱️ Study Journal & Pomodoro Timer
- **Dual timer modes**: Pomodoro (25/5/15 configurable) or free-form Stopwatch
- **Session logging**: duration, topic, course, and notes recorded per session
- **Session history** table with filtering and duration formatting
- **Link sessions to curriculum** — select a course and topic before starting

### 📊 Analytics Dashboard
- **Overall progress ring** with animated SVG
- **Stats cards**: Total Courses, Completed Topics, Study Streak, Estimated Completion
- **Performance chart**: quiz score trends over time (Recharts line chart)
- **Study time chart**: daily/weekly study hours (Recharts bar chart)
- **Weak spot identification**: surfaces topics with low quiz scores for targeted review
- **Due-for-review panel** on the dashboard

### 🎨 Design & UX
- **Dark / Light mode** toggle with smooth transitions
- **Glassmorphism** sidebar with backdrop blur
- **Responsive layout**: collapsible sidebar on mobile with overlay
- **Micro-animations**: hover effects, slide-in transitions, progress ring animation
- **Custom scrollbar** styling
- **Inter font** via `next/font`

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, TypeScript) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) |
| **Icons** | [Lucide React](https://lucide.dev) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs) |
| **Local Database** | [Dexie.js](https://dexie.org) (IndexedDB wrapper) |
| **Charts** | [Recharts](https://recharts.org) |
| **AI** | [Gemini 2.0 Flash API](https://ai.google.dev) |
| **Utilities** | date-fns, uuid |

---

## 📂 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/quiz/           # Server-side quiz generation endpoint
│   ├── analytics/          # Analytics page
│   ├── curriculum/         # Curriculum list + [courseId] detail page
│   ├── dashboard/          # Dashboard overview page
│   ├── journal/            # Study journal & Pomodoro timer page
│   ├── quiz/               # Quiz setup, runner, results page
│   ├── globals.css         # Design tokens, animations, scrollbar
│   └── layout.tsx          # Root layout (sidebar, header, theme)
├── components/
│   ├── analytics/          # PerformanceChart, StudyTimeChart, WeakSpotList
│   ├── curriculum/         # CourseCard, ModuleAccordion, TopicRow, modals
│   ├── dashboard/          # ProgressRing, StatsCard, RecentActivity
│   ├── journal/            # PomodoroTimer, SessionLog
│   ├── layout/             # Sidebar, Header, ThemeProvider, AppInitializer
│   ├── quiz/               # QuizSetup, QuizRunner, QuestionCard, QuizResults
│   └── ui/                 # Badge, Button, Input, Modal, ProgressBar, etc.
├── lib/
│   ├── db.ts               # Dexie database schema (IndexedDB)
│   ├── gemini.ts           # Gemini API client (server-side)
│   └── utils.ts            # Shared helpers (ID generation, formatting)
├── stores/
│   ├── useCurriculumStore  # Courses, modules, topics, resources
│   ├── useQuizStore        # Quiz generation, running, results
│   ├── useThemeStore       # Dark/light mode persistence
│   └── useTimerStore       # Pomodoro/stopwatch state + session logging
└── types/
    ├── curriculum.ts       # Course, Module, Topic, Resource interfaces
    ├── journal.ts          # StudySession, TimerConfig interfaces
    └── quiz.ts             # Quiz, Question, QuizResult interfaces
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- A **Gemini API key** (free tier available at [ai.google.dev](https://ai.google.dev))

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd degreetrack-quiz

# Install dependencies
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

---

## 🗺️ App Routes

| Route | Description |
|---|---|
| `/` | Redirects to Dashboard |
| `/dashboard` | Overview with progress ring, stats, review queue, quick actions |
| `/curriculum` | Course list with progress bars |
| `/curriculum/[courseId]` | Course detail: modules, topics, resources, notes |
| `/quiz` | AI quiz setup → runner → results flow |
| `/journal` | Pomodoro timer, stopwatch, session history |
| `/analytics` | Performance charts, study time, weak spot analysis |

---

## 🔒 Privacy

- **Zero server-side data storage** — all curriculum, quiz results, and study sessions are stored in your browser's IndexedDB
- **No user accounts** — no sign-up, no tracking
- **API calls are minimal** — only the Gemini quiz generation endpoint is called, and it runs server-side so your API key is never exposed to the client

---

## 🛠️ Development Notes

- **TypeScript strict mode** is enabled (`noImplicitAny: false` for flexibility)
- **Zustand stores** hydrate from IndexedDB on app initialization via `AppInitializer`
- **Quiz generation** happens server-side in `src/app/api/quiz/route.ts` to protect the API key
- **Tailwind v4** uses the `@theme inline` directive in `globals.css` for design tokens

---

## 📄 License

MIT

---

Built with ☕ and 🎵 for self-learners everywhere.
