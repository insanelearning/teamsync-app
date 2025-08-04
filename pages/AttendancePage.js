
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

// Helper function to create an ID field with a copy button
function createIdFieldWithCopy(label, id) {
    const item = document.createElement('div');
    item.className = 'detail-item detail-item-id';

    const labelEl = document.createElement('h4');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;

    const valueContainer = document.createElement('div');
    valueContainer.className = 'id-value-container';
    
    const valueEl = document.createElement('code');
    valueEl.className = 'id-value-code';
    valueEl.textContent = id;
    
    const copyBtn = Button({
        variant: 'ghost',
        size: 'sm',
        children: '<i class="fas fa-copy"></i>',
        ariaLabel: `Copy ${label}`,
        onClick: () => {
            navigator.clipboard.writeText(id).then(() => {
                const icon = copyBtn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-check';
                    copyBtn.disabled = true;
                    setTimeout(() => {
                        icon.className = 'fas fa-copy';
                        copyBtn.disabled = false;
                    }, 2000);
                }
            });
        }
    });

    valueContainer.append(valueEl, copyBtn);
    item.append(labelEl, valueContainer);
    return item;
}

export function renderAttendancePage(container, props) {
  const {
    attendanceRecords, teamMembers, projects, currentUser,
    attendanceStatuses, leaveTypes, onUpsertAttendanceRecord, onDeleteAttendanceRecord,
    onExport, onImport, maxTeamMembers, onAddTeamMember, onUpdateTeamMember,
    onDeleteTeamMember, onExportTeam, onImportTeam, internalTeams, holidays
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
      renderTeamList(); 
  };
  datePickerDiv.appendChild(dateInput);
  headerDiv.appendChild(datePickerDiv);
  pageWrapper.appendChild(headerDiv);

  // Team Management Section - Visible to all, actions are conditional
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

  // Filters are only visible to managers
  if (!isManager) {
    tmFiltersContainer.style.display = 'none';
  }

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
  
  if (isManager) {
      tmActionsDiv.append(
        Button({
            children: `Add Member (${teamMembers.length}/${maxTeamMembers})`, size: 'sm', leftIcon: '<i class="fas fa-user-plus"></i>',
            onClick: () => openTeamMemberDetailModal(null), disabled: teamMembers.length >= maxTeamMembers
        }),
        Button({ 
            children: 'Export Team CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-users-cog"></i>', onClick: onExportTeam 
        }),
        FileUploadButton({ 
            children: 'Import Team CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv', onFileSelect: (f) => handleFileImport(f, 'team') 
        })
      );
  }
  
  tmToolbar.append(tmFiltersContainer, tmActionsDiv);
  teamManagementDiv.appendChild(tmToolbar);

  const teamListContainer = document.createElement('div');
  teamListContainer.className = "team-list-container";
  teamManagementDiv.appendChild(teamListContainer);
  pageWrapper.appendChild(teamManagementDiv);


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
      Button({ children: 'Export All Logs', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: () => onExport('attendance') }),
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
    
    // Non-managers only see themselves. Managers see the full list.
    const membersToDisplay = isManager ? teamMembers : [currentUser];

    let filteredMembers = membersToDisplay.filter(member => 
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
          table.innerHTML = `<thead><tr><th>Name</th><th>Internal Team</th><th>Designation</th><th>Active Projects</th><th>Attendance Status</th></tr></thead>`;
          const tbody = document.createElement('tbody');
          members.forEach(member => {
            const tr = document.createElement('tr');
            tr.dataset.memberId = member.id;
            
            const activeProjectsCount = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id)).length;
            const record = recordsForDate.find(r => r.memberId === member.id);

            tr.innerHTML = `
                <td>${member.name}</td>
                <td>${member.internalTeam || 'N/A'}</td>
                <td>${member.designation || 'N/A'}</td>
                <td>${activeProjectsCount}</td>
                <td>${getAttendanceStatusBadge(record?.status)}</td>
            `;
            
            tbody.appendChild(tr);
          });

          // All users can click to view details, but only managers can edit from the modal.
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
            holidays,
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
    if (window.confirm('Delete this member and all their associated data (attendance, work logs)? This cannot be undone.')) {
      onDeleteTeamMember(memberId);
      closeTeamModal();
    }
  }

  function handleFileImport(file, type) {
      if (type === 'attendance') {
          onImport(file, 'attendance');
      } else if (type === 'team') {
          onImportTeam(file);
      }
  }
  
  function renderTeamMemberDetailView(member, projects) {
    const detailView = document.createElement('div');
    detailView.className = 'member-detail-view'; // Re-use project detail view styles

    const formatDate = (dateString) => dateString ? new Date(dateString + 'T00:00:00').toLocaleDateString() : 'N/A';
    const calculateAge = (birthDate) => {
        if (!birthDate) return 'N/A';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return `${age} years`;
    };

    const mainDetailsGrid = document.createElement('div');
    mainDetailsGrid.className = 'detail-grid';
    mainDetailsGrid.innerHTML = `
        <div class="detail-item"><h4 class="detail-label">Email</h4><p class="detail-value">${member.email || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Mobile</h4><p class="detail-value">${member.mobileNumber || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Designation</h4><p class="detail-value">${member.designation || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Role</h4><p class="detail-value">${member.role}</p></div>
        <div class="detail-item"><h4 class="detail-label">Internal Team</h4><p class="detail-value">${member.internalTeam || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Department</h4><p class="detail-value">${member.department || 'N/A'}</p></div>
        <div class="detail-item"><h4 class="detail-label">Join Date</h4><p class="detail-value">${formatDate(member.joinDate)}</p></div>
        <div class="detail-item"><h4 class="detail-label">Age</h4><p class="detail-value">${calculateAge(member.birthDate)}</p></div>
    `;
    mainDetailsGrid.appendChild(createIdFieldWithCopy('Member ID', member.id));
    detailView.appendChild(mainDetailsGrid);

    const activeProjects = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(member.id));
    if (activeProjects.length > 0) {
        const projectsSection = document.createElement('div');
        projectsSection.className = 'detail-section';
        projectsSection.innerHTML = `<h4 class="detail-label">Active Projects (${activeProjects.length})</h4>`;
        const projectList = document.createElement('ul');
        projectList.className = 'detail-list';
        projectList.innerHTML = activeProjects.map(p => `<li>${p.name}</li>`).join('');
        projectsSection.appendChild(projectList);
        detailView.appendChild(projectsSection);
    }
    
    return detailView;
  }

  function openTeamMemberDetailModal(member, isReadOnly = false) {
    let isEditing = !isReadOnly && isManager; // Only managers can start in edit mode.
    if (!member && isManager) {
        isEditing = true; // Always editing for a new member
    } else if (!isManager) {
        isEditing = false; // Non-managers can only view
        isReadOnly = true;
    }

    let modalEl, modalBody, modalFooter;
    const { onAddTeamMember, onUpdateTeamMember, internalTeams, projects, attendanceRecords, holidays } = props;

    const renderContent = () => {
        modalBody.innerHTML = '';
        modalFooter.innerHTML = '';

        if (isEditing) {
            const formElement = TeamMemberForm({ 
                member, 
                internalTeams,
                onSave: (memberData) => {
                    if (member) onUpdateTeamMember(memberData);
                    else onAddTeamMember(memberData);
                    closeTeamModal();
                }, 
                onCancel: () => {
                    if (isReadOnly && member) {
                        isEditing = false;
                        renderContent();
                    } else {
                        closeTeamModal();
                    }
                } 
            });
            modalBody.appendChild(formElement);
        } else {
            modalBody.appendChild(renderTeamMemberDetailView(member, projects, attendanceRecords, holidays));
            
            const footerButtons = [];
            if (isManager) {
                footerButtons.push(Button({ children: 'Delete', variant: 'danger', onClick: () => handleDeleteMember(member.id) }));
                footerButtons.push(Button({ children: 'Edit', variant: 'primary', onClick: () => { isEditing = true; renderContent(); } }));
            }
            footerButtons.push(Button({ children: 'Close', variant: 'secondary', onClick: closeTeamModal }));
            
            modalFooter.append(...footerButtons);
        }
    };
    
    modalEl = Modal({
        isOpen: true,
        onClose: closeTeamModal,
        title: member ? member.name : 'Add New Team Member',
        children: document.createElement('div'), // Placeholder
        footer: document.createElement('div'),   // Placeholder
        size: 'lg'
    });
    
    modalBody = modalEl.querySelector('.modal-body');
    modalFooter = modalEl.querySelector('.modal-footer');
    currentTeamModalInstance = modalEl;
    renderContent();
  }

  function closeLogModal() {
      closeGlobalModal();
      currentLogModalInstance = null;
  }

  function rerenderLogViewer() {
    if (!currentLogModalInstance) return;
    const contentContainer = currentLogModalInstance.querySelector('#log-viewer-content-container');
    if (!contentContainer) return;
    contentContainer.innerHTML = '';
    
    displayLogs = attendanceRecords
      .filter(log => 
          (!logMemberFilter || log.memberId === logMemberFilter) &&
          (!logStartDateFilter || log.date >= logStartDateFilter) &&
          (!logEndDateFilter || log.date <= logEndDateFilter)
      )
      .sort((a,b) => new Date(b.date) - new Date(a.date));

    contentContainer.appendChild(AttendanceLogTable({
        logs: displayLogs,
        teamMembers,
        onDelete: (id) => {
            if (confirm('Are you sure you want to delete this log entry?')) {
                onDeleteAttendanceRecord(id);
                // No need to call rerenderLogViewer from here, as the main state change will trigger it.
                // We will manually remove the row for immediate feedback.
                const row = contentContainer.querySelector(`tr[data-log-id="${id}"]`); // Requires adding data-log-id to table rows
                if (row) row.remove();
            }
        }
    }));
  }

  function openLogViewerModal() {
    const modalContent = document.createElement('div');
    modalContent.className = "flex flex-col gap-4";
    
    const filterRow = document.createElement('div');
    filterRow.className = 'log-viewer-filter-row';

    // Member filter
    const memberSelect = document.createElement('select');
    memberSelect.className = 'form-select';
    memberSelect.innerHTML = `<option value="">All Members</option>` + teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    memberSelect.value = logMemberFilter;
    memberSelect.onchange = (e) => { logMemberFilter = e.target.value; rerenderLogViewer(); };
    
    // Start date filter
    const startDateInput = document.createElement('input');
    startDateInput.type = 'date';
    startDateInput.className = 'form-input';
    startDateInput.value = logStartDateFilter;
    startDateInput.onchange = (e) => { logStartDateFilter = e.target.value; rerenderLogViewer(); };
    
    // End date filter
    const endDateInput = document.createElement('input');
    endDateInput.type = 'date';
    endDateInput.className = 'form-input';
    endDateInput.value = logEndDateFilter;
    endDateInput.onchange = (e) => { logEndDateFilter = e.target.value; rerenderLogViewer(); };

    filterRow.append(memberSelect, startDateInput, endDateInput);

    const contentContainer = document.createElement('div');
    contentContainer.id = 'log-viewer-content-container';

    modalContent.append(filterRow, contentContainer);
    
    const exportButton = Button({
      children: 'Export Filtered Logs', variant: 'secondary', onClick: () => {
        if (displayLogs.length > 0) {
          exportDataToCSV(displayLogs, 'filtered_attendance_logs.csv');
        } else {
          alert('No logs to export with the current filters.');
        }
      }
    });

    currentLogModalInstance = Modal({
      isOpen: true,
      onClose: closeLogModal,
      title: 'View All Attendance Logs',
      children: modalContent,
      footer: [exportButton, Button({ children: 'Close', variant: 'primary', onClick: closeLogModal })],
      size: 'xl'
    });
    
    rerenderLogViewer();
  }

  // Initial renders on page load
  renderDailyLogGrid();
  renderTeamList();
  container.appendChild(pageWrapper);
}
