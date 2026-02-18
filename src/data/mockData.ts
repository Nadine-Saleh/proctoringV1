export const mockExams = [
  {
    id: 1,
    title: 'Data Structures Midterm',
    subject: 'Computer Science',
    duration: 90,
    questions: 30,
    startDate: '2026-02-20T10:00:00',
    status: 'upcoming',
    instructor: 'Dr. Sarah Johnson'
  },
  {
    id: 2,
    title: 'Calculus Final Exam',
    subject: 'Mathematics',
    duration: 120,
    questions: 45,
    startDate: '2026-02-18T14:00:00',
    status: 'available',
    instructor: 'Prof. Michael Chen'
  },
  {
    id: 3,
    title: 'Database Systems Quiz',
    subject: 'Computer Science',
    duration: 45,
    questions: 20,
    startDate: '2026-02-15T09:00:00',
    status: 'completed',
    instructor: 'Dr. Sarah Johnson'
  }
];

export const mockResults = [
  {
    id: 1,
    examId: 3,
    examTitle: 'Database Systems Quiz',
    score: 85,
    totalQuestions: 20,
    correctAnswers: 17,
    completedAt: '2026-02-15T10:30:00',
    status: 'passed'
  },
  {
    id: 2,
    examId: 1,
    examTitle: 'Introduction to Programming',
    score: 92,
    totalQuestions: 25,
    correctAnswers: 23,
    completedAt: '2026-02-10T11:45:00',
    status: 'passed'
  }
];

export const mockProctoringEvents = [
  {
    id: 1,
    studentId: 101,
    studentName: 'Alice Johnson',
    examId: 2,
    timestamp: '2026-02-18T14:15:23',
    type: 'face_not_detected',
    severity: 'high',
    description: 'Student face not detected for 8 seconds'
  },
  {
    id: 2,
    studentId: 101,
    studentName: 'Alice Johnson',
    examId: 2,
    timestamp: '2026-02-18T14:22:10',
    type: 'multiple_faces',
    severity: 'critical',
    description: 'Multiple faces detected in frame'
  },
  {
    id: 3,
    studentId: 102,
    studentName: 'Bob Smith',
    examId: 2,
    timestamp: '2026-02-18T14:18:45',
    type: 'tab_switch',
    severity: 'medium',
    description: 'Browser tab switched'
  },
  {
    id: 4,
    studentId: 103,
    studentName: 'Carol Williams',
    examId: 2,
    timestamp: '2026-02-18T14:25:33',
    type: 'phone_detected',
    severity: 'high',
    description: 'Mobile device detected in frame'
  }
];

export const mockQuestions = [
  {
    id: 1,
    question: 'What is the time complexity of binary search?',
    options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'],
    correctAnswer: 1
  },
  {
    id: 2,
    question: 'Which data structure uses LIFO principle?',
    options: ['Queue', 'Stack', 'Tree', 'Graph'],
    correctAnswer: 1
  },
  {
    id: 3,
    question: 'What does SQL stand for?',
    options: [
      'Structured Query Language',
      'Simple Question Language',
      'System Query Logic',
      'Standard Question Logic'
    ],
    correctAnswer: 0
  }
];

export const mockStudentResults = [
  {
    studentId: 101,
    studentName: 'Alice Johnson',
    email: 'alice@university.edu',
    score: 78,
    completedAt: '2026-02-18T15:50:00',
    duration: 88,
    flaggedEvents: 3
  },
  {
    studentId: 102,
    studentName: 'Bob Smith',
    email: 'bob@university.edu',
    score: 92,
    completedAt: '2026-02-18T15:45:00',
    duration: 85,
    flaggedEvents: 1
  },
  {
    studentId: 103,
    studentName: 'Carol Williams',
    email: 'carol@university.edu',
    score: 85,
    completedAt: '2026-02-18T15:55:00',
    duration: 95,
    flaggedEvents: 2
  },
  {
    studentId: 104,
    studentName: 'David Brown',
    email: 'david@university.edu',
    score: 95,
    completedAt: '2026-02-18T15:42:00',
    duration: 82,
    flaggedEvents: 0
  }
];
