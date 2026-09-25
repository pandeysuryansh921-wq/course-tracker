# 🎓 DegreeTrack & Quiz

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black)](https://nextjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-blue)](https://capacitorjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com/)
[![Local-First](https://img.shields.io/badge/Data-100%25%20Local-emerald)](#-privacy--local-first-architecture)

> 📱 **Latest Android Build:** [Download APK (`app-debug.apk`)](./apk/degreetrack-quiz-debug.apk)

A privacy-focused, local-first learning operating system and curriculum tracker designed for self-directed learners, university students, and independent scholars. DegreeTrack turns scattered educational resources into structured, trackable, and mastery-driven degrees with intelligent offline caching, Google Drive video streaming, and BYOK AI curation.

---

## 📑 Table of Contents

- [Core Philosophy](#-core-philosophy)
- [Major Features](#-major-features)
  - [1. Google Drive Video Organizer & In-App Player](#1--google-drive-video-organizer--in-app-player)
  - [2. Smart Rolling Offline Cache](#2--smart-rolling-offline-cache-prefetch--3-day-purge)
  - [3. AI Course Curation Engine (BYOK)](#3--ai-course-curation-engine-byok)
  - [4. 1-Tap Community Library & Publishing](#4--1-tap-community-library--publishing)
  - [5. Curriculum & Progress Tracking](#5--curriculum--mastery-tracking)
  - [6. Flashcards (Spaced Repetition)](#6--spaced-repetition-flashcards-sm-2)
  - [7. Study Journal & Pomodoro](#7--study-journal--pomodoro-timer)
  - [8. Analytics & Gamification](#8--analytics--gamification)
- [How-To User Guide](#-how-to-user-guide)
  - [How to Import a Google Drive Video Course](#how-to-import-a-google-drive-video-course)
  - [How to Use the Video Player & Rolling Cache](#how-to-use-the-video-player--rolling-cache)
  - [How to Curate Courses with AI](#how-to-curate-courses-with-ai)
  - [How to Publish to the Community Library](#how-to-publish-to-the-community-library)
  - [How to Sync & Backup with Google Drive](#how-to-sync--backup-with-google-drive)
- [Tech Stack & Architecture](#-tech-stack--architecture)
- [Installation & Development](#-installation--development)
- [Android APK Build Guide](#-android-apk-build-guide)
- [Privacy & Local-First Architecture](#-privacy--local-first-architecture)
- [License](#-license)

---

## 💡 Core Philosophy

1. **Local-First & Offline-Ready:** All curricula, notes, scores, and flashcards stay on your device inside IndexedDB (`Dexie.js`) and Capacitor filesystem sandbox. Zero mandatory cloud accounts.
2. **Zero Cloud Storage Fees:** Videos, slides, and heavy media remain stored in your personal Google Drive account (utilizing your free 15 GB or institutional Google Drive).
3. **Smart Storage Preservation:** Automatically balances offline access with device storage through predictive prefetching and timed auto-eviction.
4. **Bring Your Own Key (BYOK):** Connect directly to leading AI providers (Google Gemini, Groq, OpenAI, Anthropic, OpenRouter) with keys stored exclusively in your browser/device `localStorage`.

---

## 🌟 Major Features

### 1. 🎬 Google Drive Video Organizer & In-App Player
* **Recursive Folder Scanner:** Point DegreeTrack to any Google Drive course folder or subfolder tree. The scanner recognizes `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, and paired `.pdf` slides.
* **Natural Alphanumeric Sequencing:** Natural sorting guarantees that `Lecture 1`, `Lecture 2`, ..., `Lecture 9`, `Lecture 10` are placed in chronological order without standard alphabetical sort errors (`1, 10, 2`).
* **Slide & Notes Pairing:** Files sharing the same base name (e.g. `03_Recursion.mp4` and `03_Recursion_Slides.pdf`) are automatically bundled under a single Topic as primary video and reference slide materials.
* **Dual-Mode Hybrid Player:**
  * **Offline Mode (`⚡ Offline Ready`):** Plays from device storage with instant seeking, custom speeds (0.75x–2.0x), and zero internet consumption.
  * **Direct Cloud Stream Mode (`☁️ Streaming from Google Drive`):** If a lecture is not downloaded or was previously evicted, streams immediately on-the-fly via Google Drive's adaptive player without forcing a full download.
* **Timestamped Notes:** Type notes while watching; click **"Add Note at 04:15"** to record an exact bookmark. Clicking any timestamp jumps the video straight to that second.
* **Auto-Completion:** Watching $\ge 80\%$ of a lecture automatically marks the topic completed and awards XP.

---

### 2. ⚡ Smart Rolling Offline Cache (Prefetch & 3-Day Purge)

DegreeTrack implements a rolling cache window designed to prevent mobile and tablet storage bloat:

```
[Start Watching Lecture 1]
       │
       ├── 1. Lecture 1 plays (cached to device).
       │
       ├── 2. Background worker silently prefetches:
       │      ├── Lecture 2 (Ready for next session)
       │      └── Lecture 3 (Buffer for travel / spotty Wi-Fi)
       │
[Finish Lecture 1 (≥80%)]
       │
       ├── 3. Marked "Watched" ──► 3-Day Retention Countdown Begins.
       │
[3 Days Later]
       └── 4. Auto-Purge Sweeper safely removes local video from device.
              (Original Google Drive video is NEVER touched or deleted).
              (You can still re-stream or re-download Lecture 1 anytime!)
```

* **Storage Settings (Settings Modal):**
  * **Prefetch Window:** Download Next 1, 2, or 3 Lectures, or Stream Only.
  * **Auto-Purge Duration:** Delete local file after 1 Day, 3 Days (Recommended), 7 Days, or Never.
  * **1-Tap Storage Flush:** View exact disk space used by offline videos (e.g., `1.2 GB`) and clear cache on demand.

---

### 3. 🤖 AI Course Curation Engine (BYOK)
* **One-Prompt Degree Generation:** Input any subject (e.g., *"Distributed Systems"*, *"Quantum Computing"*, *"Bioinformatics"*), specify skill level (Beginner/Intermediate/Advanced), focus (Comprehensive, Fast-Track, Interview-Prep), and weekly hours.
* **Structured Pedagogical Output:** Produces a full degree track complete with Modules, sequenced Topics, learning outcomes, estimated hours, prerequisites, and curated learning resources.
* **Dynamic Model Auto-Recognition:**
  * Proactively discovers supported models via Google's `ListModels` API.
  * Automatically maps deprecated model aliases to live models (`gemini-2.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`).
  * Resilient fallback chain ensures curriculum generation never fails due to model deprecation.
* **Supported Providers:**
  * **Google Gemini (Recommended)** — Ultra-fast, large context, native JSON mode.
  * **Groq** — Ultra-low latency open-weight models (Llama 3.3 70B, Llama 3.1 8B).
  * **OpenAI** — GPT-4o, GPT-4o mini.
  * **Anthropic** — Claude 3.7 Sonnet, Claude 3.5 Haiku.
  * **OpenRouter** — Unified access to hundreds of open/proprietary models.

---

### 4. 🌐 1-Tap Community Library & Publishing
* **Browse & Import:** Explore community-curated courses from the open [Course Tracker Library](https://github.com/pandeysuryansh921-wq/course-tracker-library).
* **Direct 1-Tap Export:** Export an entire course or whole degree to the community library with a single click.
* **Android & Mobile Direct GitHub API:** Submits issues directly to GitHub's REST API from Android/Capacitor without requiring an external Node.js proxy server.
* **Client-Side Privacy Firewall:** Automatically scrubs:
  * Personal study progress and completion timestamps.
  * Quiz scores, mastery records, and exam logs.
  * Personal study journal notes and local file uploads.
  * API keys and credentials (strictly excluded).

---

### 5. 📚 Curriculum & Mastery Tracking
* **Three-Level Hierarchy:** `Course` $\rightarrow$ `Module` $\rightarrow$ `Topic`.
* **Prerequisite DAG Engine:** Directed Acyclic Graph algorithm resolves topic dependencies and highlights unblocked "Next Up" topics on your Study Dashboard.
* **Dynamic Mastery System:** Supports custom quiz max scores. Scoring $\ge 85\%$ awards **Mastered 🌟**, while $70\%-84\%$ awards **Completed ✅**.
* **Ecosystem Resource Links:** Attach videos, articles, documentation, slides, and interactive Gemini Gems with designated Study Scopes (`PRIMARY`, `REFERENCE`, `PRACTICE`, `DEEP_DIVE`).

---

### 6. 🧠 Spaced Repetition Flashcards (SM-2)
* Implements the **SuperMemo-2 (SM-2)** algorithm.
* Calculates interval, repetition count, and easiness factor based on recall quality (0–5).
* Embed flashcards directly within topics to review when due.

---

### 7. ⏱️ Study Journal & Pomodoro Timer
* **Dual Timer:** Configurable Pomodoro (25/5/15) or open Stopwatch.
* Logs duration, date, course, topic, and session notes.
* Filterable session history linked to the curriculum.

---

### 8. 📊 Analytics & Gamification
* **Gamification:** Earn +50 XP per topic completed and +100 XP per quiz mastered. Visual level-up progression bar on the dashboard.
* **Interactive Charts:** Recharts visualization for study time distribution and per-course quiz performance against passing benchmarks.
* **Weak Spot Identification:** Automatically surfaces topics with lower quiz scores for targeted review.

---

## 📖 How-To User Guide

### How to Import a Google Drive Video Course

1. **Prepare your Google Drive Folder:**
   * Place your video files (`.mp4`, `.mkv`, etc.) in a folder or subfolders on Google Drive.
   * If you have slides, name them similarly (e.g. `01_Intro.mp4` and `01_Intro_Slides.pdf`).
   * In Google Drive, click **Share $\rightarrow$ General access $\rightarrow$ Anyone with the link can view**.
   * Copy the folder link (e.g. `https://drive.google.com/drive/folders/1aBcDeFg...`).
2. **Open DegreeTrack:**
   * Go to **Curriculum** in the sidebar.
   * Click the **"Drive Course"** button in the top action bar.
3. **Scan & Structure:**
   * Paste your folder link.
   * Click **Scan Folder & Detect Lectures**.
   * DegreeTrack scans subfolders into Modules and detects lecture numbers.
   * *(Optional)* Click **"Clean & Structure with AI"** to have Gemini polish messy filenames into descriptive titles and organize logical modules.
4. **Import:**
   * Review the roadmap and click **"Import as DegreeTrack Course"**. Your complete course is now ready!

---

### How to Use the Video Player & Rolling Cache

1. In your course curriculum, find any lecture topic and click **"Play"** or click on the video resource.
2. **Status Indicator:**
   * `⚡ Offline Ready (On Device)`: The video is cached on your device. Works with zero Wi-Fi or data!
   * `☁️ Streaming from Google Drive`: The video is streaming directly from the cloud.
3. **Manual Controls:**
   * Click **"Save Offline"** in the top bar to download any streaming lecture immediately.
   * Click **"Free Space"** to delete a local copy and revert it to cloud streaming.
4. **Take Timestamped Notes:**
   * While watching, type in the note box and click the **`+`** button.
   * A note with the exact timestamp (e.g. `[05:22]`) is saved. Click that timestamp anytime to seek directly to that moment.
5. **Smart Background Prefetching:**
   * As you watch Lecture 1, DegreeTrack automatically prefetches Lecture 2 and Lecture 3 in the background.
   * When you finish Lecture 1, its 3-day deletion timer starts, and Lecture 4 enters the prefetch queue.

---

### How to Curate Courses with AI

1. Navigate to **Curriculum $\rightarrow$ Curate with AI**.
2. Enter your subject, choose your difficulty level, focus area, and time commitment.
3. Select your preferred AI model (e.g., **Gemini 2.5 Flash**).
4. Click **Generate Curriculum Blueprint**.
5. Inspect the generated roadmap, modules, and learning outcomes, then click **"Accept & Add to My Curriculum"**.

---

### How to Publish to the Community Library

1. Open **Settings** (gear icon) in the bottom-left corner.
2. Scroll to **Export Course / Degree**:
   * Select a specific course or choose **"Entire Degree (All Courses)"**.
   * Click **"1-Tap to Community"**.
3. DegreeTrack automatically validates the payload through the Privacy Firewall, submits the issue to GitHub, and returns your confirmation ID (`#GH-xxx`).

---

### How to Sync & Backup with Google Drive

1. Open **Settings $\rightarrow$ Cloud Sync**.
2. Click **Connect Google Drive**.
3. Authorize Google Sign-In.
4. Click **"Backup Now"** to export your full encrypted database to your Google Drive AppData folder.
5. Click **"Restore Backup"** on any device to restore your courses, notes, and progress.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | [Next.js 16](https://nextjs.org) (Turbopack, App Router) | React 19 UI, static export (`output: 'export'`) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) | Native Android APK runtime, native file bridges |
| **Local Storage** | [Dexie.js](https://dexie.org) (IndexedDB) | Curriculum, modules, topics, resources, notes |
| **File Storage** | `@capacitor/filesystem` | Native device sandbox for video caching & downloads |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs) + Persist | Stores for AI config, video cache, timers, theme |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Modern responsive design, strict dark mode tokens |
| **Icons** | [Lucide React](https://lucide.dev) | Crisp interface icons |
| **Charts** | [Recharts](https://recharts.org) | Analytics visualizations |

---

## 🚀 Installation & Development

### Prerequisites
* **Node.js** $\ge 18$
* **npm** $\ge 9$
* **Android Studio** & **JDK 17+** (for building Android APK)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/pandeysuryansh921-wq/course-tracker.git
cd course-tracker

# 2. Install dependencies
npm install

# 3. Create .env.local (Optional: for default community tokens)
NEXT_PUBLIC_COMMUNITY_REPO=pandeysuryansh921-wq/course-tracker-library

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Android APK Build Guide

DegreeTrack runs as an offline-first static package inside Capacitor Android:

```bash
# 1. Build the production static web bundle (outputs to /out)
npm run build

# 2. Sync web assets and plugins to Android project
npx cap sync android

# 3. Assemble Debug APK with Gradle
cd android
./gradlew assembleDebug

# Windows CMD:
# gradlew.bat assembleDebug
```

The compiled APK will be created at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
A copy is also maintained in the repository root at [`app-debug.apk`](./app-debug.apk) and [`apk/degreetrack-quiz-debug.apk`](./apk/degreetrack-quiz-debug.apk).

---

## 🔒 Privacy & Local-First Architecture

* **Zero Tracking:** DegreeTrack contains no telemetry, analytics beacons, or third-party ad trackers.
* **100% Offline-Capable:** The app can be launched in Airplane Mode. All curricula, flashcards, notes, and cached videos remain accessible.
* **Keys Stay Local:** BYOK keys (Gemini, Groq, OpenAI, Anthropic, OpenRouter) are stored exclusively in the browser's `localStorage` (`degreetrack_ai_byok_config`) and are never sent to any server except the respective provider's official endpoint.
* **Safe Drive Integration:** The app only requests read permissions for videos you explicitly scan. Video deletions only affect the temporary local phone cache; your Google Drive files are never modified or deleted.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

*Built with ❤️ for lifelong learners, self-taught engineers, and independent students worldwide.*
