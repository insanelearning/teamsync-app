
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { TeamMemberForm } from '../components/TeamMemberForm.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { AttendanceLogTable } from '../components/AttendanceLogTable.js';
import { AttendanceCard } from '../components/AttendanceCard.js';
import { TeamMemberRole, AttendanceStatus, EmployeeStatus } from '../types.js';

let currentTeamModalInstance = null;
let currentLogModalInstance = null;

// --- Helper Functions ---

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

function calculateTotalWorkDays(startDateStr, endDateStr, holidays) {
    const holidayDates = new Set((holidays || []).map(h => h.date));
    let workDays = 0;
    if (!startDateStr || !endDateStr) return 0;
    
    // Ensure dates are parsed in local timezone context by avoiding UTC conversion from new Date()
    const startParts = startDateStr.split('-').map(p => parseInt(p, 10));
    const endParts = endDateStr.split('-').map(p => parseInt(p, 10));
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

    if (start > end) return 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const dateStr = d.toISOString().split('T')[0];
        
        // Count day if it's a weekday (Mon-Fri) and not a company holiday
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
            workDays++;
        }
    }
    return workDays;
}


/**
 * Timezone-safe way to check if a date is a weekday and not a holiday.
 * @param {string} dateString - The date in 'YYYY-MM-DD' format.
 * @param {Array<Object>} holidays - An array of holiday objects.
 * @returns {boolean} - True if it's a workday.
 */
function isWorkDay(dateString, holidays) {
    // This function creates a date in the local timezone, avoiding UTC conversion issues.
    const dateParts = dateString.split('-').map(part => parseInt(part, 10));
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        return false;
    }
    if ((holidays || []).some(h => h.date === dateString)) {
        return false;
    }
    return true;
}


// --- Main Render Function ---

export function renderAttendancePage(container, props) {
    const {
        teamMembers,
        attendanceRecords,
        currentUser,
        leaveTypes,
        holidays,
        internalTeams,
        onUpsertAttendanceRecord,
        onDeleteAttendanceRecord,
        onAddTeamMember,
        onUpdateTeamMember,
        onDeleteTeamMember,
        onExport,
        onImport,
        onExportTeam,
        onImportTeam
    } = props;
    const isManager = currentUser.role === TeamMemberRole.Manager;
    
    // Page state
    let activeTab = 'daily_log';
    let selectedDate = new Date().toISOString().split('T')[0];
    let teamMemberFilters = { searchTerm: '', team: '' };
    let selectedLeaveTypeFilter = null;
    let selectedStatusFilter = null;
    let analysisMemberFilter = ''; // New state for analysis filter
    // Default to the last 30 days (29 days ago to today)
    let analysisDateRange = {
        start: new Date(new Date().setDate(new Date().getDate() - 29)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    };

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    function rerender() {
        const activeElementId = document.activeElement.id;
        const activeElementSelectionStart = document.activeElement.selectionStart;
        const activeElementSelectionEnd = document.activeElement.selectionEnd;

        container.innerHTML = '';
        buildPage();

        if (activeElementId) {
            const focusedElement = document.getElementById(activeElementId);
            if (focusedElement) {
                focusedElement.focus();
                if (typeof activeElementSelectionStart === 'number') {
                    focusedElement.selectionStart = activeElementSelectionStart;
                    focusedElement.selectionEnd = activeElementSelectionEnd;
                }
            }
        }
    }


    function buildPage() {
        pageWrapper.innerHTML = '';

        // --- Header ---
        const headerDiv = document.createElement('div');
        headerDiv.className = "page-header";
        headerDiv.innerHTML = `<h1 class="page-header-title">Attendance & Team</h1>`;
        const headerActions = document.createElement('div');
        headerActions.className = 'page-header-actions';
        if (isManager) {
            headerActions.append(
                Button({ children: 'View Full Log', size: 'sm', variant: 'secondary', leftIcon: '<i class="fas fa-history"></i>', onClick: openAttendanceLogModal }),
                Button({ children: 'Add Member', size: 'sm', leftIcon: '<i class="fas fa-user-plus"></i>', onClick: () => openTeamMemberModal() })
            );
        }
        headerDiv.appendChild(headerActions);
        pageWrapper.appendChild(headerDiv);

        // --- NEW: Tab Navigation ---
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        
        const createTabButton = (tabId, label, iconClass) => {
            const button = document.createElement('button');
            button.className = `tab-button ${activeTab === tabId ? 'active' : ''}`;
            button.innerHTML = `<i class="${iconClass}"></i> ${label}`;
            button.onclick = () => {
                if (activeTab !== tabId) {
                    activeTab = tabId;
                    rerender();
                }
            };
            return button;
        };

        tabsContainer.append(
            createTabButton('daily_log', 'Daily Log', 'fas fa-clipboard-list'),
            createTabButton('analysis', 'Analysis Dashboard', 'fas fa-chart-line'),
            createTabButton('team_management', 'Team Management', 'fas fa-users')
        );
        pageWrapper.appendChild(tabsContainer);

        // --- NEW: Tab Content ---
        const tabContentContainer = document.createElement('div');
        tabContentContainer.className = 'tab-content-container';

        switch (activeTab) {
            case 'daily_log':
                tabContentContainer.appendChild(renderDailyLog());
                break;
            case 'analysis':
                tabContentContainer.appendChild(renderAnalysisSection());
                break;
            case 'team_management':
                tabContentContainer.appendChild(renderTeamManagement());
                break;
        }
        
        pageWrapper.appendChild(tabContentContainer);
        container.appendChild(pageWrapper);
    }
    
    // --- Section Rendering Functions ---
    function renderDailyLog() {
        const dailyLogSection = document.createElement('div');
        dailyLogSection.className = 'daily-log-section';
        
        const header = document.createElement('div');
        header.className = 'daily-log-header';
        
        const title = document.createElement('h2');
        title.className = 'daily-log-title';
        title.innerHTML = `<i class="fas fa-clipboard-list"></i> Daily Log`;
        header.appendChild(title);
        
        const datePicker = document.createElement('input');
        datePicker.type = 'date';
        datePicker.className = 'form-input';
        datePicker.style.maxWidth = '180px';
        datePicker.value = selectedDate;
        datePicker.onchange = (e) => {
            selectedDate = e.target.value;
            rerender();
        };
        header.appendChild(datePicker);
        dailyLogSection.appendChild(header);

        const gridContainer = document.createElement('div');
        gridContainer.className = 'daily-log-grid-container';
        
        const activeMembers = teamMembers.filter(m => m.status === EmployeeStatus.Active);

        if (activeMembers.length > 0) {
            activeMembers.forEach(member => {
                const record = attendanceRecords.find(r => r.date === selectedDate && r.memberId === member.id);
                const card = AttendanceCard({ member, date: selectedDate, record, leaveTypes, holidays, onUpsertRecord: onUpsertAttendanceRecord });
                gridContainer.appendChild(card);
            });
        } else {
            gridContainer.innerHTML = `<div class="no-data-placeholder" style="padding: 1rem 0;"><i class="fas fa-users-slash icon"></i><p class="primary-text">No active team members found.</p></div>`;
        }
        
        dailyLogSection.appendChild(gridContainer);
        return dailyLogSection;
    }
    
    function renderTeamManagement() {
        const teamManagementSection = document.createElement('div');
        teamManagementSection.className = 'attendance-page-section';
        teamManagementSection.innerHTML = `<h2 class="attendance-section-title"><i class="fas fa-users"></i> Team Management</h2>`;
        
        const toolbar = document.createElement('div');
        toolbar.className = 'team-management-toolbar';
        
        const filters = document.createElement('div');
        filters.className = 'team-management-filters';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search by name...';
        searchInput.className = 'form-input';
        searchInput.id = 'team-search-input';
        searchInput.value = teamMemberFilters.searchTerm;
        searchInput.oninput = (e) => {
            teamMemberFilters.searchTerm = e.target.value;
            rerender();
        };
        filters.appendChild(searchInput);

        const teamSelect = document.createElement('select');
        teamSelect.className = 'form-select';
        teamSelect.innerHTML = `<option value="">All Teams</option>` + internalTeams.map(t => `<option value="${t}">${t}</option>`).join('');
        teamSelect.value = teamMemberFilters.team;
        teamSelect.onchange = (e) => {
            teamMemberFilters.team = e.target.value;
            rerender();
        };
        filters.appendChild(teamSelect);
        
        const actions = document.createElement('div');
        actions.className = 'team-management-actions';
        if (isManager) {
            actions.append(
                Button({ children: 'Export', variant: 'secondary', size: 'sm', onClick: onExportTeam }),
                FileUploadButton({ children: 'Import', variant: 'secondary', size: 'sm', accept: '.csv', onFileSelect: onImportTeam })
            );
        }
        
        toolbar.append(filters, actions);
        teamManagementSection.appendChild(toolbar);
        
        teamManagementSection.appendChild(renderTeamList());
        return teamManagementSection;
    }
    
    function renderTeamList() {
        const teamListContainer = document.createElement('div');
        teamListContainer.className = 'data-table-container';

        const filteredMembers = teamMembers.filter(m => {
            const matchesSearch = !teamMemberFilters.searchTerm || m.name.toLowerCase().includes(teamMemberFilters.searchTerm.toLowerCase());
            const matchesTeam = !teamMemberFilters.team || m.internalTeam === teamMemberFilters.team;
            return matchesSearch && matchesTeam;
        });

        if (filteredMembers.length === 0) {
            teamListContainer.innerHTML = `<div class="no-data-placeholder"><p class="primary-text">No members match your search.</p></div>`;
            return teamListContainer;
        }

        const table = document.createElement('table');
        table.className = 'data-table team-members-table';
        table.innerHTML = `<thead>
            <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Internal Team</th>
                <th>Role</th>
                <th>Status</th>
                <th class="action-cell">Actions</th>
            </tr>
        </thead>`;
        const tbody = document.createElement('tbody');
        filteredMembers.forEach(member => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${member.name}</td>
                <td>${member.designation || 'N/A'}</td>
                <td>${member.internalTeam || 'N/A'}</td>
                <td>${member.role}</td>
                <td><span class="team-status-badge status-${member.status.toLowerCase()}">${member.status}</span></td>
            `;
            const actionCell = document.createElement('td');
            actionCell.className = 'action-cell';
            const viewBtn = Button({ children: 'View', size: 'sm', variant: 'ghost', onClick: (e) => { e.stopPropagation(); openTeamMemberModal(member); } });
            actionCell.appendChild(viewBtn);
            tr.appendChild(actionCell);
            
            tr.onclick = () => openTeamMemberModal(member);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        teamListContainer.appendChild(table);
        return teamListContainer;
    }
    
    function renderAnalysisSection() {
        const analysisSection = document.createElement('div');
        analysisSection.className = 'attendance-page-section';

        const title = document.createElement('h2');
        title.className = 'attendance-section-title';
        title.innerHTML = `<i class="fas fa-chart-line"></i> Analysis Dashboard`;
        analysisSection.appendChild(title);

        const filteredRecords = getFilteredAnalysisRecords();
        
        analysisSection.appendChild(renderAnalysisKPIs(filteredRecords));

        // Date Filter Section
        const filterContainer = document.createElement('div');
        filterContainer.className = 'analysis-dashboard-filters';
        
        const createDateInput = (label, id, value, onChange) => {
            const container = document.createElement('div');
            container.innerHTML = `<label for="${id}" class="form-label">${label}</label>`;
            const input = document.createElement('input');
            input.type = 'date';
            input.id = id;
            input.className = 'form-input';
            input.value = value;
            input.onchange = (e) => onChange(e.target.value);
            container.appendChild(input);
            return container;
        };

        const createMemberSelect = () => {
            const container = document.createElement('div');
            container.innerHTML = `<label for="analysis-member-filter" class="form-label">Team Member</label>`;
            const select = document.createElement('select');
            select.id = 'analysis-member-filter';
            select.className = 'form-select';
            
            let options = '<option value="">All Members</option>';
            teamMembers
                .filter(m => m.status === EmployeeStatus.Active)
                .forEach(member => {
                    options += `<option value="${member.id}" ${analysisMemberFilter === member.id ? 'selected' : ''}>${member.name}</option>`;
                });
            
            select.innerHTML = options;
            select.onchange = (e) => {
                analysisMemberFilter = e.target.value;
                rerender();
            };
            container.appendChild(select);
            return container;
        };
        
        filterContainer.appendChild(createDateInput('Start Date', 'analysis-start-date', analysisDateRange.start, (val) => {
            analysisDateRange.start = val;
            rerender();
        }));
        
        filterContainer.appendChild(createDateInput('End Date', 'analysis-end-date', analysisDateRange.end, (val) => {
            analysisDateRange.end = val;
            rerender();
        }));

        if (isManager) {
            filterContainer.appendChild(createMemberSelect());
        }

        analysisSection.appendChild(filterContainer);

        const analysisGrid = document.createElement('div');
        analysisGrid.className = 'attendance-analysis-grid';
        analysisGrid.appendChild(renderWorkDayStatusWidget(filteredRecords));
        analysisGrid.appendChild(renderDaysNotMarkedWidget());
        analysisGrid.appendChild(renderLeaveBreakdownWidget(filteredRecords));
        analysisGrid.appendChild(renderMostLeavesWidget(filteredRecords));
        analysisGrid.appendChild(renderHighestPresenceWidget(filteredRecords));
        analysisGrid.appendChild(renderLeaveByWeekdayWidget(filteredRecords));
        
        analysisSection.appendChild(analysisGrid);
        return analysisSection;
    }

    function getFilteredAnalysisRecords() {
        if (!analysisDateRange.start || !analysisDateRange.end) return [];
        let records = attendanceRecords.filter(r => r.date >= analysisDateRange.start && r.date <= analysisDateRange.end);
        
        if (analysisMemberFilter) {
            records = records.filter(r => r.memberId === analysisMemberFilter);
        } else if (!isManager) {
            records = records.filter(r => r.memberId === currentUser.id);
        }

        return records;
    }
    
    function renderAnalysisKPIs(filteredRecords) {
        const container = document.createElement('div');
        container.className = 'attendance-kpi-container kpi-grid';

        const totalWorkDays = calculateTotalWorkDays(analysisDateRange.start, analysisDateRange.end, holidays);
        
        const workedDaysRecords = filteredRecords.filter(r => r.status === 'Present' || r.status === 'Work From Home');
        const workedDays = new Set(workedDaysRecords.map(r => r.date)).size;

        const leaveDaysRecords = filteredRecords.filter(r => r.status === 'Leave');
        const leaveDays = new Set(leaveDaysRecords.map(r => r.date)).size;
        
        const attendancePercentage = totalWorkDays > 0 ? ((workedDays / totalWorkDays) * 100).toFixed(0) : 0;

        const kpis = [
            { label: 'Total Working Days', value: totalWorkDays, icon: 'fas fa-calendar-alt' },
            { label: 'Days Worked', value: workedDays, icon: 'fas fa-briefcase' },
            { label: 'Days on Leave', value: leaveDays, icon: 'fas fa-umbrella-beach' },
            { label: 'Attendance', value: `${attendancePercentage}%`, icon: 'fas fa-chart-pie' }
        ];
        
        kpis.forEach(kpi => {
            const card = document.createElement('div');
            card.className = `stat-card`;
            card.innerHTML = `
              <div class="stat-card-icon"><i class="${kpi.icon}"></i></div>
              <div>
                <div class="stat-card-value">${kpi.value}</div>
                <div class="stat-card-label">${kpi.label}</div>
              </div>
            `;
            container.appendChild(card);
        });

        return container;
    }

    // --- Chart Rendering and Data Functions ---
    function renderDonutChart(data) {
        const container = document.createElement('div');
        container.className = 'donut-chart-vertical-container';

        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'donut-chart-svg-container clickable';
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 120 120');
        const radius = 50;
        const circumference = 2 * Math.PI * radius;

        let offset = 0;
        data.segments.forEach(seg => {
            if (seg.value === 0) return;
            const segmentPath = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            segmentPath.setAttribute('class', `segment ${selectedStatusFilter === seg.label ? 'selected' : ''}`);
            segmentPath.setAttribute('cx', '60');
            segmentPath.setAttribute('cy', '60');
            segmentPath.setAttribute('r', String(radius));
            segmentPath.setAttribute('fill', 'none');
            segmentPath.setAttribute('stroke', seg.color);
            segmentPath.setAttribute('stroke-width', '20');
            segmentPath.setAttribute('stroke-dasharray', `${(seg.value / data.total) * circumference} ${circumference}`);
            segmentPath.setAttribute('stroke-dashoffset', String(-offset));
            segmentPath.setAttribute('transform', 'rotate(-90 60 60)');
            segmentPath.onclick = () => {
                selectedStatusFilter = selectedStatusFilter === seg.label ? null : seg.label;
                rerender();
            };
            svg.appendChild(segmentPath);
            offset += (seg.value / data.total) * circumference;
        });

        const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerCircle.setAttribute('cx', '60');
        centerCircle.setAttribute('cy', '60');
        centerCircle.setAttribute('r', '40');
        centerCircle.setAttribute('fill', 'var(--donut-center-color)');
        svg.appendChild(centerCircle);

        const totalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        totalText.setAttribute('x', '60');
        totalText.setAttribute('y', '62');
        totalText.setAttribute('text-anchor', 'middle');
        totalText.setAttribute('class', 'donut-center-value');
        totalText.textContent = data.total;
        svg.appendChild(totalText);

        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', '60');
        labelText.setAttribute('y', '78');
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('class', 'donut-center-label');
        labelText.textContent = 'Total Man-Days';
        svg.appendChild(labelText);
        
        chartWrapper.appendChild(svg);
        container.appendChild(chartWrapper);

        const legend = document.createElement('div');
        legend.className = 'donut-chart-legend horizontal';
        data.segments.forEach(seg => {
            const item = document.createElement('div');
            item.className = `donut-legend-item clickable ${selectedStatusFilter === seg.label ? 'selected' : ''}`;
            item.innerHTML = `
                <span class="legend-color-box" style="background-color:${seg.color}"></span>
                <span class="legend-label">${seg.label}</span>
                <span class="legend-value">${seg.value} days</span>
            `;
            item.onclick = () => {
                selectedStatusFilter = selectedStatusFilter === seg.label ? null : seg.label;
                rerender();
            };
            legend.appendChild(item);
        });
        container.appendChild(legend);

        return container;
    }
    
    function renderBarChart({ data, onBarClick, selectedItem }) {
        const chart = document.createElement('div');
        chart.className = 'bar-chart';
        const maxValue = Math.max(...data.map(d => d.value), 0);

        if (maxValue > 0) {
            data.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = `bar-chart-item ${onBarClick ? 'clickable' : ''} ${selectedItem === item.label ? 'selected' : ''}`;
                if (onBarClick) itemEl.onclick = () => onBarClick(item.label);

                const label = document.createElement('div');
                label.className = 'bar-chart-label';
                label.textContent = item.label;

                const barWrapper = document.createElement('div');
                barWrapper.className = 'bar-chart-bar-wrapper';
                const barFill = document.createElement('div');
                barFill.className = 'bar-chart-bar';
                barFill.style.width = `${(item.value / maxValue) * 100}%`;
                barFill.style.backgroundColor = item.color;
                barWrapper.appendChild(barFill);

                const value = document.createElement('div');
                value.className = 'bar-chart-value';
                value.textContent = `${item.value} day(s)`;

                itemEl.append(label, barWrapper, value);
                chart.appendChild(itemEl);
            });
        } else {
            chart.innerHTML = `<p class="insight-list-empty">No data available for this period.</p>`;
        }
        
        return chart;
    }
    
    // --- Widget Rendering Functions ---
    function renderWorkDayStatusWidget(records) {
        const data = records.reduce((acc, r) => {
            if (acc.hasOwnProperty(r.status)) acc[r.status]++;
            return acc;
        }, { 'Present': 0, 'Work From Home': 0, 'Leave': 0 });

        const chartData = {
            total: data['Present'] + data['Work From Home'] + data['Leave'],
            segments: [
                { label: 'Present', value: data['Present'], color: '#22c55e' },
                { label: 'Work From Home', value: data['Work From Home'], color: '#3b82f6' },
                { label: 'Leave', value: data['Leave'], color: '#f97316' },
            ]
        };

        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.innerHTML = '<h3><i class="fas fa-chart-pie widget-icon"></i> Work Day Status</h3>';
        const content = document.createElement('div');
        content.className = 'widget-content';
        content.appendChild(renderDonutChart(chartData));
        widget.appendChild(content);
        return widget;
    }
    
    function renderDaysNotMarkedWidget() {
        let membersToConsider = teamMembers.filter(m => m.status === 'Active');
        if (analysisMemberFilter) {
            membersToConsider = membersToConsider.filter(m => m.id === analysisMemberFilter);
        } else if (!isManager) {
            membersToConsider = membersToConsider.filter(m => m.id === currentUser.id);
        }

        const startDate = new Date(analysisDateRange.start + 'T00:00:00');
        const endDate = new Date(analysisDateRange.end + 'T00:00:00');
        
        const daysNotMarked = [];
        const attendanceSet = new Set(attendanceRecords.map(r => `${r.date}|${r.memberId}`));

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            if (isWorkDay(dateStr, holidays)) {
                membersToConsider.forEach(member => {
                    if (!attendanceSet.has(`${dateStr}|${member.id}`)) {
                        daysNotMarked.push({ date: dateStr, name: member.name });
                    }
                });
            }
        }
        daysNotMarked.sort((a,b) => b.date.localeCompare(a.date));
        
        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.innerHTML = `<h3><i class="fas fa-exclamation-triangle widget-icon"></i> Days Not Marked (${daysNotMarked.length})</h3>`;
        const content = document.createElement('div');
        content.className = 'widget-content';
        const list = document.createElement('ul');
        list.className = 'days-not-marked-list';
        if (daysNotMarked.length === 0) {
            list.innerHTML = `<li class="insight-list-empty">All work days are marked.</li>`;
        } else {
            daysNotMarked.slice(0, 100).forEach(item => {
                list.innerHTML += `<li>${item.date} - ${item.name}</li>`;
            });
        }
        content.appendChild(list);
        widget.appendChild(content);
        return widget;
    }

    function renderLeaveBreakdownWidget(records) {
        const breakdown = records
            .filter(r => r.status === AttendanceStatus.Leave && r.leaveType)
            .reduce((acc, r) => {
                const type = r.leaveType || 'undefined';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});
        
        const data = Object.entries(breakdown)
            .map(([label, value]) => ({ label, value, color: '#ef4444' }))
            .sort((a, b) => b.value - a.value);

        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.innerHTML = '<h3><i class="fas fa-umbrella-beach widget-icon"></i> Leave Types Breakdown</h3>';
        const content = document.createElement('div');
        content.className = 'widget-content';
        content.appendChild(renderBarChart({
            data,
            onBarClick: (leaveType) => {
                selectedLeaveTypeFilter = selectedLeaveTypeFilter === leaveType ? null : leaveType;
                rerender();
            },
            selectedItem: selectedLeaveTypeFilter
        }));
        widget.appendChild(content);
        return widget;
    }

    function getFilteredRecordsForInsights(baseRecords) {
        let filtered = baseRecords;
        if (selectedStatusFilter) {
            filtered = filtered.filter(r => r.status === selectedStatusFilter);
        }
        if (selectedLeaveTypeFilter) {
            filtered = filtered.filter(r => r.leaveType === selectedLeaveTypeFilter);
        }
        return filtered;
    }
    
    function renderMostLeavesWidget(baseRecords) {
        const filteredRecords = getFilteredRecordsForInsights(baseRecords);
        const getMemberName = id => teamMembers.find(m => m.id === id)?.name || 'Unknown';
        
        const leaves = filteredRecords
            .filter(r => r.status === AttendanceStatus.Leave)
            .reduce((acc, r) => { acc[r.memberId] = (acc[r.memberId] || 0) + 1; return acc; }, {});
            
        const data = Object.entries(leaves)
            .map(([id, value]) => ({ label: getMemberName(id), value, color: '#6366f1' }))
            .sort((a,b) => b.value - a.value).slice(0, 5);
        
        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.innerHTML = '<h3><i class="fas fa-user-minus widget-icon"></i> Most Leaves Taken</h3>';
        const content = document.createElement('div');
        content.className = 'widget-content';
        content.appendChild(renderBarChart({ data }));
        widget.appendChild(content);
        return widget;
    }

    function renderHighestPresenceWidget(baseRecords) {
        const filteredRecords = getFilteredRecordsForInsights(baseRecords);
        const getMemberName = id => teamMembers.find(m => m.id === id)?.name || 'Unknown';
        
        const presence = filteredRecords
            .filter(r => r.status === AttendanceStatus.Present)
            .reduce((acc, r) => { acc[r.memberId] = (acc[r.memberId] || 0) + 1; return acc; }, {});
        
        const data = Object.entries(presence)
            .map(([id, value]) => ({ label: getMemberName(id), value, color: '#22c55e' }))
            .sort((a,b) => b.value - a.value).slice(0, 5);

        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.innerHTML = '<h3><i class="fas fa-user-check widget-icon"></i> Highest Presence</h3>';
        const content = document.createElement('div');
        content.className = 'widget-content';
        content.appendChild(renderBarChart({ data }));
        widget.appendChild(content);
        return widget;
    }

    function renderLeaveByWeekdayWidget(baseRecords) {
        const filteredRecords = getFilteredRecordsForInsights(baseRecords);
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const leaveByDay = filteredRecords
            .filter(r => r.status === AttendanceStatus.Leave)
            .reduce((acc, r) => {
                const day = new Date(r.date + 'T00:00:00').getDay();
                if (day > 0 && day < 6) { // Mon-Fri
                    const dayName = weekdays[day];
                    acc[dayName] = (acc[dayName] || 0) + 1;
                }
                return acc;
            }, {});
        
        const data = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => ({
            label: day,
            value: leaveByDay[day] || 0,
            color: '#a78bfa'
        }));

        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.innerHTML = '<h3><i class="fas fa-calendar-day widget-icon"></i> Leave by Weekday</h3>';
        const content = document.createElement('div');
        content.className = 'widget-content';
        content.appendChild(renderBarChart({ data }));
        widget.appendChild(content);
        return widget;
    }

    // --- Modal Functions ---
    function openTeamMemberModal(member = null) {
        let isEditing = false;
        let modalEl, modalBody, modalFooter;

        const renderContent = () => {
            modalBody.innerHTML = '';
            modalFooter.innerHTML = '';

            if (isEditing) {
                const form = TeamMemberForm({
                    member,
                    internalTeams,
                    onSave: (memberData) => {
                        member ? onUpdateTeamMember(memberData) : onAddTeamMember(memberData);
                        closeModal();
                    },
                    onCancel: () => {
                        if (member) { // If editing existing, go back to view
                            isEditing = false;
                            renderContent();
                        } else { // If adding new, just close
                            closeModal();
                        }
                    }
                });
                modalBody.appendChild(form);
                // Footer is handled by form
            } else { // View mode
                modalBody.appendChild(renderTeamMemberDetailView(member));
                const footerButtons = [];
                if (isManager) {
                    footerButtons.push(Button({ children: 'Delete', variant: 'danger', onClick: () => {
                        if (confirm(`Delete ${member.name}? This will remove all their associated data.`)) {
                            onDeleteTeamMember(member.id);
                            closeModal();
                        }
                    }}));
                    footerButtons.push(Button({ children: 'Edit', variant: 'primary', onClick: () => { isEditing = true; renderContent(); }}));
                }
                footerButtons.push(Button({ children: 'Close', variant: 'secondary', onClick: closeModal }));
                modalFooter.append(...footerButtons);
            }
        };

        isEditing = !member || false; // Start in edit mode if adding new member
        
        modalEl = Modal({
            isOpen: true,
            onClose: closeModal,
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

    function renderTeamMemberDetailView(member) {
        const detailView = document.createElement('div');
        detailView.className = 'member-detail-view';
        
        const detailGrid = document.createElement('div');
        detailGrid.className = 'detail-grid';
        
        const createDetailItem = (label, value) => `<div class="detail-item"><h4 class="detail-label">${label}</h4><p class="detail-value">${value || 'N/A'}</p></div>`;

        detailGrid.innerHTML = `
            ${createDetailItem('Email', member.email)}
            ${createDetailItem('Mobile Number', member.mobileNumber)}
            ${createDetailItem('Employee ID', member.employeeId)}
            ${createDetailItem('Designation', member.designation)}
            ${createDetailItem('Department', member.department)}
            ${createDetailItem('Company', member.company)}
            ${createDetailItem('Role', member.role)}
            ${createDetailItem('Internal Team', member.internalTeam)}
            ${createDetailItem('Join Date', member.joinDate ? new Date(member.joinDate + 'T00:00:00').toLocaleDateString() : 'N/A')}
            ${createDetailItem('Birth Date', member.birthDate ? new Date(member.birthDate + 'T00:00:00').toLocaleDateString() : 'N/A')}
        `;
        detailGrid.appendChild(createIdFieldWithCopy('Member ID', member.id));
        detailView.appendChild(detailGrid);
        return detailView;
    }
    
    function closeModal() {
        closeGlobalModal();
        currentTeamModalInstance = null;
        currentLogModalInstance = null;
    }

    function openAttendanceLogModal() {
        let logFilters = { memberId: '', startDate: '', endDate: '' };

        const modalBody = document.createElement('div');
        
        const filterRow = document.createElement('div');
        filterRow.className = 'log-viewer-filter-row';
        
        const memberSelect = document.createElement('select');
        memberSelect.className = 'form-select';
        memberSelect.innerHTML = `<option value="">All Members</option>` + teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        memberSelect.onchange = (e) => { logFilters.memberId = e.target.value; rerenderLogTable(); };
        filterRow.appendChild(memberSelect);
        
        const startDateInput = document.createElement('input');
        startDateInput.type = 'date';
        startDateInput.className = 'form-input';
        startDateInput.onchange = (e) => { logFilters.startDate = e.target.value; rerenderLogTable(); };
        filterRow.appendChild(startDateInput);
        
        const endDateInput = document.createElement('input');
        endDateInput.type = 'date';
        endDateInput.className = 'form-input';
        endDateInput.onchange = (e) => { logFilters.endDate = e.target.value; rerenderLogTable(); };
        filterRow.appendChild(endDateInput);
        
        modalBody.appendChild(filterRow);
        
        const tableContainer = document.createElement('div');
        modalBody.appendChild(tableContainer);
        
        const rerenderLogTable = () => {
            let logs = [...attendanceRecords].sort((a,b) => b.date.localeCompare(a.date));
            if (logFilters.memberId) logs = logs.filter(l => l.memberId === logFilters.memberId);
            if (logFilters.startDate) logs = logs.filter(l => l.date >= logFilters.startDate);
            if (logFilters.endDate) logs = logs.filter(l => l.date <= logFilters.endDate);
            
            tableContainer.innerHTML = '';
            tableContainer.appendChild(AttendanceLogTable({ logs, teamMembers, onDelete: onDeleteAttendanceRecord }));
        };
        
        currentLogModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: 'Full Attendance Log',
            children: modalBody,
            footer: [
                Button({ children: 'Export Log', variant: 'secondary', onClick: () => onExport('attendance') }),
                Button({ children: 'Close', variant: 'primary', onClick: closeModal })
            ],
            size: 'xl'
        });
        
        rerenderLogTable(); // Initial render
    }

    // --- Initial Render ---
    buildPage();
}
