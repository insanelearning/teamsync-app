

import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

const getDefaultTeamMember = () => ({
  name: '',
  email: '',
  employeeId: '',
  joinDate: new Date().toISOString().split('T')[0],
  birthDate: '',
  designation: '',
  department: '',
  company: '',
  role: TeamMemberRole.Member,
});

export function TeamMemberForm({ member, onSave, onCancel }) {
  let formData = member 
    ? { ...getDefaultTeamMember(), ...member, joinDate: member.joinDate || new Date().toISOString().split('T')[0] } 
    : { ...getDefaultTeamMember(), id: undefined };

  const form = document.createElement('form');
  form.className = 'project-form'; // Re-use project form's base class for spacing etc.

  function createField(labelText, inputType, name, value, required = false, options = {}) {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `member${name.charAt(0).toUpperCase() + name.slice(1)}`;
    label.textContent = labelText + (required ? '*' : '');
    div.appendChild(label);

    let input;
    if (inputType === 'select') {
      input = document.createElement('select');
      input.className = 'form-select';
      (options.options || []).forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        if (value === opt.value) {
            optionEl.selected = true;
        }
        input.appendChild(optionEl);
      });
    } else {
        input = document.createElement('input');
        input.type = inputType;
        input.className = 'form-input';
        input.value = value || '';
        if (options.placeholder) input.placeholder = options.placeholder;
    }

    input.id = `member${name.charAt(0).toUpperCase() + name.slice(1)}`;
    input.name = name;
    if (required) input.required = true;
    
    input.addEventListener('input', (e) => {
      formData[name] = e.target.value;
    });
    div.appendChild(input);
    return div;
  }

  const nameEmailGrid = document.createElement('div');
  nameEmailGrid.className = "form-grid-cols-2";
  nameEmailGrid.appendChild(createField('Member Name', 'text', 'name', formData.name, true));
  nameEmailGrid.appendChild(createField('Email', 'email', 'email', formData.email, true));
  form.appendChild(nameEmailGrid);

  const idDesignationGrid = document.createElement('div');
  idDesignationGrid.className = "form-grid-cols-2";
  idDesignationGrid.appendChild(createField('Employee ID', 'text', 'employeeId', formData.employeeId));
  idDesignationGrid.appendChild(createField('Designation', 'text', 'designation', formData.designation));
  form.appendChild(idDesignationGrid);
  
  const roleDepartmentGrid = document.createElement('div');
  roleDepartmentGrid.className = 'form-grid-cols-2';
  roleDepartmentGrid.appendChild(createField('Role', 'select', 'role', formData.role, true, {
      options: Object.values(TeamMemberRole).map(r => ({ value: r, label: r }))
  }));
  roleDepartmentGrid.appendChild(createField('Department', 'text', 'department', formData.department));
  form.appendChild(roleDepartmentGrid);
  
  const datesGrid = document.createElement('div');
  datesGrid.className = "form-grid-cols-2";
  datesGrid.appendChild(createField('Join Date', 'date', 'joinDate', formData.joinDate));
  datesGrid.appendChild(createField('Birth Date', 'date', 'birthDate', formData.birthDate));
  form.appendChild(datesGrid);

  const companyField = createField('Company', 'text', 'company', formData.company);
  form.appendChild(companyField);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'project-form-actions'; // Re-use class for consistent spacing/alignment
  const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
  const saveButton = Button({ children: member ? 'Save Changes' : 'Add Member', variant: 'primary', type: 'submit' });
  actionsDiv.append(cancelButton, saveButton);
  form.appendChild(actionsDiv);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert("Member name and email are required.");
      return;
    }
    
    const memberToSave = {
      id: member?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      role: formData.role,
    };
    
    // Add optional fields only if they have a value
    if (formData.email?.trim()) memberToSave.email = formData.email.trim().toLowerCase();
    if (formData.employeeId?.trim()) memberToSave.employeeId = formData.employeeId.trim();
    if (formData.joinDate) memberToSave.joinDate = formData.joinDate;
    if (formData.birthDate) memberToSave.birthDate = formData.birthDate;
    if (formData.designation?.trim()) memberToSave.designation = formData.designation.trim();
    if (formData.department?.trim()) memberToSave.department = formData.department.trim();
    if (formData.company?.trim()) memberToSave.company = formData.company.trim();

    onSave(memberToSave);
  });

  return form;
}
