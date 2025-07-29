import { TeamMemberRole, ProjectStatus } from '../types.js';
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


// --- Manager Dashboard Widgets ---

function renderManagerKPIs(props, onKpiClick) {
    const { projects, workLogs, teamMembers, attendanceRecords } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-kpis';

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
        { value: overdueProjects.length, label: 'Overdue', icon: 'fa-exclamation-triangle', type: 'overdue', data: overdueProjects },
        { value: membersOnLeave.length, label: 'On Leave Today', icon: 'fa-user-slash', type: 'leave', data: membersOnLeave }
    ];

    kpis.forEach(kpi => {
        const card = document.createElement('div');
        card.className = 'kpi-card';
        card.innerHTML = `<div class="kpi-icon"><i class="fas ${kpi.icon}"></i></div><div><div class="kpi-value">${kpi.value}</div><div class="kpi-label">${kpi.label}</div></div>`;
        if (kpi.type === 'hours' || ((kpi.type === 'overdue' || kpi.type === 'leave') && kpi.data.length > 0)) {
            card.classList.add('clickable');
            card.addEventListener('click', () => onKpiClick(kpi, props));
        }
        container.appendChild(card);
    });
    return container;
}

function renderDailyStandup(props) {
    const { teamMembers, attendanceRecords, workLogs, holidays } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    let selectedDate = new Date().toISOString().split('T')[0];
    let activeTab = 'attendance'; // 'attendance' or 'worklogs'

    const contentDiv = document.createElement('div');
    contentDiv.className = 'standup-content';

    const rerenderContent = () => {
        contentDiv.innerHTML = ''; // Clear previous content

        const dateObj = new Date(selectedDate + 'T00:00:00');
        const isWeekend = [0, 6].includes(dateObj.getDay());
        const holiday = (holidays || []).find(h => h.date === selectedDate);

        if (isWeekend || holiday) {
            contentDiv.innerHTML = `<div class="attendance-card-non-working-status" style="margin-top: 1rem;">${holiday ? `<i class="fas fa-calendar-star"></i> Holiday: ${holiday.name}` : `<i class="fas fa-bed"></i> Week Off`}</div>`;
            return;
        }

        const todaysRecords = attendanceRecords.filter(r => r.date === selectedDate);

        if (activeTab === 'attendance') {
            const stats = { present: 0, wfh: 0, leave: 0, notMarked: 0 };
            
            teamMembers.forEach(member => {
                const record = todaysRecords.find(r => r.memberId === member.id);
                if (!record) stats.notMarked++;
                else if (record.status === 'Present') stats.present++;
                else if (record.status === 'Work From Home') stats.wfh++;
                else if (record.status === 'Leave') {
                    stats.leave++;
                }
            });
            
            contentDiv.innerHTML = `
                <div class="attendance-stats">
                    <div class="stat-item" title="Present"><i class="fas fa-user-check" style="color: #22c55e;"></i> ${stats.present} Present</div>
                    <div class="stat-item" title="Work From Home"><i class="fas fa-laptop-house" style="color: #3b82f6;"></i> ${stats.wfh} WFH</div>
                    <div class="stat-item" title="On Leave"><i class="fas fa-umbrella-beach" style="color: #f97316;"></i> ${stats.leave} On Leave</div>
                    <div class="stat-item" title="Not Marked"><i class="fas fa-question-circle" style="color: #6b7280;"></i> ${stats.notMarked} Not Marked</div>
                </div>
            `;
        } else { // 'worklogs' tab
            const logsForDate = workLogs.filter(log => log.date === selectedDate);
            const memberTimeMap = logsForDate.reduce((acc, log) => {
                acc[log.memberId] = (acc[log.memberId] || 0) + (parseFloat(log.timeSpentMinutes) || 0);
                return acc;
            }, {});
            
            const listItemsHtml = teamMembers.map(m => {
                const record = todaysRecords.find(r => r.memberId === m.id);
                const logStatusHtml = memberTimeMap[m.id] 
                    ? `<span class="log-status-time">${formatMinutes(memberTimeMap[m.id])}</span>` 
                    : (record && record.status === 'Leave') 
                        ? `<span style="font-size:0.8rem;color:#f97316;">On Leave</span>`
                        : `<span style="font-size:0.8rem;color:#f97316;">Pending</span>`;

                return `
                    <li class="log-status-item">
                        <span>${m.name}</span>
                        ${logStatusHtml}
                    </li>`;
            }).join('');

            contentDiv.innerHTML = `
                <h4 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin: 0 0 0.5rem 0;">Work Log Status</h4>
                <ul class="log-status-list">${listItemsHtml}</ul>`;
        }
    };

    const header = document.createElement('div');
    header.className = 'standup-header';
    
    const title = document.createElement('h3');
    title.innerHTML = `<i class="fas fa-users widget-icon"></i>Daily Standup`;
    header.appendChild(title);

    const controlsWrapper = document.createElement('div');
    controlsWrapper.style.display = 'flex';
    controlsWrapper.style.alignItems = 'center';
    controlsWrapper.style.gap = '1rem';

    // Toggle Switch
    const viewToggleGroup = document.createElement('div');
    viewToggleGroup.className = 'view-toggle-group';
    const attendanceBtn = document.createElement('button');
    attendanceBtn.className = 'view-toggle-button active';
    attendanceBtn.textContent = 'Attendance';
    const workLogsBtn = document.createElement('button');
    workLogsBtn.className = 'view-toggle-button';
    workLogsBtn.textContent = 'Work Logs';

    attendanceBtn.onclick = () => {
        if (activeTab === 'attendance') return;
        activeTab = 'attendance';
        attendanceBtn.classList.add('active');
        workLogsBtn.classList.remove('active');
        rerenderContent();
    };
    workLogsBtn.onclick = () => {
        if (activeTab === 'worklogs') return;
        activeTab = 'worklogs';
        workLogsBtn.classList.add('active');
        attendanceBtn.classList.remove('active');
        rerenderContent();
    };
    viewToggleGroup.append(attendanceBtn, workLogsBtn);
    controlsWrapper.appendChild(viewToggleGroup);

    // Date Picker
    const datePicker = document.createElement('input');
    datePicker.type = 'date';
    datePicker.className = 'form-input form-input-sm';
    datePicker.value = selectedDate;
    datePicker.onchange = (e) => {
        selectedDate = e.target.value;
        rerenderContent();
    };
    controlsWrapper.appendChild(datePicker);
    
    header.appendChild(controlsWrapper);
    container.appendChild(header);

    container.appendChild(contentDiv);
    
    rerenderContent(); // Initial render
    return container;
}

function renderActivityFeed(props) {
    const { workLogs, projects, teamMembers, activities } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-stream widget-icon"></i>Team Activity</h3>';

    const getMemberName = (id) => teamMembers.find(m => m.id === id)?.name || 'Unknown';
    const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'a project';
    
    const events = [
        ...workLogs.map(log => ({ type: 'log', date: new Date(log.updatedAt), text: `<strong>${getMemberName(log.memberId)}</strong> logged ${formatMinutes(log.timeSpentMinutes)} on <em>${getProjectName(log.projectId)}</em>.` })),
        ...projects.filter(p => p.status === ProjectStatus.Done && p.completionDate).map(p => ({ type: 'completion', date: new Date(p.completionDate), text: `<strong>${(p.assignees || []).map(getMemberName).join(', ')}</strong> completed project <em>${p.name}</em>.` })),
        ...(activities || []).filter(a => a.type === 'login').map(a => ({ type: 'login', date: new Date(a.timestamp), text: `<strong>${getMemberName(a.userId)}</strong> logged in.` }))
    ].sort((a, b) => b.date - a.date).slice(0, 10);

    const list = document.createElement('ul');
    list.className = 'activity-feed';
    if (events.length === 0) {
        list.innerHTML = `<li class="activity-empty">No recent activity.</li>`;
    } else {
        const iconMap = { log: 'fa-clock', completion: 'fa-check-circle', login: 'fa-sign-in-alt' };
        list.innerHTML = events.map(event => {
            const isValidDate = event.date instanceof Date && !isNaN(event.date);
            const dateString = isValidDate ? event.date.toLocaleString() : 'Date not available';
            return `
            <li class="activity-item type-${event.type}">
                <div class="activity-icon"><i class="fas ${iconMap[event.type]}"></i></div>
                <div class="activity-text">${event.text}</div>
                <div class="activity-time">${dateString}</div>
            </li>`;
        }).join('');
    }
    container.appendChild(list);
    return container;
}

function renderProjectInsights(props) {
    const { projects, workLogs, teamMembers } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    let selectedDateFilter = null;

    const rerenderInsights = () => {
        const content = container.querySelector('.project-insights-list');
        if (!content) return;
        content.innerHTML = '';
        
        const dateTitle = selectedDateFilter ? ` for ${new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString()}` : ' (All Time)';
        container.querySelector('.widget-header h3').innerHTML = `<i class="fas fa-chart-pie widget-icon"></i>Project Contributions${dateTitle}`;

        const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done && p.status !== ProjectStatus.ToDo);
        
        if (activeProjects.length === 0) {
            content.innerHTML = `<div class="activity-empty">No projects in progress.</div>`;
            return;
        }

        activeProjects.forEach(project => {
            const logsForDate = selectedDateFilter ? workLogs.filter(log => log.projectId === project.id && log.date === selectedDateFilter) : workLogs.filter(log => log.projectId === project.id);
            const totalMinutes = logsForDate.reduce((sum, log) => sum + (parseFloat(log.timeSpentMinutes) || 0), 0);

            const contributionData = (project.assignees || []).map(id => {
                const member = teamMembers.find(tm => tm.id === id);
                if (!member) return null;
                const memberMinutes = logsForDate.filter(log => log.memberId === id).reduce((sum, log) => sum + (parseFloat(log.timeSpentMinutes) || 0), 0);
                return { name: member.name, color: member.color, percentage: totalMinutes > 0 ? (memberMinutes / totalMinutes) * 100 : 0 };
            }).filter(d => d && d.percentage > 0).sort((a, b) => b.percentage - a.percentage);

            const insightItem = document.createElement('div');
            insightItem.className = 'insight-item';
            insightItem.innerHTML = `
                <div class="insight-header"><span class="insight-project-name">${project.name}</span><span class="insight-total-hours">${formatMinutes(totalMinutes)} logged</span></div>
                <div class="contribution-bar">${totalMinutes > 0 ? contributionData.map(d => `<div class="contribution-segment" style="width: ${d.percentage}%; background-color: ${d.color};" title="${d.name}: ${d.percentage.toFixed(1)}%"></div>`).join('') : '<div class="insight-empty-bar">No hours logged.</div>'}</div>
                <div class="insight-legend">${contributionData.length > 0 ? contributionData.map(d => `<div class="insight-legend-item"><span class="legend-color-box" style="background-color: ${d.color};"></span> ${d.name} (${d.percentage.toFixed(1)}%)</div>`).join('') : '<span>No contributors.</span>'}</div>`;
            content.appendChild(insightItem);
        });
    };

    const datePicker = document.createElement('input');
    datePicker.type = 'date';
    datePicker.className = 'form-input';
    datePicker.onchange = (e) => { selectedDateFilter = e.target.value; rerenderInsights(); };
    const showAllBtn = Button({ children: 'Show All', variant: 'secondary', size: 'sm', onClick: () => { selectedDateFilter = null; datePicker.value = ''; rerenderInsights(); } });
    
    const header = document.createElement('div');
    header.className = 'widget-header';
    header.innerHTML = `<h3><i class="fas fa-chart-pie widget-icon"></i>Project Contributions</h3>`;
    const controls = document.createElement('div');
    controls.className = 'project-insights-controls';
    controls.append(datePicker, showAllBtn);
    header.appendChild(controls);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'widget-content project-insights-list';

    container.append(header, contentDiv);
    rerenderInsights();
    return container;
}


// --- Member Dashboard Widgets ---

function renderMemberStats(props) {
    const { currentUser, workLogs, projects } = props;
    const container = document.createElement('div');
    container.className = 'member-stats-grid';

    const startOfWeekString = getStartOfWeek().toISOString().split('T')[0];
    const myWeeklyLogs = workLogs.filter(log => log.memberId === currentUser.id && log.date >= startOfWeekString);
    const myActiveProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id) && p.status !== 'Done');
    const myOverdueCount = myActiveProjects.filter(p => new Date(p.dueDate) < new Date()).length;
    const nextDeadline = myActiveProjects.filter(p => new Date(p.dueDate) >= new Date()).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    
    const myWeeklyMinutes = myWeeklyLogs.reduce((sum, log) => sum + (parseFloat(log.timeSpentMinutes) || 0), 0);

    container.innerHTML = `
        <div class="member-stat-card"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-clock"></i></div><span class="stat-card-label">Time Logged (Week)</span></div><div class="stat-card-body"><p class="stat-card-value">${formatMinutes(myWeeklyMinutes)}</p></div></div>
        <div class="member-stat-card"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-tasks"></i></div><span class="stat-card-label">Active Projects</span></div><div class="stat-card-body"><p class="stat-card-value">${myActiveProjects.length}</p></div></div>
        <div class="member-stat-card ${myOverdueCount > 0 ? 'warning' : ''}"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-exclamation-triangle"></i></div><span class="stat-card-label">Overdue</span></div><div class="stat-card-body"><p class="stat-card-value">${myOverdueCount}</p></div></div>
        <div class="member-stat-card"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-calendar-check"></i></div><span class="stat-card-label">Next Deadline</span></div><div class="stat-card-body"><p class="stat-card-value">${nextDeadline ? new Date(nextDeadline.dueDate + 'T00:00').toLocaleDateString() : 'N/A'}</p><p class="stat-card-detail">${nextDeadline?.name || 'All clear!'}</p></div></div>`;
    return container;
}

function renderMyContributions(props) {
    const { currentUser, workLogs, projects } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = '<h3><i class="fas fa-history widget-icon"></i>My Contributions (This Week)</h3>';

    const startOfWeekString = getStartOfWeek().toISOString().split('T')[0];
    const myWeeklyLogs = workLogs.filter(log => log.memberId === currentUser.id && log.date >= startOfWeekString);
    
    const projectContributionMap = myWeeklyLogs.reduce((acc, log) => {
        acc[log.projectId] = (acc[log.projectId] || 0) + (parseFloat(log.timeSpentMinutes) || 0);
        return acc;
    }, {});

    if (Object.keys(projectContributionMap).length === 0) {
        container.innerHTML += `<p class="activity-empty">No hours logged this week.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'contributions-list';
        for (const projectId in projectContributionMap) {
            const projectName = projects.find(p => p.id === projectId)?.name || 'Unknown Project';
            const item = document.createElement('li');
            item.className = 'contribution-item';
            item.innerHTML = `<span class="contribution-project-name">${projectName}</span>
            <div class="contribution-stats"><div class="contribution-stat-item"><div class="label">Time Logged</div><div class="value">${formatMinutes(projectContributionMap[projectId])}</div></div></div>`;
            list.appendChild(item);
        }
        container.appendChild(list);
    }
    return container;
}

function renderMyRecentNotes(props) {
    const { notes } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = `<h3><i class="fas fa-sticky-note widget-icon"></i>My Recent Notes</h3>`;
    
    const recentNotes = notes
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5);

    if (recentNotes.length === 0) {
        container.innerHTML += `<p class="activity-empty">No notes yet.</p>`;
    } else {
        const list = document.createElement('ul');
        list.className = 'widget-list-condensed';
        recentNotes.forEach(note => {
            const item = document.createElement('li');
            item.className = 'list-item';
            item.innerHTML = `<span class="item-title">${note.title}</span><span class="item-meta">${new Date(note.updatedAt).toLocaleDateString()}</span>`;
            list.appendChild(item);
        });
        container.appendChild(list);
    }
    return container;
}


// --- Dashboard Main Render Functions ---

function renderManagerDashboard(container, props) {
    const celebrations = getTodaysCelebrations(props.teamMembers);
    if (celebrations.length > 0) {
        container.appendChild(CelebrationsWidget({ celebrations }));
    }

    const onKpiClick = (kpi, allProps) => {
        let title = '', content = document.createElement('ul'), size = 'md';
        content.className = 'kpi-modal-list';

        if (kpi.type === 'hours') {
            content = WeeklyHoursDetailModal({ ...allProps, startOfWeek: getStartOfWeek() });
            title = 'Weekly Hours Breakdown';
            size = 'lg';
        } else if (kpi.type === 'overdue') {
            title = 'Overdue Projects';
            content.innerHTML = kpi.data.map(p => `<li class="kpi-modal-list-item"><strong>${p.name}</strong><span>Due: ${new Date(p.dueDate).toLocaleDateString()}</span></li>`).join('');
        } else if (kpi.type === 'leave') {
            title = 'Members On Leave Today';
            content.innerHTML = kpi.data.map(m => `<li class="kpi-modal-list-item"><strong>${m.name}</strong><span>${m.leaveType}</span></li>`).join('');
        }
        
        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title,
            children: content,
            footer: [Button({ children: 'Close', variant: 'secondary', onClick: closeModal })],
            size
        });
    };

    container.appendChild(renderManagerKPIs(props, onKpiClick));

    const layout = document.createElement('div');
    layout.className = 'dashboard-layout';
    const mainCol = document.createElement('div');
    mainCol.className = 'dashboard-main-col';
    const sideCol = document.createElement('div');
    sideCol.className = 'dashboard-side-col';
    
    mainCol.append(renderDailyStandup(props), renderProjectInsights(props));
    sideCol.appendChild(renderActivityFeed(props));

    layout.append(mainCol, sideCol);
    container.appendChild(layout);
}

function renderMemberDashboard(container, props) {
    const { currentUser, onAddMultipleWorkLogs, onAddNote, workLogTasks, appSettings } = props;

    const onAddLogClick = () => {
        const form = WorkLogForm({
            log: null, ...props,
            onSaveAll: (logsData) => { onAddMultipleWorkLogs(logsData); closeModal(); },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add Work Log', children: form, size: 'xl' });
    };

    const onAddNoteClick = () => {
        const form = NoteForm({
            note: null,
            onSave: (noteData) => { onAddNote(noteData); closeModal(); },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add New Note', children: form, size: 'lg' });
    };

    const header = document.createElement('div');
    header.className = 'member-welcome-header';
    header.innerHTML = `<h2>${appSettings.welcomeMessage || 'Welcome back,'} ${currentUser.name.split(' ')[0]}!</h2>`;
    const actions = document.createElement('div');
    actions.className = 'member-hero-actions';
    actions.append(
        Button({ children: 'Add Work Log', leftIcon: '<i class="fas fa-clock"></i>', onClick: onAddLogClick }),
        Button({ children: 'Add Note', variant: 'secondary', leftIcon: '<i class="fas fa-plus"></i>', onClick: onAddNoteClick })
    );
    header.appendChild(actions);
    container.appendChild(header);

    container.appendChild(renderMemberStats(props));

    const celebrations = getTodaysCelebrations(props.teamMembers);
    if (celebrations.length > 0) {
        container.appendChild(CelebrationsWidget({ celebrations }));
    }

    const memberWidgetsLayout = document.createElement('div');
    memberWidgetsLayout.className = 'dashboard-layout-member';
    memberWidgetsLayout.append(renderMyContributions(props), renderMyRecentNotes(props));
    container.appendChild(memberWidgetsLayout);
}

export function renderDashboardPage(container, props) {
    container.innerHTML = '';

    // Create a wrapper div to ensure the consistent boxed layout
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container dashboard-page';

    if (props.currentUser.role === TeamMemberRole.Manager) {
        renderManagerDashboard(pageWrapper, props);
    } else {
        renderMemberDashboard(pageWrapper, props);
    }

    container.appendChild(pageWrapper);
}
