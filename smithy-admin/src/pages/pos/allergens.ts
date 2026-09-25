export const FSANZ_ALLERGEN_CATEGORIES = [
  'peanuts',
  'tree-nuts',
  'milk',
  'egg',
  'fish',
  'shellfish',
  'soy',
  'sesame',
  'gluten',
  'sulphites',
] as const;

export const DIETARY_RESTRICTIONS = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'low-fodmap',
  'diabetic',
] as const;

export type AllergenCategory = typeof FSANZ_ALLERGEN_CATEGORIES[number];
export type DietaryRestriction = typeof DIETARY_RESTRICTIONS[number];
