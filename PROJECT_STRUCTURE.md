# ProctoringV2 - Project Structure Guide

> **Last Updated:** April 10, 2026  
> **Purpose:** Help team members understand the codebase and continue building efficiently

---

## 📁 Complete Folder Structure

```
ProctoringV2/
├── .gitignore                      # Git ignore rules
├── eslint.config.js                # ESLint configuration (v9.x flat config)
├── index.html                      # HTML entry point (mounts to #root)
├── package.json                    # Dependencies and npm scripts
├── package-lock.json               # Dependency lock file
├── postcss.config.js               # PostCSS config for Tailwind
├── tailwind.config.js              # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript root config (references)
├── tsconfig.app.json               # TypeScript app config (strict mode, ES2020)
├── tsconfig.node.json              # TypeScript Node/Vite config
├── vite.config.ts                  # Vite build tool configuration
│
├── .bolt/                          # Bolt.new project metadata
│   └── config.json
├── .qwen/                          # Qwen Code assistant settings
├── docs/                           # Documentation
│   ├── GAZE_TRACKING_INTEGRATION.md    # Integration guide for new gaze system
│   ├── GAZE_TRACKING_MODULE.md         # GazeTrackingEngine API reference
│   └── GAZE_TRACKING_SUMMARY.md        # Implementation summary
│
├── public/                         # Static assets (served as-is)
└── src/                            # Application source code
    ├── App.tsx                     # Main app with routing
    ├── main.tsx                    # Entry point (React 18 createRoot)
    ├── index.css                   # Global styles (Tailwind directives)
    ├── vite-env.d.ts               # Vite type declarations
    │
    ├── components/                 # Reusable UI components
    │   ├── ui/                     # Base UI elements (currently empty)
    │   ├── CalibrationModal.tsx    # 5-point gaze calibration UI
    │   ├── EyeGazeMonitor.tsx      # Legacy gaze monitoring panel
    │   ├── GazeTrackingOverlay.tsx # New gaze tracking overlay (not integrated)
    │   ├── LivenessCheckModal.tsx  # Pre-exam identity verification
    │   ├── Navigation.tsx          # Top nav with role switching
    │   └── ViolationExplanation.tsx # Human-readable violation summaries
    │
    ├── context/                    # React Context for global state
    │   └── AppContext.tsx          # Manages role and currentExam
    │
    ├── data/                       # Mock data for development
    │   └── mockData.ts             # Exams, results, questions, events
    │
    ├── hooks/                      # Custom React hooks
    │   ├── useEyeGazeDetection.ts  # Legacy: MediaPipe face landmarker gaze
    │   ├── useFaceDetection.ts     # Face detection + liveness (face-api.js)
    │   ├── useGazeTracking.ts      # NEW: Wrapper for GazeTrackingEngine
    │   ├── useLivenessCheck.ts     # Pre-exam liveness verification
    │   └── useProctoring.ts        # Main proctoring (camera, face, tab)
    │
    ├── lib/                        # Framework-agnostic libraries
    │   └── gaze/
    │       └── GazeTrackingEngine.ts   # Production-ready gaze engine
    │
    ├── pages/                      # Page components
    │   ├── instructor/
    │   │   ├── Dashboard.tsx       # Instructor overview
    │   │   ├── CreateExam.tsx      # Exam builder with questions
    │   │   ├── Results.tsx         # Student results table
    │   │   └── Proctoring.tsx      # Flagged events viewer
    │   └── student/
    │       ├── Home.tsx            # Exam list/dashboard
    │       ├── Exam.tsx            # Active exam with proctoring
    │       └── Results.tsx         # Student exam history
    │
    ├── services/                   # Business logic services (class-based)
    │   ├── FaceDetectionService.ts     # face-api.js wrapper
    │   ├── LivenessDetectionModule.ts  # Multi-step liveness verification
    │   └── instructorAlertService.ts   # WebSocket/HTTP alert system
    │
    └── utils/
        └── violationScorer.ts      # Weighted violation scoring (0-100)
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint

# Type check TypeScript
npm run typecheck
```

---

## 🏗️ Architecture Overview

### Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **UI Framework** | React | 18.3 |
| **Type System** | TypeScript | 5.5 (strict mode) |
| **Build Tool** | Vite | 5.4 |
| **Routing** | React Router | 7.13 |
| **Styling** | Tailwind CSS | 3.4 |
| **Icons** | lucide-react | 0.344 |
| **Face Detection** | face-api.js | 0.22.2 |
| **Gaze Tracking** | @mediapipe/tasks-vision | 0.10.32 |
| **Backend (Future)** | Supabase | 2.57.4 |

### Application Flow

```
User enters app
     ↓
App.tsx checks role (student/instructor)
     ↓
Student: Home → Exam (with liveness check) → Results
Instructor: Dashboard → Create Exam → Results → Proctoring Reports
```

---

## 📂 Detailed Module Descriptions

### Entry Points

#### `src/main.tsx`
Application entry point. Creates React 18 root, wraps App in StrictMode.

#### `src/App.tsx`
Main router component. Sets up BrowserRouter and AppProvider. Conditionally renders student or instructor routes based on `role` from AppContext.

**Routes:**
- **Student:** `/` (home), `/exam` (taking exam), `/results` (view scores)
- **Instructor:** `/instructor` (dashboard), `/instructor/create` (build exam), `/instructor/results` (student results), `/instructor/proctoring` (flagged events)

### Global State

#### `src/context/AppContext.tsx`
Simple React Context managing:
- `role`: `'student' | 'instructor'` - determines which UI to show
- `currentExam`: selected exam object, passed from Home to Exam page
- `setRole()`: switch between student/instructor views
- `setCurrentExam()`: set active exam

### Data Layer

#### `src/data/mockData.ts`
All mock data for development (no backend yet):
- `mockExams` - 3 sample exams (Data Structures, Calculus, Database Systems)
- `mockResults` - Student exam results with scores
- `mockProctoringEvents` - 9 flagged events (face not detected, multiple faces, tab switch, phone detected, looking away, etc.)
- `mockQuestions` - 3 sample MCQ questions
- `mockStudentResults` - 4 student result records with flagged event counts

---

## 🔧 Components (src/components/)

### Navigation.tsx
Top navigation bar with "Examify" branding, role-based links, and role-switcher button. Highlights active route.

### LivenessCheckModal.tsx
Full-screen modal before exam starts:
- Camera setup via `getUserMedia`
- Live video preview with face frame guide
- Multi-step liveness instructions (Look Left, Nod, Look Right, Look Up, Smile)
- Pass/fail states with progress indicators

### CalibrationModal.tsx
5-point gaze calibration UI:
- Shows calibration dots at center and corners
- Collects gaze samples at each point
- Calculates average offset between expected and actual gaze
- Returns calibration offsets to Exam page

### EyeGazeMonitor.tsx
**Legacy** eye gaze monitoring panel. Displays:
- Real-time gaze direction
- Eye openness bars
- Pupil positions
- Sensitivity settings
- Suspicious event history

Used with legacy `useEyeGazeDetection` hook.

### GazeTrackingOverlay.tsx
**New** gaze tracking overlay (not yet integrated):
- Gaze zone indicator (on-screen, left, right, up, down, away)
- Attention score with progress bar
- Session metrics (time, on/off-screen, gaze shifts, blink rate, face distance)
- Violation history
- Progressive warning banners (yellow → orange → red)
- Calibration controls

### ViolationExplanation.tsx
Human-readable violation summary:
- Groups violations by type
- Shows count and latest occurrence
- Displays contextual icons
- Shows critical risk warnings when score >= 80

---

## 🎣 Hooks (src/hooks/)

### useProctoring.ts
Main proctoring hook. Manages:
- Camera initialization with error handling and retry logic
- Face detection using face-api.js TinyFaceDetector (runs every 2 seconds)
- Tab visibility tracking via `visibilitychange` event
- Returns `status` object with `camera`, `faceDetected`, `multipleFaces`, `tabActive`, `modelsLoaded`, `loading`, `errorMessage`
- Provides `videoRef`, `retryCamera`, `clearError`

### useEyeGazeDetection.ts (Legacy - Currently Active)
Comprehensive eye gaze detection using MediaPipe Face Landmarker:
- Eye Aspect Ratio (EAR) calculation for blink detection
- Pupil position tracking using iris landmarks (indices 468-476)
- Gaze direction classification (center, left, right, up, down, looking-away)
- Head pose estimation from face landmarks
- Suspicious event recording (LOOKING_AWAY, EXCESSIVE_BLINKING, EYE_CLOSURE, RAPID_EYE_MOVEMENT)
- Violation scoring with configurable severity weights
- Calibration offset support
- Detection runs at ~10fps (100ms intervals)
- **Currently active in Exam.tsx**

### useGazeTracking.ts (New - Not Yet Integrated)
React hook wrapper for `GazeTrackingEngine`:
- Engine lifecycle management
- React state synchronization
- Attention metrics access
- Violation and warning streams
- Auto-cleanup on unmount
- **Not yet integrated into Exam.tsx**

### useFaceDetection.ts
Combines `FaceDetectionService` and `LivenessDetectionModule` into single hook:
- Model loading
- Camera stream management
- Detection loop with canvas drawing
- Liveness step tracking
- Age/gender display

### useLivenessCheck.ts
Liveness verification hook for pre-exam identity check:
- Loads face-api.js models (TinyFaceDetector, FaceLandmark68, FaceExpressionNet)
- Runs detection loop
- Processes frames through `LivenessDetectionModule`
- Tracks face presence duration
- Returns pass/fail state with progress

---

## 🛠️ Services (src/services/)

### FaceDetectionService.ts
Class-based wrapper around face-api.js:
- Configurable detection pipeline
- Options for face landmarks, expressions, age/gender
- Canvas drawing utilities with fallback to basic rectangles

### LivenessDetectionModule.ts
Multi-step liveness verification engine:

**Default Steps (shuffled each session):**
1. **Look Left** - Nose moves right relative to face center (>15% of face width)
2. **Nod** - Y position goes down then up (peak in middle of history)
3. **Look Right** - Nose moves left relative to face center
4. **Look Up** - Nose Y decreases from baseline, sustained position
5. **Smile** - Happy expression probability > 0.6

**Event Emitter Pattern:**
- `STEP_STARTED`
- `STEP_PASSED`
- `PROGRESS_UPDATED`
- `TIMEOUT_OCCURRED`
- `VERIFICATION_COMPLETE`

### instructorAlertService.ts
Alert system for sending critical violations to instructors:
- Debouncing (60 seconds per student)
- Dual transport: WebSocket first, HTTP POST fallback
- Exponential backoff retries (1s, 2s, 4s)
- Sends violation score, recent events, and timestamp

---

## 📊 Utilities

### utils/violationScorer.ts
Weighted violation scoring system:

| Violation Type | Points |
|---------------|--------|
| `gaze_looking_away` | 2 |
| `gaze_sustained_away` | 5 |
| `tab_switch` | 3 |
| `head_pose_extreme` | 4 |
| `phone_detection` | 8 |
| `multiple_faces` | 10 |
| `excessive_blinking` | 1 |

- Calculates normalized score (0-100) within a 5-minute time window
- **Risk Levels:**
  - **Low:** 0-29
  - **Medium:** 30-59
  - **High:** 60-79
  - **Critical:** 80+ (with 3+ high-severity recent events)

---

## 👁️ Gaze Tracking Engine (src/lib/gaze/)

### GazeTrackingEngine.ts
Framework-agnostic, production-ready gaze tracking engine (~860 lines):

**Core Features:**
- MediaPipe Face Landmarker with GPU acceleration
- Gaze zone classification (on-screen, left, right, up, down, away)
  - Uses head pose (yaw/pitch thresholds) and pupil position
- Face distance estimation (forehead-to-chin height)
- Head pose estimation:
  - **Yaw:** from nose offset
  - **Pitch:** from nose-chin ratio
  - **Roll:** from ear height difference
- Eye Aspect Ratio for blink detection
- Frame skipping for performance (default: every 3rd frame = ~10fps)
- Progressive 3-level warning system based on violations in last 60 seconds
- Comprehensive attention metrics:
  - Session time
  - On/off-screen time
  - Attention percentage
  - Blink rate
  - Gaze shifts
  - Longest off-screen period
- Privacy-first: all processing client-side, no video transmitted

---

## 📄 Pages (src/pages/)

### Student Pages

#### Home.tsx
Exam cards with status badges (available/upcoming/completed), proctoring info banner, start exam button.

#### Exam.tsx
Full exam interface:
- Question navigation (Previous/Next)
- Answer selection with visual feedback
- Timer with countdown and auto-submit
- Liveness check modal
- Proctoring sidebar:
  - Live camera feed
  - Status indicators (camera, face, tab, gaze)
  - Violation score display
  - Calibration button

#### Results.tsx
Student score history with stats cards (average, completed, highest), circular progress indicators per exam.

### Instructor Pages

#### Dashboard.tsx
Overview stats:
- Total students
- Active exams
- Average score
- Flagged students
- Recent exams list
- Top performers list

#### CreateExam.tsx
Exam builder with:
- Title/subject/duration fields
- Dynamic question addition/removal
- 4-option MCQ with radio correct-answer selection

#### Results.tsx
Student results table with:
- Search functionality
- Exam filter
- Stats cards (average, highest, lowest, pass rate)
- Export CSV button
- Score color coding
- Flag indicators

#### Proctoring.tsx
Flagged events viewer with:
- Severity/type/exam filters
- Stats cards (critical/high/medium/eye gaze events)
- Event cards with icons
- Student name, exam title, timestamp

---

## 🔌 Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and npm scripts |
| `vite.config.ts` | Vite build config with React plugin |
| `tailwind.config.js` | Scans `./index.html` and `./src/**/*.{js,ts,jsx,tsx}` |
| `postcss.config.js` | PostCSS config for Tailwind processing |
| `tsconfig.json` | Root TypeScript config referencing app and node configs |
| `tsconfig.app.json` | Strict mode, ES2020 target, React JSX, noEmit |
| `tsconfig.node.json` | Node/Vite specific TypeScript config |
| `eslint.config.js` | ESLint 9.x flat config |
| `index.html` | HTML shell with meta tags, mounts to `#root` |

---

## ⚠️ Known Issues & TODOs

### TypeScript Errors
4 pre-existing errors (unused variables/parameters):
- `LivenessCheckModal.tsx` - 2 unused variables
- `useEyeGazeDetection.ts` - 1 unused function
- `LivenessDetectionModule.ts` - 1 unused variable

### Integration Tasks

- [ ] **Integrate new gaze tracking system** into `Exam.tsx` (replace legacy `useEyeGazeDetection` with `useGazeTracking`)
- [ ] **Connect to Supabase backend** for persistence (database + auth)
- [ ] **Implement real-time instructor monitoring** via WebSocket
- [ ] **Add WebWorker** for non-blocking gaze detection
- [ ] **Export proctoring reports** to PDF/CSV
- [ ] **Mobile-responsive improvements**
- [ ] **Accessibility enhancements** (WCAG 2.1 AA)

---

## 🎯 Key Architectural Notes

### 1. **Two Gaze Tracking Systems Exist**
- **Legacy:** `useEyeGazeDetection.ts` is currently active in `Exam.tsx`
- **New:** `useGazeTracking.ts` + `GazeTrackingEngine.ts` + `GazeTrackingOverlay.tsx` are production-ready but **not yet integrated**
- **Next Step:** Update `Exam.tsx` to use the new hook

### 2. **Role-Based Access**
- Simple role switch in navigation bar toggles between student/instructor views
- **No authentication implemented yet**

### 3. **All Data is Mock**
- No backend connected
- All exams, questions, results, and proctoring events come from `mockData.ts`

### 4. **Camera Handling**
- Multiple hooks (`useProctoring`, `useLivenessCheck`, `useEyeGazeDetection`) each manage their own camera/video element
- Exam page combines refs for proctoring and gaze detection on a **single video element**

### 5. **Pre-existing TypeScript Errors**
- 4 unused variable/parameter errors exist (see Known Issues above)
- These don't block development but should be cleaned up

---

## 📝 Development Conventions

### Code Style
- TypeScript with strict mode
- Functional components with hooks
- Arrow functions for event handlers
- Descriptive variable/function names
- Console logging for debugging (prefixed with feature name in brackets, e.g., `[EyeGaze]`, `[Exam]`)

### Component Structure
- Props interfaces defined at top
- Destructured props in function signature
- Custom hooks for complex logic
- Early returns for loading/error states

### File Naming
- **Components:** PascalCase (e.g., `EyeGazeMonitor.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useProctoring.ts`)
- **Services:** PascalCase (e.g., `FaceDetectionService.ts`)

---

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

**Requirements:** Modern browser with WebRTC, WebGL, and MediaPipe support for AI features.

---

## 📚 Documentation

| File | Description |
|------|-------------|
| `docs/GAZE_TRACKING_MODULE.md` | Complete API reference for GazeTrackingEngine (400+ lines) |
| `docs/GAZE_TRACKING_INTEGRATION.md` | Step-by-step integration guide (350+ lines) |
| `docs/GAZE_TRACKING_SUMMARY.md` | Implementation completion report |

---

## 🤝 How to Contribute

### Adding a New Feature

1. **Create component** in `src/components/` (PascalCase)
2. **Create hook** (if needed) in `src/hooks/` (use prefix)
3. **Add route** in `App.tsx` if it's a new page
4. **Update mock data** in `src/data/mockData.ts`
5. **Test locally** with `npm run dev`
6. **Run type check** with `npm run typecheck`
7. **Run lint** with `npm run lint`

### Adding an Exam Question Type

1. Update `mockData.ts` with sample questions
2. Add question component in `src/components/`
3. Update `Exam.tsx` to render new question type
4. Update `CreateExam.tsx` to support new question builder

### Extending Proctoring Detection

1. Add detection logic in appropriate hook (`useProctoring.ts` or `useEyeGazeDetection.ts`)
2. Update violation types in `violationScorer.ts`
3. Add event type to `mockProctoringEvents`
4. Update UI components to display new event type

---

## 📞 Need Help?

- Check `docs/` folder for detailed guides
- Review existing hooks/services for patterns
- Search codebase with `grep_search` or `glob` tools
- Check console logs (prefixed with feature names like `[EyeGaze]`, `[Exam]`, `[Proctoring]`)

---

**Happy Coding! 🚀**
