import { 
  users, type User, type InsertUser, 
  meetings, type Meeting, type InsertMeeting, 
  type ActionItem, type Participant, type UpdateMeeting 
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Meeting methods
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  getAllMeetings(userId: number): Promise<Meeting[]>;
  updateMeeting(id: number, meeting: Partial<Meeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: number): Promise<boolean>;
  
  // Search and filter methods
  searchMeetings(userId: number, query: string): Promise<Meeting[]>;
  getMeetingsByTag(userId: number, tag: string): Promise<Meeting[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private meetings: Map<number, Meeting>;
  userCurrentId: number;
  meetingCurrentId: number;

  constructor() {
    this.users = new Map();
    this.meetings = new Map();
    this.userCurrentId = 1;
    this.meetingCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const id = this.meetingCurrentId++;
    const meeting: Meeting = { 
      ...insertMeeting, 
      id,
      date: insertMeeting.date || new Date(),
    };
    this.meetings.set(id, meeting);
    return meeting;
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async getAllMeetings(userId: number): Promise<Meeting[]> {
    return Array.from(this.meetings.values())
      .filter(meeting => meeting.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async updateMeeting(id: number, updates: Partial<Meeting>): Promise<Meeting | undefined> {
    const meeting = this.meetings.get(id);
    if (!meeting) return undefined;

    const updatedMeeting = { ...meeting, ...updates };
    this.meetings.set(id, updatedMeeting);
    return updatedMeeting;
  }

  async deleteMeeting(id: number): Promise<boolean> {
    return this.meetings.delete(id);
  }

  async searchMeetings(userId: number, query: string): Promise<Meeting[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.meetings.values())
      .filter(meeting => 
        meeting.userId === userId && 
        (meeting.title.toLowerCase().includes(lowerQuery) || 
         (meeting.transcript && meeting.transcript.toLowerCase().includes(lowerQuery)) ||
         (meeting.summary && meeting.summary.toLowerCase().includes(lowerQuery)) ||
         (meeting.tags && meeting.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        )
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getMeetingsByTag(userId: number, tag: string): Promise<Meeting[]> {
    return Array.from(this.meetings.values())
      .filter(meeting => 
        meeting.userId === userId && 
        meeting.tags && 
        meeting.tags.includes(tag)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const storage = new MemStorage();

// Initialize demo data
const initializeData = async () => {
  // Demo user
  const user = await storage.createUser({
    username: "demo",
    password: "password"
  });
  
  // Create some demo meetings
  await storage.createMeeting({
    title: "Product Roadmap Discussion",
    date: new Date("2023-07-12"),
    duration: 2700, // 45 minutes
    tags: ["Product", "Roadmap"],
    userId: user.id,
    transcript: `John (00:01:23): Welcome everyone to our product roadmap discussion. Today we'll be reviewing the features planned for Q3 and prioritizing our backlog based on customer feedback and business goals.
    
Sarah (00:02:10): Thanks, John. I've prepared a summary of the user testing results from last month. The main pain points users reported were around the onboarding flow and notification management. I think we should prioritize these areas.

Michael (00:03:42): I agree with Sarah. Our analytics also show a significant drop-off during the onboarding process. We're losing about 30% of new users in the first week. If we improve this, we could see a substantial increase in user retention.

Alex (00:05:17): From a development perspective, we need to consider the technical debt we've accumulated from the last two releases. I suggest we allocate at least 20% of our sprint capacity to refactoring and improving our test coverage.

John (00:07:35): That's a good point, Alex. Let's make sure we're building on a solid foundation. Let's balance our efforts between new features, improvements to existing ones, and technical debt. Sarah, can you work with the design team to create a new onboarding flow proposal by next week?`,
    summary: "The team discussed the product roadmap for Q3, focusing on improving the onboarding process and notification management based on user testing feedback. Michael noted a 30% drop-off rate for new users in the first week. Alex raised concerns about technical debt, suggesting 20% of sprint capacity be allocated to refactoring and testing. The team agreed to balance efforts between new features, improvements, and technical debt maintenance.",
    participants: [
      { id: "1", name: "John", isHost: true },
      { id: "2", name: "Sarah" },
      { id: "3", name: "Michael" },
      { id: "4", name: "Alex" },
      { id: "5", name: "Rachel" }
    ],
    actionItems: [
      { id: "1", text: "Sarah to create onboarding flow proposal with design team", completed: true, assignee: "Sarah", dueDate: "2023-07-19" },
      { id: "2", text: "Alex to analyze technical debt and propose refactoring plan", completed: false, assignee: "Alex", dueDate: "2023-07-21" },
      { id: "3", text: "Michael to prepare analytics report on user retention", completed: false, assignee: "Michael", dueDate: "2023-07-20" }
    ]
  });
  
  await storage.createMeeting({
    title: "Marketing Strategy Session",
    date: new Date("2023-07-10"),
    duration: 3600, // 60 minutes
    tags: ["Marketing"],
    userId: user.id,
    summary: "Analyzed Q2 campaign results and developed strategy for Q3. Social media engagement up 24%, email open rates stable. Planning to increase budget for video content and reduce spending on display ads."
  });
  
  await storage.createMeeting({
    title: "Weekly Team Check-in",
    date: new Date("2023-07-07"),
    duration: 1800, // 30 minutes
    tags: ["Team"],
    userId: user.id,
    summary: "Team updates on current projects. Dev team completed API integration, design finalized mobile mockups, and QA prepared test cases for the next release. Discussed blockers and resource allocation."
  });
  
  await storage.createMeeting({
    title: "Client Onboarding Call",
    date: new Date("2023-07-05"),
    duration: 1514, // 25:14 minutes
    tags: ["Client"],
    userId: user.id
  });
  
  await storage.createMeeting({
    title: "Budget Planning",
    date: new Date("2023-07-03"),
    duration: 2912, // 48:32 minutes
    tags: ["Finance"],
    userId: user.id
  });
  
  await storage.createMeeting({
    title: "UI/UX Design Review",
    date: new Date("2023-06-29"),
    duration: 2147, // 35:47 minutes
    tags: ["Design"],
    userId: user.id
  });
};

// Initialize data
initializeData();
