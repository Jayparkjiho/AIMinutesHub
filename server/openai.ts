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
export async function transcribeAudio(audioBuffer: Buffer, originalName?: string): Promise<{ text: string, duration: number }> {
  let tempFilePath = '';
  
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Determine file extension from original name or default to mp3
    let extension = '.mp3';
    if (originalName) {
      const ext = path.extname(originalName).toLowerCase();
      console.log('Original file name:', originalName, 'Extension:', ext);
      if (['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'].includes(ext)) {
        extension = ext;
      }
    }
    
    console.log('Using extension:', extension);
    
    // Create a temporary file with correct extension
    const fileName = `audio_${uuidv4()}${extension}`;
    tempFilePath = path.join(tempDir, fileName);
    
    console.log('Created temp file:', tempFilePath);
    
    // Write buffer to temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Check file stats and content before sending to OpenAI
    const fileStats = fs.statSync(tempFilePath);
    const fileHeader = audioBuffer.slice(0, 12); // Read first 12 bytes for file signature
    console.log('File analysis:', {
      size: fileStats.size,
      path: tempFilePath,
      exists: fs.existsSync(tempFilePath),
      headerHex: fileHeader.toString('hex'),
      headerAscii: fileHeader.toString('ascii')
    });

    // Check for 3GP format and convert extension to mp4
    const headerHex = fileHeader.toString('hex');
    console.log('Checking header for 3GP format:', headerHex);
    
    // Check for 3GP4 signature: 66747970 33677034 (ftyp3gp4)
    if (headerHex.includes('66747970') && headerHex.includes('33677034')) {
      console.log('Detected 3GP4 format - this format is not supported by OpenAI');
      // Clean up and throw specific error for 3GP files
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw new Error('업로드하신 파일은 3GP 형식입니다. 지원되는 형식(MP3, WAV, M4A, MP4 등)으로 변환한 후 다시 업로드해주세요. 또는 텍스트로 직접 입력하실 수도 있습니다.');
    }

    // Create a readable stream for OpenAI with explicit filename
    const fileStream = fs.createReadStream(tempFilePath);
    
    // Add filename property to the stream
    Object.defineProperty(fileStream, 'name', {
      value: path.basename(tempFilePath),
      writable: false
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fileStream as any,
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

// Generate summary from transcript with template context
export async function generateSummary(transcript: string): Promise<string> {
  try {
    let systemContent = "회의 내용을 요약해주세요. 주요 논의 사항, 결론, 중요한 포인트를 포함하여 간결하고 명확하게 요약하세요. 원문의 언어로 응답하세요 - 한국어면 한국어로, 영어면 영어로, 일본어면 일본어로 요약해주세요.";
    
    // // Add template-specific instructions
    // if (templateType && templateName) {
    //   if (templateType === 'summary') {
    //     systemContent += ` 이 요약은 '${templateName}' 템플릿용으로 작성되므로 핵심 내용을 간결하게 정리해주세요.`;
    //   } else if (templateType === 'action_items') {
    //     systemContent += ` 이 요약은 '${templateName}' 템플릿용으로 작성되므로 실행 가능한 액션 아이템과 관련된 내용을 중심으로 요약해주세요.`;
    //   } else if (templateType === 'full_report') {
    //     systemContent += ` 이 요약은 '${templateName}' 템플릿용으로 작성되므로 상세하고 포괄적인 보고서 형태로 요약해주세요.`;
    //   } else if(templateType === 'email') {

    //   }
    // }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemContent
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

// Generate summary from transcript with template context
export async function generateEmail(transcript: string, templateType: string, templateName: string, templateBody: string): Promise<string> {
  try {
    let systemContent = "회의 내용을 요약해주세요. 주요 논의 사항, 결론, 중요한 포인트를 포함하여 간결하고 명확하게 요약하세요. 원문의 언어로 응답하세요 - 한국어면 한국어로, 영어면 영어로, 일본어면 일본어로 요약해주세요.";
    systemContent += ` 이 요약은 템플릿용으로 작성되므로  '${templateName}' 템플릿에 맞게 작성해주세요. 회의 날짜가 없을시 오늘 날짜로 넣어주세요. \n 템플릿 내용: ${templateBody}`;

    // // Add template-specific instructions
    // if (templateType && templateName) {
    //   if (templateType === 'summary') {
    //     systemContent += ` 이 요약은 '${templateName}' 템플릿용으로 작성되므로 핵심 내용을 간결하게 정리해주세요.`;
    //   } else if (templateType === 'action_items') {
    //     systemContent += ` 이 요약은 '${templateName}' 템플릿용으로 작성되므로 실행 가능한 액션 아이템과 관련된 내용을 중심으로 요약해주세요.`;
    //   } else if (templateType === 'full_report') {
    //     systemContent += ` 이 요약은 '${templateName}' 템플릿용으로 작성되므로 상세하고 포괄적인 보고서 형태로 요약해주세요.`;
    //   } else if(templateType === 'email') {

    //   }
    // }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemContent
        },
        {
          role: "user",
          content: `${transcript}`
        }
      ],
    });

    return response.choices[0].message.content || "Unable to generate email summary";
  } catch (error: any) {
    console.error("Error generating email summary:", error);
    throw new Error(`Failed to generate  email summary: ${error.message}`);
  }
}

// Extract action items from transcript with template context
export async function extractActionItems(transcript: string, focusOnActions?: boolean): Promise<{
  text: string,
  assignee?: string,
  dueDate?: string,
}[]> {
  try {
    let systemContent = "You are a meeting assistant that extracts action items from meeting transcripts. For each action item, identify the task, assignee, and due date if mentioned.";
    
    systemContent += ` so focus heavily on identifying actionable tasks, commitments, and follow-up items. Be comprehensive in extracting even implicit action items.`;
    /*
    // Add template-specific instructions
    if (templateType && templateName) {
      if (templateType === 'action_items' || focusOnActions) {
        systemContent += ` This analysis is for the '${templateName}' template, so focus heavily on identifying actionable tasks, commitments, and follow-up items. Be comprehensive in extracting even implicit action items.`;
      } else if (templateType === 'summary') {
        systemContent += ` This analysis is for the '${templateName}' template, so extract only the most critical and explicit action items.`;
      } else if (templateType === 'full_report') {
        systemContent += ` This analysis is for the '${templateName}' template, so provide detailed action items with clear context and priority levels.`;
      }
    }
      */

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemContent
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

export async function generateMeetingTitle(transcript: string, templateType?: string, templateName?: string): Promise<string> {
  try {
    let systemContent = "회의 내용을 분석해서 적절한 회의 제목을 생성하세요. 제목은 간결하고 회의의 핵심 주제를 잘 나타내야 합니다. 한국어로 응답하세요. JSON 형식으로 응답: {\"title\": \"생성된 제목\"}";
    
    // Add template-specific instructions for title generation
    if (templateType && templateName) {
      if (templateType === 'action_items') {
        systemContent += ` 이 제목은 '${templateName}' 액션 아이템 템플릿용이므로 실행과 과업에 초점을 맞춘 제목을 생성하세요.`;
      } else if (templateType === 'summary') {
        systemContent += ` 이 제목은 '${templateName}' 요약 템플릿용이므로 핵심 내용을 간결하게 표현하는 제목을 생성하세요.`;
      } else if (templateType === 'full_report') {
        systemContent += ` 이 제목은 '${templateName}' 상세 보고서 템플릿용이므로 포괄적이고 구체적인 제목을 생성하세요.`;
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemContent
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
