
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

export function AttendanceRow({ member, date, record, leaveTypes, holidays, onUpsertRecord }) {
    const row = document.createElement('div');
    row.className = 'attendance-row';

    const currentStatus = record?.status;
    const currentLeaveType = record?.leaveType;
    const currentNotes = record?.notes || '';

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = (holidays || []).find(h => h.date === date);
    const isNonWorkingDay = isWeekend || !!holiday;

    // Member Info
    const memberInfo = document.createElement('div');
    memberInfo.className = 'attendance-row-member';

    const avatar = document.createElement('div');
    avatar.className = 'attendance-card-avatar';
    avatar.style.backgroundColor = getAvatarColor(member.id);
    const initials = member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    avatar.textContent = initials;

    const memberName = document.createElement('div');
    memberName.className = 'attendance-card-member-name';
    memberName.textContent = member.name;
    
    memberInfo.append(avatar, memberName);
    row.appendChild(memberInfo);

    // Controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'attendance-row-controls';
    
    if (isNonWorkingDay) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'attendance-card-non-working-status';
        if (holiday) {
            statusDiv.innerHTML = `<i class="fas fa-calendar-star"></i> Holiday: ${holiday.name}`;
        } else {
            statusDiv.innerHTML = `<i class="fas fa-bed"></i> Week Off`;
        }
        controlsContainer.appendChild(statusDiv);
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
        controlsContainer.appendChild(statusButtonsContainer);
        
        const contextualFieldsContainer = document.createElement('div');
        contextualFieldsContainer.className = 'attendance-card-contextual-fields';
        
        if (currentStatus === AttendanceStatus.Leave) {
            const leaveTypeSelect = document.createElement('select');
            leaveTypeSelect.className = 'form-select form-select-sm';
            leaveTypeSelect.innerHTML = `<option value="">Select Leave Type...</option>` + leaveTypes.map(lt => `<option value="${lt}" ${currentLeaveType === lt ? 'selected' : ''}>${lt}</option>`).join('');
            leaveTypeSelect.value = currentLeaveType || '';
            leaveTypeSelect.onchange = (e) => handleUpsert({ leaveType: e.target.value });
            contextualFieldsContainer.appendChild(leaveTypeSelect);
        } else {
             contextualFieldsContainer.appendChild(document.createElement('div')); // Placeholder to maintain grid structure
        }
        
        const notesInput = document.createElement('input');
        notesInput.type = 'text';
        notesInput.className = 'form-input form-input-sm';
        notesInput.placeholder = 'Add notes...';
        notesInput.value = currentNotes;
        notesInput.onblur = (e) => {
            if (e.target.value.trim() !== currentNotes) {
               handleUpsert({ notes: e.target.value });
            }
        };
        notesInput.onkeydown = (e) => {
            if (e.key === 'Enter') e.target.blur();
        };
        contextualFieldsContainer.appendChild(notesInput);
        
        controlsContainer.appendChild(contextualFieldsContainer);
    }
    
    row.appendChild(controlsContainer);
    return row;
}
