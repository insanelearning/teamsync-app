

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

export const NoteStatus = {
    Pending: 'Pending',
    Completed: 'Completed',
};

export const TeamMemberRole = {
  Manager: 'Manager',
  Member: 'Member',
};

// Interfaces are conceptual in JS. These comments describe the expected object shapes.
// interface TeamMember {
//   id: string;
//   name: string;
//   email?: string;
//   phoneNumber?: string;
//   employeeId?: string;
//   joinDate?: string; // ISO date string YYYY-MM-DD
//   birthDate?: string; // ISO date string YYYY-MM-DD
//   designation?: string;
//   department?: string;
//   company?: string;
//   role: TeamMemberRole value;
// }

// interface Metric {
//   id: string;
//   fieldName: string;
//   fieldValue: string | number;
//   targetValue?: string | number;
//   memberId?: string; // TeamMember ID
//   completed?: boolean;
//   completionDate?: string; // ISO date string
// }

// interface Goal {
//   id: string;
//   name: string;
//   metrics: Metric[];
//   completed?: boolean;
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
//   stakeholderName?: string;
//   teamLeadId?: string; // TeamMember ID
//   projectType?: string;
//   projectCategory?: string;
//   goals?: Goal[];
//   mediaProduct?: string;
//   pilotScope?: string;
//   clientNames?: string;
//   projectApproach?: string;
//   deliverables?: string;
//   resultsAchieved?: string;
//   completionDate?: string; // ISO date string
//   completionPercentage?: number;
// }

// interface AttendanceRecord {
//   id: string;
//   date: string; // ISO date string YYYY-MM-DD
//   memberId: string; // TeamMember ID
//   status: AttendanceStatus value;
//   leaveType?: string; // Now a string, not an enum value
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

// interface WorkLog {
//   id: string;
//   memberId: string; // TeamMember ID
//   projectId: string; // Project ID
//   date: string; // ISO date string YYYY-MM-DD
//   taskName: string;
//   requestedFrom: string;
//   timeSpentMinutes: number;
//   comments?: string;
//   createdAt: string; // ISO date string
//   updatedAt: string; // ISO date string
// }
