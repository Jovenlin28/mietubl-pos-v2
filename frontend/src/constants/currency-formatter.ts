export const formatCurrency = (v: any) => {
  return `₱${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  })}`;
}