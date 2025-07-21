

import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { TeamMemberRole } from '../types.js';

let currentModalInstance = null;

function formatMinutes(minutes) {
    const totalMinutes = Math.round(minutes);
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
}

export function renderWorkLogPage(container, props) {
    const { workLogs, teamMembers, projects, currentUser, onAddMultipleWorkLogs, onUpdateWorkLog, onDeleteWorkLog, onExport, onImport } = props;

    const isManager = currentUser.role === TeamMemberRole.Manager;
    let currentPage = 1;
    let rowsPerPage = 10;

    let filterState = {
        memberId: isManager ? '' : currentUser.id,
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

    if (isManager) {
        actionsWrapper.append(
            Button({ children: 'Export CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: onExport }),
            FileUploadButton({
                children: 'Import CSV', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv',
                onFileSelect: (file) => { if (file) onImport(file); }
            })
        );
    }
    actionsWrapper.appendChild(Button({ children: 'Add Work Log', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>', onClick: () => openModal() }));
    
    headerDiv.appendChild(actionsWrapper);
    pageWrapper.appendChild(headerDiv);

    // --- Summary Section ---
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'work-log-summary-container';
    
    const rangeTotalCard = document.createElement('div');
    rangeTotalCard.className = 'work-log-summary-card';
    const avgHoursCard = document.createElement('div');
    avgHoursCard.className = 'work-log-summary-card';
    const efficiencyCard = document.createElement('div');
    efficiencyCard.className = 'work-log-summary-card';
    
    summaryContainer.append(rangeTotalCard, avgHoursCard, efficiencyCard);
    pageWrapper.appendChild(summaryContainer);

    // --- Filters & Table Section ---
    const contentSection = document.createElement('div');
    contentSection.className = 'attendance-page-section'; // Reuse styles
    
    // Filters
    const filtersDiv = document.createElement('div');
    filtersDiv.className = "filters-container";
    const filterGrid = document.createElement('div');
    filterGrid.className = "worklog-filters-grid";
    
    // Member Filter (Only for Managers)
    if (isManager) {
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
    }

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

    // Pagination
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    contentSection.appendChild(paginationContainer);

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
        const totalMinutes = logsToSummarize.reduce((acc, log) => acc + (log.timeSpentMinutes || 0), 0);

        // --- Calculation for person-days (unique member+date combinations) ---
        const personDays = new Set(logsToSummarize.map(log => `${log.memberId}|${log.date}`)).size;

        // --- Card 1: Selected Range Total ---
        const start = new Date(filterState.startDate + 'T00:00:00');
        const end = new Date(filterState.endDate + 'T00:00:00');
        // Calculate number of days in the selected range
        const timeDiff = end.getTime() - start.getTime();
        const dayDiff = timeDiff >= 0 ? Math.round(timeDiff / (1000 * 3600 * 24)) + 1 : 0;
        const dayDiffText = dayDiff > 0 ? `(${dayDiff} day${dayDiff !== 1 ? 's' : ''})` : '';
        
        rangeTotalCard.innerHTML = `
            <div class="label">Selected Range Total</div>
            <div class="value">${formatMinutes(totalMinutes)}</div>
            <div class="sub-label">${start.toLocaleDateString()} - ${end.toLocaleDateString()} ${dayDiffText}</div>`;
        
        // --- Card 2: Average Hours / Day ---
        const avgMinutesPerPersonDay = personDays > 0 ? (totalMinutes / personDays) : 0;
        
        avgHoursCard.innerHTML = `
            <div class="label">Average Hours / Day</div>
            <div class="value">${formatMinutes(avgMinutesPerPersonDay)}</div>
            <div class="sub-label">Avg. per person per workday</div>`;

        // --- Card 3: Efficiency ---
        const expectedMinutes = personDays * 8 * 60; // 8 hours goal for each person-day
        const efficiency = expectedMinutes > 0 ? Math.round((totalMinutes / expectedMinutes) * 100) : 0;
        
        efficiencyCard.innerHTML = `
            <div class="label">Efficiency</div>
            <div class="efficiency-dial" style="--progress: ${efficiency}%;">
                <div class="dial-center">
                    <span class="value">${efficiency}%</span>
                </div>
            </div>
            <div class="sub-label">Against 8h/day goal</div>`;
    }

    function rerenderTableAndPagination(allFilteredLogs) {
        // Pagination logic
        const totalRows = allFilteredLogs.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const logsForPage = allFilteredLogs.slice(startIndex, endIndex);

        // Render Table
        tableContainer.innerHTML = '';
        if (logsForPage.length === 0) {
            tableContainer.innerHTML = `
                <div class="no-data-placeholder">
                    <i class="fas fa-folder-open icon"></i>
                    <p class="primary-text">No work logs found.</p>
                    <p class="secondary-text">Try adjusting the filters or add a new log.</p>
                </div>`;
        } else {
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

            logsForPage.forEach(log => {
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
                if (isManager || currentUser.id === log.memberId) {
                    actionCell.append(
                        Button({ variant: 'ghost', size: 'sm', onClick: () => openModal(log), children: '<i class="fas fa-edit"></i>' }),
                        Button({ variant: 'danger', size: 'sm', onClick: () => {
                            if (confirm('Delete this log entry?')) onDeleteWorkLog(log.id);
                        }, children: '<i class="fas fa-trash"></i>' })
                    );
                }
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);
        }

        // Render Pagination Controls
        paginationContainer.innerHTML = '';
        if (totalRows > 0) {
            const rowsSelectorContainer = document.createElement('div');
            rowsSelectorContainer.className = 'pagination-rows-selector';
            rowsSelectorContainer.innerHTML = `<label for="rowsPerPageSelect" class="form-label mb-0">Rows:</label>`;
            const rowsSelect = document.createElement('select');
            rowsSelect.id = 'rowsPerPageSelect';
            rowsSelect.className = 'form-select';
            rowsSelect.innerHTML = `
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>`;
            rowsSelect.value = rowsPerPage;
            rowsSelect.onchange = (e) => {
                rowsPerPage = Number(e.target.value);
                currentPage = 1;
                rerenderPage();
            };
            rowsSelectorContainer.appendChild(rowsSelect);

            const navContainer = document.createElement('div');
            navContainer.className = 'pagination-nav';
            const pageInfo = document.createElement('span');
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

            const prevButton = Button({ children: 'Prev', variant: 'secondary', size: 'sm', disabled: currentPage === 1, onClick: () => {
                if(currentPage > 1) { currentPage--; rerenderPage(); }
            }});
            const nextButton = Button({ children: 'Next', variant: 'secondary', size: 'sm', disabled: currentPage >= totalPages, onClick: () => {
                if(currentPage < totalPages) { currentPage++; rerenderPage(); }
            }});

            navContainer.append(prevButton, pageInfo, nextButton);
            paginationContainer.append(rowsSelectorContainer, navContainer);
        }
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
        rerenderTableAndPagination(filteredLogs);
    }

    rerenderPage();
    container.appendChild(pageWrapper);
}
