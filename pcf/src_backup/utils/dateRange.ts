export const getMonthsInRange = (startMonth: number, startYear: number, endMonth: number, endYear: number): { month: number, year: number, label: string }[] => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];

    let currentMonth = startMonth;
    let currentYear = startYear;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        result.push({
            month: currentMonth,
            year: currentYear,
            label: `${monthNames[currentMonth]} ${currentYear}`
        });

        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }

    return result;
};
