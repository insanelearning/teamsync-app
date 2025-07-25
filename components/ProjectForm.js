
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
      } else {
        formData[name] = e.target.value;
      }
    });
    div.appendChild(input);
    return div;
  }
  
  form.appendChild(createField('Project Name', 'text', 'name', formData.name, {}, true));
  form.appendChild(createField('Description', 'textarea', 'description', formData.description));

  const stakeholderStatusGrid = document.createElement('div');
  stakeholderStatusGrid.className = 'form-grid-cols-2';
  stakeholderStatusGrid.appendChild(createField('Stakeholder Name', 'text', 'stakeholderName', formData.stakeholderName));
  stakeholderStatusGrid.appendChild(createField('Status', 'select', 'status', formData.status, {
    options: projectStatuses.map(s => ({ value: s, label: s }))
  }, true));
  form.appendChild(stakeholderStatusGrid);

  const assigneesLeadGrid = document.createElement('div');
  assigneesLeadGrid.className = 'form-grid-cols-2';

  // --- New Assignee Selector ---
  function createAssigneeSelector(selectedAssignees) {
      let isOpen = false;
      let searchTerm = '';
      const container = document.createElement('div');
      container.className = 'assignee-select-container';

      const label = document.createElement('label');
      label.className = 'form-label';
      label.textContent = 'Assignees';
      container.appendChild(label);

      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'assignee-select-input';
      inputWrapper.tabIndex = 0;

      const pillsContainer = document.createElement('div');
      pillsContainer.className = 'flex flex-wrap gap-1';

      const dropdown = document.createElement('div');
      dropdown.className = 'assignee-select-dropdown';
      dropdown.style.display = 'none';

      const searchInput = document.createElement('div');
      searchInput.className = 'assignee-select-search';
      searchInput.innerHTML = `<input type="text" placeholder="Search members..." class="form-input">`;
      
      const list = document.createElement('ul');
      list.className = 'assignee-select-list';

      const closeDropdown = () => {
          isOpen = false;
          dropdown.style.display = 'none';
          document.removeEventListener('click', handleOutsideClick);
      };

      const openDropdown = () => {
          isOpen = true;
          dropdown.style.display = 'block';
          renderList();
          // Add listener on the next tick to avoid capturing the current click
          setTimeout(() => document.addEventListener('click', handleOutsideClick), 0);
      };

      const handleOutsideClick = (e) => {
          if (isOpen && !container.contains(e.target)) {
              closeDropdown();
          }
      };
      
      inputWrapper.addEventListener('click', (e) => {
          if (!isOpen) {
              openDropdown();
          }
      });
      
      const updatePills = () => {
          pillsContainer.innerHTML = '';
          selectedAssignees.forEach(id => {
              const member = teamMembers.find(m => m.id === id);
              if (!member) return;
              const pill = document.createElement('span');
              pill.className = 'assignee-select-pill';
              pill.textContent = member.name;
              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.className = 'assignee-select-pill-remove';
              removeBtn.innerHTML = '&times;';
              removeBtn.onclick = (e) => {
                  e.stopPropagation();
                  formData.assignees = formData.assignees.filter(assigneeId => assigneeId !== id);
                  selectedAssignees = formData.assignees;
                  updatePills();
                  renderList();
              };
              pill.appendChild(removeBtn);
              pillsContainer.appendChild(pill);
          });
          if (selectedAssignees.length === 0) {
              pillsContainer.innerHTML = `<span class="text-gray-400 text-sm py-1">Select members...</span>`;
          }
      };

      const filterList = () => {
        const items = list.querySelectorAll('.assignee-select-list-item');
        items.forEach(item => {
            const name = item.textContent.toLowerCase();
            if (name.includes(searchTerm.toLowerCase())) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
      };

      const renderList = () => {
          list.innerHTML = '';
          teamMembers.forEach(member => {
              const li = document.createElement('li');
              li.className = 'assignee-select-list-item';
              li.dataset.id = member.id;
              
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.checked = selectedAssignees.includes(member.id);
              
              li.innerHTML = `<span>${member.name}</span>`;
              li.prepend(checkbox);

              li.onclick = (e) => {
                  e.stopPropagation();
                  if (selectedAssignees.includes(member.id)) {
                      formData.assignees = selectedAssignees.filter(id => id !== member.id);
                  } else {
                      formData.assignees = [...selectedAssignees, member.id];
                  }
                  selectedAssignees = formData.assignees;
                  updatePills();
                  renderList();
                  // Re-filter metrics in goals if assignees change
                  formData.goals = (formData.goals || []).map(goal => ({
                    ...goal,
                    metrics: (goal.metrics || []).filter(metric => !metric.memberId || formData.assignees.includes(metric.memberId))
                  }));
                  renderGoalsAndMetrics(); 
              };
              list.appendChild(li);
          });
          filterList();
      };
      
      searchInput.querySelector('input').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        filterList();
      });
      
      dropdown.append(searchInput, list);
      inputWrapper.appendChild(pillsContainer);
      container.append(inputWrapper, dropdown);
      
      updatePills();
      
      return container;
  }

  assigneesLeadGrid.appendChild(createAssigneeSelector(formData.assignees));
  // --- End New Assignee Selector ---

  assigneesLeadGrid.appendChild(createField('Team Lead', 'select', 'teamLeadId', formData.teamLeadId, {
    options: [{ value: '', label: 'None' }, ...teamMembers.map(m => ({ value: m.id, label: m.name }))]
  }));
  form.appendChild(assigneesLeadGrid);

  const typeCategoryGrid = document.createElement('div');
  typeCategoryGrid.className = 'form-grid-cols-2';
  typeCategoryGrid.appendChild(createField('Project Type', 'text', 'projectType', formData.projectType, {}, false, 'e.g., Client Project, Internal'));
  const categoryField = createField('Project Category', 'text', 'projectCategory', formData.projectCategory, {}, false, 'e.g., Lead Generation');
  typeCategoryGrid.appendChild(categoryField);
  form.appendChild(typeCategoryGrid);
  
  const datePriorityGrid = document.createElement('div');
  datePriorityGrid.className = 'form-grid-cols-2';
  datePriorityGrid.appendChild(createField('Due Date', 'date', 'dueDate', formData.dueDate, {}, true));
  datePriorityGrid.appendChild(createField('Priority', 'select', 'priority', formData.priority, {
    options: PRIORITIES.map(p => ({ value: p, label: p }))
  }));
  form.appendChild(datePriorityGrid);


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
  
  // Pilot-Specific Details
  const pilotDetailsFieldset = document.createElement('fieldset');
  pilotDetailsFieldset.className = 'pilot-details-fieldset';
  const pilotLegend = document.createElement('legend');
  pilotLegend.className = 'pilot-details-legend';
  pilotLegend.textContent = 'Pilot-Specific Details';
  pilotDetailsFieldset.appendChild(pilotLegend);

  pilotDetailsFieldset.appendChild(createField('Media Product', 'text', 'mediaProduct', formData.mediaProduct, {}, false, 'e.g., Engage'));
  pilotDetailsFieldset.appendChild(createField('Client Names (if any)', 'text', 'clientNames', formData.clientNames, {}, false, 'e.g., TAV, Endress and HIAB'));
  pilotDetailsFieldset.appendChild(createField('Pilot Scope', 'textarea', 'pilotScope', formData.pilotScope, { rows: 4 }));
  pilotDetailsFieldset.appendChild(createField('Project Approach', 'textarea', 'projectApproach', formData.projectApproach, { rows: 4 }));
  pilotDetailsFieldset.appendChild(createField('Deliverables', 'textarea', 'deliverables', formData.deliverables, { rows: 3 }));
  pilotDetailsFieldset.appendChild(createField('Results Achieved', 'textarea', 'resultsAchieved', formData.resultsAchieved, { rows: 3 }));

  form.appendChild(pilotDetailsFieldset);


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
          formData.goals = [...(formData.goals || []), { id: crypto.randomUUID(), name: `New Goal ${(formData.goals || []).length + 1}`, metrics: [], completed: false }];
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

    if (!formData.goals || formData.goals.length === 0) {
        goalsListDiv.innerHTML = `<p class="project-form-goals-list-placeholder">No advanced goals defined. Click "Add Goal" to get started.</p>`;
    }

    (formData.goals || []).forEach((goal, goalIndex) => {
        const goalFieldset = document.createElement('fieldset');
        goalFieldset.className = 'goal-fieldset';

        const legend = document.createElement('legend');
        legend.className = 'goal-legend';
        
        const goalNameInput = document.createElement('input');
        goalNameInput.type = 'text';
        goalNameInput.className = 'form-input goal-name-input';
        goalNameInput.value = goal.name;
        goalNameInput.placeholder = 'Goal Name (e.g., Lead Generation)';
        goalNameInput.onchange = (e) => {
            goal.name = e.target.value;
            // If name is changed to 'Email Campaign' or back, re-render to show correct UI
            renderGoalsAndMetrics();
        };

        const goalMetaDiv = document.createElement('div');
        goalMetaDiv.className = 'goal-meta';

        const completedToggle = document.createElement('label');
        completedToggle.className = 'goal-completed-toggle';
        const completedCheckbox_Goal = document.createElement('input');
        completedCheckbox_Goal.type = 'checkbox';
        completedCheckbox_Goal.checked = !!goal.completed;
        completedCheckbox_Goal.onchange = (e) => {
            goal.completed = e.target.checked;
        };
        completedToggle.append(completedCheckbox_Goal, 'Completed');
        goalMetaDiv.appendChild(completedToggle);
        
        const goalActions = document.createElement('div');
        goalActions.className = 'goal-actions';

        if (goal.name.trim().toLowerCase() !== 'email campaign') {
            const addMetricButton = Button({
                children: 'Add Metric', variant: 'secondary', size: 'sm',
                leftIcon: '<i class="fas fa-plus" style="font-size: 0.75rem;"></i>',
                onClick: () => {
                    goal.metrics = [...(goal.metrics || []), { id: crypto.randomUUID(), fieldName: '', fieldValue: '', targetValue: '', memberId: '' }];
                    renderGoalsAndMetrics();
                }
            });
            goalActions.appendChild(addMetricButton);
        }
        
        const deleteGoalButton = Button({
            children: '<i class="fas fa-trash"></i>', variant: 'danger', size: 'sm', ariaLabel: 'Delete Goal',
            onClick: () => {
                if (confirm(`Are you sure you want to delete the goal "${goal.name}" and all its metrics?`)) {
                    formData.goals.splice(goalIndex, 1);
                    renderGoalsAndMetrics();
                }
            }
        });

        goalActions.append(deleteGoalButton);
        goalMetaDiv.appendChild(goalActions);
        legend.append(goalNameInput, goalMetaDiv);
        goalFieldset.appendChild(legend);

        if (goal.name.trim().toLowerCase() === 'email campaign') {
            const getMetric = (name) => (goal.metrics || []).find(m => m.fieldName === name);
            const updateMetric = (name, value) => {
                let metric = getMetric(name);
                if (metric) {
                    metric.fieldValue = value;
                } else {
                    goal.metrics.push({ id: crypto.randomUUID(), fieldName: name, fieldValue: value });
                }
            };
            
            const campaignGrid = document.createElement('div');
            campaignGrid.className = 'email-campaign-grid';
            
            const createCampaignField = (label, metricName, type, value, placeholder = '') => {
                const div = document.createElement('div');
                const labelEl = document.createElement('label');
                labelEl.className = 'form-label';
                labelEl.textContent = label;
                div.appendChild(labelEl);
                const input = document.createElement('input');
                input.type = type;
                input.className = 'form-input';
                input.dataset.metricName = metricName; // For selection
                input.value = value;
                if(type === 'number') input.min = 0;
                input.placeholder = placeholder;
                input.addEventListener('input', (e) => {
                    updateMetric(metricName, e.target.value);
                    if (type === 'number') {
                        updateCampaignCalculations(goalFieldset); // Update calculated fields, no re-render
                    }
                });
                div.appendChild(input);
                return div;
            };

            const createCalculatedField = (label, metricName, value) => {
                const div = document.createElement('div');
                div.className = 'calculated-field';
                const labelEl = document.createElement('label');
                labelEl.className = 'form-label';
                labelEl.textContent = label;
                const valueEl = document.createElement('span');
                valueEl.className = 'calculated-value';
                valueEl.dataset.metricName = metricName; // For selection
                valueEl.textContent = value;
                div.append(labelEl, valueEl);
                return div;
            };

            const clientName = getMetric('Client Name')?.fieldValue || '';
            const totalProspects = Number(getMetric('Total Prospects')?.fieldValue) || 0;
            const delivered = Number(getMetric('Delivered')?.fieldValue) || 0;
            const undelivered = Number(getMetric('Undelivered')?.fieldValue) || 0;
            const leadConversions = Number(getMetric('Lead Conversions')?.fieldValue) || 0;

            const totalSent = delivered + undelivered;
            const conversionRate = delivered > 0 ? ((leadConversions / delivered) * 100).toFixed(2) : 0;
            const toBeSent = totalProspects - totalSent;

            campaignGrid.appendChild(createCampaignField('Client Name', 'Client Name', 'text', clientName, 'Client Name'));
            campaignGrid.appendChild(createCampaignField('Total Prospects', 'Total Prospects', 'number', totalProspects));
            campaignGrid.appendChild(createCampaignField('Delivered', 'Delivered', 'number', delivered));
            campaignGrid.appendChild(createCampaignField('Undelivered', 'Undelivered', 'number', undelivered));
            campaignGrid.appendChild(createCampaignField('Lead Conversions', 'Lead Conversions', 'number', leadConversions));
            campaignGrid.appendChild(createCalculatedField('Total Sent', 'Total Sent', totalSent.toLocaleString()));
            campaignGrid.appendChild(createCalculatedField('Conversion Rate', 'Conversion Rate', `${conversionRate}%`));
            campaignGrid.appendChild(createCalculatedField('To Be Sent', 'To Be Sent', toBeSent.toLocaleString()));

            goalFieldset.appendChild(campaignGrid);
        } else {
            // Standard metrics table
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
                            <th>Client Name</th>
                            <th>Track for Member</th>
                            <th>Current Value</th>
                            <th>Target Value</th>
                            <th>Completed</th>
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
                    nameInput.placeholder = 'e.g., Client A';
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

                    const tdCompleted = document.createElement('td');
                    tdCompleted.style.textAlign = 'center';
                    const completedCheckbox = document.createElement('input');
                    completedCheckbox.type = 'checkbox';
                    completedCheckbox.style.width = '20px';
                    completedCheckbox.style.height = '20px';
                    completedCheckbox.checked = !!metric.completed;
                    completedCheckbox.onchange = (e) => {
                        metric.completed = e.target.checked;
                        metric.completionDate = e.target.checked ? new Date().toISOString() : null;
                    };
                    tdCompleted.appendChild(completedCheckbox);
                    tr.appendChild(tdCompleted);

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

    // Calculate completion percentage based on goals
    const totalGoals = formData.goals.length;
    const completedGoals = formData.goals.filter(g => g.completed).length;
    const completionPercentage = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

    const projectToSave = {
      ...formData,
      id: project?.id || crypto.randomUUID(),
      createdAt: project?.createdAt || now,
      updatedAt: now,
      completionPercentage: completionPercentage,
    };
    onSave(projectToSave);
  });

  return form;
}
