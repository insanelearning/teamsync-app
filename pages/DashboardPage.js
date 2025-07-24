

import { TeamMemberRole, ProjectStatus } from '../types.js';
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { NoteForm } from '../components/NoteForm.js';
import { CelebrationsWidget } from '../components/CelebrationsWidget.js';
import { WeeklyHoursDetailModal } from '../components/WeeklyHoursDetailModal.js';


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
    return new Date(new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0));
}

/**
 * Checks team members for any birthdays or work anniversaries occurring today.
 * @param {Array} teamMembers - The list of all team members.
 * @returns {Array} A list of celebration objects.
 */
function getTodaysCelebrations(teamMembers) {
    const celebrations = [];
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // getMonth() is 0-indexed
    const todayDate = today.getDate();
    const todayYear = today.getFullYear();
    const todayMMDD = `${String(todayMonth).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

    teamMembers.forEach(member => {
        // Check for birthday
        if (member.birthDate) {
            const birthDate = new Date(member.birthDate + 'T00:00:00');
            const birthMonth = birthDate.getMonth() + 1;
            const birthDay = birthDate.getDate();
            const birthMMDD = `${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
            if (birthMMDD === todayMMDD) {
                celebrations.push({
                    type: 'birthday',
                    memberName: member.name
                });
            }
        }

        // Check for work anniversary
        if (member.joinDate) {
            const joinDate = new Date(member.joinDate + 'T00:00:00');
            const joinMonth = joinDate.getMonth() + 1;
            const joinDay = joinDate.getDate();
            const joinYear = joinDate.getFullYear();
            const joinMMDD = `${String(joinMonth).padStart(2, '0')}-${String(joinDay).padStart(2, '0')}`;
            
            if (joinMMDD === todayMMDD && joinYear < todayYear) {
                const yearsOfService = todayYear - joinYear;
                celebrations.push({
                    type: 'anniversary',
                    memberName: member.name,
                    years: yearsOfService
                });
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

    const startOfWeekDate = getStartOfWeek();
    const startOfWeekString = startOfWeekDate.toISOString().split('T')[0];

    const hoursThisWeek = workLogs
        .filter(log => log.date >= startOfWeekString)
        .reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    
    const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done).length;
    const overdueProjects = projects.filter(p => p.status !== ProjectStatus.Done && new Date(p.dueDate) < new Date());
    
    const today = new Date().toISOString().split('T')[0];
    const onLeaveRecords = attendanceRecords.filter(r => r.date === today && r.status === 'Leave');
    const membersOnLeave = onLeaveRecords.map(record => {
        const member = teamMembers.find(tm => tm.id === record.memberId);
        return {
            name: member ? member.name : 'Unknown Member',
            leaveType: record.leaveType || 'Not specified'
        };
    });

    const kpis = [
        { value: formatMinutes(hoursThisWeek), label: 'Hours This Week', icon: 'fa-clock', type: 'hours' },
        { value: activeProjects, label: 'Active Projects', icon: 'fa-tasks', type: 'active' },
        { value: overdueProjects.length, label: 'Overdue', icon: 'fa-exclamation-triangle', type: 'overdue', data: overdueProjects },
        { value: membersOnLeave.length, label: 'On Leave Today', icon: 'fa-user-slash', type: 'leave', data: membersOnLeave }
    ];

    kpis.forEach(kpi => {
        const card = document.createElement('div');
        card.className = 'kpi-card';
        card.innerHTML = `
            <div class="kpi-icon">
                <i class="fas ${kpi.icon}"></i>
            </div>
            <div>
                <div class="kpi-value">${kpi.value}</div>
                <div class="kpi-label">${kpi.label}</div>
            </div>
        `;
        
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
    let activeTab = 'attendance';

    const rerenderContent = () => {
        const contentContainer = container.querySelector('.standup-content');
        const tabsContainer = container.querySelector('.standup-tabs');
        if (!contentContainer || !tabsContainer) return;

        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const holiday = (holidays || []).find(h => h.date === selectedDate);
        const isNonWorkingDay = isWeekend || !!holiday;

        if (isNonWorkingDay) {
            tabsContainer.style.display = 'none';
            contentContainer.innerHTML = `
                <div class="attendance-card-non-working-status" style="margin-top: 1rem;">
                    ${holiday 
                        ? `<i class="fas fa-calendar-star"></i> Holiday: ${holiday.name}` 
                        : `<i class="fas fa-bed"></i> Week Off`}
                </div>
            `;
            return;
        }

        tabsContainer.style.display = 'flex';
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
            
            const onLeaveMemberIds = new Set(
                attendanceRecords
                    .filter(r => r.date === selectedDate && r.status === 'Leave')
                    .map(r => r.memberId)
            );

            const memberTimeMap = new Map();
            logsForDate.forEach(log => {
                const currentMins = memberTimeMap.get(log.memberId) || 0;
                memberTimeMap.set(log.memberId, currentMins + log.timeSpentMinutes);
            });

            const membersLogged = teamMembers.filter(m => loggedMemberIds.has(m.id));
            const membersPending = teamMembers.filter(m => !loggedMemberIds.has(m.id) && !onLeaveMemberIds.has(m.id));
            
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
    const { workLogs, projects, teamMembers, activities } = props;
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

    const loginEvents = (activities || []).filter(a => a.type === 'login').map(a => ({
        type: 'login',
        date: new Date(a.timestamp),
        text: `<strong>${getMemberName(a.userId)}</strong> logged in.`
    }));


    const allEvents = [...workLogEvents, ...projectEvents, ...loginEvents]
        .sort((a,b) => b.date - a.date)
        .slice(0, 10); // Limit to latest 10 activities

    const list = document.createElement('ul');
    list.className = 'activity-feed';
    if (allEvents.length === 0) {
        list.innerHTML = `<li class="activity-empty">No recent activity to show.</li>`;
    } else {
        allEvents.forEach(event => {
            const li = document.createElement('li');
            li.className = `activity-item type-${event.type}`;
            const iconMap = {
                log: 'fa-clock',
                completion: 'fa-check-circle',
                login: 'fa-sign-in-alt'
            };
            li.innerHTML = `
                <div class="activity-icon"><i class="fas ${iconMap[event.type]}"></i></div>
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

    let selectedDateFilter = null;

    const rerenderInsights = () => {
        const content = container.querySelector('.project-insights-list');
        if (!content) return;
        content.innerHTML = '';
        
        const dateTitle = selectedDateFilter
            ? ` for ${new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString()}`
            : ' (All Time)';
        
        container.querySelector('.widget-header h3').innerHTML = `<i class="fas fa-chart-pie widget-icon"></i>Project Contributions${dateTitle}`;

        const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done && p.status !== ProjectStatus.ToDo);
        
        if (activeProjects.length === 0) {
            content.innerHTML = `<div class="activity-empty">No projects in progress.</div>`;
            return;
        }

        activeProjects.forEach(project => {
            const allProjectLogs = workLogs.filter(log => log.projectId === project.id);
            const logsForDate = selectedDateFilter ? allProjectLogs.filter(log => log.date === selectedDateFilter) : allProjectLogs;
            
            const totalMinutes = logsForDate.reduce((sum, log) => sum + log.timeSpentMinutes, 0);

            const contributionData = (project.assignees || [])
                .map(assigneeId => {
                    const member = teamMembers.find(tm => tm.id === assigneeId);
                    if (!member) return null;
                    const memberMinutes = logsForDate
                        .filter(log => log.memberId === assigneeId)
                        .reduce((sum, log) => sum + log.timeSpentMinutes, 0);
                    return {
                        memberId: assigneeId,
                        memberName: member.name,
                        memberColor: member.color || '#9ca3af',
                        percentage: totalMinutes > 0 ? (memberMinutes / totalMinutes) * 100 : 0
                    };
                })
                .filter(d => d && d.percentage > 0)
                .sort((a, b) => b.percentage - a.percentage);

            const insightItem = document.createElement('div');
            insightItem.className = 'insight-item';

            let contributionBarHTML = '<div class="insight-empty-bar">No hours logged.</div>';
            if (totalMinutes > 0) {
                contributionBarHTML = contributionData.map(d =>
                    `<div class="contribution-segment" style="width: ${d.percentage}%; background-color: ${d.memberColor};" title="${d.memberName}: ${d.percentage.toFixed(1)}%"></div>`
                ).join('');
            }

            let legendHTML = contributionData.length > 0
                ? contributionData.map(d =>
                    `<div class="insight-legend-item">
                        <span class="legend-color-box" style="background-color: ${d.memberColor};"></span>
                        ${d.memberName} (${d.percentage.toFixed(1)}%)
                    </div>`
                ).join('')
                : '<span>No contributors.</span>';

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
    };

    const header = document.createElement('div');
    header.className = 'widget-header';
    header.innerHTML = `<h3><i class="fas fa-chart-pie widget-icon"></i>Project Insights</h3>`;
    
    const controls = document.createElement('div');
    controls.className = 'project-insights-controls';
    
    const datePicker = document.createElement('input');
    datePicker.type = 'date';
    datePicker.className = 'form-input';
    datePicker.onchange = (e) => {
        selectedDateFilter = e.target.value;
        rerenderInsights();
    };

    const showAllBtn = Button({
        children: 'Show All',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
            selectedDateFilter = null;
            datePicker.value = '';
            rerenderInsights();
        }
    });

    controls.append(datePicker, showAllBtn);
    header.appendChild(controls);
    container.appendChild(header);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'widget-content project-insights-list';
    container.appendChild(contentDiv);
    
    rerenderInsights();
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
    const startOfWeekDate = getStartOfWeek();
    const startOfWeekString = startOfWeekDate.toISOString().split('T')[0];


    // 1. Hours logged this week & sparkline data
    const weeklyLogs = workLogs.filter(log => log.memberId === currentUser.id && log.date >= startOfWeekString);
    const hoursThisWeek = weeklyLogs.reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    
    const dailyHours = Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeekDate);
        d.setDate(startOfWeekDate.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        dailyHours[i] = weeklyLogs.filter(l => l.date === dateStr).reduce((sum, l) => sum + (l.timeSpentMinutes || 0), 0) / 60; // in hours
    }
    const maxDailyHours = Math.max(...dailyHours, 1); // Avoid division by zero

    // 2. Projects completed this week
    const projectsCompletedThisWeek = projects.filter(p => 
        (p.assignees || []).includes(currentUser.id) &&
        p.status === ProjectStatus.Done &&
        p.completionDate &&
        p.completionDate >= startOfWeekString
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
        .sort((a,b) => new Date(
