import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

export function WorkLogForm({ log, currentUser, teamMembers, projects, workLogTasks, onSave, onSaveAll, onCancel, initialEntryData }) {
    const isEditMode = !!log;

    let commonData = {
        date: isEditMode ? log.date : new Date().toISOString().split('T')[0],
        memberId: isEditMode ? log.memberId : currentUser.id,
    };

    // Determine the default task based on the new structure (object of arrays)
    const categories = Object.keys(workLogTasks || {});
    const defaultTaskName = (categories.length > 0 && workLogTasks[categories[0]].length > 0)
        ? workLogTasks[categories[0]][0].name
        : '';

    const defaultEntry = { _id: crypto.randomUUID(), projectId: '', taskName: defaultTaskName, timeSpentMinutes: 0, requestedFrom: '', comments: '' };

    let formEntries = isEditMode
        ? [{ ...log, _id: crypto.randomUUID() }] // Add a temporary client-side ID for editing
        : [ initialEntryData ? { ...defaultEntry, ...initialEntryData } : defaultEntry ];

    const form = document.createElement('form');
    form.className = 'project-form'; // Reuse styles

    function rerender() {
        form.innerHTML = '';
        buildForm();
    }

    const handleCommonDataChange = (e) => {
        commonData[e.target.name] = e.target.value;
        if (e.target.name === 'memberId') {
            // This case should not happen in the new flow as page reloads with filtered tasks,
            // but is kept for robustness. A full re-render is needed.
            alert("Changing member requires reloading the form. This feature is not supported in the current context.");
        }
    };

    const handleEntryChange = (entryId, field, value) => {
        const entryIndex = formEntries.findIndex(e => e._id === entryId);
        if (entryIndex > -1) {
            formEntries[entryIndex][field] = (field === 'timeSpentMinutes') ? Number(value) : value;
        }
    };

    const addEntryRow = () => {
        formEntries.push({ _id: crypto.randomUUID(), projectId: '', taskName: defaultTaskName, timeSpentMinutes: 0, requestedFrom: '', comments: '' });
        rerender();
    };

    const removeEntryRow = (entryId) => {
        formEntries = formEntries.filter(e => e._id !== entryId);
        rerender();
    };

    function buildForm() {
        const topFieldsContainer = document.createElement('div');
        topFieldsContainer.className = 'worklog-form-top-fields';

        if (currentUser.role === TeamMemberRole.Manager || isEditMode) {
            const memberSelect = document.createElement('select');
            memberSelect.className = 'form-select';
            memberSelect.name = 'memberId';
            memberSelect.innerHTML = teamMembers.map(m => `<option value="${m.id}" ${commonData.memberId === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
            memberSelect.onchange = handleCommonDataChange;
            memberSelect.disabled = isEditMode || currentUser.role !== TeamMemberRole.Manager;

            const memberDiv = document.createElement('div');
            memberDiv.innerHTML = `<label class="form-label">Team Member</label>`;
            memberDiv.appendChild(memberSelect);
            topFieldsContainer.appendChild(memberDiv);
        }

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
        const projectsForMember = projects.filter(p => p.status !== 'Done' && (p.assignees || []).includes(commonData.memberId));

        formEntries.forEach(entry => {
            const tr = document.createElement('tr');

            const projectCell = document.createElement('td');
            const projectSelect = document.createElement('select');
            projectSelect.className = 'form-select';
            projectSelect.required = true;
            projectSelect.innerHTML = `<option value="">Select Project...</option>` + projectsForMember.map(p => `<option value="${p.id}" ${entry.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
            projectSelect.onchange = (e) => handleEntryChange(entry._id, 'projectId', e.target.value);
            projectCell.appendChild(projectSelect);
            tr.appendChild(projectCell);

            // Task dropdown with optgroup for categories
            const taskCell = document.createElement('td');
            const taskSelect = document.createElement('select');
            taskSelect.className = 'form-select';
            taskSelect.required = true;
            
            const taskCategories = Object.keys(workLogTasks || {});
            if (taskCategories.length === 0) {
                taskSelect.innerHTML = `<option value="">No tasks for this team</option>`;
                taskSelect.disabled = true;
            } else {
                taskSelect.innerHTML = taskCategories.map(category => {
                    const options = workLogTasks[category].map(task =>
                        `<option value="${task.name}" ${entry.taskName === task.name ? 'selected' : ''}>${task.name}</option>`
                    ).join('');
                    return `<optgroup label="${category}">${options}</optgroup>`;
                }).join('');
            }
            taskSelect.onchange = (e) => handleEntryChange(entry._id, 'taskName', e.target.value);
            taskCell.appendChild(taskSelect);
            tr.appendChild(taskCell);

            const timeCell = document.createElement('td');
            const timeInput = document.createElement('input');
            timeInput.type = 'number';
            timeInput.className = 'form-input';
            timeInput.value = entry.timeSpentMinutes;
            timeInput.min = 0;
            timeInput.required = true;
            timeInput.oninput = (e) => handleEntryChange(entry._id, 'timeSpentMinutes', e.target.value);
            timeCell.appendChild(timeInput);
            tr.appendChild(timeCell);

            const commentsCell = document.createElement('td');
            const commentsInput = document.createElement('input');
            commentsInput.type = 'text';
            commentsInput.className = 'form-input';
            commentsInput.value = entry.comments || '';
            commentsInput.placeholder = 'Optional notes...';
            commentsInput.oninput = (e) => handleEntryChange(entry._id, 'comments', e.target.value);
            commentsCell.appendChild(commentsInput);
            tr.appendChild(commentsCell);

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
            footerActions.appendChild(document.createElement('div'));
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

        if (isEditMode) {
            onSave(logsToSave[0]);
        } else {
            onSaveAll(logsToSave);
        }
    });

    buildForm();
    return form;
}
