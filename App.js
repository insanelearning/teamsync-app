

import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderWorkLogPage } from './pages/WorkLogPage.js';
import { renderCampaignsPage } from './pages/CampaignsPage.js';
import { renderEvaluationPage } from './pages/EvaluationPage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS } from './constants.js';
import { getCollection, setDocument, updateDocument, deleteDocument, batchWrite, deleteByQuery, batchDeleteDocuments } from './services/firebaseService.js';
import { exportToCSV, importFromCSV } from './services/csvService.js';
import { ProjectStatus, AttendanceStatus, LeaveType, NoteStatus, TeamMemberRole } from './types.js'; // Enums

let rootElement;
let mainContentElement;

// State
let currentView = sessionStorage.getItem('currentView') || 'dashboard';
let projects = [];
let attendance = [];
let notes = [];
let teamMembers = [];
let workLogs = [];
let currentUser = null; // Start as null, will be set on login

// --- Login/Logout Handlers ---

const handleLogin = (member) => {
    currentUser = member;
    sessionStorage.setItem('currentUserId', member.id);
    // After login, always go to dashboard
    currentView = 'dashboard';
    sessionStorage.setItem('currentView', 'dashboard');
    renderApp();
};

const handleLogout = () => {
    currentUser = null;
    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentView'); // Also clear view preference
    renderApp();
};


// --- Handler Functions ---

// Project handlers
const addProject = async (project) => {
  try {
    const { id, ...data } = project;
    await setDocument('projects', id, data);
    projects.push(project);
    renderApp();
  } catch (error) {
    console.error("Failed to add project:", error);
    alert("Error: Could not save the new project to the database.");
  }
};

const updateProject = async (updatedProject) => {
  try {
    const originalProject = projects.find(p => p.id === updatedProject.id);
    if (originalProject && originalProject.status !== ProjectStatus.Done && updatedProject.status === ProjectStatus.Done) {
        updatedProject.completionDate = new Date().toISOString();
    }

    const { id, ...data } = updatedProject;
    await updateDocument('projects', id, data);
    projects = projects.map(p => p.id === id ? updatedProject : p);
    renderApp();
  } catch (error) {
    console.error("Failed to update project:", error);
    alert("Error: Could not update the project in the database.");
  }
};

const deleteProject = async (projectId) => {
  try {
    await deleteDocument('projects', projectId);
    projects = projects.filter(p => p.id !== projectId);
    // Also delete associated work logs
    workLogs.filter(wl => wl.projectId === projectId).forEach(wl => deleteDocument('worklogs', wl.id));
    workLogs = workLogs.filter(wl => wl.projectId !== projectId);
    renderApp();
  } catch (error) {
    console.error("Failed to delete project:", error);
    alert("Error: Could not delete the project from the database.");
  }
};

// Attendance handlers
const upsertAttendanceRecord = async (record) => {
  try {
    const { id, ...data } = record;
    await setDocument('attendance', id, data);
    const existingIndex = attendance.findIndex(r => r.id === id);
    if (existingIndex > -1) {
      attendance[existingIndex] = record;
    } else {
      attendance.push(record);
    }
    renderApp();
  } catch (error) {
    console.error("Failed to save attendance record:", error);
    alert("Error: Could not save the attendance record.");
  }
};

const deleteAttendanceRecord = async (recordId) => {
  try {
    await deleteDocument('attendance', recordId);
    attendance = attendance.filter(r => r.id !== recordId);
    renderApp();
  } catch (error) {
    console.error("Failed to delete attendance record:", error);
    alert("Error: Could not delete the attendance record.");
  }
};

// Note handlers
const addNote = async (note) => {
  try {
    // Add the current user's ID to the note for ownership
    const noteWithOwner = { ...note, userId: currentUser.id };
    const { id, ...data } = noteWithOwner;
    await setDocument('notes', id, data);
    notes.push(noteWithOwner);
    renderApp();
  } catch (error) {
    console.error("Failed to add note:", error);
    alert("Error: Could not save the new note.");
  }
};

const updateNote = async (updatedNote) => {
  try {
    const { id, ...data } = updatedNote;
    await updateDocument('notes', id, data);
    notes = notes.map(n => n.id === id ? updatedNote : n);
    renderApp();
  } catch (error) {
    console.error("Failed to update note:", error);
    alert("Error: Could not update the note.");
  }
};

const deleteNote = async (noteId) => {
  try {
    await deleteDocument('notes', noteId);
    notes = notes.filter(n => n.id !== noteId);
    renderApp();
  } catch (error) {
    console.error("Failed to delete note:", error);
    alert("Error: Could not delete the note.");
  }
};

// Work Log Handlers
const addMultipleWorkLogs = async (workLogsToAdd) => {
    try {
        const now = new Date().toISOString();
        // Prepare logs for batch write, ensuring each has a unique ID and timestamps.
        const processedLogs = workLogsToAdd.map(log => {
            const { id, ...data } = log;
            return {
                ...data,
                id: crypto.randomUUID(),
                createdAt: now,
                updatedAt: now,
            };
        });
        
        await batchWrite('worklogs', processedLogs);
        workLogs.push(...processedLogs);
        renderApp();
    } catch (error) {
        console.error("Failed to add work logs:", error);
        alert("Error: Could not save the new work logs.");
    }
};

const updateWorkLog = async (updatedWorkLog) => {
    try {
        const { id, ...data } = updatedWorkLog;
        await updateDocument('worklogs', id, data);
        workLogs = workLogs.map(wl => wl.id === id ? updatedWorkLog : wl);
        renderApp();
    } catch (error) {
        console.error("Failed to update work log:", error);
        alert("Error: Could not update the work log.");
    }
};

const deleteWorkLog = async (workLogId) => {
    try {
        await deleteDocument('worklogs', workLogId);
        workLogs = workLogs.filter(wl => wl.id !== workLogId);
        renderApp();
    } catch (error) {
        console.error("Failed to delete work log:", error);
        alert("Error: Could not delete the work log.");
    }
};

const deleteMultipleWorkLogs = async (workLogIds) => {
    try {
        await batchDeleteDocuments('worklogs', workLogIds);
        workLogs = workLogs.filter(wl => !workLogIds.includes(wl.id));
        renderApp();
    } catch (error) {
        console.error("Failed to delete work logs in batch:", error);
        alert("Error: Could not delete the selected work logs.");
    }
};


// Team Member handlers
const addTeamMember = async (member) => {
  if (teamMembers.length >= 20) {
    alert("Team size cannot exceed 20 members.");
    return;
  }
  try {
    const { id, ...data } = member;
    await setDocument('teamMembers', id, data);
    teamMembers.push(member);
    renderApp();
  } catch (error) {
    console.error("Failed to add team member:", error);
    alert("Error: Could not save the new team member to the database. Please check the console (F12) for more details.");
  }
};

const updateTeamMember = async (updatedMember) => {
  try {
    const { id, ...data } = updatedMember;
    await updateDocument('teamMembers', id, data);
    
    // To update local state, we need to merge the changes with the existing member object
    // to preserve fields that weren't changed (like the password if left blank).
    const oldMember = teamMembers.find(m => m.id === id);
    const locallyUpdatedMember = { ...oldMember, ...updatedMember };
    
    teamMembers = teamMembers.map(m => m.id === id ? locallyUpdatedMember : m);
    
    // If the currently logged in user was updated, update the currentUser object
    if (currentUser && currentUser.id === id) {
        currentUser = locallyUpdatedMember;
    }
    renderApp();
  } catch (error) {
    console.error("Failed to update team member:", error);
    alert("Error: Could not update the team member.");
  }
};

const deleteTeamMember = async (memberId) => {
  // This is a complex transaction. A Cloud Function would be better for atomicity.
  // Here we perform the steps sequentially.
  try {
    const projectsToUpdate = [];
    const currentProjects = projects.map(p => {
        const needsUpdate = p.assignees.includes(memberId) || 
                            p.teamLeadId === memberId || 
                            (p.goals || []).some(g => (g.metrics || []).some(m => m.memberId === memberId));
        
        if (!needsUpdate) return p;

        const updatedProject = {
            ...p,
            assignees: p.assignees.filter(assigneeId => assigneeId !== memberId),
            teamLeadId: p.teamLeadId === memberId ? '' : p.teamLeadId,
            goals: (p.goals || []).map(g => ({
                ...g,
                metrics: (g.metrics || []).map(m => m.memberId === memberId ? { ...m, memberId: undefined } : m)
            }))
        };
        projectsToUpdate.push(updatedProject);
        return updatedProject;
    });

    // 1. Update all affected projects
    const projectUpdatePromises = projectsToUpdate.map(p => {
        const { id, ...data } = p;
        return updateDocument('projects', id, data);
    });
    await Promise.all(projectUpdatePromises);

    // 2. Delete all attendance records for the member
    await deleteByQuery('attendance', 'memberId', memberId);
    
    // 3. Delete all work logs for the member
    await deleteByQuery('worklogs', 'memberId', memberId);

    // 4. Delete the team member itself
    await deleteDocument('teamMembers', memberId);
    
    // 5. Update local state and re-render
    projects = currentProjects;
    attendance = attendance.filter(a => a.memberId !== memberId);
    workLogs = workLogs.filter(wl => wl.memberId !== memberId);
    teamMembers = teamMembers.filter(m => m.id !== memberId);

    // 6. Logout if the current user was deleted
    if (currentUser && currentUser.id === memberId) {
        handleLogout();
    } else {
        renderApp();
    }

  } catch (error) {
    console.error("Error deleting team member:", error);
    alert("Failed to delete member and all associated data. The data may be in an inconsistent state. Please reload the page.");
    // Refetch data to get back to a consistent state
    await loadInitialData(false);
    renderApp();
  }
};

// CSV Handlers
const handleExport = (dataType) => {
  if (dataType === 'projects') {
    const projectsToExport = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      assignees: p.assignees.join(';'),
      dueDate: p.dueDate,
      priority: p.priority,
      tags: p.tags ? p.tags.join(';') : '',
      stakeholderName: p.stakeholderName || '',
      teamLeadId: p.teamLeadId || '',
      projectType: p.projectType || '',
      projectCategory: p.projectCategory || '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      completionDate: p.completionDate || '',
      completionPercentage: p.completionPercentage || 0
    }));
    exportToCSV(projectsToExport, 'projects.csv');
  } else if (dataType === 'attendance') {
    const attendanceToExport = attendance.map(a => ({
      id: a.id,
      memberId: a.memberId,
      date: a.date,
      status: a.status,
      leaveType: a.leaveType || '',
      notes: a.notes || '',
    }));
    exportToCSV(attendanceToExport, 'attendance.csv');
  } else if (dataType === 'notes') {
    const notesToExport = notes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        status: n.status,
        dueDate: n.dueDate || '',
        tags: n.tags ? n.tags.join(';') : '',
        color: n.color,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
    }));
    exportToCSV(notesToExport, 'notes.csv');
  } else if (dataType === 'team') {
    const teamToExport = teamMembers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        employeeId: m.employeeId || '',
        joinDate: m.joinDate || '',
        birthDate: m.birthDate || '',
        designation: m.designation || '',
        department: m.department || '',
        company: m.company || '',
        role: m.role,
    }));
    exportToCSV(teamToExport, 'team.csv');
  } else if (dataType === 'worklogs') {
    const logsToExport = workLogs.map(log => ({
        id: log.id,
        memberId: log.memberId,
        projectId: log.projectId,
        date: log.date,
        taskName: log.taskName,
        requestedFrom: log.requestedFrom,
        timeSpentMinutes: log.timeSpentMinutes,
        comments: log.comments || '',
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
    }));
    exportToCSV(logsToExport, 'work_logs.csv');
  }
};

const handleImport = async (file, dataType) => {
    try {
        const data = await importFromCSV(file);
        if (!data || data.length === 0) {
            alert('No data to import from file.');
            return;
        }

        if (dataType === 'projects') {
            await batchWrite('projects', data);
            projects = await getCollection('projects');
        } else if (dataType === 'attendance') {
            await batchWrite('attendance', data);
            attendance = await getCollection('attendance');
        } else if (dataType === 'notes') {
            await batchWrite('notes', data);
            notes = await getCollection('notes');
        } else if (dataType === 'team') {
            // Check for team size limit before importing
            if (teamMembers.length + data.length > 20) {
                alert(`Import failed: Cannot exceed team size of 20. Current: ${teamMembers.length}, Importing: ${data.length}`);
                return;
            }
            // Ensure imported members have required fields
            const processedMembers = data.map(m => ({
                ...m,
                role: m.role || TeamMemberRole.Member, // Default to Member role if not specified
            }));
            await batchWrite('teamMembers', processedMembers);
            teamMembers = await getCollection('teamMembers');
        } else if (dataType === 'worklogs') {
            await batchWrite('worklogs', data);
            workLogs = await getCollection('worklogs');
        }
        
        alert(`Successfully imported ${data.length} records.`);
        renderApp();
    } catch (error) {
        console.error(`Error importing ${dataType}:`, error);
        alert(`Failed to import ${dataType}. Please check the console for details.`);
    }
};

// --- Render Logic ---

const renderApp = () => {
  if (!rootElement) return;
  rootElement.innerHTML = ''; // Clear previous content

  // If no user is logged in, show the login page.
  if (!currentUser) {
    renderLoginPage(rootElement, { onLogin: handleLogin, teamMembers });
    return;
  }
  
  // If user is logged in, show the main app layout.
  rootElement.className = ''; // Remove login-specific class if it exists
  
  const navbarElement = Navbar({
    currentView,
    onNavChange: (view) => {
      currentView = view;
      sessionStorage.setItem('currentView', view);
      renderApp();
    },
    onThemeToggle: () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      renderApp(); // Re-render to update components that might depend on theme (e.g., icons)
    },
    currentUser,
    onLogout: handleLogout
  });
  rootElement.appendChild(navbarElement);

  mainContentElement = document.createElement('main');
  mainContentElement.className = 'main-content';
  rootElement.appendChild(mainContentElement);

  switch (currentView) {
    case 'dashboard':
      renderDashboardPage(mainContentElement, { currentUser, projects, teamMembers, notes, workLogs, attendanceRecords, onAddNote, onAddMultipleWorkLogs });
      break;
    case 'projects':
      const userProjects = currentUser.role === TeamMemberRole.Manager
        ? projects
        : projects.filter(p => (p.assignees || []).includes(currentUser.id));
      renderProjectsPage(mainContentElement, { projects: userProjects, teamMembers, currentUser, projectStatuses: ProjectStatus, onAddProject, onUpdateProject, onDeleteProject, onExport: () => handleExport('projects'), onImport: (file) => handleImport(file, 'projects') });
      break;
    case 'attendance':
      renderAttendancePage(mainContentElement, {
        attendanceRecords: attendance, teamMembers, projects, currentUser,
        attendanceStatuses: AttendanceStatus, leaveTypes: LeaveType,
        onUpsertAttendanceRecord: upsertAttendanceRecord,
        onDeleteAttendanceRecord: deleteAttendanceRecord,
        onExport: () => handleExport('attendance'),
        onImport: (file) => handleImport(file, 'attendance'),
        maxTeamMembers: 20,
        onAddTeamMember: addTeamMember, onUpdateTeamMember: updateTeamMember, onDeleteTeamMember: deleteTeamMember,
        onExportTeam: () => handleExport('team'),
        onImportTeam: (file) => handleImport(file, 'team'),
      });
      break;
    case 'worklog':
      renderWorkLogPage(mainContentElement, { workLogs, teamMembers, projects, currentUser, onAddMultipleWorkLogs, onUpdateWorkLog, onDeleteWorkLog, onDeleteMultipleWorkLogs, onExport: () => handleExport('worklogs'), onImport: (file) => handleImport(file, 'worklogs') });
      break;
    case 'notes':
      const userNotes = notes.filter(n => n.userId === currentUser.id);
      renderNotesPage(mainContentElement, { notes: userNotes, currentUser, noteStatuses: NoteStatus, onAddNote, onUpdateNote, onDeleteNote, onExport: () => handleExport('notes'), onImport: (file) => handleImport(file, 'notes') });
      break;
    case 'campaigns':
        renderCampaignsPage(mainContentElement, { projects, teamMembers, projectStatuses: ProjectStatus, onAddProject, onUpdateProject, onDeleteProject });
        break;
    case 'evaluation':
        if(currentUser.role === TeamMemberRole.Manager) {
            renderEvaluationPage(mainContentElement, { teamMembers, projects, attendanceRecords });
        } else {
             // Redirect non-managers
            currentView = 'dashboard';
            sessionStorage.setItem('currentView', 'dashboard');
            renderApp();
        }
        break;
    default:
      mainContentElement.innerHTML = `<p>Page not found</p>`;
  }

  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `&copy; ${new Date().getFullYear()} TeamSync. All rights reserved.`;
  rootElement.appendChild(footer);
};


async function loadInitialData(seedIfEmpty = true) {
    const [
        loadedProjects, 
        loadedAttendance, 
        loadedNotes, 
        loadedTeamMembers, 
        loadedWorkLogs
    ] = await Promise.all([
        getCollection('projects'),
        getCollection('attendance'),
        getCollection('notes'),
        getCollection('teamMembers'),
        getCollection('worklogs')
    ]);

    projects = loadedProjects;
    attendance = loadedAttendance;
    notes = loadedNotes;
    workLogs = loadedWorkLogs;

    // Seed initial data only if the teamMembers collection is empty
    if (loadedTeamMembers.length === 0 && seedIfEmpty) {
        teamMembers = INITIAL_TEAM_MEMBERS;
        await batchWrite('teamMembers', teamMembers);
    } else {
        teamMembers = loadedTeamMembers;
    }

    // Attempt to auto-login if a user ID is in sessionStorage
    const lastUserId = sessionStorage.getItem('currentUserId');
    if (lastUserId) {
        currentUser = teamMembers.find(m => m.id === lastUserId) || null;
    }
}


export async function initializeApp(appRootElement) {
  rootElement = appRootElement;
  rootElement.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading Team Data...</p></div>`;

  // Apply theme from localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
  }

  await loadInitialData();
  renderApp();
}
