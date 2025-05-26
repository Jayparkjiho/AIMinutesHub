import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import FormData from "form-data";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: "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"
});

// Transcribe audio file
export async function transcribeAudio(audioBuffer: Buffer): Promise<{ text: string, duration: number }> {
  let tempFilePath = '';
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a temporary file
    const fileName = `audio_${uuidv4()}.wav`;
    tempFilePath = path.join(tempDir, fileName);
    
    // Write buffer to temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Create a readable stream for OpenAI with proper file metadata
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath) as any,
      model: "whisper-1",
      response_format: "text",
    });

    return {
      text: typeof transcription === 'string' ? transcription : transcription.text,
      duration: 0, // Duration is not available from OpenAI API response
    };
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }
    }
  }
}

// Generate summary from transcript
export async function generateSummary(transcript: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "회의 내용을 요약해주세요. 주요 논의 사항, 결론, 중요한 포인트를 포함하여 간결하고 명확하게 요약하세요. 원문의 언어로 응답하세요 - 한국어면 한국어로, 영어면 영어로, 일본어면 일본어로 요약해주세요."
        },
        {
          role: "user",
          content: `다음 회의 전사 내용을 요약해주세요:\n\n${transcript}`
        }
      ],
    });

    return response.choices[0].message.content || "Unable to generate summary";
  } catch (error: any) {
    console.error("Error generating summary:", error);
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
}

// Extract action items from transcript
export async function extractActionItems(transcript: string): Promise<{
  text: string,
  assignee?: string,
  dueDate?: string,
}[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a meeting assistant that extracts action items from meeting transcripts. For each action item, identify the task, assignee, and due date if mentioned."
        },
        {
          role: "user",
          content: `Please extract action items from the following meeting transcript and return them in JSON format with text, assignee, and dueDate (if available) fields:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.actionItems || [];
  } catch (error: any) {
    console.error("Error extracting action items:", error);
    return [];
  }
}

// Identify participants from transcript
export async function identifyParticipants(transcript: string): Promise<{ name: string, isHost?: boolean }[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a meeting assistant that identifies participants from meeting transcripts. Extract the names of all speakers, and try to determine who might be the host or leader of the meeting."
        },
        {
          role: "user",
          content: `Please identify all participants in this meeting transcript and return them in JSON format with name and isHost (boolean) fields:\n\n${transcript}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.participants || [];
  } catch (error: any) {
    console.error("Error identifying participants:", error);
    return [];
  }
}

export async function generateMeetingTitle(transcript: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "회의 내용을 분석해서 적절한 회의 제목을 생성하세요. 제목은 간결하고 회의의 핵심 주제를 잘 나타내야 합니다. 한국어로 응답하세요. JSON 형식으로 응답: {\"title\": \"생성된 제목\"}"
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"title": "회의"}');
    return result.title || "회의";
  } catch (error: any) {
    console.error("Error generating meeting title:", error);
    throw new Error(`Failed to generate meeting title: ${error.message}`);
  }
}

// Separate speakers in transcript
export async function separateSpeakers(transcript: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "전사 내용을 분석해서 화자를 구분해주세요. 대화의 내용과 문맥을 보고 서로 다른 발언자를 식별하여 '화자 1:', '화자 2:' 등으로 구분해서 작성하세요. 원본 내용은 그대로 유지하고 화자 구분만 추가하세요."
        },
        {
          role: "user",
          content: `다음 전사 내용에서 화자를 구분해주세요:\n\n${transcript}`
        }
      ],
    });

    return response.choices[0].message.content || transcript;
  } catch (error: any) {
    console.error("Error separating speakers:", error);
    return transcript;
  }
}
