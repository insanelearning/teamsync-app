
import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

export function WorkLogForm({ log, currentUser, teamMembers, projects, workLogTasks = [], onSave, onSaveAll, onCancel }) {
    // Mode determination: 'edit' for a single log, 'add' for multiple new logs.
    const isEditMode = !!log;
    
    let commonData = {
        date: isEditMode ? log.date : new Date().toISOString().split('T')[0],
        memberId: isEditMode ? log.memberId : currentUser.id,
    };
    
    let formEntries;
    if (isEditMode) {
        // In edit mode, there's only one entry to work with.
        formEntries = [{ ...log, _id: crypto.randomUUID() }];
    } else {
        // In add mode, pre-populate with active projects for the selected member.
        const activeProjectsForMember = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(commonData.memberId));
        if (activeProjectsForMember.length > 0) {
            formEntries = activeProjectsForMember.map(p => ({
                _id: crypto.randomUUID(),
                projectId: p.id,
                taskName: workLogTasks[0] || '',
                timeSpentMinutes: '', // Use empty string to prompt user input
                requestedFrom: '',
                comments: ''
            }));
        } else {
             // If no active projects, provide one blank row to start.
             formEntries = [{ _id: crypto.randomUUID(), projectId: '', taskName: workLogTasks[0] || '', timeSpentMinutes: 0, requestedFrom: '', comments: '' }];
        }
    }

    const form = document.createElement('form');
    form.className = 'project-form'; // Reuse styles

    // --- Rerender function ---
    function rerender() {
        form.innerHTML = '';
        buildForm();
    }

    // --- Handlers ---
    const handleCommonDataChange = (e) => {
        commonData[e.target.name] = e.target.value;
        // If the member changes, we need to rerender to update the project list.
        if(e.target.name === 'memberId') {
            rerender();
        }
    };
    
    const handleEntryChange = (entryId, field, value) => {
        const entryIndex = formEntries.findIndex(e => e._id === entryId);
        if (entryIndex > -1) {
            formEntries[entryIndex][field] = (field === 'timeSpentMinutes') ? Number(value) : value;
        }
    };
    
    const addEntryRow = () => {
        formEntries.push({ _id: crypto.randomUUID(), projectId: '', taskName: workLogTasks[0], timeSpentMinutes: 0, requestedFrom: '', comments: '' });
        rerender();
    };

    const removeEntryRow = (entryId) => {
        formEntries = formEntries.filter(e => e._id !== entryId);
        rerender();
    };
    
    // --- UI Builder ---
    function buildForm() {
        // --- Top common fields for both modes ---
        const topFieldsContainer = document.createElement('div');
        topFieldsContainer.className = 'worklog-form-top-fields';
        
        // Member Selector (visible for managers, or in edit mode)
        if (currentUser.role === TeamMemberRole.Manager || isEditMode) {
            const memberSelect = document.createElement('select');
            memberSelect.className = 'form-select';
            memberSelect.name = 'memberId';
            memberSelect.innerHTML = teamMembers.map(m => `<option value="${m.id}" ${commonData.memberId === m.id ? 'selected': ''}>${m.name}</option>`).join('');
            memberSelect.onchange = handleCommonDataChange;
            // In add mode, manager can change member. In edit mode, it's locked.
            memberSelect.disabled = isEditMode;

            const memberDiv = document.createElement('div');
            memberDiv.innerHTML = `<label class="form-label">Team Member</label>`;
            memberDiv.appendChild(memberSelect);
            topFieldsContainer.appendChild(memberDiv);
        }

        // Date Picker
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'form-input';
        dateInput.name = 'date';
        dateInput.value = commonData.date;
        dateInput.onchange = handleCommonDataChange;
        
        const dateDiv = document.createElement('div');
        dateDiv.innerHTML = `<label class="form-label">Date</label>`;
        dateDiv.appendChild(dateInput);
        topFieldsContainer.appendChild(dateDiv);
        
        form.appendChild(topFieldsContainer);

        // --- Entry Table ---
        const sectionHeader = document.createElement('h4');
        sectionHeader.className = 'worklog-form-section-header';
        sectionHeader.textContent = 'Log Entries';
        form.appendChild(sectionHeader);
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container';
        
        const table = document.createElement('table');
        table.className = 'worklog-form-entry-table';
        table.innerHTML = `<thead>
            <tr>
                <th class="project-cell">Project</th>
                <th class="task-cell">Task</th>
                <th class="time-cell">Time (min)</th>
                <th class="comments-cell">Comments</th>
                <th class="action-cell"></th>
            </tr>
        </thead>`;
        
        const tbody = document.createElement('tbody');
        
        // Filter projects based on selected member
        const projectsForMember = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(commonData.memberId));

        formEntries.forEach(entry => {
            const tr = document.createElement('tr');
            
            // Project
            const projectCell = document.createElement('td');
            const projectSelect = document.createElement('select');
            projectSelect.className = 'form-select';
            projectSelect.required = true;
            projectSelect.innerHTML = `<option value="">Select...</option>` + projectsForMember.map(p => `<option value="${p.id}" ${entry.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
            projectSelect.onchange = (e) => handleEntryChange(entry._id, 'projectId', e.target.value);
            projectCell.appendChild(projectSelect);
            tr.appendChild(projectCell);

            // Task
            const taskCell = document.createElement('td');
            const taskSelect = document.createElement('select');
            taskSelect.className = 'form-select';
            taskSelect.innerHTML = workLogTasks.map(t => `<option value="${t}" ${entry.taskName === t ? 'selected' : ''}>${t}</option>`).join('');
            taskSelect.onchange = (e) => handleEntryChange(entry._id, 'taskName', e.target.value);
            taskCell.appendChild(taskSelect);
            tr.appendChild(taskCell);
            
            // Time
            const timeCell = document.createElement('td');
            const timeInput = document.createElement('input');
            timeInput.type = 'number';
            timeInput.className = 'form-input';
            timeInput.value = entry.timeSpentMinutes;
            timeInput.min = 0;
            timeInput.required = true;
            timeInput.placeholder = 'e.g., 60';
            timeInput.oninput = (e) => handleEntryChange(entry._id, 'timeSpentMinutes', e.target.value);
            timeCell.appendChild(timeInput);
            tr.appendChild(timeCell);
            
            // Comments
            const commentsCell = document.createElement('td');
            const commentsInput = document.createElement('input');
            commentsInput.type = 'text';
            commentsInput.className = 'form-input';
            commentsInput.value = entry.comments || '';
            commentsInput.placeholder = 'Optional notes...';
            commentsInput.oninput = (e) => handleEntryChange(entry._id, 'comments', e.target.value);
            commentsCell.appendChild(commentsInput);
            tr.appendChild(commentsCell);

            // Actions
            const actionCell = document.createElement('td');
            actionCell.className = 'action-cell';
            if (!isEditMode) {
                 const removeBtn = Button({
                    variant: 'danger', size: 'sm', className: 'team-member-action-btn-delete',
                    children: '<i class="fas fa-trash-alt"></i>', ariaLabel: 'Remove Task',
                    onClick: () => removeEntryRow(entry._id),
                    disabled: formEntries.length <= 1
                });
                actionCell.appendChild(removeBtn);
            }
            tr.appendChild(actionCell);

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        form.appendChild(tableContainer);
        
        // --- Actions ---
        const footerActions = document.createElement('div');
        footerActions.className = 'project-form-actions';
        footerActions.style.justifyContent = 'space-between';

        if (!isEditMode) {
            const addRowButton = Button({
                children: 'Add Another Task',
                variant: 'secondary',
                size: 'sm',
                leftIcon: '<i class="fas fa-plus"></i>',
                onClick: addRowButton
            });
            footerActions.appendChild(addRowButton);
        } else {
            footerActions.appendChild(document.createElement('div')); // Placeholder to keep right side aligned
        }

        const rightActionButtons = document.createElement('div');
        rightActionButtons.style.display = 'flex';
        rightActionButtons.style.gap = '0.75rem';

        const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
        const saveButton = Button({ children: isEditMode ? 'Save Changes' : 'Add Logs', variant: 'primary', type: 'submit' });
        
        rightActionButtons.append(cancelButton, saveButton);
        footerActions.appendChild(rightActionButtons);
        form.appendChild(footerActions);
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const logsToSave = formEntries.map(entry => {
            const { _id, ...rest } = entry;
            return {
                ...rest,
                ...commonData,
            };
        }).filter(l => {
            // Basic validation for each entry: must have project and time > 0
            return l.projectId && l.taskName && l.timeSpentMinutes > 0;
        });

        if (logsToSave.length === 0) {
            alert('Please fill out at least one valid task row. Each entry must have a project selected and time spent greater than 0.');
            return;
        }

        if (isEditMode) {
            const logToSave = logsToSave[0];
            // When editing, the original `log` object (which has the ID) must be merged
            // with the updated data from the form.
            onSave({ ...log, ...logToSave });
        } else {
            onSaveAll(logsToSave);
        }
    });

    buildForm();
    return form;
}
