
import { ProjectCard } from './ProjectCard.js';

export function KanbanBoard({ projects, projectStatuses, teamMembers, onUpdateProject, onEditProject, onDeleteProject }) {
    const container = document.createElement('div');
    container.className = 'kanban-board-container';

    projectStatuses.forEach(status => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.status = status;

        const projectsInColumn = projects.filter(p => p.status === status);

        const header = document.createElement('div');
        header.className = 'kanban-column-header';
        header.innerHTML = `
            <span>${status}</span>
            <span class="count">${projectsInColumn.length}</span>
        `;
        column.appendChild(header);

        const body = document.createElement('div');
        body.className = 'kanban-column-body';
        
        projectsInColumn.forEach(project => {
            const card = ProjectCard({
                project,
                teamMembers,
                onEdit: onEditProject,
                onDelete: onDeleteProject,
            });
            card.classList.add('kanban-project-card');
            card.dataset.projectId = project.id;
            body.appendChild(card);
        });
        
        column.appendChild(body);
        container.appendChild(column);

        // Drag and Drop Event Listeners
        column.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            const projectId = e.dataTransfer.getData('text/plain');
            const newStatus = column.dataset.status;

            const projectToUpdate = projects.find(p => p.id === projectId);
            if (projectToUpdate && projectToUpdate.status !== newStatus) {
                const updatedProject = { ...projectToUpdate, status: newStatus };
                onUpdateProject(updatedProject);
            }
        });
    });

    return container;
}
