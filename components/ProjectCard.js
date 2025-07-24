
import { Button } from './Button.js';
import { ProjectStatus } from '../types.js';

const getStatusClass = (status) => {
  switch (status) {
    case ProjectStatus.ToDo: return 'status-todo';
    case ProjectStatus.InProgress: return 'status-inprogress';
    case ProjectStatus.QA: return 'status-qa';
    case ProjectStatus.Blocked: return 'status-blocked';
    case ProjectStatus.Done: return 'status-done';
    default: return 'status-default';
  }
};

const getPriorityClass = (priority) => {
  switch (priority) {
    case 'Low': return 'priority-low';
    case 'Medium': return 'priority-medium';
    case 'High': return 'priority-high';
    default: return 'priority-default';
  }
};

export function ProjectCard({ project, teamMembers, onEdit, onDelete }) {
  const card = document.createElement('div');
  card.className = "project-card";
  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        card.classList.add('dragging');
    }, 0);
  });
  
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  const getMemberName = (id) => teamMembers.find(tm => tm.id === id)?.name || 'Unknown';
  
  const assigneesNames = project.assignees && project.assignees.length > 0
    ? project.assignees.map(id => getMemberName(id)).join(', ')
    : 'Unassigned';
  
  const teamLeadName = project.teamLeadId ? getMemberName(project.teamLeadId) : 'N/A';

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

  const contentWrapper = document.createElement('div'); // Wrapper for main content except actions

  let contentHTML = `
      <div class="project-card-header">
        <h3 class="project-card-name" title="${project.name}">
          ${project.name}
        </h3>
        <span class="project-status-badge ${getStatusClass(project.status)}">
          ${project.status}
        </span>
      </div>
      ${project.stakeholderName ? `<p class="project-card-client">Stakeholder: ${project.stakeholderName}</p>` : ''}
      <p class="project-card-description">
        ${project.description || 'No description provided.'}
      </p>
      
      <div class="project-card-details">
        <div>
          <span class="project-card-details-label">Assignees:</span>
          <span class="project-card-details-value" title="${assigneesNames}">${assigneesNames}</span>
        </div>
        ${project.teamLeadId ? `
          <div>
              <span class="project-card-details-label">Team Lead:</span>
              <span class="project-card-details-value">${teamLeadName}</span>
          </div>` : ''}
        <div class="project-card-details-grid">
          <div>
            <span class="project-card-details-label">Due Date:</span>
            <span class="project-card-details-value">${formatDate(project.dueDate)}</span>
          </div>
          ${project.priority ? `
            <div>
              <span class="project-card-details-label">Priority:</span>
              <span class="${getPriorityClass(project.priority)}">${project.priority}</span>
            </div>` : ''}
        </div>
        <div class="project-card-details-grid">
          ${project.projectType ? `
              <div>
                  <span class="project-card-details-label">Type:</span>
                  <span class="project-card-details-value" title="${project.projectType}">${project.projectType}</span>
              </div>` : ''}
          ${project.projectCategory ? `
              <div>
                  <span class="project-card-details-label">Category:</span>
                  <span class="project-card-details-value" title="${project.projectCategory}">${project.projectCategory}</span>
              </div>` : ''}
        </div>
        <div>
          <span class="project-card-details-label">Last Updated:</span>
          <span class="project-card-details-value">${formatDate(project.updatedAt)}</span>
        </div>
      </div>`;

  if (project.tags && project.tags.length > 0) {
    contentHTML += `
      <div class="project-card-tags-container">
        <span class="project-card-details-label">Tags:</span>
        <div class="project-card-tags-list">
          ${project.tags.map(tag => `<span class="project-card-tag-item">${tag}</span>`).join('')}
        </div>
      </div>`;
  }

  if (project.goals && project.goals.length > 0) {
    contentHTML += `
      <div class="project-card-goals">
        <span class="project-card-details-label">Project Goals:</span>
        <ul class="project-card-goals-list">
          ${project.goals.map(goal => `
            <li class="project-card-goal-item">
              <span class="name">${goal.name}</span>
              <span class="count">(${(goal.metrics || []).length} ${(goal.metrics || []).length === 1 ? 'metric' : 'metrics'})</span>
            </li>
          `).join('')}
        </ul>
      </div>`;
  }
  contentWrapper.innerHTML = contentHTML;
  card.appendChild(contentWrapper);


  const actionsDiv = document.createElement('div');
  actionsDiv.className = "project-card-actions";
  
  const editButton = Button({
    variant: 'ghost',
    size: 'sm',
    onClick: () => onEdit(project),
    leftIcon: '<i class="fas fa-edit"></i>',
    children: 'Edit'
  });
  actionsDiv.appendChild(editButton);

  const deleteButton = Button({
    variant: 'danger',
    size: 'sm',
    onClick: () => onDelete(project.id),
    leftIcon: '<i class="fas fa-trash"></i>',
    children: 'Delete'
  });
  actionsDiv.appendChild(deleteButton);
  
  card.appendChild(actionsDiv);

  return card;
}
