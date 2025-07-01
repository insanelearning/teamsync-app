
import { Button } from './Button.js';
import { AttendanceStatus } from '../types.js';

export function AttendanceCard({ member, date, record, leaveTypes, onUpsertRecord }) {
    const card = document.createElement('div');
    card.className = 'attendance-card';

    const currentStatus = record?.status;
    const currentLeaveType = record?.leaveType;
    const currentNotes = record?.notes || '';
    
    const getStatusClass = (status) => {
        if (status === AttendanceStatus.Present) return 'status-present';
        if (status === AttendanceStatus.WorkFromHome) return 'status-wfh';
        if (status === AttendanceStatus.Leave) return 'status-leave';
        return 'status-none';
    };
    
    card.classList.add(getStatusClass(currentStatus));

    const memberName = document.createElement('div');
    memberName.className = 'attendance-card-member-name';
    memberName.textContent = member.name;
    card.appendChild(memberName);

    const statusButtonsContainer = document.createElement('div');
    statusButtonsContainer.className = 'attendance-card-status-buttons';
    
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
        }

        if (baseRecord.notes && baseRecord.notes.trim()) {
            finalRecord.notes = baseRecord.notes.trim();
        }

        onUpsertRecord(finalRecord);
    };

    const presentBtn = Button({
        children: 'Present',
        variant: 'secondary',
        className: 'status-btn-present',
        onClick: () => handleUpsert({ status: AttendanceStatus.Present })
    });
    const wfhBtn = Button({
        children: 'WFH',
        variant: 'secondary',
        className: 'status-btn-wfh',
        onClick: () => handleUpsert({ status: AttendanceStatus.WorkFromHome })
    });
    const leaveBtn = Button({
        children: 'Leave',
        variant: 'secondary',
        className: 'status-btn-leave',
        onClick: () => handleUpsert({ status: AttendanceStatus.Leave })
    });
    statusButtonsContainer.append(presentBtn, wfhBtn, leaveBtn);
    card.appendChild(statusButtonsContainer);
    
    const contextualFieldsContainer = document.createElement('div');
    contextualFieldsContainer.className = 'attendance-card-contextual-fields';
    
    if (currentStatus === AttendanceStatus.Leave) {
        const leaveTypeSelect = document.createElement('select');
        leaveTypeSelect.className = 'form-select';
        leaveTypeSelect.innerHTML = `<option value="">Select Leave Type...</option>` + leaveTypes.map(lt => `<option value="${lt}" ${currentLeaveType === lt ? 'selected' : ''}>${lt}</option>`).join('');
        leaveTypeSelect.value = currentLeaveType || '';
        leaveTypeSelect.onchange = (e) => handleUpsert({ leaveType: e.target.value });
        contextualFieldsContainer.appendChild(leaveTypeSelect);
    }
    
    const notesInput = document.createElement('input');
    notesInput.type = 'text';
    notesInput.className = 'form-input';
    notesInput.placeholder = 'Add notes...';
    notesInput.value = currentNotes;
    notesInput.onblur = (e) => {
        // Only update if notes actually changed to avoid unnecessary re-renders
        if (e.target.value !== currentNotes) {
           handleUpsert({ notes: e.target.value });
        }
    };
    notesInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };
    contextualFieldsContainer.appendChild(notesInput);
    
    card.appendChild(contextualFieldsContainer);
    
    return card;
}
