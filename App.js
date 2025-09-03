import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderWorkLogPage } from './pages/WorkLogPage.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { renderAdminPage } from './pages/AdminPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS, WORK_LOG_TASKS, PRIORITIES, INITIAL_INTERNAL_TEAMS, INITIAL_HOLIDAYS, INITIAL_LEAVE_TYPES, MEMBER_COLORS } from './constants.js';
import { getCollection, setDocument, updateDocument, deleteDocument, batchWrite, deleteByQuery, addDocument, batchDelete } from './services/firebaseService.js';
import { exportToCSV as exportDataToCSV, importFromCSV } from './services/csvService.js';
import { ProjectStatus, AttendanceStatus, NoteStatus, TeamMemberRole, EmployeeStatus } from './types.js'; // Enums
import { formatDateToIndian, parseIndianDate } from './utils.js';

let rootElement;
let mainContentElement;

// State
let currentView = sessionStorage.getItem('currentView') || 'dashboard';
let projects = [];
let attendance = [];
let notes = [];
let teamMembers = [];
let workLogs = [];
let activities = []; // New state for activities like login
let currentUser = null; // Start as null, will be set on login
let appSettings = {}; // For dynamic app name, logo, etc.

// --- Login/Logout Handlers ---

const handleLogin = async (member) => {
    currentUser = member;
    sessionStorage.setItem('currentUserId', member.id);
    
    // Track login activity
    try {
        const activity = {
            type: 'login',
            userId: member.id,
            timestamp: new Date().toISOString(),
        };
        const activityId = await addDocument('activities', activity);
        // Add to local state to avoid a full reload
        activities.push({
            ...activity,
            id: activityId,
        });
    } catch (error) {
        console.error("Failed to log login activity:", error);
    }

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

const updateAppSettings = async (newSettings) => {
  try {
    // Before saving, ensure any base64 logo is handled if needed, or just save the URL/data URI
    await setDocument('appSettings', 'main_config', newSettings);
    appSettings = newSettings;
    renderApp();
    alert('Settings saved successfully!');
  } catch (error) {
    console.error("Failed to save settings:", error);
    alert("Error: Could not save settings to the database.");
  }
};

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
        // Create an activity for project completion
        const activity = {
            type: 'project_completed',
            userId: currentUser.id, // User who marked it as done
            timestamp: updatedProject.completionDate,
            details: {
                projectName: updatedProject.name,
                assigneeIds: updatedProject.assignees || []
            }
        };
        const activityId = await addDocument('activities', activity);
        activities.push({ ...activity, id: activityId });
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

        // Also create activity entries for the feed
        const activityPromises = processedLogs.map(log => {
            const activity = {
                type: 'worklog_add',
                userId: log.memberId,
                timestamp: now,
                details: {
                    projectId: log.projectId,
                    timeSpentMinutes: log.timeSpentMinutes
                }
            };
            return addDocument('activities', activity).then(id => activities.push({ ...activity, id }));
        });
        await Promise.all(activityPromises);
        
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

const bulkDeleteWorkLogs = async (workLogIds) => {
    if (!workLogIds || workLogIds.length === 0) {
        alert("No logs selected for deletion.");
        return;
    }
    try {
        await batchDelete('worklogs', workLogIds);

        const idsToDelete = new Set(workLogIds);
        workLogs = workLogs.filter(wl => !idsToDelete.has(wl.id));
        
        renderApp();
        alert(`${workLogIds.length} work log${workLogIds.length > 1 ? 's' : ''} deleted successfully.`);
    } catch (error) {
        console.error("Failed to bulk delete work logs:", error);
        alert("Error: Could not delete the work logs from the database.");
    }
};


// Team Member handlers
const addTeamMember = async (member) => {
  const maxMembers = appSettings.maxTeamMembers || 20;
  if (teamMembers.length >= maxMembers) {
    alert(`Team size cannot exceed the maximum of ${maxMembers} members.`);
    return;
  }
  try {
    const memberWithDefaults = {
      ...member,
      status: member.status || EmployeeStatus.Active,
    };
    const { id, ...data } = memberWithDefaults;
    await setDocument('teamMembers', id, data);
    teamMembers.push(memberWithDefaults);
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
    await deleteDocument('teamMembers', memberId);
    
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
    alert("Failed to delete member and all associated data. The data may be in an inconsistent state. Please reload the page.");
    await loadInitialData(false);
    renderApp();
  }
};

// CSV Handlers
const handleExport = (dataType, dataToExport = null) => {
  if (dataType === 'projects') {
    const projectsToExport = (dataToExport || projects).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      status: p.status,
      assignees: (p.assignees || []).join(';'), // Use semicolon for multi-value fields
      dueDate: formatDateToIndian(p.dueDate),
      priority: p.priority || '',
      tags: (p.tags || []).join(';'),
      createdAt: formatDateToIndian(p.createdAt),
      updatedAt: formatDateToIndian(p.updatedAt),
      stakeholderName: p.stakeholderName || '',
      teamLeadId: p.teamLeadId || '',
      projectType: p.projectType || '',
      projectCategory: p.projectCategory || '',
      // Skipping complex fields like goals for CSV export simplicity
    }));
    exportDataToCSV(projectsToExport, 'projects.csv');
  } else if (dataType === 'attendance') {
    const attendanceToExport = (dataToExport || attendance).map(a => ({
      id: a.id,
      date: formatDateToIndian(a.date),
      memberId: a.memberId,
      status: a.status,
      leaveType: a.leaveType || '',
      notes: a.notes || '',
    }));
    exportDataToCSV(attendanceToExport, 'attendance.csv');
  } else if (dataType === 'notes') {
    const userNotesToExport = (dataToExport || notes.filter(note => note.userId === currentUser.id));
    const notesToExport = userNotesToExport.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        status: n.status,
        dueDate: formatDateToIndian(n.dueDate),
        tags: (n.tags || []).join(';'),
        color: n.color,
        createdAt: formatDateToIndian(n.createdAt),
        updatedAt: formatDateToIndian(n.updatedAt),
      }));
    exportDataToCSV(notesToExport, 'notes.csv');
  } else if (dataType === 'worklogs') {
    // Create lookup maps for efficiency
    const taskCategoryMap = new Map((appSettings.workLogTasks || []).map(task => [task.name, task.category]));
    const memberNameMap = new Map(teamMembers.map(member => [member.id, member.name]));
    const projectNameMap = new Map(projects.map(project => [project.id, project.name]));
    
    const logsForProcessing = dataToExport 
        ? dataToExport 
        : (currentUser.role === TeamMemberRole.Manager ? workLogs : workLogs.filter(wl => wl.memberId === currentUser.id));

    const logsToExportCSV = logsForProcessing.map(wl => {
        const category = taskCategoryMap.get(wl.taskName) || 'Uncategorized';
        const memberName = memberNameMap.get(wl.memberId) || 'Unknown Member';
        const projectName = projectNameMap.get(wl.projectId) || 'Unknown Project';

        return {
            date: formatDateToIndian(wl.date),
            member_name: memberName,
            project_name: projectName,
            task_category: category,
            taskName: wl.taskName,
            timeSpentMinutes: wl.timeSpentMinutes,
            comments: wl.comments || '',
            requestedFrom: wl.requestedFrom || '',
            id: wl.id,
            memberId: wl.memberId,
            projectId: wl.projectId,
            createdAt: formatDateToIndian(wl.createdAt),
            updatedAt: formatDateToIndian(wl.updatedAt),
        };
      });
    exportDataToCSV(logsToExportCSV, 'worklogs.csv');
  } else if (dataType === 'team') {
    const teamToExport = (dataToExport || teamMembers).map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      mobileNumber: m.mobileNumber || '',
      employeeId: m.employeeId || '',
      joinDate: formatDateToIndian(m.joinDate),
      birthDate: formatDateToIndian(m.birthDate),
      designation: m.designation || '',
      department: m.department || '',
      company: m.company || '',
      role: m.role,
      internalTeam: m.internalTeam || '',
    }));
    exportDataToCSV(teamToExport, 'team.csv');
  } else if (dataType === 'worklogtasks') {
    const tasksToExport = (dataToExport || appSettings.workLogTasks).map(t => ({
        id: t.id,
        'Task Name': t.name,
        Category: t.category,
        'Assigned Teams': (t.teams || []).join(','),
    }));
    exportDataToCSV(tasksToExport, 'work_log_tasks.csv');
  }
};

const handleImport = async (file, dataType) => {
  if (!file) return;
  try {
    let importedData = await importFromCSV(file);
    if (!importedData || importedData.length === 0) {
      alert("CSV file is empty or invalid.");
      return;
    }
    
    // For most data types, an ID is required to prevent duplicates.
    // We make an exception for 'worklogs' as requested.
    if (dataType !== 'worklogs' && !importedData.every(item => item.id)) {
        alert(`Import failed: Each row in the CSV must have a unique 'id' column for ${dataType}.`);
        return;
    }

    let collectionName = '';
    if (dataType === 'projects') {
        collectionName = 'projects';
        // Convert semicolon-separated strings back to arrays and parse dates
        importedData = importedData.map(p => ({
            ...p,
            assignees: typeof p.assignees === 'string' ? p.assignees.split(';').filter(Boolean) : [],
            tags: typeof p.tags === 'string' ? p.tags.split(';').filter(Boolean) : [],
            dueDate: parseIndianDate(p.dueDate),
            createdAt: parseIndianDate(p.createdAt),
            updatedAt: parseIndianDate(p.updatedAt),
        }));
    } else if (dataType === 'attendance') {
        collectionName = 'attendance';
        importedData = importedData.map(a => ({ ...a, date: parseIndianDate(a.date) }));
    } else if (dataType === 'notes') {
        collectionName = 'notes';
        importedData = importedData.map(note => ({
            ...note,
            userId: currentUser.id,
            tags: typeof note.tags === 'string' ? note.tags.split(';').filter(Boolean) : [],
            dueDate: parseIndianDate(note.dueDate),
            createdAt: parseIndianDate(note.createdAt),
            updatedAt: parseIndianDate(note.updatedAt),
        }));
    } else if (dataType === 'worklogs') {
        collectionName = 'worklogs';
        // As requested, automatically generate IDs for work logs if they are missing.
        // Also ensure timeSpentMinutes is a number and dates are parsed.
        importedData = importedData.map(log => ({
            ...log,
            id: log.id || crypto.randomUUID(),
            timeSpentMinutes: Number(log.timeSpentMinutes) || 0,
            date: parseIndianDate(log.date),
            createdAt: parseIndianDate(log.createdAt),
            updatedAt: parseIndianDate(log.updatedAt),
        }));
    } else if (dataType === 'team') {
        collectionName = 'teamMembers';
        importedData = importedData.map(m => ({
            ...m,
            joinDate: parseIndianDate(m.joinDate),
            birthDate: parseIndianDate(m.birthDate),
        }));
    } else {
        alert("Unknown data type for import.");
        return;
    }
    
    await batchWrite(collectionName, importedData);
    alert(`${importedData.length} records imported successfully to ${collectionName}. The app will now reload.`);
    
    await loadInitialData(false); // don't seed data on import
    renderApp();

  } catch (error) {
    console.error(`Error importing ${dataType} CSV:`, error);
    alert(`An error occurred during the CSV import: ${error.message}`);
  }
};

const renderApp = () => {
  if (!rootElement) return;

  document.title = appSettings.appName || 'TeamSync';
  const faviconLink = document.querySelector("link[rel~='icon']");
  if (faviconLink) {
    faviconLink.href = appSettings.appLogoUrl || `data:image/svg+xml,%3csvg width='64' height='64' viewBox='0 0 64 64' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='64' height='64' rx='12' fill='%234F46E5'/%3e%3cpath d='M20.5 22H31.5' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3e%3cpath d='M26 22V42' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3e%3cpath d='M43 22C43 22 39 22 39 26C39 30 43 30 43 34C43 38 39 38 39 42' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e`;
  }
  
  rootElement.innerHTML = '';
  rootElement.removeAttribute('class'); 

  if (!currentUser) {
    renderLoginPage(rootElement, { onLogin: handleLogin, teamMembers, appSettings });
    return;
  }
  
  mainContentElement = document.createElement('main');
  mainContentElement.className = 'main-content';
  
  const userNotes = notes.filter(note => note.userId === currentUser.id);
  
  const props = {
    projects, teamMembers, attendanceRecords: attendance, notes: userNotes, workLogs, currentUser, appSettings, activities,
    projectStatuses: Object.values(ProjectStatus),
    attendanceStatuses: Object.values(AttendanceStatus),
    leaveTypes: appSettings.leaveTypes || [],
    noteStatuses: Object.values(NoteStatus),
    maxTeamMembers: appSettings.maxTeamMembers || 20,
    workLogTasks: appSettings.workLogTasks || [],
    internalTeams: appSettings.internalTeams || [],
    holidays: appSettings.holidays || [],
    onAddProject: addProject, onUpdateProject: updateProject, onDeleteProject: deleteProject,
    onUpsertAttendanceRecord: upsertAttendanceRecord, onDeleteAttendanceRecord: deleteAttendanceRecord,
    onAddNote: addNote, onUpdateNote: updateNote, onDeleteNote: deleteNote,
    onAddMultipleWorkLogs: addMultipleWorkLogs, onUpdateWorkLog: updateWorkLog, onDeleteWorkLog: deleteWorkLog, onBulkDeleteWorkLogs: bulkDeleteWorkLogs,
    onAddTeamMember: addTeamMember, onUpdateTeamMember: updateTeamMember, onDeleteTeamMember: deleteTeamMember,
    onUpdateSettings: updateAppSettings,
    onExport: handleExport, onImport: handleImport,
    onExportTeam: () => handleExport('team'), onImportTeam: (file) => handleImport(file, 'team'),
  };

  const onNavChange = (view) => {
    currentView = view;
    sessionStorage.setItem('currentView', view);
    renderApp();
  };

  const onThemeToggle = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    renderApp();
  };

  rootElement.appendChild(Navbar({ currentView, onNavChange, onThemeToggle, currentUser, onLogout: handleLogout, appSettings }));
  rootElement.appendChild(mainContentElement);
  
  switch (currentView) {
    case 'dashboard': renderDashboardPage(mainContentElement, props); break;
    case 'projects': renderProjectsPage(mainContentElement, props); break;
    case 'attendance': renderAttendancePage(mainContentElement, props); break;
    case 'notes': renderNotesPage(mainContentElement, props); break;
    case 'worklog': renderWorkLogPage(mainContentElement, props); break;
    case 'admin': 
        if (currentUser.role === TeamMemberRole.Manager) {
            renderAdminPage(mainContentElement, props);
        } else {
            currentView = 'dashboard';
            sessionStorage.setItem('currentView', 'dashboard');
            renderDashboardPage(mainContentElement, props);
        }
        break;
    default: renderDashboardPage(mainContentElement, props); break;
  }
};

const loadInitialData = async (seedDataIfEmpty = true) => {
  const loadingContainer = document.querySelector('.loading-container');
  if (loadingContainer) loadingContainer.style.display = 'flex';

  try {
    const [fetchedProjects, fetchedAttendance, fetchedNotes, fetchedMembers, fetchedWorkLogs, fetchedSettings, fetchedActivities] = await Promise.all([
      getCollection('projects'),
      getCollection('attendance'),
      getCollection('notes'),
      getCollection('teamMembers'),
      getCollection('worklogs'),
      getCollection('appSettings'),
      getCollection('activities'),
    ]);

    projects = fetchedProjects;
    attendance = fetchedAttendance;
    notes = fetchedNotes;
    teamMembers = fetchedMembers;
    workLogs = fetchedWorkLogs;
    activities = fetchedActivities;

    // --- Data Migration & Defaulting Logic ---
    if (fetchedSettings.length > 0) {
        appSettings = fetchedSettings.find(s => s.id === 'main_config') || {};
    }

    let settingsModified = false;
    const defaultSettings = {
        appName: 'TeamSync',
        appLogoUrl: '',
        workLogTasks: WORK_LOG_TASKS,
        internalTeams: INITIAL_INTERNAL_TEAMS,
        holidays: INITIAL_HOLIDAYS,
        leaveTypes: INITIAL_LEAVE_TYPES,
        maxTeamMembers: 20,
        welcomeMessage: 'Welcome back,',
        defaultProjectPriority: 'Medium',
        defaultTheme: 'User Choice',
        primaryColor: '#4F46E5',
        primaryColorHover: '#4338CA',
    };

    // Check for missing keys and add defaults
    for (const key in defaultSettings) {
        if (appSettings[key] === undefined) {
            appSettings[key] = defaultSettings[key];
            settingsModified = true;
        }
    }
    
    // Special check to migrate old string-based workLogTasks
    if (Array.isArray(appSettings.workLogTasks) && appSettings.workLogTasks.length > 0 && typeof appSettings.workLogTasks[0] === 'string') {
        appSettings.workLogTasks = defaultSettings.workLogTasks; // Reset to default object structure
        settingsModified = true;
    }
    
    // If settings were ever missing or outdated, save them back. This covers both seeding and migration.
    if (settingsModified) {
        console.log("App settings were missing or outdated. Applying defaults/migrations and saving...");
        await setDocument('appSettings', 'main_config', appSettings);
    }
    
    // Seed team members only if the collection is empty AND we are allowed to seed.
    if (seedDataIfEmpty && teamMembers.length === 0) {
        console.log("No team members found. Seeding initial data...");
        await batchWrite('teamMembers', INITIAL_TEAM_MEMBERS);
        teamMembers = await getCollection('teamMembers');
    }
    
    // --- Assign consistent colors to team members ---
    teamMembers.forEach((member, index) => {
        member.color = MEMBER_COLORS[index % MEMBER_COLORS.length];
    });

    const currentUserId = sessionStorage.getItem('currentUserId');
    if (currentUserId) {
        currentUser = teamMembers.find(m => m.id === currentUserId) || null;
    }
    
    // --- Apply dynamic theme and colors ---
    const rootStyle = document.documentElement.style;
    if (appSettings.primaryColor) rootStyle.setProperty('--color-primary', appSettings.primaryColor);
    if (appSettings.primaryColorHover) rootStyle.setProperty('--color-primary-hover', appSettings.primaryColorHover);

    const theme = appSettings.defaultTheme || 'User Choice';
    if (theme === 'Dark') {
        document.documentElement.classList.add('dark');
    } else if (theme === 'Light') {
        document.documentElement.classList.remove('dark');
    } else { // User Choice
        if (localStorage.getItem('theme') === 'dark' || 
           (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
    }


  } catch (error) {
    console.error("Failed to load initial data:", error);
    document.body.innerHTML = `<div class="firebase-config-error-container">
            <h1><i class="fas fa-exclamation-triangle"></i> Data Loading Error</h1>
            <p>Could not load application data from the database. Please check your network connection and Firebase security rules.</p>
            <p class="error-message"><strong>Error:</strong> ${error.message}</p>
        </div>`;
    throw error;
  } finally {
      if (loadingContainer) loadingContainer.style.display = 'none';
  }
};

export const initializeApp = async (element) => {
  rootElement = element;
  
  rootElement.innerHTML = `<div class="loading-container">
      <div class="spinner"></div>
      <p>Loading application data...</p>
    </div>`;

  await loadInitialData();
  renderApp();
};
