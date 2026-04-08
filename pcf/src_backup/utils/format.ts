export const formatValue = (val: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    if (!isFinite(val)) return val > 0 ? '∞' : '-∞';
    if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val.toFixed(0);
};
