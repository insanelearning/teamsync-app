
import { Button } from './Button.js';

const getDefaultTeamMember = () => ({
  name: '',
  email: '',
  employeeId: '',
  joinDate: new Date().toISOString().split('T')[0],
  birthDate: '',
  designation: '',
  department: '',
  company: '',
});

export function TeamMemberForm({ member, onSave, onCancel }) {
  let formData = member 
    ? { ...getDefaultTeamMember(), ...member, joinDate: member.joinDate || new Date().toISOString().split('T')[0] } 
    : { ...getDefaultTeamMember(), id: undefined };

  const form = document.createElement('form');
  form.className = 'project-form'; // Re-use project form's base class for spacing etc.

  function createField(labelText, inputType, name, value, required = false) {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `member${name.charAt(0).toUpperCase() + name.slice(1)}`;
    label.textContent = labelText + (required ? '*' : '');
    div.appendChild(label);

    const input = document.createElement('input');
    input.type = inputType;
    input.id = `member${name.charAt(0).toUpperCase() + name.slice(1)}`;
    input.name = name;
    input.value = value || '';
    input.className = 'form-input';
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
  nameEmailGrid.appendChild(createField('Email', 'email', 'email', formData.email));
  form.appendChild(nameEmailGrid);

  const idDesignationGrid = document.createElement('div');
  idDesignationGrid.className = "form-grid-cols-2";
  idDesignationGrid.appendChild(createField('Employee ID', 'text', 'employeeId', formData.employeeId));
  idDesignationGrid.appendChild(createField('Designation', 'text', 'designation', formData.designation));
  form.appendChild(idDesignationGrid);
  
  const datesGrid = document.createElement('div');
  datesGrid.className = "form-grid-cols-2";
  datesGrid.appendChild(createField('Join Date', 'date', 'joinDate', formData.joinDate));
  datesGrid.appendChild(createField('Birth Date', 'date', 'birthDate', formData.birthDate));
  form.appendChild(datesGrid);

  const deptCompanyGrid = document.createElement('div');
  deptCompanyGrid.className = "form-grid-cols-2";
  deptCompanyGrid.appendChild(createField('Department', 'text', 'department', formData.department));
  deptCompanyGrid.appendChild(createField('Company', 'text', 'company', formData.company));
  form.appendChild(deptCompanyGrid);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'project-form-actions'; // Re-use class for consistent spacing/alignment
  const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
  const saveButton = Button({ children: member ? 'Save Changes' : 'Add Member', variant: 'primary', type: 'submit' });
  actionsDiv.append(cancelButton, saveButton);
  form.appendChild(actionsDiv);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Member name cannot be empty.");
      return;
    }
    // This object is constructed to avoid sending `undefined` for empty fields,
    // which is not allowed by Firestore and was causing the save error.
    const memberToSave = {
      id: member?.id || crypto.randomUUID(),
      name: formData.name.trim(),
    };
    
    if (formData.email?.trim()) memberToSave.email = formData.email.trim();
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
