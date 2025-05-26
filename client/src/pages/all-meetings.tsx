import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Meeting } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { MeetingDetailModal } from "@/components/MeetingDetailModal";
import { useToast } from "@/hooks/use-toast";

export default function AllMeetings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All Tags");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { meetings, isLoading, deleteMeeting } = useIndexedDBMeetings();
  const { toast } = useToast();
  
  const isError = false; // IndexedDB doesn't have loading errors in this context
  
  // Filter meetings based on search query and selected tag
  const filteredMeetings = meetings?.filter(meeting => {
    // Filter by search query
    const matchesSearch = searchQuery === "" || 
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by tag
    const matchesTag = selectedTag === "All Tags" || 
      (meeting.tags && meeting.tags.includes(selectedTag));
    
    return matchesSearch && matchesTag;
  });
  
  // Get unique tags for the filter dropdown
  const uniqueTags = meetings?.reduce((acc: string[], meeting) => {
    if (meeting.tags) {
      meeting.tags.forEach(tag => {
        if (!acc.includes(tag)) {
          acc.push(tag);
        }
      });
    }
    return acc;
  }, []) || [];

  // Delete meeting function
  const handleDeleteMeeting = async (meeting: Meeting) => {
    if (!window.confirm(`정말로 "${meeting.title}" 회의를 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      await deleteMeeting(meeting.id);
      toast({
        title: "회의 삭제 완료",
        description: `"${meeting.title}" 회의가 삭제되었습니다.`,
      });
      
      // The meetings list will automatically update since IndexedDB hook is reactive
    } catch (error: any) {
      toast({
        title: "삭제 오류",
        description: error?.message || "회의 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">All Meetings</h1>
          <p className="text-neutral-500 mt-1">View and manage all your recorded meetings</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link href="/record">
            <a>
              <Button>
                <i className="ri-mic-line mr-2"></i>
                New Recording
              </Button>
            </a>
          </Link>
        </div>
      </div>
      
      {/* Filter controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative md:w-64">
          <Input 
            type="text" 
            placeholder="Search meetings" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8"
          />
          <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm"></i>
        </div>
        <div className="flex gap-2">
          <select 
            className="border border-neutral-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={selectedTag}
            onChange={e => setSelectedTag(e.target.value)}
          >
            <option>All Tags</option>
            {uniqueTags.map(tag => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
          <Button 
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setSelectedTag("All Tags");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>
      
      {/* Meetings List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
          <p className="text-neutral-500">Loading meetings...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">
          <i className="ri-error-warning-line text-2xl mb-2 block"></i>
          <p>Error loading meetings. Please try again.</p>
        </div>
      ) : filteredMeetings?.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <i className="ri-file-search-line text-2xl mb-2 block"></i>
          <p>No meetings found. Try different search terms or filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMeetings?.map(meeting => (
            <Card key={meeting.id} className="p-6 hover:shadow-md transition-shadow duration-200">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {meeting.title}
                </h3>
                <span className="text-sm text-gray-500">
                  {new Date(meeting.date).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'numeric', 
                    day: 'numeric',
                    weekday: 'short'
                  })} {new Date(meeting.date).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Meeting Info */}
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <i className="ri-calendar-line mr-1"></i>
                  {new Date(meeting.date).toLocaleDateString('ko-KR')}
                </div>
                <div className="flex items-center">
                  <i className="ri-user-line mr-1"></i>
                  {meeting.participants?.length || 0}명 참석
                </div>
                <div className="flex items-center">
                  <i className="ri-time-line mr-1"></i>
                  {formatDuration(meeting.duration)}
                </div>
                <div className="flex items-center">
                  <i className="ri-task-line mr-1"></i>
                  {meeting.actionItems?.length || 0}개
                </div>
              </div>

              {/* Summary */}
              {meeting.summary && (
                <div className="mb-4">
                  <p className="text-gray-700 leading-relaxed">
                    {meeting.summary.length > 200 
                      ? meeting.summary.substring(0, 200) + '...' 
                      : meeting.summary
                    }
                  </p>
                </div>
              )}

              {/* Participants and Tags */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Participants */}
                  {meeting.participants && meeting.participants.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">참여자:</span>
                      <div className="flex gap-1">
                        {meeting.participants.slice(0, 3).map((participant, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {participant.name}
                          </Badge>
                        ))}
                        {meeting.participants.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{meeting.participants.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {meeting.tags && meeting.tags.length > 0 && (
                    <div className="flex items-center gap-2 ml-4">
                      <div className="flex gap-1">
                        {meeting.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {meeting.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{meeting.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedMeeting(meeting);
                      setIsModalOpen(true);
                    }}
                  >
                    <i className="ri-eye-line mr-1"></i>
                    상세보기
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      // Send email functionality
                      console.log('Send email for meeting:', meeting.id);
                    }}
                  >
                    <i className="ri-mail-send-line mr-1"></i>
                    이메일 발송
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteMeeting(meeting)}
                  >
                    <i className="ri-delete-bin-line"></i>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Meeting Detail Modal */}
      <MeetingDetailModal 
        meeting={selectedMeeting}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMeeting(null);
        }}
        onDeleteSuccess={() => {
          // The meetings list will automatically update since IndexedDB hook is reactive
        }}
      />
    </div>
  );
}
