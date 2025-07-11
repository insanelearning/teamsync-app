
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { ProjectStatus, AttendanceStatus } from "../types.js";

let currentModalInstance = null;

// --- Data Calculation Helpers ---

function getProjectStatsForEmployee(employeeId, projects) {
    const assignedProjects = projects.filter(p => (p.assignees || []).includes(employeeId));
    const completed = assignedProjects.filter(p => p.status === ProjectStatus.Done);
    const overdue = assignedProjects.filter(p => p.status !== ProjectStatus.Done && new Date(p.dueDate) < new Date());
    
    const onTimeCompletions = completed.filter(p => p.completionDate && new Date(p.completionDate) <= new Date(p.dueDate)).length;
    const onTimeRate = completed.length > 0 ? (onTimeCompletions / completed.length) * 100 : 0;

    return {
        assigned: assignedProjects.length,
        completed: completed.length,
        inProgress: assignedProjects.filter(p => p.status === ProjectStatus.InProgress).length,
        overdue: overdue.length,
        onTimeRate: onTimeRate.toFixed(0),
    };
}

function getAttendanceStatsForEmployee(employeeId, attendanceRecords, days = 90) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const records = attendanceRecords.filter(r => r.memberId === employeeId && new Date(r.date) >= dateLimit);
    const stats = { present: 0, wfh: 0, leave: 0, total: records.length };

    records.forEach(r => {
        if (r.status === AttendanceStatus.Present) stats.present++;
        else if (r.status === AttendanceStatus.WorkFromHome) stats.wfh++;
        else if (r.status === AttendanceStatus.Leave) stats.leave++;
    });
    return stats;
}


// --- UI Chart Components ---

function createBarChart(data, title) {
    const container = document.createElement('div');
    container.className = 'bar-chart-container';
    
    if (title) {
        const chartTitle = document.createElement('h5');
        chartTitle.className = 'chart-title-small';
        chartTitle.textContent = title;
        container.appendChild(chartTitle);
    }

    const chart = document.createElement('div');
    chart.className = 'bar-chart';
    
    const maxValue = Math.max(...data.map(d => d.value), 0);
    
    if (maxValue === 0) {
        chart.innerHTML = `<p class="chart-empty-text">No data available</p>`;
    } else {
        data.forEach(item => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'bar-chart-item';
            
            const barLabel = document.createElement('span');
            barLabel.className = 'bar-chart-label';
            barLabel.textContent = item.label;
            
            const barElement = document.createElement('div');
            barElement.className = 'bar-chart-bar-wrapper';
            
            const barFill = document.createElement('div');
            barFill.className = 'bar-chart-bar';
            barFill.style.width = `${(item.value / maxValue) * 100}%`;
            barFill.style.backgroundColor = item.color;
            
            const barValue = document.createElement('span');
            barValue.className = 'bar-chart-value';
            barValue.textContent = item.value;
            
            barElement.appendChild(barFill);
            barWrapper.append(barLabel, barElement, barValue);
            chart.appendChild(barWrapper);
        });
    }
    container.appendChild(chart);
    return container;
}

function renderAttendanceSummaryCard(attendanceStats) {
  const container = document.createElement('div');
  container.className = 'attendance-summary-card';

  const header = document.createElement('div');
  header.className = 'attendance-summary-header';
  header.innerHTML = `
    <div class="title-group">
      <i class="fas fa-user-check"></i>
      <h3>ATTENDANCE (LAST 90 DAYS)</h3>
    </div>
    <i class="fas fa-chevron-down"></i>
  `;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'attendance-summary-body';

  const chartContainer = document.createElement('div');
  chartContainer.className = 'donut-chart-container';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'donut-chart-svg');

  const data = [
    { label: 'Present', value: attendanceStats.present, color: '#22c55e' }, // green
    { label: 'WFH', value: attendanceStats.wfh, color: '#3b82f6' }, // blue
    { label: 'Leave', value: attendanceStats.leave, color: '#f97316' } // orange
  ];
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (totalValue === 0) {
    svg.innerHTML = `<circle cx="50" cy="50" r="40" stroke="#e5e7eb" stroke-width="15" fill="none"/>
    <text x="50" y="48" class="donut-center-value" text-anchor="middle">0</text>
    <text x="50" y="62" class="donut-center-label" text-anchor="middle">days</text>`;
  } else {
    const radius = 40;
    const strokeWidth = 15;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    // A small gap between segments
    const gapSize = 2; // in percentage of circumference
    const totalGapSize = data.filter(d => d.value > 0).length * gapSize;
    const scaleFactor = (circumference - totalGapSize) / circumference;

    data.forEach(item => {
        if (item.value === 0) return;
        const percent = (item.value / totalValue) * 100;
        const segmentLength = (percent / 100) * circumference * scaleFactor;
        const strokeDasharray = `${segmentLength} ${circumference - segmentLength}`;
        const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        segment.setAttribute('cx', '50');
        segment.setAttribute('cy', '50');
        segment.setAttribute('r', String(radius));
        segment.setAttribute('fill', 'none');
        segment.setAttribute('stroke', item.color);
        segment.setAttribute('stroke-width', String(strokeWidth));
        segment.setAttribute('stroke-dasharray', strokeDasharray);
        segment.setAttribute('stroke-dashoffset', String(-offset));
        segment.setAttribute('transform', `rotate(-90 50 50)`);
        svg.appendChild(segment);
        offset += segmentLength + (gapSize / 100 * circumference);
    });

    const totalText = `
    <text x="50" y="48" class="donut-center-value" text-anchor="middle">${totalValue}</text>
    <text x="50" y="62" class="donut-center-label" text-anchor="middle">days</text>`;
    svg.innerHTML += totalText;
  }
  chartContainer.appendChild(svg);
  body.appendChild(chartContainer);

  const legend = document.createElement('div');
  legend.className = 'attendance-summary-legend';
  data.forEach(item => {
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
        <span class="legend-color-box" style="background-color: ${item.color};"></span>
        <span class="legend-label">${item.label} (${item.value})</span>
    `;
    legend.appendChild(legendItem);
  });
  body.appendChild(legend);

  container.appendChild(body);
  return container;
}


// --- Main UI Rendering ---

function renderTeamOverview(teamMembers, projects, attendanceRecords) {
    const overviewContainer = document.createElement('div');
    overviewContainer.className = 'evaluation-overview-container evaluation-page-overview';

    const kpiContainer = document.createElement('div');
    kpiContainer.className = 'kpi-grid';

    let topPerformer = { name: 'N/A', count: 0 };
    let mostPunctual = { name: 'N/A', rate: 0, presentDays: 0 };
    let highestWorkload = { name: 'N/A', count: 0 };
    
    teamMembers.forEach(member => {
        const projectStats = getProjectStatsForEmployee(member.id, projects);
        if (projectStats.completed > topPerformer.count) {
            topPerformer = { name: member.name, count: projectStats.completed };
        }
        const activeProjects = projects.filter(p => p.status !== ProjectStatus.Done && (p.assignees || []).includes(member.id)).length;
        if (activeProjects > highestWorkload.count) {
            highestWorkload = { name: member.name, count: activeProjects };
        }
        const attendanceStats = getAttendanceStatsForEmployee(member.id, attendanceRecords);
        const workDays = attendanceStats.present + attendanceStats.wfh;
        const totalLoggedDays = workDays + attendanceStats.leave;

        if (totalLoggedDays > 0) {
            const rate = (workDays / totalLoggedDays) * 100;
            
            if (rate > mostPunctual.rate) {
                // Higher rate wins
                mostPunctual = { name: member.name, rate: rate, presentDays: attendanceStats.present };
            } else if (rate === mostPunctual.rate) {
                // Tie-breaker: more present days wins
                if (attendanceStats.present > mostPunctual.presentDays) {
                    mostPunctual = { name: member.name, rate: rate, presentDays: attendanceStats.present };
                }
            }
        }
    });

    const totalCompleted = projects.filter(p => p.status === ProjectStatus.Done).length;
    const completionRate = projects.length > 0 ? ((totalCompleted / projects.length) * 100).toFixed(0) : 0;

    const kpis = [
        { label: 'Top Performer', value: topPerformer.name, subtext: `${topPerformer.count} projects completed`, icon: 'fas fa-trophy' },
        { label: 'Highest Workload', value: highestWorkload.name, subtext: `${highestWorkload.count} active projects`, icon: 'fas fa-tasks' },
        { label: 'Most Punctual', value: mostPunctual.name, subtext: `${mostPunctual.rate.toFixed(0)}% presence`, icon: 'fas fa-user-check' },
        { label: 'Project Completion', value: `${completionRate}%`, subtext: `${totalCompleted}/${projects.length} completed`, icon: 'fas fa-check-double' }
    ];

    kpis.forEach(kpi => {
        const card = document.createElement('div');
        card.className = `stat-card`;
        card.innerHTML = `
          <div class="stat-card-icon"><i class="${kpi.icon}"></i></div>
          <div>
            <div class="stat-card-value">${kpi.value}</div>
            <div class="stat-card-label">${kpi.label}</div>
            <p class="stat-card-subtext">${kpi.subtext}</p>
          </div>
        `;
        kpiContainer.appendChild(card);
    });

    overviewContainer.appendChild(kpiContainer);
    return overviewContainer;
}

function renderIndividualEvaluation(container, props) {
    const { teamMembers, projects, onSelectEmployee } = props;

    const section = document.createElement('div');
    section.className = 'attendance-page-section';

    const title = document.createElement('h2');
    title.className = "attendance-section-title";
    title.textContent = "Individual Evaluations";
    section.appendChild(title);
    
    if (teamMembers.length === 0) {
        section.innerHTML += `<p class="no-data-placeholder">No team members to evaluate.</p>`;
        container.appendChild(section);
        return;
    }
    
    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container';
    const table = document.createElement('table');
    table.className = 'data-table team-members-table';
    table.innerHTML = `<thead><tr><th>Name</th><th>Designation</th><th>Projects Completed</th><th>Active Projects</th><th class="action-cell">Action</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    teamMembers.forEach(member => {
        const tr = document.createElement('tr');
        const projectStats = getProjectStatsForEmployee(member.id, projects);
        
        tr.innerHTML = `
            <td>${member.name}</td>
            <td>${member.designation || 'N/A'}</td>
            <td>${projectStats.completed}</td>
            <td>${projects.filter(p => p.status !== ProjectStatus.Done && (p.assignees || []).includes(member.id)).length}</td>
        `;

        const actionCell = document.createElement('td');
        actionCell.className = 'action-cell';
        actionCell.appendChild(Button({
            children: 'View Evaluation',
            variant: 'primary',
            size: 'sm',
            onClick: () => onSelectEmployee(member)
        }));
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    section.appendChild(tableContainer);
    container.appendChild(section);
}


function openEvaluationModal(employee, projects, attendanceRecords) {
    const closeModal = () => {
        closeGlobalModal();
        currentModalInstance = null;
    };
    
    const projectStats = getProjectStatsForEmployee(employee.id, projects);
    const attendanceStats = getAttendanceStatsForEmployee(employee.id, attendanceRecords);
    
    const modalContent = document.createElement('div');
    modalContent.className = 'evaluation-modal-content';

    // Project Performance Section
    const projectSection = document.createElement('div');
    projectSection.className = 'detail-section';
    projectSection.innerHTML = `<h4 class="detail-label"><i class="fas fa-tasks"></i> Project Performance</h4>`;

    const projectKpis = document.createElement('div');
    projectKpis.className = 'detail-grid';
    projectKpis.innerHTML = `
        <div class="detail-item"><h5 class="detail-label-small">Assigned</h5><p class="detail-value-large">${projectStats.assigned}</p></div>
        <div class="detail-item"><h5 class="detail-label-small">Completed</h5><p class="detail-value-large">${projectStats.completed}</p></div>
        <div class="detail-item"><h5 class="detail-label-small">Overdue</h5><p class="detail-value-large">${projectStats.overdue}</p></div>
        <div class="detail-item"><h5 class="detail-label-small">On-Time Rate</h5><p class="detail-value-large">${projectStats.onTimeRate}%</p></div>
    `;
    projectSection.appendChild(projectKpis);
    projectSection.appendChild(createBarChart([
        { label: 'Completed', value: projectStats.completed, color: '#22c55e' },
        { label: 'In Progress', value: projectStats.inProgress, color: '#3b82f6' },
        { label: 'Overdue', value: projectStats.overdue, color: '#ef4444' },
    ], 'Project Status Breakdown'));

    // Attendance Section
    const attendanceSection = document.createElement('div');
    attendanceSection.className = 'detail-section';
    attendanceSection.appendChild(renderAttendanceSummaryCard(attendanceStats));

    modalContent.append(projectSection, attendanceSection);

    currentModalInstance = Modal({
        isOpen: true,
        onClose: closeModal,
        title: `Performance Evaluation: ${employee.name}`,
        children: modalContent,
        footer: [Button({ children: 'Close', variant: 'secondary', onClick: closeModal })],
        size: 'lg'
    });
}


export function renderEvaluationPage(container, props) {
  container.innerHTML = '';
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-container';

  // Header
  const headerDiv = document.createElement('div');
  headerDiv.className = "page-header";
  const headerTitle = document.createElement('h1');
  headerTitle.className = 'page-header-title';
  headerTitle.textContent = 'Employee Evaluation';
  headerDiv.appendChild(headerTitle);
  pageWrapper.appendChild(headerDiv);

  // Overview
  pageWrapper.appendChild(renderTeamOverview(props.teamMembers, props.projects, props.attendanceRecords));
  
  // Individual List
  renderIndividualEvaluation(pageWrapper, { ...props, onSelectEmployee: (employee) => openEvaluationModal(employee, props.projects, props.attendanceRecords)});
  
  container.appendChild(pageWrapper);
}
