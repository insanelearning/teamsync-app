
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

// Simple hash to get a consistent color for a member ID
function getColorForId(id) {
    const colors = ['#4f46e5', '#db2777', '#16a34a', '#f97316', '#0891b2', '#6d28d9', '#ca8a04'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
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

function renderDailyStandup(props) {
    const { teamMembers, attendanceRecords, workLogs } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';

    let selectedDate = new Date().toISOString().split('T')[0];
    let activeTab = 'attendance';

    const rerenderContent = () => {
        const contentContainer = container.querySelector('.standup-content');
        if (!contentContainer) return;
        contentContainer.innerHTML = '';

        if (activeTab === 'attendance') {
            const todaysRecords = attendanceRecords.filter(r => r.date === selectedDate);
            const stats = { present: 0, wfh: 0, leave: 0, notMarked: 0 };
            teamMembers.forEach(member => {
                const record = todaysRecords.find(r => r.memberId === member.id);
                if (!record) stats.notMarked++;
                else if (record.status === 'Present') stats.present++;
                else if (record.status === 'Work From Home') stats.wfh++;
                else if (record.status === 'Leave') stats.leave++;
            });
            contentContainer.innerHTML = `
                <div class="attendance-stats">
                    <div class="stat-item" title="Present"><i class="fas fa-user-check" style="color: #22c55e;"></i> ${stats.present} Present</div>
                    <div class="stat-item" title="Work From Home"><i class="fas fa-laptop-house" style="color: #3b82f6;"></i> ${stats.wfh} WFH</div>
                    <div class="stat-item" title="On Leave"><i class="fas fa-umbrella-beach" style="color: #f97316;"></i> ${stats.leave} On Leave</div>
                    <div class="stat-item" title="Not Marked"><i class="fas fa-question-circle" style="color: #6b7280;"></i> ${stats.notMarked} Not Marked</div>
                </div>`;
        } else { // 'logs' tab
            const logsForDate = workLogs.filter(log => log.date === selectedDate);
            const loggedMemberIds = new Set(logsForDate.map(log => log.memberId));
            
            const memberTimeMap = new Map();
            logsForDate.forEach(log => {
                const currentMins = memberTimeMap.get(log.memberId) || 0;
                memberTimeMap.set(log.memberId, currentMins + log.timeSpentMinutes);
            });

            const membersLogged = teamMembers.filter(m => loggedMemberIds.has(m.id));
            const membersPending = teamMembers.filter(m => !loggedMemberIds.has(m.id));
            
            const createListHTML = (title, members, icon, showTime) => {
                let listItems = members.length > 0 ? members.map(m => `
                    <li class="log-status-item">
                        <span>${m.name}</span>
                        ${showTime ? `<span class="log-status-time">${formatMinutes(memberTimeMap.get(m.id))}</span>` : ''}
                    </li>`).join('') : '<li class="log-status-empty">None</li>';
                
                return `
                    <div class="log-status-section">
                        <h4><i class="fas ${icon}"></i> ${title} (${members.length})</h4>
                        <ul class="log-status-list">${listItems}</ul>
                    </div>`;
            };

            contentContainer.innerHTML = `
                <div class="log-status-grid">
                    ${createListHTML('Logged Today', membersLogged, 'fa-check-circle status-logged', true)}
                    ${createListHTML('Pending Log', membersPending, 'fa-hourglass-half status-pending', false)}
                </div>
            `;
        }
    };
    
    const renderHeader = () => {
        const header = document.createElement('div');
        header.className = 'standup-header';
        
        const title = document.createElement('h3');
        title.innerHTML = '<i class="fas fa-users widget-icon"></i>Daily Standup';
        
        const datePicker = document.createElement('input');
        datePicker.type = 'date';
        datePicker.className = 'form-input form-input-sm';
        datePicker.value = selectedDate;
        datePicker.onchange = (e) => {
            selectedDate = e.target.value;
            rerenderContent();
        };
        
        header.append(title, datePicker);
        return header;
    };
    
    const renderTabs = () => {
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'standup-tabs';
        const attendanceTab = Button({
            children: 'Attendance',
            variant: activeTab === 'attendance' ? 'primary' : 'secondary',
            size: 'sm',
            className: 'standup-tab-btn',
            onClick: () => {
                if (activeTab === 'attendance') return;
                activeTab = 'attendance';
                updateTabs();
                rerenderContent();
            }
        });
        const logsTab = Button({
            children: 'Work Logs',
            variant: activeTab === 'logs' ? 'primary' : 'secondary',
            size: 'sm',
            className: 'standup-tab-btn',
            onClick: () => {
                if (activeTab === 'logs') return;
                activeTab = 'logs';
                updateTabs();
                rerenderContent();
            }
        });
        tabsContainer.append(attendanceTab, logsTab);
        return tabsContainer;
    };
    
    const updateTabs = () => {
        const buttons = container.querySelectorAll('.standup-tab-btn');
        if (buttons.length === 2) {
            buttons[0].className = `button button-${activeTab === 'attendance' ? 'primary' : 'secondary'} button-sm standup-tab-btn`;
            buttons[1].className = `button button-${activeTab === 'logs' ? 'primary' : 'secondary'} button-sm standup-tab-btn`;
        }
    };

    container.appendChild(renderHeader());
    container.appendChild(renderTabs());
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'standup-content';
    container.appendChild(contentDiv);
    
    rerenderContent();
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

function renderProjectInsights(props) {
    const { projects, workLogs, teamMembers } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-chart-pie widget-icon"></i>Project Insights</h3>';

    const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done);
    
    const content = document.createElement('div');
    content.className = 'widget-content project-insights-list';

    if (activeProjects.length === 0) {
        content.innerHTML = `<div class="activity-empty">No active projects.</div>`;
    } else {
        activeProjects.forEach(project => {
            const projectLogs = workLogs.filter(log => log.projectId === project.id);
            const totalMinutes = projectLogs.reduce((sum, log) => sum + log.timeSpentMinutes, 0);

            const contributionData = (project.assignees || [])
                .map(assigneeId => {
                    const memberMinutes = projectLogs
                        .filter(log => log.memberId === assigneeId)
                        .reduce((sum, log) => sum + log.timeSpentMinutes, 0);
                    return {
                        memberId: assigneeId,
                        memberName: teamMembers.find(tm => tm.id === assigneeId)?.name || 'Unknown',
                        percentage: totalMinutes > 0 ? (memberMinutes / totalMinutes) * 100 : 0
                    };
                })
                .filter(d => d.percentage > 0)
                .sort((a,b) => b.percentage - a.percentage);
            
            const insightItem = document.createElement('div');
            insightItem.className = 'insight-item';
            
            let contributionBarHTML = '<div class="insight-empty-bar">No hours logged yet.</div>';
            if (totalMinutes > 0) {
                contributionBarHTML = contributionData.map(d => 
                    `<div class="contribution-segment" style="width: ${d.percentage}%; background-color: ${getColorForId(d.memberId)};" title="${d.memberName}: ${d.percentage.toFixed(1)}%"></div>`
                ).join('');
            }
            
            let legendHTML = contributionData.length > 0
                ? contributionData.map(d => 
                    `<div class="insight-legend-item">
                        <span class="legend-color-box" style="background-color: ${getColorForId(d.memberId)};"></span>
                        ${d.memberName} (${d.percentage.toFixed(1)}%)
                    </div>`
                  ).join('')
                : '<span>No contributors yet.</span>';


            insightItem.innerHTML = `
                <div class="insight-header">
                    <span class="insight-project-name">${project.name}</span>
                    <span class="insight-total-hours">${formatMinutes(totalMinutes)} logged</span>
                </div>
                <div class="contribution-bar">${contributionBarHTML}</div>
                <div class="insight-legend">${legendHTML}</div>
            `;
            content.appendChild(insightItem);
        });
    }

    container.appendChild(content);
    return container;
}


// --- Member Dashboard Widgets ---

function createStatCard({ icon, label, value, detail, sparklineData }) {
    const card = document.createElement('div');
    card.className = 'member-stat-card';
    
    let detailHTML = detail ? `<p class="stat-card-detail">${detail}</p>` : '';
    let sparklineHTML = '';

    if (sparklineData) {
        // Simple SVG sparkline generation
        const points = sparklineData.points.map((p, i) => `${i * (100 / (sparklineData.points.length - 1))},${100 - p * (100 / sparklineData.max)}`).join(' ');
        sparklineHTML = `
            <div class="sparkline-container">
                <svg viewBox="0 0 100 100" class="sparkline-svg" preserveAspectRatio="none">
                    <polyline fill="none" stroke="${sparklineData.color || '#4f46e5'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
                </svg>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="stat-card-header">
            <div class="stat-card-icon"><i class="fas ${icon}"></i></div>
            <span class="stat-card-label">${label}</span>
        </div>
        <div class="stat-card-body">
            <p class="stat-card-value">${value}</p>
            ${detailHTML}
        </div>
        ${sparklineHTML}
    `;
    return card;
}

function renderMemberStats(props) {
    const { currentUser, workLogs, projects } = props;
    const container = document.createElement('div');
    container.className = 'member-stats-grid';

    // --- Stat Calculations ---
    const today = new Date();
    const startOfWeek = getStartOfWeek();

    // 1. Hours logged this week & sparkline data
    const weeklyLogs = workLogs.filter(log => log.memberId === currentUser.id && new Date(log.date) >= new Date(startOfWeek));
    const hoursThisWeek = weeklyLogs.reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    
    const dailyHours = Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(new Date(startOfWeek).getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        dailyHours[i] = weeklyLogs.filter(l => l.date === dateStr).reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0) / 60; // in hours
    }
    const maxDailyHours = Math.max(...dailyHours, 1); // Avoid division by zero

    // 2. Projects completed this week
    const projectsCompletedThisWeek = projects.filter(p => 
        (p.assignees || []).includes(currentUser.id) &&
        p.status === ProjectStatus.Done &&
        p.completionDate &&
        new Date(p.completionDate) >= new Date(startOfWeek)
    ).length;

    // 3. Overdue projects
    const overdueProjectsCount = projects.filter(p => 
        (p.assignees || []).includes(currentUser.id) && 
        p.status !== ProjectStatus.Done && 
        new Date(p.dueDate) < today
    ).length;

    // 4. Next deadline
    const nextDueProject = projects
        .filter(p => (p.assignees || []).includes(currentUser.id) && p.status !== ProjectStatus.Done && new Date(p.dueDate) >= today)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

    // --- Create Cards ---
    container.appendChild(createStatCard({
        icon: 'fa-clock',
        label: 'Time Logged This Week',
        value: formatMinutes(hoursThisWeek),
        sparklineData: {
            points: dailyHours,
            max: maxDailyHours,
            color: '#4f46e5'
        }
    }));
    
    container.appendChild(createStatCard({
        icon: 'fa-check-circle',
        label: 'Projects Completed',
        value: projectsCompletedThisWeek,
        detail: 'Since start of week'
    }));

    const overdueCard = createStatCard({
        icon: 'fa-exclamation-triangle',
        label: 'Overdue Projects',
        value: overdueProjectsCount,
        detail: overdueProjectsCount > 0 ? 'Action required' : 'All caught up!'
    });
    if (overdueProjectsCount > 0) overdueCard.classList.add('warning');
    container.appendChild(overdueCard);

    container.appendChild(createStatCard({
        icon: 'fa-calendar-check',
        label: 'Next Deadline',
        value: nextDueProject ? new Date(nextDueProject.dueDate + 'T00:00:00').toLocaleDateString() : 'N/A',
        detail: nextDueProject ? nextDueProject.name : 'No upcoming deadlines'
    }));

    return container;
}


function renderMyContributions(props) {
    const { currentUser, projects, workLogs } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-chart-line widget-icon"></i>My Contributions</h3>';
    
    const myActiveProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id) && p.status !== 'Done');

    const list = document.createElement('ul');
    list.className = 'contributions-list';

    if (myActiveProjects.length === 0) {
        list.innerHTML = `<li class="activity-empty">You have no active projects.</li>`;
    } else {
        myActiveProjects.forEach(project => {
            const projectLogs = workLogs.filter(log => log.projectId === project.id);
            const totalProjectMinutes = projectLogs.reduce((sum, log) => sum + log.timeSpentMinutes, 0);
            const myMinutes = projectLogs.filter(log => log.memberId === currentUser.id).reduce((sum, log) => sum + log.timeSpentMinutes, 0);
            const myImpact = totalProjectMinutes > 0 ? (myMinutes / totalProjectMinutes) * 100 : 0;

            list.innerHTML += `
                <li class="contribution-item">
                    <span class="contribution-project-name">${project.name}</span>
                    <div class="contribution-stats">
                        <div class="contribution-stat-item">
                            <span class="label">My Hours</span>
                            <span class="value">${formatMinutes(myMinutes)}</span>
                        </div>
                        <div class="contribution-stat-item">
                            <span class="label">My Impact</span>
                            <span class="value">${myImpact.toFixed(0)}%</span>
                        </div>
                    </div>
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
    container.appendChild(renderManagerKPIs(props));
    
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout';
    
    const mainCol = document.createElement('div');
    mainCol.className = 'dashboard-main-col';
    mainCol.appendChild(renderDailyStandup(props));
    mainCol.appendChild(renderActivityFeed(props));

    const sideCol = document.createElement('div');
    sideCol.className = 'dashboard-side-col';
    sideCol.appendChild(renderProjectInsights(props));

    layout.append(mainCol, sideCol);
    container.appendChild(layout);
}

function renderMemberDashboard(container, props) {
    const { currentUser } = props;
    
    const welcomeHeader = document.createElement('div');
    welcomeHeader.className = 'member-welcome-header';

    const welcomeText = document.createElement('h2');
    welcomeText.innerHTML = `Welcome back, <strong>${currentUser.name.split(' ')[0]}</strong>!`;
    
    const welcomeActions = document.createElement('div');
    welcomeActions.className = 'member-hero-actions'; // reuse class
    welcomeActions.append(
        Button({
            children: 'Log My Work',
            leftIcon: '<i class="fas fa-plus"></i>',
            onClick: () => openModal('worklog', props)
        }),
        Button({
            children: 'Add a Note',
            variant: 'secondary',
            leftIcon: '<i class="fas fa-sticky-note"></i>',
            onClick: () => openModal('note', props)
        })
    );
    welcomeHeader.append(welcomeText, welcomeActions);
    container.appendChild(welcomeHeader);

    container.appendChild(renderMemberStats(props));
    
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout-member';
    
    layout.appendChild(renderMyContributions(props));
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
