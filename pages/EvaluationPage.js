// This file has been repurposed to implement the Reports Page.

import { Button } from '../components/Button.js';
import { exportToCSV } from '../services/csvService.js';

function formatMinutesToHours(minutes) {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function renderReportsPage(container, props) {
    const { teamMembers, projects, workLogs } = props;

    let memberFilter = '';
    let projectFilter = '';
    let startDateFilter = new Date(new Date().setDate(new Date().getDate() - 29)).toISOString().split('T')[0];
    let endDateFilter = new Date().toISOString().split('T')[0];
    let sortKey = 'date';
    let sortOrder = 'desc';

    function getFilteredLogs() {
        const startDate = new Date(startDateFilter);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateFilter);
        endDate.setHours(23, 59, 59, 999);

        return workLogs
            .filter(log => {
                const logDate = new Date(log.date);
                return logDate >= startDate && logDate <= endDate &&
                    (!memberFilter || log.memberId === memberFilter) &&
                    (!projectFilter || log.projectId === projectFilter);
            })
            .map(log => ({
                ...log,
                projectName: projects.find(p => p.id === log.projectId)?.name || 'Unknown Project',
                memberName: teamMembers.find(m => m.id === log.memberId)?.name || 'Unknown Member'
            }))
            .sort((a, b) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                let comparison = 0;
                if (typeof aVal === 'string') {
                    comparison = aVal.localeCompare(bVal);
                } else {
                    comparison = aVal - bVal;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }

    function render() {
        container.innerHTML = '';
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-container';

        // Header
        const headerDiv = document.createElement('div');
        headerDiv.className = "page-header";
        headerDiv.innerHTML = `<h1 class="page-header-title">Team Reports</h1>`;
        pageWrapper.appendChild(headerDiv);

        // Filters
        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'filters-container';
        const filterGrid = document.createElement('div');
        filterGrid.className = 'reports-filters';

        filterGrid.innerHTML = `
            <div>
                <label for="report-start-date" class="form-label">Start Date</label>
                <input type="date" id="report-start-date" class="form-input" value="${startDateFilter}">
            </div>
            <div>
                <label for="report-end-date" class="form-label">End Date</label>
                <input type="date" id="report-end-date" class="form-input" value="${endDateFilter}">
            </div>
            <div>
                <label for="report-member-filter" class="form-label">Team Member</label>
                <select id="report-member-filter" class="form-select">
                    <option value="">All Members</option>
                    ${teamMembers.map(m => `<option value="${m.id}" ${memberFilter === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                </select>
            </div>
            <div>
                <label for="report-project-filter" class="form-label">Project</label>
                <select id="report-project-filter" class="form-select">
                    <option value="">All Projects</option>
                    ${projects.map(p => `<option value="${p.id}" ${projectFilter === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
        `;
        filtersDiv.appendChild(filterGrid);
        pageWrapper.appendChild(filtersDiv);

        const filteredLogs = getFilteredLogs();

        // KPIs
        const kpiContainer = document.createElement('div');
        kpiContainer.className = 'reports-grid';
        
        const totalMinutes = filteredLogs.reduce((sum, log) => sum + log.timeMinutes, 0);
        const uniqueDays = new Set(filteredLogs.map(log => log.date)).size;
        const totalEfficiency = filteredLogs.reduce((acc, log) => {
            const dayLogs = filteredLogs.filter(l => l.date === log.date && l.memberId === log.memberId);
            const dailyTotal = dayLogs.reduce((sum, l) => sum + l.timeMinutes, 0);
            acc[log.date + log.memberId] = (dailyTotal / 480) * 100;
            return acc;
        }, {});
        const avgEfficiency = Object.values(totalEfficiency).length > 0
            ? (Object.values(totalEfficiency).reduce((sum, eff) => sum + eff, 0) / Object.values(totalEfficiency).length)
            : 0;

        kpiContainer.innerHTML = `
            <div class="report-kpi-card">
                <div class="label">Total Hours Logged</div>
                <div class="value">${formatMinutesToHours(totalMinutes)}</div>
            </div>
            <div class="report-kpi-card">
                <div class="label">Total Days Worked</div>
                <div class="value">${uniqueDays}</div>
            </div>
            <div class="report-kpi-card">
                <div class="label">Average Efficiency</div>
                <div class="value">${avgEfficiency.toFixed(0)}%</div>
            </div>
        `;
        pageWrapper.appendChild(kpiContainer);

        // Charts
        const chartsContainer = document.createElement('div');
        chartsContainer.className = 'chart-grid';
        chartsContainer.appendChild(renderHoursByProjectChart(filteredLogs));
        chartsContainer.appendChild(renderHoursByMemberChart(filteredLogs));
        pageWrapper.appendChild(chartsContainer);
        
        // Data Table
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container';
        pageWrapper.appendChild(tableContainer);
        renderDataTable(tableContainer, filteredLogs);


        // Event Listeners
        const updateFilters = () => {
            startDateFilter = pageWrapper.querySelector('#report-start-date').value;
            endDateFilter = pageWrapper.querySelector('#report-end-date').value;
            memberFilter = pageWrapper.querySelector('#report-member-filter').value;
            projectFilter = pageWrapper.querySelector('#report-project-filter').value;
            render();
        };

        pageWrapper.querySelector('#report-start-date').onchange = updateFilters;
        pageWrapper.querySelector('#report-end-date').onchange = updateFilters;
        pageWrapper.querySelector('#report-member-filter').onchange = updateFilters;
        pageWrapper.querySelector('#report-project-filter').onchange = updateFilters;

        container.appendChild(pageWrapper);
    }
    
    function renderHoursByProjectChart(logs) {
        const container = document.createElement('div');
        container.className = 'report-chart-container';
        container.innerHTML = `<h4>Hours by Project</h4>`;

        if (logs.length === 0) {
            container.innerHTML += `<div class="chart-placeholder">No data for this period</div>`;
            return container;
        }

        const dataByProject = logs.reduce((acc, log) => {
            acc[log.projectId] = (acc[log.projectId] || 0) + log.timeMinutes;
            return acc;
        }, {});
        
        const chartData = Object.entries(dataByProject).map(([projectId, minutes]) => ({
            label: projects.find(p => p.id === projectId)?.name || 'Unknown',
            value: Math.round(minutes / 60), // to hours
            color: '#4f46e5'
        })).sort((a,b) => b.value - a.value);

        const chartElement = createBarChart(chartData);
        container.appendChild(chartElement);
        return container;
    }

    function renderHoursByMemberChart(logs) {
        const container = document.createElement('div');
        container.className = 'report-chart-container';
        container.innerHTML = `<h4>Hours by Team Member</h4>`;

        if (logs.length === 0) {
            container.innerHTML += `<div class="chart-placeholder">No data for this period</div>`;
            return container;
        }
        
        const dataByMember = logs.reduce((acc, log) => {
            acc[log.memberId] = (acc[log.memberId] || 0) + log.timeMinutes;
            return acc;
        }, {});

        const chartData = Object.entries(dataByMember).map(([memberId, minutes]) => ({
            label: teamMembers.find(m => m.id === memberId)?.name || 'Unknown',
            value: Math.round(minutes / 60), // to hours
            color: '#6366f1'
        })).sort((a,b) => b.value - a.value);

        const chartElement = createBarChart(chartData);
        container.appendChild(chartElement);
        return container;
    }
    
    function createBarChart(data) {
        const chart = document.createElement('div');
        chart.className = 'bar-chart';
        
        const maxValue = Math.max(...data.map(d => d.value), 1);
        
        data.forEach(item => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'bar-chart-item';
            barWrapper.innerHTML = `
                <span class="bar-chart-label" title="${item.label}">${item.label}</span>
                <div class="bar-chart-bar-wrapper">
                    <div class="bar-chart-bar" style="width: ${(item.value / maxValue) * 100}%; background-color: ${item.color};"></div>
                </div>
                <span class="bar-chart-value">${item.value}h</span>
            `;
            chart.appendChild(barWrapper);
        });
        return chart;
    }

    function renderDataTable(tableContainer, logs) {
        tableContainer.innerHTML = '';
        const tableHeader = document.createElement('div');
        tableHeader.className = 'timesheet-log-actions';
        tableHeader.innerHTML = `<h3>Detailed Logs</h3>`;
        const exportButton = Button({
            children: 'Export CSV',
            variant: 'secondary',
            size: 'sm',
            leftIcon: '<i class="fas fa-file-export"></i>',
            onClick: () => {
                const dataToExport = logs.map(l => ({
                    Date: l.date,
                    Member: l.memberName,
                    Project: l.projectName,
                    Task: l.taskName,
                    'Time (Minutes)': l.timeMinutes,
                    'Requested By': l.requestedBy,
                    Comments: l.comments || ''
                }));
                exportToCSV(dataToExport, 'work_log_report.csv');
            },
            disabled: logs.length === 0
        });
        tableHeader.appendChild(exportButton);
        tableContainer.appendChild(tableHeader);

        if (logs.length === 0) {
            tableContainer.innerHTML += `<div class="no-data-placeholder"><p>No work logs match the current filters.</p></div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th data-sort="date">Date</th>
                <th data-sort="memberName">Member</th>
                <th data-sort="projectName">Project</th>
                <th data-sort="taskName">Task</th>
                <th data-sort="timeMinutes">Time</th>
                <th data-sort="requestedBy">Requested By</th>
            </tr>
        `;
        
        thead.querySelectorAll('th').forEach(th => {
            th.style.cursor = 'pointer';
            if (th.dataset.sort === sortKey) {
                th.innerHTML += sortOrder === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
            } else {
                th.innerHTML += ' <i class="fas fa-sort"></i>';
            }
            th.addEventListener('click', () => {
                const newSortKey = th.dataset.sort;
                if (sortKey === newSortKey) {
                    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    sortKey = newSortKey;
                    sortOrder = 'desc';
                }
                render();
            });
        });

        const tbody = document.createElement('tbody');
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.date + 'T00:00:00').toLocaleDateString()}</td>
                <td>${log.memberName}</td>
                <td>${log.projectName}</td>
                <td><p class="truncate" title="${log.taskName}">${log.taskName}</p></td>
                <td>${formatMinutesToHours(log.timeMinutes)}</td>
                <td>${log.requestedBy}</td>
            `;
            tbody.appendChild(tr);
        });
        
        table.append(thead, tbody);
        tableContainer.appendChild(table);
    }

    render();
}
