
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { TeamMemberForm } from '../components/TeamMemberForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { AttendanceLogTable } from '../components/AttendanceLogTable.js';
import { exportToCSV as exportDataToCSV } from '../services/csvService.js';
import { AttendanceCard } from '../components/AttendanceCard.js';
import { TeamMemberRole, AttendanceStatus } from '../types.js';

let currentTeamModalInstance = null;
let currentLogModalInstance = null;

// --- Helper Functions ---

function createIdFieldWithCopy(label, id) {
    // ... (implementation is the same, just included for context)
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

function createDonutChart(data, totalValue) {
  const container = document.createElement('div');
  container.className = 'donut-chart-and-legend';

  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'donut-chart-svg-container';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  
  const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const totalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  totalText.setAttribute('x', '50');
  totalText.setAttribute('y', '48');
  totalText.setAttribute('class', 'donut-center-value');
  totalText.setAttribute('text-anchor', 'middle');
  totalText.textContent = totalValue.toLocaleString();
  
  const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  labelText.setAttribute('x', '50');
  labelText.setAttribute('y', '62');
  labelText.setAttribute('class', 'donut-center-label');
  labelText.setAttribute('text-anchor', 'middle');
  labelText.textContent = 'days';
  
  textGroup.append(totalText, labelText);

  if (totalValue === 0) {
    svg.innerHTML = `<circle cx="50" cy="50" r="40" stroke="#e5e7eb" stroke-width="15" fill="none"/>`;
  } else {
    const radius = 40;
    const strokeWidth = 15;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    data.forEach(item => {
        if (item.value === 0) return;
        const percent = (item.value / totalValue) * 100;
        const segmentLength = (percent / 100) * circumference;
        const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        segment.setAttribute('cx', '50'); segment.setAttribute('cy', '50');
        segment.setAttribute('r', String(radius)); segment.setAttribute('fill', 'none');
        segment.setAttribute('stroke', item.color); segment.setAttribute('stroke-width', String(strokeWidth));
        segment.setAttribute('stroke-dasharray', `${segmentLength} ${circumference}`);
        segment.setAttribute('stroke-dashoffset', String(-offset));
        segment.setAttribute('transform', `rotate(-90 50 50)`);
        svg.appendChild(segment);
        offset += segmentLength;
    });
  }
  svg.appendChild(textGroup);
  chartWrapper.appendChild(svg);
  container.appendChild(chartWrapper);

  const legend = document.createElement('div');
  legend.className = 'donut-chart-legend';
  data.forEach(item => {
    const legendItem = document.createElement('div');
    legendItem.className = 'donut-legend-item';
    legendItem.innerHTML = `<span class="legend-color-box" style="background-color: ${item.color};"></span>
                            <span class="legend-label">${item.label}</span>
                            <span class="legend-value">${item.value.toLocaleString()} days</span>`;
    legend.appendChild(legendItem);
  });
  
  container.appendChild(legend);
  return container;
}

function createBarChart(data, title) {
    const container = document.createElement('div');
    container.className = 'bar-chart-container';
    
    if (title) {
        const chartTitle = document.createElement('h4');
        chartTitle.className = 'kpi-panel-section-title';
        chartTitle.textContent = title;
        container.appendChild(chartTitle);
    }

    const chart = document.createElement('div');
    chart.className = 'bar-chart';
    
    const maxValue = Math.max(...data.map(d => d.value), 0);
    
    if (maxValue === 0) {
        chart.innerHTML = `<p class="insight-list-empty">No leave data available.</p>`;
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
            barValue.textContent = `${item.value} day(s)`;
            
            barElement.appendChild(barFill);
            barWrapper.append(barLabel, barElement, barValue);
            chart.appendChild(barWrapper);
        });
    }
    container.appendChild(chart);
    return container;
}


function createInsightList(title, items, unit = 'days') {
    const container = document.createElement('div');
    container.className = 'insight-list-wrapper';

    const listTitle = document.createElement('h4');
    listTitle.className = 'kpi-panel-section-title';
    listTitle.textContent = title;
    container.appendChild(listTitle);

    if (items.length === 0) {
        container.innerHTML += `<p class="insight-list-empty">No data available.</p>`;
        return container;
    }

    const list = document.createElement('ul');
    list.className = 'insight-list';
    const maxValue = items.length > 0 ? items[0].value : 0;

    items.slice(0, 5).forEach(item => {
        const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const li = document.createElement('li');
        li.className = 'insight-list-item';
        li.innerHTML = `
            <div class="insight-item-label" title="${item.label}">${item.label}</div>
            <div class="insight-item-bar-container">
                <div class="insight-item-bar" style="width: ${percentage}%; background-color: ${item.color || 'var(--color-primary)'};"></div>
            </div>
            <div class="insight-item-value">${item.value.toLocaleString()} ${unit}</div>
        `;
        list.appendChild(li);
    });

    container.appendChild(list);
    return container;
}

export function renderAttendancePage(container, props) {
  const {
    attendanceRecords, teamMembers, projects, currentUser,
    attendanceStatuses, leaveTypes, onUpsertAttendanceRecord, onDeleteAttendanceRecord,
    onExport, onImport, maxTeamMembers, onAddTeamMember, onUpdateTeamMember,
    onDeleteTeamMember, onExportTeam, onImportTeam, internalTeams, holidays
  } = props;

  const isManager = currentUser.role === TeamMemberRole.Manager;

  // State for daily log
  let selectedDate = new Date().toISOString().split('T')[0];

  // State for analysis section
  let analysisStartDate = new Date(new Date().setDate(new Date().getDate() - 29)).toISOString().split('T')[0];
  let analysisEndDate = new Date().toISOString().split('T')[0];
  let analysisMemberFilter = '';

  // State for log viewer modal
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
  dateLabel.textContent = 'Select Date for Daily Log:';
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

  // --- NEW: Attendance Analysis Section ---
  const analysisSection = document.createElement('div');
  analysisSection.className = 'attendance-page-section';
  pageWrapper.appendChild(analysisSection);

  function renderAnalysisSection() {
      analysisSection.innerHTML = '';

      // Filters
      const filtersDiv = document.createElement('div');
      filtersDiv.className = "worklog-filters-container";
      const filterGrid = document.createElement('div');
      filterGrid.className = "worklog-filters-grid";

      if (isManager) {
        const memberFilterContainer = document.createElement('div');
        memberFilterContainer.innerHTML = `<label for="analysisMemberFilter" class="form-label">Member</label>`;
        const memberFilter = document.createElement('select');
        memberFilter.id = 'analysisMemberFilter';
        memberFilter.className = "form-select";
        memberFilter.innerHTML = `<option value="">All Members</option>` + teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        memberFilter.value = analysisMemberFilter;
        memberFilter.onchange = (e) => { analysisMemberFilter = e.target.value; renderAnalysisSection(); };
        memberFilterContainer.appendChild(memberFilter);
        filterGrid.appendChild(memberFilterContainer);
      }

      const dateRangeOuterContainer = document.createElement('div');
      dateRangeOuterContainer.className = "filter-date-range-container";
      dateRangeOuterContainer.innerHTML = `<label class="form-label">Analysis Date Range</label>`;
      const dateRangeInnerContainer = document.createElement('div');
      dateRangeInnerContainer.className = "filter-date-range-inner";
      
      const startDateInput = document.createElement('input');
      startDateInput.type = 'date'; startDateInput.className = 'form-input';
      startDateInput.value = analysisStartDate;
      startDateInput.onchange = e => { analysisStartDate = e.target.value; renderAnalysisSection(); };
      
      const toLabel = document.createElement('span');
      toLabel.className = 'date-range-separator';
      toLabel.textContent = 'to';

      const endDateInput = document.createElement('input');
      endDateInput.type = 'date'; endDateInput.className = 'form-input';
      endDateInput.value = analysisEndDate;
      endDateInput.onchange = e => { analysisEndDate = e.target.value; renderAnalysisSection(); };
      dateRangeInnerContainer.append(startDateInput, toLabel, endDateInput);
      dateRangeOuterContainer.appendChild(dateRangeInnerContainer);
      filterGrid.appendChild(dateRangeOuterContainer);
      
      filtersDiv.appendChild(filterGrid);
      analysisSection.appendChild(filtersDiv);

      // Data Calculation
      const filteredRecords = attendanceRecords.filter(rec => {
          const isMemberMatch = !analysisMemberFilter || rec.memberId === analysisMemberFilter;
          const isDateMatch = rec.date >= analysisStartDate && rec.date <= analysisEndDate;
          return isMemberMatch && isDateMatch;
      });

      const stats = { present: 0, wfh: 0, leave: 0 };
      const leavesByType = {};
      const leavesByMember = {};
      const presenceByMember = {};

      filteredRecords.forEach(rec => {
          if (rec.status === AttendanceStatus.Present) stats.present++;
          if (rec.status === AttendanceStatus.WorkFromHome) stats.wfh++;
          if (rec.status === AttendanceStatus.Leave) {
              stats.leave++;
              leavesByType[rec.leaveType] = (leavesByType[rec.leaveType] || 0) + 1;
              leavesByMember[rec.memberId] = (leavesByMember[rec.memberId] || 0) + 1;
          }
          if (rec.status === AttendanceStatus.Present || rec.status === AttendanceStatus.WorkFromHome) {
              presenceByMember[rec.memberId] = (presenceByMember[rec.memberId] || 0) + 1;
          }
      });
      
      const totalPresence = stats.present + stats.wfh;
      const totalDays = totalPresence + stats.leave;
      const presenceRate = totalDays > 0 ? ((totalPresence / totalDays) * 100).toFixed(0) : 0;
      
      // Summary Cards
      const summaryContainer = document.createElement('div');
      summaryContainer.className = 'work-log-summary-container';
      summaryContainer.innerHTML = `
          <div class="work-log-summary-card">
              <div class="label">Total Presence</div>
              <div class="value">${totalPresence.toLocaleString()}</div>
              <div class="sub-label">Present & WFH days</div>
          </div>
          <div class="work-log-summary-card">
              <div class="label">Total Leaves</div>
              <div class="value">${stats.leave.toLocaleString()}</div>
              <div class="sub-label">Days on leave</div>
          </div>
          <div class="work-log-summary-card">
              <div class="label">Team Presence Rate</div>
              <div class="value">${presenceRate}%</div>
              <div class="sub-label">For logged days</div>
          </div>
      `;
      analysisSection.appendChild(summaryContainer);
      
      // Analysis Grid
      const analysisGrid = document.createElement('div');
      analysisGrid.className = 'analysis-dashboard-grid';
      analysisGrid.style.marginTop = '1.5rem';

      // Left Column: Charts
      const leftCol = document.createElement('div');
      leftCol.className = 'kpi-insights-panel';
      leftCol.innerHTML = `<h3 class="kpi-panel-title"><i class="fas fa-chart-pie"></i> Distributions</h3>`;
      
      const donutData = [
          { label: 'Present', value: stats.present, color: '#22c55e' },
          { label: 'Work From Home', value: stats.wfh, color: '#3b82f6' },
          { label: 'Leave', value: stats.leave, color: '#f97316' },
      ];
      leftCol.appendChild(createDonutChart(donutData, totalDays));

      const leaveTypesData = Object.entries(leavesByType)
        .map(([type, count]) => ({ label: type || 'Other', value: count, color: '#ef4444' }))
        .sort((a,b) => b.value - a.value);
      leftCol.appendChild(createBarChart(leaveTypesData, 'Leave Types Breakdown'));
      
      analysisGrid.appendChild(leftCol);

      // Right Column: Insights
      const rightCol = document.createElement('div');
      rightCol.className = 'kpi-insights-panel';
      rightCol.innerHTML = `<h3 class="kpi-panel-title"><i class="fas fa-chart-line"></i> Member Insights</h3>`;

      const topLeaves = Object.entries(leavesByMember)
        .map(([memberId, count]) => ({ label: teamMembers.find(m => m.id === memberId)?.name || 'Unknown', value: count }))
        .sort((a,b) => b.value - a.value);
      rightCol.appendChild(createInsightList('Most Leaves Taken', topLeaves, 'days'));
      
      const topPresence = Object.entries(presenceByMember)
        .map(([memberId, count]) => ({ label: teamMembers.find(m => m.id === memberId)?.name || 'Unknown', value: count, color: '#16a34a' }))
        .sort((a,b) => b.value - a.value);
      rightCol.appendChild(createInsightList('Highest Presence', topPresence, 'days'));
      
      analysisGrid.appendChild(rightCol);
      analysisSection.appendChild(analysisGrid);
  }

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
  renderAnalysisSection();
  renderDailyLogGrid();
  renderTeamList();
  container.appendChild(pageWrapper);
}
