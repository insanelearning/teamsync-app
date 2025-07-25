
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { TeamMemberRole } from '../types.js';

let currentModalInstance = null;

function formatMinutes(minutes) {
    const totalMinutes = Math.round(minutes);
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function renderWorkLogPage(container, props) {
    const {
        workLogs,
        teamMembers,
        projects,
        currentUser,
        appSettings,
        onAddMultipleWorkLogs,
        onUpdateWorkLog,
        onDeleteWorkLog,
        onExport,
        onImport,
    } = props;

    const isManager = currentUser.role === TeamMemberRole.Manager;

    // Filtering and pagination state
    let memberFilter = isManager ? '' : currentUser.id;
    let projectFilter = '';
    // Default date range: last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    let startDateFilter = sevenDaysAgo.toISOString().split('T')[0];
    let endDateFilter = today.toISOString().split('T')[0];
    
    let currentPage = 1;
    let rowsPerPage = 10;

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = "page-header";
    const headerTitle = document.createElement('h1');
    headerTitle.className = 'page-header-title';
    headerTitle.textContent = 'Work Log';
    headerDiv.appendChild(headerTitle);

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = "page-header-actions";
    actionsWrapper.append(
        Button({
            children: 'Add Log',
            size: 'sm',
            leftIcon: '<i class="fas fa-plus"></i>',
            onClick: () => openModalForNew(getMemberFilteredTasks(memberFilter || currentUser.id))
        })
    );
    if (isManager) {
        actionsWrapper.append(
            Button({ children: 'Export Logs', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>', onClick: () => onExport('worklogs') }),
            FileUploadButton({
                children: 'Import Logs', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv',
                onFileSelect: (file) => { if (file) onImport(file, 'worklogs'); }
            })
        );
    }
    headerDiv.appendChild(actionsWrapper);
    pageWrapper.appendChild(headerDiv);
    
    const summaryContainer = document.createElement('div');
    pageWrapper.appendChild(summaryContainer);
    
    const mainContentContainer = document.createElement('div');
    mainContentContainer.className = 'worklog-main-content'; // A specific class for this section
    pageWrapper.appendChild(mainContentContainer);

    function getMemberFilteredTasks(selectedMemberId) {
        const member = teamMembers.find(m => m.id === selectedMemberId);
        const memberTeam = member?.internalTeam;
        
        const allTasks = appSettings.workLogTasks || [];
        // If a team is defined for the member, filter tasks for that team. Otherwise, show all tasks.
        const tasksForMember = memberTeam ? allTasks.filter(task => (task.teams || []).includes(memberTeam)) : allTasks;

        // Group tasks by category
        const groupedTasks = {};
        tasksForMember.forEach(task => {
            if (!groupedTasks[task.category]) {
                groupedTasks[task.category] = [];
            }
            groupedTasks[task.category].push(task);
        });
        return groupedTasks;
    }


    function getFilteredAndSortedLogs() {
        const filtered = workLogs.filter(log =>
            (!memberFilter || log.memberId === memberFilter) &&
            (!projectFilter || log.projectId === projectFilter) &&
            (log.date >= startDateFilter) &&
            (log.date <= endDateFilter)
        );
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    function rerenderContent() {
        mainContentContainer.innerHTML = '';
        summaryContainer.innerHTML = '';

        const displayLogs = getFilteredAndSortedLogs();
        
        // Render Summary
        renderSummary(displayLogs);
        
        // Render Filters
        mainContentContainer.appendChild(createFilters());
        
        // Render Table
        renderTable(displayLogs);
    }
    
    function renderSummary(displayLogs) {
        const totalMinutes = displayLogs.reduce((sum, log) => sum + log.timeSpentMinutes, 0);
        const uniqueProjects = [...new Set(displayLogs.map(log => log.projectId))];
        const uniqueMembers = [...new Set(displayLogs.map(log => log.memberId))];

        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'kpi-grid'; // Reuse kpi-grid for layout
        summaryGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-card-icon"><i class="fas fa-stopwatch"></i></div>
                <div><div class="stat-card-value">${formatMinutes(totalMinutes)}</div><div class="stat-card-label">Total Time Logged</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon"><i class="fas fa-layer-group"></i></div>
                <div><div class="stat-card-value">${uniqueProjects.length}</div><div class="stat-card-label">Projects Worked On</div></div>
            </div>
            <div class="stat-card">
                 <div class="stat-card-icon"><i class="fas fa-users"></i></div>
                <div><div class="stat-card-value">${uniqueMembers.length}</div><div class="stat-card-label">Members Contributed</div></div>
            </div>
             <div class="stat-card">
                 <div class="stat-card-icon"><i class="fas fa-clipboard-list"></i></div>
                <div><div class="stat-card-value">${displayLogs.length}</div><div class="stat-card-label">Total Entries</div></div>
            </div>
        `;
        summaryContainer.appendChild(summaryGrid);
    }
    
    function createFilters() {
        const filtersDiv = document.createElement('div');
        filtersDiv.className = "filters-container";
        const filterGrid = document.createElement('div');
        filterGrid.className = "filters-grid";
        filterGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';

        // Member Filter (Manager only)
        if (isManager) {
            const memberDiv = document.createElement('div');
            const memberSelect = document.createElement('select');
            memberSelect.className = 'form-select';
            memberSelect.innerHTML = `<option value="">All Members</option>` + teamMembers.map(m => `<option value="${m.id}" ${memberFilter === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
            memberSelect.onchange = (e) => { memberFilter = e.target.value; currentPage = 1; rerenderContent(); };
            memberDiv.appendChild(memberSelect);
            filterGrid.appendChild(memberDiv);
        }

        // Project Filter
        const projectDiv = document.createElement('div');
        const projectSelect = document.createElement('select');
        projectSelect.className = 'form-select';
        projectSelect.innerHTML = `<option value="">All Projects</option>` + projects.map(p => `<option value="${p.id}" ${projectFilter === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        projectSelect.onchange = (e) => { projectFilter = e.target.value; currentPage = 1; rerenderContent(); };
        projectDiv.appendChild(projectSelect);
        filterGrid.appendChild(projectDiv);

        // Date Range Filter
        const startDateInput = document.createElement('input');
        startDateInput.type = 'date'; startDateInput.className = 'form-input'; startDateInput.value = startDateFilter;
        startDateInput.onchange = (e) => { startDateFilter = e.target.value; currentPage = 1; rerenderContent(); };
        filterGrid.appendChild(startDateInput);

        const endDateInput = document.createElement('input');
        endDateInput.type = 'date'; endDateInput.className = 'form-input'; endDateInput.value = endDateFilter;
        endDateInput.onchange = (e) => { endDateFilter = e.target.value; currentPage = 1; rerenderContent(); };
        filterGrid.appendChild(endDateInput);

        // Reset Button
        const resetButton = Button({
            children: 'Reset',
            variant: 'ghost',
            onClick: () => {
                memberFilter = isManager ? '' : currentUser.id;
                projectFilter = '';
                startDateFilter = sevenDaysAgo.toISOString().split('T')[0];
                endDateFilter = today.toISOString().split('T')[0];
                currentPage = 1;
                rerenderContent();
            }
        });
        filterGrid.appendChild(resetButton);

        filtersDiv.appendChild(filterGrid);
        return filtersDiv;
    }

    function renderTable(displayLogs) {
        const tableAndPaginationContainer = document.createElement('div');
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container';
        
        const totalLogs = displayLogs.length;
        const totalPages = Math.ceil(totalLogs / rowsPerPage) || 1;
        currentPage = Math.min(currentPage, totalPages || 1);
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const logsForPage = displayLogs.slice(startIndex, endIndex);

        if (logsForPage.length > 0) {
            const table = document.createElement('table');
            table.className = 'data-table work-log-table';
            let headHtml = `<thead><tr><th>Date</th>`;
            if (isManager) headHtml += `<th>Member</th>`;
            headHtml += `<th>Project</th><th>Task</th><th>Time</th><th>Comments</th><th class="action-cell">Actions</th></tr></thead>`;
            table.innerHTML = headHtml;

            const tbody = document.createElement('tbody');
            logsForPage.forEach(log => {
                const tr = document.createElement('tr');
                const memberName = teamMembers.find(tm => tm.id === log.memberId)?.name || 'Unknown';
                const projectName = projects.find(p => p.id === log.projectId)?.name || 'Unknown Project';
                
                let rowHtml = `<td>${new Date(log.date + 'T00:00:00').toLocaleDateString()}</td>`;
                if (isManager) rowHtml += `<td>${memberName}</td>`;
                rowHtml += `<td>${projectName}</td><td>${log.taskName}</td><td>${formatMinutes(log.timeSpentMinutes)}</td><td><div class="truncate" title="${log.comments || ''}">${log.comments || '-'}</div></td>`;
                tr.innerHTML = rowHtml;

                const actionCell = document.createElement('td');
                actionCell.className = 'action-cell';
                if (isManager || currentUser.id === log.memberId) {
                    actionCell.append(
                        Button({
                            variant: 'ghost', size: 'sm', children: '<i class="fas fa-edit"></i>',
                            onClick: () => openModalForEdit(log)
                        }),
                        Button({
                            variant: 'danger', size: 'sm', children: '<i class="fas fa-trash"></i>',
                            onClick: () => {
                                if (confirm('Are you sure you want to delete this log?')) {
                                    onDeleteWorkLog(log.id);
                                }
                            }
                        })
                    );
                }
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);
        } else {
            tableContainer.innerHTML = `<div class="no-data-placeholder">
                <i class="fas fa-clock icon"></i>
                <p class="primary-text">No Work Logs Found</p>
                <p class="secondary-text">Try adjusting the filters or add a new log entry.</p>
            </div>`;
        }
        tableAndPaginationContainer.appendChild(tableContainer);
        
        // Pagination
        if (totalLogs > rowsPerPage) {
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination-controls';

            const rowsSelector = document.createElement('div');
            rowsSelector.className = 'pagination-rows-selector';
            rowsSelector.innerHTML = `<label for="rowsPerPage" class="form-label">Rows:</label>`;
            const select = document.createElement('select');
            select.id = 'rowsPerPage';
            select.className = 'form-select';
            [10, 25, 50].forEach(num => {
                select.innerHTML += `<option value="${num}" ${rowsPerPage === num ? 'selected' : ''}>${num}</option>`;
            });
            select.onchange = (e) => {
                rowsPerPage = Number(e.target.value);
                currentPage = 1;
                rerenderContent();
            };
            rowsSelector.appendChild(select);
            
            const navContainer = document.createElement('div');
            navContainer.className = 'pagination-nav';
            navContainer.innerHTML = `<span>${startIndex + 1}-${Math.min(endIndex, totalLogs)} of ${totalLogs}</span>`;
            const prevButton = Button({ children: 'Prev', variant: 'secondary', size: 'sm', disabled: currentPage === 1, onClick: () => { currentPage--; rerenderContent(); }});
            const nextButton = Button({ children: 'Next', variant: 'secondary', size: 'sm', disabled: currentPage >= totalPages, onClick: () => { currentPage++; rerenderContent(); }});
            navContainer.append(prevButton, nextButton);
            
            paginationContainer.append(rowsSelector, navContainer);
            tableAndPaginationContainer.appendChild(paginationContainer);
        }

        mainContentContainer.appendChild(tableAndPaginationContainer);
    }
    
    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    function openModalForNew(filteredTasks) {
        const form = WorkLogForm({
            log: null, ...props, workLogTasks: filteredTasks,
            onSaveAll: (logsData) => { onAddMultipleWorkLogs(logsData); closeModal(); },
            onCancel: closeModal,
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Add Work Log', children: form, size: 'xl' });
    }

    function openModalForEdit(log) {
        const filteredTasks = getMemberFilteredTasks(log.memberId);

        const form = WorkLogForm({
            log, ...props, workLogTasks: filteredTasks,
            onSave: (logData) => { onUpdateWorkLog({ ...logData, id: log.id, updatedAt: new Date().toISOString() }); closeModal(); },
            onCancel: closeModal
        });
        currentModalInstance = Modal({ isOpen: true, onClose: closeModal, title: 'Edit Work Log', children: form, size: 'xl' });
    }
    
    rerenderContent();
    container.appendChild(pageWrapper);
}
