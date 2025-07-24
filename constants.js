

import { ProjectStatus, AttendanceStatus, LeaveType, NoteStatus, TeamMemberRole } from './types.js';

export const INITIAL_INTERNAL_TEAMS = [
    'Engineering',
    'QA',
    'Marketing',
    'Design'
];

export const INITIAL_TEAM_MEMBERS = Array.from({ length: 5 }, (_, i) => {
    const teams = INITIAL_INTERNAL_TEAMS;
    const role = i === 0 ? TeamMemberRole.Manager : TeamMemberRole.Member;
    let internalTeam;
    if (role === TeamMemberRole.Manager) {
        internalTeam = teams[0];
    } else {
        internalTeam = i % 2 === 0 ? teams[0] : teams[1]; // Engineering or QA
    }
    
    return {
      id: crypto.randomUUID(),
      name: `Team Member ${i + 1}`,
      email: `member${i+1}@example.com`,
      employeeId: `EMP00${i + 1}`,
      joinDate: new Date(new Date().setFullYear(new Date().getFullYear() - i)).toISOString().split('T')[0],
      birthDate: new Date(1990 + i, i % 12, (i*5 % 28) + 1).toISOString().split('T')[0],
      designation: i === 0 ? 'Project Manager' : (i % 2 === 0 ? 'Software Engineer' : 'QA Analyst'),
      department: i < 3 ? 'Engineering' : 'Quality Assurance',
      company: 'TeamSync Corp',
      role: role,
      internalTeam: internalTeam,
    };
});

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

// New structure for WORK_LOG_TASKS
export const WORK_LOG_TASKS = [
    { id: crypto.randomUUID(), name: 'Development', category: 'Core', teams: ['Engineering'] },
    { id: crypto.randomUUID(), name: 'Meeting', category: 'General', teams: ['Engineering', 'QA', 'Marketing', 'Design'] },
    { id: crypto.randomUUID(), name: 'Code Review', category: 'Core', teams: ['Engineering'] },
    { id: crypto.randomUUID(), name: 'Testing', category: 'Core', teams: ['QA'] },
    { id: crypto.randomUUID(), name: 'Documentation', category: 'General', teams: ['Engineering', 'QA'] },
    { id: crypto.randomUUID(), name: 'Design', category: 'Core', teams: ['Design'] },
    { id: crypto.randomUUID(), name: 'Project Management', category: 'General', teams: ['Engineering'] },
    { id: crypto.randomUUID(), name: 'Ad Campaign', category: 'Marketing', teams: ['Marketing'] },
    { id: crypto.randomUUID(), name: 'SEO Analysis', category: 'Marketing', teams: ['Marketing'] },
];
