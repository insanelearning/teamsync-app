// This file has been repurposed to implement the Timesheet Page.

import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';

let currentModalInstance = null;
const DAILY_GOAL_MINUTES = 480; // 8 hours

function WorkLogForm({ log, userProjects, onSave, onCancel }) {
    const isEditing = !!log;
    let formData = log ? { ...log } : {
        projectId: '',
        taskName: '',
        timeMinutes: '',
        requestedBy: '',
        comments: ''
    };

    const form = document.createElement('form');
    form.className = 'project-form'; // Reuse styles

    function createField(labelText, inputType, name, value, options = {}) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = labelText;
        div.appendChild(label);

        let input;
        if (inputType === 'select') {
            input = document.createElement('select');
            input.className = 'form-select';
            input.innerHTML = options.options.map(opt => `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');
        } else if (inputType === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'form-input';
            input.rows = options.rows || 3;
            input.value = value;
        } else {
            input = document.createElement('input');
            input.type = inputType;
            input.className = 'form-input';
            input.value = value;
            if (inputType === 'number') input.min = 1;
        }
        input.name = name;
        input.required = true;

        input.addEventListener('input', (e) => {
            formData[name] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        });
        div.appendChild(input);
        return div;
    }

    form.appendChild(createField('Project', 'select', 'projectId', formData.projectId, {
        options: [
            { value: '', label: 'Select a project...' },
            ...userProjects.map(p => ({ value: p.id, label: p.name }))
        ]
    }));
    form.appendChild(createField('Task Name', 'text', 'taskName', formData.taskName));
    const timeRequestGrid = document.createElement('div');
    timeRequestGrid.className = 'form-grid-cols-2';
    timeRequestGrid.appendChild(createField('Time Spent (minutes)', 'number', 'timeMinutes', formData.timeMinutes));
    timeRequestGrid.appendChild(createField('Requested By', 'text', 'requestedBy', formData.requestedBy));
    form.appendChild(timeRequestGrid);
    form.appendChild(createField('Comments (optional)', 'textarea', 'comments', formData.comments || '', {rows: 4}));

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'project-form-actions';
    const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
    const saveButton = Button({ children: isEditing ? 'Save Changes' : 'Log Time', variant: 'primary', type: 'submit' });
    actionsDiv.append(cancelButton, saveButton);
    form.appendChild(actionsDiv);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!formData.projectId || !formData.taskName || !formData.timeMinutes || !formData.requestedBy) {
            alert('Please fill out all required fields.');
            return;
        }
        onSave(formData);
    });

    return form;
}


export function renderTimesheetPage(container, props) {
    const { currentUser, projects, workLogs, onAddWorkLog, onUpdateWorkLog, onDeleteWorkLog } = props;
    let selectedDate = new Date().toISOString().split('T')[0];

    function openModal(log = null) {
        const userProjects = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(currentUser.id));
        
        const onSave = (formData) => {
            const dataToSave = {
                ...formData,
                id: log?.id || crypto.randomUUID(),
                memberId: currentUser.id,
                date: selectedDate,
                createdAt: log?.createdAt || new Date().toISOString(),
            };
            if (log) {
                onUpdateWorkLog(dataToSave);
            } else {
                onAddWorkLog(dataToSave);
            }
            closeModal();
        };

        const formElement = WorkLogForm({ log, userProjects, onSave, onCancel: closeModal });
        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: log ? 'Edit Work Log' : 'Log New Time Entry',
            children: formElement,
            size: 'lg'
        });
    }

    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    function render() {
        container.innerHTML = '';
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-container';

        // Header and Date Picker
        const headerDiv = document.createElement('div');
        headerDiv.className = 'timesheet-header';
        headerDiv.innerHTML = `<h1 class="page-header-title">My Timesheet</h1>`;

        const datePickerDiv = document.createElement('div');
        datePickerDiv.className = 'timesheet-date-picker';
        datePickerDiv.innerHTML = `<label for="timesheet-date" class="form-label mb-0">Date:</label>`;
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'timesheet-date';
        dateInput.className = 'form-input';
        dateInput.value = selectedDate;
        dateInput.addEventListener('change', (e) => {
            selectedDate = e.target.value;
            render();
        });
        datePickerDiv.appendChild(dateInput);
        headerDiv.appendChild(datePickerDiv);
        pageWrapper.appendChild(headerDiv);
        
        const logsForDay = workLogs.filter(wl => wl.memberId === currentUser.id && wl.date === selectedDate);
        const totalMinutesToday = logsForDay.reduce((sum, log) => sum + log.timeMinutes, 0);

        // Daily Summary Bar
        pageWrapper.appendChild(renderDailySummaryBar(totalMinutesToday));

        // Log Actions & Table
        const logSection = document.createElement('div');
        logSection.className = 'data-table-container';

        const logHeader = document.createElement('div');
        logHeader.className = 'timesheet-log-actions';
        logHeader.innerHTML = '<h3>Today\'s Entries</h3>';
        logHeader.appendChild(Button({
            children: 'Log Time',
            leftIcon: '<i class="fas fa-plus"></i>',
            onClick: () => openModal(null)
        }));
        logSection.appendChild(logHeader);

        if (logsForDay.length > 0) {
            const table = document.createElement('table');
            table.className = 'data-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Task</th>
                        <th>Time Spent</th>
                        <th>Requested By</th>
                        <th class="action-cell">Actions</th>
                    </tr>
                </thead>
            `;
            const tbody = document.createElement('tbody');
            logsForDay.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(log => {
                const tr = document.createElement('tr');
                const projectName = projects.find(p => p.id === log.projectId)?.name || 'Unknown Project';
                const timeFormatted = `${Math.floor(log.timeMinutes / 60)}h ${log.timeMinutes % 60}m`;
                
                tr.innerHTML = `
                    <td>${projectName}</td>
                    <td><p class="truncate" title="${log.taskName}">${log.taskName}</p></td>
                    <td>${timeFormatted}</td>
                    <td>${log.requestedBy}</td>
                `;
                const actionCell = document.createElement('td');
                actionCell.className = 'action-cell';
                actionCell.appendChild(Button({
                    children: '<i class="fas fa-edit"></i>',
                    variant: 'ghost',
                    size: 'sm',
                    onClick: () => openModal(log)
                }));
                actionCell.appendChild(Button({
                    children: '<i class="fas fa-trash"></i>',
                    variant: 'danger',
                    size: 'sm',
                    onClick: () => {
                        if (confirm('Are you sure you want to delete this log entry?')) {
                            onDeleteWorkLog(log.id);
                        }
                    }
                }));
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            logSection.appendChild(table);
        } else {
            logSection.innerHTML += `<div class="no-data-placeholder"><p>No time logged for this date. Click "Log Time" to start.</p></div>`;
        }
        pageWrapper.appendChild(logSection);

        container.appendChild(pageWrapper);
    }
    
    function renderDailySummaryBar(totalMinutes) {
        const summaryBar = document.createElement('div');
        summaryBar.className = 'daily-summary-bar';

        const efficiency = (totalMinutes / DAILY_GOAL_MINUTES) * 100;
        const remainingMinutes = Math.max(0, DAILY_GOAL_MINUTES - totalMinutes);

        const trackerDiv = document.createElement('div');
        trackerDiv.className = 'efficiency-tracker';
        trackerDiv.innerHTML = `
            <div class="efficiency-tracker-labels">
                <h4>Daily Progress</h4>
                <span class="time-details">Goal: ${DAILY_GOAL_MINUTES / 60} hours</span>
            </div>
            <div class="efficiency-bar">
                <div class="efficiency-bar-fill ${efficiency < 80 ? 'low' : (efficiency > 100 ? 'over' : '')}" style="width: ${Math.min(efficiency, 100)}%;"></div>
            </div>
        `;

        const statsDiv = document.createElement('div');
        statsDiv.className = 'daily-summary-stats';
        statsDiv.innerHTML = `
            <div class="daily-summary-stat">
                <div class="value">${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m</div>
                <div class="label">Total Logged</div>
            </div>
            <div class="daily-summary-stat">
                <div class="value">${efficiency.toFixed(0)}%</div>
                <div class="label">Efficiency</div>
            </div>
             <div class="daily-summary-stat">
                <div class="value">${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m</div>
                <div class="label">Remaining</div>
            </div>
        `;
        
        summaryBar.append(trackerDiv, statsDiv);
        return summaryBar;
    }

    render();
}
