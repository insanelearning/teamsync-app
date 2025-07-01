

import { Button } from './Button.js';

export function AttendanceLogTable({ logs, teamMembers, onDelete }) {
  const getMemberName = (memberId) => {
    const member = teamMembers.find(m => m.id === memberId);
    return member ? member.name : 'Unknown Member';
  };

  const container = document.createElement('div');

  if (!logs || logs.length === 0) {
    container.className = "log-viewer-placeholder"; // CSS class for placeholder
    container.innerHTML = `
      <i class="fas fa-folder-open icon"></i>
      <p class="primary-text">No attendance records found for the selected criteria.</p>
      <p class="secondary-text">Try adjusting the filters or a different date range.</p>
    `;
    return container;
  }

  container.className = "log-viewer-table-container"; // CSS class for the table's scrolling container
  const table = document.createElement('table');
  table.className = "data-table responsive-table"; // General data table styling + responsive class
  
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Date</th>
      <th>Member Name</th>
      <th>Status</th>
      <th>Leave Type</th>
      <th>Notes</th>
      <th class="action-cell">Action</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  logs.forEach((log) => {
    const tr = document.createElement('tr');
    const displayDate = new Date(log.date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });

    // Use innerHTML for easier data-label injection
    tr.innerHTML = `
        <td data-label="Date">${displayDate}</td>
        <td data-label="Member Name">${getMemberName(log.memberId)}</td>
        <td data-label="Status">${log.status}</td>
        <td data-label="Leave Type">${log.leaveType || 'N/A'}</td>
        <td data-label="Notes" class="truncate" title="${log.notes || ''}" style="max-width: 150px;">${log.notes || '-'}</td>
        <td data-label="Action" class="action-cell"></td>
    `;
    
    // Append button to the action cell
    const deleteButton = Button({
      variant: 'danger',
      size: 'sm',
      children: '<i class="fas fa-trash-alt"></i>',
      className: 'team-member-action-btn-delete',
      ariaLabel: `Delete log for ${getMemberName(log.memberId)} on ${log.date}`,
      onClick: () => onDelete(log.id),
    });
    tr.querySelector('.action-cell').appendChild(deleteButton);
    
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
