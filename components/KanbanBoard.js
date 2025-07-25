
import { KanbanCard } from './KanbanCard.js';
import { TeamMemberRole } from '../types.js';

export function KanbanBoard({ projects, projectStatuses, teamMembers, currentUser, onUpdateProject, onEditProject, onDeleteProject }) {
    const container = document.createElement('div');
    container.className = 'kanban-board-container';
    const isManager = currentUser.role === TeamMemberRole.Manager;

    projectStatuses.forEach(status => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.status = status;

        const projectsInColumn = projects.filter(p => p.status === status)
                                         .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

        const header = document.createElement('div');
        header.className = 'kanban-column-header';
        header.innerHTML = `
            <span>${status}</span>
            <span class="count">${projectsInColumn.length}</span>
        `;
        column.appendChild(header);

        const body = document.createElement('div');
        body.className = 'kanban-column-body';
        
        if (projectsInColumn.length > 0) {
            projectsInColumn.forEach(project => {
                const card = KanbanCard({
                    project,
                    teamMembers,
                    isManager,
                    onEdit: onEditProject,
                    onDelete: onDeleteProject,
                });
                body.appendChild(card);
            });
        } else {
            column.classList.add('kanban-column-empty');
            body.innerHTML = `<div class="kanban-empty-placeholder">Drop card here</div>`;
        }
        
        column.appendChild(body);
        container.appendChild(column);

        // Drag and Drop Event Listeners
        body.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            const draggingCard = document.querySelector('.kanban-card.dragging');
            if (draggingCard && draggingCard.parentElement !== body) { // Check if a valid card is being dragged
                column.classList.add('drag-over');
            }
        });

        body.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        body.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            const projectId = e.dataTransfer.getData('text/plain');
            const newStatus = column.dataset.status;

            const projectToUpdate = projects.find(p => p.id === projectId);
            if (projectToUpdate && projectToUpdate.status !== newStatus) {
                const updatedProject = { ...projectToUpdate, status: newStatus, updatedAt: new Date().toISOString() };
                onUpdateProject(updatedProject);
            }
        });
    });

    return container;
}
