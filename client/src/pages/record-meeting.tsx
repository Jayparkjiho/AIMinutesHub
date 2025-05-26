import { useState, useRef } from "react";
import { useAudioRecorder, formatTime } from "@/hooks/use-audio-recorder";
import { Waveform } from "@/components/ui/waveform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RecordMeeting() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
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

      // Create meeting first
      const meeting = await apiRequest("POST", "/api/meetings", {
        title: title || "Untitled Meeting",
        tags,
        notes
      });
      const meetingResponse = await meeting.json();
      const newMeetingId = meetingResponse.id;
      setMeetingId(newMeetingId);
      setProcessingProgress(40);

      // Upload file for transcription
      const formData = new FormData();
      formData.append('audio', uploadedFile);

      const transcribeResponse = await apiRequest("POST", `/api/meetings/${newMeetingId}/record`, formData);
      const transcribeResult = await transcribeResponse.json();
      setTranscriptText(transcribeResult.transcript);
      setProcessingProgress(70);

      // Generate summary and action items
      await generateSummaryAndActions(newMeetingId);
      setProcessingProgress(100);

      toast({
        title: "Processing complete!",
        description: "Your audio file has been transcribed and analyzed."
      });

      setTimeout(() => {
        navigate(`/meetings/${newMeetingId}`);
      }, 1000);

    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: "There was an error processing your file.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
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

      // Create meeting with transcript
      const meeting = await apiRequest("POST", "/api/meetings", {
        title: title || "Untitled Meeting",
        tags,
        notes,
        transcript: manualText
      });
      const meetingResponse = await meeting.json();
      const newMeetingId = meetingResponse.id;
      setMeetingId(newMeetingId);
      setProcessingProgress(60);

      // Generate summary and action items
      await generateSummaryAndActions(newMeetingId);
      setProcessingProgress(100);

      toast({
        title: "Processing complete!",
        description: "Your meeting content has been analyzed."
      });

      setTimeout(() => {
        navigate(`/meetings/${newMeetingId}`);
      }, 1000);

    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: "There was an error processing your text.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Generate summary and action items helper
  const generateSummaryAndActions = async (meetingId: number) => {
    try {
      // Generate summary
      await apiRequest("POST", `/api/meetings/${meetingId}/summary`);
      // Generate action items
      await apiRequest("POST", `/api/meetings/${meetingId}/action-items`);
    } catch (error) {
      console.error("Error generating summary or actions:", error);
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
          const meeting = await apiRequest("POST", "/api/meetings", {
            title: title || "Untitled Meeting",
            tags,
            notes
          });
          const response = await meeting.json();
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
    if (!audioBlob || !meetingId) return;
    
    try {
      setIsProcessing(true);
      setProcessingProgress(0);
      
      // Upload audio file
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      
      setProcessingProgress(30);
      const uploadResponse = await apiRequest("POST", `/api/meetings/${meetingId}/record`, formData);
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
      navigate(`/meeting/${meetingId}`);
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