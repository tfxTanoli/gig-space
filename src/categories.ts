// Single source of truth for service categories and subcategories.
// Imported by PostService, BuyerSearch, LandingPage and BuyerSearchFiltered
// so the taxonomy never drifts between the post-creation flow and search.

export interface CategoryOption {
  value: string;
  label: string;
}

export const categoryOptions: CategoryOption[] = [
  { value: 'Automotive',         label: 'Automotive' },
  { value: 'Business',           label: 'Business' },
  { value: 'Graphics & Design',  label: 'Graphics & Design' },
  { value: 'Home & Garden',      label: 'Home & Garden' },
  { value: 'Labor & Moving',     label: 'Labor & Moving' },
  { value: 'Lessons',            label: 'Lessons' },
  { value: 'Legal',              label: 'Legal' },
  { value: 'Marketing',          label: 'Marketing' },
  { value: 'Programming & Tech', label: 'Programming & Tech' },
  { value: 'Real Estate',        label: 'Real Estate' },
  { value: 'Skilled Trade',      label: 'Skilled Trade' },
];

export const subcategoryMap: Record<string, CategoryOption[]> = {
  'Automotive': [
    { value: 'auto_repair',    label: 'Auto Repair' },
    { value: 'detailing',      label: 'Detailing & Cleaning' },
    { value: 'towing',         label: 'Towing' },
    { value: 'oil_change',     label: 'Oil Change' },
    { value: 'diagnostics',    label: 'Diagnostics' },
  ],
  'Business': [
    { value: 'accounting',     label: 'Accounting & Finance' },
    { value: 'consulting',     label: 'Business Consulting' },
    { value: 'hr',             label: 'HR & Recruiting' },
    { value: 'data_entry',     label: 'Data Entry' },
    { value: 'virtual_assist', label: 'Virtual Assistant' },
  ],
  'Graphics & Design': [
    { value: 'logo',           label: 'Logo Design' },
    { value: 'branding',       label: 'Branding' },
    { value: 'illustration',   label: 'Illustration' },
    { value: 'print',          label: 'Print Design' },
    { value: 'ui_ux',          label: 'UI / UX Design' },
    { value: 'video_editing',  label: 'Video Editing' },
  ],
  'Home & Garden': [
    { value: 'cleaning',       label: 'Cleaning' },
    { value: 'landscaping',    label: 'Landscaping' },
    { value: 'painting',       label: 'Painting' },
    { value: 'plumbing',       label: 'Plumbing' },
    { value: 'electrical',     label: 'Electrical' },
    { value: 'handyman',       label: 'Handyman' },
  ],
  'Labor & Moving': [
    { value: 'moving',         label: 'Moving & Packing' },
    { value: 'delivery',       label: 'Delivery' },
    { value: 'junk_removal',   label: 'Junk Removal' },
    { value: 'assembly',       label: 'Furniture Assembly' },
  ],
  'Lessons': [
    { value: 'music',          label: 'Music' },
    { value: 'language',       label: 'Language' },
    { value: 'academic',       label: 'Academic Tutoring' },
    { value: 'fitness',        label: 'Fitness & Sports' },
    { value: 'cooking',        label: 'Cooking' },
    { value: 'arts',           label: 'Arts & Crafts' },
  ],
  'Legal': [
    { value: 'contracts',      label: 'Contracts & Agreements' },
    { value: 'immigration',    label: 'Immigration' },
    { value: 'notary',         label: 'Notary Services' },
    { value: 'consulting_leg', label: 'Legal Consulting' },
  ],
  'Marketing': [
    { value: 'social_media',   label: 'Social Media' },
    { value: 'seo',            label: 'SEO' },
    { value: 'email_mkt',      label: 'Email Marketing' },
    { value: 'content',        label: 'Content Marketing' },
    { value: 'ads',            label: 'Paid Ads' },
  ],
  'Programming & Tech': [
    { value: 'web_dev',        label: 'Web Development' },
    { value: 'mobile_dev',     label: 'Mobile App Development' },
    { value: 'ai_ml',          label: 'AI / Machine Learning' },
    { value: 'data',           label: 'Data & Analytics' },
    { value: 'devops',         label: 'DevOps & Cloud' },
    { value: 'cybersecurity',  label: 'Cybersecurity' },
  ],
  'Real Estate': [
    { value: 'photography',    label: 'Property Photography' },
    { value: 'staging',        label: 'Home Staging' },
    { value: 'inspection',     label: 'Inspection' },
    { value: 'management',     label: 'Property Management' },
  ],
  'Skilled Trade': [
    { value: 'carpentry',      label: 'Carpentry' },
    { value: 'welding',        label: 'Welding' },
    { value: 'roofing',        label: 'Roofing' },
    { value: 'hvac',           label: 'HVAC' },
    { value: 'masonry',        label: 'Masonry' },
  ],
};

/** Human-readable label for a category value (falls back to the raw value). */
export function getCategoryLabel(value: string): string {
  return categoryOptions.find((c) => c.value === value)?.label ?? value;
}

/** Human-readable label for a subcategory value within a category. */
export function getSubcategoryLabel(category: string, value: string): string {
  return subcategoryMap[category]?.find((s) => s.value === value)?.label ?? value;
}
