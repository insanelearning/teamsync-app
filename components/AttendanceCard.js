
import { AttendanceStatus } from '../types.js';

const AVATAR_COLORS = [
    '#f87171', '#fb923c', '#facc15', '#4ade80',
    '#34d399', '#2dd4bf', '#38bdf8', '#818cf8',
    '#a78bfa', '#f472b6', '#78716c'
];

function getAvatarColor(id) {
    if (!id) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function AttendanceCard({ member, date, record, leaveTypes, holidays, onUpsertRecord }) {
    const card = document.createElement('div');
    card.className = 'attendance-card';

    const currentStatus = record?.status;
    const currentLeaveType = record?.leaveType;
    const currentNotes = record?.notes || '';

    // Use timezone-safe date parsing
    const dateParts = date.split('-').map(part => parseInt(part, 10));
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = (holidays || []).find(h => h.date === date);
    const isNonWorkingDay = isWeekend || !!holiday;

    // --- Card Header: Member Info ---
    const header = document.createElement('div');
    header.className = 'attendance-card-header';

    const avatar = document.createElement('div');
    avatar.className = 'attendance-card-avatar';
    avatar.style.backgroundColor = getAvatarColor(member.id);
    const initials = member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    avatar.textContent = initials;

    const memberName = document.createElement('div');
    memberName.className = 'attendance-card-member-name';
    memberName.textContent = member.name;
    
    header.append(avatar, memberName);
    card.appendChild(header);

    // --- Card Body: Controls ---
    const body = document.createElement('div');
    body.className = 'attendance-card-body';
    
    if (isNonWorkingDay) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'attendance-card-non-working-status';
        if (holiday) {
            statusDiv.innerHTML = `<i class="fas fa-calendar-star"></i> Holiday: ${holiday.name}`;
        } else {
            statusDiv.innerHTML = `<i class="fas fa-bed"></i> Week Off`;
        }
        body.appendChild(statusDiv);
    } else {
        const handleUpsert = (newDetails) => {
            const baseRecord = {
                status: currentStatus,
                leaveType: currentLeaveType,
                notes: currentNotes,
                ...newDetails,
            };

            const finalRecord = {
                id: record?.id || `${member.id}-${date}`,
                memberId: member.id,
                date: date,
                status: baseRecord.status || AttendanceStatus.Present,
            };

            if (finalRecord.status === AttendanceStatus.Leave && baseRecord.leaveType) {
                finalRecord.leaveType = baseRecord.leaveType;
            } else {
                delete finalRecord.leaveType;
            }

            if (baseRecord.notes && baseRecord.notes.trim()) {
                finalRecord.notes = baseRecord.notes.trim();
            } else {
                delete finalRecord.notes;
            }

            onUpsertRecord(finalRecord);
        };

        // Segmented Control for Status
        const statusButtonsContainer = document.createElement('div');
        statusButtonsContainer.className = 'segmented-control';
        
        const createButton = (status, label) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.className = `segmented-control-button ${currentStatus === status ? 'active' : ''}`;
            button.onclick = () => handleUpsert({ status: status });
            return button;
        };

        statusButtonsContainer.append(
            createButton(AttendanceStatus.Present, 'Present'),
            createButton(AttendanceStatus.WorkFromHome, 'WFH'),
            createButton(AttendanceStatus.Leave, 'Leave')
        );
        body.appendChild(statusButtonsContainer);
        
        // Contextual fields for leave type and notes
        const contextualFieldsContainer = document.createElement('div');
        contextualFieldsContainer.className = 'attendance-card-contextual-fields';
        
        if (currentStatus === AttendanceStatus.Leave) {
            const leaveTypeSelect = document.createElement('select');
            leaveTypeSelect.className = 'form-select form-select-sm';
            leaveTypeSelect.innerHTML = `<option value="">Select Leave Type...</option>` + leaveTypes.map(lt => `<option value="${lt}" ${currentLeaveType === lt ? 'selected' : ''}>${lt}</option>`).join('');
            leaveTypeSelect.value = currentLeaveType || '';
            leaveTypeSelect.onchange = (e) => handleUpsert({ leaveType: e.target.value });
            contextualFieldsContainer.appendChild(leaveTypeSelect);
        }
        
        const notesInput = document.createElement('input');
        notesInput.type = 'text';
        notesInput.className = 'form-input form-input-sm';
        notesInput.placeholder = 'Add notes...';
        notesInput.value = currentNotes;
        notesInput.onblur = (e) => {
            // Only update if the note has actually changed to avoid unnecessary re-renders
            if (e.target.value.trim() !== (currentNotes || '')) {
               handleUpsert({ notes: e.target.value });
            }
        };
        notesInput.onkeydown = (e) => {
            if (e.key === 'Enter') e.target.blur();
        };
        contextualFieldsContainer.appendChild(notesInput);
        
        body.appendChild(contextualFieldsContainer);
    }
    
    card.appendChild(body);
    return card;
}
