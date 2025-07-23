
import { Button } from '../components/Button.js';

export function renderSettingsPage(container, props) {
    const { appSettings, onUpdateAppSettings } = props;
    
    let isSaving = false;
    let localSettings = {
        priorities: appSettings.priorities || [],
        workLogTasks: appSettings.workLogTasks || [],
    };

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // --- Header ---
    const headerDiv = document.createElement('div');
    headerDiv.className = "page-header";
    headerDiv.innerHTML = `<h1 class="page-header-title">Application Settings</h1>`;
    pageWrapper.appendChild(headerDiv);

    const form = document.createElement('form');
    form.className = 'settings-form';

    const createTextAreaList = (id, label, description, valueArray) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'settings-field';
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.className = 'form-label';
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);
        
        const descEl = document.createElement('p');
        descEl.className = 'settings-field-description';
        descEl.textContent = description;
        wrapper.appendChild(descEl);

        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.className = 'form-input';
        textarea.rows = 8;
        textarea.value = valueArray.join('\n');
        
        textarea.addEventListener('input', (e) => {
            const items = e.target.value.split('\n').map(item => item.trim()).filter(Boolean);
            localSettings[id] = items;
        });
        
        wrapper.appendChild(textarea);
        return wrapper;
    };
    
    const settingsGrid = document.createElement('div');
    settingsGrid.className = 'settings-grid';
    
    settingsGrid.appendChild(createTextAreaList(
        'priorities', 
        'Project Priorities', 
        'List of available priorities for projects. Enter one item per line.',
        localSettings.priorities
    ));

    settingsGrid.appendChild(createTextAreaList(
        'workLogTasks',
        'Work Log Tasks',
        'List of available tasks for work logs. Enter one item per line.',
        localSettings.workLogTasks
    ));

    form.appendChild(settingsGrid);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'settings-form-actions';
    const saveButton = Button({
        children: 'Save Settings',
        variant: 'primary',
        type: 'submit',
        leftIcon: '<i class="fas fa-save"></i>',
        isLoading: isSaving
    });
    actionsDiv.appendChild(saveButton);
    form.appendChild(actionsDiv);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        isSaving = true;
        // Re-render the button in a loading state
        const newSaveButton = Button({
            children: 'Save Settings', variant: 'primary', type: 'submit',
            leftIcon: '<i class="fas fa-save"></i>', isLoading: true
        });
        saveButton.replaceWith(newSaveButton);

        await onUpdateAppSettings(localSettings);
        isSaving = false;
        
        // After saving, re-enable the button
        const finalSaveButton = Button({
            children: 'Save Settings', variant: 'primary', type: 'submit',
            leftIcon: '<i class="fas fa-save"></i>', isLoading: false
        });
        newSaveButton.replaceWith(finalSaveButton);

        alert('Settings saved successfully!');
    });


    pageWrapper.appendChild(form);
    container.appendChild(pageWrapper);
}
