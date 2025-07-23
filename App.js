

import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderWorkLogPage } from './pages/WorkLogPage.js';
import { renderSettingsPage } from './pages/SettingsPage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS, DEFAULT_WORK_LOG_TASKS } from './constants.js';
import { getCollection, setDocument, updateDocument, deleteDocument, batchWrite, deleteByQuery, doc, getDoc } from './services/firebaseService.js';
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
let notifications = [];
let settings = { workLogTasks: [...DEFAULT_WORK_LOG_TASKS] };
let currentUser = null; // Start as null, will be set on login

// --- Login/Logout Handlers ---

const handleLogin = async (member) => {
    currentUser = member;
    sessionStorage.setItem('currentUserId', member.id);
    currentView = 'dashboard';
    sessionStorage.setItem('currentView', 'dashboard');
    // Load user-specific data after login
    await loadUserSpecificData();
    renderApp();
};

const handleLogout = () => {
    currentUser = null;
    notifications = [];
    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentView'); // Also clear view preference
    renderApp();
};


// --- Notification Handlers ---
const createNotification = async (notificationData) => {
    const id = crypto.randomUUID();
    const newNotification = {
        isRead: false,
        createdAt: new Date().toISOString(),
        ...notificationData,
        id,
    };
    try {
        await setDocument('notifications', id, newNotification);
        // If the notification is for the current user, add it to the local state
        // to provide a real-time feel without setting up a listener.
        if (newNotification.userId === currentUser?.id) {
            notifications.unshift(newNotification);
            renderApp();
        }
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const markNotificationRead = async (notificationId) => {
    try {
        await updateDocument('notifications', notificationId, { isRead: true });
        const note = notifications.find(n => n.id === notificationId);
        if (note) note.isRead = true;
        renderApp();
    } catch (error) {
        console.error("Failed to mark notification as read:", error);
    }
};

const markAllNotificationsRead = async () => {
    try {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length === 0) return;

        const batch = writeBatch(getFirestore()); // Need to get db instance here or pass it
        unreadIds.forEach(id => {
            batch.update(doc(getFirestore(), 'notifications', id), { isRead: true });
        });
        await batch.commit();

        notifications.forEach(n => { if (!n.isRead) n.isRead = true; });
        renderApp();
    } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
    }
};

const clearAllNotifications = async () => {
    if (!confirm('Are you sure you want to delete all your notifications? This cannot be undone.')) return;
    try {
        const userNotifications = notifications.filter(n => n.userId === currentUser.id);
        const batch = writeBatch(getFirestore());
        userNotifications.forEach(n => {
            batch.delete(doc(getFirestore(), 'notifications', n.id));
        });
        await batch.commit();
        notifications = notifications.filter(n => n.userId !== currentUser.id);
        renderApp();
    } catch(error) {
        console.error("Failed to clear notifications:", error);
    }
};

// --- Handler Functions ---

// Project handlers
const addProject = async (project) => {
  try {
    const { id, ...data } = project;
    await setDocument('projects', id, data);
    projects.push(project);
    
    // Create notifications for assignees
    for (const assigneeId of project.assignees) {
        if (assigneeId !== currentUser.id) { // Don't notify user for their own action
            await createNotification({
                userId: assigneeId,
                title: 'New Project Assigned',
                message: `You have been assigned to the new project: <strong>${project.name}</strong>.`,
                type: 'project',
                link: `view=projects&projectId=${project.id}`
            });
        }
    }
    renderApp();
  } catch (error) {
    console.error("Failed to add project:", error);
    alert("Error: Could not save the new project to the database.");
  }
};

const updateProject = async (updatedProject) => {
  try {
    const originalProject = projects.find(p => p.id === updatedProject.id);
    if (!originalProject) return;

    if (originalProject.status !== ProjectStatus.Done && updatedProject.status === ProjectStatus.Done) {
        updatedProject.completionDate = new Date().toISOString();
    }

    const { id, ...data } = updatedProject;
    await updateDocument('projects', id, data);
    projects = projects.map(p => p.id === id ? updatedProject : p);
    
    // Notify newly added assignees
    const originalAssignees = new Set(originalProject.assignees || []);
    const newAssignees = updatedProject.assignees || [];
    for (const assigneeId of newAssignees) {
        if (!originalAssignees.has(assigneeId) && assigneeId !== currentUser.id) {
            await createNotification({
                userId: assigneeId,
                title: 'Assigned to Project',
                message: `You have been assigned to the project: <strong>${updatedProject.name}</strong>.`,
                type: 'project',
                link: `view=projects&projectId=${updatedProject.id}`
            });
        }
    }

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

    const projectUpdatePromises = projectsToUpdate.map(p => {
        const { id, ...data } = p;
        return updateDocument('projects', id, data);
    });
    await Promise.all(projectUpdatePromises);

    await deleteByQuery('attendance', 'memberId', memberId);
    await deleteByQuery('worklogs', 'memberId', memberId);
    await deleteByQuery('notifications', 'userId', memberId); // Also delete notifications
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

// Settings handler
const updateSettings = async (newSettings) => {
    try {
        await setDocument('settings', 'app_config', newSettings);
        settings = newSettings;
        renderApp();
    } catch(error) {
        console.error("Failed to update settings:", error);
        alert("Error: Could not save settings.");
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
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      stakeholderName: p.stakeholderName || '',
      teamLeadId: p.teamLeadId || '',
      projectType: p.projectType || '',
      projectCategory: p.projectCategory || '',
      goals: p.goals ? JSON.stringify(p.goals) : '[]',
      mediaProduct: p.mediaProduct || '',
      pilotScope: p.pilotScope || '',
      clientNames: p.clientNames || '',
      projectApproach: p.projectApproach || '',
      deliverables: p.deliverables || '',
      resultsAchieved: p.resultsAchieved || '',
      completionDate: p.completionDate || '',
      completionPercentage: p.completionPercentage || 0,
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
    exportToCSV(teamMembers, 'team_members.csv');
  } else if (dataType === 'notes') {
    const notesToExport = notes.map(n => ({
        ...n,
        tags: n.tags ? n.tags.join(';') : '',
    }));
    exportToCSV(notesToExport, 'notes.csv');
  } else if (dataType === 'worklogs') {
    const logsToExport = workLogs.map(log => {
        const member = teamMembers.find(m => m.id === log.memberId);
        const project = projects.find(p => p.id === log.projectId);
        return {
            id: log.id,
            date: log.date,
            memberName: member?.name || 'Unknown',
            projectName: project?.name || 'Unknown',
            taskName: log.taskName,
            requestedFrom: log.requestedFrom,
            timeSpentMinutes: log.timeSpentMinutes,
            comments: log.comments || '',
        };
    });
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
    let importErrors = []; // For detailed error feedback

    if (dataType === 'projects') {
        collectionName = 'projects';
        processedData = data.map(item => {
            if (!item.id || !item.name || !item.status || !item.dueDate) return null;
            
            const goals = Array.isArray(item.goals) ? item.goals : JSON.parse(item.goals || '[]');
            const totalGoals = goals.length;
            const completedGoals = goals.filter(g => g.completed).length;
            const completionPercentage = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

            return {
              ...item,
              assignees: Array.isArray(item.assignees) ? item.assignees : (item.assignees || '').split(';').map(s=>s.trim()).filter(Boolean),
              tags: Array.isArray(item.tags) ? item.tags : (item.tags || '').split(';').map(s=>s.trim()).filter(Boolean),
              goals: goals,
              stakeholderName: item.stakeholderName || '',
              mediaProduct: item.mediaProduct || '',
              pilotScope: item.pilotScope || '',
              clientNames: item.clientNames || '',
              projectApproach: item.projectApproach || '',
              deliverables: item.deliverables || '',
              resultsAchieved: item.resultsAchieved || '',
              completionDate: item.completionDate || null,
              completionPercentage: completionPercentage,
            };
        }).filter(Boolean);
    } else if (dataType === 'attendance') {
        collectionName = 'attendance';
        processedData = data.map((item, index) => {
            const rowNum = index + 2;
            if (!item.date || !item.memberName || !item.status) {
                importErrors.push(`Row ${rowNum}: Missing required data (date, memberName, status).`);
                return null;
            }
            const member = teamMembers.find(m => m.name.trim().toLowerCase() === item.memberName.trim().toLowerCase());
            if (!member) {
                importErrors.push(`Row ${rowNum}: Could not find a team member named "${item.memberName}".`);
                return null;
            }

            return {
                id: item.id || `${member.id}-${item.date}`,
                date: item.date,
                memberId: member.id,
                status: item.status,
                leaveType: item.leaveType || null,
                notes: item.notes || '',
            };
        }).filter(Boolean);
    } else if (dataType === 'team') {
        collectionName = 'teamMembers';
        processedData = data.map(item => {
            if (!item.id || !item.name) return null;
            // Remove password property if it exists from imported data
            const { password, ...memberData } = item;
            return memberData;
        }).filter(Boolean);
        if ((teamMembers.length + processedData.length) > 20) {
           alert("Import would exceed the 20 team member limit. Please adjust your CSV file.");
           return;
        }
    } else if (dataType === 'notes') {
        collectionName = 'notes';
        processedData = data.map(item => {
           if (!item.id || !item.title || !item.content || !item.status || !item.color) return null;
            return {
                ...item,
                tags: Array.isArray(item.tags) ? item.tags : (item.tags || '').split(';').map(s => s.trim()).filter(Boolean),
            };
        }).filter(Boolean);
    } else if (dataType === 'worklogs') {
        collectionName = 'worklogs';
        processedData = data.map((item, index) => {
            const rowNum = index + 2;
            if (!item.date || !item.memberName || !item.projectName || item.timeSpentMinutes === undefined) {
                importErrors.push(`Row ${rowNum}: Missing required columns (date, memberName, projectName, timeSpentMinutes).`);
                return null;
            }

            let normalizedDate = item.date;
            const dateParts = String(item.date).split('-');
            if (dateParts.length === 3 && dateParts[0].length === 2 && dateParts[2].length === 4) {
                 normalizedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }

            const member = teamMembers.find(m => m.name.trim().toLowerCase() === item.memberName.trim().toLowerCase());
            if (!member) {
                importErrors.push(`Row ${rowNum}: Could not find a member named "${item.memberName}". Check for typos.`);
                return null;
            }
            
            const project = projects.find(p => p.name.trim().toLowerCase() === item.projectName.trim().toLowerCase());
            if (!project) {
                importErrors.push(`Row ${rowNum}: Could not find a project named "${item.projectName}". Check for typos.`);
                return null;
            }
            
            const now = new Date().toISOString();
            return {
                id: item.id || crypto.randomUUID(),
                date: normalizedDate,
                memberId: member.id,
                projectId: project.id,
                taskName: item.taskName || 'N/A',
                requestedFrom: item.requestedFrom || 'N/A',
                timeSpentMinutes: Number(item.timeSpentMinutes) || 0,
                comments: item.comments || '',
                createdAt: item.createdAt || now,
                updatedAt: now,
            };
        }).filter(Boolean);
    }
    
    if (importErrors.length > 0) {
        const errorLimit = 10;
        const fullErrorMessage = `Import failed. ${importErrors.length} rows had errors.\n\nPlease check your CSV file. Common issues are incorrect member/project names or missing data.\n\nFirst ${Math.min(importErrors.length, errorLimit)} errors:\n- ${importErrors.slice(0, errorLimit).join('\n- ')}`;
        alert(fullErrorMessage);
        return;
    }

    if (collectionName && processedData.length > 0) {
        await batchWrite(collectionName, processedData);
        await loadInitialData(false);
        renderApp();
        alert(`${processedData.length} ${dataType} records imported successfully!`);
    } else {
        alert(`No valid data rows found in the CSV to import for ${dataType}.`);
    }
  } catch (error) {
    console.error("Import error:", error);
    alert(`Failed to import ${dataType} data. Please check the console for details and ensure the CSV format is correct.`);
  }
};


function handleNavChange(view, params = {}) {
  currentView = view;
  sessionStorage.setItem('currentView', view);
  renderApp(params); // Pass params to renderApp
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
        currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle,
        currentUser, onLogout: handleLogout,
        notifications, onMarkNotificationRead: markNotificationRead, onMarkAllNotificationsRead: markAllNotificationsRead, onClearAllNotifications: clearAllNotifications
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


function renderApp(params = {}) {
  if (!rootElement) {
    console.error("Root or main content element not initialized for rendering.");
    return;
  }
  
  if (!currentUser) {
      rootElement.innerHTML = '';
      renderLoginPage(rootElement, { onLogin: handleLogin, teamMembers });
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


  mainContentElement.innerHTML = '';

  if (currentView === 'dashboard') {
    renderDashboardPage(mainContentElement, {
        currentUser, teamMembers, projects: pageProjects, notes: pageNotes, workLogs: pageWorkLogs,
        attendanceRecords: pageAttendance, projectStatuses: Object.values(ProjectStatus),
        onAddProject: addProject, onAddNote: addNote, onAddMultipleWorkLogs: addMultipleWorkLogs,
        onNavChange: handleNavChange,
    });
  } else if (currentView === 'projects') {
    renderProjectsPage(mainContentElement, {
      projects: pageProjects, teamMembers, currentUser, projectStatuses: Object.values(ProjectStatus),
      onAddProject: addProject, onUpdateProject: updateProject, onDeleteProject: deleteProject,
      onExport: () => handleExport('projects'), onImport: (file) => handleImport(file, 'projects'),
      openProjectWithId: params.projectId, // Pass projectId from nav change
    });
  } else if (currentView === 'attendance') {
    renderAttendancePage(mainContentElement, {
      attendanceRecords: pageAttendance, teamMembers, currentUser, projects,
      attendanceStatuses: Object.values(AttendanceStatus), leaveTypes: Object.values(LeaveType),
      onUpsertAttendanceRecord: upsertAttendanceRecord, onDeleteAttendanceRecord: deleteAttendanceRecord,
      onExport: () => handleExport('attendance'), onImport: (file) => handleImport(file, 'attendance'),
      maxTeamMembers: 20, onAddTeamMember: addTeamMember, onUpdateTeamMember: updateTeamMember,
      onDeleteTeamMember: deleteTeamMember, onExportTeam: () => handleExport('team'),
      onImportTeam: (file) => handleImport(file, 'team'),
    });
  } else if (currentView === 'notes') {
    renderNotesPage(mainContentElement, {
        notes: pageNotes, currentUser, noteStatuses: Object.values(NoteStatus),
        onAddNote: addNote, onUpdateNote: updateNote, onDeleteNote: deleteNote,
        onExport: () => handleExport('notes'), onImport: (file) => handleImport(file, 'notes'),
    });
  } else if (currentView === 'worklog') {
    renderWorkLogPage(mainContentElement, {
        workLogs: pageWorkLogs, teamMembers, projects, currentUser,
        onAddMultipleWorkLogs: addMultipleWorkLogs, onUpdateWorkLog: updateWorkLog,
        onDeleteWorkLog: deleteWorkLog, onExport: () => handleExport('worklogs'),
        onImport: (file) => handleImport(file, 'worklogs'),
        appSettings: settings,
    });
  } else if (currentView === 'settings' && currentUser.role === TeamMemberRole.Manager) {
    renderSettingsPage(mainContentElement, {
        settings,
        onUpdateSettings: updateSettings,
    });
  }
  
  const navbarElement = rootElement.querySelector('nav.navbar');
  if (navbarElement) {
      const newNavbar = Navbar({ 
          currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle,
          currentUser, onLogout: handleLogout,
          notifications, onMarkNotificationRead: markNotificationRead, onMarkAllNotificationsRead: markAllNotificationsRead, onClearAllNotifications: clearAllNotifications
      });
      navbarElement.replaceWith(newNavbar);
  }
}

async function loadGlobalData() {
    const [projectData, attendanceData, notesData, workLogData, settingsDocSnap] = await Promise.all([
        getCollection('projects'),
        getCollection('attendance'),
        getCollection('notes'),
        getCollection('worklogs'),
        getDoc(doc(getFirestore(), 'settings', 'app_config')),
    ]);
    
    projects = projectData;
    attendance = attendanceData;
    notes = notesData;
    workLogs = workLogData;
    
    if (settingsDocSnap.exists()) {
        settings = settingsDocSnap.data();
    } else {
        // If settings don't exist, create them with defaults
        console.log("No settings found in DB, creating with defaults.");
        const defaultSettings = { workLogTasks: [...DEFAULT_WORK_LOG_TASKS] };
        await setDocument('settings', 'app_config', defaultSettings);
        settings = defaultSettings;
    }
}

async function loadUserSpecificData() {
    if (!currentUser) {
        notifications = [];
        return;
    }
    const userNotifications = await getCollection('notifications', where('userId', '==', currentUser.id));
    notifications = userNotifications.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}


async function loadInitialData(seedIfEmpty = true) {
  try {
    // Team Members must be loaded first to determine login status
    let teamMemberData = await getCollection('teamMembers');

    if (seedIfEmpty && teamMemberData.length === 0) {
        console.log("No team members found in database. Seeding with initial data.");
        await batchWrite('teamMembers', INITIAL_TEAM_MEMBERS);
        teamMembers = await getCollection('teamMembers'); 
    } else {
        teamMembers = teamMemberData;
    }

    teamMembers.forEach(m => {
        if (!m.role) m.role = TeamMemberRole.Member;
    });

    await loadGlobalData();

    const firstManager = teamMembers.find(m => m.role === TeamMemberRole.Manager);
    const defaultOwnerId = (firstManager || teamMembers[0])?.id;

    if (defaultOwnerId) {
        const notesWithoutOwner = notes.filter(n => !n.userId);
        if (notesWithoutOwner.length > 0) {
            console.log(`Migrating ${notesWithoutOwner.length} notes to have an owner...`);
            const notesToUpdate = notesWithoutOwner.map(n => ({...n, userId: defaultOwnerId }));
            await batchWrite('notes', notesToUpdate);
            notes = await getCollection('notes');
        }
    }

  } catch (error) {
    console.error("Failed to load initial data from Firestore:", error);
    rootElement.innerHTML = `<div class="firebase-config-error-container">
            <h1><i class="fas fa-exclamation-triangle"></i> Data Loading Error</h1>
            <p>The application could not load data from the database.</p>
            <p>This might be due to a network issue or incorrect Firebase security rules.</p>
            <p>Please check your internet connection and ensure your Firestore security rules are correctly set up to allow reads.</p>
            <p class="error-message"><strong>Original Error:</strong> ${error.message}</p>
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
    if(currentUser) await loadUserSpecificData();
  }

  renderApp();
}
