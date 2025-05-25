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
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
  
  const {
    audioBlob,
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();
  
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
        } catch (error) {
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
    if (!audioBlob || !meetingId) {
      toast({
        title: "No recording to save",
        description: "Please record audio before saving.",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    setProcessingProgress(10);
    
    try {
      // Create a form data object to send the audio file
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      
      // Start a fake progress timer to show progress to user
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 1000);
      
      // Send the audio to the server for processing
      const response = await fetch(`/api/meetings/${meetingId}/record`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to process recording");
      }
      
      const data = await response.json();
      
      // Invalidate the meetings cache to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      
      toast({
        title: "Recording saved!",
        description: "Your meeting has been processed successfully."
      });
      
      // Navigate to the meeting detail page
      navigate(`/meeting/${meetingId}`);
    } catch (error) {
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
          <h1 className="text-2xl font-bold text-neutral-800">Record Meeting</h1>
          <p className="text-neutral-500 mt-1">Create a new meeting recording and transcription</p>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4">
            <label htmlFor="meetingTitle" className="block text-sm font-medium text-neutral-700 mb-1">Meeting Title</label>
            <Input 
              id="meetingTitle"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter meeting title"
              className="w-full"
            />
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
          
          <div className="mb-6">
            <label htmlFor="meetingNotes" className="block text-sm font-medium text-neutral-700 mb-1">Pre-meeting Notes (Optional)</label>
            <Textarea 
              id="meetingNotes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any context or agenda items for this meeting"
              rows={3}
            />
          </div>
          
          <div className="bg-neutral-50 rounded-lg p-6 text-center">
            <div id="recordingControls" className="mb-6">
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
            
            {isProcessing && (
              <div>
                <div className="flex items-center justify-center mb-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                  <span className="text-neutral-600">Transcribing audio...</span>
                </div>
                <Progress value={processingProgress} className="mb-4 h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end space-x-3">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSaveRecording}
          disabled={!audioBlob || isRecording || isProcessing}
        >
          Save Recording
        </Button>
      </div>
    </div>
  );
}
