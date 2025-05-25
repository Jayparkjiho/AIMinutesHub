import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  duration: integer("duration").notNull().default(0), // in seconds
  tags: text("tags").array().notNull().default([]),
  userId: integer("user_id").notNull(),
  transcript: text("transcript"),
  summary: text("summary"),
  audioUrl: text("audio_url"),
  participants: jsonb("participants").default([]),
  actionItems: jsonb("action_items").default([]),
  notes: text("notes"),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Extended schema for meeting creation
export const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  tags: z.array(z.string()),
  notes: z.string().optional(),
});

export type CreateMeeting = z.infer<typeof createMeetingSchema>;

// Schema for updating a meeting with transcription and summary
export const updateMeetingSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  transcript: z.string().optional(),
  summary: z.string().optional(),
  duration: z.number().optional(),
  tags: z.array(z.string()).optional(),
  participants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    isHost: z.boolean().optional(),
  })).optional(),
  actionItems: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
    assignee: z.string().optional(),
    dueDate: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
});

export type UpdateMeeting = z.infer<typeof updateMeetingSchema>;

// Schema for action items
export const actionItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
});

export type ActionItem = z.infer<typeof actionItemSchema>;

// Schema for participant
export const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean().optional(),
});

export type Participant = z.infer<typeof participantSchema>;
