// @ts-nocheck
export const formatValue = (val: any) => {
    if (val === undefined || val === null || (typeof val === 'object')) return '0';
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(n)) return '0';
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toFixed(0);
};

