

import { Button } from './Button.js';
import { TeamMemberRole, EmployeeStatus } from '../types.js';

const getDefaultTeamMember = () => ({
  name: '',
  email: '',
  mobileNumber: '',
  employeeId: '',
  joinDate: new Date().toISOString().split('T')[0],
  birthDate: '',
  designation: '',
  department: '',
  company: '',
  role: TeamMemberRole.Member,
  internalTeam: '',
  status: EmployeeStatus.Active,
  password: '',
});

export function TeamMemberForm({ member, onSave, onCancel, internalTeams }) {
  let formData = member 
    ? { ...getDefaultTeamMember(), ...member, joinDate: member.joinDate || new Date().toISOString().split('T')[0] } 
    : { ...getDefaultTeamMember(), id: undefined, internalTeam: (internalTeams && internalTeams.length > 0) ? internalTeams[0] : '' };

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

  const mobilePasswordGrid = document.createElement('div');
  mobilePasswordGrid.className = "form-grid-cols-2";
  mobilePasswordGrid.appendChild(createField('Mobile Number', 'tel', 'mobileNumber', formData.mobileNumber, false, { placeholder: '+1234567890' }));
  const passwordPlaceholder = member ? 'Leave blank to keep unchanged' : '';
  mobilePasswordGrid.appendChild(createField('Password', 'password', 'password', '', !member, { placeholder: passwordPlaceholder }));
  form.appendChild(mobilePasswordGrid);

  const idGrid = document.createElement('div');
  idGrid.className = "form-grid-cols-1";
  idGrid.appendChild(createField('Employee ID', 'text', 'employeeId', formData.employeeId));
  form.appendChild(idGrid);
  
  const designationDepartmentGrid = document.createElement('div');
  designationDepartmentGrid.className = "form-grid-cols-2";
  designationDepartmentGrid.appendChild(createField('Designation', 'text', 'designation', formData.designation));
  designationDepartmentGrid.appendChild(createField('Department', 'text', 'department', formData.department));
  form.appendChild(designationDepartmentGrid);
  
  const companyStatusGrid = document.createElement('div');
  companyStatusGrid.className = "form-grid-cols-2";
  companyStatusGrid.appendChild(createField('Company', 'text', 'company', formData.company));
  companyStatusGrid.appendChild(createField('Status', 'select', 'status', formData.status, true, {
      options: Object.values(EmployeeStatus).map(s => ({ value: s, label: s }))
  }));
  form.appendChild(companyStatusGrid);
  
  const roleTeamGrid = document.createElement('div');
  roleTeamGrid.className = 'form-grid-cols-2';
   roleTeamGrid.appendChild(createField('Role', 'select', 'role', formData.role, true, {
      options: Object.values(TeamMemberRole).map(r => ({ value: r, label: r }))
  }));
  roleTeamGrid.appendChild(createField('Internal Team', 'select', 'internalTeam', formData.internalTeam, false, {
    options: (internalTeams || []).map(t => ({ value: t, label: t }))
  }));
  form.appendChild(roleTeamGrid);

  const datesGrid = document.createElement('div');
  datesGrid.className = "form-grid-cols-2";
  datesGrid.appendChild(createField('Join Date', 'date', 'joinDate', formData.joinDate));
  datesGrid.appendChild(createField('Birth Date', 'date', 'birthDate', formData.birthDate));
  form.appendChild(datesGrid);

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
    
    if (!member && (!formData.password || formData.password.trim() === '')) {
      alert("Password is required for new members.");
      return;
    }

    const memberToSave = {
      id: member?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      role: formData.role,
      status: formData.status,
    };
    
    // Add optional fields only if they have a value
    if (formData.email?.trim()) memberToSave.email = formData.email.trim().toLowerCase();
    if (formData.mobileNumber?.trim()) memberToSave.mobileNumber = formData.mobileNumber.trim();
    if (formData.employeeId?.trim()) memberToSave.employeeId = formData.employeeId.trim();
    if (formData.joinDate) memberToSave.joinDate = formData.joinDate;
    if (formData.birthDate) memberToSave.birthDate = formData.birthDate;
    if (formData.designation?.trim()) memberToSave.designation = formData.designation.trim();
    if (formData.department?.trim()) memberToSave.department = formData.department.trim();
    if (formData.company?.trim()) memberToSave.company = formData.company.trim();
    if (formData.internalTeam) memberToSave.internalTeam = formData.internalTeam;

    // Handle password field
    if (formData.password && formData.password.trim() !== '') {
        // IMPORTANT: Storing plain-text passwords is a security risk.
        // In a real application, this should be hashed before saving.
        memberToSave.password = formData.password;
    } else if (member && member.password) {
        // If editing and password field is blank, retain the old password.
        memberToSave.password = member.password;
    }


    onSave(memberToSave);
  });

  return form;
}
