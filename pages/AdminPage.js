import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { FileUploadButton } from '../components/FileUploadButton.js';
import { importFromCSV } from '../services/csvService.js';
import { PRIORITIES } from '../constants.js';

let currentModalInstance = null;
let localSettings = {};
let taskCurrentPage = 1;
const tasksPerPage = 5;
let taskSearchTerm = '';
let taskCategoryFilter = '';
let taskTeamFilter = '';


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

const createColorField = (labelText, value, onChange) => {
    const container = document.createElement('div');

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;
    container.appendChild(label);

    const inputWrapper = document.createElement('div');
    inputWrapper.style.display = 'flex';
    inputWrapper.style.alignItems = 'center';
    inputWrapper.style.gap = '0.5rem';
    inputWrapper.style.border = '1px solid #d1d5db';
    inputWrapper.style.borderRadius = '0.375rem';
    inputWrapper.style.paddingLeft = '0.25rem';
    inputWrapper.style.backgroundColor = '#ffffff';

    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        inputWrapper.style.borderColor = '#4b5563';
        inputWrapper.style.backgroundColor = '#374151';
    }

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = value;
    colorInput.style.width = '2rem';
    colorInput.style.height = '2rem';
    colorInput.style.border = 'none';
    colorInput.style.padding = '0';
    colorInput.style.background = 'none';
    colorInput.style.cursor = 'pointer';

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'form-input';
    hexInput.value = value.toUpperCase();
    hexInput.style.border = 'none';
    hexInput.style.boxShadow = 'none';
    hexInput.style.backgroundColor = 'transparent';
    hexInput.style.padding = '0.5rem 0.25rem';

    colorInput.addEventListener('input', (e) => {
        const newValue = e.target.value;
        hexInput.value = newValue.toUpperCase();
        onChange(newValue);
    });

    hexInput.addEventListener('change', (e) => {
        let newValue = e.target.value.trim();
        if (!newValue.startsWith('#')) {
            newValue = '#' + newValue;
        }
        if (/^#[0-9A-F]{6}$/i.test(newValue)) {
            colorInput.value = newValue;
            onChange(newValue);
        } else {
            hexInput.value = value.toUpperCase(); // Revert to last valid color
        }
    });

    inputWrapper.append(colorInput, hexInput);
    container.appendChild(inputWrapper);

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
        const importedData = await importFromCSV(file);
        if (importedData.length === 0) {
            alert('CSV is empty or could not be read.');
            return;
        }

        // Standardize header keys (case-insensitive, trim spaces) for easier access
        const headerMap = {};
        Object.keys(importedData[0]).forEach(h => {
            headerMap[h.trim().toLowerCase()] = h;
        });
        
        const nameKey = headerMap['task name'] || headerMap['taskname'];
        const categoryKey = headerMap['category'];
        const teamsKey = headerMap['assigned teams'] || headerMap['assignedteams'];
        
        if (!nameKey || !categoryKey || !teamsKey) {
            alert("Import failed. CSV must contain the columns: 'Task Name', 'Category', and 'Assigned Teams'.");
            return;
        }
        
        let validTasks = [];
        let invalidTeamNames = new Set();
        const existingTeams = new Set(localSettings.internalTeams || []);

        importedData.forEach(row => {
            const taskName = row[nameKey]?.trim();
            const category = row[categoryKey]?.trim();
            const teamsString = row[teamsKey] || '';

            if (!taskName || !category) return; // Skip rows with missing essential data

            const teams = teamsString.split(',').map(t => t.trim()).filter(Boolean);
            const validTeams = [];
            
            teams.forEach(team => {
                if (existingTeams.has(team)) {
                    validTeams.push(team);
                } else {
                    invalidTeamNames.add(team);
                }
            });

            validTasks.push({
                id: crypto.randomUUID(),
                name: taskName,
                category: category,
                teams: validTeams
            });
        });

        if (invalidTeamNames.size > 0) {
            alert(`Warning: The following teams were not found in your settings and have been ignored: ${Array.from(invalidTeamNames).join(', ')}`);
        }
        
        if (validTasks.length === 0) {
            alert('No valid tasks could be processed from the import. Please check your CSV file format.');
            return;
        }

        // Confirmation modal
        const modalContent = document.createElement('div');
        modalContent.className = 'project-form';
        modalContent.innerHTML = `<p>Found ${validTasks.length} valid tasks to import. How would you like to add them?</p>`;

        const onAppend = () => {
            localSettings.workLogTasks = [...(localSettings.workLogTasks || []), ...validTasks];
            rerenderCallback();
            closeModal();
        };

        const onReplace = () => {
            localSettings.workLogTasks = validTasks;
            rerenderCallback();
            closeModal();
        };
        
        const footer = [
            Button({ children: 'Cancel', variant: 'secondary', onClick: closeModal }),
            Button({ children: 'Replace Existing', variant: 'danger', onClick: onReplace }),
            Button({ children: 'Append to List', variant: 'primary', onClick: onAppend }),
        ];
        
        currentModalInstance = Modal({
            isOpen: true, onClose: closeModal, title: 'Confirm Task Import',
            children: modalContent, footer: footer, size: 'md'
        });
        
    } catch (error) {
        alert('Error importing tasks: ' + error.message);
    }
}


export function renderAdminPage(container, { appSettings, onUpdateSettings, onExport }) {
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

        // --- Holiday and Color Grid ---
        const twoColumnGrid = document.createElement('div');
        twoColumnGrid.className = 'admin-two-column-grid';

        // --- Holiday Management ---
        const holidayFieldset = createFieldset('Holiday Management', 'Define company-wide non-working days.');
        const holidayList = document.createElement('div');
        holidayList.className = 'admin-item-list';
        if (!localSettings.holidays || localSettings.holidays.length === 0) {
            holidayList.innerHTML = `<p class="admin-list-empty">No holidays defined.</p>`;
        } else {
            (localSettings.holidays || []).sort((a,b) => a.date.localeCompare(b.date)).forEach((holiday) => {
                const item = document.createElement('div');
                item.className = 'admin-list-item';
                item.innerHTML = `<span><strong>${holiday.name}</strong> - ${new Date(holiday.date + 'T00:00:00').toLocaleDateString()}</span>`;
                item.appendChild(Button({
                    children: '<i class="fas fa-trash"></i>', variant: 'ghost', size: 'sm',
                    onClick: () => { 
                        localSettings.holidays = localSettings.holidays.filter(h => h.id !== holiday.id);
                        rerenderPage(); 
                    }
                }));
                holidayList.appendChild(item);
            });
        }
        holidayFieldset.appendChild(holidayList);

        let newHoliday = { name: '', date: ''};
        const addHolidayContainer = document.createElement('div');
        addHolidayContainer.className = 'admin-add-item-container';
        addHolidayContainer.style.alignItems = 'flex-end';
        const holidayNameInput = document.createElement('input');
        holidayNameInput.type = 'text'; holidayNameInput.className = 'form-input'; holidayNameInput.placeholder = 'Holiday name...';
        holidayNameInput.oninput = (e) => newHoliday.name = e.target.value;
        const holidayDateInput = document.createElement('input');
        holidayDateInput.type = 'date'; holidayDateInput.className = 'form-input';
        holidayDateInput.oninput = (e) => newHoliday.date = e.target.value;
        const addHolidayBtn = Button({
            children: 'Add Holiday', size: 'sm',
            onClick: () => {
                if (newHoliday.name.trim() && newHoliday.date) {
                    if (!localSettings.holidays) localSettings.holidays = [];
                    localSettings.holidays.push({ ...newHoliday, id: crypto.randomUUID() });
                    rerenderPage();
                } else {
                    alert('Please provide both a name and a date for the holiday.');
                }
            }
        });
        addHolidayContainer.append(holidayNameInput, holidayDateInput, addHolidayBtn);
        holidayFieldset.appendChild(addHolidayContainer);
        twoColumnGrid.appendChild(holidayFieldset);

        // --- Color Controls ---
        const colorFieldset = createFieldset('Theme & Color Controls', 'Set the primary colors for the application UI.');
        const colorGrid = document.createElement('div');
        colorGrid.className = 'admin-form-grid';
        colorGrid.style.gridTemplateColumns = '1fr'; // Stack them in the column
        colorGrid.append(
            createColorField('Primary Color', localSettings.primaryColor, val => localSettings.primaryColor = val),
            createColorField('Primary Hover Color', localSettings.primaryColorHover, val => localSettings.primaryColorHover = val)
        );
        colorFieldset.appendChild(colorGrid);
        twoColumnGrid.appendChild(colorFieldset);

        form.appendChild(twoColumnGrid);


        // --- Two Column Layout for Teams & Leave Types ---
        const twoColumnGrid2 = document.createElement('div');
        twoColumnGrid2.className = 'admin-two-column-grid';

        // --- Internal Teams ---
        const teamsFieldset = createFieldset('Internal Teams');
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
        twoColumnGrid2.appendChild(teamsFieldset);

        // --- Leave Types ---
        const leaveTypesFieldset = createFieldset('Leave Types');
        const leaveTypesList = document.createElement('div');
        leaveTypesList.className = 'admin-item-list';
        if (!localSettings.leaveTypes || localSettings.leaveTypes.length === 0) {
            leaveTypesList.innerHTML = `<p class="admin-list-empty">No leave types defined.</p>`;
        } else {
            (localSettings.leaveTypes || []).forEach((leaveType, index) => {
                const item = document.createElement('div');
                item.className = 'admin-list-item';
                item.innerHTML = `<span>${leaveType}</span>`;
                item.appendChild(Button({
                    children: '<i class="fas fa-trash"></i>', variant: 'ghost', size: 'sm',
                    onClick: () => { localSettings.leaveTypes.splice(index, 1); rerenderPage(); }
                }));
                leaveTypesList.appendChild(item);
            });
        }
        leaveTypesFieldset.appendChild(leaveTypesList);

        let newLeaveTypeName = '';
        const addLeaveTypeContainer = document.createElement('div');
        addLeaveTypeContainer.className = 'admin-add-item-container';
        const addLeaveTypeInput = document.createElement('input');
        addLeaveTypeInput.type = 'text'; addLeaveTypeInput.className = 'form-input'; addLeaveTypeInput.placeholder = 'New leave type...';
        addLeaveTypeInput.oninput = (e) => newLeaveTypeName = e.target.value;
        addLeaveTypeInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addLeaveTypeBtn.click(); }};
        const addLeaveTypeBtn = Button({
            children: 'Add Type', size: 'sm',
            onClick: () => {
                if (newLeaveTypeName.trim() && !(localSettings.leaveTypes || []).includes(newLeaveTypeName.trim())) {
                    if (!localSettings.leaveTypes) localSettings.leaveTypes = [];
                    localSettings.leaveTypes.push(newLeaveTypeName.trim());
                    rerenderPage();
                }
            }
        });
        addLeaveTypeContainer.append(addLeaveTypeInput, addLeaveTypeBtn);
        leaveTypesFieldset.appendChild(addLeaveTypeContainer);
        twoColumnGrid2.appendChild(leaveTypesFieldset);

        form.appendChild(twoColumnGrid2);


        // --- Work Log Tasks ---
        const tasksFieldset = createFieldset('Work Log Tasks', "Manage tasks available for selection in work logs. CSV format: 'Task Name', 'Category', 'Assigned Teams'");
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
            }),
            Button({
                children: 'Export Tasks', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-file-export"></i>',
                onClick: () => onExport('worklogtasks', localSettings.workLogTasks)
            })
        );
        tasksFieldset.appendChild(taskActions);

        // Task Filters
        const taskFiltersContainer = document.createElement('div');
        taskFiltersContainer.className = 'filters-grid';
        taskFiltersContainer.style.marginBottom = '1rem';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search by name or category...';
        searchInput.className = 'form-input';
        searchInput.value = taskSearchTerm || '';
        searchInput.oninput = (e) => {
            taskSearchTerm = e.target.value;
            taskCurrentPage = 1;
            rerenderPage();
        };

        const uniqueCategories = [...new Set((localSettings.workLogTasks || []).map(t => t.category).filter(Boolean))].sort();
        const categorySelect = document.createElement('select');
        categorySelect.className = 'form-select';
        categorySelect.innerHTML = `<option value="">All Categories</option>` + uniqueCategories.map(cat => `<option value="${cat}" ${taskCategoryFilter === cat ? 'selected' : ''}>${cat}</option>`).join('');
        categorySelect.onchange = (e) => {
            taskCategoryFilter = e.target.value;
            taskCurrentPage = 1;
            rerenderPage();
        };

        const teamSelect = document.createElement('select');
        teamSelect.className = 'form-select';
        teamSelect.innerHTML = `<option value="">All Teams</option>` + (localSettings.internalTeams || []).map(team => `<option value="${team}" ${taskTeamFilter === team ? 'selected' : ''}>${team}</option>`).join('');
        teamSelect.onchange = (e) => {
            taskTeamFilter = e.target.value;
            taskCurrentPage = 1;
            rerenderPage();
        };

        taskFiltersContainer.append(searchInput, categorySelect, teamSelect);
        tasksFieldset.appendChild(taskFiltersContainer);


        const tasksTableContainer = document.createElement('div');
        tasksTableContainer.className = 'data-table-container';
        
        // Filter tasks before pagination
        let filteredTasks = localSettings.workLogTasks || [];
        if (taskSearchTerm) {
            const lowercasedTerm = taskSearchTerm.toLowerCase();
            filteredTasks = filteredTasks.filter(task =>
                task.name.toLowerCase().includes(lowercasedTerm) ||
                task.category.toLowerCase().includes(lowercasedTerm)
            );
        }
        if (taskCategoryFilter) {
            filteredTasks = filteredTasks.filter(task => task.category === taskCategoryFilter);
        }
        if (taskTeamFilter) {
            filteredTasks = filteredTasks.filter(task => (task.teams || []).includes(taskTeamFilter));
        }

        const tasks = filteredTasks;
        const totalTasks = tasks.length;
        const totalPages = Math.ceil(totalTasks / tasksPerPage) || 1;
        if (taskCurrentPage > totalPages) taskCurrentPage = 1;

        const startIndex = (taskCurrentPage - 1) * tasksPerPage;
        const endIndex = startIndex + tasksPerPage;
        const tasksForPage = tasks.slice(startIndex, endIndex);

        if (tasksForPage.length === 0) {
            tasksTableContainer.innerHTML = `<p class="admin-list-empty">No tasks match the current filters.</p>`;
        } else {
            const table = document.createElement('table');
            table.className = 'data-table admin-tasks-table';
            table.innerHTML = `<thead><tr><th>Task Name</th><th>Category</th><th>Assigned Teams</th><th class="action-cell">Actions</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            tasksForPage.forEach((task) => {
                const index = (localSettings.workLogTasks || []).indexOf(task);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${task.name}</td><td>${task.category}</td><td>${(task.teams || []).join(', ') || 'None'}</td>`;
                const actionCell = document.createElement('td');
                actionCell.className = 'action-cell';
                actionCell.append(
                    Button({ variant: 'ghost', size: 'sm', onClick: () => {
                        openTaskFormModal(task, (updatedTask) => {
                            if (index > -1) {
                                localSettings.workLogTasks[index] = updatedTask;
                                rerenderPage();
                            }
                        });
                    }, children: '<i class="fas fa-edit"></i>'}),
                    Button({ variant: 'danger', size: 'sm', onClick: () => {
                        if (index > -1) {
                            localSettings.workLogTasks.splice(index, 1);
                            rerenderPage();
                        }
                    }, children: '<i class="fas fa-trash"></i>'})
                );
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tasksTableContainer.appendChild(table);
        }
        tasksFieldset.appendChild(tasksTableContainer);

        // Pagination for Tasks Table
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls';
        if (totalPages > 1) {
            const navContainer = document.createElement('div');
            navContainer.className = 'pagination-nav';
            const pageInfo = document.createElement('span');
            pageInfo.textContent = `Page ${taskCurrentPage} of ${totalPages}`;
            const prevButton = Button({ children: 'Prev', variant: 'secondary', size: 'sm', disabled: taskCurrentPage === 1, onClick: () => { taskCurrentPage--; rerenderPage(); }});
            const nextButton = Button({ children: 'Next', variant: 'secondary', size: 'sm', disabled: taskCurrentPage >= totalPages, onClick: () => { taskCurrentPage++; rerenderPage(); }});
            navContainer.append(prevButton, pageInfo, nextButton);
            paginationContainer.append(document.createElement('div'), navContainer);
        }
        tasksFieldset.appendChild(paginationContainer);

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
