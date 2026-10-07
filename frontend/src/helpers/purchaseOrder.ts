// Helper functions for Purchase Order presentation (color coding, etc.)

// Mapping of category -> hex color
const PO_CATEGORY_COLORS: Record<string, string> = {
  "HYDROGEL ACCESSORIES": "#ff9800",
  "HYDROGEL FILMS": "#4caf50",
  "MOBILE TEMPERED GLASS": "#81d4fa",
  "MOBILE ACCESSORIES": "#81d4fa",
  "HYDROGEL MACHINES": "#4caf50",
};

/**
 * Returns the text color for a given purchase order category.
 * Falls back to a neutral/default color if category not mapped.
 */
export function getPurchaseOrderCategoryColor(category?: string | null): string {
  if (!category) return "#333";
  const key = category.trim().toUpperCase();
  return PO_CATEGORY_COLORS[key] || "#333";
}

/**
 * Optional utility to render inline style object for PO number.
 */
export function getPurchaseOrderNumberSx(category?: string | null) {
  return {
    fontWeight: 700,
    letterSpacing: 0.5,
    color: getPurchaseOrderCategoryColor(category),
  };
}

export { PO_CATEGORY_COLORS };