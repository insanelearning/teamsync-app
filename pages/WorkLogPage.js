
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';

let currentModalInstance = null;

function formatMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

export function renderWorkLogPage(container, props) {
    const { workLogs, teamMembers, projects, currentUser, onAddMultipleWorkLogs, onUpdateWorkLog, onDeleteWorkLog, onExport, onImport } = props;

    let filterState = {
        memberId: '',
        projectId: '',
        startDate: new Date(new Date().setDate(new Date().getDate() - 29)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    };

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // --- Header ---
    const headerDiv = document.createElement('div');
    headerDiv.className = "page-header";
    const headerTitle = document.createElement('h1');
    headerTitle.className = 'page-header-title';
    headerTitle.textContent = 'Work Log';
    headerDiv.appendChild(headerTitle);

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = "page-header-actions";
    actionsWrapper.append(
        Button({ children: 'Export CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: onExport }),
        FileUploadButton({
            children: 'Import CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv',
            onFileSelect: (file) => { if (file) onImport(file); }
        }),
        Button({ children: 'Add Work Log', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>', onClick: () => openModal() })
    );
    headerDiv.appendChild(actionsWrapper);
    pageWrapper.appendChild(headerDiv);

    // --- Summary Section ---
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'work-log-summary-container';
    
    const summaryTodayCard = document.createElement('div');
    summaryTodayCard.className = 'work-log-summary-card';
    const summaryWeekCard = document.createElement('div');
    summaryWeekCard.className = 'work-log-summary-card';
    const summaryMonthCard = document.createElement('div');
    summaryMonthCard.className = 'work-log-summary-card';
    
    summaryContainer.append(summaryTodayCard, summaryWeekCard, summaryMonthCard);
    pageWrapper.appendChild(summaryContainer);

    // --- Filters & Table Section ---
    const contentSection = document.createElement('div');
    contentSection.className = 'attendance-page-section'; // Reuse styles
    
    // Filters
    const filtersDiv = document.createElement('div');
    filtersDiv.className = "filters-container";
    const filterGrid = document.createElement('div');
    filterGrid.className = "worklog-filters-grid";
    
    // Member Filter
    const memberFilterContainer = document.createElement('div');
    memberFilterContainer.innerHTML = `<label for="memberFilter" class="form-label">Member</label>`;
    const memberFilter = document.createElement('select');
    memberFilter.id = 'memberFilter';
    memberFilter.className = "form-select";
    memberFilter.innerHTML = `<option value="">All Members</option>` + teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    memberFilter.value = filterState.memberId;
    memberFilter.onchange = (e) => { filterState.memberId = e.target.value; rerenderPage(); };
    memberFilterContainer.appendChild(memberFilter);
    filterGrid.appendChild(memberFilterContainer);

    // Project Filter
    const projectFilterContainer = document.createElement('div');
    projectFilterContainer.innerHTML = `<label for="projectFilter" class="form-label">Project</label>`;
    const projectFilter = document.createElement('select');
    projectFilter.id = 'projectFilter';
    projectFilter.className = "form-select";
    projectFilter.innerHTML = `<option value="">All Projects</option>` + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    projectFilter.value = filterState.projectId;
    projectFilter.onchange = (e) => { filterState.projectId = e.target.value; rerenderPage(); };
    projectFilterContainer.appendChild(projectFilter);
    filterGrid.appendChild(projectFilterContainer);

    // Date Range Filter
    const dateRangeOuterContainer = document.createElement('div');
    dateRangeOuterContainer.className = "filter-date-range-container";
    dateRangeOuterContainer.innerHTML = `<label class="form-label">Date Range</label>`;

    const dateRangeInnerContainer = document.createElement('div');
    dateRangeInnerContainer.className = "filter-date-range-inner";
    
    const startDateInput = document.createElement('input');
    startDateInput.type = 'date'; startDateInput.className = 'form-input';
    startDateInput.value = filterState.startDate;
    startDateInput.setAttribute('aria-label', 'Start Date');
    startDateInput.onchange = e => { filterState.startDate = e.target.value; rerenderPage(); };
    
    const toLabel = document.createElement('span');
    toLabel.className = 'date-range-separator';
    toLabel.textContent = 'to';

    const endDateInput = document.createElement('input');
    endDateInput.type = 'date'; endDateInput.className = 'form-input';
    endDateInput.value = filterState.endDate;
    endDateInput.setAttribute('aria-label', 'End Date');
    endDateInput.onchange = e => { filterState.endDate = e.target.value; rerenderPage(); };
    dateRangeInnerContainer.append(startDateInput, toLabel, endDateInput);
    dateRangeOuterContainer.appendChild(dateRangeInnerContainer);
    filterGrid.appendChild(dateRangeOuterContainer);
    
    filtersDiv.appendChild(filterGrid);
    contentSection.appendChild(filtersDiv);

    // Table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container';
    contentSection.appendChild(tableContainer);
    pageWrapper.appendChild(contentSection);

    function getFilteredLogs() {
        // Use simple string comparison for YYYY-MM-DD format, which is robust against timezone issues.
        return workLogs.filter(log => {
            const isMemberMatch = !filterState.memberId || log.memberId === filterState.memberId;
            const isProjectMatch = !filterState.projectId || log.projectId === filterState.projectId;
            const isDateMatch = log.date >= filterState.startDate && log.date <= filterState.endDate;

            return isMemberMatch && isProjectMatch && isDateMatch;
        }).sort((a,b) => new Date(b.date) - new Date(a.date));
    }
    
    function updateSummaries(logsToSummarize) {
        const now = new Date();
        const today = new Date().toISOString().split('T')[0];
        const weekStartObj = new Date();
        // Set to Monday of the current week
        weekStartObj.setDate(weekStartObj.getDate() - (weekStartObj.getDay() || 7) + 1);
        const weekStart = weekStartObj.toISOString().split('T')[0];
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const todayLogs = logsToSummarize.filter(l => l.date === today);
        const weekLogs = logsToSummarize.filter(l => l.date >= weekStart);
        const monthLogs = logsToSummarize.filter(l => l.date >= monthStart);

        const sumMins = (logs) => logs.reduce((acc, log) => acc + (log.timeSpentMinutes || 0), 0);

        summaryTodayCard.innerHTML = `<div class="label">Today</div><div class="value">${formatMinutes(sumMins(todayLogs))}</div>`;
        summaryWeekCard.innerHTML = `<div class="label">This Week</div><div class="value">${formatMinutes(sumMins(weekLogs))}</div>`;
        summaryMonthCard.innerHTML = `<div class="label">This Month</div><div class="value">${formatMinutes(sumMins(monthLogs))}</div>`;
    }

    function rerenderTable(filteredLogs) {
        tableContainer.innerHTML = '';

        if (filteredLogs.length === 0) {
            tableContainer.innerHTML = `
                <div class="no-data-placeholder">
                    <i class="fas fa-folder-open icon"></i>
                    <p class="primary-text">No work logs found.</p>
                    <p class="secondary-text">Try adjusting the filters or add a new log.</p>
                </div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table work-log-table';
        table.innerHTML = `<thead><tr>
            <th>Date</th>
            <th>Member</th>
            <th>Project</th>
            <th>Task</th>
            <th>Comments</th>
            <th>Time Spent</th>
            <th class="action-cell">Actions</th>
        </tr></thead>`;
        const tbody = document.createElement('tbody');
        
        const getMemberName = (id) => teamMembers.find(m => m.id === id)?.name || 'N/A';
        const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'N/A';

        filteredLogs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.date + 'T00:00:00').toLocaleDateString()}</td>
                <td>${getMemberName(log.memberId)}</td>
                <td>${getProjectName(log.projectId)}</td>
                <td class="truncate" title="${log.taskName}">${log.taskName}</td>
                <td class="truncate" title="${log.comments || ''}">${log.comments || '-'}</td>
                <td>${formatMinutes(log.timeSpentMinutes)}</td>
            `;

            const actionCell = document.createElement('td');
            actionCell.className = 'action-cell';
            actionCell.append(
                Button({ variant: 'ghost', size: 'sm', onClick: () => openModal(log), children: '<i class="fas fa-edit"></i>' }),
                Button({ variant: 'danger', size: 'sm', onClick: () => {
                    if (confirm('Delete this log entry?')) onDeleteWorkLog(log.id);
                }, children: '<i class="fas fa-trash"></i>' })
            );
            tr.appendChild(actionCell);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableContainer.appendChild(table);
    }
    
    function openModal(log = null) {
        const form = WorkLogForm({
            log, currentUser, teamMembers, projects,
            onSave: (logData) => { // For single edits
                onUpdateWorkLog(logData);
                closeModal();
            },
            onSaveAll: (logsData) => { // For multi-add
                onAddMultipleWorkLogs(logsData);
                closeModal();
            },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: log ? 'Edit Work Log' : 'Add Work Log(s)',
            children: form,
            size: 'xl'
        });
    }

    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    function rerenderPage() {
        const filteredLogs = getFilteredLogs();
        updateSummaries(filteredLogs);
        rerenderTable(filteredLogs);
    }

    rerenderPage();
    container.appendChild(pageWrapper);
}
