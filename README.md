# 🎓 DegreeTrack & Quiz (Under Development)

> ⚠️ **Note:** This application is currently **under development**. You can download the latest Android APK for testing here: [Download APK](./apk/degreetrack-quiz-debug.apk).

A privacy-focused, local-first web application that helps self-learners structure their online degree curriculum, track study progress, manage assignments, log study sessions, and self-assess using Gemini Gems.

> **100% Offline & API-Free.** DegreeTrack uses IndexedDB for persistent storage. Everything runs locally in your browser—no backend servers, and zero data leaving your device, except when explicitly using the Google Drive backup feature.

---

## ✨ Features

### ☁️ Cloud Sync & Backups (New)
- **Google Drive Integration**: Back up and restore your entire curriculum (including base64 files and metadata) seamlessly to your Google Drive AppData folder. Your data stays hidden and secured from the main drive interface.

### 🤖 AI Study Assistants
- **Gemini Gems Integration**: Attach links to personalized Google Gemini Gems or NotebookLM spaces directly to your courses. Jump instantly from your curriculum into an AI-powered tutor session specific to your current class.

### 📚 Curriculum & Progress Tracker
- **Three-level hierarchy** — Courses → Modules → Topics/Lessons (e.g. *"Computer Science > Data Structures > Trees"*)
- **Status tracking** per topic: Not Started · In Progress · Needs Review · Completed · Mastered
- **Dynamic Mastery Logic**: Enter custom max scores for your quizzes (e.g. 18 / 20). Scoring $\ge 85\%$ marks a topic as Mastered 🌟, while $70\%-84\%$ marks it as Completed ✅. 
- **Resource links** attached to each topic (videos, PDFs, articles, textbooks) with specific **Study Scopes** to prevent overwhelm.
- **Per-topic notes** and structured **Study Plans** with inline editing.
- **Practice Exercises & Capstone Projects**: Dedicated hierarchical support for low-stakes practice routines (at the topic level) and major capstone projects (at the module level) with nested milestones.
- **Course Import/Export (V4 Schema)**: Backup entire courses (including structure, files, assignments, and deep metadata) to a `.zip` file, and share or import them seamlessly. The app natively supports complex 4.5-year university-style curricula via the V4 JSON spec.

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
- **Dark / Light mode** toggle with smooth transitions (fully optimized for Tailwind v4 and respects OS color scheme matching).
- **Glassmorphism** sidebar with backdrop blur
- **Responsive layout**: collapsible sidebar on mobile with overlay
- **Micro-animations**: hover effects, slide-in transitions, progress ring animation

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, TypeScript) |
| **Mobile Build**| [Capacitor](https://capacitorjs.com/) (Android / iOS) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) |
| **Icons** | [Lucide React](https://lucide.dev) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs) |
| **Local Database** | [Dexie.js](https://dexie.org) (IndexedDB wrapper) |
| **Charts** | [Recharts](https://recharts.org) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Android Studio** (for APK generation)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd degreetrack-quiz

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Vercel Deployment

The web application is completely static and fully compatible with **Vercel**:

```bash
npm run build
npm start
```

### Capacitor Android Build

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
The APK will be output in `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 Privacy

- **100% Offline by Default** — all curriculum, assignment files, scores, and study sessions are stored securely in your browser's IndexedDB.
- **Google Drive Backups** — You have the *option* to authorize Google Drive sync to back up your database.
- **No APIs / No Tracking** — completely self-controlled and independent.

---

## 🛠️ Development Notes

- **TypeScript strict mode** is enabled (`noImplicitAny: false` for flexibility)
- **Zustand stores** hydrate from IndexedDB on app initialization via `AppInitializer`
- **Tailwind v4** uses the `@theme inline` and `@custom-variant` directives in `globals.css` for design tokens and strict dark mode enforcement.

---

## 📄 License

MIT

---

Built with ☕, 🎵, and the help of AI for self-learners everywhere.
