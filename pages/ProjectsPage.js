
import { ProjectForm } from '../components/ProjectForm.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { FileUploadButton } from '../components/FileUploadButton.js';

let currentModalInstance = null; 

// Helper to get status/priority classes, can be moved if needed elsewhere
const getStatusClass = (status) => {
  const statusMap = { 'To Do': 'status-todo', 'In Progress': 'status-inprogress', 'QA': 'status-qa', 'Blocked': 'status-blocked', 'Done': 'status-done' };
  return statusMap[status] || 'status-default';
};
const getPriorityClass = (priority) => {
  const priorityMap = { 'Low': 'priority-low', 'Medium': 'priority-medium', 'High': 'priority-high' };
  return priorityMap[priority] || 'priority-default';
};

// Helper function to create SVG pie chart using path elements for robustness
function createPieChart(data) {
  const container = document.createElement('div');
  container.className = 'pie-chart-container';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'pie-chart-svg');

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (totalValue === 0) {
    svg.innerHTML = `<circle cx="50" cy="50" r="45" fill="#e5e7eb" />
      <text x="50" y="55" class="pie-chart-empty-text" text-anchor="middle">No Data</text>`;
  } else {
    const radius = 45;
    const cx = 50;
    const cy = 50;
    let startAngle = 0;

    const getCoordinatesForAngle = (angle) => {
      const angleInRadians = (angle - 90) * Math.PI / 180.0;
      return {
        x: cx + (radius * Math.cos(angleInRadians)),
        y: cy + (radius * Math.sin(angleInRadians))
      };
    };

    data.forEach(item => {
      if (item.value === 0) return;
      const sliceAngle = (item.value / totalValue) * 360;
      const endAngle = startAngle + sliceAngle;
      
      // Handle slices > 99.9% as full circles to avoid path issues at 360 degrees
      if (sliceAngle >= 359.99) {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', String(cx));
          circle.setAttribute('cy', String(cy));
          circle.setAttribute('r', String(radius));
          circle.setAttribute('fill', item.color);
          svg.appendChild(circle);
          startAngle = endAngle;
          return; 
      }

      const start = getCoordinatesForAngle(startAngle);
      const end = getCoordinatesForAngle(endAngle);

      const largeArcFlag = sliceAngle > 180 ? '1' : '0';

      const d = [
        "M", cx, cy,
        "L", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y,
        "Z"
      ].join(" ");

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute("d", d);
      path.setAttribute("fill", item.color);
      svg.appendChild(path);

      startAngle = endAngle;
    });
  }
  container.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'pie-chart-legend';
  data.forEach(item => {
    const legendItem = document.createElement('div');
    legendItem.className = 'pie-chart-legend-item';
    legendItem.innerHTML = `<span class="legend-color-box" style="background-color: ${item.color};"></span>
                            <span class="legend-label">${item.label} (${item.value})</span>`;
    legend.appendChild(legendItem);
  });

  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'pie-chart-wrapper';
  chartWrapper.appendChild(container);
  chartWrapper.appendChild(legend);

  return chartWrapper;
}

// Renders the "Upcoming Deadlines & At-Risk" component
function renderDeadlinesAndRisks(projects, onProjectClick) {
  const container = document.createElement('div');
  container.className = 'deadlines-container';

  const title = document.createElement('h3');
  title.className = 'chart-title'; // Re-use style
  title.textContent = 'Deadlines & At-Risk';
  container.appendChild(title);
  
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const overdueProjects = projects.filter(p => p.status !== 'Done' && new Date(p.dueDate) < now);
  const upcomingProjects = projects.filter(p => {
    const dueDate = new Date(p.dueDate);
    return p.status !== 'Done' && dueDate >= now && dueDate <= oneWeekFromNow;
  });

  const createProjectList = (listTitle, projectList, iconClass, emptyText) => {
    const section = document.createElement('div');
    section.className = 'deadline-section';
    
    const listHeader = document.createElement('h4');
    listHeader.className = 'deadline-section-title';
    listHeader.innerHTML = `<i class="${iconClass}"></i> ${listTitle} <span>(${projectList.length})</span>`;
    section.appendChild(listHeader);
    
    if (projectList.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'deadline-list';
      projectList.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)); // Sort by closest due date
      projectList.forEach(p => {
        const li = document.createElement('li');
        li.className = 'deadline-item';
        li.innerHTML = `
          <a href="#" data-project-id="${p.id}" class="deadline-item-name">${p.name}</a>
          <span class="deadline-item-date">Due: ${new Date(p.dueDate).toLocaleDateString()}</span>
        `;
        ul.appendChild(li);
      });
      section.appendChild(ul);
    } else {
      section.innerHTML += `<p class="deadline-list-empty">${emptyText}</p>`;
    }
    return section;
  };

  const overdueSection = createProjectList('Overdue', overdueProjects, 'fas fa-exclamation-circle overdue-icon', 'No overdue projects. Great job!');
  const upcomingSection = createProjectList('Due This Week', upcomingProjects, 'fas fa-calendar-check upcoming-icon', 'No deadlines this week.');

  container.appendChild(overdueSection);
  container.appendChild(upcomingSection);

  container.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.dataset.projectId) {
      e.preventDefault();
      const project = projects.find(p => p.id === e.target.dataset.projectId);
      if (project) {
        onProjectClick(project);
      }
    }
  });

  return container;
}


// Renders the new overview section
function renderProjectsOverview(projects, projectStatuses, onProjectClick) {
  const overviewContainer = document.createElement('div');
  overviewContainer.className = 'projects-overview-container';
  
  // KPI Cards
  const kpiContainer = document.createElement('div');
  kpiContainer.className = 'kpi-grid';
  
  const totalProjects = projects.length;
  const inProgress = projects.filter(p => p.status === 'In Progress').length;
  const completed = projects.filter(p => p.status === 'Done').length;
  const overdue = projects.filter(p => p.status !== 'Done' && new Date(p.dueDate) < new Date()).length;

  const kpis = [
    { label: 'Total Projects', value: totalProjects, icon: 'fas fa-layer-group' },
    { label: 'In Progress', value: inProgress, icon: 'fas fa-tasks' },
    { label: 'Completed', value: completed, icon: 'fas fa-check-circle' },
    { label: 'Overdue', value: overdue, icon: 'fas fa-exclamation-triangle', isWarning: overdue > 0 }
  ];

  kpis.forEach(kpi => {
    const card = document.createElement('div');
    card.className = `stat-card ${kpi.isWarning ? 'warning' : ''}`;
    card.innerHTML = `
      <div class="stat-card-icon"><i class="${kpi.icon}"></i></div>
      <div>
        <div class="stat-card-value">${kpi.value}</div>
        <div class="stat-card-label">${kpi.label}</div>
      </div>
    `;
    kpiContainer.appendChild(card);
  });
  overviewContainer.appendChild(kpiContainer);
  
  // Chart Section
  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart-section';
  const chartTitle = document.createElement('h3');
  chartTitle.className = 'chart-title';
  chartTitle.textContent = 'Projects by Status';
  chartContainer.appendChild(chartTitle);
  
  const statusColors = { 'To Do': '#e8a40a', 'In Progress': '#3b82f6', 'QC': '#e80a83', 'Blocked': '#ef4444', 'Done': '#22c55e' };
  const chartData = projectStatuses.map(status => ({
    label: status,
    value: projects.filter(p => p.status === status).length,
    color: statusColors[status] || '#9ca3af'
  }));

  chartContainer.appendChild(createPieChart(chartData));
  overviewContainer.appendChild(chartContainer);

  // Deadlines & Risks Section
  overviewContainer.appendChild(renderDeadlinesAndRisks(projects, onProjectClick));
  
  return overviewContainer;
}

export function renderProjectsPage(container, props) {
  const {
    projects,
    teamMembers,
    projectStatuses,
    onAddProject,
    onUpdateProject,
    onDeleteProject,
    onExport,
    onImport
  } = props;
  
  let searchTerm = '';
  let statusFilter = '';
  let assigneeFilter = '';
  let teamLeadFilter = '';
  let projectTypeFilter = '';
  let projectCategoryFilter = '';
  let sortOrder = 'dueDateAsc';

  container.innerHTML = ''; 
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-container';

  const headerDiv = document.createElement('div');
  headerDiv.className = "page-header";
  const headerTitle = document.createElement('h1');
  headerTitle.className = 'page-header-title';
  headerTitle.textContent = 'Projects Dashboard';
  headerDiv.appendChild(headerTitle);
  
  const actionsWrapper = document.createElement('div');
  actionsWrapper.className = "page-header-actions";
  actionsWrapper.append(
    Button({ children: 'Export CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: onExport }),
    FileUploadButton({
        children: 'Import CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv',
        onFileSelect: (file) => { if (file) onImport(file); }
    }),
    Button({ children: 'Add Project', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>', onClick: openModalForNew })
  );
  headerDiv.appendChild(actionsWrapper);
  pageWrapper.appendChild(headerDiv);
  
  // Render the new overview section, passing the function to open a project modal
  pageWrapper.appendChild(renderProjectsOverview(projects, projectStatuses, openModalWithProject));

  const filtersDiv = document.createElement('div');
  filtersDiv.className = "filters-container";
  const filterGrid = document.createElement('div');
  filterGrid.className = "filters-grid";

  function createFilterInput(type, placeholder, onUpdate) {
    const input = document.createElement('input');
    input.type = type; input.placeholder = placeholder;
    input.className = "form-input";
    input.oninput = (e) => { onUpdate(e.target.value); rerenderProjectList(); };
    return input;
  }
  function createFilterSelect(optionsArray, defaultOptionText, onUpdate, currentValue = '') {
    const select = document.createElement('select');
    select.className = "form-select";
    if (defaultOptionText) select.innerHTML = `<option value="">${defaultOptionText}</option>`;
    optionsArray.forEach(opt => select.innerHTML += `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.label}</option>`);
    select.value = currentValue;
    select.onchange = (e) => { onUpdate(e.target.value); rerenderProjectList(); };
    return select;
  }
  
  const uniqueProjectTypes = Array.from(new Set(projects.map(p => p.projectType).filter(Boolean)));
  const uniqueProjectCategories = Array.from(new Set(projects.map(p => p.projectCategory).filter(Boolean)));
  const sortOptions = [
      {value: 'dueDateAsc', label: 'Sort: Due Date (Asc)'},{value: 'dueDateDesc', label: 'Sort: Due Date (Desc)'},
      {value: 'nameAsc', label: 'Sort: Name (A-Z)'},{value: 'nameDesc', label: 'Sort: Name (Z-A)'}
  ];

  filterGrid.append(
    createFilterInput('text', 'Search projects...', val => searchTerm = val),
    createFilterSelect(projectStatuses.map(s => ({value: s, label: s})), 'All Statuses', val => statusFilter = val),
    createFilterSelect(teamMembers.map(m => ({value: m.id, label: m.name})), 'Any Assignee', val => assigneeFilter = val),
    createFilterSelect(teamMembers.map(m => ({value: m.id, label: m.name})), 'Any Team Lead', val => teamLeadFilter = val),
    createFilterSelect(uniqueProjectTypes.map(t => ({value: t, label: t})), 'All Types', val => projectTypeFilter = val),
    createFilterSelect(uniqueProjectCategories.map(c => ({value: c, label: c})), 'All Categories', val => projectCategoryFilter = val),
    createFilterSelect(sortOptions, '', val => sortOrder = val, sortOrder)
  );
  filtersDiv.appendChild(filterGrid);
  pageWrapper.appendChild(filtersDiv);
  
  const projectsContainer = document.createElement('div');
  pageWrapper.appendChild(projectsContainer);

  function getFilteredAndSortedProjects() {
    return projects.filter(p => {
      const sTerm = searchTerm.toLowerCase();
      return (p.name.toLowerCase().includes(sTerm) || (p.description||'').toLowerCase().includes(sTerm) || (p.stakeholderName && p.stakeholderName.toLowerCase().includes(sTerm))) &&
             (!statusFilter || p.status === statusFilter) &&
             (!assigneeFilter || (p.assignees && p.assignees.includes(assigneeFilter))) &&
             (!teamLeadFilter || p.teamLeadId === teamLeadFilter) &&
             (!projectTypeFilter || p.projectType === projectTypeFilter) &&
             (!projectCategoryFilter || p.projectCategory === projectCategoryFilter);
    }).sort((a, b) => {
      if (sortOrder === 'dueDateAsc') return new Date(a.dueDate) - new Date(b.dueDate);
      if (sortOrder === 'dueDateDesc') return new Date(b.dueDate) - new Date(a.dueDate);
      if (sortOrder === 'nameAsc') return a.name.localeCompare(b.name);
      if (sortOrder === 'nameDesc') return b.name.localeCompare(a.name);
      return 0;
    });
  }

  function rerenderProjectList() {
    const displayProjects = getFilteredAndSortedProjects();
    projectsContainer.innerHTML = ''; 
    if (displayProjects.length > 0) {
        const table = document.createElement('table');
        table.className = "data-table projects-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Project Name</th>
                    <th>Status</th>
                    <th>Assignees</th>
                    <th>Due Date</th>
                    <th>Priority</th>
                </tr>
            </thead>`;
        const tbody = document.createElement('tbody');
        const getMemberName = (id) => teamMembers.find(tm => tm.id === id)?.name || 'Unknown';

        displayProjects.forEach(p => {
            const assigneesNames = p.assignees && p.assignees.length > 0
                ? p.assignees.map(id => getMemberName(id)).join(', ')
                : 'Unassigned';
            const tr = document.createElement('tr');
            tr.dataset.projectId = p.id;
            tr.innerHTML = `
                <td>${p.name}</td>
                <td><span class="project-status-badge ${getStatusClass(p.status)}">${p.status}</span></td>
                <td class="truncate" title="${assigneesNames}">${assigneesNames}</td>
                <td>${new Date(p.dueDate).toLocaleDateString()}</td>
                <td><span class="${getPriorityClass(p.priority)}">${p.priority}</span></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row && row.dataset.projectId) {
                const project = projects.find(p => p.id === row.dataset.projectId);
                if (project) openModalWithProject(project);
            }
        });
        
        table.appendChild(tbody);
        projectsContainer.appendChild(table);
    } else {
      projectsContainer.className = "no-projects-placeholder";
      projectsContainer.innerHTML = `
        <i class="fas fa-folder-open icon"></i>
        <p class="primary-text">No projects found.</p>
        <p class="secondary-text">Try adjusting filters or add a new project.</p>`;
    }
  }

  function openModalForNew() {
    const formElement = ProjectForm({ 
        project: null, 
        teamMembers, 
        projectStatuses, 
        onSave: (projectData) => {
            onAddProject(projectData);
            closeModal();
        }, 
        onCancel: closeModal 
    });
    currentModalInstance = Modal({
      isOpen: true, onClose: closeModal, title: 'Add New Project',
      children: formElement, size: 'xl'
    });
  }

  function closeModal() {
    closeGlobalModal(); 
    currentModalInstance = null;
  }
  
  function handleDeleteProject(projectId) {
    if (window.confirm('Delete this project? This cannot be undone.')) {
      onDeleteProject(projectId);
      closeModal();
    }
  }

  function renderProjectDetailView(project) {
    const getMemberName = (id) => teamMembers.find(tm => tm.id === id)?.name || 'Unknown';
    const assigneesNames = project.assignees?.length > 0 ? project.assignees.map(id => getMemberName(id)).join(', ') : 'Unassigned';
    const teamLeadName = project.teamLeadId ? getMemberName(project.teamLeadId) : 'N/A';
    
    const detailView = document.createElement('div');
    detailView.className = 'project-detail-view';
    detailView.innerHTML = `
        <div class="detail-group">
            <h4 class="detail-label">Description</h4>
            <p class="detail-value">${project.description || 'No description provided.'}</p>
        </div>
        <div class="detail-grid">
            <div class="detail-item"><h4 class="detail-label">Stakeholder</h4><p class="detail-value">${project.stakeholderName || 'N/A'}</p></div>
            <div class="detail-item"><h4 class="detail-label">Status</h4><p class="detail-value"><span class="project-status-badge ${getStatusClass(project.status)}">${project.status}</span></p></div>
            <div class="detail-item"><h4 class="detail-label">Assignees</h4><p class="detail-value">${assigneesNames}</p></div>
            <div class="detail-item"><h4 class="detail-label">Team Lead</h4><p class="detail-value">${teamLeadName}</p></div>
            <div class="detail-item"><h4 class="detail-label">Due Date</h4><p class="detail-value">${new Date(project.dueDate).toLocaleDateString()}</p></div>
            <div class="detail-item"><h4 class="detail-label">Priority</h4><p class="detail-value"><span class="${getPriorityClass(project.priority)}">${project.priority}</span></p></div>
            <div class="detail-item"><h4 class="detail-label">Project Type</h4><p class="detail-value">${project.projectType || 'N/A'}</p></div>
            <div class="detail-item"><h4 class="detail-label">Category</h4><p class="detail-value">${project.projectCategory || 'N/A'}</p></div>
        </div>
    `;

    const hasPilotDetails = project.mediaProduct || project.pilotScope || project.clientNames || project.projectApproach || project.deliverables || project.resultsAchieved;
    if (hasPilotDetails) {
        const pilotDetailsContainer = document.createElement('div');
        pilotDetailsContainer.className = 'pilot-details-container';

        const title = document.createElement('h4');
        title.className = 'pilot-details-title';
        title.textContent = 'Pilot-Specific Details';
        pilotDetailsContainer.appendChild(title);

        const table = document.createElement('table');
        table.className = 'pilot-details-table';
        const tbody = document.createElement('tbody');

        const addRow = (label, value) => {
            if (!value) return;
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = label;
            const td = document.createElement('td');
            td.textContent = value;
            tr.append(th, td);
            tbody.appendChild(tr);
        };

        addRow('Media Product', project.mediaProduct);
        addRow('Pilot Scope', project.pilotScope);
        addRow('Client Names (if any)', project.clientNames);
        addRow('Project Approach', project.projectApproach);
        addRow('Deliverables', project.deliverables);
        addRow('Results Achieved', project.resultsAchieved);

        table.appendChild(tbody);
        pilotDetailsContainer.appendChild(table);
        detailView.appendChild(pilotDetailsContainer);
    }

    if (project.goals && project.goals.length > 0) {
        const goalsContainerDiv = document.createElement('div');
        goalsContainerDiv.className = 'project-detail-goals-container';
        
        project.goals.forEach(goal => {
            const goalDiv = document.createElement('div');
            goalDiv.className = 'project-detail-goal';

            const goalTitle = document.createElement('h4');
            goalTitle.className = 'detail-label goal-title';
            goalTitle.innerHTML = `<i class="fas fa-bullseye" style="margin-right: 0.5rem"></i> ${goal.name}`;
            goalDiv.appendChild(goalTitle);

            if (goal.name.trim().toLowerCase() === 'email campaign') {
                 const getMetricValue = (name, isNumber = true) => {
                    const metric = (goal.metrics || []).find(m => m.fieldName === name);
                    if (!metric) return isNumber ? 0 : '';
                    return isNumber ? Number(metric.fieldValue) || 0 : metric.fieldValue;
                };

                const clientName = getMetricValue('Client Name', false);
                // Handle backward compatibility for the name change
                const totalProspects = getMetricValue('Total Prospects') || getMetricValue('Total Leads');
                const delivered = getMetricValue('Delivered');
                const undelivered = getMetricValue('Undelivered');
                const leadConversions = getMetricValue('Lead Conversions');

                const totalSent = delivered + undelivered;
                const conversionRate = delivered > 0 ? ((leadConversions / delivered) * 100).toFixed(2) : 0;
                const toBeSent = totalProspects - totalSent;
                
                const campaignContainer = document.createElement('div');
                campaignContainer.className = 'detail-grid';
                campaignContainer.style.marginTop = '0.5rem';

                campaignContainer.innerHTML = `
                    <div class="detail-item"><h4 class="detail-label">Client Name</h4><p class="detail-value">${clientName || 'N/A'}</p></div>
                    <div class="detail-item"><h4 class="detail-label">Total Prospects</h4><p class="detail-value">${totalProspects.toLocaleString()}</p></div>
                    <div class="detail-item"><h4 class="detail-label">Delivered</h4><p class="detail-value">${delivered.toLocaleString()}</p></div>
                    <div class="detail-item"><h4 class="detail-label">Undelivered</h4><p class="detail-value">${undelivered.toLocaleString()}</p></div>
                    <div class="detail-item"><h4 class="detail-label">Lead Conversions</h4><p class="detail-value">${leadConversions.toLocaleString()}</p></div>
                    <div class="detail-item"><h4 class="detail-label">Total Sent</h4><p class="detail-value">${totalSent.toLocaleString()}</p></div>
                    <div class="detail-item"><h4 class="detail-label">Conversion</h4><p class="detail-value">${conversionRate}%</p></div>
                    <div class="detail-item"><h4 class="detail-label">To Be Sent</h4><p class="detail-value">${toBeSent.toLocaleString()}</p></div>
                `;
                goalDiv.appendChild(campaignContainer);

            } else if (goal.metrics && goal.metrics.length > 0) {
                const tableContainer = document.createElement('div');
                tableContainer.className = 'data-table-container';
                const table = document.createElement('table');
                table.className = 'data-table';
                table.innerHTML = `<thead><tr><th>Client Name</th><th>For</th><th>Progress</th><th>Target</th></tr></thead>`;
                const tbody = document.createElement('tbody');

                goal.metrics.forEach(metric => {
                    const tr = document.createElement('tr');
                    
                    const tdName = document.createElement('td');
                    if (metric.completed) {
                        tdName.innerHTML = `<i class="fas fa-check-circle" style="color: #22c55e; margin-right: 0.5rem;" title="Completed on ${new Date(metric.completionDate).toLocaleDateString()}"></i>${metric.fieldName}`;
                    } else {
                        tdName.textContent = metric.fieldName;
                    }
                    tr.appendChild(tdName);

                    const tdMember = document.createElement('td');
                    tdMember.textContent = metric.memberId ? getMemberName(metric.memberId) : 'Project-Level';
                    tr.appendChild(tdMember);
                    
                    const tdProgress = document.createElement('td');
                    const hasTarget = metric.targetValue && !isNaN(Number(metric.targetValue)) && Number(metric.targetValue) > 0;
                    if (hasTarget) {
                        const currentValue = isNaN(Number(metric.fieldValue)) ? 0 : Number(metric.fieldValue);
                        const targetValue = Number(metric.targetValue);
                        const percentage = Math.max(0, Math.min(100, (currentValue / targetValue) * 100));
                        
                        const progressContainer = document.createElement('div');
                        progressContainer.className = 'progress-bar-with-text';
                        
                        const progressBarContainer = document.createElement('div');
                        progressBarContainer.className = 'progress-bar-container';
                        const progressBarFill = document.createElement('div');
                        progressBarFill.className = 'progress-bar-fill';
                        progressBarFill.style.width = `${percentage}%`;
                        progressBarContainer.appendChild(progressBarFill);
                        
                        const progressText = document.createElement('span');
                        progressText.className = 'progress-bar-text';
                        progressText.textContent = `${metric.fieldValue}`;
                        
                        progressContainer.append(progressBarContainer, progressText);
                        tdProgress.appendChild(progressContainer);
                    } else {
                        tdProgress.textContent = metric.fieldValue;
                    }
                    tr.appendChild(tdProgress);

                    const tdTarget = document.createElement('td');
                    tdTarget.textContent = metric.targetValue || 'N/A';
                    tr.appendChild(tdTarget);

                    tbody.appendChild(tr);
                });

                table.appendChild(tbody);
                tableContainer.appendChild(table);
                goalDiv.appendChild(tableContainer);
            }
            goalsContainerDiv.appendChild(goalDiv);
        });
        detailView.appendChild(goalsContainerDiv);
    }

    return detailView;
  }

  function openModalWithProject(project) {
    let isEditing = false;
    let modalEl, modalBody, modalFooter;

    const renderContent = () => {
        modalBody.innerHTML = '';
        modalFooter.innerHTML = '';

        if (isEditing) {
            const formElement = ProjectForm({
                project, teamMembers, projectStatuses,
                onSave: (projectData) => {
                    onUpdateProject(projectData);
                    closeModal();
                },
                onCancel: () => {
                    isEditing = false;
                    renderContent(); // Go back to view mode
                }
            });
            modalBody.appendChild(formElement);
            // Footer is handled by form's action buttons
        } else {
            modalBody.appendChild(renderProjectDetailView(project));

            const editButton = Button({ children: 'Edit', variant: 'primary', onClick: () => { isEditing = true; renderContent(); } });
            const deleteButton = Button({ children: 'Delete', variant: 'danger', onClick: () => handleDeleteProject(project.id) });
            const closeButton = Button({ children: 'Close', variant: 'secondary', onClick: closeModal });
            modalFooter.append(deleteButton, editButton, closeButton);
        }
    };
    
    modalEl = Modal({
        isOpen: true,
        onClose: closeModal,
        title: project.name,
        children: document.createElement('div'), // Placeholder
        footer: document.createElement('div'),   // Placeholder
        size: 'xl'
    });
    
    // After Modal creates the elements, grab them to manage content
    modalBody = modalEl.querySelector('.modal-body');
    modalFooter = modalEl.querySelector('.modal-footer');
    currentModalInstance = modalEl;
    renderContent();
  }

  rerenderProjectList();
  container.appendChild(pageWrapper);
}
