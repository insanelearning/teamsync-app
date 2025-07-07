
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { ProjectStatus, AttendanceStatus } from "../types.js";

let currentModalInstance = null;

// --- Data Calculation Helpers ---

function getProjectStatsForEmployee(employeeId, projects) {
    const assignedProjects = projects.filter(p => (p.assignees || []).includes(employeeId));
    const completed = assignedProjects.filter(p => p.status === ProjectStatus.Done);
    const overdue = assignedProjects.filter(p => p.status !== ProjectStatus.Done && new Date(p.dueDate) < new Date());
    
    const onTimeCompletions = completed.filter(p => new Date(p.updatedAt) <= new Date(p.dueDate)).length;
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


// --- UI Rendering Components ---

function renderTeamOverview(teamMembers, projects, attendanceRecords) {
    const overviewContainer = document.createElement('div');
    overviewContainer.className = 'evaluation-overview-container';

    // KPI Cards
    const kpiContainer = document.createElement('div');
    kpiContainer.className = 'kpi-grid';

    let topPerformer = { name: 'N/A', count: 0 };
    let mostPunctual = { name: 'N/A', rate: 0 };
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
        if (workDays > 0) {
            const rate = (workDays / (workDays + attendanceStats.leave)) * 100;
            if (rate > mostPunctual.rate) {
                mostPunctual = { name: member.name, rate: rate };
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
    const { teamMembers, projects, attendanceRecords, onSelectEmployee } = props;

    const section = document.createElement('div');
    section.className = 'attendance-page-section';

    const title = document.createElement('h2');
    title.className = "attendance-section-title";
    title.textContent = "Individual Evaluations";
    section.appendChild(title);
    
    if (teamMembers.length === 0) {
        section.innerHTML += `<p class="no-data-placeholder">No team members to evaluate.</p>`;
        return section;
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

    modalContent.innerHTML = `
        <div class="detail-section">
            <h4 class="detail-label">Project Performance</h4>
            <div class="detail-grid">
                <div class="detail-item"><h5 class="detail-label-small">Assigned</h5><p class="detail-value-large">${projectStats.assigned}</p></div>
                <div class="detail-item"><h5 class="detail-label-small">Completed</h5><p class="detail-value-large">${projectStats.completed}</p></div>
                <div class="detail-item"><h5 class="detail-label-small">Overdue</h5><p class="detail-value-large">${projectStats.overdue}</p></div>
                <div class="detail-item"><h5 class="detail-label-small">On-Time Rate</h5><p class="detail-value-large">${projectStats.onTimeRate}%</p></div>
            </div>
        </div>
        <div class="detail-section">
            <h4 class="detail-label">Attendance (Last 90 Days)</h4>
            <div class="detail-grid">
                <div class="detail-item"><h5 class="detail-label-small">Present</h5><p class="detail-value-large">${attendanceStats.present}</p></div>
                <div class="detail-item"><h5 class="detail-label-small">Work From Home</h5><p class="detail-value-large">${attendanceStats.wfh}</p></div>
                <div class="detail-item"><h5 class="detail-label-small">On Leave</h5><p class="detail-value-large">${attendanceStats.leave}</p></div>
            </div>
        </div>
    `;

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
