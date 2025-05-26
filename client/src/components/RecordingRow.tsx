import { Meeting } from "@/lib/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { format } from "date-fns";
import { Link } from "wouter";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";

interface RecordingRowProps {
  recording: Meeting;
  onDeleteSuccess?: () => void;
}

export function RecordingRow({ recording, onDeleteSuccess }: RecordingRowProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteMeeting } = useIndexedDBMeetings();
  
  const formattedDate = format(new Date(recording.date), "MMM d, yyyy");
  const formattedDuration = formatDuration(recording.duration);
  
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Confirm deletion
    if (!window.confirm(`정말로 "${recording.title}" 회의를 삭제하시겠습니까?`)) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      await deleteMeeting(recording.id);
      toast({
        title: "회의 삭제 완료",
        description: `"${recording.title}" 회의가 삭제되었습니다.`,
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
  
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (recording.transcript) {
      // Create a download link for the transcript
      const element = document.createElement("a");
      const file = new Blob([recording.transcript], { type: "text/plain" });
      element.href = URL.createObjectURL(file);
      element.download = `${recording.title.replace(/\s+/g, "_")}_transcript.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      toast({
        title: "No transcript available",
        description: "This recording doesn't have a transcript yet.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3">
        <Link href={`/meetings/${recording.id}`}>
          <a className="flex items-center">
            <i className="ri-file-text-line text-lg text-primary mr-2"></i>
            <span className="font-medium text-neutral-800">{recording.title}</span>
          </a>
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-600">{formattedDate}</td>
      <td className="px-4 py-3 text-sm text-neutral-600">{formattedDuration}</td>
      <td className="px-4 py-3">
        {recording.tags && recording.tags.length > 0 && (
          <span className="inline-flex text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-700">
            {recording.tags[0]}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex space-x-2">
          <Link href={`/meeting/${recording.id}/edit`}>
            <a 
              className="text-neutral-500 hover:text-primary" 
              title="Edit"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="ri-edit-line"></i>
            </a>
          </Link>
          <button 
            className="text-neutral-500 hover:text-primary" 
            title="Download" 
            onClick={handleDownload}
            disabled={!recording.transcript}
          >
            <i className="ri-download-line"></i>
          </button>
          <button 
            className="text-neutral-500 hover:text-primary" 
            title="Share"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Share functionality could be added here
              toast({
                title: "Share feature",
                description: "Sharing functionality is not implemented yet."
              });
            }}
          >
            <i className="ri-share-line"></i>
          </button>
          <button 
            className="text-neutral-500 hover:text-error" 
            title="Delete" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}
