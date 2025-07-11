
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
    const { workLogs, teamMembers, projects, currentUser, onAddWorkLog, onUpdateWorkLog, onDeleteWorkLog, onExport, onImport } = props;

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
    filterGrid.className = "form-grid-cols-3"; // 3 column grid for filters
    
    // Member Filter
    const memberFilter = document.createElement('select');
    memberFilter.className = "form-select";
    memberFilter.innerHTML = `<option value="">All Members</option>` + teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    memberFilter.value = filterState.memberId;
    memberFilter.onchange = (e) => { filterState.memberId = e.target.value; rerenderPage(); };
    filterGrid.appendChild(memberFilter);

    // Project Filter
    const projectFilter = document.createElement('select');
    projectFilter.className = "form-select";
    projectFilter.innerHTML = `<option value="">All Projects</option>` + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    projectFilter.value = filterState.projectId;
    projectFilter.onchange = (e) => { filterState.projectId = e.target.value; rerenderPage(); };
    filterGrid.appendChild(projectFilter);

    // Date Range Filter
    const dateRangeContainer = document.createElement('div');
    dateRangeContainer.className = "flex items-center gap-2";
    const startDateInput = document.createElement('input');
    startDateInput.type = 'date'; startDateInput.className = 'form-input';
    startDateInput.value = filterState.startDate;
    startDateInput.onchange = e => { filterState.startDate = e.target.value; rerenderPage(); };
    const endDateInput = document.createElement('input');
    endDateInput.type = 'date'; endDateInput.className = 'form-input';
    endDateInput.value = filterState.endDate;
    endDateInput.onchange = e => { filterState.endDate = e.target.value; rerenderPage(); };
    dateRangeContainer.append(startDateInput, document.createTextNode('to'), endDateInput);
    filterGrid.appendChild(dateRangeContainer);
    
    filtersDiv.appendChild(filterGrid);
    contentSection.appendChild(filtersDiv);

    // Table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container';
    contentSection.appendChild(tableContainer);
    pageWrapper.appendChild(contentSection);

    function getFilteredLogs() {
        return workLogs.filter(log => {
            const logDate = new Date(log.date);
            const startDate = new Date(filterState.startDate);
            const endDate = new Date(filterState.endDate);
            
            const isMemberMatch = !filterState.memberId || log.memberId === filterState.memberId;
            const isProjectMatch = !filterState.projectId || log.projectId === filterState.projectId;
            const isDateMatch = logDate >= startDate && logDate <= endDate;

            return isMemberMatch && isProjectMatch && isDateMatch;
        }).sort((a,b) => new Date(b.date) - new Date(a.date));
    }
    
    function updateSummaries() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const todayLogs = workLogs.filter(l => l.date === today);
        const weekLogs = workLogs.filter(l => l.date >= weekStart);
        const monthLogs = workLogs.filter(l => l.date >= monthStart);

        const sumMins = (logs) => logs.reduce((acc, log) => acc + (log.timeSpentMinutes || 0), 0);

        summaryTodayCard.innerHTML = `<div class="label">Today</div><div class="value">${formatMinutes(sumMins(todayLogs))}</div>`;
        summaryWeekCard.innerHTML = `<div class="label">This Week</div><div class="value">${formatMinutes(sumMins(weekLogs))}</div>`;
        summaryMonthCard.innerHTML = `<div class="label">This Month</div><div class="value">${formatMinutes(sumMins(monthLogs))}</div>`;
    }

    function rerenderTable() {
        tableContainer.innerHTML = '';
        const filteredLogs = getFilteredLogs();

        if (filteredLogs.length === 0) {
            tableContainer.innerHTML = `<div class="no-data-placeholder"><i class="fas fa-folder-open icon"></i><p>No work logs found for the selected filters.</p></div>`;
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
            onSave: (logData) => {
                log ? onUpdateWorkLog(logData) : onAddWorkLog(logData);
                closeModal();
            },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: log ? 'Edit Work Log' : 'Add Work Log',
            children: form,
            size: 'lg'
        });
    }

    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    function rerenderPage() {
        updateSummaries();
        rerenderTable();
    }

    rerenderPage();
    container.appendChild(pageWrapper);
}
