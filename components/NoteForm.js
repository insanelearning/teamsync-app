
import { Button } from './Button.js';
import { NoteStatus } from '../types.js';
import { NOTE_COLORS } from '../constants.js';

const getDefaultNote = () => ({
  title: '',
  content: '',
  status: NoteStatus.Pending,
  dueDate: '',
  tags: [],
  color: NOTE_COLORS[0],
});

export function NoteForm({ note, onSave, onCancel }) {
  let formData = note
    ? { ...getDefaultNote(), ...note, tags: note.tags || [] }
    : { ...getDefaultNote(), id: undefined, createdAt: undefined, updatedAt: undefined };

  let currentTag = '';

  const form = document.createElement('form');
  form.className = 'project-form'; // Re-use project form styles

  function createField(labelText, inputType, name, value, required = false, placeholder = '', rows = 3) {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = name;
    label.textContent = labelText + (required ? '*' : '');
    div.appendChild(label);

    let input;
    if (inputType === 'textarea') {
      input = document.createElement('textarea');
      input.rows = rows;
      input.className = 'form-input';
    } else {
      input = document.createElement('input');
      input.type = inputType;
      input.className = 'form-input';
    }
    input.id = name;
    input.name = name;
    input.value = value || '';
    if (required) input.required = true;
    if (placeholder) input.placeholder = placeholder;

    input.addEventListener('input', (e) => {
      formData[name] = e.target.value;
    });
    div.appendChild(input);
    return div;
  }

  form.appendChild(createField('Title', 'text', 'title', formData.title, true, 'What to remember?'));
  form.appendChild(createField('Content', 'textarea', 'content', formData.content, false, 'Add more details...', 5));
  
  const dateColorGrid = document.createElement('div');
  dateColorGrid.className = 'form-grid-cols-2';
  
  dateColorGrid.appendChild(createField('Due Date', 'date', 'dueDate', formData.dueDate));

  // Color Picker
  const colorPickerDiv = document.createElement('div');
  const colorLabel = document.createElement('label');
  colorLabel.className = 'form-label';
  colorLabel.textContent = 'Color';
  colorPickerDiv.appendChild(colorLabel);
  const colorSwatches = document.createElement('div');
  colorSwatches.className = 'note-form-color-picker';
  NOTE_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'note-form-color-swatch';
    swatch.style.backgroundColor = color;
    if (color === '#ffffff') {
      swatch.style.border = '1px solid #ddd';
    }
    if (color === formData.color) {
      swatch.classList.add('selected');
    }
    swatch.addEventListener('click', () => {
      formData.color = color;
      colorSwatches.querySelectorAll('.note-form-color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    });
    colorSwatches.appendChild(swatch);
  });
  colorPickerDiv.appendChild(colorSwatches);
  dateColorGrid.appendChild(colorPickerDiv);
  form.appendChild(dateColorGrid);

  // Tags Section
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
  tagInput.addEventListener('input', (e) => currentTag = e.target.value);
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagButton.click();
    }
  });
  const addTagButton = Button({
    children: 'Add', variant: 'secondary', size: 'sm', ariaLabel: 'Add Tag',
    onClick: () => {
      const trimmedTag = currentTag.trim();
      if (trimmedTag && !(formData.tags || []).includes(trimmedTag)) {
        formData.tags = [...(formData.tags || []), trimmedTag];
        currentTag = ''; tagInput.value = ''; renderTags();
      }
    }
  });
  tagInputContainer.append(tagInput, addTagButton);
  tagsSectionDiv.appendChild(tagInputContainer);
  const tagsDisplayDiv = document.createElement('div');
  tagsDisplayDiv.className = 'form-tags-display';
  tagsSectionDiv.appendChild(tagsDisplayDiv);
  form.appendChild(tagsSectionDiv);

  function renderTags() {
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
  }
  renderTags();


  // Actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'project-form-actions';
  const cancelButton = Button({ children: 'Cancel', variant: 'secondary', onClick: onCancel });
  const saveButton = Button({ children: note ? 'Save Changes' : 'Create Note', variant: 'primary', type: 'submit' });
  actionsDiv.append(cancelButton, saveButton);
  form.appendChild(actionsDiv);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const noteToSave = {
      ...formData,
      id: note?.id || crypto.randomUUID(),
      createdAt: note?.createdAt || now,
      updatedAt: now,
    };
    onSave(noteToSave);
  });

  renderTags(); // Initial render
  return form;
}
