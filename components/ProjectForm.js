
import { Button } from './Button.js';
import { PRIORITIES } from '../constants.js';
import { ProjectStatus } from '../types.js';

const getDefaultProject = (appSettings) => ({
  name: '',
  description: '',
  status: ProjectStatus.ToDo,
  assignees: [],
  dueDate: new Date().toISOString().split('T')[0],
  priority: appSettings?.defaultProjectPriority || 'Medium',
  tags: [],
  stakeholderName: '',
  teamLeadId: '',
  projectType: '',
  projectCategory: '',
  goals: [],
  mediaProduct: '',
  pilotScope: '',
  clientNames: '',
  projectApproach: '',
  deliverables: '',
  resultsAchieved: '',
  completionPercentage: 0,
});

/**
 * Updates the calculated fields for an email campaign goal without a full re-render.
 * @param {HTMLElement} fieldset The fieldset element containing the campaign inputs.
 */
function updateCampaignCalculations(fieldset) {
    const getValue = (metricName) => {
        const input = fieldset.querySelector(`input[data-metric-name="${metricName}"]`);
        return input ? Number(input.value) || 0 : 0;
    };

    const totalProspects = getValue('Total Prospects');
    const delivered = getValue('Delivered');
    const undelivered = getValue('Undelivered');
    const leadConversions = getValue('Lead Conversions');

    const totalSent = delivered + undelivered;
    const conversionRate = delivered > 0 ? ((leadConversions / delivered) * 100).toFixed(2) : 0;
    const toBeSent = totalProspects - totalSent;

    const setValue = (metricName, value) => {
        const span = fieldset.querySelector(`span[data-metric-name="${metricName}"]`);
        if (span) span.textContent = value;
    };

    setValue('Total Sent', totalSent.toLocaleString());
    setValue('Conversion Rate', `${conversionRate}%`);
    setValue('To Be Sent', toBeSent.toLocaleString());
}


export function ProjectForm({ project, teamMembers, projectStatuses, onSave, onCancel, appSettings }) {
  let formData = project 
    ? { ...getDefaultProject(appSettings), ...project, assignees: project.assignees || [], tags: project.tags || [], goals: project.goals || [] } 
    : { ...getDefaultProject(appSettings), id: undefined, createdAt: undefined, updatedAt: undefined };
  
  // Data migration: Rename 'Total Leads' to 'Total Prospects' for older projects
  if (formData.goals) {
    formData.goals.forEach(goal => {
        if (goal.name && goal.name.trim().toLowerCase() === 'email campaign') {
            const totalLeadsMetric = (goal.metrics || []).find(m => m.fieldName === 'Total Leads');
            if (totalLeadsMetric) {
                totalLeadsMetric.fieldName = 'Total Prospects';
            }
        }
    });
  }

  let currentTag = '';

  const form = document.createElement('form');
  form.className = 'project-form'; // Main class for form styling

  function rerender() {
      // Basic re-render by rebuilding the whole form.
      // A more complex implementation might target specific sections.
      const focusedElementId = document.activeElement.id;
      const focusedElementSelectionStart = document.activeElement.selectionStart;

      form.innerHTML = '';
      buildForm();

      if (focusedElementId) {
          const focusedElement = document.getElementById(focusedElementId);
          if (focusedElement) {
              focusedElement.focus();
              if (typeof focusedElementSelectionStart === 'number') {
                  focusedElement.selectionStart = focusedElementSelectionStart;
                  focusedElement.selectionEnd = focusedElementSelectionStart;
              }
          }
      }
  }

  function createField(labelText, inputType, name, value, options = {}, required = false, placeholder = '') {
    const div = document.createElement('div'); // Wrapper for label + input
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = name;
    label.textContent = labelText + (required ? '*' : '');
    div.appendChild(label);

    let input;
    if (inputType === 'textarea') {
      input = document.createElement('textarea');
      input.rows = options.rows || 3;
      input.className = 'form-input';
    } else if (inputType === 'select') {
      input = document.createElement('select');
      input.className = 'form-select';
      if (options.multiple) {
        input.multiple = true;
        input.classList.add('form-select-multiple'); // For height
      }
      (options.options || []).forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        if (Array.isArray(value) && value.includes(opt.value)) {
            optionEl.selected = true;
        } else if (value === opt.value) {
            optionEl.selected = true;
        }
        input.appendChild(optionEl);
      });
    } else {
      input = document.createElement('input');
      input.type = inputType;
      input.className = 'form-input';
      if (placeholder) input.placeholder = placeholder;
      if (inputType === 'number') {
        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        if (options.step !== undefined) input.step = options.step;
      }
    }
    input.id = name;
    input.name = name;
    if (required) input.required = true;
    
    if (inputType !== 'select' || (inputType === 'select' && !options.multiple)) {
         input.value = value || '';
    }

    input.addEventListener('input', (e) => {
      let val = e.target.value;
      if (inputType === 'select' && options.multiple) {
        val = Array.from(e.target.selectedOptions).map(opt => opt.value);
      }
      formData[name] = val;
    });
    div.appendChild(input);
    return div;
  }
  
  function buildForm() {
    // --- Core Details ---
    form.appendChild(createField('Project Name', 'text', 'name', formData.name, {}, true, 'Enter project name'));
    form.appendChild(createField('Description', 'textarea', 'description', formData.description, { rows: 4 }));

    // --- Scheduling & Status ---
    const statusGrid = document.createElement('div');
    statusGrid.className = "form-grid-cols-2";
    
    statusGrid.appendChild(createField('Status', 'select', 'status', formData.status, {
      options: projectStatuses.map(s => ({ value: s, label: s }))
    }, true));
    statusGrid.appendChild(createField('Due Date', 'date', 'dueDate', formData.dueDate, {}, true));
    
    form.appendChild(statusGrid);

    const priorityGrid = document.createElement('div');
    priorityGrid.className = "form-grid-cols-2";

    priorityGrid.appendChild(createField('Priority', 'select', 'priority', formData.priority, {
        options: PRIORITIES.map(p => ({ value: p, label: p }))
    }));
    priorityGrid.appendChild(createField('Completion Percentage', 'number', 'completionPercentage', formData.completionPercentage, { min: 0, max: 100, step: 1 }));

    form.appendChild(priorityGrid);

    // --- Team ---
    const teamGrid = document.createElement('div');
    teamGrid.className = "form-grid-cols-2";

    teamGrid.appendChild(createField('Assignees', 'select', 'assignees', formData.assignees, {
        multiple: true,
        options: teamMembers.map(m => ({ value: m.id, label: m.name }))
    }));
    teamGrid.appendChild(createField('Team Lead', 'select', 'teamLeadId', formData.teamLeadId, {
        options: [{ value: '', label: 'None' }, ...teamMembers.map(m => ({ value: m.id, label: m.name }))]
    }));
    
    form.appendChild(teamGrid);
    
    // --- Categorization ---
    const categoryGrid = document.createElement('div');
    categoryGrid.className = "form-grid-cols-3";
    categoryGrid.appendChild(createField('Stakeholder Name', 'text', 'stakeholderName', formData.stakeholderName));
    categoryGrid.appendChild(createField('Project Type', 'text', 'projectType', formData.projectType));
    categoryGrid.appendChild(createField('Project Category', 'text', 'projectCategory', formData.projectCategory));
    
    form.appendChild(categoryGrid);
    
    // --- Tags ---
    const tagsSectionDiv = document.createElement('div');
    const tagsLabel = document.createElement('label');
    tagsLabel.className = 'form-label';
    tagsLabel.textContent = 'Tags';
    tagsSectionDiv.appendChild(tagsLabel);
    const tagInputContainer = document.createElement('div');
    tagInputContainer.className = 'form-tags-container';
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'form-input';
    tagInput.placeholder = 'Add a tag and press Enter';
    
    const tagsDisplayDiv = document.createElement('div');
    tagsDisplayDiv.className = 'form-tags-display';

    const renderTags = () => {
        tagsDisplayDiv.innerHTML = '';
        (formData.tags || []).forEach(tag => {
            const span = document.createElement('span');
            span.className = 'form-tag-item';
            span.textContent = tag;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'form-tag-remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
            removeBtn.onclick = () => { formData.tags = formData.tags.filter(t => t !== tag); renderTags(); };
            span.appendChild(removeBtn);
            tagsDisplayDiv.appendChild(span);
        });
    };
    
    const addTagButton = Button({
      children: 'Add', variant: 'secondary', size: 'sm', ariaLabel: 'Add Tag',
      onClick: () => {
        const trimmedTag = tagInput.value.trim();
        if (trimmedTag && !(formData.tags || []).includes(trimmedTag)) {
          formData.tags = [...(formData.tags || []), trimmedTag];
          tagInput.value = '';
          renderTags();
        }
        tagInput.focus();
      }
    });

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTagButton.click();
        }
    });

    tagInputContainer.append(tagInput, addTagButton);
    tagsSectionDiv.appendChild(tagInputContainer);
    tagsSectionDiv.appendChild(tagsDisplayDiv);
    form.appendChild(tagsSectionDiv);
    renderTags();

    // --- Pilot-Specific Details Fieldset ---
    const pilotFieldset = document.createElement('fieldset');
    pilotFieldset.className = 'pilot-details-fieldset';
    const pilotLegend = document.createElement('legend');
    pilotLegend.className = 'pilot-details-legend';
    pilotLegend.textContent = 'Pilot-Specific Details';
    pilotFieldset.appendChild(pilotLegend);
    pilotFieldset.appendChild(createField('Media Product', 'text', 'mediaProduct', formData.mediaProduct));
    pilotFieldset.appendChild(createField('Client Names', 'text', 'clientNames', formData.clientNames));
    pilotFieldset.appendChild(createField('Pilot Scope', 'textarea', 'pilotScope', formData.pilotScope, { rows: 2 }));
    pilotFieldset.appendChild(createField('Project Approach', 'textarea', 'projectApproach', formData.projectApproach, { rows: 2 }));
    pilotFieldset.appendChild(createField('Deliverables', 'textarea', 'deliverables', formData.deliverables, { rows: 2 }));
    pilotFieldset.appendChild(createField('Results Achieved', 'textarea', 'resultsAchieved', formData.resultsAchieved, { rows: 2 }));
    form.appendChild(pilotFieldset);
    
    // --- Project Goals Fieldset ---
    form.appendChild(createGoalsSection());
    
    // --- Actions ---
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'project-form-actions';
    const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
    const saveButton = Button({ children: project ? 'Save Changes' : 'Create Project', variant: 'primary', type: 'submit' });
    actionsDiv.append(cancelButton, saveButton);
    form.appendChild(actionsDiv);
  }
  
  function createGoalsSection() {
    const goalsContainer = document.createElement('fieldset');
    goalsContainer.className = 'project-form-goals-container';
    
    const goalsHeader = document.createElement('div');
    goalsHeader.className = 'project-form-goals-header';
    
    const legend = document.createElement('legend');
    legend.className = 'project-form-goals-title';
    legend.textContent = 'Project Goals';
    goalsHeader.appendChild(legend);

    const addGoalButtons = document.createElement('div');
    addGoalButtons.className = 'page-header-actions';
    addGoalButtons.append(
        Button({
            children: 'Add Custom Goal', size: 'sm', variant: 'secondary', leftIcon: '<i class="fas fa-bullseye"></i>',
            onClick: () => {
                formData.goals.push({ id: crypto.randomUUID(), name: 'New Goal', metrics: [], completed: false });
                rerender();
            }
        }),
        Button({
            children: 'Add Email Campaign Goal', size: 'sm', variant: 'secondary', leftIcon: '<i class="fas fa-envelope"></i>',
            onClick: () => {
                if (formData.goals.some(g => g.name?.trim().toLowerCase() === 'email campaign')) {
                    alert('An Email Campaign goal already exists for this project.');
                    return;
                }
                formData.goals.push({
                    id: crypto.randomUUID(), name: 'Email Campaign',
                    metrics: [
                        { fieldName: 'Client Name', fieldValue: '' },
                        { fieldName: 'Total Prospects', fieldValue: 0 },
                        { fieldName: 'Delivered', fieldValue: 0 },
                        { fieldName: 'Undelivered', fieldValue: 0 },
                        { fieldName: 'Lead Conversions', fieldValue: 0 },
                    ],
                    completed: false
                });
                rerender();
            }
        })
    );
    goalsHeader.appendChild(addGoalButtons);
    goalsContainer.appendChild(goalsHeader);
    
    const goalsList = document.createElement('div');
    goalsList.className = 'project-form-goals-list';

    if (!formData.goals || formData.goals.length === 0) {
        goalsList.innerHTML = `<p class="project-form-goals-list-placeholder">No goals defined for this project.</p>`;
    } else {
        formData.goals.forEach((goal, goalIndex) => {
            if (goal.name?.trim().toLowerCase() === 'email campaign') {
                goalsList.appendChild(createEmailCampaignGoalFieldset(goal, goalIndex));
            } else {
                goalsList.appendChild(createCustomGoalFieldset(goal, goalIndex));
            }
        });
    }
    goalsContainer.appendChild(goalsList);
    return goalsContainer;
  }

  function createEmailCampaignGoalFieldset(goal, goalIndex) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'goal-fieldset';
    const legend = document.createElement('legend');
    legend.className = 'goal-legend';
    legend.innerHTML = `<span><i class="fas fa-envelope"></i> Email Campaign</span>`;
    
    const getMetricValue = (name, isNumber = true) => {
        let metric = (goal.metrics || []).find(m => m.fieldName === name);
        if (!metric && name === 'Total Prospects') metric = goal.metrics.find(m => m.fieldName === 'Total Leads');
        if (!metric) return isNumber ? 0 : '';
        return isNumber ? Number(metric.fieldValue) || 0 : metric.fieldValue;
    };

    const updateMetricValue = (name, value) => {
        let metric = (goal.metrics || []).find(m => m.fieldName === name);
        if (!metric && name === 'Total Prospects') metric = goal.metrics.find(m => m.fieldName === 'Total Leads');
        if (metric) {
            metric.fieldName = name; // Ensure old 'Total Leads' gets renamed
            metric.fieldValue = value;
        } else {
            goal.metrics.push({ fieldName: name, fieldValue: value });
        }
        updateCampaignCalculations(fieldset);
    };

    const metaDiv = document.createElement('div');
    metaDiv.className = 'goal-meta';
    
    const completedToggle = document.createElement('label');
    completedToggle.className = 'goal-completed-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = goal.completed;
    checkbox.onchange = (e) => formData.goals[goalIndex].completed = e.target.checked;
    completedToggle.append(checkbox, 'Completed');
    metaDiv.appendChild(completedToggle);

    const removeBtn = Button({ variant: 'danger', size: 'sm', children: '<i class="fas fa-trash"></i>', onClick: () => { formData.goals.splice(goalIndex, 1); rerender(); } });
    metaDiv.appendChild(removeBtn);

    legend.appendChild(metaDiv);
    fieldset.appendChild(legend);

    const inputsGrid = document.createElement('div');
    inputsGrid.className = 'email-campaign-grid';
    
    const createCampaignField = (label, metricName, type = 'number') => {
        const isNumber = type === 'number';
        const div = document.createElement('div');
        div.innerHTML = `<label class="form-label">${label}</label>`;
        const input = document.createElement('input');
        input.type = type;
        input.className = 'form-input';
        input.dataset.metricName = metricName; // For updateCampaignCalculations
        input.value = getMetricValue(metricName, isNumber);
        input.oninput = (e) => updateMetricValue(metricName, e.target.value);
        div.appendChild(input);
        return div;
    };
    
    inputsGrid.append(
        createCampaignField('Client Name', 'Client Name', 'text'),
        createCampaignField('Total Prospects', 'Total Prospects'),
        createCampaignField('Delivered', 'Delivered'),
        createCampaignField('Undelivered', 'Undelivered'),
        createCampaignField('Lead Conversions', 'Lead Conversions')
    );
    fieldset.appendChild(inputsGrid);

    const calculationsGrid = document.createElement('div');
    calculationsGrid.className = 'email-campaign-grid';
    const createCalculatedField = (label, metricName, initialValue) => {
        const div = document.createElement('div');
        div.className = 'calculated-field';
        div.innerHTML = `<label class="form-label">${label}</label><span class="calculated-value" data-metric-name="${metricName}">${initialValue}</span>`;
        return div;
    };

    calculationsGrid.append(
        createCalculatedField('Total Sent', 'Total Sent', '0'),
        createCalculatedField('Conversion Rate', 'Conversion Rate', '0%'),
        createCalculatedField('To Be Sent', 'To Be Sent', '0')
    );
    fieldset.appendChild(calculationsGrid);

    setTimeout(() => updateCampaignCalculations(fieldset), 0);
    return fieldset;
  }

  function createCustomGoalFieldset(goal, goalIndex) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'goal-fieldset';
    const legend = document.createElement('legend');
    legend.className = 'goal-legend';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'goal-name-input';
    nameInput.value = goal.name;
    nameInput.placeholder = 'Enter Goal Name';
    nameInput.oninput = (e) => formData.goals[goalIndex].name = e.target.value;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'goal-meta';
    
    const completedToggle = document.createElement('label');
    completedToggle.className = 'goal-completed-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = goal.completed;
    checkbox.onchange = (e) => formData.goals[goalIndex].completed = e.target.checked;
    completedToggle.append(checkbox, 'Completed');
    metaDiv.appendChild(completedToggle);

    const removeBtn = Button({ variant: 'danger', size: 'sm', children: '<i class="fas fa-trash"></i>', onClick: () => { formData.goals.splice(goalIndex, 1); rerender(); } });
    metaDiv.appendChild(removeBtn);

    legend.append(nameInput, metaDiv);
    fieldset.appendChild(legend);

    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container';
    const table = document.createElement('table');
    table.className = 'data-table custom-fields-table-editor';
    table.innerHTML = `<thead><tr><th>Metric Name</th><th>For</th><th>Progress</th><th>Target</th><th class="action-cell">Done</th><th class="action-cell"></th></tr></thead>`;
    const tbody = document.createElement('tbody');
    (goal.metrics || []).forEach((metric, metricIndex) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="form-input" value="${metric.fieldName || ''}" placeholder="e.g., Leads Generated"></td>
            <td><select class="form-select"><option value="">Project-Level</option>${teamMembers.map(m => `<option value="${m.id}" ${metric.memberId === m.id ? 'selected': ''}>${m.name}</option>`).join('')}</select></td>
            <td><input type="text" class="form-input" value="${metric.fieldValue || ''}" placeholder="Current Value"></td>
            <td><input type="text" class="form-input" value="${metric.targetValue || ''}" placeholder="Target Value"></td>
            <td class="action-cell"><input type="checkbox" ${metric.completed ? 'checked' : ''}></td>
        `;
        const actionCell = document.createElement('td');
        actionCell.className = 'action-cell';
        const removeMetricBtn = Button({ variant: 'danger', size: 'sm', children: '<i class="fas fa-trash"></i>', onClick: () => { formData.goals[goalIndex].metrics.splice(metricIndex, 1); rerender(); } });
        actionCell.appendChild(removeMetricBtn);
        tr.appendChild(actionCell);
        
        tr.querySelector('input[type="text"]').oninput = (e) => formData.goals[goalIndex].metrics[metricIndex].fieldName = e.target.value;
        tr.querySelector('select').onchange = (e) => formData.goals[goalIndex].metrics[metricIndex].memberId = e.target.value;
        tr.querySelectorAll('input[type="text"]')[1].oninput = (e) => formData.goals[goalIndex].metrics[metricIndex].fieldValue = e.target.value;
        tr.querySelectorAll('input[type="text"]')[2].oninput = (e) => formData.goals[goalIndex].metrics[metricIndex].targetValue = e.target.value;
        tr.querySelector('input[type="checkbox"]').onchange = (e) => {
            formData.goals[goalIndex].metrics[metricIndex].completed = e.target.checked;
            if (e.target.checked) formData.goals[goalIndex].metrics[metricIndex].completionDate = new Date().toISOString();
        };

        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    if (!goal.metrics || goal.metrics.length === 0) {
        tableContainer.innerHTML = `<p class="project-form-custom-fields-list-placeholder">No metrics added for this goal.</p>`;
    }
    fieldset.appendChild(tableContainer);

    const addMetricButton = Button({
        children: 'Add Metric', variant: 'secondary', size: 'sm', leftIcon: '<i class="fas fa-plus"></i>',
        onClick: () => {
            if (!formData.goals[goalIndex].metrics) formData.goals[goalIndex].metrics = [];
            formData.goals[goalIndex].metrics.push({ fieldName: '', fieldValue: '', targetValue: '', completed: false });
            rerender();
        }
    });
    fieldset.appendChild(addMetricButton);

    return fieldset;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.dueDate) {
      alert("Project name and due date are required.");
      return;
    }
    const now = new Date().toISOString();
    const projectToSave = {
      ...formData,
      id: project?.id || crypto.randomUUID(),
      createdAt: project?.createdAt || now,
      updatedAt: now,
      completionPercentage: Number(formData.completionPercentage) || 0,
    };
    onSave(projectToSave);
  });
  
  buildForm(); // Initial build
  return form;
}
