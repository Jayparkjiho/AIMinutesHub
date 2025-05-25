import { Link } from "wouter";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { Meeting } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  // Format the date to show how long ago it was
  const formattedDate = formatDistanceToNow(new Date(meeting.date), { addSuffix: true });
  const formattedDuration = formatDuration(meeting.duration);
  
  return (
    <Link href={`/meeting/${meeting.id}`}>
      <a className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow block">
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-neutral-800 truncate">{meeting.title}</h3>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{formattedDuration}</span>
          </div>
          <p className="text-neutral-600 text-sm line-clamp-2 mb-3 content-text">
            {meeting.summary || "No summary available yet. Process this meeting to generate a summary."}
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
                className="text-neutral-400 hover:text-neutral-600" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Add meeting options functionality here
                }}
                aria-label="Meeting options"
              >
                <i className="ri-more-2-fill"></i>
              </button>
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}
