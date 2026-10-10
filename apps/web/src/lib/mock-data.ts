// Initial interactive demo data for College Ess showcase presentation

export interface DemoUser {
  name: string;
  email: string;
  id: string;
  rollNo: string;
  college: string;
  branch: string;
  semester: string;
}

export const DEMO_USER: DemoUser = {
  name: "Harshit",
  email: "harshit@nitc.ac.in",
  id: "usr_01j8k9x4m2b8",
  rollNo: "22BCS048",
  college: "National Institute of Technology",
  branch: "Computer Science & Engineering",
  semester: "5th Semester",
};

export interface TaskItem {
  id: string;
  title: string;
  category: "Academic" | "Club" | "Personal" | "Urgent";
  dueDate: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
}

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: "task-1",
    title: "Distributed Systems Lab 3 report submission",
    category: "Academic",
    dueDate: "Today, 11:59 PM",
    priority: "high",
    completed: false,
  },
  {
    id: "task-2",
    title: "Draft sponsorship proposal for Ignite Fest",
    category: "Club",
    dueDate: "Tomorrow, 5:00 PM",
    priority: "medium",
    completed: false,
  },
  {
    id: "task-3",
    title: "Buy laundry detergent pods & room snacks",
    category: "Personal",
    dueDate: "Friday",
    priority: "low",
    completed: false,
  },
  {
    id: "task-4",
    title: "Algorithms: Review NP-Completeness proofs",
    category: "Academic",
    dueDate: "Midsem in 6 days",
    priority: "high",
    completed: false,
  },
  {
    id: "task-5",
    title: "Sign lab attendance register at Admin block",
    category: "Urgent",
    dueDate: "Done earlier",
    priority: "medium",
    completed: true,
  },
];

export interface ClassBlock {
  id: string;
  courseCode: string;
  courseName: string;
  instructor: string;
  hall: string;
  startTime: string;
  endTime: string;
  status: "done" | "in-progress" | "upcoming";
  type: "Lecture" | "Lab" | "Club";
}

export const TODAY_SCHEDULE: ClassBlock[] = [
  {
    id: "cls-1",
    courseCode: "CS301",
    courseName: "Advanced Data Structures & Algorithms",
    instructor: "Prof. R. Sharma",
    hall: "Lecture Hall 302",
    startTime: "08:30",
    endTime: "09:30",
    status: "done",
    type: "Lecture",
  },
  {
    id: "cls-2",
    courseCode: "CS305L",
    courseName: "Distributed Systems Laboratory",
    instructor: "Dr. K. Verma & TA Rahul",
    hall: "Computing Lab 2",
    startTime: "10:15",
    endTime: "12:15",
    status: "in-progress",
    type: "Lab",
  },
  {
    id: "cls-3",
    courseCode: "CS303",
    courseName: "Computer Networks & Protocols",
    instructor: "Dr. Ananya Sen",
    hall: "Lecture Hall 101",
    startTime: "14:00",
    endTime: "15:00",
    status: "upcoming",
    type: "Lecture",
  },
  {
    id: "cls-4",
    courseCode: "CLB-DR",
    courseName: "🎭 Thespians Drama Society Meet",
    instructor: "Student Coordinators",
    hall: "Amphitheatre Area",
    startTime: "16:30",
    endTime: "18:00",
    status: "upcoming",
    type: "Club",
  },
];

export interface WardrobeItem {
  id: string;
  name: string;
  type: "Top" | "Bottom" | "Shoes" | "Layer";
  wearsLeft: number;
  maxWears: number;
  colorName: string;
  tag: string;
  inLaundry: boolean;
  emoji: string;
}

export const INITIAL_WARDROBE: WardrobeItem[] = [
  {
    id: "drip-1",
    name: "Classic Oxford Navy Shirt",
    type: "Top",
    wearsLeft: 2,
    maxWears: 3,
    colorName: "Navy",
    tag: "Formal / Class",
    inLaundry: false,
    emoji: "👔",
  },
  {
    id: "drip-2",
    name: "Oversized Charcoal Graphic Tee",
    type: "Top",
    wearsLeft: 1,
    maxWears: 2,
    colorName: "Charcoal",
    tag: "Casual / Lab",
    inLaundry: false,
    emoji: "👕",
  },
  {
    id: "drip-3",
    name: "Slim Fit Khaki Chinos",
    type: "Bottom",
    wearsLeft: 3,
    maxWears: 5,
    colorName: "Khaki",
    tag: "Everyday",
    inLaundry: false,
    emoji: "👖",
  },
  {
    id: "drip-4",
    name: "Relaxed Black Cargo Trousers",
    type: "Bottom",
    wearsLeft: 2,
    maxWears: 4,
    colorName: "Black",
    tag: "Streetwear",
    inLaundry: false,
    emoji: "👖",
  },
  {
    id: "drip-5",
    name: "Vintage White Court Sneakers",
    type: "Shoes",
    wearsLeft: 12,
    maxWears: 15,
    colorName: "White",
    tag: "Sneakers",
    inLaundry: false,
    emoji: "👟",
  },
  {
    id: "drip-6",
    name: "Forest Green College Hoodie",
    type: "Layer",
    wearsLeft: 0,
    maxWears: 4,
    colorName: "Forest Green",
    tag: "Needs Wash",
    inLaundry: true,
    emoji: "🧥",
  },
];

export interface HabitItem {
  id: string;
  title: string;
  target: string;
  streak: number;
  completedToday: boolean;
  category: string;
  history: boolean[]; // Last 7 days
}

export const INITIAL_HABITS: HabitItem[] = [
  {
    id: "groove-1",
    title: "Daily 2.5L Water Intake",
    target: "2.5 Litres",
    streak: 14,
    completedToday: true,
    category: "Health",
    history: [true, true, true, true, true, true, true],
  },
  {
    id: "groove-2",
    title: "LeetCode Daily Challenge",
    target: "1 Problem",
    streak: 21,
    completedToday: true,
    category: "Coding",
    history: [true, true, true, true, true, true, true],
  },
  {
    id: "groove-3",
    title: "Campus Gym / 30m Run",
    target: "45 Minutes",
    streak: 6,
    completedToday: false,
    category: "Fitness",
    history: [false, true, true, true, true, true, false],
  },
  {
    id: "groove-4",
    title: "Revise Today's Class Slides",
    target: "30 Minutes",
    streak: 5,
    completedToday: false,
    category: "Academics",
    history: [true, false, true, true, true, true, false],
  },
  {
    id: "groove-5",
    title: "Sleep Before 12:30 AM",
    target: "7h Rest",
    streak: 9,
    completedToday: false,
    category: "Sleep",
    history: [true, true, true, true, true, false, false],
  },
];

export interface ExamItem {
  id: string;
  courseCode: string;
  courseName: string;
  date: string;
  time: string;
  hall: string;
  seatNo: string;
  daysRemaining: number;
  credits: number;
}

export const INITIAL_EXAMS: ExamItem[] = [
  {
    id: "exam-1",
    courseCode: "CS305",
    courseName: "Distributed Systems",
    date: "Wednesday, Oct 16",
    time: "09:30 AM – 12:30 PM",
    hall: "Hall LH-201",
    seatNo: "Row C · Seat 42",
    daysRemaining: 6,
    credits: 4,
  },
  {
    id: "exam-2",
    courseCode: "CS303",
    courseName: "Computer Networks",
    date: "Friday, Oct 18",
    time: "02:00 PM – 05:00 PM",
    hall: "Hall LH-104",
    seatNo: "Row B · Seat 18",
    daysRemaining: 8,
    credits: 4,
  },
  {
    id: "exam-3",
    courseCode: "CS301",
    courseName: "Advanced Algorithms",
    date: "Monday, Oct 21",
    time: "09:30 AM – 12:30 PM",
    hall: "Hall LH-301",
    seatNo: "Row A · Seat 05",
    daysRemaining: 11,
    credits: 4,
  },
];

export interface HolidayItem {
  id: string;
  name: string;
  dates: string;
  daysCount: number;
  isLongWeekend: boolean;
  tip?: string;
}

export const INITIAL_HOLIDAYS: HolidayItem[] = [
  {
    id: "break-1",
    name: "Diwali & Mid-Semester Recess",
    dates: "Oct 30 – Nov 3 (5 Days)",
    daysCount: 5,
    isLongWeekend: true,
    tip: "Campus hostels remain open. Mess menu special feast on Nov 1.",
  },
  {
    id: "break-2",
    name: "Guru Nanak Jayanti",
    dates: "Friday, Nov 15",
    daysCount: 3,
    isLongWeekend: true,
    tip: "Friday Holiday + Weekend = 3 days off without taking leaves!",
  },
  {
    id: "break-3",
    name: "End-Semester Winter Vacation",
    dates: "Dec 20 – Jan 5",
    daysCount: 17,
    isLongWeekend: true,
    tip: "Internship & project semester break.",
  },
];

export interface PantryItem {
  id: string;
  name: string;
  category: "Snacks" | "Dairy & Drinks" | "Essentials";
  quantity: string;
  status: "In Stock" | "Low Stock" | "Restock Needed";
  expiryWarning?: string;
}

export const INITIAL_PANTRY: PantryItem[] = [
  {
    id: "pantry-1",
    name: "Amul Taaza Toned Milk (1L)",
    category: "Dairy & Drinks",
    quantity: "1 carton left",
    status: "Low Stock",
    expiryWarning: "Expires tomorrow",
  },
  {
    id: "pantry-2",
    name: "Nescafe Classic Jar (100g)",
    category: "Dairy & Drinks",
    quantity: "70% full",
    status: "In Stock",
  },
  {
    id: "pantry-3",
    name: "Maggi Masala 4-Pack",
    category: "Snacks",
    quantity: "1 packet remaining",
    status: "Restock Needed",
  },
  {
    id: "pantry-4",
    name: "Quaker Rolled Oats (1kg)",
    category: "Snacks",
    quantity: "Full jar",
    status: "In Stock",
  },
  {
    id: "pantry-5",
    name: "Ariel Matic Laundry Pods",
    category: "Essentials",
    quantity: "3 pods remaining",
    status: "Low Stock",
  },
];

export interface ClubItem {
  id: string;
  name: string;
  role: "Coordinator" | "Core Member" | "Member";
  category: string;
  memberCount: number;
  nextMeeting: string;
  openTasks: number;
  description: string;
}

export const INITIAL_CLUBS: ClubItem[] = [
  {
    id: "club-1",
    name: "Thespians Drama Society",
    role: "Coordinator",
    category: "Cultural",
    memberCount: 34,
    nextMeeting: "Today at 4:30 PM @ Amphitheatre",
    openTasks: 3,
    description: "Stage plays, street theatre (Nukkad Natak), and annual inter-college productions.",
  },
  {
    id: "club-2",
    name: "Developer Student Club (GDG)",
    role: "Core Member",
    category: "Technical",
    memberCount: 140,
    nextMeeting: "Saturday 11:00 AM @ Lab 4",
    openTasks: 2,
    description: "Hands-on tech workshops, hackathons, open source cohorts, and speaker sessions.",
  },
  {
    id: "club-3",
    name: "Robotics & Automation Guild",
    role: "Member",
    category: "Technical",
    memberCount: 52,
    nextMeeting: "Sunday 2:00 PM @ Maker Space",
    openTasks: 0,
    description: "Autonomous rovers, combat bots, drone racing, and IoT hardware projects.",
  },
];

export interface CampusEvent {
  id: string;
  title: string;
  tagline: string;
  date: string;
  venue: string;
  category: "Fest" | "Hackathon" | "Guest Talk" | "Sports";
  registered: boolean;
  recommendedOutfit?: string;
}

export const INITIAL_EVENTS: CampusEvent[] = [
  {
    id: "buzz-1",
    title: "WAVE 2026: Annual Cultural Fest",
    tagline: "3 Days of Concerts, Dance Battles & Pro Nights",
    date: "Oct 25 – 27",
    venue: "Main Campus Grounds",
    category: "Fest",
    registered: true,
    recommendedOutfit: "Charcoal Graphic Tee + Black Cargo",
  },
  {
    id: "buzz-2",
    title: "HackNIT 36-Hour National Hackathon",
    tagline: "Build with AI, Web3 & Cloud. ₹2,00,000 Prize Pool.",
    date: "Nov 8 – 9",
    venue: "Student Innovation Centre",
    category: "Hackathon",
    registered: true,
    recommendedOutfit: "College Hoodie + Comfortable Joggers",
  },
  {
    id: "buzz-3",
    title: "Keynote: Scalable Systems in Production",
    tagline: "With Senior Principal Engineer at Google Cloud",
    date: "Nov 12 · 4:00 PM",
    venue: "Main Auditorium",
    category: "Guest Talk",
    registered: false,
    recommendedOutfit: "Oxford Navy Shirt + Chinos",
  },
];

export interface SocialPost {
  id: string;
  author: string;
  handle: string;
  timeAgo: string;
  tag: string;
  content: string;
  upvotes: number;
  commentsCount: number;
}

export const INITIAL_POSTS: SocialPost[] = [
  {
    id: "post-1",
    author: "Library Anonymous",
    handle: "@cs_hostel_3",
    timeAgo: "25m ago",
    tag: "Campus PSA",
    content: "Whoever left their Noise cancelling AirPods on Table 14 in Central Library 2nd floor, I handed them over to the head librarian front desk! 🎧",
    upvotes: 42,
    commentsCount: 5,
  },
  {
    id: "post-2",
    author: "Thespians Crew",
    handle: "@thespians_nit",
    timeAgo: "2h ago",
    tag: "Auditions",
    content: "Street play auditions for Wave 2026 begin this Thursday! No prior acting experience needed, just raw energy and vocal volume. See you at the amphitheatre!",
    upvotes: 89,
    commentsCount: 14,
  },
  {
    id: "post-3",
    author: "Night Canteen Connoisseur",
    handle: "@maggi_expert",
    timeAgo: "5h ago",
    tag: "Hostel Life",
    content: "Unpopular opinion: Block 4 mess paneer butter masala today was actually a 10/10. What black magic did the head chef use?",
    upvotes: 116,
    commentsCount: 31,
  },
];
