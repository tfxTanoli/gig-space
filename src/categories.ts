// Type shared between CategoriesContext and the rest of the app.
// All category / subcategory data now lives in Firebase RTDB (/categories, /subcategories)
// and is fetched via CategoriesContext / useCategories().

export interface CategoryOption {
  value: string;
  label: string;
}
