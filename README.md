# 🎓 DegreeTrack & Quiz (Under Development)

> ⚠️ **Note:** This application is currently **under development**. You can download the latest Android APK for testing here: [Download APK](./apk/degreetrack-quiz-debug.apk).

A privacy-focused, local-first web application that helps self-learners structure their online degree curriculum, track study progress, and manage assignments and self-assessment scores.

> **100% Offline & API-Free.** DegreeTrack uses IndexedDB for persistent storage. Everything runs locally in your browser—no accounts, no backend servers, and zero data leaving your device.

---

## ✨ Features

### 📚 Curriculum & Progress Tracker
- **Three-level hierarchy** — Courses → Modules → Topics/Lessons (e.g. *"Computer Science > Data Structures > Trees"*)
- **Status tracking** per topic: Not Started · In Progress · Needs Review · Completed · Mastered
- **Dynamic Mastery Logic**: Enter custom max scores for your quizzes (e.g. 18 / 20). Scoring $\ge 85\%$ marks a topic as Mastered 🌟, while $70\%-84\%$ marks it as Completed ✅. 
- **Resource links** attached to each topic (videos, PDFs, articles, textbooks) with specific **Study Scopes** to prevent overwhelm.
- **Per-topic notes** and structured **Study Plans** with inline editing.
- **Practice Exercises & Capstone Projects**: Dedicated hierarchical support for low-stakes practice routines (at the topic level) and major capstone projects (at the module level) with nested milestones.
- **Course Import/Export (V2 Schema)**: Backup entire courses (including structure, files, assignments, and deep metadata) to a `.zip` file, and share or import them seamlessly. The app natively supports complex 4.5-year university-style curricula via the V2 JSON spec.

### 🧠 Smart Flashcards (Spaced Repetition)
- **SuperMemo-2 Algorithm**: Automatically schedules flashcard reviews based on your recall performance.
- **Embedded inside topics**: Create flashcards directly linked to specific curriculum topics.
- **Study Mode**: Clean, distraction-free interface for reviewing due flashcards.

### 🎮 Gamification
- **XP System**: Earn XP by completing topics (+50 XP) and mastering quizzes (+100 XP).
- **Levels**: Automatically level up as your XP grows, giving you a visual sense of progression.
- **Gamification Widget**: A beautiful dashboard widget that tracks your level progress bar and total XP.

### 📝 Assignment Tracker & Native File Support
- **File Attachments**: Course creators can attach assignment briefs (PDF, images, documents) or external links directly to a topic.
- **Student Submissions**: Students can upload their completed assignment files or paste external links (e.g., Google Drive, GitHub) for self-managed tracking.
- **Mobile Native Sharing**: Full support for Android/iOS Capacitor APIs. Downloaded files instantly trigger the native Share Sheet for easy viewing.

### ⏱️ Study Journal & Pomodoro Timer
- **Dual timer modes**: Pomodoro (25/5/15 configurable) or free-form Stopwatch
- **Session logging**: duration, topic, course, and notes recorded per session
- **Session history** table with filtering and duration formatting
- **Link sessions to curriculum** — select a course and topic before starting

### 📊 Analytics Dashboard
- **Overall progress ring** with animated SVG
- **Stats cards**: Total Courses, Completed Topics, Study Streak, Estimated Completion
- **Performance chart**: topic scores vs passing target (70%), dynamically scoped per course (Recharts)
- **Study time chart**: daily/weekly study hours (Recharts bar chart)
- **Weak spot identification**: surfaces topics with low quiz scores for targeted review
- **Due-for-review panel** on the dashboard

### 🎨 Design & UX
- **Dark / Light mode** toggle with smooth transitions
- **Glassmorphism** sidebar with backdrop blur
- **Responsive layout**: collapsible sidebar on mobile with overlay
- **Micro-animations**: hover effects, slide-in transitions, progress ring animation
- **Custom scrollbar** styling

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
| **Utilities** | date-fns, uuid |

---

## 📂 Project Structure

\`\`\`
src/
├── app/                    # Next.js App Router pages
│   ├── analytics/          # Analytics page
│   ├── curriculum/         # Curriculum list + [courseId] detail page
│   ├── dashboard/          # Dashboard overview page
│   ├── journal/            # Study journal & Pomodoro timer page
│   ├── globals.css         # Design tokens, animations, scrollbar
│   └── layout.tsx          # Root layout (sidebar, header, theme)
├── components/
│   ├── analytics/          # PerformanceChart, StudyTimeChart, WeakSpotList
│   ├── curriculum/         # CourseCard, ModuleAccordion, TopicRow, modals
│   ├── dashboard/          # ProgressRing, StatsCard, RecentActivity
│   ├── journal/            # PomodoroTimer, SessionLog
│   ├── layout/             # Sidebar, Header, ThemeProvider, AppInitializer
│   └── ui/                 # Badge, Button, Input, Modal, ProgressBar, etc.
├── lib/
│   ├── db.ts               # Dexie database schema (IndexedDB)
│   └── utils.ts            # Shared helpers (ID generation, formatting)
├── stores/
│   ├── useCurriculumStore  # Courses, modules, topics, resources
│   ├── useThemeStore       # Dark/light mode persistence
│   └── useTimerStore       # Pomodoro/stopwatch state + session logging
└── types/
    ├── curriculum.ts       # Course, Module, Topic, Resource, Assignment interfaces
    └── journal.ts          # StudySession, TimerConfig interfaces
\`\`\`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18

### Installation

\`\`\`bash
# Clone the repository
git clone <repo-url>
cd degreetrack-quiz

# Install dependencies
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Vercel Deployment

The application is completely static and fully compatible with **Vercel**. Since there are no API dependencies or environment variables required, you can deploy it instantly:

\`\`\`bash
npm run build
npm start
\`\`\`

---

## 🗺️ App Routes

| Route | Description |
|---|---|
| \`/\` | Redirects to Dashboard |
| \`/dashboard\` | Overview with progress ring, stats, review queue, quick actions |
| \`/curriculum\` | Course list with progress bars |
| \`/curriculum/[courseId]\` | Course detail: modules, topics, resources, notes |
| \`/journal\` | Pomodoro timer, stopwatch, session history |
| \`/analytics\` | Performance charts, study time, weak spot analysis |

---

## 🔒 Privacy

- **100% Offline** — all curriculum, assignment files, scores, and study sessions are stored securely in your browser's IndexedDB.
- **No user accounts** — no sign-up, no tracking.
- **No APIs** — completely self-controlled and independent.

---

## 🛠️ Development Notes

- **TypeScript strict mode** is enabled (\`noImplicitAny: false\` for flexibility)
- **Zustand stores** hydrate from IndexedDB on app initialization via \`AppInitializer\`
- **Tailwind v4** uses the \`@theme inline\` directive in \`globals.css\` for design tokens

---

## 📄 License

MIT

---

Built with ☕, 🎵, and the help of AI for self-learners everywhere.
