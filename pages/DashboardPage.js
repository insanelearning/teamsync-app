
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
    if (isNaN(minutes) || minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
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
    const hoursThisWeek = workLogs.filter(log => log.date >= startOfWeekString).reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
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
                acc[log.memberId] = (acc[log.memberId] || 0) + log.timeSpentMinutes;
                return acc;
            }, {});

            contentDiv.innerHTML = `
                <h4 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin: 0 0 0.5rem 0;">Work Log Status</h4>
                <ul class="log-status-list">
                    ${teamMembers.map(m => `
                        <li class="log-status-item">
                            <span>${m.name}</span>
                            ${memberTimeMap[m.id] ? `<span class="log-status-time">${formatMinutes(memberTimeMap[m.id])}</span>` : `<span style="font-size:0.8rem;color:#f97316;">Pending</span>`}
                        </li>`).join('')}
                </ul>`;
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
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'form-input form-input-sm';
    dateInput.value = selectedDate;
    dateInput.onchange = (e) => {
        selectedDate = e.target.value;
        rerenderContent();
    };
    controlsWrapper.appendChild(dateInput);

    header.appendChild(controlsWrapper);
    container.append(header, contentDiv);
    rerenderContent();
    return container;
}

function renderActivityFeed(props) {
    const { activities, teamMembers } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = `<h3><i class="fas fa-stream widget-icon"></i>Recent Activity</h3>`;

    const feedList = document.createElement('ul');
    feedList.className = 'activity-feed';
    
    const sortedActivities = activities.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10); // Get latest 10

    if (sortedActivities.length === 0) {
        feedList.innerHTML = `<li class="activity-empty">No recent activity.</li>`;
    } else {
        sortedActivities.forEach(activity => {
            const member = teamMembers.find(m => m.id === activity.userId);
            if (!member) return;

            const item = document.createElement('li');
            item.className = 'activity-item';
            
            let icon = 'fa-bell';
            let text = 'did something.';
            let typeClass = 'type-default';

            if (activity.type === 'login') {
                icon = 'fa-sign-in-alt';
                text = 'logged in.';
                typeClass = 'type-login';
            }
            // Add other activity types here if needed

            const timeAgo = new Date(activity.timestamp).toLocaleString();

            item.innerHTML = `
                <div class="activity-icon"><i class="fas ${icon}"></i></div>
                <div class="activity-text"><strong>${member.name}</strong> ${text}</div>
                <time class="activity-time">${timeAgo}</time>
            `;
            item.classList.add(typeClass);
            feedList.appendChild(item);
        });
    }

    container.appendChild(feedList);
    return container;
}

function renderProjectInsights(props) {
    const { projects, workLogs, teamMembers } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';

    const header = document.createElement('div');
    header.className = 'project-insights-header';
    header.innerHTML = `<h3><i class="fas fa-chart-pie widget-icon"></i>Project Contribution</h3>`;
    // Add controls here if needed, e.g., date range
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'project-insights-list';

    // Get top 5 active projects by recent activity
    const recentLogs = workLogs.filter(l => new Date(l.date) > new Date(new Date().setDate(new Date().getDate() - 30)));
    const projectActivity = recentLogs.reduce((acc, log) => {
        acc[log.projectId] = (acc[log.projectId] || 0) + log.timeSpentMinutes;
        return acc;
    }, {});
    
    const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done)
        .sort((a,b) => (projectActivity[b.id] || 0) - (projectActivity[a.id] || 0))
        .slice(0, 5);

    if (activeProjects.length === 0) {
        list.innerHTML = `<p class="log-status-empty">No active projects with logged hours in the last 30 days.</p>`;
    }

    activeProjects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'insight-item';
        
        const logsForProject = recentLogs.filter(l => l.projectId === project.id);
        const totalMinutes = logsForProject.reduce((sum, l) => sum + l.timeSpentMinutes, 0);

        const memberContributions = logsForProject.reduce((acc, log) => {
            const memberId = log.memberId;
            acc[memberId] = (acc[memberId] || 0) + log.timeSpentMinutes;
            return acc;
        }, {});

        projectItem.innerHTML = `
            <div class="insight-header">
                <span class="insight-project-name">${project.name}</span>
                <span class="insight-total-hours">Total: ${formatMinutes(totalMinutes)}</span>
            </div>
        `;
        
        const bar = document.createElement('div');
        bar.className = 'contribution-bar';

        if (totalMinutes > 0) {
            Object.entries(memberContributions).forEach(([memberId, minutes]) => {
                const member = teamMembers.find(m => m.id === memberId);
                if (!member) return;
                const segment = document.createElement('div');
                segment.className = 'contribution-segment';
                segment.style.width = `${(minutes / totalMinutes) * 100}%`;
                segment.style.backgroundColor = member.color;
                segment.title = `${member.name}: ${formatMinutes(minutes)}`;
                bar.appendChild(segment);
            });
        } else {
            bar.innerHTML = `<div class="insight-empty-bar">No hours logged recently</div>`;
        }
        
        const legend = document.createElement('div');
        legend.className = 'insight-legend';
        legend.innerHTML = Object.keys(memberContributions).map(memberId => {
            const member = teamMembers.find(m => m.id === memberId);
            return member ? `<div class="insight-legend-item"><span class="legend-color-box" style="background-color:${member.color};"></span> ${member.name}</div>` : '';
        }).join('');
        
        projectItem.append(bar, legend);
        list.appendChild(projectItem);
    });

    container.appendChild(list);
    return container;
}


// --- Member Dashboard Widgets ---

function renderMemberWelcome(props, onActionClick) {
    const { currentUser, appSettings } = props;
    const container = document.createElement('header');
    container.className = 'member-welcome-header';

    const welcomeText = document.createElement('h2');
    welcomeText.textContent = `${appSettings.welcomeMessage || 'Welcome back,'} ${currentUser.name.split(' ')[0]}!`;
    container.appendChild(welcomeText);

    const actions = document.createElement('div');
    actions.className = 'member-hero-actions';
    actions.append(
        Button({ children: 'Log My Work', leftIcon: '<i class="fas fa-plus"></i>', onClick: () => onActionClick('log-work') }),
        Button({ children: 'Add a Note', variant: 'secondary', leftIcon: '<i class="fas fa-sticky-note"></i>', onClick: () => onActionClick('add-note') })
    );
    container.appendChild(actions);

    return container;
}

function renderMemberStats(props) {
    const { currentUser, projects, workLogs } = props;
    const container = document.createElement('div');
    container.className = 'member-stats-grid';
    
    // My Projects stats
    const myProjects = projects.filter(p => (p.assignees || []).includes(currentUser.id));
    const myActive = myProjects.filter(p => p.status !== ProjectStatus.Done);
    const myOverdue = myActive.filter(p => new Date(p.dueDate) < new Date());
    
    // My Hours stats
    const startOfWeekString = getStartOfWeek().toISOString().split('T')[0];
    const myLogsThisWeek = workLogs.filter(log => log.memberId === currentUser.id && log.date >= startOfWeekString);
    const myMinutesThisWeek = myLogsThisWeek.reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    const last7Days = Array(7).fill(0).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    });
    const dailyMinutes = last7Days.map(date => {
        return workLogs.filter(log => log.memberId === currentUser.id && log.date === date)
            .reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);
    }).reverse();

    const stats = [
        { label: 'My Active Projects', value: myActive.length, detail: `${myOverdue.length} overdue`, icon: 'fa-tasks', warning: myOverdue.length > 0 },
        { label: 'Hours Logged This Week', value: formatMinutes(myMinutesThisWeek), detail: `Last 7 days trend`, icon: 'fa-clock', sparklineData: dailyMinutes }
    ];

    stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = `member-stat-card ${stat.warning ? 'warning' : ''}`;
        card.innerHTML = `
            <div class="stat-card-header">
                <div class="stat-card-icon"><i class="fas ${stat.icon}"></i></div>
                <h3 class="stat-card-label">${stat.label}</h3>
            </div>
            <div class="stat-card-body">
                <div class="stat-card-value">${stat.value}</div>
                <p class="stat-card-detail">${stat.detail}</p>
            </div>
        `;
        if (stat.sparklineData) {
            const sparklineContainer = document.createElement('div');
            sparklineContainer.className = 'sparkline-container';
            sparklineContainer.appendChild(createSparkline(stat.sparklineData));
            card.appendChild(sparklineContainer);
        }
        container.appendChild(card);
    });

    return container;
}

function createSparkline(data) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sparkline-svg');
    const width = 100;
    const height = 30;
    const strokeWidth = 2;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    const maxVal = Math.max(...data, 1); // Avoid division by zero
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (d / maxVal * (height - strokeWidth)) - (strokeWidth / 2);
        return `${x},${y}`;
    }).join(' ');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', 'var(--color-primary)');
    polyline.setAttribute('stroke-width', String(strokeWidth));
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    
    svg.appendChild(polyline);
    return svg;
}

function renderMyContributions(props) {
    const { currentUser, projects, workLogs } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    container.innerHTML = `<h3><i class="fas fa-chart-line widget-icon"></i>My Contributions</h3>`;
    
    const myActiveProjects = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(currentUser.id));
    if (myActiveProjects.length === 0) {
        container.innerHTML += `<p class="log-status-empty">You are not assigned to any active projects.</p>`;
        return container;
    }

    const list = document.createElement('ul');
    list.className = 'contributions-list';

    myActiveProjects.slice(0, 5).forEach(project => {
        const item = document.createElement('li');
        item.className = 'contribution-item';
        
        const logsForProject = workLogs.filter(l => l.projectId === project.id && l.memberId === currentUser.id);
        const myTotalMinutes = logsForProject.reduce((sum, l) => sum + l.timeSpentMinutes, 0);
        
        const allLogsForProject = workLogs.filter(l => l.projectId === project.id);
        const projectTotalMinutes = allLogsForProject.reduce((sum, l) => sum + l.timeSpentMinutes, 0);
        
        const myContributionPercent = projectTotalMinutes > 0 ? (myTotalMinutes / projectTotalMinutes * 100) : 0;
        
        item.innerHTML = `
            <strong class="contribution-project-name">${project.name}</strong>
            <div class="contribution-stats">
                <div class="contribution-stat-item">
                    <div class="label">My Hours</div>
                    <div class="value">${formatMinutes(myTotalMinutes)}</div>
                </div>
                <div class="contribution-stat-item">
                    <div class="label">Contribution</div>
                    <div class="value">${myContributionPercent.toFixed(0)}%</div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
    
    container.appendChild(list);
    return container;
}

function renderMyNotes(props, onActionClick) {
    const { notes } = props;
    const container = document.createElement('div');
    container.className = 'dashboard-widget';
    
    const header = document.createElement('div');
    header.className = 'widget-header';
    header.innerHTML = `<h3><i class="fas fa-sticky-note widget-icon"></i>My Recent Notes</h3>`;
    header.appendChild(Button({ children: 'View All', variant: 'ghost', size: 'sm', onClick: () => onActionClick('view-notes')}));
    container.appendChild(header);
    
    const myPendingNotes = notes
        .filter(n => n.status === 'Pending')
        .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (myPendingNotes.length === 0) {
        container.innerHTML += `<p class="log-status-empty">No pending notes. Great job!</p>`;
        return container;
    }
    
    const list = document.createElement('ul');
    list.className = 'widget-list-condensed';
    myPendingNotes.slice(0, 5).forEach(note => {
        const item = document.createElement('li');
        item.className = 'list-item';
        const dueDate = note.dueDate ? new Date(note.dueDate + 'T00:00:00').toLocaleDateString() : 'No due date';
        item.innerHTML = `
            <span class="item-title">${note.title}</span>
            <span class="item-meta">${dueDate}</span>
        `;
        list.appendChild(item);
    });
    container.appendChild(list);

    return container;
}


// --- Main Page Render ---

export function renderDashboardPage(container, props) {
  const { currentUser, teamMembers, onNavChange } = props;
  container.innerHTML = '';
  
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-container dashboard-page';

  const celebrations = getTodaysCelebrations(teamMembers);
  if (celebrations.length > 0) {
      pageWrapper.appendChild(CelebrationsWidget({ celebrations }));
  }

  const handleMemberActionClick = (action) => {
    if (action === 'log-work') {
        const workLogForm = WorkLogForm({ log: null, ...props, onSaveAll: props.onAddMultipleWorkLogs, onCancel: closeModal });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add Work Log(s)', children: workLogForm, size: 'xl' });
    } else if (action === 'add-note') {
        const noteForm = NoteForm({ note: null, ...props, onSave: props.onAddNote, onCancel: closeModal });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add New Note', children: noteForm, size: 'lg' });
    } else if (action === 'view-notes') {
        onNavChange('notes');
    }
  };

  const handleKpiClick = (kpi, allProps) => {
      let title = '';
      let content = document.createElement('div');
      
      if (kpi.type === 'overdue' || kpi.type === 'leave') {
          title = kpi.type === 'overdue' ? 'Overdue Projects' : 'Members on Leave';
          if (kpi.data.length > 0) {
              const list = document.createElement('ul');
              list.className = 'kpi-modal-list';
              kpi.data.forEach(item => {
                  const li = document.createElement('li');
                  li.className = 'kpi-modal-list-item';
                  if (kpi.type === 'overdue') {
                      li.innerHTML = `<strong>${item.name}</strong> <span>Due: ${new Date(item.dueDate).toLocaleDateString()}</span>`;
                  } else {
                      li.innerHTML = `<strong>${item.name}</strong> <span>${item.leaveType}</span>`;
                  }
                  list.appendChild(li);
              });
              content.appendChild(list);
          } else {
              content.innerHTML = `<p>No ${kpi.label.toLowerCase()}.</p>`;
          }
      } else if (kpi.type === 'hours') {
          title = 'Weekly Hours Breakdown';
          content = WeeklyHoursDetailModal({...allProps, startOfWeek: getStartOfWeek() });
      } else {
          return; // No modal for other KPIs
      }

      currentModalInstance = Modal({
          isOpen: true,
          onClose: closeModal,
          title: title,
          children: content,
          footer: Button({ children: 'Close', variant: 'secondary', onClick: closeModal }),
          size: 'lg'
      });
  };

  if (currentUser.role === TeamMemberRole.Manager) {
      pageWrapper.appendChild(renderManagerKPIs(props, handleKpiClick));

      const layout = document.createElement('div');
      layout.className = 'dashboard-layout';
      
      const mainCol = document.createElement('div');
      mainCol.className = 'dashboard-main-col';
      mainCol.append(
          renderDailyStandup(props),
          renderProjectInsights(props)
      );
      
      const sideCol = document.createElement('div');
      sideCol.className = 'dashboard-side-col';
      sideCol.appendChild(renderActivityFeed(props));
      
      layout.append(mainCol, sideCol);
      pageWrapper.appendChild(layout);

  } else { // Member view
      pageWrapper.appendChild(renderMemberWelcome(props, handleMemberActionClick));
      pageWrapper.appendChild(renderMemberStats(props));
      
      const memberLayout = document.createElement('div');
      memberLayout.className = 'dashboard-layout-member';
      memberLayout.append(
          renderMyContributions(props),
          renderMyNotes(props, handleMemberActionClick)
      );
      pageWrapper.appendChild(memberLayout);
  }

  container.appendChild(pageWrapper);
}
