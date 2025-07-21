
import { TeamMemberRole, ProjectStatus } from '../types.js';
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { NoteForm } from '../components/NoteForm.js';

let currentModalInstance = null;

// --- Helper Functions ---
function formatMinutes(minutes) {
    if (isNaN(minutes) || minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getStartOfWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

// --- Manager Dashboard Widgets ---

function renderManagerKPIs(props) {
    const { projects, workLogs, teamMembers, attendanceRecords } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-kpis';

    const startOfWeek = getStartOfWeek();
    const hoursThisWeek = workLogs
        .filter(log => log.date >= startOfWeek)
        .reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    
    const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done).length;
    const overdueProjects = projects.filter(p => p.status !== ProjectStatus.Done && new Date(p.dueDate) < new Date()).length;
    
    const today = new Date().toISOString().split('T')[0];
    const onLeaveToday = attendanceRecords.filter(r => r.date === today && r.status === 'Leave').length;

    const kpis = [
        { value: formatMinutes(hoursThisWeek), label: 'Hours This Week', icon: 'fa-clock' },
        { value: activeProjects, label: 'Active Projects', icon: 'fa-tasks' },
        { value: overdueProjects, label: 'Overdue', icon: 'fa-exclamation-triangle' },
        { value: onLeaveToday, label: 'On Leave Today', icon: 'fa-user-slash' }
    ];

    kpis.forEach(kpi => {
        container.innerHTML += `
            <div class="kpi-card">
                <div class="kpi-icon">
                    <i class="fas ${kpi.icon}"></i>
                </div>
                <div>
                    <div class="kpi-value">${kpi.value}</div>
                    <div class="kpi-label">${kpi.label}</div>
                </div>
            </div>
        `;
    });
    return container;
}

function renderTeamPulse(props) {
    const { teamMembers, attendanceRecords, projects } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-heartbeat widget-icon"></i>Today\'s Snapshot</h3>';
    
    const content = document.createElement('div');
    content.className = 'widget-content snapshot-grid';

    const today = new Date().toISOString().split('T')[0];
    const todaysRecords = attendanceRecords.filter(r => r.date === today);

    const stats = { present: 0, wfh: 0, leave: 0, notMarked: 0 };
    teamMembers.forEach(member => {
        const record = todaysRecords.find(r => r.memberId === member.id);
        if (!record) stats.notMarked++;
        else if (record.status === 'Present') stats.present++;
        else if (record.status === 'Work From Home') stats.wfh++;
        else if (record.status === 'Leave') stats.leave++;
    });

    content.innerHTML = `
        <div class="snapshot-attendance">
            <h4>Attendance</h4>
            <div class="attendance-stats">
                <div class="stat-item" title="Present"><i class="fas fa-user-check" style="color: #22c55e;"></i> ${stats.present}</div>
                <div class="stat-item" title="Work From Home"><i class="fas fa-laptop-house" style="color: #3b82f6;"></i> ${stats.wfh}</div>
                <div class="stat-item" title="On Leave"><i class="fas fa-umbrella-beach" style="color: #f97316;"></i> ${stats.leave}</div>
                <div class="stat-item" title="Not Marked"><i class="fas fa-question-circle" style="color: #6b7280;"></i> ${stats.notMarked}</div>
            </div>
        </div>
        <div class="snapshot-deadlines">
            <h4>Due Today</h4>
            <ul class="snapshot-list">
                ${projects.filter(p => p.dueDate === today && p.status !== ProjectStatus.Done).map(p => `<li>${p.name}</li>`).join('') || '<li>No deadlines today.</li>'}
            </ul>
        </div>
    `;
    
    container.appendChild(content);
    return container;
}

function renderActivityFeed(props) {
    const { workLogs, projects, teamMembers } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-stream widget-icon"></i>Team Activity</h3>';

    const getMemberName = (id) => teamMembers.find(m => m.id === id)?.name || 'Unknown';
    const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'a project';
    
    const workLogEvents = workLogs.map(log => ({
        type: 'log',
        date: new Date(log.updatedAt),
        text: `<strong>${getMemberName(log.memberId)}</strong> logged ${formatMinutes(log.timeSpentMinutes)} on <em>${getProjectName(log.projectId)}</em>.`,
    }));

    const projectEvents = projects.filter(p => p.status === ProjectStatus.Done && p.completionDate).map(p => ({
        type: 'completion',
        date: new Date(p.completionDate),
        text: `<strong>${p.assignees.map(getMemberName).join(', ')}</strong> completed project <em>${p.name}</em>.`
    }));

    const allEvents = [...workLogEvents, ...projectEvents]
        .sort((a,b) => b.date - a.date)
        .slice(0, 7); // Limit to latest 7 activities

    const list = document.createElement('ul');
    list.className = 'activity-feed';
    if (allEvents.length === 0) {
        list.innerHTML = `<li class="activity-empty">No recent activity to show.</li>`;
    } else {
        allEvents.forEach(event => {
            const li = document.createElement('li');
            li.className = 'activity-item';
            const icon = event.type === 'log' ? 'fa-clock' : 'fa-check-circle';
            li.innerHTML = `
                <div class="activity-icon"><i class="fas ${icon}"></i></div>
                <div class="activity-text">${event.text}</div>
                <div class="activity-time">${event.date.toLocaleDateString()}</div>
            `;
            list.appendChild(li);
        });
    }

    container.appendChild(list);
    return container;
}


// --- Member Dashboard Widgets ---

function renderMemberHero(props) {
    const { currentUser, workLogs, projects } = props;
    const container = document.createElement('div');
    container.className = 'member-hero';

    const today = new Date().toISOString().split('T')[0];
    const myTodaysMinutes = workLogs
        .filter(wl => wl.memberId === currentUser.id && wl.date === today)
        .reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    
    const myActiveProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id) && p.status !== ProjectStatus.Done).length;
    const myOverdueProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id) && p.status !== ProjectStatus.Done && new Date(p.dueDate) < new Date()).length;

    container.innerHTML = `
        <div class="member-hero-welcome">
            <h2>Welcome back, <strong>${currentUser.name.split(' ')[0]}</strong>!</h2>
            <p>Here's your personal dashboard. Let's make today productive.</p>
            <div class="member-hero-actions">
                ${Button({
                    children: 'Log My Work',
                    leftIcon: '<i class="fas fa-plus"></i>',
                    onClick: () => openModal('worklog', props)
                }).outerHTML}
                ${Button({
                    children: 'Add a Note',
                    variant: 'secondary',
                    leftIcon: '<i class="fas fa-sticky-note"></i>',
                    onClick: () => openModal('note', props)
                }).outerHTML}
            </div>
        </div>
        <div class="member-hero-stats">
            <div class="hero-stat-card">
                <div class="donut-chart-container">
                    <svg viewBox="0 0 36 36" class="donut-chart-svg">
                        <path class="donut-background" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3"></path>
                        <path class="donut-foreground" stroke-width="3.2" stroke-linecap="round" fill="none"
                            stroke-dasharray="${(myTodaysMinutes / 480 * 100)}, 100"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831">
                        </path>
                    </svg>
                    <div class="donut-text">
                        <span class="donut-value">${formatMinutes(myTodaysMinutes)}</span>
                        <span class="donut-label">Logged Today</span>
                    </div>
                </div>
            </div>
            <div class="hero-side-stats">
                <div class="hero-stat-card small">
                    <i class="fas fa-tasks hero-stat-icon"></i>
                    <div>
                        <span class="hero-stat-value">${myActiveProjects}</span>
                        <span class="hero-stat-label">Active Projects</span>
                    </div>
                </div>
                <div class="hero-stat-card small ${myOverdueProjects > 0 ? 'warning' : ''}">
                    <i class="fas fa-exclamation-triangle hero-stat-icon"></i>
                    <div>
                        <span class="hero-stat-value">${myOverdueProjects}</span>
                        <span class="hero-stat-label">Overdue</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    return container;
}

function renderMyFocus(props) {
    const { currentUser, projects } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-crosshairs widget-icon"></i>My Focus</h3>';

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const myProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id) && p.status !== 'Done');

    const focusProjects = myProjects
        .filter(p => new Date(p.dueDate) < threeDaysFromNow)
        .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    const list = document.createElement('ul');
    list.className = 'widget-list-condensed';
    if (focusProjects.length === 0) {
        list.innerHTML = `<li class="activity-empty">No urgent deadlines.</li>`;
    } else {
        focusProjects.forEach(p => {
            const isOverdue = new Date(p.dueDate) < new Date();
            list.innerHTML += `
                <li class="list-item">
                    <span class="item-title">${p.name}</span>
                    <span class="item-meta ${isOverdue ? 'meta-overdue' : ''}">Due: ${new Date(p.dueDate + 'T00:00:00').toLocaleDateString()}</span>
                </li>
            `;
        });
    }
    container.appendChild(list);
    return container;
}

function renderMyNotes(props) {
    const { notes } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-sticky-note widget-icon"></i>My Pending Notes</h3>';

    const pendingNotes = notes
        .filter(n => n.status === 'Pending')
        .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 4);

    const list = document.createElement('ul');
    list.className = 'widget-list-condensed';
    if (pendingNotes.length === 0) {
        list.innerHTML = `<li class="activity-empty">No pending notes.</li>`;
    } else {
        pendingNotes.forEach(note => {
            list.innerHTML += `
                <li class="list-item">
                    <span class="item-title">${note.title}</span>
                    ${note.dueDate ? `<span class="item-meta">Due: ${new Date(note.dueDate).toLocaleDateString()}</span>` : ''}
                </li>
            `;
        });
    }
    container.appendChild(list);
    return container;
}

// --- Main Page Render Logic ---

function openModal(type, props) {
    const { onAddNote, onAddMultipleWorkLogs, projects, teamMembers, currentUser } = props;
    const closeModal = () => { closeGlobalModal(); currentModalInstance = null; };
    
    let form, title, size;

    if (type === 'note') {
        form = NoteForm({
            note: null,
            onSave: (noteData) => { onAddNote(noteData); closeModal(); },
            onCancel: closeModal,
        });
        title = 'Add New Note';
        size = 'lg';
    } else { // worklog
        form = WorkLogForm({
            log: null, currentUser, teamMembers, projects,
            onSaveAll: (logsData) => { onAddMultipleWorkLogs(logsData); closeModal(); },
            onCancel: closeModal,
        });
        title = 'Add New Work Log';
        size = 'xl';
    }

    currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title, children: form, size });
}


function renderManagerDashboard(container, props) {
    const { teamMembers, projects } = props;

    container.appendChild(renderManagerKPIs(props));
    
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout';
    
    const mainCol = document.createElement('div');
    mainCol.className = 'dashboard-main-col';
    mainCol.appendChild(renderTeamPulse(props));
    mainCol.appendChild(renderActivityFeed(props));

    const sideCol = document.createElement('div');
    sideCol.className = 'dashboard-side-col';
    
    const workloadWidget = document.createElement('div');
    workloadWidget.className = 'dashboard-widget';
    workloadWidget.innerHTML = '<h3><i class="fas fa-chart-bar widget-icon"></i>Team Workload</h3>';
    const workloadData = teamMembers
        .map(member => ({
            label: member.name.split(' ')[0],
            value: projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id)).length,
            color: '#4f46e5'
        }))
        .sort((a,b) => b.value - a.value);

    if (workloadData.length > 0) {
        const barChart = document.createElement('div');
        barChart.className = 'widget-content';
        barChart.innerHTML = workloadData.map(item => `
            <div class="bar-chart-item">
                <span class="bar-chart-label" title="${item.label}">${item.label}</span>
                <div class="bar-chart-bar-wrapper">
                    <div class="bar-chart-bar" style="width: ${item.value > 0 ? (item.value / Math.max(...workloadData.map(d=>d.value))) * 100 : 0}%; background-color: ${item.color};"></div>
                </div>
                <span class="bar-chart-value">${item.value}</span>
            </div>
        `).join('');
        workloadWidget.appendChild(barChart);
    }
    sideCol.appendChild(workloadWidget);

    layout.append(mainCol, sideCol);
    container.appendChild(layout);
}

function renderMemberDashboard(container, props) {
    container.appendChild(renderMemberHero(props));
    
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout-member';
    
    layout.appendChild(renderMyFocus(props));
    layout.appendChild(renderMyNotes(props));

    container.appendChild(layout);
}

export function renderDashboardPage(container, props) {
    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container dashboard-page';

    if (!props.currentUser) {
        pageWrapper.innerHTML = `<div class="no-data-placeholder"><p>Loading user data...</p></div>`;
        container.appendChild(pageWrapper);
        return;
    }
    
    const isManager = props.currentUser.role === TeamMemberRole.Manager;

    if (isManager) {
        renderManagerDashboard(pageWrapper, props);
    } else {
        renderMemberDashboard(pageWrapper, props);
    }
    
    container.appendChild(pageWrapper);
}
