import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { WorkLogForm } from '../components/WorkLogForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { TeamMemberRole } from '../types.js';
import { WorkDistributionChart } from '../components/WorkDistributionChart.js';
import { CATEGORY_COLORS } from '../constants.js';
import { formatDateToIndian } from '../utils.js';

let currentModalInstance = null;

function formatMinutes(minutes) {
    const totalMinutes = Math.round(minutes);
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
}

function createInsightList(title, items) {
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
    const maxValue = items.length > 0 ? items[0].value : 0; // Items are pre-sorted

    items.slice(0, 5).forEach(item => { // Show top 5
        const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const li = document.createElement('li');
        li.className = 'insight-list-item';
        li.innerHTML = `
            <div class="insight-item-label" title="${item.label}">${item.label}</div>
            <div class="insight-item-bar-container">
                <div class="insight-item-bar" style="width: ${percentage}%; background-color: ${item.color || 'var(--color-primary)'};"></div>
            </div>
            <div class="insight-item-value">${formatMinutes(item.value)}</div>
        `;
        list.appendChild(li);
    });

    container.appendChild(list);
    return container;
}


export function renderWorkLogPage(container, props) {
    const { workLogs, teamMembers, projects, currentUser, onAddMultipleWorkLogs, onUpdateWorkLog, onDeleteWorkLog, onBulkDeleteWorkLogs, onExport, onImport, workLogTasks } = props;

    const isManager = currentUser.role === TeamMemberRole.Manager;
    let currentPage = 1;
    let rowsPerPage = 10;
    let selectedCategory = null;
    let selectedTask = null;

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
            Button({ 
                children: 'Export CSV', 
                variant: 'secondary', 
                size: 'sm', 
                leftIcon: '<i class="fas fa-file-export"></i>', 
                onClick: () => {
                    const filteredLogs = getFilteredLogs();
                    onExport('worklogs', filteredLogs);
                } 
            }),
            FileUploadButton({
                children: 'Import CSV', 
                variant: 'secondary', 
                size: 'sm', 
                leftIcon: '<i class="fas fa-file-import"></i>', 
                accept: '.csv',
                onFileSelect: (file) => { if (file) onImport(file, 'worklogs'); }
            }),
            Button({
                children: 'Bulk Delete',
                variant: 'danger',
                size: 'sm',
                leftIcon: '<i class="fas fa-trash-alt"></i>',
                onClick: openBulkDeleteModal
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

    // --- Analysis & Table Section ---
    const contentSection = document.createElement('div');
    contentSection.className = 'attendance-page-section'; // Reuse styles
    
    // Filters
    const filtersDiv = document.createElement('div');
    filtersDiv.className = "worklog-filters-container";
    const filterGrid = document.createElement('div');
    filterGrid.className = "worklog-filters-grid";
    
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

    // Analysis section
    const analysisContainer = document.createElement('div');
    contentSection.appendChild(analysisContainer);

    // Table Section Wrapper
    const tableSectionWrapper = document.createElement('div');
    tableSectionWrapper.className = 'work-log-table-section';
    contentSection.appendChild(tableSectionWrapper);

    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container';
    tableSectionWrapper.appendChild(tableContainer);

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    tableSectionWrapper.appendChild(paginationContainer);

    pageWrapper.appendChild(contentSection);

    function getFilteredLogs() {
        const taskMap = new Map((workLogTasks || []).map(task => [task.name, task]));
    
        return workLogs.filter(log => {
            const isMemberMatch = !filterState.memberId || log.memberId === filterState.memberId;
            const isProjectMatch = !filterState.projectId || log.projectId === filterState.projectId;
            const isDateMatch = log.date >= filterState.startDate && log.date <= filterState.endDate;
    
            let isCategoryOrTaskMatch = true;
            if (selectedTask) {
                isCategoryOrTaskMatch = log.taskName === selectedTask;
            } else if (selectedCategory) {
                const taskCategory = taskMap.get(log.taskName)?.category || 'Uncategorized';
                isCategoryOrTaskMatch = taskCategory === selectedCategory;
            }
    
            return isMemberMatch && isProjectMatch && isDateMatch && isCategoryOrTaskMatch;
        }).sort((a,b) => new Date(b.date) - new Date(a.date));
    }
    
    function updateSummaries(logsToSummarize, todaysTotalMinutes) {
        const totalMinutes = logsToSummarize.reduce((acc, log) => acc + (Number(log.timeSpentMinutes) || 0), 0);
        const personDays = new Set(logsToSummarize.map(log => `${log.memberId}|${log.date}`)).size;
        
        const start = new Date(filterState.startDate + 'T00:00:00');
        const end = new Date(filterState.endDate + 'T00:00:00');
        const timeDiff = end.getTime() - start.getTime();
        const dayDiff = timeDiff >= 0 ? Math.round(timeDiff / (1000 * 3600 * 24)) + 1 : 0;
        const dayDiffText = dayDiff > 0 ? `(${dayDiff} day${dayDiff !== 1 ? 's' : ''})` : '';
        
        rangeTotalCard.innerHTML = `
            <div class="label" style="display: flex; justify-content: space-between; align-items: baseline;">
                <span>Selected Range Total</span>
                <span style="font-weight: 400; font-size: 0.8rem;">Today: ${formatMinutes(todaysTotalMinutes)}</span>
            </div>
            <div class="value">${formatMinutes(totalMinutes)}</div>
            <div class="sub-label">${formatDateToIndian(start)} - ${formatDateToIndian(end)} ${dayDiffText}</div>`;
        
        const avgMinutesPerPersonDay = personDays > 0 ? (totalMinutes / personDays) : 0;
        avgHoursCard.innerHTML = `
            <div class="label">Average Hours / Day</div>
            <div class="value">${formatMinutes(avgMinutesPerPersonDay)}</div>
            <div class="sub-label">Avg. per person per workday</div>`;

        const expectedMinutes = personDays * 8 * 60;
        const efficiency = expectedMinutes > 0 ? Math.round((totalMinutes / expectedMinutes) * 100) : 0;
        efficiencyCard.innerHTML = `
            <div class="label">Efficiency</div>
            <div class="efficiency-dial" style="--progress: ${efficiency}%;">
                <div class="dial-center"><span class="value">${efficiency}%</span></div>
            </div>
            <div class="sub-label">Against 8h/day goal</div>`;
    }

    function renderAnalysisSection(filteredLogs) {
        analysisContainer.innerHTML = '';
        if (filteredLogs.length === 0 && !selectedCategory) return;

        const analysisDashboard = document.createElement('div');
        analysisDashboard.className = 'analysis-dashboard-grid';

        // --- Left Column: Chart ---
        const leftCol = document.createElement('div');
        leftCol.className = 'analysis-dashboard-left  kpi-insights-panel';
        const taskMap = new Map(props.workLogTasks.map(task => [task.name, task]));
        
        let chartProps = {};

        if (selectedCategory) {
            const tasksInCategory = filteredLogs
                .filter(log => taskMap.get(log.taskName)?.category === selectedCategory)
                .reduce((acc, log) => {
                    acc[log.taskName] = (acc[log.taskName] || 0) + (Number(log.timeSpentMinutes) || 0);
                    return acc;
                }, {});

            chartProps = {
                title: 'Hours by Task',
                drilldownTitle: `Category: ${selectedCategory}`,
                selectedItem: selectedTask,
                onBackClick: () => {
                    if (selectedTask) { selectedTask = null; } 
                    else { selectedCategory = null; }
                    rerenderPage();
                },
                onBarClick: (taskName) => {
                    selectedTask = selectedTask === taskName ? null : taskName;
                    rerenderPage();
                },
                data: Object.entries(tasksInCategory).map(([taskName, minutes]) => ({
                    label: taskName,
                    value: minutes,
                    color: CATEGORY_COLORS[selectedCategory] || CATEGORY_COLORS['Uncategorized'],
                })).sort((a, b) => b.value - a.value),
            };
        } else {
            const timeByCategory = filteredLogs.reduce((acc, log) => {
                const category = taskMap.get(log.taskName)?.category || 'Uncategorized';
                acc[category] = (acc[category] || 0) + (Number(log.timeSpentMinutes) || 0);
                return acc;
            }, {});

            chartProps = {
                title: 'Hours by Category',
                onBarClick: (category) => {
                    selectedCategory = category;
                    selectedTask = null;
                    rerenderPage();
                },
                data: Object.entries(timeByCategory).map(([category, minutes]) => ({
                    label: category,
                    value: minutes,
                    color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Uncategorized'],
                })).sort((a, b) => b.value - a.value),
            };
        }
        leftCol.appendChild(WorkDistributionChart(chartProps));
        analysisDashboard.appendChild(leftCol);

        // --- Right Column: KPIs & Insights ---
        const rightCol = document.createElement('div');
        rightCol.className = 'analysis-dashboard-right kpi-insights-panel';
        rightCol.innerHTML = `<h3 class="kpi-panel-title"><i class="fas fa-chart-line"></i> KPIs & Insights</h3>`;

        let logsForInsights = filteredLogs;
        if (selectedTask) {
            logsForInsights = filteredLogs.filter(log => log.taskName === selectedTask);
        } else if (selectedCategory) {
            logsForInsights = filteredLogs.filter(log => (taskMap.get(log.taskName)?.category || 'Uncategorized') === selectedCategory);
        }

        const timeByMember = logsForInsights.reduce((acc, log) => {
            acc[log.memberId] = (acc[log.memberId] || 0) + (Number(log.timeSpentMinutes) || 0);
            return acc;
        }, {});
        const topContributors = Object.entries(timeByMember)
            .map(([memberId, minutes]) => ({ label: teamMembers.find(m => m.id === memberId)?.name || 'Unknown', value: minutes }))
            .sort((a, b) => b.value - a.value);
        rightCol.appendChild(createInsightList('Top Contributors', topContributors));

        const timeByProject = logsForInsights.reduce((acc, log) => {
            acc[log.projectId] = (acc[log.projectId] || 0) + (Number(log.timeSpentMinutes) || 0);
            return acc;
        }, {});
        const projectFocus = Object.entries(timeByProject)
            .map(([projectId, minutes]) => ({ label: projects.find(p => p.id === projectId)?.name || 'Unknown', value: minutes, color: '#8b5cf6' }))
            .sort((a, b) => b.value - a.value);
        rightCol.appendChild(createInsightList('Project Focus', projectFocus));

        analysisDashboard.appendChild(rightCol);
        analysisContainer.appendChild(analysisDashboard);
    }

    function rerenderTableAndPagination(allFilteredLogs) {
        const totalRows = allFilteredLogs.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        
        const startIndex = (currentPage - 1) * rowsPerPage;
        const logsForPage = allFilteredLogs.slice(startIndex, startIndex + rowsPerPage);

        // Clear and add the filter indicator
        const existingIndicator = tableSectionWrapper.querySelector('.chart-filter-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (selectedCategory) {
            const indicator = document.createElement('div');
            indicator.className = 'chart-filter-indicator';
            
            const filterText = selectedTask 
                ? `Task: "${selectedTask}"` 
                : `Category: "${selectedCategory}"`;

            const clearButton = Button({
                children: 'Clear Filter',
                variant: 'ghost',
                size: 'sm',
                onClick: () => {
                    if (selectedTask) { selectedTask = null; } 
                    else { selectedCategory = null; }
                    rerenderPage();
                }
            });
            
            indicator.innerHTML = `<span>Filtering by: <strong>${filterText}</strong></span>`;
            indicator.appendChild(clearButton);
            
            tableSectionWrapper.insertBefore(indicator, tableContainer);
        }


        tableContainer.innerHTML = '';
        if (logsForPage.length === 0) {
            tableContainer.innerHTML = `<div class="no-data-placeholder"><i class="fas fa-folder-open icon"></i><p class="primary-text">No work logs found.</p><p class="secondary-text">Try adjusting filters.</p></div>`;
        } else {
            const table = document.createElement('table');
            table.className = 'data-table work-log-table';
            table.innerHTML = `<thead><tr><th>Date</th><th>Member</th><th>Project</th><th>Task</th><th>Comments</th><th>Time Spent</th><th class="action-cell">Actions</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            const getMemberName = (id) => teamMembers.find(m => m.id === id)?.name || 'N/A';
            const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'N/A';

            logsForPage.forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateToIndian(log.date)}</td>
                    <td>${getMemberName(log.memberId)}</td>
                    <td>${getProjectName(log.projectId)}</td>
                    <td class="truncate" title="${log.taskName}">${log.taskName}</td>
                    <td class="truncate" title="${log.comments || ''}">${log.comments || '-'}</td>
                    <td>${formatMinutes(log.timeSpentMinutes)}</td>`;

                const actionCell = document.createElement('td');
                actionCell.className = 'action-cell';
                if (isManager || currentUser.id === log.memberId) {
                    actionCell.append(
                        Button({ variant: 'ghost', size: 'sm', onClick: () => openModal(log), children: '<i class="fas fa-edit"></i>' }),
                        Button({ variant: 'danger', size: 'sm', onClick: () => { if (confirm('Delete this log entry?')) onDeleteWorkLog(log.id); }, children: '<i class="fas fa-trash"></i>' })
                    );
                }
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);
        }

        paginationContainer.innerHTML = '';
        if (totalRows > rowsPerPage) {
            const rowsSelectorContainer = document.createElement('div');
            rowsSelectorContainer.className = 'pagination-rows-selector';
            rowsSelectorContainer.innerHTML = `<label for="rowsPerPageSelect" class="form-label mb-0">Rows:</label>`;
            const rowsSelect = document.createElement('select');
            rowsSelect.id = 'rowsPerPageSelect';
            rowsSelect.className = 'form-select';
            rowsSelect.innerHTML = `<option value="10">10</option><option value="20">20</option><option value="50">50</option>`;
            rowsSelect.value = rowsPerPage;
            rowsSelect.onchange = (e) => { rowsPerPage = Number(e.target.value); currentPage = 1; rerenderPage(); };
            rowsSelectorContainer.appendChild(rowsSelect);

            const navContainer = document.createElement('div');
            navContainer.className = 'pagination-nav';
            const pageInfo = document.createElement('span');
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            const prevButton = Button({ children: 'Prev', variant: 'secondary', size: 'sm', disabled: currentPage === 1, onClick: () => { if(currentPage > 1) { currentPage--; rerenderPage(); } }});
            const nextButton = Button({ children: 'Next', variant: 'secondary', size: 'sm', disabled: currentPage >= totalPages, onClick: () => { if(currentPage < totalPages) { currentPage++; rerenderPage(); } }});
            navContainer.append(prevButton, pageInfo, nextButton);
            paginationContainer.append(rowsSelectorContainer, navContainer);
        }
    }
    
    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    function openModal(log = null) {
        const form = WorkLogForm({
            log,
            ...props,
            onSave: (logData) => {
                closeModal();
                onUpdateWorkLog(logData);
            },
            onSaveAll: (logsData) => {
                closeModal();
                onAddMultipleWorkLogs(logsData);
            },
            onCancel: closeModal
        });

        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: log ? 'Edit Work Log' : 'Add Work Log(s)',
            children: form,
            size: 'xl'
        });
    }

    function openBulkDeleteModal() {
        const logsToDelete = getFilteredLogs();
        const count = logsToDelete.length;

        if (count === 0) {
            alert("No work logs match the current filters to delete.");
            return;
        }

        const modalContent = document.createElement('div');
        modalContent.innerHTML = `
            <p>Are you sure you want to delete <strong>${count}</strong> work log entr${count > 1 ? 'ies' : 'y'} that match the current filters?</p>
            <p>This action cannot be undone.</p>
        `;

        const confirmButton = Button({
            children: `Delete ${count} entr${count > 1 ? 'ies' : 'y'}`,
            variant: 'danger',
            onClick: () => {
                const logIds = logsToDelete.map(log => log.id);
                onBulkDeleteWorkLogs(logIds);
                closeModal();
            }
        });

        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: 'Confirm Bulk Deletion',
            children: modalContent,
            footer: [Button({ children: 'Cancel', variant: 'secondary', onClick: closeModal }), confirmButton],
            size: 'md'
        });
    }

    function rerenderPage() {
        const filteredLogs = getFilteredLogs();
        const todaysDate = new Date().toISOString().split('T')[0];
        // For the summary card, we need to filter Today's logs based on the main filters, not the chart filter
        const baseFilteredLogs = workLogs.filter(log => {
            const isMemberMatch = !filterState.memberId || log.memberId === filterState.memberId;
            const isProjectMatch = !filterState.projectId || log.projectId === filterState.projectId;
            return isMemberMatch && isProjectMatch;
        });
        const todaysLogs = baseFilteredLogs.filter(log => log.date === todaysDate);
        const todaysTotalMinutes = todaysLogs.reduce((acc, log) => acc + (Number(log.timeSpentMinutes) || 0), 0);
        
        updateSummaries(filteredLogs, todaysTotalMinutes);
        renderAnalysisSection(filteredLogs);
        rerenderTableAndPagination(filteredLogs);
    }

    rerenderPage();
    container.appendChild(pageWrapper);
}
