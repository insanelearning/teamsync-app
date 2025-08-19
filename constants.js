

import { ProjectStatus, AttendanceStatus, NoteStatus, TeamMemberRole, EmployeeStatus } from './types.js';

export const INITIAL_INTERNAL_TEAMS = [
    'Engineering',
    'QA',
    'Design',
    'Product Management',
    'Marketing'
];

export const INITIAL_LEAVE_TYPES = [
    'Sick Leave',
    'Vacation',
    'Personal Day',
    'Unpaid Leave',
    'Other',
];

export const INITIAL_TEAM_MEMBERS = [
    { id: 'user1', name: 'Alex Manager', email: 'alex@example.com', role: TeamMemberRole.Manager, designation: 'Team Lead', internalTeam: 'Engineering', joinDate: '2022-01-15', birthDate: '1990-05-20', mobileNumber: '+15551234567', status: EmployeeStatus.Active },
    { id: 'user2', name: 'Bob Member', email: 'bob@example.com', role: TeamMemberRole.Member, designation: 'Sr. Developer', internalTeam: 'Engineering', joinDate: '2022-08-01', birthDate: '1992-11-10', mobileNumber: '+15551234568', status: EmployeeStatus.Active },
    { id: 'user3', name: 'Charlie Member', email: 'charlie@example.com', role: TeamMemberRole.Member, designation: 'QA Engineer', internalTeam: 'QA', joinDate: '2023-03-20', birthDate: '1995-02-25', mobileNumber: '+15551234569', status: EmployeeStatus.Active },
    { id: 'user4', name: 'Diana Designer', email: 'diana@example.com', role: TeamMemberRole.Member, designation: 'UI/UX Designer', internalTeam: 'Design', joinDate: '2021-11-15', birthDate: '1993-08-12', mobileNumber: '+15551234570', status: EmployeeStatus.Active },
    { id: 'user5', name: 'Ethan Engineer', email: 'ethan@example.com', role: TeamMemberRole.Member, designation: 'Jr. Developer', internalTeam: 'Engineering', joinDate: '2023-09-01', birthDate: '1998-01-30', mobileNumber: '+15551234571', status: EmployeeStatus.Active },
    { id: 'user6', name: 'Fiona Product', email: 'fiona@example.com', role: TeamMemberRole.Member, designation: 'Product Manager', internalTeam: 'Product Management', joinDate: '2020-06-22', birthDate: '1988-07-07', mobileNumber: '+15551234572', status: EmployeeStatus.Active },
    { id: 'user7', name: 'George QA', email: 'george@example.com', role: TeamMemberRole.Member, designation: 'QA Lead', internalTeam: 'QA', joinDate: '2021-02-18', birthDate: '1991-04-15', mobileNumber: '+15551234573', status: EmployeeStatus.Active },
    { id: 'user8', name: 'Hannah Marketing', email: 'hannah@example.com', role: TeamMemberRole.Member, designation: 'Marketing Specialist', internalTeam: 'Marketing', joinDate: '2023-05-10', birthDate: '1996-12-05', mobileNumber: '+15551234574', status: EmployeeStatus.Active },
];

export const WORK_LOG_TASKS = [
    { id: 'task1', name: 'Development', category: 'Engineering', teams: ['Engineering'] },
    { id: 'task2', name: 'Code Review', category: 'Engineering', teams: ['Engineering'] },
    { id: 'task3', name: 'Testing - Manual', category: 'Quality Assurance', teams: ['QA'] },
    { id: 'task4', name: 'Testing - Automated', category: 'Quality Assurance', teams: ['QA'] },
    { id: 'task5', name: 'UI/UX Design', category: 'Design', teams: ['Design'] },
    { id: 'task6', name: 'Client Meeting', category: 'Project Management', teams: ['Engineering', 'Product Management', 'Design'] },
    { id: 'task7', name: 'Documentation', category: 'General', teams: ['Engineering', 'QA', 'Product Management'] },
];

export const INITIAL_HOLIDAYS = [
    { id: 'h1', name: 'New Year\'s Day', date: '2024-01-01' },
    { id: 'h2', name: 'Independence Day', date: '2024-07-04' },
];

export const PRIORITIES = ['Low', 'Medium', 'High'];

export const NOTE_COLORS = [
  '#fff9c4', // Yellow
  '#c8e6c9', // Green
  '#bbdefb', // Blue
  '#ffcdd2', // Red
  '#e1bee7', // Purple
  '#ffffff', // White
];

// Expanded color palette for consistent member colors across charts
export const MEMBER_COLORS = [
  '#4f46e5', '#db2777', '#16a34a', '#f97316', '#0891b2', '#6d28d9', '#ca8a04',
  '#dc2626', '#059669', '#2563eb', '#c026d3', '#7c2d12', '#1e40af', '#b91c1c'
];

export const CATEGORY_COLORS = {
    'Engineering': '#3b82f6',
    'Quality Assurance': '#10b981',
    'Design': '#ec4899',
    'Project Management': '#8b5cf6',
    'General': '#6b7280',
    'Uncategorized': '#9ca3af',
};
