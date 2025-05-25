import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MeetingCard } from "@/components/MeetingCard";
import { RecordingRow } from "@/components/RecordingRow";
import { Meeting, MeetingStat } from "@/lib/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All Tags");

  // Fetch meetings
  const { 
    data: meetings, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  // Calculate stats from meetings
  const stats: MeetingStat = {
    totalTime: "0 hours",
    totalMeetings: 0,
    wordCount: 0,
  };

  if (meetings && meetings.length > 0) {
    // Calculate total duration in hours
    const totalSeconds = meetings.reduce((acc, meeting) => acc + meeting.duration, 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    stats.totalTime = `${hours}.${Math.floor(minutes / 6)}`;

    // Count meetings
    stats.totalMeetings = meetings.length;

    // Calculate word count
    stats.wordCount = meetings.reduce((acc, meeting) => {
      if (meeting.transcript) {
        return acc + meeting.transcript.split(/\s+/).length;
      }
      return acc;
    }, 0);
  }

  // Filter meetings for the recordings table
  const filteredRecordings = meetings?.filter(meeting => {
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

  // Get recent meetings (up to 3)
  const recentMeetings = meetings?.slice(0, 3) || [];

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Dashboard</h1>
          <p className="text-neutral-500 mt-1">
            Welcome back. You have {meetings?.length || 0} meeting transcripts.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link href="/record">
            <a className="bg-primary text-white px-4 py-2 rounded-md flex items-center shadow-sm hover:bg-primary/90 transition-colors">
              <i className="ri-mic-line mr-2"></i>
              <span>New Recording</span>
            </a>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
              <i className="ri-time-line text-primary text-xl"></i>
            </div>
            <div>
              <p className="text-neutral-500 text-sm">Total Recording Time</p>
              <p className="text-xl font-semibold text-neutral-800">{stats.totalTime} hours</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mr-3">
              <i className="ri-file-text-line text-secondary text-xl"></i>
            </div>
            <div>
              <p className="text-neutral-500 text-sm">Total Meetings</p>
              <p className="text-xl font-semibold text-neutral-800">{stats.totalMeetings}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mr-3">
              <i className="ri-search-line text-accent text-xl"></i>
            </div>
            <div>
              <p className="text-neutral-500 text-sm">Word Count</p>
              <p className="text-xl font-semibold text-neutral-800">
                {stats.wordCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-800">Recent Meetings</h2>
          <Link href="/meetings">
            <a className="text-primary text-sm flex items-center hover:underline">
              View all
              <i className="ri-arrow-right-line ml-1"></i>
            </a>
          </Link>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-4 h-40 animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-neutral-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-neutral-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-neutral-200 rounded w-2/3 mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-neutral-200 rounded w-1/4"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-md">
            Error loading meetings. Please try again.
          </div>
        ) : recentMeetings.length === 0 ? (
          <div className="p-4 bg-neutral-50 text-neutral-600 rounded-md">
            No meetings yet. Click "New Recording" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentMeetings.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        )}
      </div>
      
      {/* Recent Recordings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-800">Recent Recordings</h2>
          <div className="flex items-center">
            <div className="relative mr-4">
              <input 
                type="text" 
                placeholder="Search recordings" 
                className="pl-8 pr-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm"></i>
            </div>
            <select 
              className="text-sm border border-neutral-300 rounded-md py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
            >
              <option>All Tags</option>
              {uniqueTags.map(tag => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>
        
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
                      Loading recordings...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-red-500">
                      Error loading recordings. Please try again.
                    </td>
                  </tr>
                ) : filteredRecordings?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      No recordings found. Try different search terms or filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecordings?.slice(0, 5).map(recording => (
                    <RecordingRow 
                      key={recording.id} 
                      recording={recording} 
                      onDeleteSuccess={refetch}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
