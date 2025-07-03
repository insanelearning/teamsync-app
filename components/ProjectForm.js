
import { Button } from './Button.js';
import { PRIORITIES } from '../constants.js';
import { ProjectStatus } from '../types.js';

const getDefaultProject = () => ({
  name: '',
  description: '',
  status: ProjectStatus.ToDo,
  assignees: [],
  dueDate: new Date().toISOString().split('T')[0],
  priority: 'Medium',
  tags: [],
  clientName: '',
  teamLeadId: '',
  projectType: '',
  projectCategory: '',
  goals: [],
});

const CAMPAIGN_METRIC_GOAL = 'Email Campaign Metrics';
const CAMPAIGN_FIELDS = ['Delivered', 'Undelivered', 'Total Sent', 'HubSpot Leads', 'To be Sent'];


export function ProjectForm({ project, teamMembers, projectStatuses, onSave, onCancel }) {
  let formData = project 
    ? { ...getDefaultProject(), ...project, assignees: project.assignees || [], tags: project.tags || [], goals: project.goals || [] } 
    : { ...getDefaultProject(), id: undefined, createdAt: undefined, updatedAt: undefined };
  
  let campaignFormData = {};
  const campaignGoal = formData.goals.find(g => g.name === CAMPAIGN_METRIC_GOAL);
  if (campaignGoal) {
    CAMPAIGN_FIELDS.forEach(field => {
        const metric = campaignGoal.metrics.find(m => m.fieldName === field);
        campaignFormData[field] = metric ? metric.fieldValue : 0;
    });
  } else {
    CAMPAIGN_FIELDS.forEach(field => campaignFormData[field] = 0);
  }

  let currentTag = '';

  const form = document.createElement('form');
  form.className = 'project-form'; // Main class for form styling

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
    }
    input.id = name;
    input.name = name;
    if (required) input.required = true;
    
    if (inputType !== 'select' || (inputType === 'select' && !options.multiple)) {
         input.value = value || '';
    }

    input.addEventListener('change', (e) => {
      if (inputType === 'select' && options.multiple) {
        formData[name] = Array.from(e.target.selectedOptions).map(opt => opt.value);
        if (name === 'assignees') { 
            formData.goals = (formData.goals || []).map(goal => ({
              ...goal,
              metrics: (goal.metrics || []).filter(metric => !metric.memberId || formData.assignees.includes(metric.memberId))
            }));
            renderGoalsAndMetrics(); 
        }
      } else {
        formData[name] = e.target.value;
      }
    });
    div.appendChild(input);
    return div;
  }
  
  form.appendChild(createField('Project Name', 'text', 'name', formData.name, {}, true));
  form.appendChild(createField('Description', 'textarea', 'description', formData.description));

  const clientStatusGrid = document.createElement('div');
  clientStatusGrid.className = 'form-grid-cols-2';
  clientStatusGrid.appendChild(createField('Client Name', 'text', 'clientName', formData.clientName));
  clientStatusGrid.appendChild(createField('Status', 'select', 'status', formData.status, {
    options: projectStatuses.map(s => ({ value: s, label: s }))
  }, true));
  form.appendChild(clientStatusGrid);

  const assigneesLeadGrid = document.createElement('div');
  assigneesLeadGrid.className = 'form-grid-cols-2';
  assigneesLeadGrid.appendChild(createField('Assignees (Ctrl/Cmd + Click)', 'select', 'assignees', formData.assignees, {
    multiple: true,
    options: teamMembers.map(m => ({ value: m.id, label: m.name })),
  }));
  assigneesLeadGrid.appendChild(createField('Team Lead', 'select', 'teamLeadId', formData.teamLeadId, {
    options: [{ value: '', label: 'None' }, ...teamMembers.map(m => ({ value: m.id, label: m.name }))]
  }));
  form.appendChild(assigneesLeadGrid);

  const typeCategoryGrid = document.createElement('div');
  typeCategoryGrid.className = 'form-grid-cols-2';
  typeCategoryGrid.appendChild(createField('Project Type', 'text', 'projectType', formData.projectType, {}, false, 'e.g., Client Project, Internal'));
  const categoryField = createField('Project Category', 'text', 'projectCategory', formData.projectCategory, {}, false, 'e.g., Email Campaign');
  typeCategoryGrid.appendChild(categoryField);
  form.appendChild(typeCategoryGrid);
  
  const datePriorityGrid = document.createElement('div');
  datePriorityGrid.className = 'form-grid-cols-2';
  datePriorityGrid.appendChild(createField('Due Date', 'date', 'dueDate', formData.dueDate, {}, true));
  datePriorityGrid.appendChild(createField('Priority', 'select', 'priority', formData.priority, {
    options: PRIORITIES.map(p => ({ value: p, label: p }))
  }));
  form.appendChild(datePriorityGrid);

  // Email Campaign Stats Section
  const campaignStatsContainer = document.createElement('div');
  campaignStatsContainer.className = 'campaign-stats-container';
  form.appendChild(campaignStatsContainer);

  const renderCampaignStatsUI = () => {
      campaignStatsContainer.innerHTML = '';
      const isCampaign = formData.projectCategory?.trim().toLowerCase() === 'email campaign';
      campaignStatsContainer.style.display = isCampaign ? 'block' : 'none';

      if (!isCampaign) return;

      const fieldset = document.createElement('fieldset');
      fieldset.className = 'goal-fieldset';
      const legend = document.createElement('legend');
      legend.className = 'goal-legend';
      legend.innerHTML = '<i class="fas fa-chart-line" style="margin-right: 0.5rem;"></i> Email Campaign Stats';
      fieldset.appendChild(legend);

      const grid = document.createElement('div');
      grid.className = 'campaign-stats-grid';
      CAMPAIGN_FIELDS.forEach(fieldName => {
          const field = createField(fieldName, 'number', fieldName, campaignFormData[fieldName] || 0);
          field.querySelector('input').min = 0;
          field.querySelector('input').addEventListener('change', e => {
              campaignFormData[fieldName] = e.target.value;
          });
          grid.appendChild(field);
      });
      fieldset.appendChild(grid);
      campaignStatsContainer.appendChild(fieldset);
  };
  
  categoryField.querySelector('input').addEventListener('input', (e) => {
      formData.projectCategory = e.target.value;
      renderCampaignStatsUI();
  });
  renderCampaignStatsUI();


  // Tags Section
  const tagsSectionDiv = document.createElement('div');
  const tagsLabel = document.createElement('label');
  tagsLabel.className = 'form-label';
  tagsLabel.textContent = 'Tags';
  tagsSectionDiv.appendChild(tagsLabel);
  const tagInputContainer = document.createElement('div');
  tagInputContainer.className = 'project-form-tags-input-container';
  const tagInput = document.createElement('input');
  tagInput.type = 'text';
  tagInput.className = 'form-input'; // flex-grow handled by container if needed
  tagInput.placeholder = 'Add a tag';
  tagInput.addEventListener('input', (e) => currentTag = e.target.value);
  tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          addTagButton.click();
      }
  });
  const addTagButton = Button({
    children: 'Add', variant: 'secondary', size: 'sm', ariaLabel: 'Add Tag',
    onClick: () => {
      if (currentTag && !(formData.tags || []).includes(currentTag)) {
        formData.tags = [...(formData.tags || []), currentTag];
        currentTag = ''; tagInput.value = ''; renderTags();
      }
    }
  });
  tagInputContainer.append(tagInput, addTagButton);
  tagsSectionDiv.appendChild(tagInputContainer);
  const tagsDisplayDiv = document.createElement('div');
  tagsDisplayDiv.className = 'project-form-tags-display';
  tagsSectionDiv.appendChild(tagsDisplayDiv);
  form.appendChild(tagsSectionDiv);

  function renderTags() {
    tagsDisplayDiv.innerHTML = '';
    (formData.tags || []).forEach(tag => {
      const span = document.createElement('span');
      span.className = 'project-form-tag-item';
      span.textContent = tag;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'project-form-tag-remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
      removeBtn.onclick = () => { formData.tags = formData.tags.filter(t => t !== tag); renderTags(); };
      span.appendChild(removeBtn);
      tagsDisplayDiv.appendChild(span);
    });
  }
  renderTags();

  // Project Goals Section
  const goalsContainer = document.createElement('div');
  goalsContainer.className = "project-form-goals-container";

  const goalsHeaderDiv = document.createElement('div');
  goalsHeaderDiv.className = "project-form-goals-header";
  
  const goalsTitle = document.createElement('h4');
  goalsTitle.className = "project-form-goals-title";
  goalsTitle.textContent = "Advanced Goals & Metrics";
  goalsHeaderDiv.appendChild(goalsTitle);
  
  const addGoalButton = Button({
      children: 'Add Goal', variant: 'success', size: 'sm', leftIcon: '<i class="fas fa-bullseye"></i>',
      onClick: () => {
          formData.goals = [...(formData.goals || []), { id: crypto.randomUUID(), name: `New Goal ${(formData.goals || []).length + 1}`, metrics: [] }];
          renderGoalsAndMetrics();
      }
  });
  goalsHeaderDiv.appendChild(addGoalButton);
  goalsContainer.appendChild(goalsHeaderDiv);
  
  const goalsListDiv = document.createElement('div');
  goalsListDiv.className = "project-form-goals-list";
  goalsContainer.appendChild(goalsListDiv);
  form.appendChild(goalsContainer);

  function renderGoalsAndMetrics() {
    goalsListDiv.innerHTML = '';
    const availableAssigneesForMetrics = teamMembers.filter(tm => (formData.assignees || []).includes(tm.id));

    const standardGoals = (formData.goals || []).filter(g => g.name !== CAMPAIGN_METRIC_GOAL);

    if (standardGoals.length === 0) {
        goalsListDiv.innerHTML = `<p class="project-form-goals-list-placeholder">No advanced goals defined. Click "Add Goal" to get started.</p>`;
    }

    standardGoals.forEach((goal, goalIndex) => {
        const goalFieldset = document.createElement('fieldset');
        goalFieldset.className = 'goal-fieldset';

        const legend = document.createElement('legend');
        legend.className = 'goal-legend';

        const goalNameInput = document.createElement('input');
        goalNameInput.type = 'text';
        goalNameInput.className = 'form-input goal-name-input';
        goalNameInput.value = goal.name;
        goalNameInput.placeholder = 'Goal Name (e.g., Lead Generation)';
        goalNameInput.onchange = (e) => goal.name = e.target.value;
        
        const goalActions = document.createElement('div');
        goalActions.className = 'goal-actions';

        const addMetricButton = Button({
            children: 'Add Metric', variant: 'secondary', size: 'sm',
            leftIcon: '<i class="fas fa-plus" style="font-size: 0.75rem;"></i>',
            onClick: () => {
                goal.metrics = [...(goal.metrics || []), { id: crypto.randomUUID(), fieldName: '', fieldValue: '', targetValue: '', memberId: '' }];
                renderGoalsAndMetrics();
            }
        });
        
        const deleteGoalButton = Button({
            children: '<i class="fas fa-trash"></i>', variant: 'danger', size: 'sm', ariaLabel: 'Delete Goal',
            onClick: () => {
                if (confirm(`Are you sure you want to delete the goal "${goal.name}" and all its metrics?`)) {
                    formData.goals.splice(goalIndex, 1);
                    renderGoalsAndMetrics();
                }
            }
        });

        goalActions.append(addMetricButton, deleteGoalButton);
        legend.append(goalNameInput, goalActions);
        goalFieldset.appendChild(legend);

        if (!goal.metrics || goal.metrics.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.className = 'project-form-custom-fields-list-placeholder';
            placeholder.textContent = 'No metrics for this goal. Click "Add Metric".';
            goalFieldset.appendChild(placeholder);
        } else {
            const table = document.createElement('table');
            table.className = 'data-table custom-fields-table-editor';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Metric Name</th>
                        <th>Track for Member</th>
                        <th>Current Value</th>
                        <th>Target Value</th>
                        <th class="action-cell">Action</th>
                    </tr>
                </thead>`;
            
            const tbody = document.createElement('tbody');
            (goal.metrics || []).forEach((metric, metricIndex) => {
                const tr = document.createElement('tr');
                
                const tdName = document.createElement('td');
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'form-input';
                nameInput.placeholder = 'e.g., Leads Generated';
                nameInput.value = metric.fieldName;
                nameInput.required = true;
                nameInput.onchange = (e) => metric.fieldName = e.target.value;
                tdName.appendChild(nameInput);
                tr.appendChild(tdName);

                const tdAssignee = document.createElement('td');
                const assigneeSelect = document.createElement('select');
                assigneeSelect.className = 'form-select';
                assigneeSelect.innerHTML = `<option value="">Project-Level</option>` + availableAssigneesForMetrics.map(m => `<option value="${m.id}" ${metric.memberId === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
                assigneeSelect.disabled = availableAssigneesForMetrics.length === 0;
                assigneeSelect.onchange = (e) => metric.memberId = e.target.value;
                tdAssignee.appendChild(assigneeSelect);
                tr.appendChild(tdAssignee);

                const tdValue = document.createElement('td');
                const valueInput = document.createElement('input');
                valueInput.type = 'text';
                valueInput.className = 'form-input';
                valueInput.placeholder = 'e.g., 25';
                valueInput.value = metric.fieldValue;
                valueInput.required = true;
                valueInput.onchange = (e) => metric.fieldValue = e.target.value;
                tdValue.appendChild(valueInput);
                tr.appendChild(tdValue);

                const tdTarget = document.createElement('td');
                const targetInput = document.createElement('input');
                targetInput.type = 'text';
                targetInput.className = 'form-input';
                targetInput.placeholder = 'e.g., 100';
                targetInput.value = metric.targetValue || '';
                targetInput.onchange = (e) => metric.targetValue = e.target.value;
                tdTarget.appendChild(targetInput);
                tr.appendChild(tdTarget);

                const tdAction = document.createElement('td');
                tdAction.className = 'action-cell';
                const removeMetricButton = Button({
                    variant: 'ghost', size: 'sm', className: 'team-member-action-btn-delete',
                    children: '<i class="fas fa-trash-alt"></i>', ariaLabel: `Remove metric ${metric.fieldName}`,
                    onClick: () => { goal.metrics.splice(metricIndex, 1); renderGoalsAndMetrics(); }
                });
                tdAction.appendChild(removeMetricButton);
                tr.appendChild(tdAction);

                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            goalFieldset.appendChild(table);
        }
        goalsListDiv.appendChild(goalFieldset);
    });
  }
  renderGoalsAndMetrics();

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'project-form-actions';
  const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
  const saveButton = Button({ children: project ? 'Save Changes' : 'Create Project', variant: 'primary', type: 'submit' });
  actionsDiv.append(cancelButton, saveButton);
  form.appendChild(actionsDiv);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const projectToSave = {
      ...formData,
      id: project?.id || crypto.randomUUID(),
      createdAt: project?.createdAt || now,
      updatedAt: now,
    };

    // Filter out the old campaign goal to avoid duplicates before we add the new/updated one.
    projectToSave.goals = projectToSave.goals.filter(g => g.name !== CAMPAIGN_METRIC_GOAL);

    if (formData.projectCategory?.trim().toLowerCase() === 'email campaign') {
        const campaignMetrics = Object.entries(campaignFormData).map(([fieldName, fieldValue]) => ({
            id: crypto.randomUUID(),
            fieldName,
            fieldValue: String(fieldValue || 0),
        }));
        
        projectToSave.goals.push({
            id: crypto.randomUUID(),
            name: CAMPAIGN_METRIC_GOAL,
            metrics: campaignMetrics,
        });
    }

    onSave(projectToSave);
  });

  return form;
}
