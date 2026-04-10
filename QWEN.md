# ProctoringV2 - Online Exam Proctoring System

## Project Overview

**ProctoringV2** is a modern web application for online exam proctoring with real-time AI-powered monitoring capabilities. It provides separate interfaces for students (taking exams) and instructors (creating exams, monitoring, and reviewing results).

### Key Features

- **AI-Powered Face Detection** - Real-time face detection using MediaPipe and face-api.js
- **Gaze Tracking** - Eye gaze detection to monitor if students are looking at the screen
- **Liveness Check** - Identity verification before exam start with pose/expression challenges
- **Proctoring Monitor** - Live camera feed with automated suspicious event detection
- **Tab Switching Detection** - Detects when students leave the exam tab
- **Multi-Face Detection** - Identifies unauthorized persons in the frame
- **Role-Based Access** - Separate student and instructor dashboards
- **Exam Management** - Create exams, track progress, and review results
- **Proctoring Reports** - Detailed reports of suspicious activities during exams

### Architecture

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI elements
│   ├── EyeGazeMonitor.tsx
│   ├── GazeTrackingOverlay.tsx
│   ├── LivenessCheckModal.tsx
│   └── Navigation.tsx
├── context/            # React context (AppContext for state management)
├── data/               # Mock data for development
├── hooks/              # Custom React hooks
│   ├── useEyeGazeDetection.ts    # Eye gaze tracking with MediaPipe
│   ├── useFaceDetection.ts       # Face detection hook
│   ├── useGazeTracking.ts        # New gaze tracking system
│   ├── useLivenessCheck.ts       # Liveness verification
│   └── useProctoring.ts          # Main proctoring logic
├── lib/                # Framework-agnostic libraries
│   └── gaze/           # Gaze tracking engine
├── pages/              # Page components
│   ├── instructor/     # Instructor dashboard, exam creation, results, proctoring
│   └── student/        # Student home, exam taking, results
├── services/           # Business logic services
│   ├── FaceDetectionService.ts
│   └── LivenessDetectionModule.ts
├── App.tsx             # Main app with routing
├── main.tsx            # Entry point
└── index.css           # Global styles (Tailwind)
```

## Tech Stack

### Core Technologies
- **React 18.3** - UI framework
- **TypeScript 5.5** - Type-safe development
- **Vite 5.4** - Build tool and dev server
- **React Router 7.13** - Client-side routing

### Styling
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **PostCSS** - CSS processing
- **Autoprefixer** - Vendor prefixing

### AI/ML Libraries
- **@mediapipe/tasks-vision 0.10.32** - Face landmark detection, gaze tracking
- **face-api.js 0.22.2** - Face detection and recognition

### UI Libraries
- **lucide-react 0.344** - Icon library

### Backend (Future)
- **@supabase/supabase-js 2.57.4** - Database and authentication (integrated but not yet active)

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint

# Run TypeScript type checking
npm run typecheck
```

## Key Features in Detail

### 1. Liveness Check System
Before starting an exam, students must pass a liveness verification:
- **Face Detection** - Verifies a real person is present
- **Pose Challenges** - "Turn your head left/right", "Look up/down"
- **Expression Challenges** - "Smile", "Blink", "Open your mouth"
- **Multi-Step Verification** - Sequential challenges to confirm identity
- **Camera Preview** - Real-time video feed with face framing

### 2. Gaze Tracking
Real-time monitoring of where students are looking during exams:
- **On-Screen Detection** - Confirms student is looking at the exam
- **Off-Screen Alerts** - Warns when looking away (left, right, up, down)
- **Attention Scoring** - Calculates percentage of time looking at screen
- **Violation Tracking** - Logs suspicious gaze events with timestamps
- **Progressive Warnings** - Escalating alerts (yellow → orange → red banners)
- **Sensitivity Settings** - Adjustable detection thresholds (low/medium/high/strict)

### 3. Proctoring Monitor
Continuous monitoring during exams:
- **Face Detection** - Ensures student's face is visible
- **Multi-Face Detection** - Alerts if multiple people are present
- **Tab Switching** - Detects when student leaves the exam tab
- **Camera Status** - Real-time camera health monitoring
- **Event Logging** - All suspicious activities are recorded

### 4. Exam Interface
Student exam experience:
- **Question Navigation** - Previous/Next buttons with question navigator
- **Answer Selection** - Visual feedback for selected answers
- **Timer** - Countdown timer with auto-submit
- **Progress Bar** - Visual progress tracking
- **Proctoring Sidebar** - Live camera feed and monitoring status

### 5. Instructor Dashboard
Exam management for instructors:
- **Exam Creation** - Build exams with questions and settings
- **Results Review** - View student scores and performance
- **Proctoring Reports** - Review suspicious activities during exams
- **Real-Time Monitoring** - Live proctoring dashboard (in development)

## Data Flow

### Student Exam Flow
1. Student selects exam from home page
2. Liveness check modal appears
3. Camera initializes and face detection starts
4. Student completes liveness challenges (pose/expression)
5. Upon success, exam begins with proctoring active
6. Gaze tracking and face monitoring run in background
7. Student answers questions and navigates through exam
8. Exam submits (manually or via timeout)
9. Results page displays score

### Instructor Flow
1. Instructor logs in (role switch in context)
2. Creates exam with questions and settings
3. Students take exam with proctoring active
4. Instructor reviews results and proctoring reports
5. Suspicious events are flagged for review

## State Management

The app uses **React Context** (`AppContext`) for global state:
- `role` - Current user role ('student' | 'instructor')
- `currentExam` - Selected exam object
- `setRole()` - Switch between student/instructor views
- `setCurrentExam()` - Set the active exam

Local component state and custom hooks manage feature-specific state.

## Gaze Tracking System

The gaze tracking system has two implementations:

### Legacy System (`useEyeGazeDetection.ts`)
- Uses MediaPipe Face Landmarker
- Detects pupil position and eye aspect ratio (EAR)
- Tracks looking away, blinking, and rapid eye movements
- Records suspicious events with severity levels
- Currently active in the Exam page

### New System (`useGazeTracking.ts` + `GazeTrackingEngine.ts`)
- Production-ready rewrite with better architecture
- Framework-agnostic engine class
- Improved zone detection (on-screen vs off-screen)
- Face distance and head pose estimation
- Progressive warning system with escalation
- Comprehensive attention metrics
- **Not yet integrated** - requires updating Exam.tsx to use new hook

## Configuration

### Tailwind CSS
Configured in `tailwind.config.js` with default settings.

### TypeScript
- `tsconfig.app.json` - Application code configuration
- `tsconfig.node.json` - Node/Vite config
- Strict mode enabled with path aliases

### ESLint
Configured with:
- `@eslint/js` - Base ESLint
- `eslint-plugin-react-hooks` - React hooks rules
- `eslint-plugin-react-refresh` - React Refresh compatibility

## Known Issues & TODOs

### TypeScript Errors
4 pre-existing errors in:
- `LivenessCheckModal.tsx` - 2 unused variables
- `useEyeGazeDetection.ts` - 1 unused function
- `LivenessDetectionModule.ts` - 1 unused variable

### Gaze Detection Debugging
Comprehensive logging has been added to diagnose gaze detection issues:
- Check browser console for `[EyeGaze]` and `[Exam]` logs
- Verify models load successfully
- Confirm video element is passed to hooks
- Ensure detection loop is running

### Future Enhancements
- [ ] Integrate new gaze tracking system into Exam page
- [ ] Connect to Supabase backend for persistence
- [ ] Implement real-time instructor monitoring
- [ ] Add WebWorker for non-blocking gaze detection
- [ ] Export proctoring reports to PDF/CSV
- [ ] Mobile-responsive improvements
- [ ] Accessibility enhancements (WCAG 2.1 AA)

## Project Conventions

### Code Style
- TypeScript with strict mode
- Functional components with hooks
- Arrow functions for event handlers
- Descriptive variable/function names
- Console logging for debugging (prefixed with feature name in brackets)

### Component Structure
- Props interfaces defined at top
- Destructured props in function signature
- Custom hooks for complex logic
- Early returns for loading/error states

### File Naming
- Components: PascalCase (e.g., `EyeGazeMonitor.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useProctoring.ts`)
- Services: PascalCase (e.g., `FaceDetectionService.ts`)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

Requires modern browser with WebRTC, WebGL, and MediaPipe support for AI features.

## License

Private project - All rights reserved.
