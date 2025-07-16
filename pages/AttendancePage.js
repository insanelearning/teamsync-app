

import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { TeamMemberForm } from '../components/TeamMemberForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { AttendanceLogTable } from '../components/AttendanceLogTable.js';
import { exportToCSV as exportDataToCSV } from '../services/csvService.js';
import { AttendanceCard } from '../components/AttendanceCard.js';
import { TeamMemberRole } from '../types.js';

let currentTeamModalInstance = null;
let currentLogModalInstance = null;

export function renderAttendancePage(container, props) {
  const {
    attendanceRecords, teamMembers, projects, currentUser,
    attendanceStatuses, leaveTypes, onUpsertAttendanceRecord, onDeleteAttendanceRecord,
    onExport, onImport, maxTeamMembers, onAddTeamMember, onUpdateTeamMember,
    onDeleteTeamMember, onExportTeam, onImportTeam
  } = props;

  const isManager = currentUser.role === TeamMemberRole.Manager;

  let selectedDate = new Date().toISOString().split('T')[0];
  let logMemberFilter = '', logStartDateFilter = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], logEndDateFilter = new Date().toISOString().split('T')[0];
  let displayLogs = [];
  
  let teamSearchTerm = '';
  let departmentFilter = '';
  let teamSortOrder = 'nameAsc';

  container.innerHTML = '';
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-container';

  const headerDiv = document.createElement('div');
  headerDiv.className = "page-header";
  const headerTitle = document.createElement('h1');
  headerTitle.className = "page-header-title";
  headerTitle.textContent = 'Attendance Tracker';
  headerDiv.appendChild(headerTitle);

  const datePickerDiv = document.createElement('div');
  datePickerDiv.className = "flex items-center space-x-2";
  const dateLabel = document.createElement('span');
  dateLabel.className = 'form-label';
  dateLabel.style.marginBottom = '0';
  dateLabel.textContent = 'Select Date:';
  datePickerDiv.appendChild(dateLabel);
  const dateInput = document.createElement('input');
  dateInput.type = "date"; dateInput.value = selectedDate;
  dateInput.className = "form-input";
  dateInput.setAttribute('aria-label', 'Select date for daily log');
  dateInput.onchange = (e) => { 
      selectedDate = e.target.value; 
      renderDailyLogGrid(); 
      updateDailyLogTitle(); 
      if (isManager) renderTeamList();
  };
  datePickerDiv.appendChild(dateInput);
  headerDiv.appendChild(datePickerDiv);
  pageWrapper.appendChild(headerDiv);

  if (isManager) {
    const teamManagementDiv = document.createElement('div');
    teamManagementDiv.className = "attendance-page-section";
    const tmTitle = document.createElement('h2');
    tmTitle.className = "attendance-section-title";
    tmTitle.textContent = "Team Management";
    teamManagementDiv.appendChild(tmTitle);
    
    const tmToolbar = document.createElement('div');
    tmToolbar.className = 'team-management-toolbar';

    const tmFiltersContainer = document.createElement('div');
    tmFiltersContainer.className = 'team-management-filters';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Filter by name...';
    searchInput.className = 'form-input';
    searchInput.oninput = (e) => { teamSearchTerm = e.target.value; renderTeamList(); };
    tmFiltersContainer.appendChild(searchInput);

    const uniqueDepartments = Array.from(new Set(teamMembers.map(m => m.department).filter(Boolean)));
    if (uniqueDepartments.length > 0) {
      const departmentSelect = document.createElement('select');
      departmentSelect.className = 'form-select';
      departmentSelect.innerHTML = `<option value="">All Departments</option>` + uniqueDepartments.map(d => `<option value="${d}">${d}</option>`).join('');
      departmentSelect.value = departmentFilter;
      departmentSelect.onchange = (e) => { departmentFilter = e.target.value; renderTeamList(); };
      tmFiltersContainer.appendChild(departmentSelect);
    }

    const sortOptions = [
      { value: 'nameAsc', label: 'Sort: Name (A-Z)' },
      { value: 'nameDesc', label: 'Sort: Name (Z-A)' },
      { value: 'designationAsc', label: 'Sort: Designation (A-Z)' },
      { value: 'designationDesc', label: 'Sort: Designation (Z-A)' },
    ];
    const sortSelect = document.createElement('select');
    sortSelect.className = 'form-select';
    sortSelect.innerHTML = sortOptions.map(opt => `<option value="${opt.value}" ${opt.value === teamSortOrder ? 'selected' : ''}>${opt.label}</option>`).join('');
    sortSelect.onchange = (e) => { teamSortOrder = e.target.value; renderTeamList(); };
    tmFiltersContainer.appendChild(sortSelect);

    const tmActionsDiv = document.createElement('div');
    tmActionsDiv.className = "team-management-actions";
    const addMemberBtn = Button({
      children: `Add Member (${teamMembers.length}/${maxTeamMembers})`, size: 'sm', leftIcon: '<i class="fas fa-user-plus"></i>',
      onClick: () => openTeamMemberDetailModal(null), disabled: teamMembers.length >= maxTeamMembers });
    tmActionsDiv.append(addMemberBtn,
      Button({ children: 'Export Team CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-users-cog"></i>', onClick: onExportTeam }),
      FileUploadButton({ children: 'Import Team CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv', onFileSelect: (f) => handleFileImport(f, 'team') })
    );
    
    tmToolbar.append(tmFiltersContainer, tmActionsDiv);
    teamManagementDiv.appendChild(tmToolbar);

    const teamListContainer = document.createElement('div');
    teamListContainer.className = "team-list-container";
    teamManagementDiv.appendChild(teamListContainer);
    pageWrapper.appendChild(teamManagementDiv);
  }

  const dailyLogSection = document.createElement('div');
  dailyLogSection.className = "daily-log-section";
  const dailyLogHeader = document.createElement('div');
  dailyLogHeader.className = "daily-log-header";
  const dailyLogTitle = document.createElement('h2');
  dailyLogTitle.className = "daily-log-title";
  function updateDailyLogTitle() { dailyLogTitle.textContent = `Daily Log for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`; }
  updateDailyLogTitle();
  dailyLogHeader.appendChild(dailyLogTitle);

  if (isManager) {
    const logActionsDiv = document.createElement('div');
    logActionsDiv.className = "daily-log-actions";
    logActionsDiv.append(
      Button({ children: 'Export All Logs', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: onExport }),
      FileUploadButton({ children: 'Import Logs', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv', onFileSelect: (f) => handleFileImport(f, 'attendance') }),
      Button({ children: 'View Attendance Logs', variant: 'primary', size: 'sm', leftIcon: '<i class="fas fa-history"></i>', onClick: openLogViewerModal })
    );
    dailyLogHeader.appendChild(logActionsDiv);
  }

  dailyLogSection.appendChild(dailyLogHeader);
  const dailyLogGridContainer = document.createElement('div');
  dailyLogGridContainer.className = 'daily-log-grid-container';
  dailyLogSection.appendChild(dailyLogGridContainer);
  pageWrapper.appendChild(dailyLogSection);

  function renderTeamList() {
    const teamListContainer = pageWrapper.querySelector('.team-list-container');
    if (!teamListContainer) return;
    teamListContainer.innerHTML = '';

    const getAttendanceStatusBadge = (status) => {
        if (!status) {
            return `<span class="attendance-status-badge status-not-marked">Not Marked</span>`;
        }
        const statusClassMap = {
            'Present': 'status-present',
            'Work From Home': 'status-wfh',
            'Leave': 'status-leave'
        };
        const className = statusClassMap[status] || 'status-default';
        const text = status === 'Work From Home' ? 'WFH' : status;
        return `<span class="attendance-status-badge ${className}">${text}</span>`;
    };

    const recordsForDate = attendanceRecords.filter(r => r.date === selectedDate);

    let filteredMembers = teamMembers.filter(member => 
        member.name.toLowerCase().includes(teamSearchTerm.toLowerCase()) &&
        (!departmentFilter || member.department === departmentFilter)
    );

    filteredMembers.sort((a, b) => {
        switch (teamSortOrder) {
            case 'nameDesc': return b.name.localeCompare(a.name);
            case 'designationAsc': return (a.designation || '').localeCompare(b.designation || '');
            case 'designationDesc': return (b.designation || '').localeCompare(a.designation || '');
            case 'nameAsc':
            default:
                return a.name.localeCompare(b.name);
        }
    });

    if (filteredMembers.length > 0) {
      const groupedByCompany = filteredMembers.reduce((acc, member) => {
        const companyName = member.company || 'Unaffiliated';
        if (!acc[companyName]) {
            acc[companyName] = [];
        }
        acc[companyName].push(member);
        return acc;
      }, {});

      Object.entries(groupedByCompany).forEach(([company, members]) => {
          const companyGroupWrapper = document.createElement('div');
          companyGroupWrapper.className = 'company-group-wrapper';

          const companyHeader = document.createElement('h3');
          companyHeader.className = 'company-group-header';
          companyHeader.textContent = company;
          companyGroupWrapper.appendChild(companyHeader);
          
          const tableContainer = document.createElement('div');
          tableContainer.className = 'data-table-container';

          const table = document.createElement('table');
          table.className = 'data-table team-members-table';
          table.innerHTML = `<thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Active Projects</th><th>Attendance Status</th></tr></thead>`;
          const tbody = document.createElement('tbody');
          members.forEach(member => {
            const tr = document.createElement('tr');
            tr.dataset.memberId = member.id;
            
            const activeProjectsCount = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id)).length;
            const record = recordsForDate.find(r => r.memberId === member.id);

            tr.innerHTML = `
                <td>${member.name}</td>
                <td>${member.designation || 'N/A'}</td>
                <td>${member.department || 'N/A'}</td>
                <td>${activeProjectsCount}</td>
                <td>${getAttendanceStatusBadge(record?.status)}</td>
            `;
            
            tbody.appendChild(tr);
          });

          tbody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row && row.dataset.memberId) {
                const member = teamMembers.find(m => m.id === row.dataset.memberId);
                if (member) openTeamMemberDetailModal(member, true);
            }
          });

          table.appendChild(tbody);
          tableContainer.appendChild(table);
          companyGroupWrapper.appendChild(tableContainer);
          teamListContainer.appendChild(companyGroupWrapper);
      });
    } else {
      teamListContainer.innerHTML = `<p class="no-data-placeholder" style="padding: 1rem; box-shadow: none;">No team members found for the current filters.</p>`;
    }
  }

  function renderDailyLogGrid() {
    dailyLogGridContainer.innerHTML = '';
    const membersToDisplay = isManager ? teamMembers : [currentUser];

    if (membersToDisplay.length > 0) {
      const grid = document.createElement('div');
      grid.className = "daily-log-grid";
      const recordsForDate = attendanceRecords.filter(r => r.date === selectedDate);
      membersToDisplay.forEach(member => {
        const record = recordsForDate.find(r => r.memberId === member.id);
        grid.appendChild(AttendanceCard({ 
            member, 
            date: selectedDate, 
            record, 
            leaveTypes, 
            onUpsertRecord: onUpsertAttendanceRecord 
        }));
      });
      dailyLogGridContainer.appendChild(grid);
    } else {
      dailyLogGridContainer.innerHTML = `<div class="no-team-placeholder"><i class="fas fa-users-slash icon"></i><p class="primary-text">No team members yet.</p><p class="secondary-text">Add members in the Team Management section above.</p></div>`;
    }
  }

  function closeTeamModal() { closeGlobalModal(); currentTeamModalInstance = null; }
  
  function handleDeleteMember(memberId) { 
    if (window.confirm('Delete member? This also removes their attendance logs and unassigns them from projects.')) {
      onDeleteTeamMember(memberId);
      closeTeamModal();
    }
  }
  
  function renderTeamMemberDetailView(member) {
    const detailView = document.createElement('div');
    detailView.className = 'member-detail-view';
    
    // Member Info
    detailView.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><h4 class="detail-label">Email</h4><p class="detail-value">${member.email || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Employee ID</h4><p class="detail-value">${member.employeeId || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Designation</h4><p class="detail-value">${member.designation || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Department</h4><p class="detail-value">${member.department || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Join Date</h4><p class="detail-value">${member.joinDate ? new Date(member.joinDate + 'T00:00').toLocaleDateString() : 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Birth Date</h4><p class="detail-value">${member.birthDate ? new Date(member.birthDate + 'T00:00').toLocaleDateString() : 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Company</h4><p class="detail-value">${member.company || 'N/A'}</p></div>
      </div>
    `;

    // Active Projects
    const activeProjects = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id));
    const projectsSection = document.createElement('div');
    projectsSection.className = 'detail-section';
    projectsSection.innerHTML = `<h4 class="detail-label">Active Projects (${activeProjects.length})</h4>`;
    if (activeProjects.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'detail-list';
      activeProjects.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        ul.appendChild(li);
      });
      projectsSection.appendChild(ul);
    } else {
      projectsSection.innerHTML += `<p class="detail-value-small">No active projects.</p>`;
    }
    detailView.appendChild(projectsSection);

    // Attendance Summary (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRecords = attendanceRecords.filter(r => r.memberId === member.id && new Date(r.date) >= thirtyDaysAgo);
    
    const wfhDays = recentRecords.filter(r => r.status === 'Work From Home').length;
    const leaveDays = recentRecords.filter(r => r.status === 'Leave').length;

    const attendanceSection = document.createElement('div');
    attendanceSection.className = 'detail-section';
    attendanceSection.innerHTML = `<h4 class="detail-label">Attendance Summary (Last 30 Days)</h4>`;
    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'detail-grid-small';
    summaryGrid.innerHTML = `
      <div class="detail-item"><p class="detail-value-small">Work From Home: ${wfhDays} days</p></div>
      <div class="detail-item"><p class="detail-value-small">On Leave: ${leaveDays} days</p></div>
    `;
    attendanceSection.appendChild(summaryGrid);
    detailView.appendChild(attendanceSection);

    return detailView;
  }

  function openTeamMemberDetailModal(member, isViewing = false) {
    if (!member && isViewing) return; // Can't view a null member
    if (!member && teamMembers.length >= maxTeamMembers) {
      alert(`Team size cannot exceed the maximum of ${maxTeamMembers} members.`);
      return;
    }
    
    let isEditing = !isViewing;
    let modalEl, modalBody, modalFooter;
    
    const handleSaveTeamMember = (memberData) => {
      (member ? onUpdateTeamMember : onAddTeamMember)(memberData);
      closeTeamModal();
    };

    const renderContent = () => {
      modalBody.innerHTML = '';
      modalFooter.innerHTML = '';

      if (isEditing) {
        const formElement = TeamMemberForm({
          member,
          onSave: handleSaveTeamMember,
          onCancel: member ? () => { isEditing = false; renderContent(); } : closeTeamModal
        });
        modalBody.appendChild(formElement);
        // Form provides its own footer actions
      } else {
        modalBody.appendChild(renderTeamMemberDetailView(member));
        
        const editButton = Button({ children: 'Edit', variant: 'primary', onClick: () => { isEditing = true; renderContent(); }});
        const deleteButton = Button({ children: 'Delete', variant: 'danger', onClick: () => handleDeleteMember(member.id)});
        const closeButton = Button({ children: 'Close', variant: 'secondary', onClick: closeTeamModal });
        modalFooter.append(deleteButton, editButton, closeButton);
      }
    };

    currentTeamModalInstance = Modal({
      isOpen: true,
      onClose: closeTeamModal,
      title: isEditing ? (member ? 'Edit Team Member' : 'Add New Member') : member.name,
      children: document.createElement('div'), // placeholder
      footer: document.createElement('div'), // placeholder
      size: 'lg'
    });

    modalEl = currentTeamModalInstance;
    modalBody = modalEl.querySelector('.modal-body');
    modalFooter = modalEl.querySelector('.modal-footer');
    renderContent();
  }

  function handleFileImport(file, type) { if (file) (type === 'attendance' ? onImport : onImportTeam)(file); }

  function handleDeleteLog(recordId) {
    if (window.confirm('Are you sure you want to delete this log entry? This cannot be undone.')) {
        onDeleteAttendanceRecord(recordId);
        // The state update in App.js will cause a re-render.
        // The modal will be removed from the view as the page component is rebuilt.
        // Closing it explicitly ensures clean-up.
        closeLogViewerModal();
    }
  }

  function openLogViewerModal() { handleFetchLogs(); showLogViewerModal(); }
  function closeLogViewerModal() { closeGlobalModal(); currentLogModalInstance = null; }
  function handleFetchLogs() {
    let logs = attendanceRecords.filter(log => 
        (!logMemberFilter || log.memberId === logMemberFilter) &&
        (!logStartDateFilter || new Date(log.date) >= new Date(logStartDateFilter)) &&
        (!logEndDateFilter || new Date(log.date) <= new Date(logEndDateFilter))
    );
    logs.sort((a,b) => new Date(b.date)-new Date(a.date) || (teamMembers.find(tm=>tm.id===a.memberId)?.name||'').localeCompare(teamMembers.find(tm=>tm.id===b.memberId)?.name||''));
    displayLogs = logs;
    if (currentLogModalInstance) { 
      const logTableContainer = currentLogModalInstance.querySelector('#log-table-dynamic-container');
      if (logTableContainer) {
        logTableContainer.innerHTML = ''; 
        logTableContainer.appendChild(AttendanceLogTable({ logs: displayLogs, teamMembers, onDelete: handleDeleteLog }));
      }
      const exportBtn = currentLogModalInstance.querySelector('#export-filtered-logs-btn');
      if (exportBtn) exportBtn.disabled = displayLogs.length === 0;
    }
  }
  function handleExportFilteredLogs() {
    if (displayLogs.length === 0) { alert("No logs to export."); return; }
    const logsToExport = displayLogs.map(log => {
        const member = teamMembers.find(tm => tm.id === log.memberId);
        return { Date: log.date, MemberName: member?.name || 'N/A', EmployeeID: member?.employeeId || 'N/A', Status: log.status, LeaveType: log.leaveType||'', Notes: log.notes||'' };
    });
    exportDataToCSV(logsToExport, `attendance_logs_${logStartDateFilter}_to_${logEndDateFilter}.csv`);
  }
  function showLogViewerModal() {
    const modalContent = document.createElement('div'); 
    modalContent.style.display = 'flex';
    modalContent.style.flexDirection = 'column';
    modalContent.style.gap = '1rem';

    const filterRow = document.createElement('div'); 
    filterRow.className = "log-viewer-filter-row";
    
    const createSelect = (id, labelText, optionsHTML, currentVal, onChange) => {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'form-label';
        label.textContent = labelText;
        div.appendChild(label);
        const sel = document.createElement('select'); sel.id = id; sel.className="form-select";
        sel.innerHTML = optionsHTML; sel.value = currentVal; sel.onchange = onChange;
        div.appendChild(sel); return div;
    };
    const createDateInput = (id, labelText, currentVal, onChange) => {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'form-label';
        label.textContent = labelText;
        div.appendChild(label);
        const inp = document.createElement('input'); inp.type='date'; inp.id=id; inp.className="form-input";
        inp.value = currentVal; inp.onchange = onChange;
        div.appendChild(inp); return div;
    };
    filterRow.append(
        createSelect('logMemberFilter', 'Team Member', `<option value="">All</option>`+teamMembers.map(m=>`<option value="${m.id}">${m.name}</option>`).join(''), logMemberFilter, e=>{logMemberFilter=e.target.value; handleFetchLogs();}),
        createDateInput('logStartDateFilter', 'Start Date', logStartDateFilter, e=>{logStartDateFilter=e.target.value; handleFetchLogs();}),
        createDateInput('logEndDateFilter', 'End Date', logEndDateFilter, e=>{logEndDateFilter=e.target.value; handleFetchLogs();})
    );
    modalContent.appendChild(filterRow);
    const tableDiv = document.createElement('div'); tableDiv.id = 'log-table-dynamic-container';
    tableDiv.appendChild(AttendanceLogTable({ logs: displayLogs, teamMembers, onDelete: handleDeleteLog }));
    modalContent.appendChild(tableDiv);
    
    const footerButtons = [
        Button({variant: 'secondary', children: 'Close', onClick: closeLogViewerModal }),
        Button({id: 'export-filtered-logs-btn', variant: 'primary', children: 'Export Filtered', leftIcon: '<i class="fas fa-file-csv"></i>', onClick: handleExportFilteredLogs, disabled: displayLogs.length === 0})
    ];
    currentLogModalInstance = Modal({ isOpen: true, onClose: closeLogViewerModal, title: "View Logs", children: modalContent, footer: footerButtons, size: 'xl' });
  }

  if(isManager) renderTeamList();
  renderDailyLogGrid();
  container.appendChild(pageWrapper);
}
