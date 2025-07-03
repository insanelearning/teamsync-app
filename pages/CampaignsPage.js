
import { Button } from '../components/Button.js';
import { Modal, closeModal as closeGlobalModal } from '../components/Modal.js';
import { ProjectForm } from '../components/ProjectForm.js';

let currentModalInstance = null;

const getCampaignStats = (project) => {
    const stats = { delivered: 0, undelivered: 0, totalSent: 0, hubspotLeads: 0, toBeSent: 0 };
    const campaignGoal = project.goals?.find(g => g.name === 'Email Campaign Metrics');
    if (!campaignGoal) return null; // Return null if not a campaign project

    const findMetricValue = (fieldName) => {
        const metric = campaignGoal.metrics.find(m => m.fieldName === fieldName);
        return metric ? Number(metric.fieldValue) || 0 : 0;
    };

    stats.delivered = findMetricValue('Delivered');
    stats.undelivered = findMetricValue('Undelivered');
    stats.totalSent = findMetricValue('Total Sent');
    stats.hubspotLeads = findMetricValue('HubSpot Leads');
    stats.toBeSent = findMetricValue('To be Sent');

    return stats;
};

export function renderCampaignsPage(container, props) {
    const { projects, teamMembers, projectStatuses, onAddProject, onUpdateProject, onDeleteProject } = props;

    container.innerHTML = '';
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-container';

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = "page-header";
    const headerTitle = document.createElement('h1');
    headerTitle.className = 'page-header-title';
    headerTitle.textContent = 'Email Campaign Stats';
    headerDiv.appendChild(headerTitle);

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = "page-header-actions";
    actionsWrapper.append(
        Button({
            children: 'Create Campaign',
            size: 'sm',
            leftIcon: '<i class="fas fa-plus"></i>',
            onClick: openModalForNew
        })
    );
    headerDiv.appendChild(actionsWrapper);
    pageWrapper.appendChild(headerDiv);

    // Table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'data-table-container';
    pageWrapper.appendChild(tableContainer);


    function rerenderCampaignsList() {
        tableContainer.innerHTML = '';

        const campaignProjects = projects
            .map(p => ({ project: p, stats: getCampaignStats(p) }))
            .filter(item => item.stats !== null);

        if (campaignProjects.length === 0) {
            tableContainer.innerHTML = `
                <div class="no-data-placeholder">
                    <i class="fas fa-bullhorn icon"></i>
                    <p class="primary-text">No Email Campaigns Found</p>
                    <p class="secondary-text">Create a new project with the category 'Email Campaign' to see it here.</p>
                </div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = "data-table campaigns-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Client Name</th>
                    <th>Campaign Name</th>
                    <th>Delivered</th>
                    <th>Undelivered</th>
                    <th>Total Sent</th>
                    <th>HubSpot Leads</th>
                    <th>Conversion Rate</th>
                    <th>To be Sent</th>
                    <th class="action-cell">Actions</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        campaignProjects.forEach(({ project, stats }) => {
            const conversionRate = stats.delivered > 0 ? (stats.hubspotLeads / stats.delivered) * 100 : 0;
            
            const getConversionRateClass = (rate) => {
                if (rate >= 2) return 'conversion-rate-high';
                if (rate >= 0.5) return 'conversion-rate-medium';
                return 'conversion-rate-low';
            };

            const tr = document.createElement('tr');
            tr.dataset.projectId = project.id;

            tr.innerHTML = `
                <td>${project.clientName || 'N/A'}</td>
                <td>${project.name}</td>
                <td>${stats.delivered.toLocaleString()}</td>
                <td>${stats.undelivered.toLocaleString()}</td>
                <td>${stats.totalSent.toLocaleString()}</td>
                <td>${stats.hubspotLeads.toLocaleString()}</td>
                <td><span class="conversion-rate-badge ${getConversionRateClass(conversionRate)}">${conversionRate.toFixed(2)}%</span></td>
                <td>${stats.toBeSent.toLocaleString()}</td>
            `;

            const actionCell = document.createElement('td');
            actionCell.className = 'action-cell';
            const editButton = Button({
                variant: 'ghost',
                size: 'sm',
                children: 'Edit',
                onClick: (e) => {
                    e.stopPropagation();
                    openModalWithProject(project);
                }
            });
            actionCell.appendChild(editButton);
            tr.appendChild(actionCell);

            tbody.appendChild(tr);
        });
        
        tbody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row && row.dataset.projectId) {
                const project = projects.find(p => p.id === row.dataset.projectId);
                if(project) openModalWithProject(project);
            }
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
    }

    function closeModal() {
        closeGlobalModal();
        currentModalInstance = null;
    }

    function openModalForNew() {
        const prefilledProject = {
            projectCategory: 'Email Campaign'
        };
        const formElement = ProjectForm({
            project: prefilledProject,
            teamMembers,
            projectStatuses,
            onSave: (projectData) => {
                onAddProject(projectData);
                closeModal();
            },
            onCancel: closeModal
        });
        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: 'Create New Campaign',
            children: formElement,
            size: 'xl'
        });
    }

    function openModalWithProject(project) {
        const formElement = ProjectForm({
            project,
            teamMembers,
            projectStatuses,
            onSave: (projectData) => {
                onUpdateProject(projectData);
                closeModal();
            },
            onCancel: closeModal
        });
        currentModalInstance = Modal({
            isOpen: true,
            onClose: closeModal,
            title: `Edit Campaign: ${project.name}`,
            children: formElement,
            size: 'xl'
        });
    }

    rerenderCampaignsList();
    container.appendChild(pageWrapper);
}
