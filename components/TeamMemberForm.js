

import { Button } from './Button.js';
import { TeamMemberRole } from '../types.js';

const getDefaultTeamMember = () => ({
  name: '',
  email: '',
  password: '',
  employeeId: '',
  joinDate: new Date().toISOString().split('T')[0],
  birthDate: '',
  designation: '',
  department: '',
  company: '',
  role: TeamMemberRole.Member,
});

export function TeamMemberForm({ member, onSave, onCancel }) {
  const isEditing = !!member;
  
  let formData = isEditing 
    ? { ...getDefaultTeamMember(), ...member, joinDate: member.joinDate || new Date().toISOString().split('T')[0] } 
    : { ...getDefaultTeamMember(), id: undefined };
  
  // Add a field for password confirmation, not part of the model
  formData.confirmPassword = isEditing ? '' : '';

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
  
  // --- Password Fields ---
  const passwordNote = document.createElement('p');
  passwordNote.className = 'form-label';
  passwordNote.style.fontSize = '0.75rem';
  passwordNote.style.fontStyle = 'italic';
  passwordNote.style.color = '#6b7280';
  passwordNote.style.marginTop = '1rem';
  passwordNote.textContent = isEditing ? 'Leave password fields blank to keep the current password.' : 'Password is required for new members.';
  form.appendChild(passwordNote);

  const passwordGrid = document.createElement('div');
  passwordGrid.className = 'form-grid-cols-2';
  // For new members, password is required. For edits, it's optional.
  passwordGrid.appendChild(createField('Password', 'password', 'password', '', !isEditing, { placeholder: isEditing ? 'Enter new password' : '' }));
  passwordGrid.appendChild(createField('Confirm Password', 'password', 'confirmPassword', '', !isEditing, { placeholder: 'Confirm new password' }));
  form.appendChild(passwordGrid);
  // --- End Password Fields ---


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
    
    // Password validation
    if (formData.password !== formData.confirmPassword) {
        alert("Passwords do not match.");
        return;
    }
    if (!isEditing && !formData.password) {
        alert("Password is required for new members.");
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

    // Add password only if it's being set/changed
    if (formData.password) {
        // NOTE: In a real-world application, this password should be hashed on the server-side
        // before being stored. Storing plain text passwords is a security risk.
        memberToSave.password = formData.password;
    }

    onSave(memberToSave);
  });

  return form;
}
