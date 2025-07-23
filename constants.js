

import { ProjectStatus, AttendanceStatus, LeaveType, NoteStatus, TeamMemberRole } from './types.js';

export const INITIAL_TEAM_MEMBERS = Array.from({ length: 5 }, (_, i) => ({
  id: crypto.randomUUID(),
  name: `Team Member ${i + 1}`,
  email: `member${i+1}@example.com`,
  employeeId: `EMP00${i + 1}`,
  joinDate: new Date(new Date().setFullYear(new Date().getFullYear() - i)).toISOString().split('T')[0],
  birthDate: new Date(1990 + i, i % 12, (i*5 % 28) + 1).toISOString().split('T')[0],
  designation: i === 0 ? 'Project Manager' : (i % 2 === 0 ? 'Software Engineer' : 'QA Analyst'),
  department: i < 3 ? 'Engineering' : 'Quality Assurance',
  company: 'TeamSync Corp',
  role: i === 0 ? TeamMemberRole.Manager : TeamMemberRole.Member,
}));

export const PROJECT_STATUSES = Object.values(ProjectStatus);
export const ATTENDANCE_STATUSES = Object.values(AttendanceStatus);
export const LEAVE_TYPES = Object.values(LeaveType);
export const PRIORITIES = ['Low', 'Medium', 'High'];

export const NOTE_STATUSES = Object.values(NoteStatus);
export const NOTE_COLORS = [
  '#ffffff', // White (Default)
  '#fff9c4', // Light Yellow
  '#c8e6c9', // Light Green
  '#bbdefb', // Light Blue
  '#ffcdd2', // Light Pink
  '#e1bee7', // Light Purple
];

// This is now managed in the Settings page and stored in Firestore.
// It will be used as the default if no settings are found.
export const DEFAULT_WORK_LOG_TASKS = [
    'Development',
    'Meeting',
    'Code Review',
    'Testing',
    'Documentation',
    'Design',
    'Project Management',
    'Support',
    'Training',
    'Other',
];
