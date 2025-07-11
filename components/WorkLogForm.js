
import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

const getDefaultLog = (currentUser) => ({
    memberId: currentUser.id,
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    taskName: '',
    requestedFrom: '',
    timeSpentMinutes: 0,
    comments: '',
});

export function WorkLogForm({ log, currentUser, teamMembers, projects, onSave, onCancel }) {
    let formData = log
        ? { ...getDefaultLog(currentUser), ...log }
        : { ...getDefaultLog(currentUser) };

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
            (options.options || []).forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.label;
                if (value === opt.value) {
                    optionEl.selected = true;
                }
                input.appendChild(optionEl);
            });
            input.disabled = !!options.disabled;
        } else if (inputType === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'form-input';
            input.rows = options.rows || 3;
            input.value = value || '';
        } else {
            input = document.createElement('input');
            input.type = inputType;
            input.className = 'form-input';
            input.value = value || '';
        }
        
        input.name = name;
        if (options.required) input.required = true;
        
        input.addEventListener('input', (e) => {
            formData[name] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        });
        div.appendChild(input);
        return div;
    }
    
    const isManager = currentUser.role === TeamMemberRole.Manager;

    const topGrid = document.createElement('div');
    topGrid.className = 'form-grid-cols-3';
    
    // Member selector (only for managers)
    if (isManager) {
        topGrid.appendChild(createField('Team Member', 'select', 'memberId', formData.memberId, {
            options: teamMembers.map(m => ({ value: m.id, label: m.name })),
            required: true,
        }));
    }
    
    // Project Selector
    const activeProjects = projects.filter(p => p.status !== 'Done');
    topGrid.appendChild(createField('Project', 'select', 'projectId', formData.projectId, {
        options: [{ value: '', label: 'Select a project...' }, ...activeProjects.map(p => ({ value: p.id, label: p.name }))],
        required: true
    }));
    
    // Date picker
    topGrid.appendChild(createField('Date', 'date', 'date', formData.date, { required: true }));
    form.appendChild(topGrid);
    
    const middleGrid = document.createElement('div');
    middleGrid.className = 'form-grid-cols-3';
    
    // Task name
    middleGrid.appendChild(createField('Task Name', 'text', 'taskName', formData.taskName, { required: true }));
    
    // Requested From
    middleGrid.appendChild(createField('Requested From', 'text', 'requestedFrom', formData.requestedFrom));
    
    // Time Spent
    middleGrid.appendChild(createField('Time Spent (minutes)', 'number', 'timeSpentMinutes', formData.timeSpentMinutes, { required: true }));
    
    form.appendChild(middleGrid);

    // Comments
    form.appendChild(createField('Comments', 'textarea', 'comments', formData.comments));


    // --- Actions ---
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'project-form-actions';
    const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
    const saveButton = Button({ children: log ? 'Save Changes' : 'Add Log', variant: 'primary', type: 'submit' });
    actionsDiv.append(cancelButton, saveButton);
    form.appendChild(actionsDiv);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!formData.projectId) {
            alert('Please select a project.');
            return;
        }
        if (!formData.taskName.trim()) {
            alert('Please enter a task name.');
            return;
        }
        if (formData.timeSpentMinutes <= 0) {
            alert('Time spent must be greater than zero.');
            return;
        }

        const now = new Date().toISOString();
        const logToSave = {
            ...formData,
            id: log?.id || crypto.randomUUID(),
            createdAt: log?.createdAt || now,
            updatedAt: now,
            timeSpentMinutes: Number(formData.timeSpentMinutes),
        };
        onSave(logToSave);
    });

    return form;
}
