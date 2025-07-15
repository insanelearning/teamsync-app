
import { TeamMemberRole, AttendanceStatus, ProjectStatus } from '../types.js';
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { NoteForm } from '../components/NoteForm.js';

let currentModalInstance = null;

// --- Helper Functions ---
function formatMinutes(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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

function createDonutChart(value, total, color = '#4f46e5') {
    const container = document.createElement('div');
    container.className = 'donut-chart-container';
    container.style.width = '120px';
    container.style.height = '120px';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'donut-chart-svg');
    
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const offset = circumference - (percentage / 100) * circumference;

    svg.innerHTML = `
        <circle class="donut-background" cx="50" cy="50" r="${radius}" stroke-width="15" />
        <circle class="donut-foreground" cx="50" cy="50" r="${radius}" stroke-width="15" stroke="${color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 50 50)" />
        <text x="50" y="52" class="donut-center-value" text-anchor="middle">${formatMinutes(value)}</text>
        <text x="50" y="65" class="donut-center-label" text-anchor="middle">of 8h</text>
    `;
    
    container.appendChild(svg);
    return container;
}


// --- Widgets ---

function renderQuickActions(currentUser, props) {
    const { onAddNote, onAddMultipleWorkLogs, onNavChange, projects, teamMembers } = props;
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

    const openAddWorkLogModal = () => {
        const form = WorkLogForm({
            log: null, currentUser, teamMembers, projects,
            onSaveAll: (logsData) => { onAddMultipleWorkLogs(logsData); closeModal(); },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add New Work Log', children: form, size: 'xl' });
    };

    // Actions for everyone
    actionsContainer.appendChild(Button({
        children: 'Log My Work',
        variant: 'secondary',
        leftIcon: '<i class="fas fa-clock"></i>',
        onClick: openAddWorkLogModal,
    }));
    actionsContainer.appendChild(Button({
        children: 'Add Note',
        variant: 'secondary',
        leftIcon: '<i class="fas fa-sticky-note"></i>',
        onClick: openAddNoteModal,
    }));
    actionsContainer.appendChild(Button({
        children: 'View All Projects',
        variant: 'secondary',
        leftIcon: '<i class="fas fa-tasks"></i>',
        onClick: () => onNavChange('projects'),
    }));

    container.appendChild(actionsContainer);
    return container;
}

// --- Member View Components ---

function renderMyDailySummary(currentUser, workLogs) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget daily-summary-widget';
    
    const today = new Date().toISOString().split('T')[0];
    const myTodaysLogs = workLogs.filter(wl => wl.memberId === currentUser.id && wl.date === today);
    const totalMinutesToday = myTodaysLogs.reduce((sum, log) => sum + log.timeSpentMinutes, 0);

    const header = document.createElement('div');
    header.className = 'daily-summary-header';
    const name = currentUser ? currentUser.name.split(' ')[0] : 'User';
    header.innerHTML = `<h2>Welcome back, ${name}!</h2><p>Here’s your summary for today.</p>`;
    
    const body = document.createElement('div');
    body.className = 'daily-summary-body';
    
    // Donut Chart
    body.appendChild(createDonutChart(totalMinutesToday, 480)); // 8 hours = 480 minutes

    // Log List
    const logListContainer = document.createElement('div');
    logListContainer.className = 'daily-summary-log-list';
    if (myTodaysLogs.length > 0) {
        myTodaysLogs.forEach(log => {
            logListContainer.innerHTML += `<div class="log-item"><span>${log.taskName}</span><span>${formatMinutes(log.timeSpentMinutes)}</span></div>`;
        });
    } else {
        logListContainer.innerHTML = `<p class="widget-empty-state">No work logged yet for today.</p>`;
    }

    body.appendChild(logListContainer);
    container.append(header, body);
    return container;
}


// --- Manager View Components ---

function renderTeamWorkload(teamMembers, projects) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-chart-bar widget-icon"></i>Team Workload (Active Projects)</h3>';
    
    const workloadData = teamMembers
        .map(member => ({
            label: member.name.split(' ')[0], // Show first name
            value: projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id)).length,
            color: '#4f46e5'
        }))
        .sort((a,b) => b.value - a.value);

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
        if (p.status === 'Done') return false;
        const dueDate = new Date(p.dueDate);
        return dueDate < oneWeekFromNow;
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


// --- Main Page Render ---

export function renderDashboardPage(container, props) {
    const { currentUser, teamMembers, projects, attendanceRecords, workLogs } = props;

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

    if (isManager) {
        const dashboardGrid = document.createElement('div');
        dashboardGrid.className = 'dashboard-grid';
        dashboardGrid.appendChild(renderTeamWorkload(teamMembers, projects));
        dashboardGrid.appendChild(renderAtRiskProjects(projects));
        dashboardGrid.appendChild(renderDailyAttendance(teamMembers, attendanceRecords));
        dashboardGrid.appendChild(renderQuickActions(currentUser, props));
        pageWrapper.appendChild(dashboardGrid);
    } else {
        pageWrapper.appendChild(renderMyDailySummary(currentUser, workLogs));
        const dashboardGrid = document.createElement('div');
        dashboardGrid.className = 'dashboard-grid';
        dashboardGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        const assignedProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id));
        dashboardGrid.appendChild(renderAtRiskProjects(assignedProjects));
        dashboardGrid.appendChild(renderQuickActions(currentUser, props));
        pageWrapper.appendChild(dashboardGrid);
    }
    
    container.appendChild(pageWrapper);
}
