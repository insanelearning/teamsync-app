
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
import { renderEvaluationPage } from './pages/EvaluationPage.js';
import { Navbar } from './components/Navbar.js';
import { INITIAL_TEAM_MEMBERS } from './constants.js';
import { getCollection, setDocument, updateDocument, deleteDocument, batchWrite, deleteByQuery } from './services/firebaseService.js';
import { exportToCSV, importFromCSV } from './services/csvService.js';
import { ProjectStatus, AttendanceStatus, LeaveType, NoteStatus } from './types.js'; // Enums

let rootElement;
let mainContentElement;

// State - these are now local caches of the Firestore data.
let currentView = localStorage.getItem('currentView') || 'projects';
let projects = [];
let attendance = [];
let notes = [];
let teamMembers = [];

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

    // 3. Delete the team member itself
    await deleteDocument('teamMembers', memberId);
    
    // 4. Update local state and re-render
    projects = currentProjects;
    attendance = attendance.filter(a => a.memberId !== memberId);
    teamMembers = teamMembers.filter(m => m.id !== memberId);
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
    }));
    exportToCSV(projectsToExport, 'projects.csv');
  } else if (dataType === 'attendance') {
    exportToCSV(attendance, 'attendance.csv');
  } else if (dataType === 'team') {
    exportToCSV(teamMembers, 'team_members.csv');
  } else if (dataType === 'notes') {
    const notesToExport = notes.map(n => ({
        ...n,
        tags: n.tags ? n.tags.join(';') : '',
    }));
    exportToCSV(notesToExport, 'notes.csv');
  }
};

const handleImport = async (file, dataType) => {
  try {
    const data = await importFromCSV(file);
    let collectionName = '';
    let processedData = [];

    if (dataType === 'projects') {
        collectionName = 'projects';
        processedData = data.map(item => {
            if (!item.id || !item.name || !item.status || !item.dueDate) return null;
            // Data validation and processing logic from original function...
            return {
              ...item,
              assignees: Array.isArray(item.assignees) ? item.assignees : (item.assignees || '').split(';').map(s=>s.trim()).filter(Boolean),
              tags: Array.isArray(item.tags) ? item.tags : (item.tags || '').split(';').map(s=>s.trim()).filter(Boolean),
              goals: Array.isArray(item.goals) ? item.goals : (JSON.parse(item.goals || '[]')),
              stakeholderName: item.stakeholderName || '',
              mediaProduct: item.mediaProduct || '',
              pilotScope: item.pilotScope || '',
              clientNames: item.clientNames || '',
              projectApproach: item.projectApproach || '',
              deliverables: item.deliverables || '',
              resultsAchieved: item.resultsAchieved || '',
            };
        }).filter(Boolean);
    } else if (dataType === 'attendance') {
        collectionName = 'attendance';
        processedData = data.filter(item => item.id && item.date && item.memberId && item.status);
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
    }
    
    if (collectionName && processedData.length > 0) {
        await batchWrite(collectionName, processedData);
        await loadInitialData(false); // Refetch data
        renderApp();
        alert(`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} data imported successfully!`);
    } else {
        alert(`No valid data to import for ${dataType}.`);
    }
  } catch (error) {
    console.error("Import error:", error);
    alert(`Failed to import ${dataType} data. Please check the console for details and ensure the CSV format is correct.`);
  }
};


function handleNavChange(view) {
  if (view === 'campaigns') {
    view = 'projects'; // Campaigns page is removed, redirect to projects.
  }
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

function renderApp() {
  if (!rootElement || !mainContentElement) {
    console.error("Root or main content element not initialized for rendering.");
    return;
  }

  mainContentElement.innerHTML = '';

  if (currentView === 'projects') {
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
  } else if (currentView === 'evaluation') {
    renderEvaluationPage(mainContentElement, {
      teamMembers,
      projects,
      attendanceRecords: attendance,
    });
  }
  
  const navbarElement = rootElement.querySelector('nav.navbar');
  if (navbarElement) {
      const newNavbar = Navbar({ currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle });
      navbarElement.replaceWith(newNavbar);
  }
}

async function loadInitialData(seedIfEmpty = true) {
  try {
    const [projectData, attendanceData, notesData, teamMemberData] = await Promise.all([
        getCollection('projects'),
        getCollection('attendance'),
        getCollection('notes'),
        getCollection('teamMembers')
    ]);
    
    projects = projectData;
    attendance = attendanceData;
    notes = notesData;

    // Check if team members need to be seeded. This is more robust.
    if (seedIfEmpty && teamMemberData.length === 0) {
        console.log("No team members found in database. Seeding with initial data.");
        const membersToSeed = INITIAL_TEAM_MEMBERS;
        await batchWrite('teamMembers', membersToSeed);
        // After seeding, refetch the team members to ensure we have the correct data from the DB
        teamMembers = await getCollection('teamMembers'); 
    } else {
        // Otherwise, just use the data we fetched
        teamMembers = teamMemberData;
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

  const navbar = Navbar({ currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle });
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
