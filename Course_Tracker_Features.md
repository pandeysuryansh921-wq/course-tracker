# Course Tracker - Complete Feature Guide

Course Tracker is a privacy-focused, local-first mobile and web application that helps self-learners structure their online degree curriculum, track study progress, manage assignments, log study sessions, and self-assess using AI integrations.

## 🔒 Core Architecture & Privacy
*   **100% Offline by Default:** Uses IndexedDB (`Dexie.js`) for persistent, ultra-fast local storage within the browser or Android WebView.
*   **Zero APIs Required:** Does not require an active internet connection to browse content, log sessions, or view progress.
*   **No User Tracking:** There are no user accounts, sign-ups, or telemetry. All data is exclusively owned by you.

## 📚 Curriculum & Course Management
*   **Three-Level Hierarchy:** Courses are broken down into **Modules**, which are further broken down into **Topics/Lessons**.
*   **Topic Status Tracking:** Move topics through states: *Not Started*, *In Progress*, *Needs Review*, *Completed*, and *Mastered*.
*   **Dynamic Mastery System:** Enter custom max scores for topic quizzes. A score of $\ge 85\%$ automatically marks a topic as *Mastered*, while $70\%-84\%$ marks it as *Completed*.
*   **Rich Resource Linking:** Attach multiple resource types (Videos, PDFs, Textbooks, Articles) directly to a topic, complete with targeted "Study Scopes" (Core, Optional, Skip) to prevent overwhelm.
*   **Study Plans & Notes:** Keep structured notes and create custom study plans right inside the topic view.
*   **Community Library Integration:** Browse and download fully pre-configured courses from the open-source GitHub repository directly inside the app.
*   **Advanced JSON Schema Import/Export:** Backup entire courses—including embedded file data, nested assignments, and metadata—to a `.zip` file for easy sharing or importing. 

## ☁️ Cloud Sync & Backup
*   **Google Drive Integration:** Optionally link your Google account to back up your entire Course Tracker database safely. 
*   **Secure AppData Storage:** Backups are saved to the hidden AppData folder in Google Drive, preventing accidental deletion or cluttering of your main Drive view.

## 🤖 AI Integrations
*   **Gemini Gems Integration:** Directly attach links to personalized Google Gemini Gems or NotebookLM spaces to any course. Instantly jump from a lesson into an AI-powered tutor session calibrated specifically for your class.

## 📝 Assignment & Assessment Tracker
*   **Nested Assignments:** Assignments and practice exercises are seamlessly nested inside specific topics.
*   **Native File Attachments:** Attach assignment briefs (PDFs, Images, Documents) to a topic.
*   **Student Submissions:** Upload completed assignment files or paste external links (e.g., GitHub, Google Docs).
*   **Mobile Native Sharing:** Fully utilizes Android Capacitor APIs. Clicking on downloaded resources instantly triggers the native Android Share Sheet for quick viewing in other apps.

## 🧠 Smart Flashcards
*   **Spaced Repetition System (SRS):** Powered by the SuperMemo-2 algorithm to dynamically schedule flashcard reviews.
*   **Contextual Deck Building:** Create flashcards intrinsically linked to specific curriculum topics.
*   **Study Mode UI:** A clean, distraction-free environment for reviewing due flashcards.

## ⏱️ Study Journal & Productivity
*   **Dual Timer Modes:** Choose between a configurable Pomodoro timer (e.g., 25 focus / 5 rest) or a standard stopwatch.
*   **Automatic Session Logging:** The timer automatically logs session duration, notes, and the specific course/topic studied.
*   **Session History:** View a tabular history of past study sessions with advanced filtering and time formatting.

## 📊 Analytics & Dashboards
*   **Overview Dashboard:** High-level progress rings, upcoming reviews, and vital stats (Total Courses, Study Streaks).
*   **Performance Charts:** Recharts-powered graphs comparing your topic scores against passing targets, helping identify weak spots.
*   **Study Time Analysis:** Visual bar charts breaking down daily and weekly study hours.

## 🎨 Design & Experience
*   **Intelligent Dark Mode:** Built on Tailwind CSS v4, perfectly matching your operating system's color scheme with no inverted colors.
*   **Glassmorphism:** Modern translucent sidebars with backdrop blurring.
*   **Responsive Layouts:** Collapsible sidebars on mobile, micro-animations, and fluid transitions.

---
*Built for self-learners everywhere.*
