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

export default function AllMeetings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All Tags");
  const { meetings, isLoading } = useIndexedDBMeetings();
  
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
      
      {/* Meetings Grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeetings?.map(meeting => (
            <Card key={meeting.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold text-neutral-800 line-clamp-2">
                    {meeting.title}
                  </CardTitle>
                  <div className="flex items-center text-xs text-neutral-500 ml-2">
                    <i className="ri-time-line mr-1"></i>
                    {formatDuration(meeting.duration)}
                  </div>
                </div>
                <div className="flex items-center text-sm text-neutral-500 mt-1">
                  <i className="ri-calendar-line mr-1"></i>
                  {new Date(meeting.date).toLocaleDateString('ko-KR')}
                </div>
              </CardHeader>
              <CardContent>
                {/* Summary Preview */}
                {meeting.summary && (
                  <div className="mb-4">
                    <p className="text-sm text-neutral-600 line-clamp-3">
                      {meeting.summary}
                    </p>
                  </div>
                )}
                
                {/* Tags */}
                {meeting.tags && meeting.tags.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {meeting.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {meeting.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{meeting.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Action Items Count */}
                {meeting.actionItems && meeting.actionItems.length > 0 && (
                  <div className="mb-4 text-sm text-neutral-600">
                    <i className="ri-task-line mr-1"></i>
                    {meeting.actionItems.length}개의 액션 아이템
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link href={`/meetings/${meeting.id}`} className="flex-1">
                    <Button size="sm" className="w-full">
                      <i className="ri-eye-line mr-1"></i>
                      상세보기
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      // Delete functionality - you can implement this
                      console.log('Delete meeting:', meeting.id);
                    }}
                  >
                    <i className="ri-delete-bin-line"></i>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
