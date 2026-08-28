(function () {
    const replacements = {
        'প্রাণিসম্পদ অধিদপ্তর': 'Department of Livestock Services',
        'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার': "Government of the People's Republic of Bangladesh",
        'গভর্নমেন্ট ম্যানেজমেন্ট সিস্টেম': 'Government Management System',
        'স্মার্ট ডিজিটাল গভর্নেন্স নেটওয়ার্ক': 'Smart Digital Governance Network',
        'জাতীয় প্রাণিসম্পদ': 'National Livestock',
        'সম্পদ ও বাজেট ব্যবস্থাপনা ব্যবস্থা': 'Resource and Budget Management System',
        'আমাদের লক্ষ্য ও রূপকল্প': 'Our Mission and Vision',
        'আমাদের লক্ষ্য': 'Our Mission',
        'বৈশিষ্ট্যসমূহ': 'Features',
        'যোগাযোগ': 'Contact',
        'লগইন / সাইনআপ': 'Login / Sign Up',
        'পোর্টালে প্রবেশ করুন': 'Enter the Portal',
        'বিস্তারিত মিশন দেখুন': 'View Mission Details',
        'পোর্টালে অন্তর্ভুক্ত মূল ফিচারসমূহ': 'Key Features Included in the Portal',
        'প্রশাসনিক স্তর অনুযায়ী সমন্বিত কর্মপদ্ধতি': 'Integrated Workflow by Administrative Level',
        'স্বচ্ছতা ও জবাবদিহিতা': 'Transparency and Accountability',
        'দ্রুত সিদ্ধান্ত গ্রহণ': 'Rapid Decision-Making',
        'উৎপাদন বৃদ্ধিকরণ': 'Production Growth',
        'কেন্দ্রীয় ও আঞ্চলিক ইনভেন্টরি': 'Central and Regional Inventory',
        'ডিজিটাল চাহিদা ও অনুমোদন': 'Digital Requests and Approvals',
        'খামার উৎপাদন ট্র্যাকিং': 'Farm Production Tracking',
        'রোগ প্রাদুর্ভাব অ্যালার্ট': 'Disease Outbreak Alert',
        'মাল্টি-লেভেল রোল অ্যাক্সেস': 'Multi-Level Role Access',
        'প্রধান মেনু': 'Main Menu',
        'ড্যাশবোর্ড ওভারভিউ': 'Dashboard Overview',
        'ওভারভিউ': 'Overview',
        'প্রোফাইল দেখুন ও সম্পাদনা': 'View and Edit Profile',
        'প্রোফাইল দেখুন': 'View Profile',
        'প্রোফাইল সম্পাদনা': 'Edit Profile',
        'প্রোফাইল তথ্য': 'Profile Information',
        'পূর্ণ নাম': 'Full Name',
        'পদবি': 'Designation',
        'অফিসিয়াল ইমেইল': 'Official Email',
        'মোবাইল নম্বর': 'Mobile Number',
        'নতুন পাসওয়ার্ড (ঐচ্ছিক)': 'New Password (Optional)',
        'পরিবর্তন সংরক্ষণ করুন': 'Save Changes',
        'লগআউট': 'Logout',
        'প্রকল্প পরিচালক': 'Project Director',
        'প্রজেক্ট পরিকল্পনা দেখুন': 'View Project Plan',
        'প্রজেক্ট পরিকল্পনা': 'Project Plan',
        'ক্রয় রেকর্ড হালনাগাদ': 'Update Purchase Records',
        'বাজেট অনুরোধ করুন': 'Request Budget',
        'প্রজেক্টের বিস্তারিত দেখুন': 'View Project Details',
        'প্রকল্প বাস্তবায়ন ইউনিট': 'Project Implementation Unit',
        'বাজেট ও অর্থ উইং': 'Budget and Finance Wing',
        'পরিকল্পনা উইং': 'Planning Wing',
        'উৎপাদন উইং': 'Production Wing',
        'স্টোর ও সরবরাহ উইং': 'Store and Supply Wing',
        'ফিল্ড অপারেশন': 'Field Operations',
        'জেলা প্রশাসনিক পোর্টাল': 'District Administrative Portal',
        'পরিকল্পনা ও উন্নয়ন': 'Planning and Development',
        'উৎপাদন ও খামার': 'Production and Farms',
        'স্টোর ও সরবরাহ': 'Store and Supply',
        'বাজেট ও অর্থ': 'Budget and Finance',
        'উপজেলা প্রাণিসম্পদ কর্মকর্তা': 'Upazila Livestock Officer',
        'খামার ব্যবস্থাপক': 'Farm Manager',
        'নতুন ঘোষণা দিন': 'Make New Announcement',
        'নতুন বাজেট বরাদ্দ যোগ করুন': 'Add New Budget Allocation',
        'নতুন প্রজেক্ট প্রস্তাবনা': 'New Project Proposal',
        'নতুন সরবরাহ তৈরি করুন': 'Create New Supply',
        'নতুন ক্রয় রেকর্ড যোগ করুন': 'Add New Purchase Record',
        'নতুন ডাটা যুক্ত করুন': 'Add New Data',
        'দৈনিক প্রোডাকশন এন্ট্রি': 'Daily Production Entry',
        'প্রধান উন্নয়ন প্রকল্পসমূহ': 'Major Development Projects',
        'চলমান প্রধান উন্নয়ন প্রকল্পসমূহ': 'Major Ongoing Development Projects',
        'মোট প্রকল্প বাজেট': 'Total Project Budget',
        'প্রকল্প বাস্তবায়ন হার': 'Project Implementation Rate',
        'অপেক্ষমাণ ক্রয় প্রস্তাব': 'Pending Purchase Proposals',
        'চলতি ADP বাজেট': 'Current ADP Budget',
        'চলমান প্রকল্প': 'Ongoing Projects',
        'চলতি মাসের স্টোর বরাদ্দ': 'Current Month Store Allocation',
        'মোট আওতাধীন উপজেলা': 'Total Upazilas Covered',
        'অনুমোদনের অপেক্ষায়': 'Awaiting Approval',
        'অপেক্ষমাণ': 'Pending',
        'অনুমোদিত': 'Approved',
        'বাতিল': 'Cancelled',
        'রিপোর্ট ও রিপোর্ট প্রদান': 'Reports and Reporting',
        'জেলা ইনভেন্টরি': 'District Inventory',
        'উপজেলা রিকোয়েস্ট': 'Upazila Requests',
        'বাজেট অনুমোদন': 'Budget Approval',
        'চাহিদা আবেদন': 'Demand Application',
        'চাহিদা অনুরোধ': 'Demand Request',
        'চাহিদা অনুরোধ যাচাই': 'Review Demand Requests',
        'সরকারি খামারসমূহ': 'Government Farms',
        'ব্রিডিং ও প্রজনন রেকর্ড': 'Breeding Records',
        'দুগ্ধ ও মাংস উৎপাদন ডাটা': 'Milk and Meat Production Data',
        'ইনভেন্টরি স্টোর চেক': 'Check Inventory Store',
        'চাহিদা ফরম তৈরি': 'Create Demand Form',
        'চাহিদা আবেদনের স্ট্যাটাস': 'Demand Application Status',
        'নোটিফিকেশনসমূহ': 'Notifications',
        'দৈনিক এন্ট্রি (দুধ/ডিম)': 'Daily Entry (Milk/Eggs)',
        'গবাদিপশু রেজিস্টার': 'Livestock Register',
        'ভ্যাকসিনেশন ও চিকিৎসা': 'Vaccination and Treatment',
        'দৈনিক দুধ উৎপাদন': 'Daily Milk Production',
        'মোট নিবন্ধিত খামার': 'Total Registered Farms',
        'ডিম উৎপাদন (দৈনিক)': 'Daily Egg Production',
        'আজকের দুধ সংগ্রহ': "Today's Milk Collection",
        'মোট গবাদিপশু': 'Total Livestock',
        'চিকিৎসাধীন পশু': 'Animals Under Treatment',
        'সাম্প্রতিক দৈনিক উৎপাদন এন্ট্রি লগ': 'Recent Daily Production Entry Log',
        'সাম্প্রতিক বাজেট অনুরোধসমূহ': 'Recent Budget Requests',
        'সাম্প্রতিক চাহিদা আবেদন': 'Recent Demand Applications',
        'পরিবর্তন': 'Change',
        'সম্পাদনা করুন': 'Edit',
        'অনুমোদন দিন': 'Approve',
        'প্রত্যাখ্যান': 'Reject',
        'সম্পন্ন হয়েছে': 'Completed',
        'শুরু হয়নি': 'Not Started',
        'অগ্রগতি': 'Progress',
        'তারিখ': 'Date',
        'স্ট্যাটাস': 'Status',
        'পরিমাণ': 'Quantity',
        'পরিমাণ/বাজেট': 'Quantity/Budget',
        'বিবরণ / আইটেম': 'Description / Item',
        'ট্র্যাকিং আইডি': 'Tracking ID',
        'প্রেরক দপ্তর': 'Requesting Office',
        'পণ্যের নাম': 'Product Name',
        'খামারের নাম': 'Farm Name',
        'স্থান': 'Location',
        'পশু সংখ্যা': 'Animal Count',
        'পোর্টালে': 'Portal',
        'উইং': 'Wing',
        'কোটি': 'crore',
        'লক্ষ': 'million',
        'ডোজ': 'doses',
        'লিটার': 'liters',
        'কেজি': 'kg',
        'টি': '',
        'সম্পন্ন': 'Complete',
        'প্রক্রিয়াধীন': 'In Progress',
        'অনুমোদনের অপেক্ষায়': 'Awaiting Approval',
        'জরুরি': 'Urgent',
        'উচ্চ': 'High',
        'স্বাভাবিক': 'Normal',
        'অর্থবছর': 'Fiscal Year',
        'মেয়াদ': 'Duration',
        'মেয়াদ': 'Duration',
        'অগ্রাধিকার স্তর': 'Priority Level',
        'নির্মাণ ও অবকাঠামো': 'Construction and Infrastructure',
        'প্রশিক্ষণ ও কর্মশালা': 'Training and Workshop',
        'যন্ত্রপাতি ক্রয়': 'Equipment Purchase',
        'মূল উদ্দেশ্য': 'Main Objective',
        'প্রকল্পের নাম': 'Project Name',
        'প্রকল্প কোড': 'Project Code',
        'মোট বরাদ্দ': 'Total Allocation',
        'ব্যয়িত': 'Spent',
        'বাজেট অনুরোধসমূহ': 'Budget Requests',
        'বার্ষিক বাজেট': 'Annual Budget',
        'বার্ষিক মোট বাজেট': 'Total Annual Budget',
        'এই মাসে অনুমোদিত': 'Approved This Month',
        'বার্ষিক বাজেট বণ্টন': 'Annual Budget Distribution',
        'প্রকল্প পরিচালক ড্যাশবোর্ড': 'Project Director Dashboard',
        'পরিচালক': 'Director',
        'ড. মো:': 'Dr. Md.',
        'জনাব মো:': 'Mr. Md.',
        'মো:': 'Md.',
        'প্রাণীসম্পদ': 'Livestock',
        'ডেইরি': 'Dairy',
        'উন্নয়ন': 'Development',
        'সাভার': 'Savar',
        'ঢাকা': 'Dhaka',
        'কুমিল্লা': 'Cumilla',
        'রংপুর': 'Rangpur',
        'বগুড়া': 'Bogura',
        'কেন্দ্রীয়': 'Central',
        'জাতীয়': 'National',
        'সরকারি': 'Government',
        'উপজেলা প্রাণিসম্পদ দপ্তর থেকে শুরু করে জাতীয় প্রশাসনিক কার্যালয় পর্যন্ত ভ্যাকসিন বন্টন, ওষুধ মজুদ, জরুরী চিকিৎসা সেবা এবং উৎপাদন মনিটরিং নিশ্চিত করার সমন্বিত সরকারি ডিজিটাল অবকাঠামো।': 'An integrated government digital infrastructure ensuring vaccine distribution, medicine inventory, emergency medical services, and production monitoring from Upazila livestock offices to national administrative offices.',
        'স্মার্ট বাংলাদেশ গঠনে প্রাণিসম্পদ খাতকে আধুনিকীকরণের মাধ্যমে দেশের খাদ্য নিরাপত্তা নিশ্চিত করা এবং প্রান্তিক খামারিদের কাছে সরকারি সেবা দ্রুত পৌঁছে দেওয়া।': "Ensure the country's food security by modernizing the livestock sector to build Smart Bangladesh and rapidly deliver government services to marginal farmers.",
        'মাঠ পর্যায় থেকে কেন্দ্র পর্যন্ত ভ্যাকসিন ও ঔষধ বরাদ্দের প্রতিটি ধাপ ডিজিটাল ট্র্যাকিংয়ের মাধ্যমে স্বচ্ছ রাখা।': 'Keep every stage of vaccine and medicine allocation transparent through digital tracking from the field level to the central level.',
        'রিয়েল-টাইম রিপোর্টিংয়ের মাধ্যমে রোগ প্রাদুর্ভাব নিয়ন্ত্রণ এবং চাহিদাপত্র দ্রুত অনুমোদন প্রদান করা।': 'Control disease outbreaks and quickly approve requisitions through real-time reporting.',
        'জাতীয় পর্যায়ে দুধ, মাংস ও ডিমের সঠিক উৎপাদন ডাটা সংকলন করে ভবিষ্যৎ নীতি নির্ধারণ।': 'Compile accurate national production data for future policy-making.',
        'জাতীয় কোল্ড-চেন স্টোর এবং জেলা ও উপজেলা ইনভেন্টরির রিয়েল-টাইম ভ্যাকসিন, প্রসেসড ফিড ও ঔষধের মজুদ মনিটরিং।': 'Real-time monitoring of vaccine, processed feed, and medicine inventories in national, district, and Upazila stores.',
        'উপজেলা কর্মকর্তারা তাদের নির্দিষ্ট চাহিদা তৈরি করে সরাসরি জেলা ও সেন্ট্রাল ডিরেক্টরের অনুমোদনের জন্য পাঠাতে পারেন।': 'Upazila officers can create specific requests and send them directly to the District and Central Director for approval.',
        'সরকারী ও নিবন্ধিত বেসরকারি খামারগুলোর দৈনিক দুধ, ডিম ও গবাদিপশুর প্রজনন ডাটা এন্ট্রি ও বিশ্লেষণ ব্যবস্থা।': 'Daily data entry and analysis for milk, eggs, and livestock breeding from government and registered private farms.',
        'বার্ষিক উন্নয়ন কর্মসূচির (ADP) বাজেট বরাদ্দ, ফিল্ড লেভেল প্রজেক্ট অগ্রগতি ও অর্থ খরচের নিখুঁত পরিসংখ্যান।': 'Accurate statistics on ADP budget allocations, field-level project progress, and expenditure.',
        'যেকোনো উপজেলা এলাকায় সংক্রামক রোগের প্রাদুর্ভাব দেখা দিলে দ্রুত সেন্ট্রাল অ্যালার্ট ও জরুরি ভ্যাকসিন সরবরাহ টিম গঠন।': 'When an infectious disease outbreak occurs in any Upazila area, quickly issue a central alert and form an emergency vaccine supply team.',
        'উপজেলা, জেলা, সেন্ট্রাল ডিরেক্টর এবং ফার্ম ম্যানেজমেন্টের জন্য আলাদা রোল-ভিত্তিক ড্যাশবোর্ড ও নিয়ন্ত্রণাঙ্ক।': 'Separate role-based dashboards and controls for Upazila, District, Central Director, and Farm Management.',
        'কভারেজ': 'Coverage',
        'লাইভ ট্র্যাকিং': 'Live Tracking',
        'সিস্টেম': 'System',
        'সেবা': 'Service',
        'অনুমোদন': 'Approval',
        'ডিজিটাল': 'Digital',
        'বন্টন': 'Distribution',
        'জরুরী': 'Emergency',
        'চিকিৎসা সেবা': 'Medical Services',
        'মনিটরিং': 'Monitoring',
        'কর্মসূচি': 'Programme',
        'পরিসংখ্যান': 'Statistics',
        'কার্যালয়': 'Office',
        'দপ্তর': 'Office',
        'কোল্ড-চেন': 'Cold Chain',
        'প্রসেসড ফিড': 'Processed Feed',
        'ঔষধ': 'Medicine',
        'মজুদ': 'Inventory',
        'প্রান্তিক': 'Marginal',
        'খামারিদের': 'Farmers',
        'খামারগুলোর': 'Farms',
        'নিবন্ধিত': 'Registered',
        'বেসরকারি': 'Private',
        'গবাদিপশুর': 'Livestock',
        'প্রজনন': 'Breeding',
        'বাজেট': 'Budget',
        'প্রজেক্ট': 'Project',
        'ফিচারসমূহ': 'Features',
        'ইউজার আইডি / ইমেইল': 'User ID / Email',
        'ইউজার রোল নির্বাচন করুন:': 'Select User Role:',
        'পাসওয়ার্ড': 'Password',
        'লগইন করুন': 'Log In',
        'রেজিস্ট্রেশন': 'Registration',
        'আবেদন জমা দিন': 'Submit Application',
        'কাঙ্ক্ষিত রোল (Role)': 'Desired Role',
        'পাসওয়ার্ড সেট করুন': 'Set Password',
        'কৃষি খামার সড়ক, ফার্মগেট, ঢাকা-১২১৫।': 'Krishi Khamar Road, Farmgate, Dhaka-1215.',
        'জরুরি হেল্পলাইন': 'Emergency Helpline',
        'হটলাইন: ১৬১২৩': 'Hotline: 16123',
        'কারিগরি সহায়তা: +৮৮০ ২-৯১২২২২২': 'Technical Support: +880 2-9122222',
        'হ্যাকাতন প্রজেক্ট': 'Hackathon Project',
        '© ২০২৬ ন্যাশনাল হ্যাকাতন টিম দ্বারা তৈরিকৃত।': '© 2026 Created by the National Hackathon Team.',
        'উপজেলা': 'Upazila',
        'জেলা': 'District',
        'ফার্ম': 'Farm',
        'খামার': 'Farm',
        'ম্যানেজার': 'Manager',
        'রেকর্ড': 'Record',
        'তথ্য': 'Information',
        'নাম': 'Name',
        'সরবরাহ': 'Supply',
        'মজুদ': 'Inventory',
        'স্টোর': 'Store',
        'চালান': 'Shipments',
        'চিকিৎসা': 'Medical',
        'ভ্যাকসিন': 'Vaccine',
        'ওষুধ': 'Medicine',
        'দুধ': 'Milk',
        'ডিম': 'Eggs',
        'মাংস': 'Meat',
        'উৎপাদন': 'Production',
        'ডাটা': 'Data',
        'প্রধান': 'Main',
        'নতুন': 'New',
        'যোগ': 'Add',
        'দেখুন': 'View',
        'হালনাগাদ': 'Update',
        'অনুরোধ': 'Request',
        'দিন': 'Give',
        'কার্যক্রম': 'Action',
        'বিষয়': 'Subject',
        'শিফট': 'Shift',
        'সকাল': 'Morning',
        'বিকাল': 'Afternoon',
        'আজকের আপডেট': "Today's Update",
        'আপডেট': 'Updated',
        'অনুমোদন': 'Approval',
        'সরবরাহকৃত': 'Supplied',
        'মোট': 'Total',
        'প্রতিদিন': 'Daily',
        'লক্ষ্যমাত্রা অনুযায়ী': 'According to Target'
        , 'প্রাণিসম্পদ': 'Livestock'
        , 'থেকে': 'from'
        , 'শুরু': 'start'
        , 'করে': 'and'
        , 'পর্যন্ত': 'to'
        , 'জাতীয়': 'National'
        , 'প্রশাসনিক': 'Administrative'
        , 'কার্যালয়': 'Office'
        , 'নিশ্চিত': 'ensuring'
        , 'সমন্বিত': 'integrated'
        , 'অবকাঠামো': 'infrastructure'
        , 'স্মার্ট': 'Smart'
        , 'বাংলাদেশ': 'Bangladesh'
        , 'গঠন': 'build'
        , 'খাতকে': 'sector'
        , 'আধুনিকীকরণের': 'modernization'
        , 'দেশের': "country's"
        , 'খাদ্য': 'food'
        , 'নিরাপত্তা': 'security'
        , 'প্রান্তিক': 'marginal'
        , 'কাছে': 'to'
        , 'দ্রুত': 'quickly'
        , 'পৌঁছে': 'deliver'
        , 'দেওয়া': 'provide'
        , 'মাঠ': 'field'
        , 'পর্যায়': 'level'
        , 'কেন্দ্র': 'center'
        , 'প্রতিটি': 'every'
        , 'ধাপ': 'step'
        , 'ট্র্যাকিং': 'tracking'
        , 'স্বচ্ছ': 'transparent'
        , 'রিপোর্টিং': 'reporting'
        , 'রিয়েল-টাইম': 'real-time'
        , 'রিপোর্ংয়ের': 'reporting'
        , 'রোগ': 'disease'
        , 'প্রাদুর্ভাব': 'outbreak'
        , 'নিয়ন্ত্রণ': 'control'
        , 'চাহিদাপত্র': 'requisition'
        , 'প্রদান': 'provide'
        , 'জাতীয়': 'national'
        , 'সঠিক': 'accurate'
        , 'সংকলন': 'compile'
        , 'ভবিষ্যৎ': 'future'
        , 'নীতি': 'policy'
        , 'নির্ধারণ': 'making'
        , 'এবং': 'and'
        , 'ও': 'and'
        , 'থেকে': 'from'
        , 'জন্য': 'for'
        , 'তাদের': 'their'
        , 'নির্দিষ্ট': 'specific'
        , 'তৈরি': 'create'
        , 'সরাসরি': 'directly'
        , 'সেন্ট্রাল': 'Central'
        , 'ডিরেক্টরের': "Director's"
        , 'কর্মকর্তারা': 'officers'
        , 'কর্মকর্তা': 'Officer'
        , 'চাহিদা': 'request'
        , 'পাঠাতে': 'send'
        , 'পারে': 'can'
        , 'সরকারী': 'Government'
        , 'নিবন্ধিত': 'registered'
        , 'বেসরকারি': 'private'
        , 'খামারগুলোর': 'farms'
        , 'দৈনিক': 'daily'
        , 'গবাদিপশুর': 'livestock'
        , 'এন্ট্রি': 'entry'
        , 'বিশ্লেষণ': 'analysis'
        , 'ব্যবস্থা': 'system'
        , 'বার্ষিক': 'Annual'
        , 'ফিল্ড লেভেল': 'field-level'
        , 'অর্থ': 'finance'
        , 'খরচের': 'expenditure'
        , 'নিখুঁত': 'accurate'
        , 'যেকোনো': 'any'
        , 'এলাকায়': 'area'
        , 'সংক্রামক': 'infectious'
        , 'দেখা': 'occurs'
        , 'অ্যালার্ট': 'alert'
        , 'সরবরাহ': 'supply'
        , 'টিম': 'team'
        , 'গঠন': 'form'
        , 'রোল-ভিত্তিক': 'role-based'
        , 'ড্যাশবোর্ড': 'Dashboard'
        , 'নিয়ন্ত্রণাঙ্ক': 'controls'
        , 'ইমেইল': 'Email'
        , 'হেল্পলাইন': 'Helpline'
        , 'ন্যাশনাল': 'National'
        , 'টিম': 'Team'
        , 'করার': 'to'
        , 'গঠনে': 'to build'
        , 'মাধ্যমে': 'through'
        , 'বরাদ্দের': 'allocation'
        , 'প্রতি': 'every'
        , 'রাখা': 'keep'
        , 'পৌঁছে': 'deliver'
        , 'দেওয়া': 'provide'
        , 'পর্যায়ে': 'level'
        , 'ইনভেন্টরির': 'inventory'
        , 'Medicineের': 'Medicine'
        , 'Eggsের': 'Eggs'
        , 'Programmeর': 'Programme'
        , 'দিলে': 'when'
        , 'ডিরেক্টর': 'Director'
        , 'ম্যানেজমেন্টের': 'Management'
        , 'আলাদা': 'separate'
        , 'রোল': 'role'
        , 'ফরম': 'form'
        , 'পেন্ডিং': 'Pending'
        , 'ইমেইল:': 'Email:'
        , 'লগইন': 'Login'
    };

    const bengaliDigits = '০১২৩৪৫৬৭৮৯';
    function translate(value) {
        let result = value;
        Object.keys(replacements).sort((a, b) => b.length - a.length).forEach((source) => {
            result = result.split(source).join(replacements[source]);
        });
        result = result.replace(/[০-৯]/g, (digit) => String(bengaliDigits.indexOf(digit)));
        result = result.replace(/[\u0980-\u09FF]+/g, ' ');
        return result;
    }

    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            node.nodeValue = translate(node.nodeValue);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            ['title', 'placeholder', 'value', 'aria-label'].forEach((attribute) => {
                if (node.hasAttribute(attribute)) node.setAttribute(attribute, translate(node.getAttribute(attribute)));
            });
            node.childNodes.forEach(translateNode);
        }
    }

    document.documentElement.lang = 'en';
    translateNode(document.documentElement);
})();
