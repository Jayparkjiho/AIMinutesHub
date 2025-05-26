import { formatDuration } from "@/hooks/use-audio-recorder";
import { Meeting } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface MeetingCardProps {
  meeting: Meeting;
  onDeleteSuccess?: () => void;
}

export function MeetingCard({ meeting, onDeleteSuccess }: MeetingCardProps) {
  const { deleteMeeting } = useIndexedDBMeetings();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Format the date to show how long ago it was
  const formattedDate = formatDistanceToNow(new Date(meeting.date), { addSuffix: true });
  const formattedDuration = formatDuration(meeting.duration);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm(`정말로 "${meeting.title}" 회의를 삭제하시겠습니까?`)) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      await deleteMeeting(meeting.id);
      toast({
        title: "회의 삭제 완료",
        description: `"${meeting.title}" 회의가 삭제되었습니다.`,
      });
      
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
    } catch (error: any) {
      toast({
        title: "삭제 오류",
        description: error?.message || "회의 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-neutral-800 truncate">{meeting.title}</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{formattedDuration}</span>
        </div>
        <p className="text-neutral-600 text-sm line-clamp-2 mb-3 content-text">
          {meeting.summary || "AI 분석을 통해 요약을 생성해보세요."}
        </p>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{formattedDate}</span>
          <div className="flex items-center">
            {meeting.tags && meeting.tags.length > 0 && (
              <span className="bg-neutral-200 px-2 py-1 rounded-full mr-2">
                {meeting.tags[0]}
              </span>
            )}
            <button 
              className="text-neutral-400 hover:text-red-600" 
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="회의 삭제"
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
