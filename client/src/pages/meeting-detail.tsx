import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Meeting, ActionItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [newTag, setNewTag] = useState("");
  const [newActionItem, setNewActionItem] = useState({
    text: "",
    assignee: "",
    dueDate: ""
  });
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Fetch meeting data
  const { 
    data: meeting, 
    isLoading, 
    isError, 
    error 
  } = useQuery<Meeting>({
    queryKey: [`/api/meetings/${id}`],
  });
  
  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      if (!meeting) return null;
      const tags = [...(meeting.tags || [])];
      if (!tags.includes(tag)) {
        tags.push(tag);
        const response = await apiRequest("PATCH", `/api/meetings/${id}`, { tags });
        return response.json();
      }
      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${id}`] });
      setNewTag("");
    },
    onError: (error) => {
      toast({
        title: "Error adding tag",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Add action item mutation
  const addActionItemMutation = useMutation({
    mutationFn: async (actionItem: { text: string, assignee?: string, dueDate?: string }) => {
      const response = await apiRequest("POST", `/api/meetings/${id}/action-items`, actionItem);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${id}`] });
      setNewActionItem({ text: "", assignee: "", dueDate: "" });
    },
    onError: (error) => {
      toast({
        title: "Error adding action item",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Toggle action item completion mutation
  const toggleActionItemMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string, completed: boolean }) => {
      const response = await apiRequest(
        "PATCH", 
        `/api/meetings/${id}/action-items/${itemId}`, 
        { completed }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${id}`] });
    },
    onError: (error) => {
      toast({
        title: "Error updating action item",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Regenerate summary mutation
  const regenerateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/meetings/${id}/summary`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${id}`] });
      toast({
        title: "Summary regenerated",
        description: "The meeting summary has been updated."
      });
    },
    onError: (error) => {
      toast({
        title: "Error regenerating summary",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (isError || !meeting) {
    return (
      <div className="px-4 py-6 md:px-8">
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          Error loading meeting: {error?.message || "Meeting not found"}
        </div>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate("/")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }
  
  // Format meeting data
  const formattedDate = format(parseISO(meeting.date), "MMMM d, yyyy");
  const formattedDuration = formatDuration(meeting.duration);
  const participantCount = meeting.participants?.length || 0;
  
  // Handle audio playback
  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          toast({
            title: "Playback error",
            description: "Could not play the audio recording.",
            variant: "destructive"
          });
        });
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // Handle adding a tag
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim()) {
      addTagMutation.mutate(newTag.trim());
    }
  };
  
  // Handle adding an action item
  const handleAddActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newActionItem.text.trim()) {
      addActionItemMutation.mutate({
        text: newActionItem.text,
        assignee: newActionItem.assignee || undefined,
        dueDate: newActionItem.dueDate || undefined
      });
    }
  };
  
  // Handle toggling action item completion
  const handleToggleActionItem = (itemId: string, currentStatus: boolean) => {
    toggleActionItemMutation.mutate({ itemId, completed: !currentStatus });
  };
  
  // Format transcript for display
  const formatTranscriptForDisplay = (transcript?: string) => {
    if (!transcript) return null;
    
    // Simple formatting assuming format like "Name (00:00:00): Text"
    const lines = transcript.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      const match = line.match(/^(.+?)\s*\((\d{2}:\d{2}:\d{2})\):\s*(.+)$/);
      
      if (match) {
        const [_, name, timestamp, text] = match;
        
        // Find corresponding participant for the color
        const participant = meeting.participants?.find(p => 
          p.name.toLowerCase() === name.toLowerCase().trim()
        );
        
        const colorClass = participant?.isHost 
          ? "bg-primary/10 text-primary" 
          : "bg-secondary/10 text-secondary";
        
        return (
          <div key={index} className="mb-4 pb-4 border-b border-neutral-100">
            <div className="flex mb-2">
              <div className={`w-6 h-6 rounded-full ${colorClass} flex items-center justify-center mr-2 flex-shrink-0`}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-baseline">
                  <span className="font-medium text-neutral-800 mr-2">{name}</span>
                  <span className="text-xs text-neutral-500">{timestamp}</span>
                </div>
                <p>{text}</p>
              </div>
            </div>
          </div>
        );
      }
      
      // Fallback for lines that don't match the pattern
      return (
        <p key={index} className="mb-4">{line}</p>
      );
    });
  };
  
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <div className="flex items-center mb-1">
            <button 
              className="mr-2 text-neutral-500 hover:text-neutral-700"
              onClick={() => navigate("/")}
              aria-label="Back to dashboard"
            >
              <i className="ri-arrow-left-line"></i>
            </button>
            <h1 className="text-2xl font-bold text-neutral-800">{meeting.title}</h1>
          </div>
          <div className="flex items-center text-neutral-500 text-sm">
            <span className="flex items-center mr-4">
              <i className="ri-calendar-line mr-1"></i> {formattedDate}
            </span>
            <span className="flex items-center mr-4">
              <i className="ri-time-line mr-1"></i> {formattedDuration}
            </span>
            <span className="flex items-center">
              <i className="ri-user-line mr-1"></i> {participantCount} participants
            </span>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Create a download for transcript
              if (meeting.transcript) {
                const element = document.createElement("a");
                const file = new Blob([meeting.transcript], { type: "text/plain" });
                element.href = URL.createObjectURL(file);
                element.download = `${meeting.title.replace(/\s+/g, "_")}_transcript.txt`;
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              } else {
                toast({
                  title: "No transcript available",
                  description: "This meeting doesn't have a transcript yet."
                });
              }
            }}
            disabled={!meeting.transcript}
          >
            <i className="ri-download-line mr-1"></i>
            Download
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Share functionality would be implemented here
              toast({
                title: "Share feature",
                description: "Sharing functionality is not implemented yet."
              });
            }}
          >
            <i className="ri-share-line mr-1"></i>
            Share
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/meeting/${id}/edit`)}
          >
            <i className="ri-edit-line mr-1"></i>
            Edit
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Transcript */}
        <div className="lg:col-span-2">
          {/* Audio player */}
          {meeting.audioUrl && (
            <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4 shadow-sm">
              <div className="flex items-center mb-3">
                <button 
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white mr-3"
                  onClick={toggleAudioPlayback}
                  aria-label={isPlaying ? "Pause audio" : "Play audio"}
                >
                  <i className={`${isPlaying ? "ri-pause-fill" : "ri-play-fill"} text-xl`}></i>
                </button>
                <div className="flex-1">
                  <audio 
                    ref={audioRef}
                    src={meeting.audioUrl} 
                    onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    className="hidden"
                  />
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    {audioRef.current && (
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ 
                          width: `${(currentTime / audioRef.current.duration) * 100}%` 
                        }}
                      ></div>
                    )}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-neutral-500">
                      {formatDuration(Math.floor(currentTime))}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatDuration(meeting.duration)}
                    </span>
                  </div>
                </div>
                <div className="ml-3 flex items-center">
                  <button 
                    className="text-neutral-600 hover:text-neutral-800 p-1" 
                    onClick={() => {
                      if (audioRef.current) {
                        const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
                        const currentIndex = rates.indexOf(audioRef.current.playbackRate);
                        const nextIndex = (currentIndex + 1) % rates.length;
                        audioRef.current.playbackRate = rates[nextIndex];
                      }
                    }}
                    aria-label="Change playback speed"
                  >
                    <span className="text-xs font-medium">
                      {audioRef.current?.playbackRate || 1}x
                    </span>
                  </button>
                  <button 
                    className="text-neutral-600 hover:text-neutral-800 p-1" 
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.muted = !audioRef.current.muted;
                      }
                    }}
                    aria-label="Toggle mute"
                  >
                    <i className={`${audioRef.current?.muted ? "ri-volume-mute-line" : "ri-volume-up-line"}`}></i>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Transcript content */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-neutral-800">Transcript</h2>
              <div className="flex space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(`/meeting/${id}/edit`)}
                >
                  <i className="ri-edit-line mr-1"></i> Edit
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    // Copy transcript to clipboard
                    if (meeting.transcript) {
                      navigator.clipboard.writeText(meeting.transcript)
                        .then(() => {
                          toast({
                            title: "Copied to clipboard",
                            description: "Transcript copied to clipboard successfully."
                          });
                        })
                        .catch(() => {
                          toast({
                            title: "Copy failed",
                            description: "Failed to copy transcript to clipboard.",
                            variant: "destructive"
                          });
                        });
                    } else {
                      toast({
                        title: "No transcript available",
                        description: "This meeting doesn't have a transcript yet."
                      });
                    }
                  }}
                  disabled={!meeting.transcript}
                >
                  <i className="ri-file-copy-line mr-1"></i> Copy
                </Button>
              </div>
            </div>
            
            <div className="transcript-text content-text text-neutral-700">
              {meeting.transcript ? (
                formatTranscriptForDisplay(meeting.transcript)
              ) : (
                <div className="p-4 bg-neutral-50 text-center text-neutral-500 rounded-md">
                  No transcript available for this meeting yet.
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Sidebar with summary and action items */}
        <div className="lg:col-span-1">
          {/* Summary */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4 shadow-sm">
            <h3 className="font-semibold text-neutral-800 mb-3">AI Summary</h3>
            <div className="text-neutral-700 text-sm content-text mb-3">
              {meeting.summary ? (
                <p>{meeting.summary}</p>
              ) : (
                <p className="text-neutral-500">No summary available yet.</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-primary text-xs"
                onClick={() => regenerateSummaryMutation.mutate()}
                disabled={!meeting.transcript || regenerateSummaryMutation.isPending}
              >
                <i className="ri-refresh-line mr-1"></i> 
                {regenerateSummaryMutation.isPending ? 'Regenerating...' : 'Regenerate'}
              </Button>
            </div>
          </div>
          
          {/* Action Items */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-neutral-800">Action Items</h3>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary text-xs"
                onClick={() => {
                  const dialog = document.getElementById('add-action-item-dialog') as HTMLDialogElement;
                  if (dialog) dialog.showModal();
                }}
              >
                <i className="ri-add-line mr-1"></i> Add
              </Button>
              
              {/* Add Action Item Dialog */}
              <dialog id="add-action-item-dialog" className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
                <form onSubmit={handleAddActionItem}>
                  <h3 className="text-lg font-semibold mb-4">Add Action Item</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Task</label>
                    <Input
                      value={newActionItem.text}
                      onChange={e => setNewActionItem({...newActionItem, text: e.target.value})}
                      placeholder="Enter task description"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Assignee</label>
                    <Input
                      value={newActionItem.assignee}
                      onChange={e => setNewActionItem({...newActionItem, assignee: e.target.value})}
                      placeholder="Who is responsible for this task?"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <Input
                      type="date"
                      value={newActionItem.dueDate}
                      onChange={e => setNewActionItem({...newActionItem, dueDate: e.target.value})}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const dialog = document.getElementById('add-action-item-dialog') as HTMLDialogElement;
                        if (dialog) dialog.close();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={!newActionItem.text.trim() || addActionItemMutation.isPending}
                    >
                      {addActionItemMutation.isPending ? 'Adding...' : 'Add Action Item'}
                    </Button>
                  </div>
                </form>
              </dialog>
            </div>
            
            {meeting.actionItems && meeting.actionItems.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {meeting.actionItems.map((item: ActionItem) => (
                  <li key={item.id} className="flex items-start">
                    <div 
                      className={`flex-shrink-0 w-5 h-5 rounded border cursor-pointer flex items-center justify-center mr-2 mt-0.5 ${
                        item.completed 
                          ? "border-primary text-white bg-primary" 
                          : "border-neutral-300 text-white"
                      }`}
                      onClick={() => handleToggleActionItem(item.id, item.completed)}
                    >
                      {item.completed && <i className="ri-check-line text-xs"></i>}
                    </div>
                    <div>
                      <p className={`text-neutral-800 ${item.completed ? "line-through text-neutral-500" : ""}`}>
                        {item.text}
                      </p>
                      {(item.assignee || item.dueDate) && (
                        <div className="flex items-center mt-1 text-xs text-neutral-500">
                          {item.dueDate && (
                            <span className="mr-2">Due: {format(new Date(item.dueDate), "MMM d")}</span>
                          )}
                          {item.assignee && (
                            <span>Assigned to: {item.assignee}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500 text-sm py-2">No action items yet.</p>
            )}
          </div>
          
          {/* Tags */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4 shadow-sm">
            <h3 className="font-semibold text-neutral-800 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {meeting.tags && meeting.tags.length > 0 ? (
                meeting.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-primary/10 text-primary">
                    {tag}
                  </Badge>
                ))
              ) : (
                <p className="text-neutral-500 text-sm">No tags yet.</p>
              )}
            </div>
            <form className="flex mt-3" onSubmit={handleAddTag}>
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Add a tag"
                className="rounded-r-none"
              />
              <Button 
                type="submit" 
                className="rounded-l-none"
                disabled={!newTag.trim() || addTagMutation.isPending}
              >
                Add
              </Button>
            </form>
          </div>
          
          {/* Participants */}
          {meeting.participants && meeting.participants.length > 0 && (
            <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
              <h3 className="font-semibold text-neutral-800 mb-3">Participants</h3>
              <ul className="space-y-2">
                {meeting.participants.map(participant => {
                  const isHost = participant.isHost;
                  
                  return (
                    <li key={participant.id} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        isHost 
                          ? "bg-primary/10 text-primary" 
                          : "bg-secondary/10 text-secondary"
                      }`}>
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-neutral-800">
                        {participant.name} {isHost && "(Host)"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
