
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
      form.innerHTML = '';
      buildForm();
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
    form.appendChild(createField('Project Name', 'text', 'name', formData.name, {}, true, 'Enter project name'));
    form.appendChild(createField('Description', 'textarea', 'description', formData.description, { rows: 4 }));
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'project-form-actions';
    const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
    const saveButton = Button({ children: project ? 'Save Changes' : 'Create Project', variant: 'primary', type: 'submit' });
    actionsDiv.append(cancelButton, saveButton);
    form.appendChild(actionsDiv);
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
