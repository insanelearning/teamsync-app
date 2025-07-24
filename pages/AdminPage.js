

import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { importFromCSV } from '../services/csvService.js';
import { PRIORITIES } from '../constants.js';

let currentModalInstance = null;
let localSettings = {};

function closeModal() {
    closeGlobalModal();
    currentModalInstance = null;
}

// --- Helper Functions ---
const createFieldset = (legendText, subtext = '') => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'admin-fieldset';
    const legend = document.createElement('legend');
    legend.className = 'admin-legend';
    legend.textContent = legendText;
    fieldset.appendChild(legend);
    if (subtext) {
        const p = document.createElement('p');
        p.className = 'admin-fieldset-subtext';
        p.textContent = subtext;
        fieldset.appendChild(p);
    }
    return fieldset;
};

const createTextField = (labelText, value, onChange) => {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.value = value;
    input.oninput = (e) => onChange(e.target.value);
    div.append(label, input);
    return div;
};

const createNumberField = (labelText, value, onChange) => {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'form-input';
    input.value = value;
    input.min = 1;
    input.oninput = (e) => onChange(Number(e.target.value));
    div.append(label, input);
    return div;
};

const createSelectField = (labelText, value, options, onChange) => {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;
    const select = document.createElement('select');
    select.className = 'form-select';
    select.innerHTML = options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
    select.onchange = (e) => onChange(e.target.value);
    div.append(label, select);
    return div;
};

const createImageUploader = (currentLogoUrl, onImageSelect) => {
    const container = document.createElement('div');
    container.className = 'admin-image-uploader';

    const preview = document.createElement('div');
    preview.className = 'admin-image-preview';

    const updatePreviewImage = (url) => {
        preview.innerHTML = url ? `<img src="${url}" alt="Logo preview">` : `<i class="fas fa-image placeholder-icon"></i>`;
    };

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png, image/jpeg, image/gif, image/svg+xml';
    fileInput.style.display = 'none';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target.result;
                onImageSelect(dataUrl);
                updatePreviewImage(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    };

    const infoContainer = document.createElement('div');
    infoContainer.className = 'admin-image-uploader-info';
    infoContainer.innerHTML = `<p>Recommended size: 128x128 pixels. PNG, JPG, GIF, SVG are supported.</p>`;
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';
    buttonGroup.append(
        Button({ children: 'Upload Image', variant: 'secondary', size: 'sm', onClick: () => fileInput.click() }),
        Button({ children: 'Remove', variant: 'danger', size: 'sm', onClick: () => { onImageSelect(''); updatePreviewImage(''); } })
    );
    infoContainer.appendChild(buttonGroup);

    container.append(preview, infoContainer);
    updatePreviewImage(currentLogoUrl);
    return container;
};

// --- Modal Forms ---
function openTaskFormModal(task, onSave) {
    const isEditMode = !!task;
    let formData = isEditMode ? { ...task } : { name: '', category: '', teams: [] };

    const form = document.createElement('form');
    form.className = 'project-form';

    const nameInput = createTextField('Task Name', formData.name, (val) => { formData.name = val; });
    const categoryInput = createTextField('Category', formData.category, (val) => { formData.category = val; });

    // Multi-select for teams
    const teamsContainer = document.createElement('div');
    teamsContainer.innerHTML = `<label class="form-label">Assign to Teams</label>`;
    const teamsGrid = document.createElement('div');
    teamsGrid.className = 'admin-checkbox-grid';
    (localSettings.internalTeams || []).forEach(teamName => {
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-wrapper';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `task-team-${teamName}`;
        checkbox.value = teamName;
        checkbox.checked = formData.teams.includes(teamName);
        checkbox.onchange = (e) => {
            if (e.target.checked) {
                formData.teams.push(teamName);
            } else {
                formData.teams = formData.teams.filter(t => t !== teamName);
            }
        };
        const label = document.createElement('label');
        label.htmlFor = `task-team-${teamName}`;
        label.textContent = teamName;
        checkboxWrapper.append(checkbox, label);
        teamsGrid.appendChild(checkboxWrapper);
    });
    teamsContainer.appendChild(teamsGrid);

    form.append(nameInput, categoryInput, teamsContainer);

    form.onsubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.category) {
            alert('Task Name and Category are required.');
            return;
        }
        onSave({ ...formData, id: formData.id || crypto.randomUUID() });
        closeModal();
    };

    const footer = [
        Button({ children: 'Cancel', variant: 'secondary', onClick: closeModal }),
        Button({ children: isEditMode ? 'Save Changes' : 'Add Task', variant: 'primary', onClick: () => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })) })
    ];

    currentModalInstance = Modal({
        isOpen: true,
        onClose: closeModal,
        title: isEditMode ? 'Edit Work Log Task' : 'Add New Work Log Task',
        children: form,
        footer: footer,
        size: 'md'
    });
}

async function handleTaskImport(file, rerenderCallback) {
    if (!file) return;
    try {
        const importedTaskNames = (await importFromCSV(file)).map(row => Object.values(row)[0]);
        if (importedTaskNames.length === 0) {
            alert('CSV is empty or could not be read.');
            return;
        }

        const form = document.createElement('form');
        form.className = 'project-form';
        const categoryInput = createTextField('Category for Imported Tasks', '', val => form.category = val);
        
        const teamsContainer = document.createElement('div');
        teamsContainer.innerHTML = `<label class="form-label">Assign to Teams</label>`;
        const teamsGrid = document.createElement('div');
        teamsGrid.className = 'admin-checkbox-grid';
        const selectedTeams = new Set();
        (localSettings.internalTeams || []).forEach(teamName => {
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'checkbox-wrapper';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `import-team-${teamName}`;
            checkbox.value = teamName;
            checkbox.onchange = (e) => {
                if (e.target.checked) selectedTeams.add(teamName);
                else selectedTeams.delete(teamName);
            };
            const label = document.createElement('label');
            label.htmlFor = `import-team-${teamName}`;
            label.textContent = teamName;
            checkboxWrapper.append(checkbox, label);
            teamsGrid.appendChild(checkboxWrapper);
        });
        teamsContainer.appendChild(teamsGrid);
        
        form.append(categoryInput, teamsContainer);
        
        const onConfirm = () => {
            const category = form.category;
            if (!category) {
                alert('Please enter a category for the imported tasks.');
                return;
            }
            const newTasks = importedTaskNames.map(name => ({
                id: crypto.randomUUID(),
                name,
                category,
                teams: Array.from(selectedTeams)
            }));
            
            localSettings.workLogTasks = [...(localSettings.workLogTasks || []), ...newTasks];
            rerenderCallback();
            closeModal();
        };

        const footer = [
            Button({ children: 'Cancel', variant: 'secondary', onClick: closeModal }),
            Button({ children: `Import ${importedTaskNames.length} Tasks`, variant: 'primary', onClick: onConfirm })
        ];

        currentModalInstance = Modal({
            isOpen: true, onClose: closeModal, title: 'Confirm Task Import',
            children: form, footer, size: 'md'
        });

    } catch (error) {
        alert('Error importing tasks: ' + error.message);
    }
}


export function renderAdminPage(container, { appSettings, onUpdateSettings }) {
    localSettings = JSON.parse(JSON.stringify(appSettings)); // Deep clone for local editing

    const rerenderPage = () => {
        const scrollY = window.scrollY;
        container.innerHTML = '';
        buildPage();
        window.scrollTo(0, scrollY);
    };

    const buildPage = () => {
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-container';
        pageWrapper.innerHTML = `<div class="page-header"><h1 class="page-header-title">Admin Panel</h1></div>`;
        
        const form = document.createElement('form');
        form.className = 'project-form admin-page-form';

        // --- Branding Section ---
        const brandingFieldset = createFieldset('Branding & Display');
        const brandingGrid = document.createElement('div');
        brandingGrid.className = 'admin-form-grid';
        brandingGrid.append(
            createTextField('Application Name', localSettings.appName || '', val => localSettings.appName = val),
            createImageUploader(localSettings.appLogoUrl, dataUrl => localSettings.appLogoUrl = dataUrl)
        );
        brandingFieldset.appendChild(brandingGrid);
        form.appendChild(brandingFieldset);

        // --- General Settings ---
        const generalFieldset = createFieldset('General Settings');
        const generalGrid = document.createElement('div');
        generalGrid.className = 'admin-form-grid';
        generalGrid.append(
            createTextField('Dashboard Welcome Message', localSettings.welcomeMessage || '', val => localSettings.welcomeMessage = val),
            createNumberField('Maximum Team Size', localSettings.maxTeamMembers || 20, val => localSettings.maxTeamMembers = val),
            createSelectField('Default Project Priority', localSettings.defaultProjectPriority || 'Medium', PRIORITIES, val => localSettings.defaultProjectPriority = val),
            createSelectField('Default Theme', localSettings.defaultTheme || 'User Choice', ['User Choice', 'Light', 'Dark'], val => localSettings.defaultTheme = val)
        );
        generalFieldset.appendChild(generalGrid);
        form.appendChild(generalFieldset);

        // --- Internal Teams ---
        const teamsFieldset = createFieldset('Internal Teams', 'Define teams to categorize members and tasks.');
        const teamsList = document.createElement('div');
        teamsList.className = 'admin-item-list';
        if (!localSettings.internalTeams || localSettings.internalTeams.length === 0) {
            teamsList.innerHTML = `<p class="admin-list-empty">No teams defined.</p>`;
        } else {
            (localSettings.internalTeams || []).forEach((team, index) => {
                const item = document.createElement('div');
                item.className = 'admin-list-item';
                item.innerHTML = `<span>${team}</span>`;
                item.appendChild(Button({
                    children: '<i class="fas fa-trash"></i>', variant: 'ghost', size: 'sm',
                    onClick: () => { localSettings.internalTeams.splice(index, 1); rerenderPage(); }
                }));
                teamsList.appendChild(item);
            });
        }
        teamsFieldset.appendChild(teamsList);
        
        let newTeamName = '';
        const addTeamContainer = document.createElement('div');
        addTeamContainer.className = 'admin-add-item-container';
        const addTeamInput = document.createElement('input');
        addTeamInput.type = 'text'; addTeamInput.className = 'form-input'; addTeamInput.placeholder = 'New team name...';
        addTeamInput.oninput = (e) => newTeamName = e.target.value;
        addTeamInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addTeamBtn.click(); }};
        const addTeamBtn = Button({
            children: 'Add Team', size: 'sm',
            onClick: () => {
                if (newTeamName.trim() && !(localSettings.internalTeams || []).includes(newTeamName.trim())) {
                    if (!localSettings.internalTeams) localSettings.internalTeams = [];
                    localSettings.internalTeams.push(newTeamName.trim());
                    rerenderPage();
                }
            }
        });
        addTeamContainer.append(addTeamInput, addTeamBtn);
        teamsFieldset.appendChild(addTeamContainer);
        form.appendChild(teamsFieldset);

        // --- Work Log Tasks ---
        const tasksFieldset = createFieldset('Work Log Tasks', 'Manage tasks available for selection in work logs.');
        const taskActions = document.createElement('div');
        taskActions.className = 'admin-item-actions';
        taskActions.append(
            Button({ children: 'Add New Task', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>', onClick: () => {
                openTaskFormModal(null, (newTask) => {
                    if (!localSettings.workLogTasks) localSettings.workLogTasks = [];
                    localSettings.workLogTasks.push(newTask);
                    rerenderPage();
                });
            }}),
            FileUploadButton({
                children: 'Import Tasks', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-import"></i>', accept: '.csv',
                onFileSelect: (file) => handleTaskImport(file, rerenderPage)
            })
        );
        tasksFieldset.appendChild(taskActions);

        const tasksTableContainer = document.createElement('div');
        tasksTableContainer.className = 'data-table-container';
        if (!localSettings.workLogTasks || localSettings.workLogTasks.length === 0) {
            tasksTableContainer.innerHTML = `<p class="admin-list-empty">No tasks defined.</p>`;
        } else {
            const table = document.createElement('table');
            table.className = 'data-table';
            table.innerHTML = `<thead><tr><th>Task Name</th><th>Category</th><th>Assigned Teams</th><th class="action-cell">Actions</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            (localSettings.workLogTasks || []).forEach((task, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${task.name}</td><td>${task.category}</td><td>${(task.teams || []).join(', ') || 'None'}</td>`;
                const actionCell = document.createElement('td');
                actionCell.className = 'action-cell';
                actionCell.append(
                    Button({ variant: 'ghost', size: 'sm', onClick: () => {
                        openTaskFormModal(task, (updatedTask) => {
                            localSettings.workLogTasks[index] = updatedTask;
                            rerenderPage();
                        });
                    }, children: '<i class="fas fa-edit"></i>'}),
                    Button({ variant: 'danger', size: 'sm', onClick: () => {
                        localSettings.workLogTasks.splice(index, 1);
                        rerenderPage();
                    }, children: '<i class="fas fa-trash"></i>'})
                );
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tasksTableContainer.appendChild(table);
        }
        tasksFieldset.appendChild(tasksTableContainer);
        form.appendChild(tasksFieldset);

        // --- Save Form ---
        const formActions = document.createElement('div');
        formActions.className = 'project-form-actions';
        formActions.style.justifyContent = 'flex-end';
        formActions.appendChild(Button({ children: 'Save All Settings', variant: 'primary', type: 'submit' }));
        form.appendChild(formActions);

        form.onsubmit = (e) => {
            e.preventDefault();
            onUpdateSettings(localSettings);
        };

        pageWrapper.appendChild(form);
        container.appendChild(pageWrapper);
    };

    buildPage();
}
