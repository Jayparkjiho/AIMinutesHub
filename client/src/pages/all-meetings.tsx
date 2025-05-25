import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Meeting } from "@/lib/types";
import { RecordingRow } from "@/components/RecordingRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export default function AllMeetings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All Tags");
  
  // Fetch all meetings
  const { 
    data: meetings, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });
  
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
      
      {/* Meetings table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-left">
                <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Tags</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                    <p className="mt-2">Loading meetings...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-red-500">
                    <i className="ri-error-warning-line text-xl"></i>
                    <p className="mt-2">Error loading meetings. Please try again.</p>
                  </td>
                </tr>
              ) : filteredMeetings?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    <i className="ri-file-search-line text-xl"></i>
                    <p className="mt-2">No meetings found. Try different search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredMeetings?.map(meeting => (
                  <RecordingRow 
                    key={meeting.id} 
                    recording={meeting} 
                    onDeleteSuccess={refetch}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
