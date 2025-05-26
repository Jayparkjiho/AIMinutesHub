import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  createMeetingSchema, 
  updateMeetingSchema, 
  insertMeetingSchema,
  type Meeting
} from "@shared/schema";
import multer from "multer";
import { transcribeAudio, generateSummary, extractActionItems, identifyParticipants } from "./openai";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";

// Setup multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Ensure temp directory exists
const ensureTempDirExists = async () => {
  const tempDir = path.resolve("./temp");
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error("Error creating temp directory:", error);
  }
  return tempDir;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Get all meetings
  app.get("/api/meetings", async (req: Request, res: Response) => {
    try {
      // In a real app, we would get userId from auth
      const userId = 1; // Demo user
      const meetings = await storage.getAllMeetings(userId);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ message: `Error fetching meetings: ${error.message}` });
    }
  });

  // Get a single meeting
  app.get("/api/meetings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json(meeting);
    } catch (error) {
      res.status(500).json({ message: `Error fetching meeting: ${error.message}` });
    }
  });

  // Create a new meeting
  app.post("/api/meetings", async (req: Request, res: Response) => {
    try {
      const data = createMeetingSchema.parse(req.body);
      
      // In a real app, we would get userId from auth
      const userId = 1; // Demo user
      
      const newMeeting = await storage.createMeeting({
        ...data,
        userId,
        date: new Date(),
        duration: 0,
        tags: data.tags || [],
      });
      
      res.status(201).json(newMeeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid meeting data", errors: error.errors });
      }
      res.status(500).json({ message: `Error creating meeting: ${error.message}` });
    }
  });

  // Update a meeting
  app.patch("/api/meetings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      const updates = updateMeetingSchema.parse({ id, ...req.body });
      
      const updatedMeeting = await storage.updateMeeting(id, updates);
      res.json(updatedMeeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: `Error updating meeting: ${error.message}` });
    }
  });

  // Delete a meeting
  app.delete("/api/meetings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const success = await storage.deleteMeeting(id);
      if (!success) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: `Error deleting meeting: ${error.message}` });
    }
  });

  // Search meetings
  app.get("/api/meetings/search/:query", async (req: Request, res: Response) => {
    try {
      const { query } = req.params;
      // In a real app, we would get userId from auth
      const userId = 1; // Demo user
      
      const meetings = await storage.searchMeetings(userId, query);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ message: `Error searching meetings: ${error.message}` });
    }
  });

  // Filter meetings by tag
  app.get("/api/meetings/tag/:tag", async (req: Request, res: Response) => {
    try {
      const { tag } = req.params;
      // In a real app, we would get userId from auth
      const userId = 1; // Demo user
      
      const meetings = await storage.getMeetingsByTag(userId, tag);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ message: `Error filtering meetings: ${error.message}` });
    }
  });

  // Process audio recording
  app.post("/api/meetings/:id/record", upload.single("audio"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file provided" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Save the audio file temporarily
      const tempDir = await ensureTempDirExists();
      const filename = `${uuidv4()}.webm`;
      const filePath = path.join(tempDir, filename);
      
      await fs.writeFile(filePath, req.file.buffer);

      // Process with OpenAI
      const { text, duration } = await transcribeAudio(req.file.buffer);
      const summary = await generateSummary(text);
      
      // Extract action items and participants
      const actionItems = await extractActionItems(text);
      const participants = await identifyParticipants(text);
      
      // Map action items and participants to include IDs
      const formattedActionItems = actionItems.map(item => ({
        ...item,
        id: uuidv4(),
        completed: false
      }));
      
      const formattedParticipants = participants.map(participant => ({
        ...participant,
        id: uuidv4()
      }));

      // Update the meeting with processed data
      const updatedMeeting = await storage.updateMeeting(id, {
        transcript: text,
        summary,
        duration,
        actionItems: formattedActionItems,
        participants: formattedParticipants,
        audioUrl: `/api/audio/${filename}`
      });

      res.json(updatedMeeting);
    } catch (error) {
      res.status(500).json({ message: `Error processing recording: ${error.message}` });
    }
  });

  // Generate or regenerate summary
  app.post("/api/meetings/:id/summary", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(id);
      if (!meeting || !meeting.transcript) {
        return res.status(404).json({ message: "Meeting or transcript not found" });
      }

      const summary = await generateSummary(meeting.transcript);
      const updatedMeeting = await storage.updateMeeting(id, { summary });
      
      res.json({ summary });
    } catch (error) {
      res.status(500).json({ message: `Error generating summary: ${error.message}` });
    }
  });

  // Add action item
  app.post("/api/meetings/:id/action-items", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      const actionItemSchema = z.object({
        text: z.string().min(1, "Action item text is required"),
        assignee: z.string().optional(),
        dueDate: z.string().optional()
      });

      const actionItem = actionItemSchema.parse(req.body);
      const newActionItem = {
        id: uuidv4(),
        text: actionItem.text,
        completed: false,
        assignee: actionItem.assignee,
        dueDate: actionItem.dueDate
      };

      const currentActionItems = meeting.actionItems || [];
      const updatedMeeting = await storage.updateMeeting(id, {
        actionItems: [...currentActionItems, newActionItem]
      });

      res.json(newActionItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action item data", errors: error.errors });
      }
      res.status(500).json({ message: `Error adding action item: ${error.message}` });
    }
  });

  // Update action item
  app.patch("/api/meetings/:meetingId/action-items/:itemId", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const itemId = req.params.itemId;
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      const actionItems = meeting.actionItems || [];
      const itemIndex = actionItems.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Action item not found" });
      }

      const updateSchema = z.object({
        text: z.string().optional(),
        completed: z.boolean().optional(),
        assignee: z.string().optional(),
        dueDate: z.string().optional()
      });

      const updates = updateSchema.parse(req.body);
      actionItems[itemIndex] = { ...actionItems[itemIndex], ...updates };

      const updatedMeeting = await storage.updateMeeting(meetingId, { actionItems });
      res.json(actionItems[itemIndex]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: `Error updating action item: ${error.message}` });
    }
  });

  // Send email with meeting data
  app.post("/api/email/send", async (req: Request, res: Response) => {
    try {
      const emailSchema = z.object({
        to: z.array(z.string().email()),
        cc: z.array(z.string().email()).optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        attachments: z.array(z.object({
          filename: z.string(),
          content: z.string(),
          type: z.string()
        })).optional()
      });

      const emailData = emailSchema.parse(req.body);

      // 실제 이메일 발송 로직을 여기에 구현
      // 현재는 시뮬레이션으로 성공 응답 반환
      console.log("이메일 발송 요청:", {
        to: emailData.to,
        cc: emailData.cc,
        subject: emailData.subject,
        bodyLength: emailData.body.length,
        attachmentCount: emailData.attachments?.length || 0
      });

      // 실제 구현에서는 nodemailer, SendGrid 등을 사용
      // 예시:
      // await sendGridClient.send({
      //   to: emailData.to,
      //   cc: emailData.cc,
      //   from: 'noreply@meetscribe.com',
      //   subject: emailData.subject,
      //   html: emailData.body,
      //   attachments: emailData.attachments
      // });

      res.json({ 
        success: true, 
        message: "이메일이 성공적으로 발송되었습니다.",
        sentTo: emailData.to.length,
        sentCc: emailData.cc?.length || 0
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email data", errors: error.errors });
      }
      res.status(500).json({ message: `Error sending email: ${error.message}` });
    }
  });

  return httpServer;
}
