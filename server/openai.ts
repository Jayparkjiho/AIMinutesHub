import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Transcribe audio file
export async function transcribeAudio(audioBuffer: Buffer): Promise<{ text: string, duration: number }> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: new Blob([audioBuffer], { type: 'audio/webm' }),
      model: "whisper-1",
    });

    return {
      text: transcription.text,
      duration: transcription.duration || 0,
    };
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
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
          content: "You are a meeting assistant that creates concise, accurate summaries of meeting transcripts. Focus on key points, decisions, and action items. Be professional and objective."
        },
        {
          role: "user",
          content: `Please summarize the following meeting transcript in a paragraph or two:\n\n${transcript}`
        }
      ],
    });

    return response.choices[0].message.content || "Unable to generate summary";
  } catch (error) {
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

    const result = JSON.parse(response.choices[0].message.content);
    return result.actionItems || [];
  } catch (error) {
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

    const result = JSON.parse(response.choices[0].message.content);
    return result.participants || [];
  } catch (error) {
    console.error("Error identifying participants:", error);
    return [];
  }
}
