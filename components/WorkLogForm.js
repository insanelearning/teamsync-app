import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

export function WorkLogForm({ log, currentUser, teamMembers, projects, workLogTasks, onSave, onSaveAll, onCancel, initialEntryData }) {
    const isEditMode = !!log;

    // `commonData` holds state for fields common to all log entries in the form
    let commonData = {
        date: isEditMode ? log.date : new Date().toISOString().split('T')[0],
        memberId: isEditMode ? log.memberId : currentUser.id,
    };
    
    // `formEntries` holds the state for each individual log row
    let formEntries = isEditMode
        ? [{ ...log, _id: crypto.randomUUID() }] // Add a temporary client-side ID for editing
        : [ initialEntryData ? { ...initialEntryData, _id: crypto.randomUUID(), timeSpentMinutes: 0, requestedFrom: '', comments: '' } : { _id: crypto.randomUUID(), projectId: '', taskName: '', timeSpentMinutes: 0, requestedFrom: '', comments: '' } ];

    const form = document.createElement('form');
    form.className = 'project-form'; // Reuse styles

    function rerender() {
        const focusedElement = document.activeElement;
        const focusedId = focusedElement ? focusedElement.id : null;
        form.innerHTML = '';
        buildForm();
        if (focusedId) {
            const elementToFocus = document.getElementById(focusedId);
            if (elementToFocus) {
                elementToFocus.focus();
            }
        }
    }

    const handleCommonDataChange = (e) => {
        commonData[e.target.name] = e.target.value;
        if (e.target.name === 'memberId') {
            // When the member changes, we must re-render the form
            // to update the available projects and tasks in the dropdowns.
            // We also reset the selections in each row.
            formEntries = formEntries.map(entry => ({ ...entry, projectId: '', taskName: '' }));
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
        formEntries.push({ _id: crypto.randomUUID(), projectId: '', taskName: '', timeSpentMinutes: 0, requestedFrom: '', comments: '' });
        rerender();
    };

    const removeEntryRow = (entryId) => {
        formEntries = formEntries.filter(e => e._id !== entryId);
        rerender();
    };

    function buildForm() {
        // --- Dynamic Filtering Logic ---
        // Filter projects and tasks based on the currently selected member.
        const selectedMember = teamMembers.find(m => m.id === commonData.memberId);
        const selectedMemberTeam = selectedMember ? selectedMember.internalTeam : '';

        const projectsForMember = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(commonData.memberId));

        const availableTasksForMember = (workLogTasks || []).filter(task => (task.teams || []).includes(selectedMemberTeam));
        const tasksGroupedByCategory = availableTasksForMember.reduce((acc, task) => {
            const category = task.category || 'Uncategorized';
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {});
        
        // Determine a default task for new rows.
        const categories = Object.keys(tasksGroupedByCategory);
        const defaultTaskName = (categories.length > 0 && tasksGroupedByCategory[categories[0]].length > 0)
            ? tasksGroupedByCategory[categories[0]][0].name
            : '';

        // --- Top Fields: Member & Date ---
        const topFieldsContainer = document.createElement('div');
        topFieldsContainer.className = 'worklog-form-top-fields';

        if (currentUser.role === TeamMemberRole.Manager || isEditMode) {
            const memberSelect = document.createElement('select');
            memberSelect.className = 'form-select';
            memberSelect.id = 'worklog-form-member-select';
            memberSelect.name = 'memberId';
            memberSelect.innerHTML = teamMembers.map(m => `<option value="${m.id}" ${commonData.memberId === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
            memberSelect.onchange = handleCommonDataChange;
            // A manager can change the user; for a member editing their own, it's disabled.
            memberSelect.disabled = isEditMode && currentUser.role !== TeamMemberRole.Manager;

            const memberDiv = document.createElement('div');
            memberDiv.innerHTML = `<label for="worklog-form-member-select" class="form-label">Team Member</label>`;
            memberDiv.appendChild(memberSelect);
            topFieldsContainer.appendChild(memberDiv);
        }

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'worklog-form-date-input';
        dateInput.className = 'form-input';
        dateInput.name = 'date';
        dateInput.value = commonData.date;
        dateInput.onchange = handleCommonDataChange;

        const dateDiv = document.createElement('div');
        dateDiv.innerHTML = `<label for="worklog-form-date-input" class="form-label">Date</label>`;
        dateDiv.appendChild(dateInput);
        topFieldsContainer.appendChild(dateDiv);

        form.appendChild(topFieldsContainer);
        
        // --- Log Entries Section ---
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
        
        formEntries.forEach((entry, index) => {
            const tr = document.createElement('tr');
            const uniqueIdPrefix = `entry-${entry._id}-${index}`;

            // Set default task name for new rows
            if (!entry.taskName) {
                entry.taskName = defaultTaskName;
            }

            // Project Dropdown
            const projectCell = document.createElement('td');
            const projectSelect = document.createElement('select');
            projectSelect.className = 'form-select';
            projectSelect.required = true;
            projectSelect.id = `${uniqueIdPrefix}-project`;
            projectSelect.innerHTML = `<option value="">Select Project...</option>` + projectsForMember.map(p => `<option value="${p.id}" ${entry.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
            projectSelect.onchange = (e) => handleEntryChange(entry._id, 'projectId', e.target.value);
            projectCell.appendChild(projectSelect);
            tr.appendChild(projectCell);

            // Task Dropdown
            const taskCell = document.createElement('td');
            const taskSelect = document.createElement('select');
            taskSelect.className = 'form-select';
            taskSelect.required = true;
            taskSelect.id = `${uniqueIdPrefix}-task`;
            
            if (categories.length === 0) {
                taskSelect.innerHTML = `<option value="">No tasks for this team</option>`;
                taskSelect.disabled = true;
            } else {
                taskSelect.innerHTML = categories.map(category => {
                    const options = tasksGroupedByCategory[category].map(task =>
                        `<option value="${task.name}" ${entry.taskName === task.name ? 'selected' : ''}>${task.name}</option>`
                    ).join('');
                    return `<optgroup label="${category}">${options}</optgroup>`;
                }).join('');
                taskSelect.disabled = false;
            }
            taskSelect.onchange = (e) => handleEntryChange(entry._id, 'taskName', e.target.value);
            taskCell.appendChild(taskSelect);
            tr.appendChild(taskCell);
            
            // Time Input
            const timeCell = document.createElement('td');
            const timeInput = document.createElement('input');
            timeInput.type = 'number';
            timeInput.className = 'form-input';
            timeInput.value = entry.timeSpentMinutes;
            timeInput.min = 0;
            timeInput.required = true;
            timeInput.id = `${uniqueIdPrefix}-time`;
            timeInput.oninput = (e) => handleEntryChange(entry._id, 'timeSpentMinutes', e.target.value);
            timeCell.appendChild(timeInput);
            tr.appendChild(timeCell);

            // Comments Input
            const commentsCell = document.createElement('td');
            const commentsInput = document.createElement('input');
            commentsInput.type = 'text';
            commentsInput.className = 'form-input';
            commentsInput.value = entry.comments || '';
            commentsInput.placeholder = 'Optional notes...';
            commentsInput.id = `${uniqueIdPrefix}-comments`;
            commentsInput.oninput = (e) => handleEntryChange(entry._id, 'comments', e.target.value);
            commentsCell.appendChild(commentsInput);
            tr.appendChild(commentsCell);

            // Action Button
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

        // --- Footer Actions ---
        const footerActions = document.createElement('div');
        footerActions.className = 'project-form-actions';
        footerActions.style.justifyContent = 'space-between';

        if (!isEditMode) {
            const addRowButton = Button({
                children: 'Add Another Task', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>',
                onClick: addEntryRow
            });
            footerActions.appendChild(addRowButton);
        } else {
            footerActions.appendChild(document.createElement('div')); // Placeholder to maintain layout
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
            return { ...rest, ...commonData };
        }).filter(l => l.projectId && l.taskName && l.timeSpentMinutes > 0);

        if (logsToSave.length === 0) {
            alert('Please fill out at least one valid task row with a project selected and time spent greater than zero.');
            return;
        }
        
        // When saving, find the first available task for any row that had an invalid one after a member change.
        logsToSave.forEach(log => {
             const selectedMember = teamMembers.find(m => m.id === log.memberId);
             const selectedMemberTeam = selectedMember ? selectedMember.internalTeam : '';
             const availableTasksForMember = (workLogTasks || []).filter(task => (task.teams || []).includes(selectedMemberTeam));
             const isTaskValid = availableTasksForMember.some(task => task.name === log.taskName);
             if (!isTaskValid && availableTasksForMember.length > 0) {
                 log.taskName = availableTasksForMember[0].name;
             } else if (!isTaskValid) {
                 log.taskName = ''; // No valid tasks, this will fail validation
             }
        });

        if (isEditMode) {
            onSave(logsToSave[0]);
        } else {
            onSaveAll(logsToSave);
        }
    });

    buildForm();
    return form;
}
