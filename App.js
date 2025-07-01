
import { renderProjectsPage } from './pages/ProjectsPage.js';
import { renderAttendancePage } from './pages/AttendancePage.js';
import { renderNotesPage } from './pages/NotesPage.js';
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
  const { id, ...data } = project;
  await setDocument('projects', id, data);
  projects.push(project);
  renderApp();
};

const updateProject = async (updatedProject) => {
  const { id, ...data } = updatedProject;
  await updateDocument('projects', id, data);
  projects = projects.map(p => p.id === id ? updatedProject : p);
  renderApp();
};

const deleteProject = async (projectId) => {
  await deleteDocument('projects', projectId);
  projects = projects.filter(p => p.id !== projectId);
  renderApp();
};

// Attendance handlers
const upsertAttendanceRecord = async (record) => {
  const { id, ...data } = record;
  await setDocument('attendance', id, data);
  const existingIndex = attendance.findIndex(r => r.id === id);
  if (existingIndex > -1) {
    attendance[existingIndex] = record;
  } else {
    attendance.push(record);
  }
  renderApp();
};

const deleteAttendanceRecord = async (recordId) => {
  await deleteDocument('attendance', recordId);
  attendance = attendance.filter(r => r.id !== recordId);
  renderApp();
};

// Note handlers
const addNote = async (note) => {
  const { id, ...data } = note;
  await setDocument('notes', id, data);
  notes.push(note);
  renderApp();
};

const updateNote = async (updatedNote) => {
  const { id, ...data } = updatedNote;
  await updateDocument('notes', id, data);
  notes = notes.map(n => n.id === id ? updatedNote : n);
  renderApp();
};

const deleteNote = async (noteId) => {
  await deleteDocument('notes', noteId);
  notes = notes.filter(n => n.id !== noteId);
  renderApp();
};

// Team Member handlers
const addTeamMember = async (member) => {
  if (teamMembers.length >= 20) {
    alert("Team size cannot exceed 20 members.");
    return;
  }
  const { id, ...data } = member;
  await setDocument('teamMembers', id, data);
  teamMembers.push(member);
  renderApp();
};

const updateTeamMember = async (updatedMember) => {
  const { id, ...data } = updatedMember;
  await updateDocument('teamMembers', id, data);
  teamMembers = teamMembers.map(m => m.id === id ? updatedMember : m);
  renderApp();
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
      ...p,
      assignees: p.assignees.join(';'),
      tags: p.tags ? p.tags.join(';') : '',
      goals: p.goals ? JSON.stringify(p.goals) : '[]',
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
              // Set defaults for missing fields
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
  }
  
  const navbarElement = rootElement.querySelector('nav.navbar');
  if (navbarElement) {
      const newNavbar = Navbar({ currentView, onNavChange: handleNavChange, onThemeToggle: handleThemeToggle });
      navbarElement.replaceWith(newNavbar);
  }
}

async function loadInitialData(seedIfEmpty = true) {
    const [projectData, attendanceData, notesData, teamMemberData] = await Promise.all([
        getCollection('projects'),
        getCollection('attendance'),
        getCollection('notes'),
        getCollection('teamMembers')
    ]);
    projects = projectData;
    attendance = attendanceData;
    notes = notesData;
    teamMembers = teamMemberData;

    if (seedIfEmpty && teamMemberData.length === 0 && projectData.length === 0) {
        console.log("No data found in database. Seeding with initial team members.");
        await batchWrite('teamMembers', INITIAL_TEAM_MEMBERS);
        teamMembers = INITIAL_TEAM_MEMBERS;
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
