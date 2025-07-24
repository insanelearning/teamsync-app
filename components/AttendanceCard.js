
import { Button } from './Button.js';
import { AttendanceStatus } from '../types.js';

export function AttendanceCard({ member, date, record, leaveTypes, holidays, onUpsertRecord }) {
    const card = document.createElement('div');
    card.className = 'attendance-card';

    const currentStatus = record?.status;
    const currentLeaveType = record?.leaveType;
    const currentNotes = record?.notes || '';

    // Check if the date is a weekend or holiday
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const holiday = (holidays || []).find(h => h.date === date);
    const isNonWorkingDay = isWeekend || !!holiday;

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

    if (isNonWorkingDay) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'attendance-card-non-working-status';
        if (holiday) {
            statusDiv.innerHTML = `<i class="fas fa-calendar-star"></i> Holiday: ${holiday.name}`;
        } else {
            statusDiv.innerHTML = `<i class="fas fa-bed"></i> Week Off`;
        }
        card.appendChild(statusDiv);
    } else {
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
            } else {
                delete finalRecord.leaveType; // Clean up leaveType if not on leave
            }

            if (baseRecord.notes && baseRecord.notes.trim()) {
                finalRecord.notes = baseRecord.notes.trim();
            } else {
                delete finalRecord.notes; // Clean up notes if empty
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
            if (e.target.value.trim() !== currentNotes) {
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
    }
    
    return card;
}
