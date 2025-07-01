
import { Button } from './Button.js';
import { NoteStatus } from '../types.js';

export function NoteCard({ note, onEdit, onDelete, onUpdate }) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.style.backgroundColor = note.color;
  if (note.status === NoteStatus.Completed) {
    card.classList.add('note-card-completed');
  }

  const handleStatusToggle = () => {
    const newStatus = note.status === NoteStatus.Completed ? NoteStatus.Pending : NoteStatus.Completed;
    const updatedNote = { ...note, status: newStatus, updatedAt: new Date().toISOString() };
    onUpdate(updatedNote);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // Header: Title and Status Toggle
  const header = document.createElement('div');
  header.className = 'note-card-header';
  const title = document.createElement('h3');
  title.className = 'note-card-title';
  title.textContent = note.title;
  const statusToggle = document.createElement('button');
  statusToggle.className = 'note-card-status-toggle';
  statusToggle.innerHTML = `<i class="fas ${note.status === NoteStatus.Completed ? 'fa-check-circle' : 'fa-circle'}"></i>`;
  statusToggle.setAttribute('aria-label', `Mark as ${note.status === NoteStatus.Completed ? 'pending' : 'completed'}`);
  statusToggle.onclick = handleStatusToggle;
  header.append(title, statusToggle);
  card.appendChild(header);

  // Content
  const content = document.createElement('p');
  content.className = 'note-card-content';
  content.textContent = note.content;
  card.appendChild(content);

  // Tags
  if (note.tags && note.tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'note-card-tags';
    tagsContainer.innerHTML = note.tags.map(tag => `<span class="note-card-tag-item">#${tag}</span>`).join('');
    card.appendChild(tagsContainer);
  }

  // Footer: Due Date and Actions
  const footer = document.createElement('div');
  footer.className = 'note-card-footer';
  
  const metaInfo = document.createElement('div');
  metaInfo.className = 'note-card-meta';
  if (note.dueDate) {
    metaInfo.innerHTML = `<i class="fas fa-calendar-alt due-date-icon"></i> Due: ${formatDate(note.dueDate)}`;
  }
  
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'note-card-actions';

  const editButton = Button({
    variant: 'ghost', size: 'sm', onClick: () => onEdit(note),
    children: '<i class="fas fa-edit"></i>', ariaLabel: 'Edit Note',
  });
  const deleteButton = Button({
    variant: 'ghost', size: 'sm', onClick: () => onDelete(note.id),
    children: '<i class="fas fa-trash"></i>', ariaLabel: 'Delete Note',
  });
  actionsDiv.append(editButton, deleteButton);
  
  footer.append(metaInfo, actionsDiv);
  card.appendChild(footer);

  return card;
}
