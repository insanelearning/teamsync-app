

import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderWorkLogPage } from './pages/WorkLogPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS } from './constants.js';
import { getCollection, setDocument, updateDocument, deleteDocument, batchWrite, deleteByQuery } from './services/firebaseService.js';
import { exportToCSV, importFromCSV } from './services/csvService.js';
import { ProjectStatus, AttendanceStatus, LeaveType, NoteStatus, TeamMemberRole } from './types.js'; // Enums

let rootElement;
let mainContentElement;

// State - these are now local caches of the Firestore data.
let currentView = localStorage.getItem('currentView') || 'dashboard';
let projects = [];
let attendance = [];
let notes = [];
let teamMembers = [];
let workLogs = [];
let currentUser = null;
let isSwitchingUser = false; // Added for loading state

// --- Handler Functions ---

const setCurrentUser = async (userId) => {
    const memberName = teamMembers.find(m => m.id === userId)?.name || 'user';
    isSwitchingUser = true;
    renderApp(memberName); // Pass name for loading message

    // Small delay for UX, makes the change feel more tangible
    await new Promise(resolve => setTimeout(resolve, 250));

    currentUser = teamMembers.find(m => m.id === userId) || teamMembers[0];
    localStorage.setItem('currentUserId', currentUser.id);

    isSwitchingUser = false;
    renderApp();
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
    const { id, ...data } = note;
    await setDocument('notes', id, data);
    notes.push(note);
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
    teamMembers = teamMembers.map(m => m.id === id ? updatedMember : m);
    // If the currently viewed user was updated, update the currentUser object
    if (currentUser && currentUser.id === id) {
        currentUser = updatedMember;
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

    // 6. Reset current user if they were deleted
    if (currentUser && currentUser.id === memberId) {
        setCurrentUser(teamMembers[0]?.id || null);
    }
    
    renderApp();

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
        processedData = data.filter(item => item.id && item.name);
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

            // --- Date Normalization Fix ---
            let normalizedDate = item.date;
            const dateParts = String(item.date).split('-');
            if (dateParts.length === 3 && dateParts[0].length === 2 && dateParts[2].length === 4) {
                 // It's likely DD-MM-YYYY, convert to YYYY-MM-DD for consistent filtering
                 normalizedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
            // --- End of Fix ---

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
                date: normalizedDate, // Use the normalized date
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


function handleNavChange(view) {
  currentView = view;
  localStorage.setItem('currentView', view);
  renderApp();
}

function handleThemeToggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.body.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    renderApp(); // Re-render to update navbar icon if needed
}

function renderApp(loadingForUser) {
  if (!rootElement || !mainContentElement) {
    console.error("Root or main content element not initialized for rendering.");
    return;
  }
  
  // Handle user switching loading state
  if (isSwitchingUser) {
      mainContentElement.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading ${loadingForUser}'s Data...</p></div>`;
      const navbarElement = rootElement.querySelector('nav.navbar');
      if (navbarElement) {
          const newNavbar = Navbar({ 
              currentView, 
              onNavChange: handleNavChange, 
              onThemeToggle: handleThemeToggle,
              currentUser,
              teamMembers,
              onSetCurrentUser: setCurrentUser,
              isSwitchingUser: true
          });
          navbarElement.replaceWith(newNavbar);
      }
      return;
  }


  mainContentElement.innerHTML = '';

  if (currentView === 'dashboard') {
    renderDashboardPage(mainContentElement, {
        currentUser,
        teamMembers,
        projects,
        notes,
        workLogs,
        attendanceRecords: attendance,
        projectStatuses: Object.values(ProjectStatus),
        onAddProject: addProject,
        onAddNote: addNote,
        onAddMultipleWorkLogs: addMultipleWorkLogs,
        onNavChange: handleNavChange,
    });
  } else if (currentView === 'projects') {
    renderProjectsPage(mainContentElement, {
      projects,
      teamMembers,
      projectStatuses: Object.values(ProjectStatus),
      onAddProject: addProject,
      onUpdateProject: updateProject,
      onDeleteProject: deleteProject,
      onExport: () => handleExport('projects'),
      onImport: (file) => handleImport(file, 'projects'),
    });
  } else if (currentView === 'attendance') {
    renderAttendancePage(mainContentElement, {
      attendanceRecords: attendance,
      teamMembers,
      projects, // Pass projects to attendance page for workload calculation
      attendanceStatuses: Object.values(AttendanceStatus),
      leaveTypes: Object.values(LeaveType),
      onUpsertAttendanceRecord: upsertAttendanceRecord,
      onDeleteAttendanceRecord: deleteAttendanceRecord,
      onExport: () => handleExport('attendance'),
      onImport: (file) => handleImport(file, 'attendance'),
      maxTeamMembers: 20,
      onAddTeamMember: addTeamMember,
      onUpdateTeamMember: updateTeamMember,
      onDeleteTeamMember: deleteTeamMember,
      onExportTeam: () => handleExport('team'),
      onImportTeam: (file) => handleImport(file, 'team'),
    });
  } else if (currentView === 'notes') {
    renderNotesPage(mainContentElement, {
        notes,
        noteStatuses: Object.values(NoteStatus),
        onAddNote: addNote,
        onUpdateNote: updateNote,
        onDeleteNote: deleteNote,
        onExport: () => handleExport('notes'),
        onImport: (file) => handleImport(file, 'notes'),
    });
  } else if (currentView === 'worklog') {
    renderWorkLogPage(mainContentElement, {
        workLogs,
        teamMembers,
        projects,
        currentUser,
        onAddMultipleWorkLogs: addMultipleWorkLogs,
        onUpdateWorkLog: updateWorkLog,
        onDeleteWorkLog: deleteWorkLog,
        onExport: () => handleExport('worklogs'),
        onImport: (file) => handleImport(file, 'worklogs'),
    });
  }
  
  const navbarElement = rootElement.querySelector('nav.navbar');
  if (navbarElement) {
      const newNavbar = Navbar({ 
          currentView, 
          onNavChange: handleNavChange, 
          onThemeToggle: handleThemeToggle,
          currentUser,
          teamMembers,
          onSetCurrentUser: setCurrentUser,
          isSwitchingUser: false
      });
      navbarElement.replaceWith(newNavbar);
  }
}

async function loadInitialData(seedIfEmpty = true) {
  try {
    const [projectData, attendanceData, notesData, teamMemberData, workLogData] = await Promise.all([
        getCollection('projects'),
        getCollection('attendance'),
        getCollection('notes'),
        getCollection('teamMembers'),
        getCollection('worklogs'),
    ]);
    
    projects = projectData;
    attendance = attendanceData;
    notes = notesData;
    workLogs = workLogData;

    // Check if team members need to be seeded. This is more robust.
    if (seedIfEmpty && teamMemberData.length === 0) {
        console.log("No team members found in database. Seeding with initial data.");
        const membersToSeed = INITIAL_TEAM_MEMBERS;
        await batchWrite('teamMembers', membersToSeed);
        teamMembers = await getCollection('teamMembers'); 
    } else {
        teamMembers = teamMemberData;
    }

    // Data migration: ensure all members have a role
    teamMembers.forEach(m => {
        if (!m.role) {
            m.role = TeamMemberRole.Member; // Default to 'Member' if role is missing
        }
    });

    // Initialize current user
    const savedUserId = localStorage.getItem('currentUserId');
    currentUser = teamMembers.find(m => m.id === savedUserId) || teamMembers[0];
    if (currentUser) {
        localStorage.setItem('currentUserId', currentUser.id);
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
    throw error; // Stop execution
  }
}

export async function initializeApp(appRootElement) {
  rootElement = appRootElement;
  rootElement.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading Team Data...</p></div>`;

  await loadInitialData();
  
  rootElement.innerHTML = ''; // Clear loading indicator

  const navbar = Navbar({ 
      currentView, 
      onNavChange: handleNavChange, 
      onThemeToggle: handleThemeToggle,
      currentUser,
      teamMembers,
      onSetCurrentUser: setCurrentUser,
  });
  rootElement.appendChild(navbar);

  mainContentElement = document.createElement('main');
  mainContentElement.className = 'main-content';
  rootElement.appendChild(mainContentElement);

  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `TeamSync &copy; ${new Date().getFullYear()}`;
  rootElement.appendChild(footer);

  // Set theme based on preference
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }

  renderApp();
}
