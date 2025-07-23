
import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderWorkLogPage } from './pages/WorkLogPage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { renderSettingsPage } from './pages/SettingsPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS, DEFAULT_SETTINGS } from './constants.js';
import { getCollection, setDocument, doc as getDocRef, getDoc, updateDoc as updateDocumentService, deleteDoc, batchWrite, batchDelete, deleteByQuery } from './services/firebaseService.js';
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
let appSettings = { ...DEFAULT_SETTINGS };
let currentUser = null; // Start as null, will be set on login
let loginError = null; // State for login error messages

// --- Login/Logout Handlers ---

const handleLogin = (email, password) => {
    const member = teamMembers.find(m => m.email && m.email.toLowerCase() === email);

    if (member && member.password === password) {
        currentUser = member;
        sessionStorage.setItem('currentUserId', member.id);
        currentView = 'dashboard';
        sessionStorage.setItem('currentView', 'dashboard');
        loginError = null; // Clear any previous errors
    } else {
        loginError = 'Invalid email or password.';
    }
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
    await updateDocumentService('projects', id, data);
    projects = projects.map(p => p.id === id ? updatedProject : p);
    renderApp();
  } catch (error) {
    console.error("Failed to update project:", error);
    alert("Error: Could not update the project in the database.");
  }
};

const deleteProject = async (projectId) => {
  try {
    await deleteDoc('projects', projectId);
    projects = projects.filter(p => p.id !== projectId);
    // Also delete associated work logs
    const logsToDelete = workLogs.filter(wl => wl.projectId === projectId);
    if (logsToDelete.length > 0) {
        await batchDelete('worklogs', logsToDelete.map(l => l.id));
    }
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
    await deleteDoc('attendance', recordId);
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
    await updateDocumentService('notes', id, data);
    notes = notes.map(n => n.id === id ? updatedNote : n);
    renderApp();
  } catch (error) {
    console.error("Failed to update note:", error);
    alert("Error: Could not update the note.");
  }
};

const deleteNote = async (noteId) => {
  try {
    await deleteDoc('notes', noteId);
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
        await updateDocumentService('worklogs', id, data);
        workLogs = workLogs.map(wl => wl.id === id ? updatedWorkLog : wl);
        renderApp();
    } catch (error) {
        console.error("Failed to update work log:", error);
        alert("Error: Could not update the work log.");
    }
};

const deleteWorkLog = async (workLogId) => {
    try {
        await deleteDoc('worklogs', workLogId);
        workLogs = workLogs.filter(wl => wl.id !== workLogId);
        renderApp();
    } catch (error) {
        console.error("Failed to delete work log:", error);
        alert("Error: Could not delete the work log.");
    }
};

const deleteMultipleWorkLogs = async (workLogIds) => {
    try {
        await batchDelete('worklogs', workLogIds);
        workLogs = workLogs.filter(wl => !workLogIds.includes(wl.id));
        renderApp();
    } catch (error) {
        console.error("Failed to delete multiple work logs:", error);
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
    const oldMember = teamMembers.find(m => m.id === id);
    const locallyUpdatedMember = { ...oldMember, ...updatedMember };
    
    // If the password field was left blank, don't update it in the database.
    if (!data.password) {
        data.password = oldMember.password;
    }

    await setDocument('teamMembers', id, data);
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
  try {
    const projectsToUpdate = [];
    const currentProjects = projects.map(p => {
        const needsUpdate = (p.assignees || []).includes(memberId) || 
                            p.teamLeadId === memberId || 
                            (p.goals || []).some(g => (g.metrics || []).some(m => m.memberId === memberId));
        
        if (!needsUpdate) return p;

        const updatedProject = {
            ...p,
            assignees: (p.assignees || []).filter(assigneeId => assigneeId !== memberId),
            teamLeadId: p.teamLeadId === memberId ? '' : p.teamLeadId,
            goals: (p.goals || []).map(g => ({
                ...g,
                metrics: (g.metrics || []).map(m => m.memberId === memberId ? { ...m, memberId: undefined } : m)
            }))
        };
        projectsToUpdate.push(updatedProject);
        return updatedProject;
    });

    const projectUpdatePromises = projectsToUpdate.map(p => {
        const { id, ...data } = p;
        return updateDocumentService('projects', id, data);
    });
    await Promise.all(projectUpdatePromises);

    await deleteByQuery('attendance', 'memberId', memberId);
    await deleteByQuery('worklogs', 'memberId', memberId);
    await deleteDoc('teamMembers', memberId);
    
    projects = currentProjects;
    attendance = attendance.filter(a => a.memberId !== memberId);
    workLogs = workLogs.filter(wl => wl.memberId !== memberId);
    teamMembers = teamMembers.filter(m => m.id !== memberId);

    if (currentUser && currentUser.id === memberId) {
        handleLogout();
    } else {
        renderApp();
    }

  } catch (error) {
    console.error("Error deleting team member:", error);
    alert("Failed to delete member and all associated data. Please reload.");
    await loadInitialData(false);
    renderApp();
  }
};

// Settings handler
const updateAppSettings = async (newSettings) => {
    try {
        await setDocument('settings', 'main', newSettings);
        appSettings = newSettings;
        renderApp();
    } catch (error) {
        console.error("Failed to update settings:", error);
        alert("Error: Could not save application settings.");
    }
};

// CSV Handlers
const handleExport = (dataType) => {
  if (dataType === 'projects') {
    const projectsToExport = projects.map(p => ({
      ...p,
      assignees: (p.assignees || []).join(';'),
      tags: (p.tags || []).join(';'),
      goals: JSON.stringify(p.goals || []),
    }));
    exportToCSV(projectsToExport, 'projects.csv');
  } else if (dataType === 'attendance') {
    const attendanceToExport = attendance.map(rec => {
        const member = teamMembers.find(m => m.id === rec.memberId);
        return {
            id: rec.id,
            date: rec.date,
            memberName: member?.name || 'Unknown',
            status: rec.status,
            leaveType: rec.leaveType || '',
            notes: rec.notes || '',
        };
    });
    exportToCSV(attendanceToExport, 'attendance.csv');
  } else if (dataType === 'team') {
    const teamToExport = teamMembers.map(({ password, ...rest }) => rest);
    exportToCSV(teamToExport, 'team_members.csv');
  } else if (dataType === 'notes') {
    const notesToExport = notes.map(n => ({
        ...n,
        tags: (n.tags || []).join(';'),
    }));
    exportToCSV(notesToExport, 'notes.csv');
  } else if (dataType === 'worklogs') {
    const logsToExport = workLogs.map(log => {
        const member = teamMembers.find(m => m.id === log.memberId);
        const project = projects.find(p => p.id === log.projectId);
        return { ...log, memberName: member?.name, projectName: project?.name };
    });
    exportToCSV(logsToExport, 'work_logs.csv');
  }
};

const handleImport = async (file, dataType) => {
  try {
    const data = await importFromCSV(file);
    if (!data || data.length === 0) throw new Error("CSV file is empty.");
    
    let collectionName = '';
    let processedData = [];
    if (dataType === 'projects') {
        collectionName = 'projects';
        processedData = data.map(item => ({...item, assignees: (item.assignees || '').split(';'), tags: (item.tags || '').split(';'), goals: JSON.parse(item.goals || '[]')})).filter(p => p.id && p.name);
    } else if (dataType === 'attendance') {
        collectionName = 'attendance';
        processedData = data.map(item => {
            const member = teamMembers.find(m => m.name === item.memberName);
            return member ? { ...item, memberId: member.id, id: item.id || `${member.id}-${item.date}` } : null;
        }).filter(Boolean);
    } else if (dataType === 'team') {
        collectionName = 'teamMembers';
        processedData = data.map(item => ({ ...item, password: item.password || 'password123' })).filter(m => m.id && m.name);
        if ((teamMembers.length + processedData.length) > 20) throw new Error("Import exceeds 20 member limit.");
    } else if (dataType === 'notes') {
        collectionName = 'notes';
        processedData = data.map(item => ({ ...item, tags: (item.tags || '').split(';') })).filter(n => n.id && n.title);
    } else if (dataType === 'worklogs') {
        collectionName = 'worklogs';
        processedData = data.map(item => {
            const member = teamMembers.find(m => m.name === item.memberName);
            const project = projects.find(p => p.name === item.projectName);
            return (member && project) ? { ...item, memberId: member.id, projectId: project.id, id: item.id || crypto.randomUUID(), timeSpentMinutes: Number(item.timeSpentMinutes) || 0 } : null;
        }).filter(Boolean);
    }
    
    if (collectionName && processedData.length > 0) {
        await batchWrite(collectionName, processedData);
        await loadInitialData(false);
        renderApp();
        alert(`${processedData.length} records imported successfully!`);
    } else {
        alert(`No valid data found to import.`);
    }
  } catch (error) {
    console.error("Import error:", error);
    alert(`Import failed: ${error.message}`);
  }
};


function handleNavChange(view) {
  currentView = view;
  sessionStorage.setItem('currentView', view);
  renderApp();
}

function handleThemeToggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.body.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    renderApp();
}

function buildMainLayout() {
    rootElement.innerHTML = ''; // Clear login page or loading indicator
    rootElement.className = ''; // Reset class from login page

    const navbar = Navbar({ 
        currentView, 
        onNavChange: handleNavChange, 
        onThemeToggle: handleThemeToggle,
        currentUser,
        onLogout: handleLogout,
        notificationCount: 0 // Initial count
    });
    rootElement.appendChild(navbar);

    mainContentElement = document.createElement('main');
    mainContentElement.className = 'main-content';
    rootElement.appendChild(mainContentElement);

    const footer = document.createElement('footer');
    footer.className = 'app-footer';
    footer.innerHTML = `TeamSync &copy; ${new Date().getFullYear()}`;
    rootElement.appendChild(footer);
}


function renderApp() {
  if (!rootElement) {
    console.error("Root element not initialized for rendering.");
    return;
  }
  
  if (!currentUser) {
      rootElement.innerHTML = ''; // Clear whatever was there
      renderLoginPage(rootElement, { 
          onLogin: handleLogin, // Pass the handler directly
          teamMembers,
          error: loginError // Pass the current error state
      });
      return;
  }
  
  const isLayoutBuilt = rootElement.querySelector('nav.navbar');
  if (!isLayoutBuilt) {
      buildMainLayout();
  }

  // --- RBAC Data Filtering ---
  let pageProjects = projects;
  let pageWorkLogs = workLogs;
  let pageAttendance = attendance;
  let pageNotes = notes;
  
  if (currentUser && currentUser.role === TeamMemberRole.Member) {
      pageProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id) || p.teamLeadId === currentUser.id);
      pageWorkLogs = workLogs.filter(w => w.memberId === currentUser.id);
      pageAttendance = attendance.filter(a => a.memberId === currentUser.id);
      pageNotes = notes.filter(n => n.userId === currentUser.id);
  }

  // --- Notification Calculation ---
  let notificationCount = 0;
  if (currentUser) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const overdueProjectsCount = pageProjects.filter(p => p.status !== ProjectStatus.Done && new Date(p.dueDate) < now).length;
      
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);
      const upcomingProjectsCount = pageProjects.filter(p => {
          const dueDate = new Date(p.dueDate + 'T00:00:00');
          return p.status !== ProjectStatus.Done && dueDate >= now && dueDate <= threeDaysFromNow;
      }).length;

      const overdueNotesCount = pageNotes.filter(n => n.status !== 'Completed' && n.dueDate && new Date(n.dueDate) < now).length;

      notificationCount = overdueProjectsCount + upcomingProjectsCount + overdueNotesCount;
  }

  mainContentElement.innerHTML = '';

  if (currentView === 'dashboard') {
    renderDashboardPage(mainContentElement, { currentUser, teamMembers, projects: pageProjects, notes: pageNotes, workLogs: pageWorkLogs, attendanceRecords: pageAttendance, appSettings, onAddNote: addNote, onAddMultipleWorkLogs: addMultipleWorkLogs, onNavChange: handleNavChange });
  } else if (currentView === 'projects') {
    renderProjectsPage(mainContentElement, { projects: pageProjects, teamMembers, currentUser, projectStatuses: Object.values(ProjectStatus), priorities: appSettings.priorities, onAddProject: addProject, onUpdateProject: updateProject, onDeleteProject: deleteProject, onExport: () => handleExport('projects'), onImport: (file) => handleImport(file, 'projects') });
  } else if (currentView === 'attendance') {
    renderAttendancePage(mainContentElement, { attendanceRecords: pageAttendance, teamMembers, currentUser, projects, attendanceStatuses: Object.values(AttendanceStatus), leaveTypes: Object.values(LeaveType), onUpsertAttendanceRecord: upsertAttendanceRecord, onDeleteAttendanceRecord: deleteAttendanceRecord, onExport: () => handleExport('attendance'), onImport: (file) => handleImport(file, 'attendance'), maxTeamMembers: 20, onAddTeamMember: addTeamMember, onUpdateTeamMember: updateTeamMember, onDeleteTeamMember: deleteTeamMember, onExportTeam: () => handleExport('team'), onImportTeam: (file) => handleImport(file, 'team') });
  } else if (currentView === 'notes') {
    renderNotesPage(mainContentElement, { notes: pageNotes, currentUser, noteStatuses: Object.values(NoteStatus), onAddNote: addNote, onUpdateNote: updateNote, onDeleteNote: deleteNote, onExport: () => handleExport('notes'), onImport: (file) => handleImport(file, 'notes') });
  } else if (currentView === 'worklog') {
    renderWorkLogPage(mainContentElement, { workLogs: pageWorkLogs, teamMembers, projects, currentUser, appSettings, onAddMultipleWorkLogs: addMultipleWorkLogs, onUpdateWorkLog: updateWorkLog, onDeleteWorkLog: deleteWorkLog, onDeleteMultipleWorkLogs: deleteMultipleWorkLogs, onExport: () => handleExport('worklogs'), onImport: (file) => handleImport(file, 'worklogs') });
  } else if (currentView === 'settings' && currentUser.role === TeamMemberRole.Manager) {
    renderSettingsPage(mainContentElement, { appSettings, onUpdateAppSettings: updateAppSettings });
  }
  
  const navbarElement = rootElement.querySelector('nav.navbar');
  if (navbarElement) {
      const newNavbar = Navbar({ currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle, currentUser, onLogout: handleLogout, notificationCount });
      navbarElement.replaceWith(newNavbar);
  }
}

async function loadInitialData(seedIfEmpty = true) {
  try {
    const [projectData, attendanceData, notesData, teamMemberData, workLogData] = await Promise.all([
        getCollection('projects'), getCollection('attendance'), getCollection('notes'), getCollection('teamMembers'), getCollection('worklogs')
    ]);
    
    projects = projectData;
    attendance = attendanceData;
    notes = notesData;
    workLogs = workLogData;
    
    const settingsDoc = await getDoc(getDocRef('settings', 'main'));
    if (settingsDoc.exists()) {
        appSettings = { ...DEFAULT_SETTINGS, ...settingsDoc.data() };
    } else if (seedIfEmpty) {
        await setDocument('settings', 'main', DEFAULT_SETTINGS);
        appSettings = { ...DEFAULT_SETTINGS };
    }

    if (seedIfEmpty && teamMemberData.length === 0) {
        await batchWrite('teamMembers', INITIAL_TEAM_MEMBERS);
        teamMembers = await getCollection('teamMembers'); 
    } else {
        teamMembers = teamMemberData;
    }

    teamMembers.forEach(m => {
        if (!m.role) m.role = TeamMemberRole.Member;
        if (!m.password) m.password = 'password123';
    });

    const firstManager = teamMembers.find(m => m.role === TeamMemberRole.Manager);
    const defaultOwnerId = (firstManager || teamMembers[0])?.id;

    if (defaultOwnerId) {
        const notesWithoutOwner = notes.filter(n => !n.userId);
        if (notesWithoutOwner.length > 0) {
            const notesToUpdate = notesWithoutOwner.map(n => ({...n, userId: defaultOwnerId }));
            await batchWrite('notes', notesToUpdate);
            notes = await getCollection('notes');
        }
    }

  } catch (error) {
    console.error("Failed to load initial data from Firestore:", error);
    rootElement.innerHTML = `<div class="firebase-config-error-container">
            <h1><i class="fas fa-exclamation-triangle"></i> Data Loading Error</h1>
            <p>The application could not load data. This might be due to a network issue or incorrect Firebase security rules.</p>
            <p class="error-message"><strong>Error:</strong> ${error.message}</p>
        </div>`;
    throw error;
  }
}

export async function initializeApp(appRootElement) {
  rootElement = appRootElement;
  rootElement.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading Team Data...</p></div>`;

  await loadInitialData();
  
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }

  const savedUserId = sessionStorage.getItem('currentUserId');
  if (savedUserId) {
    currentUser = teamMembers.find(m => m.id === savedUserId) || null;
  }

  renderApp();
}
