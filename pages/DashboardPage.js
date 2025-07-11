
import { TeamMemberRole, AttendanceStatus, ProjectStatus } from '../types.js';
import { GoogleGenAI } from "@google/genai";
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { ProjectForm } from '../components/ProjectForm.js';
import { NoteForm } from '../components/NoteForm.js';

let currentModalInstance = null;
let briefingGenerated = false; // Prevent re-fetching the briefing on every render

// --- AI Daily Briefing ---
async function fetchDailyBriefing(currentUser, teamMembers, projects, attendanceRecords) {
    const briefingTextElement = document.getElementById('daily-briefing-text');
    const briefingContainer = document.getElementById('daily-briefing-container');
    if (!briefingTextElement || !briefingContainer) return;

    try {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

        const systemInstruction = "You are 'Sync', a friendly and insightful AI assistant for the TeamSync application. Your goal is to provide a concise, encouraging, and actionable daily briefing for the user. Summarize the most important information. Use a positive and professional tone. Do not use markdown formatting. Keep the summary to a maximum of 3-4 short sentences.";

        const isManager = currentUser.role === TeamMemberRole.Manager;
        let prompt;
        const today = new Date();
        const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (isManager) {
            const todaysRecords = attendanceRecords.filter(r => r.date === today.toISOString().split('T')[0]);
            const presentCount = todaysRecords.filter(r => r.status === AttendanceStatus.Present || r.status === AttendanceStatus.WorkFromHome).length;
            const leaveCount = todaysRecords.filter(r => r.status === AttendanceStatus.Leave).length;
            const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done);
            const overdueProjects = activeProjects.filter(p => new Date(p.dueDate) < today);
            
            prompt = `Generate a daily briefing for the manager, ${currentUser.name}.
            Today's date is ${today.toDateString()}.
            Team Summary:
            - Total Team Members: ${teamMembers.length}
            - Members Present Today: ${presentCount}
            - Members on Leave Today: ${leaveCount}
            Project Summary:
            - Total Active Projects: ${activeProjects.length}
            - Overdue Projects: ${overdueProjects.length} (${overdueProjects.map(p => p.name).join(', ')})
            Based on this data, provide a helpful and encouraging summary for the manager.`;
        } else {
            const myProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id));
            const myActiveProjects = myProjects.filter(p => p.status !== ProjectStatus.Done);
            const myOverdue = myActiveProjects.filter(p => new Date(p.dueDate) < today);
            const myDueThisWeek = myActiveProjects.filter(p => {
                const dueDate = new Date(p.dueDate);
                return dueDate >= today && dueDate <= oneWeekFromNow;
            });
            const myAttendance = attendanceRecords.find(r => r.memberId === currentUser.id && r.date === today.toISOString().split('T')[0]);
            
            prompt = `Generate a daily briefing for the team member, ${currentUser.name}.
            Today's date is ${today.toDateString()}.
            Personal Task Summary:
            - Active Projects Assigned: ${myActiveProjects.length}
            - Overdue Tasks: ${myOverdue.length} (${myOverdue.map(p => p.name).join(', ')})
            - Tasks Due This Week: ${myDueThisWeek.length}
            - Your Attendance Today: ${myAttendance?.status || 'Not Marked'}
            Based on this data, provide a helpful and encouraging summary for the team member.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            },
        });
        
        briefingContainer.classList.remove('loading');
        briefingTextElement.textContent = response.text;

    } catch (error) {
        console.error("Gemini API Error:", error);
        briefingContainer.classList.remove('loading');
        briefingContainer.classList.add('error');
        briefingTextElement.textContent = "Could not generate your daily briefing. Please ensure your API key is correctly configured.";
    }
}


function renderDailyBriefing() {
    const briefingContainer = document.createElement('div');
    briefingContainer.id = 'daily-briefing-container';
    briefingContainer.className = 'dashboard-widget daily-briefing loading'; // Start in loading state

    briefingContainer.innerHTML = `
        <div class="briefing-header">
            <h3><i class="fas fa-wand-magic-sparkles widget-icon"></i> Daily Briefing</h3>
            <div class="spinner"></div>
        </div>
        <p id="daily-briefing-text" class="briefing-text">Generating your personalized summary...</p>
    `;
    return briefingContainer;
}

// --- Quick Actions ---
function renderQuickActions(currentUser, props) {
    const { onAddProject, onAddNote, teamMembers, projectStatuses } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-bolt widget-icon"></i>Quick Actions</h3>';
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'quick-actions-container';

    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    const openAddNoteModal = () => {
        const form = NoteForm({
            note: null,
            onSave: (noteData) => { onAddNote(noteData); closeModal(); },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add New Note', children: form, size: 'lg' });
    };

    const openAddProjectModal = () => {
        const form = ProjectForm({
            project: null, teamMembers, projectStatuses,
            onSave: (projectData) => { onAddProject(projectData); closeModal(); },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add New Project', children: form, size: 'xl' });
    };

    // Actions for everyone
    actionsContainer.appendChild(Button({
        children: 'Add Note',
        variant: 'secondary',
        leftIcon: '<i class="fas fa-sticky-note"></i>',
        onClick: openAddNoteModal,
    }));

    // Actions for Managers
    if (currentUser.role === TeamMemberRole.Manager) {
        actionsContainer.appendChild(Button({
            children: 'Add Project',
            variant: 'secondary',
            leftIcon: '<i class="fas fa-tasks"></i>',
            onClick: openAddProjectModal,
        }));
    }

    container.appendChild(actionsContainer);
    return container;
}


// --- Member View Components ---

function renderMemberWelcome(currentUser) {
    const welcomeHeader = document.createElement('div');
    welcomeHeader.className = 'dashboard-widget welcome-header';
    const name = currentUser ? currentUser.name.split(' ')[0] : 'User';
    welcomeHeader.innerHTML = `
        <h2>Welcome back, ${name}!</h2>
        <p>Here’s your briefing for the day. Let's make it productive!</p>
    `;
    return welcomeHeader;
}

function renderMyTasks(currentUser, projects) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-tasks widget-icon"></i>My Active Projects</h3>';

    const myProjects = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(currentUser.id))
                               .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (myProjects.length === 0) {
        container.innerHTML += `<p class="widget-empty-state">You have no active projects assigned. Enjoy the peace!</p>`;
        return container;
    }

    const list = document.createElement('ul');
    list.className = 'widget-list my-tasks-list';
    myProjects.forEach(p => {
        const li = document.createElement('li');
        li.className = 'widget-list-item';
        
        const isOverdue = new Date(p.dueDate) < new Date();
        const dateClass = isOverdue ? 'date-overdue' : '';

        li.innerHTML = `
            <span class="my-tasks-item-name">${p.name}</span>
            <span class="my-tasks-item-due ${dateClass}">
                <i class="fas fa-calendar-day"></i> Due: ${new Date(p.dueDate + 'T00:00:00').toLocaleDateString()}
            </span>
        `;
        list.appendChild(li);
    });
    container.appendChild(list);
    return container;
}

// --- Manager View Components ---

function renderTeamWorkload(teamMembers, projects) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-chart-bar widget-icon"></i>Team Workload</h3>';
    
    const workloadData = teamMembers
        .filter(m => m.role === TeamMemberRole.Member) // Only show members
        .map(member => ({
            label: member.name.split(' ')[0], // Show first name
            value: projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id)).length,
            color: '#4f46e5'
        }))
        .sort((a,b) => b.value - a.value); // Sort by highest workload first

    if (workloadData.length === 0) {
        container.innerHTML += `<p class="widget-empty-state">No team members to display workload for.</p>`;
        return container;
    }
    
    const chart = createBarChart(workloadData);
    container.appendChild(chart);
    return container;
}

function renderAtRiskProjects(projects) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-exclamation-triangle widget-icon"></i>At-Risk Projects</h3>';

    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const atRiskProjects = projects.filter(p => {
        const dueDate = new Date(p.dueDate);
        const isOverdue = p.status !== 'Done' && dueDate < now;
        const isDueSoon = p.status !== 'Done' && dueDate >= now && dueDate <= oneWeekFromNow;
        return isOverdue || isDueSoon;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (atRiskProjects.length === 0) {
        container.innerHTML += `<p class="widget-empty-state">No projects are currently at risk. Keep up the great work!</p>`;
        return container;
    }

    const list = document.createElement('ul');
    list.className = 'widget-list';
    atRiskProjects.forEach(p => {
        const li = document.createElement('li');
        li.className = 'widget-list-item';

        const isOverdue = new Date(p.dueDate) < new Date();
        const dateClass = isOverdue ? 'date-overdue' : 'date-upcoming';
        const icon = isOverdue ? 'fa-exclamation-circle' : 'fa-clock';

        li.innerHTML = `
            <span>${p.name}</span>
            <span class="at-risk-item-due ${dateClass}">
                <i class="fas ${icon}"></i> ${new Date(p.dueDate + 'T00:00:00').toLocaleDateString()}
            </span>
        `;
        list.appendChild(li);
    });
    container.appendChild(list);
    return container;
}

function renderDailyAttendance(teamMembers, attendanceRecords) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-user-check widget-icon"></i>Today\'s Attendance</h3>';

    const today = new Date().toISOString().split('T')[0];
    const todaysRecords = attendanceRecords.filter(r => r.date === today);

    const stats = { present: 0, wfh: 0, leave: 0, notMarked: 0 };
    const membersOnLeave = [];

    teamMembers.forEach(member => {
        const record = todaysRecords.find(r => r.memberId === member.id);
        if (!record) {
            stats.notMarked++;
        } else if (record.status === AttendanceStatus.Present) {
            stats.present++;
        } else if (record.status === AttendanceStatus.WorkFromHome) {
            stats.wfh++;
        } else if (record.status === AttendanceStatus.Leave) {
            stats.leave++;
            membersOnLeave.push(`${member.name} (${record.leaveType || 'On Leave'})`);
        }
    });

    const summary = document.createElement('div');
    summary.className = 'daily-attendance-summary';
    summary.innerHTML = `
        <div class="stat-item present"><span class="count">${stats.present}</span><span>Present</span></div>
        <div class="stat-item wfh"><span class="count">${stats.wfh}</span><span>WFH</span></div>
        <div class="stat-item leave"><span class="count">${stats.leave}</span><span>Leave</span></div>
        <div class="stat-item not-marked"><span class="count">${stats.notMarked}</span><span>Pending</span></div>
    `;
    container.appendChild(summary);

    if (membersOnLeave.length > 0) {
        const leaveList = document.createElement('div');
        leaveList.className = 'on-leave-list';
        leaveList.innerHTML = '<h4>On Leave Today:</h4>';
        const ul = document.createElement('ul');
        membersOnLeave.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            ul.appendChild(li);
        });
        leaveList.appendChild(ul);
        container.appendChild(leaveList);
    }
    
    return container;
}


// --- Helper Functions ---
function createBarChart(data) {
    const chart = document.createElement('div');
    chart.className = 'bar-chart';
    
    const maxValue = Math.max(...data.map(d => d.value), 1); // Avoid division by zero
    
    if (data.every(d => d.value === 0)) {
        chart.innerHTML = `<p class="widget-empty-state">No data to display.</p>`;
        return chart;
    }

    data.forEach(item => {
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-chart-item';
        
        barWrapper.innerHTML = `
            <span class="bar-chart-label" title="${item.label}">${item.label}</span>
            <div class="bar-chart-bar-wrapper">
                <div class="bar-chart-bar" style="width: ${(item.value / maxValue) * 100}%; background-color: ${item.color};"></div>
            </div>
            <span class="bar-chart-value">${item.value}</span>
        `;
        chart.appendChild(barWrapper);
    });

    return chart;
}


// --- Main Page Render ---

export function renderDashboardPage(container, props) {
    const { currentUser, teamMembers, projects, attendanceRecords } = props;

    // Reset flag when dashboard is re-rendered for a new user
    const savedUserId = localStorage.getItem('currentUserId');
    if(currentUser.id !== savedUserId) {
        briefingGenerated = false;
    }


    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    if (!currentUser) {
        pageWrapper.innerHTML = `
            <div class="no-data-placeholder">
                <i class="fas fa-users-slash icon"></i>
                <p class="primary-text">No user selected or no team members exist.</p>
                <p class="secondary-text">Please add a team member in the Attendance page.</p>
            </div>`;
        container.appendChild(pageWrapper);
        return;
    }
    
    const isManager = currentUser.role === TeamMemberRole.Manager;

    // Add briefing container first
    pageWrapper.appendChild(renderDailyBriefing());

    const dashboardGrid = document.createElement('div');
    dashboardGrid.className = 'dashboard-grid';

    if (isManager) {
        dashboardGrid.appendChild(renderTeamWorkload(teamMembers, projects));
        dashboardGrid.appendChild(renderAtRiskProjects(projects));
        dashboardGrid.appendChild(renderDailyAttendance(teamMembers, attendanceRecords));
        dashboardGrid.appendChild(renderQuickActions(currentUser, props));
    } else {
        dashboardGrid.appendChild(renderMyTasks(currentUser, projects));
        dashboardGrid.appendChild(renderAtRiskProjects(projects.filter(p => (p.assignees || []).includes(currentUser.id))));
        dashboardGrid.appendChild(renderQuickActions(currentUser, props));
    }
    
    pageWrapper.appendChild(dashboardGrid);
    container.appendChild(pageWrapper);

    // Fetch briefing after the element is in the DOM
    if (!briefingGenerated) {
        fetchDailyBriefing(currentUser, teamMembers, projects, attendanceRecords);
        briefingGenerated = true;
    }
}
