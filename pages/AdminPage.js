
import { Button } from '../components/Button.js';

export function renderAdminPage(container, { appSettings, onUpdateSettings }) {
    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // Local state for the form, clone to avoid direct mutation
    let localSettings = JSON.parse(JSON.stringify(appSettings));

    const rerender = () => {
        pageWrapper.innerHTML = '';
        buildPage();
    };

    const buildPage = () => {
        // Header
        const headerDiv = document.createElement('div');
        headerDiv.className = "page-header";
        headerDiv.innerHTML = `<h1 class="page-header-title">Admin Panel</h1>`;
        pageWrapper.appendChild(headerDiv);

        const form = document.createElement('form');
        form.className = 'project-form'; // Reuse styles for consistency
        form.style.gap = '2rem';

        // --- Branding Section ---
        const brandingFieldset = document.createElement('fieldset');
        brandingFieldset.className = 'pilot-details-fieldset'; // Reusing style for grouped fields
        brandingFieldset.innerHTML = `<legend class="pilot-details-legend">Branding</legend>`;
        
        const appNameInput = createField('Application Name', 'text', localSettings.appName || '', (val) => { localSettings.appName = val; updatePreview(); });
        const appLogoUrlInput = createField('Application Logo URL (e.g., a data URI or public URL)', 'text', localSettings.appLogoUrl || '', (val) => { localSettings.appLogoUrl = val; updatePreview(); });
        
        const previewDiv = document.createElement('div');
        previewDiv.style.marginTop = '1rem';
        const previewLabel = document.createElement('label');
        previewLabel.className = 'form-label';
        previewLabel.textContent = 'Navbar Preview';
        
        const previewContent = document.createElement('div');
        previewContent.id = 'admin-preview-content';
        previewContent.style.backgroundColor = '#1f2937';
        previewContent.style.padding = '1rem';
        previewContent.style.borderRadius = '0.5rem';
        previewContent.style.color = 'white';
        previewContent.style.fontSize = '1.5rem';
        previewContent.style.fontWeight = '700';
        previewContent.style.display = 'flex';
        previewContent.style.alignItems = 'center';
        previewContent.style.gap = '0.75rem';

        const updatePreview = () => {
             if (localSettings.appLogoUrl) {
                previewContent.innerHTML = `<img src="${localSettings.appLogoUrl}" alt="Logo Preview" class="navbar-logo-image"/> <span>${localSettings.appName || 'App'}</span>`;
            } else {
                previewContent.innerHTML = `<i class="fas fa-sync-alt"></i> <span>${localSettings.appName || 'App'}</span>`;
            }
        };
        
        previewDiv.append(previewLabel, previewContent);
        
        brandingFieldset.append(appNameInput, appLogoUrlInput, previewDiv);
        form.appendChild(brandingFieldset);

        // --- Work Log Tasks Section ---
        const tasksFieldset = document.createElement('fieldset');
        tasksFieldset.className = 'pilot-details-fieldset';
        tasksFieldset.innerHTML = `<legend class="pilot-details-legend">Work Log Task Types</legend>`;
        
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
                    children: '<i class="fas fa-trash"></i>',
                    variant: 'danger',
                    size: 'sm',
                    onClick: () => {
                        localSettings.workLogTasks.splice(index, 1);
                        rerender();
                    }
                });
                taskItem.append(taskText, deleteBtn);
                tasksList.appendChild(taskItem);
            });
        }
        
        tasksFieldset.appendChild(tasksList);
        
        let newTask = '';
        const addTaskContainer = document.createElement('div');
        addTaskContainer.className = 'project-form-tags-input-container'; // Reuse style
        const addTaskInput = document.createElement('input');
        addTaskInput.type = 'text';
        addTaskInput.className = 'form-input';
        addTaskInput.placeholder = 'Add new task type...';
        addTaskInput.oninput = (e) => { newTask = e.target.value; };
        addTaskInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addTaskBtn.click(); }};
        
        const addTaskBtn = Button({
            children: 'Add Task',
            size: 'sm',
            onClick: () => {
                if (newTask.trim()) {
                    if (!localSettings.workLogTasks) {
                        localSettings.workLogTasks = [];
                    }
                    localSettings.workLogTasks.push(newTask.trim());
                    newTask = '';
                    rerender();
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
        updatePreview(); // initial render of preview
    }
    
    function createField(labelText, type, value, onChange) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = labelText;
        
        const input = document.createElement('input');
        input.type = type;
        input.className = 'form-input';
        input.value = value;
        input.oninput = (e) => onChange(e.target.value);
        
        div.append(label, input);
        return div;
    }

    buildPage();
    container.appendChild(pageWrapper);
}
