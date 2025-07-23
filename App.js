

import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderWorkLogPage } from './pages/WorkLogPage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS } from './constants.js';
import { getCollection, setDocument, updateDocument, deleteDocument, batchWrite, deleteByQuery } from './services/firebaseService.js';
import { exportToCSV, importFromCSV } from './services/csvService.js';
import { ProjectStatus, AttendanceStatus, LeaveType, NoteStatus, TeamMemberRole, NotificationType } from './types.js';

let rootElement;
let mainContentElement;

// State
let currentView = sessionStorage.getItem('currentView') || 'dashboard';
let projects = [];
let attendance = [];
let notes = [];
let teamMembers = [];
let workLogs = [];
let notifications = [];
let currentUser = null;

// --- Login/Logout Handlers ---

const handleLogin = (member) => {
    currentUser = member;
    sessionStorage.setItem('currentUserId', member.id);
    currentView = 'dashboard';
    sessionStorage.setItem('currentView', 'dashboard');
    renderApp();
};

const handleLogout = () => {
    currentUser = null;
    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentView');
    renderApp();
};


// --- Notification Handlers ---

const createNotification = async (notificationData) => {
  try {
    const newNotification = {
      id: crypto.randomUUID(),
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      ...notificationData,
    };
    const { id, ...data } = newNotification;
    await setDocument('notifications', id, data);
    notifications.push(newNotification);
    renderApp(); 
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

const markNotificationRead = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        await updateDocument('notifications', notificationId, { isRead: true, readAt: notification.readAt });
        renderApp();
    }
};

const markAllNotificationsRead = async () => {
    const unread = notifications.filter(n => n.userId === currentUser.id && !n.isRead);
    if (unread.length === 0) return;
    
    const batch = writeBatch(getCollection('notifications').firestore);
    const now = new Date().toISOString();

    unread.forEach(n => {
        n.isRead = true;
        n.readAt = now;
        const docRef = doc(getCollection('notifications').firestore, 'notifications', n.id);
        batch.update(docRef, { isRead: true, readAt: now });
    });
    await batch.commit();
    renderApp();
};

const checkDeadlines = async () => {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    for (const project of projects) {
        if (project.status === ProjectStatus.Done) continue;

        const assignees = project.assignees || [];
        if (assignees.length === 0) continue;
        
        const dueDate = new Date(project.dueDate + 'T00:00:00');

        if (dueDate < now) { // Overdue
            for (const userId of assignees) {
                const existing = notifications.find(n => n.userId === userId && n.relatedId === project.id && n.type === NotificationType.PROJECT_OVERDUE && !n.isRead);
                if (!existing) {
                    await createNotification({ userId, type: NotificationType.PROJECT_OVERDUE, message: `Project "${project.name}" is overdue!`, relatedId: project.id });
                }
            }
        } else if (dueDate <= threeDaysFromNow) { // Due Soon
            for (const userId of assignees) {
                const existing = notifications.find(n => n.userId === userId && n.relatedId === project.id && n.type === NotificationType.PROJECT_DUE_SOON && !n.isRead);
                if (!existing) {
                    await createNotification({ userId, type: NotificationType.PROJECT_DUE_SOON, message: `Project "${project.name}" is due on ${dueDate.toLocaleDateString()}.`, relatedId: project.id });
                }
            }
        }
    }
};


// --- Data Handlers ---

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
    
    if (originalProject) {
        // Status change notification
        if (originalProject.status !== updatedProject.status) {
            (updatedProject.assignees || []).forEach(assigneeId => {
                createNotification({ userId: assigneeId, type: NotificationType.PROJECT_STATUS_CHANGE, message: `Status of project "${updatedProject.name}" changed to ${updatedProject.status}.`, relatedId: updatedProject.id });
            });
        }
        // New assignment notification
        const oldAssignees = new Set(originalProject.assignees || []);
        (updatedProject.assignees || []).forEach(assigneeId => {
            if (!oldAssignees.has(assigneeId)) {
                createNotification({ userId: assigneeId, type: NotificationType.NEW_ASSIGNMENT, message: `You have been assigned to project "${updatedProject.name}".`, relatedId: updatedProject.id });
            }
        });
    }

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
    // Also delete associated work logs and notifications
    await deleteByQuery('worklogs', 'projectId', projectId);
    workLogs = workLogs.filter(wl => wl.projectId !== projectId);
    await deleteByQuery('notifications', 'relatedId', projectId);
    notifications = notifications.filter(n => n.relatedId !== projectId);
    renderApp();
  } catch (error) {
    console.error("Failed to delete project:", error);
    alert("Error: Could not delete the project from the database.");
  }
};

// ... (other handlers remain the same)
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

const addNote = async (note) => {
  try {
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

const addMultipleWorkLogs = async (workLogsToAdd) => {
    try {
        const now = new Date().toISOString();
        const processedLogs = workLogsToAdd.map(log => ({ ...log, id: crypto.randomUUID(), createdAt: now, updatedAt: now }));
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
    const oldMember = teamMembers.find(m => m.id === id);
    const locallyUpdatedMember = { ...oldMember, ...updatedMember };
    teamMembers = teamMembers.map(m => m.id === id ? locallyUpdatedMember : m);
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
        const needsUpdate = p.assignees.includes(memberId) || p.teamLeadId === memberId || (p.goals || []).some(g => (g.metrics || []).some(m => m.memberId === memberId));
        if (!needsUpdate) return p;
        const updatedProject = { ...p, assignees: p.assignees.filter(assigneeId => assigneeId !== memberId), teamLeadId: p.teamLeadId === memberId ? '' : p.teamLeadId, goals: (p.goals || []).map(g => ({ ...g, metrics: (g.metrics || []).map(m => m.memberId === memberId ? { ...m, memberId: undefined } : m) })) };
        projectsToUpdate.push(updatedProject);
        return updatedProject;
    });

    await Promise.all(projectsToUpdate.map(p => updateDocument('projects', p.id, p)));
    await deleteByQuery('attendance', 'memberId', memberId);
    await deleteByQuery('worklogs', 'memberId', memberId);
    await deleteByQuery('notifications', 'userId', memberId);
    await deleteDocument('teamMembers', memberId);
    
    projects = currentProjects;
    attendance = attendance.filter(a => a.memberId !== memberId);
    workLogs = workLogs.filter(wl => wl.memberId !== memberId);
    notifications = notifications.filter(n => n.userId !== memberId);
    teamMembers = teamMembers.filter(m => m.id !== memberId);

    if (currentUser && currentUser.id === memberId) {
        handleLogout();
    } else {
        renderApp();
    }
  } catch (error) {
    console.error("Error deleting team member:", error);
    alert("Failed to delete member and all associated data. The data may be in an inconsistent state. Please reload the page.");
    await loadInitialData(false);
    renderApp();
  }
};

const handleExport = (dataType) => {
  // This function body remains unchanged
  if (dataType === 'projects') {
    const projectsToExport = projects.map(p => ({
      id: p.id, name: p.name, description: p.description, status: p.status, assignees: p.assignees.join(';'), dueDate: p.dueDate, priority: p.priority, tags: p.tags ? p.tags.join(';') : '', createdAt: p.createdAt, updatedAt: p.updatedAt, stakeholderName: p.stakeholderName || '', teamLeadId: p.teamLeadId || '', projectType: p.projectType || '', projectCategory: p.projectCategory || '', goals: p.goals ? JSON.stringify(p.goals) : '[]', mediaProduct: p.mediaProduct || '', pilotScope: p.pilotScope || '', clientNames: p.clientNames || '', projectApproach: p.projectApproach || '', deliverables: p.deliverables || '', resultsAchieved: p.resultsAchieved || '', completionDate: p.completionDate || '', completionPercentage: p.completionPercentage || 0,
    }));
    exportToCSV(projectsToExport, 'projects.csv');
  } else if (dataType === 'attendance') {
    const attendanceToExport = attendance.map(rec => ({ id: rec.id, date: rec.date, memberName: teamMembers.find(m => m.id === rec.memberId)?.name || 'Unknown', status: rec.status, leaveType: rec.leaveType || '', notes: rec.notes || '' }));
    exportToCSV(attendanceToExport, 'attendance.csv');
  } else if (dataType === 'team') {
    exportToCSV(teamMembers, 'team_members.csv');
  } else if (dataType === 'notes') {
    const notesToExport = notes.map(n => ({ ...n, tags: n.tags ? n.tags.join(';') : '' }));
    exportToCSV(notesToExport, 'notes.csv');
  } else if (dataType === 'worklogs') {
    const logsToExport = workLogs.map(log => ({ id: log.id, date: log.date, memberName: teamMembers.find(m => m.id === log.memberId)?.name || 'Unknown', projectName: projects.find(p => p.id === log.projectId)?.name || 'Unknown', taskName: log.taskName, requestedFrom: log.requestedFrom, timeSpentMinutes: log.timeSpentMinutes, comments: log.comments || '' }));
    exportToCSV(logsToExport, 'work_logs.csv');
  }
};

const handleImport = async (file, dataType) => {
  try {
    const data = await importFromCSV(file);
    if (!data || data.length === 0) {
      alert("The selected CSV file is empty or could not be read.");
      return;
    }
    
    let collectionName = '';
    let processedData = [];
    let importErrors = [];

    if (dataType === 'projects') {
        collectionName = 'projects';
        processedData = data.map(item => {
            if (!item.id || !item.name || !item.status || !item.dueDate) return null;
            const goals = Array.isArray(item.goals) ? item.goals : JSON.parse(item.goals || '[]');
            const totalGoals = goals.length;
            const completedGoals = goals.filter(g => g.completed).length;
            const completionPercentage = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
            return { ...item, assignees: Array.isArray(item.assignees) ? item.assignees : (item.assignees || '').split(';').map(s=>s.trim()).filter(Boolean), tags: Array.isArray(item.tags) ? item.tags : (item.tags || '').split(';').map(s=>s.trim()).filter(Boolean), goals: goals, stakeholderName: item.stakeholderName || '', mediaProduct: item.mediaProduct || '', pilotScope: item.pilotScope || '', clientNames: item.clientNames || '', projectApproach: item.projectApproach || '', deliverables: item.deliverables || '', resultsAchieved: item.resultsAchieved || '', completionDate: item.completionDate || null, completionPercentage: completionPercentage };
        }).filter(Boolean);
    } else if (dataType === 'attendance') {
        collectionName = 'attendance';
        processedData = data.map((item, index) => {
            const rowNum = index + 2;
            const member = teamMembers.find(m => m.name.trim().toLowerCase() === item.memberName?.trim().toLowerCase());
            if (!item.date || !item.memberName || !item.status) { importErrors.push(`Row ${rowNum}: Missing required data.`); return null; }
            if (!member) { importErrors.push(`Row ${rowNum}: Could not find member "${item.memberName}".`); return null; }
            return { id: item.id || `${member.id}-${item.date}`, date: item.date, memberId: member.id, status: item.status, leaveType: item.leaveType || null, notes: item.notes || '' };
        }).filter(Boolean);
    } else if (dataType === 'team') {
        collectionName = 'teamMembers';
        processedData = data.map(item => {
            if (!item.id || !item.name) return null;
            const { password, ...memberData } = item;
            return memberData;
        }).filter(Boolean);
        if ((teamMembers.length + processedData.length) > 20) { alert("Import would exceed the 20 team member limit."); return; }
    } else if (dataType === 'notes') {
        collectionName = 'notes';
        processedData = data.map(item => {
           if (!item.id || !item.title || !item.content || !item.status || !item.color) return null;
            return { ...item, tags: Array.isArray(item.tags) ? item.tags : (item.tags || '').split(';').map(s => s.trim()).filter(Boolean) };
        }).filter(Boolean);
    } else if (dataType === 'worklogs') {
        collectionName = 'worklogs';
        processedData = data.map((item, index) => {
            const rowNum = index + 2;
            if (!item.date || !item.memberName || !item.projectName || item.timeSpentMinutes === undefined) { importErrors.push(`Row ${rowNum}: Missing required columns.`); return null; }
            let normalizedDate = item.date;
            const dateParts = String(item.date).split('-');
            if (dateParts.length === 3 && dateParts[0].length === 2 && dateParts[2].length === 4) { normalizedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; }
            const member = teamMembers.find(m => m.name.trim().toLowerCase() === item.memberName.trim().toLowerCase());
            if (!member) { importErrors.push(`Row ${rowNum}: Could not find member "${item.memberName}".`); return null; }
            const project = projects.find(p => p.name.trim().toLowerCase() === item.projectName.trim().toLowerCase());
            if (!project) { importErrors.push(`Row ${rowNum}: Could not find project "${item.projectName}".`); return null; }
            const now = new Date().toISOString();
            return { id: item.id || crypto.randomUUID(), date: normalizedDate, memberId: member.id, projectId: project.id, taskName: item.taskName || 'N/A', requestedFrom: item.requestedFrom || 'N/A', timeSpentMinutes: Number(item.timeSpentMinutes) || 0, comments: item.comments || '', createdAt: item.createdAt || now, updatedAt: now };
        }).filter(Boolean);
    }
    
    if (importErrors.length > 0) {
        alert(`Import failed with ${importErrors.length} errors. Please check CSV.\nErrors: ${importErrors.slice(0, 5).join(', ')}`);
        return;
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
    alert(`Failed to import data. Please check the console.`);
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
    rootElement.innerHTML = '';
    rootElement.className = '';

    const navbar = Navbar({ currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle, currentUser, onLogout, notifications, onMarkNotificationRead, onMarkAllNotificationsRead });
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
  if (!rootElement) return;
  
  if (!currentUser) {
      rootElement.innerHTML = '';
      renderLoginPage(rootElement, { onLogin: handleLogin, teamMembers });
      return;
  }
  
  const isLayoutBuilt = rootElement.querySelector('nav.navbar');
  if (!isLayoutBuilt) {
      buildMainLayout();
  }

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

  mainContentElement.innerHTML = '';

  const pageProps = {
    dashboard: { currentUser, teamMembers, projects: pageProjects, notes: pageNotes, workLogs: pageWorkLogs, attendanceRecords: pageAttendance, projectStatuses: Object.values(ProjectStatus), onAddProject: addProject, onAddNote: addNote, onAddMultipleWorkLogs: addMultipleWorkLogs, onNavChange: handleNavChange },
    projects: { projects: pageProjects, teamMembers, currentUser, projectStatuses: Object.values(ProjectStatus), onAddProject: addProject, onUpdateProject: updateProject, onDeleteProject: deleteProject, onExport: () => handleExport('projects'), onImport: (file) => handleImport(file, 'projects') },
    attendance: { attendanceRecords: pageAttendance, teamMembers, currentUser, projects, attendanceStatuses: Object.values(AttendanceStatus), leaveTypes: Object.values(LeaveType), onUpsertAttendanceRecord: upsertAttendanceRecord, onDeleteAttendanceRecord: deleteAttendanceRecord, onExport: () => handleExport('attendance'), onImport: (file) => handleImport(file, 'attendance'), maxTeamMembers: 20, onAddTeamMember: addTeamMember, onUpdateTeamMember: updateTeamMember, onDeleteTeamMember: deleteTeamMember, onExportTeam: () => handleExport('team'), onImportTeam: (file) => handleImport(file, 'team') },
    notes: { notes: pageNotes, currentUser, noteStatuses: Object.values(NoteStatus), onAddNote: addNote, onUpdateNote: updateNote, onDeleteNote: deleteNote, onExport: () => handleExport('notes'), onImport: (file) => handleImport(file, 'notes') },
    worklog: { workLogs: pageWorkLogs, teamMembers, projects, currentUser, onAddMultipleWorkLogs: addMultipleWorkLogs, onUpdateWorkLog: updateWorkLog, onDeleteWorkLog: deleteWorkLog, onExport: () => handleExport('worklogs'), onImport: (file) => handleImport(file, 'worklogs') }
  };

  const renderers = {
    dashboard: renderDashboardPage,
    projects: renderProjectsPage,
    attendance: renderAttendancePage,
    notes: renderNotesPage,
    worklog: renderWorkLogPage
  };
  
  if (renderers[currentView]) {
    renderers[currentView](mainContentElement, pageProps[currentView]);
  }
  
  const navbarElement = rootElement.querySelector('nav.navbar');
  if (navbarElement) {
      const newNavbar = Navbar({ currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle, currentUser, onLogout, notifications, onMarkNotificationRead, onMarkAllNotificationsRead });
      navbarElement.replaceWith(newNavbar);
  }
}

async function loadInitialData(seedIfEmpty = true) {
  try {
    const [projectData, attendanceData, notesData, teamMemberData, workLogData, notificationData] = await Promise.all([
        getCollection('projects'),
        getCollection('attendance'),
        getCollection('notes'),
        getCollection('teamMembers'),
        getCollection('worklogs'),
        getCollection('notifications'),
    ]);
    
    projects = projectData;
    attendance = attendanceData;
    notes = notesData;
    workLogs = workLogData;
    notifications = notificationData;

    if (seedIfEmpty && teamMemberData.length === 0) {
        await batchWrite('teamMembers', INITIAL_TEAM_MEMBERS);
        teamMembers = await getCollection('teamMembers'); 
    } else {
        teamMembers = teamMemberData;
    }

    teamMembers.forEach(m => { if (!m.role) m.role = TeamMemberRole.Member; });
    
    const defaultOwnerId = (teamMembers.find(m => m.role === TeamMemberRole.Manager) || teamMembers[0])?.id;
    if (defaultOwnerId) {
        const notesWithoutOwner = notes.filter(n => !n.userId);
        if (notesWithoutOwner.length > 0) {
            console.log(`Migrating ${notesWithoutOwner.length} notes to have an owner...`);
            await batchWrite('notes', notesWithoutOwner.map(n => ({...n, userId: defaultOwnerId })));
            notes = await getCollection('notes');
        }
    }
  } catch (error) {
    console.error("Failed to load initial data from Firestore:", error);
    rootElement.innerHTML = `<div class="firebase-config-error-container"><h1><i class="fas fa-exclamation-triangle"></i> Data Loading Error</h1><p>Could not load data from the database. Check connection and Firebase security rules.</p><p class="error-message"><strong>Error:</strong> ${error.message}</p></div>`;
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
    if (currentUser) {
        // Run deadline check only after a user is logged in
        await checkDeadlines();
    }
  }

  renderApp();
}
