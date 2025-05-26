import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Meeting, ActionItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { indexedDBStorage } from "@/lib/indexeddb";

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
  
  // Fetch meeting data from IndexedDB
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const loadMeeting = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        await indexedDBStorage.init();
        const meetingData = await indexedDBStorage.getMeeting(parseInt(id));
        if (meetingData) {
          console.log('Meeting data loaded:', meetingData);
          console.log('Summary exists:', !!meetingData.summary);
          console.log('Summary content:', meetingData.summary);
          setMeeting(meetingData);
        } else {
          setIsError(true);
        }
      } catch (error) {
        console.error('Error loading meeting:', error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadMeeting();
  }, [id]);
  
  // Add tag function
  const addTag = async (tag: string) => {
    if (!meeting) return;
    
    try {
      const updatedMeeting = {
        ...meeting,
        tags: [...(meeting.tags || []), tag]
      };
      
      await indexedDBStorage.updateMeeting(meeting.id, updatedMeeting);
      setMeeting(updatedMeeting);
      
      toast({
        title: "Success",
        description: "Tag added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
    }
  };

  // Remove tag function
  const removeTag = async (tagToRemove: string) => {
    if (!meeting) return;
    
    try {
      const updatedMeeting = {
        ...meeting,
        tags: meeting.tags?.filter(tag => tag !== tagToRemove) || []
      };
      
      await indexedDBStorage.updateMeeting(meeting.id, updatedMeeting);
      setMeeting(updatedMeeting);
      
      toast({
        title: "Success",
        description: "Tag removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive",
      });
    }
  };

  // Add action item function
  const addActionItem = async (actionItem: { text: string; assignee: string; dueDate: string }) => {
    if (!meeting) return;
    
    try {
      const newActionItemWithId: ActionItem = {
        id: `action_${Date.now()}`,
        text: actionItem.text,
        completed: false,
        assignee: actionItem.assignee || undefined,
        dueDate: actionItem.dueDate || undefined,
      };
      
      const updatedMeeting = {
        ...meeting,
        actionItems: [...(meeting.actionItems || []), newActionItemWithId]
      };
      
      await indexedDBStorage.updateMeeting(meeting.id, updatedMeeting);
      setMeeting(updatedMeeting);
      
      toast({
        title: "Success",
        description: "Action item added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add action item",
        variant: "destructive",
      });
    }
  };

  // Toggle action item completion
  const toggleActionItem = async (itemId: string) => {
    if (!meeting) return;
    
    try {
      const updatedActionItems = meeting.actionItems?.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ) || [];
      
      const updatedMeeting = {
        ...meeting,
        actionItems: updatedActionItems
      };
      
      await indexedDBStorage.updateMeeting(meeting.id, updatedMeeting);
      setMeeting(updatedMeeting);
      
      toast({
        title: "Success",
        description: "Action item updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update action item",
        variant: "destructive",
      });
    }
  };

  // Delete meeting function
  const deleteMeeting = async () => {
    if (!meeting) return;
    
    if (window.confirm("Are you sure you want to delete this meeting?")) {
      try {
        await indexedDBStorage.deleteMeeting(meeting.id);
        
        toast({
          title: "Success",
          description: "Meeting deleted successfully",
        });
        
        navigate("/meetings");
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete meeting",
          variant: "destructive",
        });
      }
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !meeting?.tags?.includes(newTag.trim())) {
      addTag(newTag.trim());
      setNewTag("");
    }
  };

  const handleAddActionItem = () => {
    if (newActionItem.text.trim()) {
      addActionItem(newActionItem);
      setNewActionItem({ text: "", assignee: "", dueDate: "" });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-lg">Loading meeting...</div>
        </div>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">404 Meeting Not Found</h1>
          <p className="text-gray-600 mb-4">The meeting you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate("/meetings")}>
            Back to All Meetings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{meeting.title}</h1>
          <p className="text-gray-600 mt-2">
            {format(parseISO(meeting.date), "PPpp")} • {formatDuration(meeting.duration)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              window.location.reload();
            }}
          >
            <i className="ri-refresh-line mr-2"></i>
            새로고침
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              const encodedData = encodeURIComponent(JSON.stringify(meeting));
              navigate(`/email-sender?meetingData=${encodedData}`);
            }}
          >
            <i className="ri-mail-send-line mr-2"></i>
            이메일 발송
          </Button>
          <Button 
            variant="destructive" 
            onClick={deleteMeeting}
          >
            Delete Meeting
          </Button>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {meeting.tags?.map((tag: string) => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className="cursor-pointer hover:bg-red-100"
              onClick={() => removeTag(tag)}
            >
              {tag} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add new tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
            className="max-w-xs"
          />
          <Button onClick={handleAddTag}>Add Tag</Button>
        </div>
      </div>

      {/* Audio Player */}
      {meeting.audioUrl && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Audio Recording</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <audio
              ref={audioRef}
              src={meeting.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="w-full"
              controls
            />
          </div>
        </div>
      )}

      {/* Participants */}
      {meeting.participants && meeting.participants.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Participants</h3>
          <div className="flex flex-wrap gap-2">
            {meeting.participants.map((participant: any) => (
              <Badge key={participant.id} variant={participant.isHost ? "default" : "outline"}>
                {participant.name} {participant.isHost && "(Host)"}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {meeting.notes && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Notes</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="whitespace-pre-wrap">{meeting.notes}</p>
          </div>
        </div>
      )}

      {/* AI Analysis Results */}
      {(meeting.transcript || meeting.summary || (meeting.actionItems && meeting.actionItems.length > 0)) && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center mb-4">
              <i className="ri-brain-line mr-2"></i>
              AI 분석 결과
            </h3>
            
            {/* Transcript Preview */}
            {meeting.transcript && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2 flex items-center">
                  <i className="ri-file-text-line mr-2"></i>
                  전사 내용
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{meeting.transcript}</p>
                </div>
              </div>
            )}

            {/* Generated Summary */}
            {meeting.summary && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2 flex items-center">
                  <i className="ri-article-line mr-2 text-blue-600"></i>
                  AI 요약
                </h4>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm whitespace-pre-wrap">{meeting.summary}</p>
                </div>
              </div>
            )}

            {/* Generated Action Items */}
            {meeting.actionItems && meeting.actionItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <i className="ri-task-line mr-2 text-green-600"></i>
                  AI 액션 아이템 ({meeting.actionItems.length}개)
                </h4>
                <div className="space-y-2">
                  {meeting.actionItems.map((item: ActionItem) => (
                    <div key={item.id} className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${item.completed ? 'line-through text-gray-500' : ''}`}>
                            {item.text}
                          </p>
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="ml-2">
                            {item.completed ? "완료" : "대기"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleActionItem(item.id)}
                          >
                            {item.completed ? "취소" : "완료"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Action Items Management */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">추가 액션 아이템 관리</h3>
        
        {/* No items message */}
        {(!meeting.actionItems || meeting.actionItems.length === 0) && (
          <p className="text-gray-500">AI가 생성한 액션 아이템이 없습니다.</p>
        )}

        {/* Add New Action Item */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h4 className="font-medium">Add New Action Item</h4>
          <div className="space-y-2">
            <Input
              placeholder="Action item description"
              value={newActionItem.text}
              onChange={(e) => setNewActionItem({...newActionItem, text: e.target.value})}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Assignee (optional)"
                value={newActionItem.assignee}
                onChange={(e) => setNewActionItem({...newActionItem, assignee: e.target.value})}
                className="flex-1"
              />
              <Input
                type="date"
                placeholder="Due date (optional)"
                value={newActionItem.dueDate}
                onChange={(e) => setNewActionItem({...newActionItem, dueDate: e.target.value})}
                className="flex-1"
              />
            </div>
            <Button onClick={handleAddActionItem}>Add Action Item</Button>
          </div>
        </div>
      </div>
    </div>
  );
}