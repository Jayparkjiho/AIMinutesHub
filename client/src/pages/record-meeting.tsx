import { useState, useRef } from "react";
import { useAudioRecorder, formatTime } from "@/hooks/use-audio-recorder";
import { Waveform } from "@/components/ui/waveform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { indexedDBStorage } from "@/lib/indexeddb";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function RecordMeeting() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { saveMeeting, updateMeeting } = useIndexedDBMeetings();
  
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [meetingId, setMeetingId] = useState<number | null>(null);
  
  // New states for file upload and text input
  const [activeTab, setActiveTab] = useState("record");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  
  // AI analysis results states
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [generatedActionItems, setGeneratedActionItems] = useState<any[]>([]);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [separatedTranscript, setSeparatedTranscript] = useState("");
  const [isSeparatingSpeakers, setIsSeparatingSpeakers] = useState(false);
  
  const {
    audioBlob,
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle tag addition
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };
  
  // Handle tag removal
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  // Handle keypress for tag input
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
        toast({
          title: "Unsupported file type",
          description: "Please upload MP3, WAV, or M4A files only.",
          variant: "destructive"
        });
        return;
      }
      
      setUploadedFile(file);
      toast({
        title: "File uploaded",
        description: `${file.name} is ready for processing.`
      });
    }
  };

  // Process uploaded file
  const processUploadedFile = async () => {
    if (!uploadedFile) return;

    try {
      setIsProcessing(true);
      setProcessingProgress(20);

      // Try to transcribe and generate title
      let transcript = `[Audio file uploaded: ${uploadedFile.name}]`;
      let generatedTitle = title || "업로드된 음성 파일";
      
      try {
        // Create FormData for audio transcription
        const formData = new FormData();
        formData.append('audio', uploadedFile, uploadedFile.name);
        
        // Call transcription API
        const transcriptionResponse = await fetch('/api/transcribe-audio', {
          method: 'POST',
          body: formData
        });
        
        if (transcriptionResponse.ok) {
          const transcriptionResult = await transcriptionResponse.json();
          transcript = transcriptionResult.text || transcript;
          setTranscriptText(transcript);
          setProcessingProgress(60);
          
          // Generate title from transcript if we have actual transcription
          if (transcript !== `[Audio file uploaded: ${uploadedFile.name}]`) {
            generatedTitle = await generateMeetingTitle(transcript);
          }
        }
      } catch (error) {
        console.error('Transcription failed:', error);
        // Continue with file name as transcript
      }
      
      setProcessingProgress(80);

      // Create meeting in IndexedDB
      saveMeeting({
        title: title || generatedTitle,
        tags,
        notes,
        date: new Date().toISOString(),
        duration: 0,
        userId: 1,
        transcript
      }, {
        onSuccess: (meeting) => {
          setMeetingId(meeting.id);
          setProcessingProgress(100);
          setTranscriptText(transcript);

          // 자동으로 AI 분석 시작
          generateAIAnalysis(transcript);

          toast({
            title: "File uploaded successfully!",
            description: `파일이 저장되었습니다. 제목: "${title || generatedTitle}"`
          });
        },
        onError: (error) => {
          throw error;
        }
      });

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: "There was an error saving your file.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Generate meeting title using OpenAI
  const generateMeetingTitle = async (transcript: string): Promise<string> => {
    try {
      const response = await fetch('/api/meetings/generate-title-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate title');
      }
      
      const result = await response.json();
      return result.title || "회의";
    } catch (error) {
      console.error('Error generating title:', error);
      return "회의"; // fallback title
    }
  };

  // Process manual text
  const processManualText = async () => {
    if (!manualText.trim()) {
      toast({
        title: "No text provided",
        description: "Please enter some meeting content to process.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(30);

      // Generate title from transcript
      const generatedTitle = await generateMeetingTitle(manualText);
      setProcessingProgress(40);

      // Generate summary
      let summary = "";
      try {
        const summaryResponse = await fetch('/api/meetings/generate-summary-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: manualText })
        });
        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          summary = summaryResult.summary || "";
        }
      } catch (error) {
        console.error('Summary generation failed:', error);
      }
      setProcessingProgress(70);

      // Generate action items
      let actionItems: any[] = [];
      try {
        const actionResponse = await fetch('/api/meetings/generate-actions-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: manualText })
        });
        if (actionResponse.ok) {
          const actionResult = await actionResponse.json();
          actionItems = actionResult.actionItems || [];
        }
      } catch (error) {
        console.error('Action items generation failed:', error);
      }
      setProcessingProgress(90);

      // Create meeting with transcript in IndexedDB
      saveMeeting({
        title: title || generatedTitle,
        tags,
        notes,
        transcript: manualText,
        summary,
        actionItems,
        date: new Date().toISOString(),
        duration: 0,
        userId: 1
      }, {
        onSuccess: (meeting) => {
          setMeetingId(meeting.id);
          setProcessingProgress(100);

          toast({
            title: "Meeting saved!",
            description: `회의 분석이 완료되었습니다. 제목: "${title || generatedTitle}"`
          });

          setTimeout(() => {
            navigate(`/meetings/${meeting.id}`);
          }, 1000);
        },
        onError: (error) => {
          throw error;
        }
      });

    } catch (error: any) {
      toast({
        title: "Save failed",
        description: "There was an error saving your text.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Generate AI analysis (summary, action items, and title)
  const generateAIAnalysis = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setIsGeneratingAnalysis(true);
    try {
      let summary = "";
      let actionItems: any[] = [];
      let generatedTitle = "";

      // Generate AI title
      const titleResponse = await fetch('/api/meetings/generate-title-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        generatedTitle = titleData.title;
        setTitle(generatedTitle); // Update the title state
      }

      // Generate summary
      const summaryResponse = await fetch('/api/meetings/generate-summary-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summary;
        setGeneratedSummary(summary);
      }

      // Generate action items
      const actionsResponse = await fetch('/api/meetings/generate-actions-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      
      if (actionsResponse.ok) {
        const actionsData = await actionsResponse.json();
        actionItems = actionsData.actionItems || [];
        setGeneratedActionItems(actionItems);
      }

      // 기존 회의가 있으면 AI 분석 결과로 업데이트
      if (meetingId && (summary || actionItems.length > 0)) {
        try {
          console.log('Updating meeting with AI analysis:', { meetingId, summary, actionItems });
          await indexedDBStorage.init();
          const existingMeeting = await indexedDBStorage.getMeeting(meetingId);
          
          if (existingMeeting) {
            // Merge new action items with existing ones
            const existingActionItems = existingMeeting.actionItems || [];
            const newActionItems = actionItems.map((aiItem: any) => ({
              id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              text: aiItem.text,
              completed: false,
              assignee: aiItem.assignee || undefined,
              dueDate: aiItem.dueDate || undefined,
            }));
            
            // Update the meeting with AI analysis results
            const updates = {
              title: generatedTitle || existingMeeting.title,
              summary: summary || existingMeeting.summary,
              actionItems: [...existingActionItems, ...newActionItems]
            };
            
            console.log('Updating meeting with:', updates);
            const updatedMeeting = await indexedDBStorage.updateMeeting(meetingId, updates);
            console.log('Meeting updated successfully:', updatedMeeting);
            
            // Clear the generated action items since they're now saved to the meeting
            setGeneratedActionItems([]);
            
            // Automatically start speaker separation after AI analysis
            if (transcriptText) {
              separateSpeakers(transcriptText);
            }
            
            toast({
              title: "AI 분석 완료",
              description: `요약과 ${newActionItems.length}개의 액션 아이템이 자동으로 회의에 추가되었습니다. 화자 분리를 진행합니다.`,
            });
          }
        } catch (updateError) {
          console.error("Error updating meeting with AI analysis:", updateError);
          toast({
            title: "AI 분석 완료",
            description: "분석은 완료되었지만 저장 중 오류가 발생했습니다.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "AI 분석 완료",
          description: "요약과 액션 아이템이 생성되었습니다.",
        });
      }
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      toast({
        title: "AI 분석 오류",
        description: "분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  // Extract participants from separated transcript
  const extractParticipantsFromTranscript = (separatedTranscript: string) => {
    const participants = [];
    const speakerPattern = /^(화자\s*\d+|Speaker\s*\d+|참석자\s*\d+|발표자\s*\d+):/gm;
    const speakers = new Set();
    
    let match;
    while ((match = speakerPattern.exec(separatedTranscript)) !== null) {
      speakers.add(match[1].trim());
    }
    
    // Convert speakers to participant objects
    Array.from(speakers).forEach((speaker: any, index: number) => {
      participants.push({
        id: `participant_${index + 1}`,
        name: speaker,
        isHost: index === 0 // First speaker is considered host
      });
    });
    
    return participants;
  };

  // Separate speakers in transcript
  const separateSpeakers = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setIsSeparatingSpeakers(true);
    try {
      const response = await fetch('/api/meetings/separate-speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.separatedTranscript) {
          setSeparatedTranscript(data.separatedTranscript);
          
          // Extract participants from separated transcript
          const participants = extractParticipantsFromTranscript(data.separatedTranscript);
          
          // Save participants to meeting if meetingId exists
          if (meetingId && participants.length > 0) {
            try {
              await indexedDBStorage.init();
              const existingMeeting = await indexedDBStorage.getMeeting(meetingId);
              
              if (existingMeeting) {
                const updatedMeeting = {
                  ...existingMeeting,
                  participants: participants,
                  transcript: data.separatedTranscript
                };
                
                await indexedDBStorage.updateMeeting(meetingId, updatedMeeting);
              }
            } catch (updateError) {
              console.error("Error updating meeting with participants:", updateError);
            }
          }
          
          toast({
            title: "화자 분리 완료",
            description: `전사 내용에서 ${participants.length}명의 화자가 구분되었습니다.`,
          });
        } else {
          throw new Error('No separated transcript received');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error separating speakers:", error);
      toast({
        title: "화자 분리 오류",
        description: "화자 분리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsSeparatingSpeakers(false);
    }
  };

  // Apply AI action items to new action items
  const applyAIActionItems = async () => {
    if (generatedActionItems.length === 0) return;
    
    // Add AI generated action items to the meeting
    if (meetingId) {
      try {
        await indexedDBStorage.init();
        const existingMeeting = await indexedDBStorage.getMeeting(meetingId);
        
        if (existingMeeting) {
          const newActionItems = generatedActionItems.map((aiItem) => ({
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: aiItem.text,
            completed: false,
            assignee: aiItem.assignee || undefined,
            dueDate: aiItem.dueDate || undefined,
          }));
          
          const updatedMeeting = {
            ...existingMeeting,
            actionItems: [...(existingMeeting.actionItems || []), ...newActionItems]
          };
          
          await indexedDBStorage.updateMeeting(meetingId, updatedMeeting);
          
          toast({
            title: "AI 액션 아이템 적용",
            description: `${generatedActionItems.length}개의 AI 액션 아이템이 회의에 추가되었습니다.`,
          });
          
          // Clear the generated action items after applying
          setGeneratedActionItems([]);
        }
      } catch (error) {
        console.error("Error applying AI action items:", error);
        toast({
          title: "오류",
          description: "AI 액션 아이템 적용 중 오류가 발생했습니다.",
          variant: "destructive"
        });
      }
    }
  };

  // Download transcript as text file
  const downloadTranscript = () => {
    const text = transcriptText || manualText;
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'meeting'}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: "Transcript file has been downloaded."
    });
  };
  
  // Handle recording toggle
  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Create meeting first if it doesn't exist
      if (!meetingId) {
        try {
          const response = await apiRequest("POST", "/api/meetings", {
            title: title || "Untitled Meeting",
            tags: tags,
            notes: notes || ""
          });
          setMeetingId(response.id);
        } catch (error: any) {
          toast({
            title: "Error creating meeting",
            description: error.message,
            variant: "destructive"
          });
          return;
        }
      }
      startRecording();
    }
  };
  
  // Handle save recording
  const handleSaveRecording = async () => {
    console.log("Process Recording clicked! audioBlob:", audioBlob, "meetingId:", meetingId);
    if (!audioBlob || !meetingId) {
      console.log("Missing audioBlob or meetingId");
      return;
    }
    
    try {
      setIsProcessing(true);
      setProcessingProgress(0);
      
      // Upload audio file
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      
      setProcessingProgress(30);
      const uploadResponse = await fetch(`/api/meetings/${meetingId}/record`, {
        method: 'POST',
        body: formData
      });
      const uploadResult = await uploadResponse.json();
      
      setProcessingProgress(60);
      
      // Generate summary
      await apiRequest("POST", `/api/meetings/${meetingId}/summary`);
      
      setProcessingProgress(80);
      
      // Generate action items  
      await apiRequest("POST", `/api/meetings/${meetingId}/action-items`);
      
      setProcessingProgress(100);
      
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      
      toast({
        title: "Recording saved!",
        description: "Your meeting has been processed successfully."
      });
      
      // Navigate to the meeting detail page
      navigate(`/meetings/${meetingId}`);
    } catch (error: any) {
      toast({
        title: "Error processing recording",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };
  
  // Handle cancel
  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    resetRecording();
    navigate("/");
  };
  
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Create Meeting</h1>
          <p className="text-neutral-500 mt-1">Record audio, upload files, or input text manually</p>
        </div>
      </div>
      
      {/* Meeting Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Meeting Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="meetingTitle" className="block text-sm font-medium text-neutral-700 mb-1">Meeting Title</label>
              <Input 
                id="meetingTitle"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter meeting title"
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <Input 
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add meeting notes (optional)"
                className="w-full"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="meetingTags" className="block text-sm font-medium text-neutral-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="bg-primary/10 text-primary">
                  {tag}
                  <button 
                    className="ml-1 text-primary/70 hover:text-primary"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove ${tag} tag`}
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex">
              <Input
                id="meetingTags"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyPress={handleTagKeyPress}
                placeholder="Add a tag"
                className="rounded-r-none"
              />
              <Button 
                onClick={handleAddTag}
                className="rounded-l-none"
              >
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Input Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Meeting Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="record">
                <i className="ri-mic-line mr-2"></i>
                Record Audio
              </TabsTrigger>
              <TabsTrigger value="upload">
                <i className="ri-upload-line mr-2"></i>
                Upload File
              </TabsTrigger>
              <TabsTrigger value="text">
                <i className="ri-edit-line mr-2"></i>
                Input Text
              </TabsTrigger>
            </TabsList>

            {/* Audio Recording Tab */}
            <TabsContent value="record" className="mt-6">
              <div className="bg-neutral-50 rounded-lg p-6 text-center">
                <div className="mb-6">
                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={handleToggleRecording}
                      disabled={isProcessing}
                      className={`rounded-full w-16 h-16 flex items-center justify-center shadow-lg ${
                        isRecording ? "bg-neutral-600 hover:bg-neutral-700" : "bg-red-500 hover:bg-red-600"
                      }`}
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                      <i className={`${isRecording ? "ri-stop-line" : "ri-mic-line"} text-2xl`}></i>
                    </Button>
                    
                    {isRecording && (
                      <div className="flex items-center justify-center">
                        <div className="recording-indicator mr-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-500 font-medium">{formatTime(recordingTime)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-neutral-500 mt-3">
                    {isRecording ? "Click to stop recording" : "Click to start recording"}
                  </p>
                </div>
                
                {(isRecording || audioBlob) && (
                  <div className="mb-6">
                    <Waveform isAnimating={isRecording} />
                  </div>
                )}
                
                {audioBlob && !isRecording && (
                  <div className="mt-4">
                    <Button onClick={handleSaveRecording} disabled={isProcessing} className="w-full">
                      <i className="ri-save-line mr-2"></i>
                      Process Recording
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                      <span className="text-neutral-600">Processing audio...</span>
                    </div>
                    <Progress value={processingProgress} className="mb-4 h-2" />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* File Upload Tab */}
            <TabsContent value="upload" className="mt-6">
              <div className="bg-neutral-50 rounded-lg p-6 text-center">
                <div className="mb-6">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".mp3,.wav,.m4a,audio/*"
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full max-w-md"
                  >
                    <i className="ri-upload-cloud-line mr-2"></i>
                    Choose Audio File
                  </Button>
                  <p className="text-sm text-neutral-500 mt-2">
                    Supported formats: MP3, WAV, M4A
                  </p>
                </div>

                {uploadedFile && (
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center mb-2">
                      <i className="ri-file-music-line text-2xl text-primary mr-2"></i>
                      <span className="font-medium">{uploadedFile.name}</span>
                    </div>
                    <p className="text-sm text-neutral-500">
                      Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button 
                      onClick={processUploadedFile} 
                      disabled={isProcessing}
                      className="w-full mt-4"
                    >
                      <i className="ri-play-line mr-2"></i>
                      Process File
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                      <span className="text-neutral-600">Processing file...</span>
                    </div>
                    <Progress value={processingProgress} className="mb-4 h-2" />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Manual Text Input Tab */}
            <TabsContent value="text" className="mt-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="manualText" className="block text-sm font-medium text-neutral-700 mb-2">
                    Meeting Content
                  </label>
                  <Textarea
                    id="manualText"
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    placeholder="Enter meeting transcript, notes, or discussion content here..."
                    rows={12}
                    className="w-full"
                  />
                  <p className="text-sm text-neutral-500 mt-1">
                    Paste your meeting transcript or type the discussion content manually
                  </p>
                </div>

                {manualText && (
                  <div className="flex space-x-2">
                    <Button 
                      onClick={processManualText} 
                      disabled={isProcessing || !manualText.trim()}
                      className="flex-1"
                    >
                      <i className="ri-brain-line mr-2"></i>
                      Analyze Content
                    </Button>
                    <Button 
                      onClick={downloadTranscript} 
                      variant="outline"
                      disabled={!manualText.trim()}
                    >
                      <i className="ri-download-line mr-2"></i>
                      Download
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                      <span className="text-neutral-600">Analyzing content...</span>
                    </div>
                    <Progress value={processingProgress} className="mb-4 h-2" />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Analysis Results */}
      {(transcriptText || generatedSummary || generatedActionItems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <i className="ri-brain-line mr-2"></i>
              AI 분석 결과
              {isGeneratingAnalysis && (
                <div className="ml-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  <span className="text-sm text-gray-600">분석 중...</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Transcript Preview */}
            {transcriptText && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <i className="ri-file-text-line mr-2"></i>
                  전사 내용
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{separatedTranscript || transcriptText}</p>
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => generateAIAnalysis(transcriptText)}
                    disabled={isGeneratingAnalysis}
                  >
                    <i className="ri-refresh-line mr-2"></i>
                    AI 분석 다시 실행
                  </Button>

                </div>
              </div>
            )}

            {/* Generated Summary */}
            {generatedSummary && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <i className="ri-article-line mr-2 text-blue-600"></i>
                  AI 요약
                </h4>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm whitespace-pre-wrap">{generatedSummary}</p>
                </div>
              </div>
            )}

            {/* Generated Action Items */}
            {generatedActionItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <i className="ri-task-line mr-2 text-green-600"></i>
                  AI 액션 아이템 ({generatedActionItems.length}개)
                </h4>
                <div className="space-y-2">
                  {generatedActionItems.map((item: any, index: number) => (
                    <div key={index} className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.text}</p>
                          {item.assignee && (
                            <p className="text-xs text-gray-600 mt-1">
                              담당자: {item.assignee}
                            </p>
                          )}
                          {item.dueDate && (
                            <p className="text-xs text-gray-600 mt-1">
                              마감일: {item.dueDate}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {item.completed ? "완료" : "대기"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              {/* Generate Analysis Button */}
              {transcriptText && !generatedSummary && !isGeneratingAnalysis && (
                <Button 
                  onClick={() => generateAIAnalysis(transcriptText)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <i className="ri-brain-line mr-2"></i>
                  AI 분석 시작하기
                </Button>
              )}

              {/* Email Send Button - Show when analysis is complete and meeting is saved */}
              {meetingId && generatedSummary && (
                <Button 
                  onClick={async () => {
                    try {
                      // 최신 회의 데이터를 가져와서 이메일 페이지로 이동
                      await indexedDBStorage.init();
                      const meetingData = await indexedDBStorage.getMeeting(meetingId);
                      
                      if (meetingData) {
                        const encodedData = encodeURIComponent(JSON.stringify(meetingData));
                        // wouter navigate 사용으로 변경
                        navigate(`/gmail-sender?meetingData=${encodedData}`);
                      } else {
                        toast({
                          title: "오류",
                          description: "회의 데이터를 찾을 수 없습니다.",
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      console.error("Error loading meeting data:", error);
                      toast({
                        title: "오류",
                        description: "회의 데이터 로딩 중 오류가 발생했습니다.",
                        variant: "destructive"
                      });
                    }
                  }}
                  variant="outline"
                  className="bg-blue-50 border-blue-200 hover:bg-blue-100"
                >
                  <i className="ri-mail-send-line mr-2"></i>
                  Gmail 발송
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex justify-end space-x-3 mt-6">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isProcessing}
        >
          <i className="ri-close-line mr-2"></i>
          Cancel
        </Button>
      </div>
    </div>
  );
}