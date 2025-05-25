export interface Meeting {
  id: number;
  title: string;
  date: string;
  duration: number;
  tags: string[];
  userId: number;
  transcript?: string;
  summary?: string;
  audioUrl?: string;
  participants?: Participant[];
  actionItems?: ActionItem[];
  notes?: string;
}

export interface Participant {
  id: string;
  name: string;
  isHost?: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
}

export interface NewMeeting {
  title: string;
  tags: string[];
  notes?: string;
}

export interface MeetingStat {
  totalTime: string;
  totalMeetings: number;
  wordCount: number;
}
