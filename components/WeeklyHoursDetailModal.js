function formatMinutes(minutes) {
    const totalMinutes = Math.round(minutes);
    if (isNaN(totalMinutes) || totalMinutes < 0) return '0h 0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
}

export function WeeklyHoursDetailModal(props) {
    const { workLogs, teamMembers, attendanceRecords, holidays, startOfWeek } = props;

    const container = document.createElement('div');
    container.className = 'weekly-hours-modal-content';

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];
    
    // --- Data Calculation ---
    
    // 1. Calculate actual workable days in the week, excluding weekends and holidays
    let workableDays = 0;
    const holidayDates = new Set((holidays || []).map(h => h.date));
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const dayOfWeek = currentDay.getDay(); // Sunday = 0, Saturday = 6
        const dateStr = currentDay.toISOString().split('T')[0];
        
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
            workableDays++;
        }
    }
    const actualWorkableHours = workableDays * 8;
    
    // 2. Filter logs and attendance for the current week
    const weeklyLogs = workLogs.filter(log => log.date >= startOfWeekStr && log.date <= endOfWeekStr);
    const weeklyAttendance = attendanceRecords.filter(rec => rec.date >= startOfWeekStr && rec.date <= endOfWeekStr);
    
    const totalLoggedMinutes = weeklyLogs.reduce((sum, log) => sum + (Number(log.timeSpentMinutes) || 0), 0);
    const totalLoggedHours = totalLoggedMinutes / 60;
    
    const variance = totalLoggedHours - (actualWorkableHours * teamMembers.length);
    
    // --- Render Summary ---
    const summary = document.createElement('div');
    summary.className = 'weekly-hours-summary';
    summary.innerHTML = `
        <div class="summary-item">
            <div class="label">Total Logged</div>
            <div class="value">${formatMinutes(totalLoggedMinutes)}</div>
        </div>
        <div class="summary-item">
            <div class="label">Expected (Team)</div>
            <div class="value">${(actualWorkableHours * teamMembers.length).toFixed(1)}h</div>
        </div>
        <div class="summary-item">
            <div class="label">Variance</div>
            <div class="value ${variance >= 0 ? 'positive' : 'negative'}">${variance.toFixed(1)}h</div>
        </div>
    `;
    container.appendChild(summary);

    // --- Render Individual Breakdowns ---
    const detailsList = document.createElement('div');
    detailsList.className = 'weekly-hours-details-list';
    
    teamMembers.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'weekly-hours-member-item';
        
        const memberLoggedDates = new Set(weeklyLogs.filter(log => log.memberId === member.id).map(log => log.date));

        let memberWorkableDays = 0;
        let memberHolidays = 0;
        const memberLeaveDays = new Set();
        let workableDaysWithNoLogs = 0;
        
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + i);
            const dayOfWeek = currentDay.getDay();
            const dateStr = currentDay.toISOString().split('T')[0];

            const attendanceRecord = weeklyAttendance.find(r => r.memberId === member.id && r.date === dateStr);
            const isOnLeave = attendanceRecord && attendanceRecord.status === 'Leave';
            if (isOnLeave) {
                memberLeaveDays.add(dateStr);
            }
            
            const isWorkDay = dayOfWeek !== 0 && dayOfWeek !== 6;
            const isHoliday = holidayDates.has(dateStr);

            if (isWorkDay && !isHoliday) {
                memberWorkableDays++;
                if (!isOnLeave && !memberLoggedDates.has(dateStr)) {
                    workableDaysWithNoLogs++;
                }
            } else if (isWorkDay && isHoliday) {
                memberHolidays++;
            }
        }
        
        const expectedMemberHours = (memberWorkableDays - memberLeaveDays.size) * 8;
        const loggedMemberMinutes = weeklyLogs
            .filter(log => log.memberId === member.id)
            .reduce((sum, log) => sum + (Number(log.timeSpentMinutes) || 0), 0);

        let reasonText = '';
        if (loggedMemberMinutes < expectedMemberHours * 60) {
            const reasons = [];
            if (memberLeaveDays.size > 0) {
                reasons.push(`${memberLeaveDays.size} day(s) on leave`);
            }
            if (workableDaysWithNoLogs > 0) {
                reasons.push(`${workableDaysWithNoLogs} workable day(s) with no hours logged`);
            }
            if (memberHolidays > 0) {
                reasons.push(`${memberHolidays} holiday(s) occurred`);
            }
            if (reasons.length > 0) {
                reasonText = `Note: Hours are lower due to ${reasons.join(' and ')}.`;
            }
        }

        const header = document.createElement('div');
        header.className = 'member-item-header';
        header.innerHTML = `
            <span>${member.name}</span>
            <div class="member-item-stats">
                <span class="hours-logged">${formatMinutes(loggedMemberMinutes)}</span>
                <span class="hours-expected">/ ${expectedMemberHours.toFixed(1)}h expected</span>
            </div>
        `;
        memberItem.appendChild(header);

        if (reasonText) {
            const reason = document.createElement('div');
            reason.className = 'member-item-reason';
            reason.textContent = reasonText;
            memberItem.appendChild(reason);
        }

        detailsList.appendChild(memberItem);
    });

    container.appendChild(detailsList);

    return container;
}
