/**
 * Country configurations for sandbox population.
 *
 * Each country defines its default currency, phone prefix, businesses (counterparties),
 * individual customers, and corporate customers.
 */

import type { CreateCounterpartyPayload, CreateCustomerPayload, CreateCorporateCustomerPayload } from '$lib/obp/types';

export interface Business {
	name: string;
	description: string;
	category: string;
	location: string;
	account_number: string;
	bank_code: string;
}

export interface IndividualCustomerData {
	legal_name: string;
	mobile_phone_number: string;
	email: string;
	date_of_birth: string;
	title: string;
	employment_status: string;
	highest_education_attained: string;
	relationship_status: string;
}

export interface CorporateCustomerData {
	legal_name: string;
	mobile_phone_number: string;
	email: string;
	category: string;
}

export interface CountryConfig {
	code: string;
	name: string;
	currency: string;
	phonePrefix: string;
	emailDomain: string;
	businesses: Business[];
	individualCustomers: IndividualCustomerData[];
	corporateCustomers: CorporateCustomerData[];
}

// ─── Botswana ───────────────────────────────────────────────────────────────

const BOTSWANA_BUSINESSES: Business[] = [
	{ name: 'Mokolodi Crafts', description: 'Traditional Botswana crafts and artwork', category: 'Retail - Arts & Crafts', location: 'Gaborone', account_number: 'BW0001000001', bank_code: 'FNBBBWGX' },
	{ name: 'Kalahari Safari Tours', description: 'Wildlife safari and eco-tourism services', category: 'Tourism', location: 'Maun', account_number: 'BW0001000002', bank_code: 'SBICBWGX' },
	{ name: 'Botho Fresh Produce', description: 'Fresh fruits and vegetables supplier', category: 'Agriculture - Produce', location: 'Francistown', account_number: 'BW0001000003', bank_code: 'BABORWGX' },
	{ name: 'Tswana Textiles', description: 'Traditional and modern African textiles', category: 'Manufacturing - Textiles', location: 'Gaborone', account_number: 'BW0001000004', bank_code: 'FNBBBWGX' },
	{ name: 'Okavango Fish Farm', description: 'Sustainable aquaculture and fish supply', category: 'Agriculture - Aquaculture', location: 'Kasane', account_number: 'BW0001000005', bank_code: 'SBICBWGX' },
	{ name: 'Setswana Solar Solutions', description: 'Solar panel installation and maintenance', category: 'Energy - Renewable', location: 'Gaborone', account_number: 'BW0001000006', bank_code: 'BABORWGX' },
	{ name: 'Motswana Mobile Repairs', description: 'Mobile phone and electronics repair', category: 'Services - Electronics', location: 'Lobatse', account_number: 'BW0001000007', bank_code: 'FNBBBWGX' },
	{ name: 'Chobe Leather Goods', description: 'Handcrafted leather products and accessories', category: 'Manufacturing - Leather', location: 'Kasane', account_number: 'BW0001000008', bank_code: 'SBICBWGX' },
	{ name: 'Gaborone Catering Services', description: 'Event catering and food services', category: 'Food & Beverage', location: 'Gaborone', account_number: 'BW0001000009', bank_code: 'BABORWGX' },
	{ name: 'Pula Construction Materials', description: 'Building materials and construction supplies', category: 'Construction', location: 'Francistown', account_number: 'BW0001000010', bank_code: 'FNBBBWGX' },
];

const BOTSWANA_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Kelebogile Modise', mobile_phone_number: '+267 71 234 5601', email: 'k.modise@example.bw', date_of_birth: '1985-03-15', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Tebogo Molefe', mobile_phone_number: '+267 72 345 6702', email: 't.molefe@example.bw', date_of_birth: '1978-11-22', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Naledi Ramotswe', mobile_phone_number: '+267 73 456 7803', email: 'n.ramotswe@example.bw', date_of_birth: '1992-07-08', title: 'Mrs.', employment_status: 'self-employed', highest_education_attained: 'Diploma', relationship_status: 'married' },
	{ legal_name: 'Mpho Seretse', mobile_phone_number: '+267 74 567 8904', email: 'm.seretse@example.bw', date_of_birth: '1990-01-30', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Boitumelo Kgosi', mobile_phone_number: '+267 75 678 9005', email: 'b.kgosi@example.bw', date_of_birth: '1988-09-12', title: 'Dr.', employment_status: 'employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
];

const BOTSWANA_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Kalahari Mining Holdings (Pty) Ltd', mobile_phone_number: '+267 31 234 5601', email: 'info@kalahariholdings.example.bw', category: 'Mining' },
	{ legal_name: 'Okavango Agri-Business Corp', mobile_phone_number: '+267 31 345 6702', email: 'contact@okavangoagri.example.bw', category: 'Agriculture' },
	{ legal_name: 'Gaborone Tech Solutions (Pty) Ltd', mobile_phone_number: '+267 31 456 7803', email: 'hello@gabtech.example.bw', category: 'Technology' },
	{ legal_name: 'Chobe Hospitality Group', mobile_phone_number: '+267 31 567 8904', email: 'reservations@chobehg.example.bw', category: 'Tourism & Hospitality' },
	{ legal_name: 'Botswana Solar Energy Ltd', mobile_phone_number: '+267 31 678 9005', email: 'sales@bwsolar.example.bw', category: 'Energy' },
];

// ─── Singapore ──────────────────────────────────────────────────────────────

const SINGAPORE_BUSINESSES: Business[] = [
	{ name: 'Marina Bay Trading Pte Ltd', description: 'Import/export and commodity trading', category: 'Trading', location: 'Marina Bay', account_number: 'SG0001000001', bank_code: 'DBSSSGSG' },
	{ name: 'Orchard Road Electronics', description: 'Consumer electronics and gadgets', category: 'Retail - Electronics', location: 'Orchard', account_number: 'SG0001000002', bank_code: 'OCBCSGSG' },
	{ name: 'Sentosa Hospitality Group', description: 'Hotels and resort management', category: 'Tourism & Hospitality', location: 'Sentosa', account_number: 'SG0001000003', bank_code: 'UABORWSG' },
	{ name: 'Changi Logistics Services', description: 'Air freight and logistics solutions', category: 'Transport & Logistics', location: 'Changi', account_number: 'SG0001000004', bank_code: 'DBSSSGSG' },
	{ name: 'Tanjong Pagar Food Co', description: 'Hawker-style food distribution', category: 'Food & Beverage', location: 'Tanjong Pagar', account_number: 'SG0001000005', bank_code: 'OCBCSGSG' },
	{ name: 'Jurong Precision Engineering', description: 'CNC machining and precision parts', category: 'Manufacturing - Engineering', location: 'Jurong', account_number: 'SG0001000006', bank_code: 'UABORWSG' },
	{ name: 'Raffles Fintech Solutions', description: 'Payment processing and fintech', category: 'Financial Technology', location: 'Raffles Place', account_number: 'SG0001000007', bank_code: 'DBSSSGSG' },
	{ name: 'Bukit Timah Fresh Market', description: 'Fresh produce and grocery wholesale', category: 'Agriculture - Produce', location: 'Bukit Timah', account_number: 'SG0001000008', bank_code: 'OCBCSGSG' },
	{ name: 'Clarke Quay Digital Agency', description: 'Digital marketing and web design', category: 'Technology Services', location: 'Clarke Quay', account_number: 'SG0001000009', bank_code: 'UABORWSG' },
	{ name: 'Woodlands Construction Pte Ltd', description: 'Building and civil engineering', category: 'Construction', location: 'Woodlands', account_number: 'SG0001000010', bank_code: 'DBSSSGSG' },
];

const SINGAPORE_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Tan Wei Ming', mobile_phone_number: '+65 9123 4501', email: 'w.tan@example.sg', date_of_birth: '1986-05-20', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Lim Mei Ling', mobile_phone_number: '+65 9234 5602', email: 'm.lim@example.sg', date_of_birth: '1990-08-14', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Arun Rajaratnam', mobile_phone_number: '+65 9345 6703', email: 'a.rajaratnam@example.sg', date_of_birth: '1982-12-03', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Nurul Aisyah bte Hassan', mobile_phone_number: '+65 9456 7804', email: 'n.hassan@example.sg', date_of_birth: '1993-02-28', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Chen Jia Hui', mobile_phone_number: '+65 9567 8905', email: 'j.chen@example.sg', date_of_birth: '1988-07-11', title: 'Mrs.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
];

const SINGAPORE_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Temasek Shipping Pte Ltd', mobile_phone_number: '+65 6123 4501', email: 'ops@temasekshipping.example.sg', category: 'Shipping & Maritime' },
	{ legal_name: 'Lion City Capital Partners', mobile_phone_number: '+65 6234 5602', email: 'invest@lioncitycap.example.sg', category: 'Financial Services' },
	{ legal_name: 'Singapore BioTech Solutions Pte Ltd', mobile_phone_number: '+65 6345 6703', email: 'info@sgbiotech.example.sg', category: 'Biotechnology' },
	{ legal_name: 'Merlion Digital Holdings Pte Ltd', mobile_phone_number: '+65 6456 7804', email: 'hello@merliondigital.example.sg', category: 'Technology' },
	{ legal_name: 'Straits Energy Pte Ltd', mobile_phone_number: '+65 6567 8905', email: 'enquiry@straitsenergy.example.sg', category: 'Energy' },
];

// ─── Japan ───────────────────────────────────────────────────────────────────

const JAPAN_BUSINESSES: Business[] = [
	{ name: 'Sakura Electronics Co Ltd', description: 'Consumer electronics manufacturing', category: 'Manufacturing - Electronics', location: 'Tokyo', account_number: 'JP0001000001', bank_code: 'BOTKJPJT' },
	{ name: 'Fujisan Fresh Foods KK', description: 'Premium food distribution', category: 'Food & Beverage', location: 'Osaka', account_number: 'JP0001000002', bank_code: 'MABORJPJ' },
	{ name: 'Shibuya Digital Agency', description: 'Web design and digital marketing', category: 'Technology Services', location: 'Tokyo', account_number: 'JP0001000003', bank_code: 'SMBORJPJ' },
	{ name: 'Kyoto Silk Textiles KK', description: 'Traditional silk and textile crafts', category: 'Manufacturing - Textiles', location: 'Kyoto', account_number: 'JP0001000004', bank_code: 'BOTKJPJT' },
	{ name: 'Osaka Precision Parts Co Ltd', description: 'Automotive precision components', category: 'Manufacturing - Automotive', location: 'Osaka', account_number: 'JP0001000005', bank_code: 'MABORJPJ' },
	{ name: 'Shinjuku Travel Services', description: 'Inbound and outbound tourism', category: 'Tourism', location: 'Tokyo', account_number: 'JP0001000006', bank_code: 'SMBORJPJ' },
	{ name: 'Yokohama Shipping KK', description: 'Maritime freight and logistics', category: 'Transport & Logistics', location: 'Yokohama', account_number: 'JP0001000007', bank_code: 'BOTKJPJT' },
	{ name: 'Nagoya Auto Parts Co Ltd', description: 'OEM auto parts wholesale', category: 'Automotive Parts', location: 'Nagoya', account_number: 'JP0001000008', bank_code: 'MABORJPJ' },
	{ name: 'Ginza Beauty Products KK', description: 'Cosmetics and skincare products', category: 'Manufacturing - Cosmetics', location: 'Tokyo', account_number: 'JP0001000009', bank_code: 'SMBORJPJ' },
	{ name: 'Hokkaido Dairy Farm Co Ltd', description: 'Dairy production and distribution', category: 'Agriculture - Dairy', location: 'Sapporo', account_number: 'JP0001000010', bank_code: 'BOTKJPJT' },
];

const JAPAN_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Tanaka Yuki', mobile_phone_number: '+81 90 1234 5601', email: 'y.tanaka@example.jp', date_of_birth: '1984-04-10', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Suzuki Haruka', mobile_phone_number: '+81 90 2345 6702', email: 'h.suzuki@example.jp', date_of_birth: '1991-09-25', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Watanabe Kenji', mobile_phone_number: '+81 90 3456 7803', email: 'k.watanabe@example.jp', date_of_birth: '1979-01-18', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Sato Aiko', mobile_phone_number: '+81 90 4567 8904', email: 'a.sato@example.jp', date_of_birth: '1995-06-07', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Yamamoto Takeshi', mobile_phone_number: '+81 90 5678 9005', email: 't.yamamoto@example.jp', date_of_birth: '1987-11-30', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
];

const JAPAN_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Tokyo Semiconductor KK', mobile_phone_number: '+81 3 1234 5601', email: 'info@tokyosemi.example.jp', category: 'Semiconductor' },
	{ legal_name: 'Nippon Green Energy Co Ltd', mobile_phone_number: '+81 3 2345 6702', email: 'contact@nippongreen.example.jp', category: 'Energy' },
	{ legal_name: 'Sumida Robotics KK', mobile_phone_number: '+81 3 3456 7803', email: 'sales@sumidarobotics.example.jp', category: 'Robotics' },
	{ legal_name: 'Kanto Financial Services Co Ltd', mobile_phone_number: '+81 3 4567 8904', email: 'info@kantofinancial.example.jp', category: 'Financial Services' },
	{ legal_name: 'Nihon Pharma Holdings KK', mobile_phone_number: '+81 3 5678 9005', email: 'enquiry@nihonpharma.example.jp', category: 'Pharmaceuticals' },
];

// ─── United Kingdom ─────────────────────────────────────────────────────────

const UK_BUSINESSES: Business[] = [
	{ name: 'Thames Valley Consulting', description: 'Management and strategy consulting', category: 'Professional Services', location: 'London', account_number: 'GB0001000001', bank_code: 'BABORWGB' },
	{ name: 'Highland Distillery Co', description: 'Craft whisky and spirits production', category: 'Food & Beverage', location: 'Edinburgh', account_number: 'GB0001000002', bank_code: 'NWBKGB2L' },
	{ name: 'Bristol Aerospace Parts Ltd', description: 'Aerospace component manufacturing', category: 'Manufacturing - Aerospace', location: 'Bristol', account_number: 'GB0001000003', bank_code: 'HABORWGB' },
	{ name: 'Cambridge BioSciences Ltd', description: 'Life sciences research services', category: 'Biotechnology', location: 'Cambridge', account_number: 'GB0001000004', bank_code: 'BABORWGB' },
	{ name: 'Manchester Digital Studios', description: 'Game development and digital media', category: 'Technology Services', location: 'Manchester', account_number: 'GB0001000005', bank_code: 'NWBKGB2L' },
	{ name: 'Yorkshire Farm Supplies', description: 'Agricultural equipment and feed', category: 'Agriculture', location: 'Leeds', account_number: 'GB0001000006', bank_code: 'HABORWGB' },
	{ name: 'Cotswolds Artisan Bakery', description: 'Artisan bread and pastry production', category: 'Food Processing', location: 'Cheltenham', account_number: 'GB0001000007', bank_code: 'BABORWGB' },
	{ name: 'Liverpool Shipping Services', description: 'Port logistics and freight', category: 'Transport & Logistics', location: 'Liverpool', account_number: 'GB0001000008', bank_code: 'NWBKGB2L' },
	{ name: 'Oxford Green Energy Ltd', description: 'Renewable energy solutions', category: 'Energy - Renewable', location: 'Oxford', account_number: 'GB0001000009', bank_code: 'HABORWGB' },
	{ name: 'Shoreditch Creative Agency', description: 'Branding and creative design', category: 'Creative Services', location: 'London', account_number: 'GB0001000010', bank_code: 'BABORWGB' },
];

const UK_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'James Worthington', mobile_phone_number: '+44 7700 900101', email: 'j.worthington@example.co.uk', date_of_birth: '1983-06-22', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Sophie Henderson', mobile_phone_number: '+44 7700 900202', email: 's.henderson@example.co.uk', date_of_birth: '1991-03-15', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Priya Patel', mobile_phone_number: '+44 7700 900303', email: 'p.patel@example.co.uk', date_of_birth: '1987-10-08', title: 'Dr.', employment_status: 'employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Oliver Campbell', mobile_phone_number: '+44 7700 900404', email: 'o.campbell@example.co.uk', date_of_birth: '1994-01-19', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Emily Chowdhury', mobile_phone_number: '+44 7700 900505', email: 'e.chowdhury@example.co.uk', date_of_birth: '1989-08-30', title: 'Mrs.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
];

const UK_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Canary Wharf Capital Partners Ltd', mobile_phone_number: '+44 20 7946 0101', email: 'info@cwcapital.example.co.uk', category: 'Financial Services' },
	{ legal_name: 'Northern Powerhouse Energy Ltd', mobile_phone_number: '+44 20 7946 0202', email: 'contact@npenergy.example.co.uk', category: 'Energy' },
	{ legal_name: 'London MedTech Innovations Ltd', mobile_phone_number: '+44 20 7946 0303', email: 'hello@londonmedtech.example.co.uk', category: 'Healthcare Technology' },
	{ legal_name: 'Celtic Construction Group plc', mobile_phone_number: '+44 20 7946 0404', email: 'info@celticconstruction.example.co.uk', category: 'Construction' },
	{ legal_name: 'Albion Software Solutions Ltd', mobile_phone_number: '+44 20 7946 0505', email: 'sales@albionsoftware.example.co.uk', category: 'Technology' },
];

// ─── United States ──────────────────────────────────────────────────────────

const US_BUSINESSES: Business[] = [
	{ name: 'Pacific Coast Trading LLC', description: 'Import/export and commodities', category: 'Trading', location: 'San Francisco', account_number: 'US0001000001', bank_code: 'CHABORWU' },
	{ name: 'Brooklyn Artisan Coffee', description: 'Specialty coffee roasting', category: 'Food & Beverage', location: 'New York', account_number: 'US0001000002', bank_code: 'BOFABORW' },
	{ name: 'Austin Tech Ventures LLC', description: 'Software development and SaaS', category: 'Technology Services', location: 'Austin', account_number: 'US0001000003', bank_code: 'WFABORWU' },
	{ name: 'Midwest Grain Suppliers Inc', description: 'Grain and agricultural products', category: 'Agriculture', location: 'Chicago', account_number: 'US0001000004', bank_code: 'CHABORWU' },
	{ name: 'Miami Beach Resort Services', description: 'Hospitality and event management', category: 'Tourism & Hospitality', location: 'Miami', account_number: 'US0001000005', bank_code: 'BOFABORW' },
	{ name: 'Seattle Green Energy Corp', description: 'Solar and wind energy solutions', category: 'Energy - Renewable', location: 'Seattle', account_number: 'US0001000006', bank_code: 'WFABORWU' },
	{ name: 'Denver Construction Materials', description: 'Building supplies and hardware', category: 'Construction', location: 'Denver', account_number: 'US0001000007', bank_code: 'CHABORWU' },
	{ name: 'LA Creative Studios LLC', description: 'Film and media production', category: 'Creative Services', location: 'Los Angeles', account_number: 'US0001000008', bank_code: 'BOFABORW' },
	{ name: 'Boston Medical Devices Inc', description: 'Medical device manufacturing', category: 'Healthcare', location: 'Boston', account_number: 'US0001000009', bank_code: 'WFABORWU' },
	{ name: 'Portland Organic Farms LLC', description: 'Organic produce and distribution', category: 'Agriculture - Organic', location: 'Portland', account_number: 'US0001000010', bank_code: 'CHABORWU' },
];

const US_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Michael Johnson', mobile_phone_number: '+1 415 555 0101', email: 'm.johnson@example.com', date_of_birth: '1985-07-14', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Sarah Williams', mobile_phone_number: '+1 212 555 0202', email: 's.williams@example.com', date_of_birth: '1990-11-03', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'David Chen', mobile_phone_number: '+1 512 555 0303', email: 'd.chen@example.com', date_of_birth: '1982-02-28', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Maria Rodriguez', mobile_phone_number: '+1 305 555 0404', email: 'm.rodriguez@example.com', date_of_birth: '1993-09-16', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Robert Kim', mobile_phone_number: '+1 206 555 0505', email: 'r.kim@example.com', date_of_birth: '1988-04-22', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
];

const US_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Silicon Valley Innovations Inc', mobile_phone_number: '+1 650 555 0101', email: 'info@svinnov.example.com', category: 'Technology' },
	{ legal_name: 'Great Lakes Manufacturing Corp', mobile_phone_number: '+1 312 555 0202', email: 'sales@greatlakesmfg.example.com', category: 'Manufacturing' },
	{ legal_name: 'East Coast Financial Group LLC', mobile_phone_number: '+1 212 555 0303', email: 'contact@ecfgroup.example.com', category: 'Financial Services' },
	{ legal_name: 'Sunbelt Renewable Energy Inc', mobile_phone_number: '+1 713 555 0404', email: 'info@sunbeltrenew.example.com', category: 'Energy' },
	{ legal_name: 'Northwest BioPharmaceuticals Inc', mobile_phone_number: '+1 206 555 0505', email: 'enquiry@nwbiopharma.example.com', category: 'Pharmaceuticals' },
];

// ─── Eurozone (Netherlands as representative) ───────────────────────────────

const EU_BUSINESSES: Business[] = [
	{ name: 'Amsterdam Tulip Exports BV', description: 'Flower export and wholesale', category: 'Agriculture - Floriculture', location: 'Amsterdam', account_number: 'EU0001000001', bank_code: 'INGBNL2A' },
	{ name: 'Berlin Software GmbH', description: 'Enterprise software development', category: 'Technology Services', location: 'Berlin', account_number: 'EU0001000002', bank_code: 'DEUTDEFF' },
	{ name: 'Paris Luxury Goods SARL', description: 'Designer fashion and accessories', category: 'Retail - Luxury', location: 'Paris', account_number: 'EU0001000003', bank_code: 'BNPAFRPP' },
	{ name: 'Milano Design Studio SRL', description: 'Industrial and interior design', category: 'Creative Services', location: 'Milan', account_number: 'EU0001000004', bank_code: 'INGBNL2A' },
	{ name: 'Rotterdam Port Services BV', description: 'Port logistics and warehousing', category: 'Transport & Logistics', location: 'Rotterdam', account_number: 'EU0001000005', bank_code: 'DEUTDEFF' },
	{ name: 'Barcelona Solar Tech SL', description: 'Solar panel manufacturing', category: 'Energy - Renewable', location: 'Barcelona', account_number: 'EU0001000006', bank_code: 'BNPAFRPP' },
	{ name: 'Vienna Precision Instruments', description: 'Scientific instrument production', category: 'Manufacturing - Instruments', location: 'Vienna', account_number: 'EU0001000007', bank_code: 'INGBNL2A' },
	{ name: 'Dublin FinTech Solutions Ltd', description: 'Payment and banking technology', category: 'Financial Technology', location: 'Dublin', account_number: 'EU0001000008', bank_code: 'DEUTDEFF' },
	{ name: 'Helsinki Clean Energy Oy', description: 'Wind and hydro energy solutions', category: 'Energy - Renewable', location: 'Helsinki', account_number: 'EU0001000009', bank_code: 'BNPAFRPP' },
	{ name: 'Lisbon Seafood Exports Lda', description: 'Fresh seafood export', category: 'Food & Beverage', location: 'Lisbon', account_number: 'EU0001000010', bank_code: 'INGBNL2A' },
];

const EU_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Jan de Vries', mobile_phone_number: '+31 6 1234 5601', email: 'j.devries@example.eu', date_of_birth: '1984-03-18', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Marie Dupont', mobile_phone_number: '+33 6 2345 6702', email: 'm.dupont@example.eu', date_of_birth: '1990-07-22', title: 'Mme.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Klaus Schneider', mobile_phone_number: '+49 170 3456 7803', email: 'k.schneider@example.eu', date_of_birth: '1981-12-05', title: 'Dr.', employment_status: 'self-employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Sofia Rossi', mobile_phone_number: '+39 320 4567 8904', email: 's.rossi@example.eu', date_of_birth: '1993-05-14', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'single' },
	{ legal_name: 'Anna Lindqvist', mobile_phone_number: '+46 70 5678 9005', email: 'a.lindqvist@example.eu', date_of_birth: '1988-09-28', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'married' },
];

const EU_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Rhine Valley Logistics GmbH', mobile_phone_number: '+49 69 1234 5601', email: 'info@rhinelogistics.example.eu', category: 'Logistics' },
	{ legal_name: 'Nordic Clean Tech AS', mobile_phone_number: '+47 21 2345 6702', email: 'contact@nordicclean.example.eu', category: 'Clean Technology' },
	{ legal_name: 'Benelux Financial Partners BV', mobile_phone_number: '+31 20 3456 7803', email: 'invest@beneluxfp.example.eu', category: 'Financial Services' },
	{ legal_name: 'Mediterranean Agri Holdings SA', mobile_phone_number: '+34 91 4567 8904', email: 'info@medagri.example.eu', category: 'Agriculture' },
	{ legal_name: 'Alpine Precision Engineering AG', mobile_phone_number: '+41 44 5678 9005', email: 'sales@alpineprecision.example.eu', category: 'Engineering' },
];

// ─── South Africa ───────────────────────────────────────────────────────────

const ZA_BUSINESSES: Business[] = [
	{ name: 'Cape Town Wine Estates', description: 'Premium wine production and export', category: 'Agriculture - Viticulture', location: 'Cape Town', account_number: 'ZA0001000001', bank_code: 'FIABORWZ' },
	{ name: 'Johannesburg Mining Supplies', description: 'Mining equipment and consumables', category: 'Mining', location: 'Johannesburg', account_number: 'ZA0001000002', bank_code: 'SBZABORW' },
	{ name: 'Durban Shipping & Logistics', description: 'Port logistics and freight', category: 'Transport & Logistics', location: 'Durban', account_number: 'ZA0001000003', bank_code: 'NEDSZAJJ' },
	{ name: 'Pretoria Tech Hub', description: 'Software and IT consulting', category: 'Technology Services', location: 'Pretoria', account_number: 'ZA0001000004', bank_code: 'FIABORWZ' },
	{ name: 'Garden Route Tourism Co', description: 'Eco-tourism and safari packages', category: 'Tourism', location: 'Knysna', account_number: 'ZA0001000005', bank_code: 'SBZABORW' },
	{ name: 'Soweto Solar Installations', description: 'Solar panel supply and install', category: 'Energy - Renewable', location: 'Soweto', account_number: 'ZA0001000006', bank_code: 'NEDSZAJJ' },
	{ name: 'Stellenbosch Organic Farms', description: 'Organic fruit and vegetable farm', category: 'Agriculture - Organic', location: 'Stellenbosch', account_number: 'ZA0001000007', bank_code: 'FIABORWZ' },
	{ name: 'Sandton Financial Advisors', description: 'Wealth management and advisory', category: 'Financial Services', location: 'Sandton', account_number: 'ZA0001000008', bank_code: 'SBZABORW' },
	{ name: 'Port Elizabeth Auto Parts', description: 'Automotive parts manufacturing', category: 'Manufacturing - Automotive', location: 'Port Elizabeth', account_number: 'ZA0001000009', bank_code: 'NEDSZAJJ' },
	{ name: 'Drakensberg Adventure Tours', description: 'Mountain hiking and adventure sports', category: 'Tourism - Adventure', location: 'KwaZulu-Natal', account_number: 'ZA0001000010', bank_code: 'FIABORWZ' },
];

const ZA_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Thabo Ndlovu', mobile_phone_number: '+27 82 123 4501', email: 't.ndlovu@example.za', date_of_birth: '1986-08-12', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'married' },
	{ legal_name: 'Zanele Dlamini', mobile_phone_number: '+27 83 234 5602', email: 'z.dlamini@example.za', date_of_birth: '1991-04-25', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'single' },
	{ legal_name: 'Pieter van der Merwe', mobile_phone_number: '+27 84 345 6703', email: 'p.vandermerwe@example.za', date_of_birth: '1980-11-07', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Nomsa Mkhize', mobile_phone_number: '+27 85 456 7804', email: 'n.mkhize@example.za', date_of_birth: '1994-02-19', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Rajesh Naidoo', mobile_phone_number: '+27 86 567 8905', email: 'r.naidoo@example.za', date_of_birth: '1987-06-30', title: 'Dr.', employment_status: 'employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
];

const ZA_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Rand Merchant Holdings Ltd', mobile_phone_number: '+27 11 123 4501', email: 'info@randmerchant.example.za', category: 'Financial Services' },
	{ legal_name: 'Karoo Renewable Energy (Pty) Ltd', mobile_phone_number: '+27 11 234 5602', email: 'contact@karoorenew.example.za', category: 'Energy' },
	{ legal_name: 'Table Mountain AgriTech (Pty) Ltd', mobile_phone_number: '+27 21 345 6703', email: 'hello@tmagritech.example.za', category: 'Agriculture Technology' },
	{ legal_name: 'Highveld Construction Group Ltd', mobile_phone_number: '+27 11 456 7804', email: 'projects@highveldcg.example.za', category: 'Construction' },
	{ legal_name: 'Springbok Digital Solutions (Pty) Ltd', mobile_phone_number: '+27 11 567 8905', email: 'sales@springbokdigital.example.za', category: 'Technology' },
];

// ─── Nigeria ────────────────────────────────────────────────────────────────

const NIGERIA_BUSINESSES: Business[] = [
	{ name: 'Lagos Tech Hub Ltd', description: 'Software development and IT services', category: 'Technology Services', location: 'Lagos', account_number: 'NG0001000001', bank_code: 'ABORNGLA' },
	{ name: 'Abuja Construction Materials', description: 'Building materials wholesale', category: 'Construction', location: 'Abuja', account_number: 'NG0001000002', bank_code: 'ABORNGLA' },
	{ name: 'Kano Textile Mills Ltd', description: 'Cotton and textile manufacturing', category: 'Manufacturing - Textiles', location: 'Kano', account_number: 'NG0001000003', bank_code: 'GTBINGLA' },
	{ name: 'Niger Delta Oil Services', description: 'Petroleum services and logistics', category: 'Energy - Oil & Gas', location: 'Port Harcourt', account_number: 'NG0001000004', bank_code: 'ZENABORW' },
	{ name: 'Ibadan Fresh Produce Market', description: 'Fresh farm produce distribution', category: 'Agriculture - Produce', location: 'Ibadan', account_number: 'NG0001000005', bank_code: 'ABSORWNG' },
	{ name: 'Lekki Hospitality Group', description: 'Hotels and event management', category: 'Tourism & Hospitality', location: 'Lagos', account_number: 'NG0001000006', bank_code: 'GTBINGLA' },
	{ name: 'Enugu Coal & Mining Services', description: 'Mining equipment and services', category: 'Mining', location: 'Enugu', account_number: 'NG0001000007', bank_code: 'ZENABORW' },
	{ name: 'Aba Leather Works Ltd', description: 'Leather goods and footwear', category: 'Manufacturing - Leather', location: 'Aba', account_number: 'NG0001000008', bank_code: 'ABSORWNG' },
	{ name: 'Victoria Island Fintech', description: 'Mobile payments and fintech', category: 'Financial Technology', location: 'Lagos', account_number: 'NG0001000009', bank_code: 'GTBINGLA' },
	{ name: 'Ogun Farm Supplies Ltd', description: 'Agricultural inputs and fertilizers', category: 'Agriculture', location: 'Abeokuta', account_number: 'NG0001000010', bank_code: 'ZENABORW' },
];

const NIGERIA_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Chukwuemeka Okafor', mobile_phone_number: '+234 802 123 4501', email: 'c.okafor@example.ng', date_of_birth: '1985-05-10', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
	{ legal_name: 'Aisha Bello', mobile_phone_number: '+234 803 234 5602', email: 'a.bello@example.ng', date_of_birth: '1992-09-18', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Oluwaseun Adeyemi', mobile_phone_number: '+234 805 345 6703', email: 'o.adeyemi@example.ng', date_of_birth: '1980-01-25', title: 'Dr.', employment_status: 'self-employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
	{ legal_name: 'Ngozi Eze', mobile_phone_number: '+234 806 456 7804', email: 'n.eze@example.ng', date_of_birth: '1993-07-12', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Ibrahim Musa', mobile_phone_number: '+234 807 567 8905', email: 'i.musa@example.ng', date_of_birth: '1988-03-30', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'married' },
];

const NIGERIA_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Dangote Industries Ltd', mobile_phone_number: '+234 1 271 0001', email: 'info@dangoteindustries.example.ng', category: 'Conglomerate' },
	{ legal_name: 'Lagos Renewable Energy Ltd', mobile_phone_number: '+234 1 271 0002', email: 'contact@lagosrenew.example.ng', category: 'Energy' },
	{ legal_name: 'Nollywood Media Group Ltd', mobile_phone_number: '+234 1 271 0003', email: 'hello@nollywoodmedia.example.ng', category: 'Media & Entertainment' },
	{ legal_name: 'West Africa Agri Holdings Ltd', mobile_phone_number: '+234 1 271 0004', email: 'info@waagri.example.ng', category: 'Agriculture' },
	{ legal_name: 'Abuja Digital Payments Ltd', mobile_phone_number: '+234 1 271 0005', email: 'sales@abujapay.example.ng', category: 'Financial Technology' },
];

// ─── Tanzania ───────────────────────────────────────────────────────────────

const TANZANIA_BUSINESSES: Business[] = [
	{ name: 'Serengeti Safari Co Ltd', description: 'Wildlife safari and tourism', category: 'Tourism', location: 'Arusha', account_number: 'TZ0001000001', bank_code: 'CRDBTZDA' },
	{ name: 'Dar es Salaam Spice Traders', description: 'Spice export and wholesale', category: 'Agriculture - Spices', location: 'Dar es Salaam', account_number: 'TZ0001000002', bank_code: 'NMIBTZDA' },
	{ name: 'Kilimanjaro Coffee Estate', description: 'Premium coffee growing and export', category: 'Agriculture - Coffee', location: 'Moshi', account_number: 'TZ0001000003', bank_code: 'CRDBTZDA' },
	{ name: 'Zanzibar Pearl Traders', description: 'Gemstone and pearl trading', category: 'Retail - Jewelry', location: 'Zanzibar', account_number: 'TZ0001000004', bank_code: 'NMIBTZDA' },
	{ name: 'Dodoma Construction Ltd', description: 'Civil engineering and building', category: 'Construction', location: 'Dodoma', account_number: 'TZ0001000005', bank_code: 'CRDBTZDA' },
	{ name: 'Mwanza Fish Processing', description: 'Lake Victoria fish processing', category: 'Food Processing', location: 'Mwanza', account_number: 'TZ0001000006', bank_code: 'NMIBTZDA' },
	{ name: 'Bagamoyo Arts Collective', description: 'Traditional art and sculpture', category: 'Arts & Crafts', location: 'Bagamoyo', account_number: 'TZ0001000007', bank_code: 'CRDBTZDA' },
	{ name: 'Tanga Sisal Products Ltd', description: 'Sisal rope and fibre products', category: 'Manufacturing - Textiles', location: 'Tanga', account_number: 'TZ0001000008', bank_code: 'NMIBTZDA' },
	{ name: 'Dar Tech Solutions Ltd', description: 'Mobile app and web development', category: 'Technology Services', location: 'Dar es Salaam', account_number: 'TZ0001000009', bank_code: 'CRDBTZDA' },
	{ name: 'Tanzanite Mining Services Ltd', description: 'Gemstone mining and export', category: 'Mining', location: 'Arusha', account_number: 'TZ0001000010', bank_code: 'NMIBTZDA' },
];

const TANZANIA_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Baraka Mwangi', mobile_phone_number: '+255 754 123 4501', email: 'b.mwangi@example.tz', date_of_birth: '1986-06-15', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'married' },
	{ legal_name: 'Amina Rashid', mobile_phone_number: '+255 755 234 5602', email: 'a.rashid@example.tz', date_of_birth: '1991-10-22', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'single' },
	{ legal_name: 'Joseph Kimaro', mobile_phone_number: '+255 756 345 6703', email: 'j.kimaro@example.tz', date_of_birth: '1979-03-08', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Diploma', relationship_status: 'married' },
	{ legal_name: 'Fatuma Said', mobile_phone_number: '+255 757 456 7804', email: 'f.said@example.tz', date_of_birth: '1994-08-19', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Emmanuel Lyimo', mobile_phone_number: '+255 758 567 8905', email: 'e.lyimo@example.tz', date_of_birth: '1987-12-04', title: 'Dr.', employment_status: 'employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
];

const TANZANIA_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'East African Breweries (TZ) Ltd', mobile_phone_number: '+255 22 211 0001', email: 'info@eabreweries.example.tz', category: 'Food & Beverage' },
	{ legal_name: 'Kilimanjaro Renewable Energy Ltd', mobile_phone_number: '+255 22 211 0002', email: 'contact@kilirenew.example.tz', category: 'Energy' },
	{ legal_name: 'Bongo Telecom Ltd', mobile_phone_number: '+255 22 211 0003', email: 'hello@bongotelecom.example.tz', category: 'Telecommunications' },
	{ legal_name: 'Uhuru Agricultural Corp', mobile_phone_number: '+255 22 211 0004', email: 'info@uhuruagri.example.tz', category: 'Agriculture' },
	{ legal_name: 'Swahili Coast Hotels Ltd', mobile_phone_number: '+255 22 211 0005', email: 'reservations@swahilicoast.example.tz', category: 'Tourism & Hospitality' },
];

// ─── Oman ───────────────────────────────────────────────────────────────────

const OMAN_BUSINESSES: Business[] = [
	{ name: 'Muttrah Souq Frankincense', description: 'Frankincense and traditional perfumes', category: 'Retail - Perfumes', location: 'Muscat', account_number: 'OM0001000001', bank_code: 'BMUSOMRX' },
	{ name: 'Nizwa Pottery Works', description: 'Handmade traditional Omani pottery', category: 'Retail - Arts & Crafts', location: 'Nizwa', account_number: 'OM0001000002', bank_code: 'NBOMOMRX' },
	{ name: 'Dhofar Coconut Traders', description: 'Coconut and tropical produce supplier', category: 'Agriculture - Produce', location: 'Salalah', account_number: 'OM0001000003', bank_code: 'BDOFOMRU' },
	{ name: 'Sur Dhow Builders', description: 'Traditional wooden boat building', category: 'Manufacturing - Marine', location: 'Sur', account_number: 'OM0001000004', bank_code: 'BMUSOMRX' },
	{ name: 'Al Batinah Date Farms', description: 'Date cultivation and packaging', category: 'Agriculture - Dates', location: 'Sohar', account_number: 'OM0001000005', bank_code: 'NBOMOMRX' },
	{ name: 'Wahiba Sands Desert Camps', description: 'Desert tourism and camping', category: 'Tourism', location: 'Bidiyah', account_number: 'OM0001000006', bank_code: 'BDOFOMRU' },
	{ name: 'Muscat Fish Market Co', description: 'Fresh seafood wholesale', category: 'Food Processing', location: 'Muscat', account_number: 'OM0001000007', bank_code: 'BMUSOMRX' },
	{ name: 'Jebel Akhdar Rose Water', description: 'Rose water distillation and sales', category: 'Agriculture - Floriculture', location: 'Jebel Akhdar', account_number: 'OM0001000008', bank_code: 'NBOMOMRX' },
	{ name: 'Duqm Logistics LLC', description: 'Port logistics and freight forwarding', category: 'Transport & Logistics', location: 'Duqm', account_number: 'OM0001000009', bank_code: 'BDOFOMRU' },
	{ name: 'Qurum Tech Solutions LLC', description: 'Software and IT consulting', category: 'Technology Services', location: 'Muscat', account_number: 'OM0001000010', bank_code: 'BMUSOMRX' },
];

const OMAN_INDIVIDUAL_CUSTOMERS: IndividualCustomerData[] = [
	{ legal_name: 'Salim Al Harthy', mobile_phone_number: '+968 9123 4501', email: 's.alharthy@example.om', date_of_birth: '1985-04-12', title: 'Mr.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'married' },
	{ legal_name: 'Aisha Al Balushi', mobile_phone_number: '+968 9234 5602', email: 'a.albalushi@example.om', date_of_birth: '1992-09-27', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Master', relationship_status: 'single' },
	{ legal_name: 'Khalid Al Rawahi', mobile_phone_number: '+968 9345 6703', email: 'k.alrawahi@example.om', date_of_birth: '1978-01-30', title: 'Mr.', employment_status: 'self-employed', highest_education_attained: 'Diploma', relationship_status: 'married' },
	{ legal_name: 'Maryam Al Lawati', mobile_phone_number: '+968 9456 7804', email: 'm.allawati@example.om', date_of_birth: '1995-06-08', title: 'Ms.', employment_status: 'employed', highest_education_attained: 'Bachelor', relationship_status: 'single' },
	{ legal_name: 'Hamed Al Busaidi', mobile_phone_number: '+968 9567 8905', email: 'h.albusaidi@example.om', date_of_birth: '1983-11-15', title: 'Dr.', employment_status: 'employed', highest_education_attained: 'Doctorate', relationship_status: 'married' },
];

const OMAN_CORPORATE_CUSTOMERS: CorporateCustomerData[] = [
	{ legal_name: 'Al Hajar Cement Co SAOG', mobile_phone_number: '+968 2411 0001', email: 'info@alhajarcement.example.om', category: 'Manufacturing' },
	{ legal_name: 'Majan Renewable Energy LLC', mobile_phone_number: '+968 2411 0002', email: 'contact@majanrenew.example.om', category: 'Energy' },
	{ legal_name: 'Sultanate Telecom SAOC', mobile_phone_number: '+968 2411 0003', email: 'hello@sultanatetel.example.om', category: 'Telecommunications' },
	{ legal_name: 'Dhofar Fisheries Corp', mobile_phone_number: '+968 2411 0004', email: 'info@dhofarfish.example.om', category: 'Agriculture & Fisheries' },
	{ legal_name: 'Royal Arabian Hotels LLC', mobile_phone_number: '+968 2411 0005', email: 'reservations@royalarabian.example.om', category: 'Tourism & Hospitality' },
];

// ─── Country registry ───────────────────────────────────────────────────────

export const COUNTRIES: Record<string, CountryConfig> = {
	BW: {
		code: 'BW',
		name: 'Botswana',
		currency: 'BWP',
		phonePrefix: '+267',
		emailDomain: 'example.bw',
		businesses: BOTSWANA_BUSINESSES,
		individualCustomers: BOTSWANA_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: BOTSWANA_CORPORATE_CUSTOMERS,
	},
	SG: {
		code: 'SG',
		name: 'Singapore',
		currency: 'SGD',
		phonePrefix: '+65',
		emailDomain: 'example.sg',
		businesses: SINGAPORE_BUSINESSES,
		individualCustomers: SINGAPORE_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: SINGAPORE_CORPORATE_CUSTOMERS,
	},
	JP: {
		code: 'JP',
		name: 'Japan',
		currency: 'JPY',
		phonePrefix: '+81',
		emailDomain: 'example.jp',
		businesses: JAPAN_BUSINESSES,
		individualCustomers: JAPAN_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: JAPAN_CORPORATE_CUSTOMERS,
	},
	GB: {
		code: 'GB',
		name: 'United Kingdom',
		currency: 'GBP',
		phonePrefix: '+44',
		emailDomain: 'example.co.uk',
		businesses: UK_BUSINESSES,
		individualCustomers: UK_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: UK_CORPORATE_CUSTOMERS,
	},
	US: {
		code: 'US',
		name: 'United States',
		currency: 'USD',
		phonePrefix: '+1',
		emailDomain: 'example.com',
		businesses: US_BUSINESSES,
		individualCustomers: US_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: US_CORPORATE_CUSTOMERS,
	},
	EU: {
		code: 'EU',
		name: 'Eurozone',
		currency: 'EUR',
		phonePrefix: '+31',
		emailDomain: 'example.eu',
		businesses: EU_BUSINESSES,
		individualCustomers: EU_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: EU_CORPORATE_CUSTOMERS,
	},
	ZA: {
		code: 'ZA',
		name: 'South Africa',
		currency: 'ZAR',
		phonePrefix: '+27',
		emailDomain: 'example.za',
		businesses: ZA_BUSINESSES,
		individualCustomers: ZA_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: ZA_CORPORATE_CUSTOMERS,
	},
	NG: {
		code: 'NG',
		name: 'Nigeria',
		currency: 'NGN',
		phonePrefix: '+234',
		emailDomain: 'example.ng',
		businesses: NIGERIA_BUSINESSES,
		individualCustomers: NIGERIA_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: NIGERIA_CORPORATE_CUSTOMERS,
	},
	TZ: {
		code: 'TZ',
		name: 'Tanzania',
		currency: 'TZS',
		phonePrefix: '+255',
		emailDomain: 'example.tz',
		businesses: TANZANIA_BUSINESSES,
		individualCustomers: TANZANIA_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: TANZANIA_CORPORATE_CUSTOMERS,
	},
	OM: {
		code: 'OM',
		name: 'Oman',
		currency: 'OMR',
		phonePrefix: '+968',
		emailDomain: 'example.om',
		businesses: OMAN_BUSINESSES,
		individualCustomers: OMAN_INDIVIDUAL_CUSTOMERS,
		corporateCustomers: OMAN_CORPORATE_CUSTOMERS,
	},
};

export const COUNTRY_LIST = Object.values(COUNTRIES);

export function getCountryConfig(countryCode: string): CountryConfig {
	return COUNTRIES[countryCode] || COUNTRIES['BW'];
}

export function getBusinesses(countryCode: string, count?: number): Business[] {
	const config = getCountryConfig(countryCode);
	if (count === undefined) return config.businesses;
	return config.businesses.slice(0, count);
}

export function getBusinessForCounterparty(business: Business, currency: string): CreateCounterpartyPayload {
	const description = business.description.slice(0, 36);
	return {
		name: business.name,
		description,
		currency,
		other_account_routing_scheme: 'AccountNumber',
		other_account_routing_address: business.account_number,
		other_bank_routing_scheme: 'BIC',
		other_bank_routing_address: business.bank_code,
		bespoke: [
			{ key: 'category', value: business.category },
			{ key: 'location', value: business.location },
		],
	};
}

export function getIndividualCustomers(countryCode: string, count?: number): IndividualCustomerData[] {
	const config = getCountryConfig(countryCode);
	if (count === undefined) return config.individualCustomers;
	return config.individualCustomers.slice(0, count);
}

export function getCorporateCustomers(countryCode: string, count?: number): CorporateCustomerData[] {
	const config = getCountryConfig(countryCode);
	if (count === undefined) return config.corporateCustomers;
	return config.corporateCustomers.slice(0, count);
}

export function toCreateCustomerPayload(data: IndividualCustomerData, currency: string): CreateCustomerPayload {
	return {
		legal_name: data.legal_name,
		mobile_phone_number: data.mobile_phone_number,
		email: data.email,
		date_of_birth: data.date_of_birth,
		title: data.title,
		employment_status: data.employment_status,
		highest_education_attained: data.highest_education_attained,
		relationship_status: data.relationship_status,
		kyc_status: true,
		credit_limit: { currency, amount: '10000' },
		credit_rating: { rating: 'A', source: 'OBP' },
		last_ok_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
	};
}

export function toCreateCorporateCustomerPayload(data: CorporateCustomerData, currency: string): CreateCorporateCustomerPayload {
	return {
		legal_name: data.legal_name,
		mobile_phone_number: data.mobile_phone_number,
		email: data.email,
		kyc_status: true,
		credit_limit: { currency, amount: '500000' },
		credit_rating: { rating: 'AA', source: 'OBP' },
		last_ok_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
	};
}

// ─── Investigation case example ─────────────────────────────────────────────
// Localised cast for the "Populate Case Example" fraud investigation demo.
// Roles: suspect (married to spouse), colleague at the employer, vendor (close associate),
// employer (pays salaries), consultancy (shell company), holdings (source of suspicious funds).

export interface CasePerson {
	legal_name: string;
	phone: string;
	email: string;
	dob: string;
}

export interface CaseCompany {
	legal_name: string;
	short_name: string;
	phone: string;
	email: string;
}

export interface CaseExampleCast {
	bankIds: string[];
	suspect: CasePerson;
	spouse: CasePerson;
	colleague: CasePerson;
	vendor: CasePerson;
	employer: CaseCompany;
	consultancy: CaseCompany;
	holdings: CaseCompany;
}

const CASE_EXAMPLES: Record<string, CaseExampleCast> = {
	BW: {
		bankIds: ['bw-fnbb-inv', 'bw-sbic-inv', 'bw-absa-inv'],
		suspect: { legal_name: 'Kagiso Mothibi', phone: '+267 71 555 0101', email: 'kagiso.mothibi@example.bw', dob: '1984-06-15' },
		spouse: { legal_name: 'Boitumelo Mothibi', phone: '+267 72 555 0102', email: 'boitumelo.mothibi@example.bw', dob: '1986-09-22' },
		colleague: { legal_name: 'Neo Kgosi', phone: '+267 73 555 0103', email: 'neo.kgosi@example.bw', dob: '1990-02-10' },
		vendor: { legal_name: 'Tebogo Seretse', phone: '+267 74 555 0104', email: 'tebogo.seretse@example.bw', dob: '1979-12-03' },
		employer: { legal_name: 'Kgalagadi Engineering (Pty) Ltd', short_name: 'Kgalagadi Engineering', phone: '+267 390 0200', email: 'info@kgalagadi-eng.example.bw' },
		consultancy: { legal_name: 'Blue Kite Consulting (Pty) Ltd', short_name: 'Blue Kite Consulting', phone: '+267 390 0300', email: 'admin@bluekite.example.bw' },
		holdings: { legal_name: 'Sechaba Holdings (Pty) Ltd', short_name: 'Sechaba Holdings', phone: '+267 390 0400', email: 'finance@sechaba.example.bw' },
	},
	SG: {
		bankIds: ['sg-dbs-inv', 'sg-ocbc-inv', 'sg-uob-inv'],
		suspect: { legal_name: 'Tan Wei Ming', phone: '+65 9123 0101', email: 'weiming.tan@example.sg', dob: '1984-06-15' },
		spouse: { legal_name: 'Lim Mei Ling', phone: '+65 9123 0102', email: 'meiling.lim@example.sg', dob: '1986-09-22' },
		colleague: { legal_name: 'Priya Nair', phone: '+65 9123 0103', email: 'priya.nair@example.sg', dob: '1990-02-10' },
		vendor: { legal_name: 'Ahmad Rahman', phone: '+65 9123 0104', email: 'ahmad.rahman@example.sg', dob: '1979-12-03' },
		employer: { legal_name: 'Merlion Engineering Pte Ltd', short_name: 'Merlion Engineering', phone: '+65 6555 0200', email: 'info@merlion-eng.example.sg' },
		consultancy: { legal_name: 'Blue Kite Consulting Pte Ltd', short_name: 'Blue Kite Consulting', phone: '+65 6555 0300', email: 'admin@bluekite.example.sg' },
		holdings: { legal_name: 'Straits Holdings Pte Ltd', short_name: 'Straits Holdings', phone: '+65 6555 0400', email: 'finance@straits.example.sg' },
	},
	JP: {
		bankIds: ['jp-mufg-inv', 'jp-smbc-inv', 'jp-mizuho-inv'],
		suspect: { legal_name: 'Takashi Sato', phone: '+81 90 5550 0101', email: 'takashi.sato@example.jp', dob: '1984-06-15' },
		spouse: { legal_name: 'Yuko Sato', phone: '+81 90 5550 0102', email: 'yuko.sato@example.jp', dob: '1986-09-22' },
		colleague: { legal_name: 'Haruka Suzuki', phone: '+81 90 5550 0103', email: 'haruka.suzuki@example.jp', dob: '1990-02-10' },
		vendor: { legal_name: 'Kenji Watanabe', phone: '+81 90 5550 0104', email: 'kenji.watanabe@example.jp', dob: '1979-12-03' },
		employer: { legal_name: 'Fuji Engineering Co., Ltd.', short_name: 'Fuji Engineering', phone: '+81 3 5550 0200', email: 'info@fuji-eng.example.jp' },
		consultancy: { legal_name: 'Blue Kite Consulting K.K.', short_name: 'Blue Kite Consulting', phone: '+81 3 5550 0300', email: 'admin@bluekite.example.jp' },
		holdings: { legal_name: 'Sakura Holdings K.K.', short_name: 'Sakura Holdings', phone: '+81 3 5550 0400', email: 'finance@sakura.example.jp' },
	},
	GB: {
		bankIds: ['gb-hsbc-inv', 'gb-barc-inv', 'gb-lloy-inv'],
		suspect: { legal_name: 'James Whitaker', phone: '+44 7700 900101', email: 'james.whitaker@example.co.uk', dob: '1984-06-15' },
		spouse: { legal_name: 'Sarah Whitaker', phone: '+44 7700 900102', email: 'sarah.whitaker@example.co.uk', dob: '1986-09-22' },
		colleague: { legal_name: 'Emily Clarke', phone: '+44 7700 900103', email: 'emily.clarke@example.co.uk', dob: '1990-02-10' },
		vendor: { legal_name: 'Daniel Hughes', phone: '+44 7700 900104', email: 'daniel.hughes@example.co.uk', dob: '1979-12-03' },
		employer: { legal_name: 'Thames Engineering Ltd', short_name: 'Thames Engineering', phone: '+44 20 7946 0200', email: 'info@thames-eng.example.co.uk' },
		consultancy: { legal_name: 'Blue Kite Consulting Ltd', short_name: 'Blue Kite Consulting', phone: '+44 20 7946 0300', email: 'admin@bluekite.example.co.uk' },
		holdings: { legal_name: 'Ashford Holdings Ltd', short_name: 'Ashford Holdings', phone: '+44 20 7946 0400', email: 'finance@ashford.example.co.uk' },
	},
	US: {
		bankIds: ['us-chase-inv', 'us-boa-inv', 'us-wf-inv'],
		suspect: { legal_name: 'Michael Carter', phone: '+1 212 555 0101', email: 'michael.carter@example.com', dob: '1984-06-15' },
		spouse: { legal_name: 'Jennifer Carter', phone: '+1 212 555 0102', email: 'jennifer.carter@example.com', dob: '1986-09-22' },
		colleague: { legal_name: 'Ashley Brooks', phone: '+1 212 555 0103', email: 'ashley.brooks@example.com', dob: '1990-02-10' },
		vendor: { legal_name: 'Ryan Mitchell', phone: '+1 212 555 0104', email: 'ryan.mitchell@example.com', dob: '1979-12-03' },
		employer: { legal_name: 'Hudson Engineering Inc.', short_name: 'Hudson Engineering', phone: '+1 212 555 0200', email: 'info@hudson-eng.example.com' },
		consultancy: { legal_name: 'Blue Kite Consulting LLC', short_name: 'Blue Kite Consulting', phone: '+1 212 555 0300', email: 'admin@bluekite.example.com' },
		holdings: { legal_name: 'Lakeside Holdings LLC', short_name: 'Lakeside Holdings', phone: '+1 212 555 0400', email: 'finance@lakeside.example.com' },
	},
	EU: {
		bankIds: ['eu-ing-inv', 'eu-abn-inv', 'eu-rabo-inv'],
		suspect: { legal_name: 'Pieter de Vries', phone: '+31 6 5550 0101', email: 'pieter.devries@example.eu', dob: '1984-06-15' },
		spouse: { legal_name: 'Anouk de Vries', phone: '+31 6 5550 0102', email: 'anouk.devries@example.eu', dob: '1986-09-22' },
		colleague: { legal_name: 'Sanne Jansen', phone: '+31 6 5550 0103', email: 'sanne.jansen@example.eu', dob: '1990-02-10' },
		vendor: { legal_name: 'Daan Bakker', phone: '+31 6 5550 0104', email: 'daan.bakker@example.eu', dob: '1979-12-03' },
		employer: { legal_name: 'Delta Engineering B.V.', short_name: 'Delta Engineering', phone: '+31 20 555 0200', email: 'info@delta-eng.example.eu' },
		consultancy: { legal_name: 'Blue Kite Consulting B.V.', short_name: 'Blue Kite Consulting', phone: '+31 20 555 0300', email: 'admin@bluekite.example.eu' },
		holdings: { legal_name: 'Oranje Holdings B.V.', short_name: 'Oranje Holdings', phone: '+31 20 555 0400', email: 'finance@oranje.example.eu' },
	},
	ZA: {
		bankIds: ['za-fnb-inv', 'za-std-inv', 'za-ndb-inv'],
		suspect: { legal_name: 'Thabo Maseko', phone: '+27 82 555 0101', email: 'thabo.maseko@example.co.za', dob: '1984-06-15' },
		spouse: { legal_name: 'Lerato Maseko', phone: '+27 83 555 0102', email: 'lerato.maseko@example.co.za', dob: '1986-09-22' },
		colleague: { legal_name: 'Nomsa Dlamini', phone: '+27 84 555 0103', email: 'nomsa.dlamini@example.co.za', dob: '1990-02-10' },
		vendor: { legal_name: 'Karabo Molefe', phone: '+27 76 555 0104', email: 'karabo.molefe@example.co.za', dob: '1979-12-03' },
		employer: { legal_name: 'Mzansi Engineering (Pty) Ltd', short_name: 'Mzansi Engineering', phone: '+27 11 555 0200', email: 'info@mzansi-eng.example.co.za' },
		consultancy: { legal_name: 'Blue Kite Consulting (Pty) Ltd', short_name: 'Blue Kite Consulting', phone: '+27 11 555 0300', email: 'admin@bluekite.example.co.za' },
		holdings: { legal_name: 'Ndlovu Holdings (Pty) Ltd', short_name: 'Ndlovu Holdings', phone: '+27 11 555 0400', email: 'finance@ndlovu.example.co.za' },
	},
	NG: {
		bankIds: ['ng-gtb-inv', 'ng-zenith-inv', 'ng-access-inv'],
		suspect: { legal_name: 'Chinedu Okafor', phone: '+234 803 555 0101', email: 'chinedu.okafor@example.ng', dob: '1984-06-15' },
		spouse: { legal_name: 'Ngozi Okafor', phone: '+234 803 555 0102', email: 'ngozi.okafor@example.ng', dob: '1986-09-22' },
		colleague: { legal_name: 'Aisha Bello', phone: '+234 803 555 0103', email: 'aisha.bello@example.ng', dob: '1990-02-10' },
		vendor: { legal_name: 'Tunde Adeyemi', phone: '+234 803 555 0104', email: 'tunde.adeyemi@example.ng', dob: '1979-12-03' },
		employer: { legal_name: 'Niger Delta Engineering Ltd', short_name: 'Niger Delta Engineering', phone: '+234 1 555 0200', email: 'info@ndelta-eng.example.ng' },
		consultancy: { legal_name: 'Blue Kite Consulting Ltd', short_name: 'Blue Kite Consulting', phone: '+234 1 555 0300', email: 'admin@bluekite.example.ng' },
		holdings: { legal_name: 'Eko Holdings Ltd', short_name: 'Eko Holdings', phone: '+234 1 555 0400', email: 'finance@eko.example.ng' },
	},
	TZ: {
		bankIds: ['tz-crdb-inv', 'tz-nmb-inv', 'tz-nbc-inv'],
		suspect: { legal_name: 'Juma Mollel', phone: '+255 754 555 0101', email: 'juma.mollel@example.tz', dob: '1984-06-15' },
		spouse: { legal_name: 'Neema Mollel', phone: '+255 754 555 0102', email: 'neema.mollel@example.tz', dob: '1986-09-22' },
		colleague: { legal_name: 'Rehema Mushi', phone: '+255 754 555 0103', email: 'rehema.mushi@example.tz', dob: '1990-02-10' },
		vendor: { legal_name: 'Hassan Ally', phone: '+255 754 555 0104', email: 'hassan.ally@example.tz', dob: '1979-12-03' },
		employer: { legal_name: 'Kilimanjaro Engineering Ltd', short_name: 'Kilimanjaro Engineering', phone: '+255 22 555 0200', email: 'info@kili-eng.example.tz' },
		consultancy: { legal_name: 'Blue Kite Consulting Ltd', short_name: 'Blue Kite Consulting', phone: '+255 22 555 0300', email: 'admin@bluekite.example.tz' },
		holdings: { legal_name: 'Pwani Holdings Ltd', short_name: 'Pwani Holdings', phone: '+255 22 555 0400', email: 'finance@pwani.example.tz' },
	},
	OM: {
		bankIds: ['om-bmus-inv', 'om-nbo-inv', 'om-bdof-inv'],
		suspect: { legal_name: 'Said Al Hinai', phone: '+968 9555 0101', email: 'said.alhinai@example.om', dob: '1984-06-15' },
		spouse: { legal_name: 'Fatma Al Hinai', phone: '+968 9555 0102', email: 'fatma.alhinai@example.om', dob: '1986-09-22' },
		colleague: { legal_name: 'Noor Al Zadjali', phone: '+968 9555 0103', email: 'noor.alzadjali@example.om', dob: '1990-02-10' },
		vendor: { legal_name: 'Yousuf Al Amri', phone: '+968 9555 0104', email: 'yousuf.alamri@example.om', dob: '1979-12-03' },
		employer: { legal_name: 'Majan Engineering LLC', short_name: 'Majan Engineering', phone: '+968 2455 0200', email: 'info@majan-eng.example.om' },
		consultancy: { legal_name: 'Blue Kite Consulting LLC', short_name: 'Blue Kite Consulting', phone: '+968 2455 0300', email: 'admin@bluekite.example.om' },
		holdings: { legal_name: 'Al Jabal Holdings LLC', short_name: 'Al Jabal Holdings', phone: '+968 2455 0400', email: 'finance@aljabal.example.om' },
	},
};

export function getCaseExample(countryCode: string): CaseExampleCast {
	return CASE_EXAMPLES[countryCode] || CASE_EXAMPLES[getCountryConfig(countryCode).code];
}
