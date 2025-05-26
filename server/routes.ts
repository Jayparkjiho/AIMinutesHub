import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  createMeetingSchema, 
  updateMeetingSchema, 
  insertMeetingSchema,
  type Meeting,
  type InsertMeeting
} from "@shared/schema";
import multer from "multer";
import { transcribeAudio, generateSummary, extractActionItems, identifyParticipants, generateMeetingTitle } from "./openai";
import { v4 as uuidv4 } from "uuid";

// Setup multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Get all meetings
  app.get("/api/meetings", async (req: Request, res: Response) => {
    try {
      // In a real app, we would get userId from auth
      const userId = 1; // Demo user
      const meetings = await storage.getAllMeetings(userId);
      res.json(meetings);
    } catch (error: any) {
      res.status(500).json({ message: `Error fetching meetings: ${error.message}` });
    }
  });

  // Get a specific meeting
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
    } catch (error: any) {
      res.status(500).json({ message: `Error fetching meeting: ${error.message}` });
    }
  });

  // Create a new meeting
  app.post("/api/meetings", async (req: Request, res: Response) => {
    try {
      // Validate with createMeetingSchema first
      const validatedInput = createMeetingSchema.parse(req.body);
      
      // Create the full meeting data for storage
      const meetingData: InsertMeeting = {
        title: validatedInput.title,
        tags: validatedInput.tags,
        notes: validatedInput.notes || "",
        userId: 1, // Demo user
        date: new Date(),
        duration: 0,
        transcript: null,
        summary: null,
        audioUrl: null,
        participants: [],
        actionItems: []
      };

      const meeting = await storage.createMeeting(meetingData);
      res.status(201).json(meeting);
    } catch (error: any) {
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

      const validatedData = updateMeetingSchema.parse(req.body);
      const meeting = await storage.updateMeeting(id, validatedData);
      
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json(meeting);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid meeting data", errors: error.errors });
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
    } catch (error: any) {
      res.status(500).json({ message: `Error deleting meeting: ${error.message}` });
    }
  });

  // Search meetings
  app.get("/api/meetings/search/:query", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Demo user
      const query = req.params.query;
      const meetings = await storage.searchMeetings(userId, query);
      res.json(meetings);
    } catch (error: any) {
      res.status(500).json({ message: `Error searching meetings: ${error.message}` });
    }
  });

  // Get meetings by tag
  app.get("/api/meetings/tag/:tag", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Demo user
      const tag = req.params.tag;
      const meetings = await storage.getMeetingsByTag(userId, tag);
      res.json(meetings);
    } catch (error: any) {
      res.status(500).json({ message: `Error filtering meetings: ${error.message}` });
    }
  });

  // Process audio recording
  app.post("/api/meetings/:id/record", upload.single("audio"), async (req: Request, res: Response) => {
    console.log("File upload request received");
    console.log("File info:", req.file ? "File exists" : "No file");
    console.log("Request headers:", req.headers);
    
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

      console.log("Processing audio file:", req.file.originalname, "Size:", req.file.size);

      // Process with OpenAI
      const { text, duration } = await transcribeAudio(req.file.buffer, req.file.originalname);
      
      console.log("Transcription completed:", text.substring(0, 100) + "...");

      // Update meeting with transcript
      const updatedMeeting = await storage.updateMeeting(id, {
        transcript: text,
        duration: duration
      });

      res.json({ 
        transcript: text, 
        duration: duration,
        meeting: updatedMeeting 
      });

    } catch (error: any) {
      console.error("Error processing audio:", error);
      res.status(500).json({ 
        message: "Error processing audio file", 
        error: error.message 
      });
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
    } catch (error: any) {
      res.status(500).json({ message: `Error generating summary: ${error.message}` });
    }
  });

  // Generate or regenerate action items
  app.post("/api/meetings/:id/action-items", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const meeting = await storage.getMeeting(id);
      if (!meeting || !meeting.transcript) {
        return res.status(404).json({ message: "Meeting or transcript not found" });
      }

      const actionItems = await extractActionItems(meeting.transcript);
      
      // Map action items to include IDs
      const formattedActionItems = actionItems.map((item: any) => ({
        ...item,
        id: uuidv4(),
        completed: false
      }));

      const updatedMeeting = await storage.updateMeeting(id, { 
        actionItems: formattedActionItems 
      });
      
      res.json({ actionItems: formattedActionItems });
    } catch (error: any) {
      res.status(500).json({ message: `Error generating action items: ${error.message}` });
    }
  });

  // Update action item completion status
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
      const itemIndex = actionItems.findIndex((item: any) => item.id === itemId);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Action item not found" });
      }

      // Update the specific action item
      actionItems[itemIndex] = {
        ...actionItems[itemIndex],
        ...req.body
      };

      const updatedMeeting = await storage.updateMeeting(meetingId, { actionItems });
      res.json(updatedMeeting);
    } catch (error: any) {
      res.status(500).json({ message: `Error updating action item: ${error.message}` });
    }
  });

  // Generate meeting title from transcript
  app.post("/api/meetings/:id/generate-title", async (req: Request, res: Response) => {
    const meetingId = parseInt(req.params.id);
    const meeting = await storage.getMeeting(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: "No transcript available for title generation" });
    }

    try {
      const generatedTitle = await generateMeetingTitle(meeting.transcript);
      
      const updatedMeeting = await storage.updateMeeting(meetingId, {
        title: generatedTitle
      });

      res.json({ title: generatedTitle, meeting: updatedMeeting });
    } catch (error: any) {
      console.error("Error generating meeting title:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate meeting title from text directly
  app.post("/api/meetings/generate-title-text", async (req: Request, res: Response) => {
    const { transcript, templateType, templateName } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    try {
      const generatedTitle = await generateMeetingTitle(transcript, templateType, templateName);
      res.json({ title: generatedTitle });
    } catch (error: any) {
      console.error("Error generating meeting title:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Transcribe audio file directly
  app.post("/api/transcribe-audio", upload.single("audio"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    console.log("=== TRANSCRIBE AUDIO DEBUG ===");
    console.log("File info:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    try {
      const result = await transcribeAudio(req.file.buffer, req.file.originalname);
      res.json({ text: result.text, duration: result.duration });
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate summary from text directly
  app.post("/api/meetings/generate-summary-text", async (req: Request, res: Response) => {
    const { transcript, templateType, templateName, templateBody } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    try {
      const summary = await generateSummary(transcript, templateType, templateName, templateBody);
      res.json({ summary });
    } catch (error: any) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate action items from text directly
  app.post("/api/meetings/generate-actions-text", async (req: Request, res: Response) => {
    const { transcript, templateType, templateName, focusOnActions } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    try {
      const actionItems = await extractActionItems(transcript, templateType, templateName, focusOnActions);
      
      // Convert to the format expected by our schema
      const formattedActionItems = actionItems.map(item => ({
        id: uuidv4(),
        text: item.text,
        completed: false,
        assignee: item.assignee,
        dueDate: item.dueDate
      }));

      res.json({ actionItems: formattedActionItems });
    } catch (error: any) {
      console.error("Error generating action items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Separate speakers in transcript
  app.post("/api/meetings/separate-speakers", async (req: Request, res: Response) => {
    try {
      const { transcript } = req.body;
      
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const { separateSpeakers } = await import("./openai.js");
      const separatedTranscript = await separateSpeakers(transcript);
      
      res.json({ separatedTranscript });
    } catch (error: any) {
      console.error("Error separating speakers:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gmail SMTP email sending endpoint
  app.post("/api/email/send", async (req: Request, res: Response) => {
    try {
      const { to, cc, bcc, subject, text, html, gmailConfig } = req.body;
      
      if (!gmailConfig || !gmailConfig.email || !gmailConfig.password) {
        return res.status(400).json({ 
          error: 'Gmail 계정 정보가 필요합니다. 이메일과 앱 비밀번호를 입력해주세요.' 
        });
      }

      if (!to || !Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ error: '받는 사람 이메일이 필요합니다.' });
      }

      if (!subject || !subject.trim()) {
        return res.status(400).json({ error: '제목이 필요합니다.' });
      }

      if (!text && !html) {
        return res.status(400).json({ error: '메일 내용이 필요합니다.' });
      }

      const { GmailSMTPService } = await import("./gmail-smtp.js");
      const gmailService = new GmailSMTPService({
        email: gmailConfig.email,
        password: gmailConfig.password
      });

      // SMTP 연결 테스트
      const connectionTest = await gmailService.testConnection();
      if (!connectionTest.success) {
        return res.status(401).json({ 
          error: `Gmail SMTP 연결 실패: ${connectionTest.error}. Gmail 계정 설정을 확인해주세요.` 
        });
      }

      // 메일 전송
      const result = await gmailService.sendEmail({
        to,
        cc,
        bcc,
        subject,
        text,
        html
      });

      if (result.success) {
        res.json({
          success: true,
          message: '메일이 성공적으로 전송되었습니다.',
          messageId: result.messageId
        });
      } else {
        res.status(500).json({
          error: `메일 전송 실패: ${result.error}`
        });
      }

    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ 
        error: error.message || '메일 전송 중 오류가 발생했습니다.' 
      });
    }
  });

  // Gmail SMTP 연결 테스트 endpoint
  app.post("/api/email/test", async (req: Request, res: Response) => {
    try {
      const { gmailConfig } = req.body;
      
      if (!gmailConfig || !gmailConfig.email || !gmailConfig.password) {
        return res.status(400).json({ 
          error: 'Gmail 계정 정보가 필요합니다.' 
        });
      }

      const { GmailSMTPService } = await import("./gmail-smtp.js");
      const gmailService = new GmailSMTPService({
        email: gmailConfig.email,
        password: gmailConfig.password
      });

      const result = await gmailService.testConnection();
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Gmail SMTP 연결이 성공했습니다.'
        });
      } else {
        res.status(401).json({
          error: `연결 실패: ${result.error}`
        });
      }

    } catch (error: any) {
      console.error("Error testing Gmail connection:", error);
      res.status(500).json({ 
        error: error.message || 'Gmail 연결 테스트 중 오류가 발생했습니다.' 
      });
    }
  });

  return httpServer;
}