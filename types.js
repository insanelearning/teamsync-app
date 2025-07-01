
export const ProjectStatus = {
  ToDo: 'To Do',
  InProgress: 'In Progress',
  QC: 'QC',
  Done: 'Done',
};

export const AttendanceStatus = {
  Present: 'Present',
  WorkFromHome: 'Work From Home',
  Leave: 'Leave',
};

export const LeaveType = {
  Sick: 'Sick Leave',
  Casual: 'Casual Leave',
  Vacation: 'Vacation',
  Maternity: 'Maternity Leave',
  Beverement: 'Beverement Leave',
  Other: 'Other',
};

export const NoteStatus = {
    Pending: 'Pending',
    Completed: 'Completed',
};

// Interfaces are conceptual in JS. These comments describe the expected object shapes.
// interface TeamMember {
//   id: string;
//   name: string;
//   email?: string;
//   employeeId?: string;
//   joinDate?: string; // ISO date string YYYY-MM-DD
//   birthDate?: string; // ISO date string YYYY-MM-DD
//   designation?: string;
//   department?: string;
//   company?: string;
// }

// interface Metric {
//   id: string;
//   fieldName: string;
//   fieldValue: string | number;
//   targetValue?: string | number;
//   memberId?: string; // TeamMember ID
// }

// interface Goal {
//   id: string;
//   name: string;
//   metrics: Metric[];
// }

// interface Project {
//   id: string;
//   name: string;
//   description: string;
//   status: ProjectStatus value;
//   assignees: string[]; // TeamMember IDs
//   dueDate: string; // ISO date string
//   priority?: 'Low' | 'Medium' | 'High';
//   tags?: string[];
//   createdAt: string; // ISO date string
//   updatedAt: string; // ISO date string
//   clientName?: string;
//   teamLeadId?: string; // TeamMember ID
//   projectType?: string;
//   projectCategory?: string;
//   goals?: Goal[];
// }

// interface AttendanceRecord {
//   id: string;
//   date: string; // ISO date string YYYY-MM-DD
//   memberId: string; // TeamMember ID
//   status: AttendanceStatus value;
//   leaveType?: LeaveType value;
//   notes?: string;
// }

// interface Note {
//   id: string;
//   title: string;
//   content: string;
//   status: NoteStatus value;
//   dueDate?: string; // ISO date string YYYY-MM-DD
//   tags?: string[];
//   color: string; // hex code
//   createdAt: string; // ISO date string
//   updatedAt: string; // ISO date string
// }
