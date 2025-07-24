import { Button } from '../components/Button.js';
import { PRIORITIES } from '../constants.js';

export function renderAdminPage(container, { appSettings, onUpdateSettings }) {
    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // Local state for the form, clone to avoid direct mutation
    let localSettings = JSON.parse(JSON.stringify(appSettings));

    // --- Helper Functions ---

    const createFieldset = (legendText) => {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'pilot-details-fieldset';
        fieldset.innerHTML = `<legend class="pilot-details-legend">${legendText}</legend>`;
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
            preview.innerHTML = ''; // Clear previous content
            if (url) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Logo preview';
                preview.appendChild(img);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fas fa-image placeholder-icon';
                preview.appendChild(icon);
            }
        };
        
        const infoContainer = document.createElement('div');
        infoContainer.className = 'admin-image-uploader-info';
        infoContainer.innerHTML = `<p>Upload a company logo. Recommended size: 128x128 pixels.</p>`;

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
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        
        const uploadButton = Button({
            children: 'Upload Image',
            variant: 'secondary',
            size: 'sm',
            onClick: () => fileInput.click()
        });

        const removeButton = Button({
            children: 'Remove',
            variant: 'danger',
            size: 'sm',
            onClick: () => {
                onImageSelect('');
                updatePreviewImage('');
            }
        });

        buttonGroup.append(uploadButton, removeButton);
        infoContainer.appendChild(buttonGroup);

        container.append(preview, infoContainer);
        updatePreviewImage(currentLogoUrl); // Initial render
        return container;
    };

    // --- Main Build Function ---

    const buildPage = () => {
        pageWrapper.innerHTML = ''; // Clear previous content before building

        // Header
        const headerDiv = document.createElement('div');
        headerDiv.className = "page-header";
        headerDiv.innerHTML = `<h1 class="page-header-title">Admin Panel</h1>`;
        pageWrapper.appendChild(headerDiv);

        const form = document.createElement('form');
        form.className = 'project-form';
        form.style.gap = '2rem';

        // --- Branding Section ---
        const brandingFieldset = createFieldset('Branding');
        const appNameInput = createTextField('Application Name', localSettings.appName || '', (val) => { localSettings.appName = val; });
        const logoUploader = createImageUploader(localSettings.appLogoUrl, (dataUrl) => { localSettings.appLogoUrl = dataUrl; });
        brandingFieldset.append(appNameInput, logoUploader);
        form.appendChild(brandingFieldset);

        // --- General Settings Section ---
        const generalFieldset = createFieldset('General Settings');
        const welcomeMessageInput = createTextField('Dashboard Welcome Message', localSettings.welcomeMessage || '', (val) => { localSettings.welcomeMessage = val; });
        const maxTeamMembersInput = createNumberField('Maximum Team Size', localSettings.maxTeamMembers || 20, (val) => { localSettings.maxTeamMembers = val; });
        const defaultPriorityInput = createSelectField('Default Project Priority', localSettings.defaultProjectPriority || 'Medium', PRIORITIES, (val) => { localSettings.defaultProjectPriority = val; });
        generalFieldset.append(welcomeMessageInput, maxTeamMembersInput, defaultPriorityInput);
        form.appendChild(generalFieldset);
        
        // --- Work Log Tasks Section ---
        const tasksFieldset = createFieldset('Work Log Task Types');
        const tasksList = document.createElement('div');
        tasksList.style.display = 'flex';
        tasksList.style.flexDirection = 'column';
        tasksList.style.gap = '0.5rem';
        tasksList.style.marginBottom = '1rem';

        if (!localSettings.workLogTasks || localSettings.workLogTasks.length === 0) {
            tasksList.innerHTML = `<p class="no-data-placeholder" style="padding: 1rem 0; box-shadow: none;">No tasks defined. Add one below.</p>`;
        } else {
            (localSettings.workLogTasks || []).forEach((task, index) => {
                const taskItem = document.createElement('div');
                taskItem.style.display = 'flex';
                taskItem.style.alignItems = 'center';
                taskItem.style.gap = '0.5rem';
                taskItem.style.padding = '0.5rem';
                taskItem.style.backgroundColor = '#f9fafb';
                taskItem.style.borderRadius = '0.375rem';
                const taskText = document.createElement('span');
                taskText.textContent = task;
                taskText.style.flexGrow = '1';
                const deleteBtn = Button({
                    children: '<i class="fas fa-trash"></i>', variant: 'danger', size: 'sm',
                    onClick: () => {
                        localSettings.workLogTasks.splice(index, 1);
                        buildPage(); // Re-render the whole form
                    }
                });
                taskItem.append(taskText, deleteBtn);
                tasksList.appendChild(taskItem);
            });
        }
        tasksFieldset.appendChild(tasksList);

        let newTask = '';
        const addTaskContainer = document.createElement('div');
        addTaskContainer.className = 'project-form-tags-input-container';
        const addTaskInput = document.createElement('input');
        addTaskInput.type = 'text';
        addTaskInput.className = 'form-input';
        addTaskInput.placeholder = 'Add new task type...';
        addTaskInput.oninput = (e) => { newTask = e.target.value; };
        addTaskInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addTaskBtn.click(); }};
        const addTaskBtn = Button({
            children: 'Add Task', size: 'sm',
            onClick: () => {
                if (newTask.trim()) {
                    if (!localSettings.workLogTasks) {
                        localSettings.workLogTasks = [];
                    }
                    localSettings.workLogTasks.push(newTask.trim());
                    newTask = '';
                    buildPage(); // Re-render the whole form
                }
            }
        });
        addTaskContainer.append(addTaskInput, addTaskBtn);
        tasksFieldset.appendChild(addTaskContainer);
        form.appendChild(tasksFieldset);

        // --- Save Action ---
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'project-form-actions';
        actionsDiv.style.justifyContent = 'flex-end';
        const saveButton = Button({
            children: 'Save All Changes',
            variant: 'primary',
            type: 'submit'
        });
        actionsDiv.append(saveButton);
        form.appendChild(actionsDiv);

        form.onsubmit = (e) => {
            e.preventDefault();
            onUpdateSettings(localSettings);
        };
        
        pageWrapper.appendChild(form);
    };

    buildPage();
    container.appendChild(pageWrapper);
}
