
import { TeamMemberRole, ProjectStatus, NoteStatus, AttendanceStatus } from '../types.js';
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { NoteForm } from '../components/NoteForm.js';
import { CelebrationsWidget } from '../components/CelebrationsWidget.js';
import { WeeklyHoursDetailModal } from '../components/WeeklyHoursDetailModal.js';

let currentModalInstance = null;

// --- Helper Functions ---

function closeModal() {
    closeGlobalModal();
    currentModalInstance = null;
}

function formatMinutes(minutes) {
    const totalMinutes = parseFloat(minutes);
    if (!isFinite(totalMinutes) || isNaN(totalMinutes)) return 'Error'; // Handle Infinity/NaN
    if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getStartOfWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0));
}

function getTodaysCelebrations(teamMembers) {
    const celebrations = [];
    const today = new Date();
    const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayYear = today.getFullYear();

    teamMembers.forEach(member => {
        if (member.birthDate) {
            const birthDate = new Date(member.birthDate + 'T00:00:00');
            const birthMMDD = `${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
            if (birthMMDD === todayMMDD) {
                celebrations.push({ type: 'birthday', memberName: member.name });
            }
        }
        if (member.joinDate) {
            const joinDate = new Date(member.joinDate + 'T00:00:00');
            const joinYear = joinDate.getFullYear();
            const joinMMDD = `${String(joinDate.getMonth() + 1).padStart(2, '0')}-${String(joinDate.getDate()).padStart(2, '0')}`;
            if (joinMMDD === todayMMDD && joinYear < todayYear) {
                celebrations.push({ type: 'anniversary', memberName: member.name, years: todayYear - joinYear });
            }
        }
    });
    return celebrations;
}

function formatDueDate(dueDateString) {
    const dueDate = new Date(dueDateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `<span class="focus-due-date overdue">Overdue by ${Math.abs(diffDays)} day(s)</span>`;
    } else if (diffDays === 0) {
        return `<span class="focus-due-date due-today">Due Today</span>`;
    } else if (diffDays === 1) {
        return `<span class="focus-due-date due-soon">Due Tomorrow</span>`;
    } else {
        return `<span class="focus-due-date">Due in ${diffDays} days</span>`;
    }
}


// --- Manager Dashboard Widgets ---

function renderTeamHealthOverview(props) {
    const { projects, workLogs, teamMembers } = props;
    const container = document.createElement('div');
    container.className = 'team-health-overview widget-fade-in';

    // --- Calculations ---
    const startOfWeek = getStartOfWeek();
    const weeklyLogs = workLogs.filter(log => new Date(log.date) >= startOfWeek);
    const totalMinutesLogged = weeklyLogs.reduce((sum, log) => sum + (parseFloat(log.timeSpentMinutes) || 0), 0);
    const expectedMinutes = teamMembers.length * 40 * 60; // Assuming 40h week
    const utilization = expectedMinutes > 0 ? Math.min(100, Math.round((totalMinutesLogged / expectedMinutes) * 100)) : 0;

    const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done);
    const overdueProjects = activeProjects.filter(p => new Date(p.dueDate) < new Date());
    const overdueRate = activeProjects.length > 0 ? (overdueProjects.length / activeProjects.length) * 100 : 0;
    let healthStatus = { text: 'Good', className: 'meter-status-good' };
    if (overdueRate > 30) {
        healthStatus = { text: 'Danger', className: 'meter-status-danger' };
    } else if (overdueRate > 10) {
        healthStatus = { text: 'Warning', className: 'meter-status-warning' };
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const completedLast90Days = projects.filter(p => p.status === ProjectStatus.Done && p.completionDate && new Date(p.completionDate) >= ninetyDaysAgo);
    const onTimeCompletions = completedLast90Days.filter(p => new Date(p.completionDate) <= new Date(p.dueDate)).length;
    const onTimeRate = completedLast90Days.length > 0 ? Math.round((onTimeCompletions / completedLast90Days.length) * 100) : 100;

    // --- HTML Structure ---
    container.innerHTML = `
        <div class="health-grid">
            <div class="health-item">
                <h4>Team Utilization (Week)</h4>
                <div class="utilization-gauge" style="--gauge-percent: ${utilization}%; --gauge-color: ${utilization > 85 ? 'var(--color-primary)' : '#f59e0b'};">
                    <div class="gauge-center">${utilization}%</div>
                </div>
            </div>
            <div class="health-item">
                <h4>Project Health</h4>
                <div class="project-health-meter">
                    <div class="meter-bar ${healthStatus.className}">${healthStatus.text}</div>
                </div>
                <p class="health-kpi-subtext">${overdueProjects.length} of ${activeProjects.length} active projects are overdue.</p>
            </div>
            <div class="health-item">
                <h4>On-Time Delivery (90d)</h4>
                <div class="health-kpi-value">${onTimeRate}%</div>
                <p class="health-kpi-subtext">${onTimeCompletions} of ${completedLast90Days.length} projects completed on time.</p>
            </div>
        </div>
    `;

    return container;
}


function renderManagerKPIs(props, onKpiClick) {
    const { projects, workLogs, teamMembers, attendanceRecords } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-kpis widget-fade-in';

    const startOfWeekString = getStartOfWeek().toISOString().split('T')[0];
    const hoursThisWeek = workLogs.filter(log => log.date >= startOfWeekString).reduce((sum, log) => sum + (parseFloat(log.timeSpentMinutes) || 0), 0);
    const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done).length;
    const overdueProjects = projects.filter(p => p.status !== ProjectStatus.Done && new Date(p.dueDate) < new Date());
    const onLeaveRecords = attendanceRecords.filter(r => r.date === new Date().toISOString().split('T')[0] && r.status === 'Leave');
    const membersOnLeave = onLeaveRecords.map(record => ({
        name: teamMembers.find(tm => tm.id === record.memberId)?.name || 'Unknown',
        leaveType: record.leaveType || 'Not specified'
    }));

    const kpis = [
        { value: formatMinutes(hoursThisWeek), label: 'Hours This Week', icon: 'fa-clock', type: 'hours' },
        { value: activeProjects, label: 'Active Projects', icon: 'fa-tasks', type: 'active' },
        { value: overdueProjects.length, label: 'Overdue', icon: 'fa-exclamation-triangle', type: 'overdue' },
        { value: membersOnLeave.length, label: 'On Leave Today', icon: 'fa-umbrella-beach', type: 'leave' }
    ];

    kpis.forEach(kpi => {
        const card = document.createElement('div');
        card.className = 'kpi-card clickable';
        card.innerHTML = `
            <div class="kpi-icon"><i class="fas ${kpi.icon}"></i></div>
            <div>
                <div class="kpi-value">${kpi.value}</div>
                <div class="kpi-label">${kpi.label}</div>
            </div>`;
        card.onclick = () => onKpiClick(kpi.type);
        container.appendChild(card);
    });

    return container;
}

function renderDailyStandup(props) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    // ... implementation for daily standup
    return container;
}

function renderProjectInsights(props) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    // ... implementation for project insights
    return container;
}

function renderActivityFeed(props) {
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    // ... implementation for activity feed
    return container;
}

// --- Member Dashboard Widgets ---

function renderMyFocusWidget(props, onLogTime) {
    const { projects, currentUser } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = `
        <div class="widget-header">
            <h3><i class="fas fa-bullseye widget-icon"></i> My Focus for Today</h3>
        </div>`;
    const list = document.createElement('ul');
    list.className = 'focus-widget-list';

    const myActiveProjects = projects.filter(p =>
        p.status !== ProjectStatus.Done && (p.assignees || []).includes(currentUser.id)
    );

    myActiveProjects.sort((a, b) => {
        const aDueDate = new Date(a.dueDate);
        const bDueDate = new Date(b.dueDate);
        const aOverdue = aDueDate < new Date() && a.status !== 'Done';
        const bOverdue = bDueDate < new Date() && b.status !== 'Done';

        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        return aDueDate - bDueDate;
    });

    if (myActiveProjects.length > 0) {
        myActiveProjects.slice(0, 5).forEach(p => {
            const li = document.createElement('li');
            li.className = `focus-list-item ${new Date(p.dueDate) < new Date() ? 'overdue' : ''}`;
            
            li.innerHTML = `
                <div class="focus-project-name">${p.name}</div>
                <div class="focus-meta">
                    ${formatDueDate(p.dueDate)}
                    <span class="priority-${p.priority.toLowerCase()}">${p.priority}</span>
                </div>`;

            const logTimeBtn = Button({
                children: 'Log Time',
                variant: 'secondary',
                size: 'sm',
                className: 'focus-log-time-btn',
                onClick: () => onLogTime(p.id)
            });
            li.appendChild(logTimeBtn);
            list.appendChild(li);
        });
    } else {
        list.innerHTML = `<p class="log-status-empty">You have no active projects assigned.</p>`;
    }
    
    container.appendChild(list);
    return container;
}

function renderMyActionableNotes(props, onNoteClick) {
    // ... implementation for my actionable notes
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    return container;
}

// --- Main Page Rendering ---

export function renderDashboardPage(container, props) {
    const { currentUser, teamMembers, projects, workLogs, attendanceRecords, notes, onAddMultipleWorkLogs, onUpdateWorkLog, onUpdateNote, appSettings, workLogTasks, activities } = props;
    const isManager = currentUser.role === TeamMemberRole.Manager;

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container dashboard-page';

    // Welcome Header
    const welcomeHeader = document.createElement('div');
    welcomeHeader.innerHTML = `<h2>${appSettings.welcomeMessage || 'Welcome back,'} ${currentUser.name.split(' ')[0]}!</h2>`;
    pageWrapper.appendChild(welcomeHeader);

    // Render based on role
    if (isManager) {
        pageWrapper.appendChild(renderTeamHealthOverview(props));
        const celebrations = getTodaysCelebrations(teamMembers);
        if (celebrations.length > 0) {
            pageWrapper.appendChild(CelebrationsWidget({ celebrations }));
        }
        pageWrapper.appendChild(renderManagerKPIs(props, (kpiType) => { /* Handle KPI click */ }));

        // Further manager widgets would go here...

    } else { // Member View
        // Member-specific layout and widgets
        const memberDashboard = document.createElement('div');
        
        memberDashboard.appendChild(renderMyFocusWidget(props, (projectId) => {
            openWorkLogModal({ initialEntryData: { projectId } });
        }));

        pageWrapper.appendChild(memberDashboard);
    }
    
    function openWorkLogModal({ log, initialEntryData } = {}) {
        const targetMemberId = log ? log.memberId : currentUser.id;
        const targetMember = teamMembers.find(m => m.id === targetMemberId);
        const userTeam = targetMember ? targetMember.internalTeam : '';
        
        const availableTasksForUser = (workLogTasks || []).filter(task => (task.teams || []).includes(userTeam));
        const tasksGroupedByCategory = availableTasksForUser.reduce((acc, task) => {
            const category = task.category || 'Uncategorized';
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {});

        const form = WorkLogForm({
            log, ...props,
            workLogTasks: tasksGroupedByCategory,
            initialEntryData: initialEntryData,
            onSave: (logData) => { onUpdateWorkLog(logData); closeModal(); },
            onSaveAll: (logsData) => { onAddMultipleWorkLogs(logsData); closeModal(); },
            onCancel: closeModal
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: log ? 'Edit Work Log' : 'Add Work Log(s)', children: form, size: 'xl' });
    }

    container.appendChild(pageWrapper);
}
