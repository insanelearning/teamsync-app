import { Button } from '../components/Button.js';

export function renderSettingsPage(container, props) {
    const { settings, onUpdateSettings } = props;
    let localSettings = JSON.parse(JSON.stringify(settings)); // Deep copy to edit locally
    let newWorkLogTask = '';

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = "page-header";
    const headerTitle = document.createElement('h1');
    headerTitle.className = 'page-header-title';
    headerTitle.textContent = 'Application Settings';
    headerDiv.appendChild(headerTitle);
    pageWrapper.appendChild(headerDiv);

    // Settings Grid
    const settingsGrid = document.createElement('div');
    settingsGrid.className = 'settings-page-grid';

    // --- Work Log Tasks Card ---
    const workLogCard = document.createElement('div');
    workLogCard.className = 'settings-card';
    
    // Card Header
    const wlHeader = document.createElement('div');
    wlHeader.className = 'settings-card-header';
    wlHeader.innerHTML = '<h3>Work Log Tasks</h3>';
    workLogCard.appendChild(wlHeader);

    // Card Body
    const wlBody = document.createElement('div');
    wlBody.className = 'settings-card-body';
    
    const taskList = document.createElement('ul');
    taskList.className = 'settings-list';
    
    const renderTaskList = () => {
        taskList.innerHTML = '';
        if (localSettings.workLogTasks.length === 0) {
            taskList.innerHTML = `<li class="settings-list-item" style="justify-content: center;">No tasks defined.</li>`;
        }
        localSettings.workLogTasks.forEach((task, index) => {
            const item = document.createElement('li');
            item.className = 'settings-list-item';
            
            const taskName = document.createElement('span');
            taskName.textContent = task;
            
            const deleteBtn = Button({
                children: '<i class="fas fa-trash-alt"></i>',
                variant: 'danger',
                size: 'sm',
                onClick: () => {
                    localSettings.workLogTasks.splice(index, 1);
                    renderTaskList();
                }
            });
            
            item.append(taskName, deleteBtn);
            taskList.appendChild(item);
        });
    };
    
    const addTaskForm = document.createElement('div');
    addTaskForm.className = 'settings-add-item-form';
    const taskInput = document.createElement('input');
    taskInput.type = 'text';
    taskInput.className = 'form-input';
    taskInput.placeholder = 'New task name...';
    taskInput.oninput = (e) => newWorkLogTask = e.target.value;
    taskInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.click();
        }
    };
    const addBtn = Button({
        children: 'Add Task',
        variant: 'secondary',
        onClick: () => {
            if (newWorkLogTask.trim()) {
                localSettings.workLogTasks.push(newWorkLogTask.trim());
                newWorkLogTask = '';
                taskInput.value = '';
                renderTaskList();
            }
        }
    });
    addTaskForm.append(taskInput, addBtn);
    
    wlBody.append(taskList, addTaskForm);
    workLogCard.appendChild(wlBody);

    // Card Footer
    const wlFooter = document.createElement('div');
    wlFooter.className = 'settings-card-footer';
    const saveBtn = Button({
        children: 'Save Changes',
        variant: 'primary',
        onClick: () => {
            onUpdateSettings(localSettings);
            alert('Settings saved successfully!');
        }
    });
    wlFooter.appendChild(saveBtn);
    workLogCard.appendChild(wlFooter);

    settingsGrid.appendChild(workLogCard);
    
    // Placeholder for more settings cards
    const placeholderCard = document.createElement('div');
    placeholderCard.className = 'settings-card';
    placeholderCard.innerHTML = `
        <div class="settings-card-header"><h3>More Settings</h3></div>
        <div class="settings-card-body">
            <p class="no-data-placeholder" style="box-shadow: none; padding: 1rem;">More configurable options will be available here in the future.</p>
        </div>
    `;
    settingsGrid.appendChild(placeholderCard);


    pageWrapper.appendChild(settingsGrid);
    container.appendChild(pageWrapper);
    
    // Initial render of the list
    renderTaskList();
}
