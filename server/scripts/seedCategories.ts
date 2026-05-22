/**
 * One-time seed script — writes all categories and subcategories to Firebase RTDB.
 *
 * Run from the project root:
 *   cd server && npx tsx scripts/seedCategories.ts
 *
 * Requires service account credentials (one of):
 *   A) FIREBASE_SERVICE_ACCOUNT_JSON in server/.env  (paste the JSON as a single line)
 *   B) serviceAccountKey.json in the project root    (download from Firebase Console →
 *        Project Settings → Service Accounts → Generate new private key)
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Firebase Admin init ──────────────────────────────────────────────────────
if (!admin.apps.length) {
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    console.error('FIREBASE_DATABASE_URL is not set in server/.env');
    process.exit(1);
  }

  let credential: admin.credential.Credential | undefined;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } else {
    const keyPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      credential = admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf-8')));
    } else {
      console.error(
        '\n[seedCategories] No credentials found.\n' +
        '  Option A: Set FIREBASE_SERVICE_ACCOUNT_JSON in server/.env\n' +
        '  Option B: Place serviceAccountKey.json at the project root\n' +
        '  Download the key from: Firebase Console → Project Settings → Service Accounts\n',
      );
      process.exit(1);
    }
  }

  admin.initializeApp({ credential, databaseURL });
}

const db = admin.database();

// ─── Taxonomy data ────────────────────────────────────────────────────────────

const categories = [
  { value: 'Automotive',         label: 'Automotive',         order: 0 },
  { value: 'Business',           label: 'Business',           order: 1 },
  { value: 'Graphics & Design',  label: 'Graphics & Design',  order: 2 },
  { value: 'Home & Garden',      label: 'Home & Garden',      order: 3 },
  { value: 'Labor & Moving',     label: 'Labor & Moving',     order: 4 },
  { value: 'Lessons',            label: 'Lessons',            order: 5 },
  { value: 'Legal',              label: 'Legal',              order: 6 },
  { value: 'Marketing',          label: 'Marketing',          order: 7 },
  { value: 'Programming & Tech', label: 'Programming & Tech', order: 8 },
  { value: 'Real Estate',        label: 'Real Estate',        order: 9 },
  { value: 'Skilled Trade',      label: 'Skilled Trade',      order: 10 },
];

const subcategories: Record<string, Array<{ value: string; label: string }>> = {
  'Automotive': [
    { value: 'ac_heating',     label: 'Air Conditioning & Heating' },
    { value: 'bodywork',       label: 'Bodywork & Painting' },
    { value: 'brake_services', label: 'Brake Services' },
    { value: 'detailing',      label: 'Detailing Services' },
    { value: 'diagnostics',    label: 'Diagnostics & Repairs' },
    { value: 'electrical_sys', label: 'Electrical Systems' },
    { value: 'engine_trans',   label: 'Engine & Transmission' },
    { value: 'glass_services', label: 'Glass Services' },
    { value: 'performance',    label: 'Performance Upgrades' },
    { value: 'roadside',       label: 'Roadside Assistance & Towing' },
    { value: 'routine_maint',  label: 'Routine Maintenance' },
    { value: 'specialty',      label: 'Speciality Services' },
    { value: 'tires',          label: 'Tire Services' },
  ],
  'Business': [
    { value: 'accounting',      label: 'Accounting & Bookkeeping' },
    { value: 'admin_support',   label: 'Admin Support' },
    { value: 'consulting',      label: 'Business Consulting' },
    { value: 'biz_formation',   label: 'Business Formation & Filing' },
    { value: 'biz_plans',       label: 'Business Plans & Strategy' },
    { value: 'corp_events',     label: 'Corporate Event Support / Planning' },
    { value: 'cust_support',    label: 'Customer Support Services' },
    { value: 'data_entry',      label: 'Data Entry' },
    { value: 'financial',       label: 'Financial Analysis & Forecasting' },
    { value: 'grant_writing',   label: 'Grant Writing' },
    { value: 'hr',              label: 'HR & Recruiting Services' },
    { value: 'lead_gen',        label: 'Lead Generation' },
    { value: 'market_research', label: 'Market Research & Analysis' },
    { value: 'notary',          label: 'Notary Services' },
    { value: 'operations',      label: 'Operations & Process Optimization' },
    { value: 'procurement',     label: 'Procurement & Vendor Management' },
    { value: 'project_mgmt',    label: 'Project Management' },
    { value: 'qa_compliance',   label: 'Quality Assurance & Compliance' },
    { value: 'sales',           label: 'Sales' },
    { value: 'tax_prep',        label: 'Tax Preparation & Filing' },
    { value: 'training',        label: 'Training & Development' },
    { value: 'virtual_assist',  label: 'Virtual Assistance' },
  ],
  'Graphics & Design': [
    { value: '3d_modeling',     label: '3D Modeling & Rendering' },
    { value: 'animation',       label: 'Animation & Motion Graphics' },
    { value: 'architectural',   label: 'Architectural & Building Design' },
    { value: 'book_cover',      label: 'Book & Album Cover Design' },
    { value: 'brand_identity',  label: 'Brand Identity & Style Guides' },
    { value: 'business_cards',  label: 'Business Cards' },
    { value: 'digital_art',     label: 'Digital Art & Drawing' },
    { value: 'illustration',    label: 'Illustration' },
    { value: 'image_restore',   label: 'Image Restoration' },
    { value: 'infographics',    label: 'Infographics' },
    { value: 'logo',            label: 'Logo Design' },
    { value: 'merch_apparel',   label: 'Merch & Apparel Design' },
    { value: 'nft_art',         label: 'NFT & Collectible Art' },
    { value: 'packaging',       label: 'Packaging & Label Design' },
    { value: 'photo_editing',   label: 'Photo Editing & Retouching' },
    { value: 'presentation',    label: 'Presentation Design' },
    { value: 'print',           label: 'Print Materials' },
    { value: 'social_graphics', label: 'Social Media Graphics' },
    { value: 'ui_ux',           label: 'UI/UX Design' },
    { value: 'web_app_design',  label: 'Web & App Design' },
  ],
  'Home & Garden': [
    { value: 'appliance_install', label: 'Appliance Installation' },
    { value: 'cleaning',          label: 'Cleaning Services' },
    { value: 'demolition',        label: 'Demolition' },
    { value: 'excavating',        label: 'Excavating' },
    { value: 'exterior_paint',    label: 'Exterior Painting' },
    { value: 'fireplace',         label: 'Fireplace & Chimney Services' },
    { value: 'gardening',         label: 'Gardening & Planting' },
    { value: 'holiday_decor',     label: 'Holiday & Seasonal Decorating' },
    { value: 'home_maint',        label: 'Home Maintenance' },
    { value: 'home_org',          label: 'Home Organizing' },
    { value: 'interior_paint',    label: 'Interior Painting' },
    { value: 'landscaping',       label: 'Landscaping' },
    { value: 'lawn_care',         label: 'Lawn Care & Maintenance' },
    { value: 'pest_control',      label: 'Pest Control' },
    { value: 'pool_spa',          label: 'Pool & Spa Services' },
    { value: 'pressure_wash',     label: 'Pressure Washing' },
    { value: 'smart_home',        label: 'Smart Home Setup' },
    { value: 'waterproofing',     label: 'Waterproofing & Drainage' },
  ],
  'Labor & Moving': [
    { value: 'delivery',           label: 'Delivery & Courier Services' },
    { value: 'event_setup',        label: 'Event Setup & Tear Down' },
    { value: 'furniture_assembly', label: 'Furniture Assembly & Installation' },
    { value: 'heavy_lifting',      label: 'Heavy Lifting' },
    { value: 'junk_removal',       label: 'Junk Removal' },
    { value: 'load_unload',        label: 'Loading & Unloading' },
    { value: 'moving',             label: 'Moving & Hauling' },
    { value: 'moving_prep',        label: 'Moving Prep & Cleanup' },
    { value: 'packing',            label: 'Packing' },
    { value: 'seasonal_labor',     label: 'Seasonal Labor' },
    { value: 'temp_staffing',      label: 'Temporary Staffing & Day Labor' },
  ],
  'Lessons': [
    { value: 'academic',         label: 'Academic Tutoring' },
    { value: 'arts',             label: 'Art & Craft Lessons' },
    { value: 'cooking',          label: 'Cooking & Culinary Lessons' },
    { value: 'dance',            label: 'Dance & Movement Lessons' },
    { value: 'hobby',            label: 'Hobby & Leisure Lessons' },
    { value: 'language',         label: 'Language Lessons' },
    { value: 'music',            label: 'Music Lessons' },
    { value: 'professional_dev', label: 'Professional & Career Development' },
    { value: 'fitness',          label: 'Sports & Fitness Lessons' },
    { value: 'tech_training',    label: 'Technology & Software Training' },
    { value: 'test_prep',        label: 'Test Prep & Study Skills' },
    { value: 'wellness',         label: 'Wellness & Mindfulness Lessons' },
  ],
  'Legal': [
    { value: 'corp_law',         label: 'Business & Corporate Law' },
    { value: 'contracts',        label: 'Contract Review & Drafting' },
    { value: 'estate_planning',  label: 'Estate Planning & Wills' },
    { value: 'family_law',       label: 'Family Law' },
    { value: 'immigration',      label: 'Immigration Services' },
    { value: 'ip_copyright',     label: 'Intellectual Property & Copyright' },
    { value: 'landlord_tenant',  label: 'Landlord & Tenant Law' },
    { value: 'legal_assistant',  label: 'Legal Assistant Services' },
    { value: 'legal_consulting', label: 'Legal Consulting & Advice' },
    { value: 'legal_secretary',  label: 'Legal Secretary Services' },
    { value: 'legal_writing',    label: 'Legal Writing & Research' },
    { value: 'litigation',       label: 'Litigation Support' },
    { value: 'notary_legal',     label: 'Notary Services' },
    { value: 'paralegal',        label: 'Paralegal Services' },
    { value: 'personal_injury',  label: 'Personal Injury' },
    { value: 'tax_law',          label: 'Tax Law' },
  ],
  'Marketing': [
    { value: 'affiliate',          label: 'Affiliate Marketing' },
    { value: 'branding',           label: 'Branding & Identity' },
    { value: 'campaign',           label: 'Campaign Management' },
    { value: 'content',            label: 'Content Marketing' },
    { value: 'copywriting',        label: 'Copywriting & Editing' },
    { value: 'email_mkt',          label: 'Email Marketing' },
    { value: 'influencer',         label: 'Influencer Marketing' },
    { value: 'market_research',    label: 'Market Research & Analysis' },
    { value: 'mkt_strategy',       label: 'Marketing Strategy & Consulting' },
    { value: 'ppc',                label: 'Pay-Per-Click (PPC) Advertising' },
    { value: 'pr',                 label: 'Public Relations' },
    { value: 'seo',                label: 'Search Engine Optimization (SEO)' },
    { value: 'social_media_mgmt',  label: 'Social Media Management' },
    { value: 'social_media_mkt',   label: 'Social Media Marketing' },
    { value: 'video_mkt',          label: 'Video Marketing' },
  ],
  'Programming & Tech': [
    { value: 'ai_dev',           label: 'AI Development' },
    { value: 'api_dev',          label: 'API Integration & Development' },
    { value: 'ar_vr',            label: 'AR/VR Development' },
    { value: 'automation',       label: 'Automation & Scripting' },
    { value: 'blockchain',       label: 'Blockchain & Cryptocurrency Development' },
    { value: 'chatbot',          label: 'Chatbot Development' },
    { value: 'cloud_devops',     label: 'Cloud Services & DevOps' },
    { value: 'cybersecurity',    label: 'Cybersecurity & Data Protection' },
    { value: 'database',         label: 'Database Design & Management' },
    { value: 'ecommerce_dev',    label: 'E-commerce Development' },
    { value: 'game_dev',         label: 'Game Development' },
    { value: 'it_support',       label: 'IT Support & Troubleshooting' },
    { value: 'mobile_dev',       label: 'Mobile App Development' },
    { value: 'network_admin',    label: 'Network Administration' },
    { value: 'qa_testing',       label: 'QA & Testing' },
    { value: 'saas_dev',         label: 'Software (SaaS) Development' },
    { value: 'tech_consulting',  label: 'Technical Consulting' },
    { value: 'ui_ux_dev',        label: 'UI/UX Development' },
    { value: 'web_dev',          label: 'Web Development' },
    { value: 'web_maint',        label: 'Website Maintenance' },
  ],
  'Real Estate': [
    { value: 'closing',        label: 'Closing & Transaction Support' },
    { value: 'inspection',     label: 'Home Inspection Services' },
    { value: 'staging',        label: 'Home Staging' },
    { value: 'management',     label: 'Property Management' },
    { value: 'appraisal',      label: 'Property Valuation & Appraisal' },
    { value: 're_consulting',  label: 'Real Estate Consulting' },
    { value: 're_investment',  label: 'Real Estate Investment Consulting' },
    { value: 'photography',    label: 'Real Estate Photography' },
    { value: 'rental_listing', label: 'Rental Listing Assistance' },
    { value: 'title_escrow',   label: 'Title & Escrow Assistance' },
    { value: 'virtual_tours',  label: 'Virtual Tours & 3D Walkthroughs' },
  ],
  'Skilled Trade': [
    { value: 'appliance_repair',  label: 'Appliance Repair' },
    { value: 'carpentry',         label: 'Carpentry & Woodworking' },
    { value: 'decks_fencing',     label: 'Decks & Fencing' },
    { value: 'drywall',           label: 'Drywall & Insulation' },
    { value: 'electrical',        label: 'Electrical' },
    { value: 'excavation',        label: 'Excavation & Site Prep' },
    { value: 'flooring',          label: 'Flooring Installation & Repair' },
    { value: 'general_contract',  label: 'General Contracting' },
    { value: 'handyman',          label: 'Handyman Services' },
    { value: 'hvac',              label: 'HVAC' },
    { value: 'irrigation',        label: 'Irrigation & Sprinkler Systems' },
    { value: 'masonry',           label: 'Masonry & Concrete' },
    { value: 'plumbing',          label: 'Plumbing' },
    { value: 'roofing',           label: 'Roofing & Gutters' },
    { value: 'solar',             label: 'Solar Installation' },
    { value: 'tree_services',     label: 'Tree Services' },
    { value: 'welding',           label: 'Welding & Metal Fabrication' },
    { value: 'windows_doors',     label: 'Window & Door Services' },
  ],
};

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  // Build /categories object
  const catObj: Record<string, { label: string; order: number }> = {};
  for (const cat of categories) {
    catObj[cat.value] = { label: cat.label, order: cat.order };
  }

  // Build /subcategories object
  const subObj: Record<string, Record<string, { label: string; order: number }>> = {};
  for (const [catValue, subs] of Object.entries(subcategories)) {
    subObj[catValue] = {};
    subs.forEach((sub, i) => {
      subObj[catValue][sub.value] = { label: sub.label, order: i };
    });
  }

  console.log('Seeding /categories …');
  await db.ref('categories').set(catObj);

  console.log('Seeding /subcategories …');
  await db.ref('subcategories').set(subObj);

  const totalSubs = Object.values(subcategories).reduce((n, arr) => n + arr.length, 0);
  console.log(`✓ Done — ${categories.length} categories, ${totalSubs} subcategories written.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
