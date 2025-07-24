
// A mapping of colors for consistent avatar backgrounds
const AVATAR_COLORS = [
    '#f87171', '#fb923c', '#facc15', '#4ade80',
    '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
    '#a78bfa', '#f472b6', '#78716c'
];

// Helper to get a consistent color from the list based on member ID
function getAvatarColor(id) {
    if (!id) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function KanbanCard({ project, teamMembers, isManager, onEdit, onDelete }) {
  const card = document.createElement('div');
  card.className = "kanban-card";
  card.dataset.priority = project.priority;
  card.draggable = true;

  // --- Drag and Drop Logic ---
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  // --- Click to Edit ---
  // The main card body is clickable to open the detail modal
  const cardBody = document.createElement('div');
  cardBody.style.cursor = 'pointer';
  cardBody.style.flexGrow = '1';
  cardBody.onclick = () => onEdit(project);
  
  const title = document.createElement('h4');
  title.className = 'kanban-card-title';
  title.textContent = project.name;
  cardBody.appendChild(title);
  
  // --- Progress Bar ---
  const progressContainer = document.createElement('div');
  progressContainer.className = 'kanban-card-progress-container';
  const progressBar = document.createElement('div');
  progressBar.className = 'kanban-card-progress-bar';
  progressBar.style.width = `${project.completionPercentage || 0}%`;
  progressContainer.appendChild(progressBar);
  cardBody.appendChild(progressContainer);

  card.appendChild(cardBody);

  // --- Card Footer ---
  const footer = document.createElement('div');
  footer.className = 'kanban-card-footer';
  
  // Due Date
  const dueDate = document.createElement('div');
  dueDate.className = 'kanban-card-duedate';
  const isOverdue = new Date(project.dueDate) < new Date() && project.status !== 'Done';
  dueDate.style.color = isOverdue ? '#ef4444' : '';
  dueDate.innerHTML = `
      <i class="far fa-calendar-alt"></i>
      <span>${new Date(project.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
  `;
  
  // Assignee Avatars
  const assigneesContainer = document.createElement('div');
  assigneesContainer.className = 'kanban-card-assignees';
  
  (project.assignees || []).slice(0, 3).forEach(id => { // Show max 3 avatars
      const member = teamMembers.find(m => m.id === id);
      if(member) {
          const avatar = document.createElement('div');
          avatar.className = 'kanban-assignee-avatar';
          avatar.style.backgroundColor = getAvatarColor(member.id);
          avatar.title = member.name;
          const initials = member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
          avatar.textContent = initials;
          assigneesContainer.appendChild(avatar);
      }
  });

  footer.append(dueDate, assigneesContainer);
  card.appendChild(footer);
  
  // --- Delete Button (Manager only) ---
  if (isManager) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'kanban-card-delete-btn';
      deleteButton.setAttribute('aria-label', 'Delete project');
      deleteButton.innerHTML = `<i class="fas fa-times"></i>`;
      deleteButton.onclick = (e) => {
          e.stopPropagation(); // Prevent card's onEdit from firing
          if (window.confirm(`Are you sure you want to delete the project "${project.name}"?`)) {
            onDelete(project.id);
          }
      };
      card.appendChild(deleteButton);
  }

  return card;
}
