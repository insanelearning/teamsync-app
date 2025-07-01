
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
  table.className = "data-table"; // General data table styling
  
  const thead = document.createElement('thead');
  // thead.className = "sticky top-0 z-10"; // Sticky handled by .log-viewer-table-container .data-table thead
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
    
    const tdDate = document.createElement('td');
    tdDate.textContent = displayDate;
    tr.appendChild(tdDate);

    const tdName = document.createElement('td');
    tdName.textContent = getMemberName(log.memberId);
    // tdName.className = 'font-medium'; // Handled by table styles if desired
    tr.appendChild(tdName);

    const tdStatus = document.createElement('td');
    tdStatus.textContent = log.status;
    tr.appendChild(tdStatus);

    const tdLeaveType = document.createElement('td');
    tdLeaveType.textContent = log.leaveType || 'N/A';
    tr.appendChild(tdLeaveType);

    const tdNotes = document.createElement('td');
    tdNotes.textContent = log.notes || '-';
    tdNotes.title = log.notes || '';
    tdNotes.classList.add('truncate'); // Add truncate class for long notes
    tdNotes.style.maxWidth = '150px'; // Limit width for truncation to be effective in table cell
    tr.appendChild(tdNotes);

    const tdAction = document.createElement('td');
    tdAction.className = 'action-cell';
    const deleteButton = Button({
      variant: 'danger',
      size: 'sm',
      children: '<i class="fas fa-trash-alt"></i>',
      className: 'team-member-action-btn-delete',
      ariaLabel: `Delete log for ${getMemberName(log.memberId)} on ${log.date}`,
      onClick: () => onDelete(log.id),
    });
    tdAction.appendChild(deleteButton);
    tr.appendChild(tdAction);
    
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  return container;
}
