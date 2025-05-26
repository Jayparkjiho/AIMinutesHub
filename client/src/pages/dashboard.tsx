import { useState } from "react";
import { Link } from "wouter";
import { MeetingCard } from "@/components/MeetingCard";
import { MeetingDetailModal } from "@/components/MeetingDetailModal";
import { RecordingRow } from "@/components/RecordingRow";
import { Meeting, MeetingStat } from "@/lib/types";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";

export default function Dashboard() {
  // Fetch meetings from IndexedDB
  const { meetings, isLoading } = useIndexedDBMeetings();
  const isError = false;

  // Modal state
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle meeting click
  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedMeeting(null);
  };

  // Handle meeting deletion
  const handleDeleteSuccess = () => {
    handleModalClose();
  };

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

  // Get recent meetings (up to 3)
  const recentMeetings = meetings?.slice(0, 3) || [];
  
  // Get recent recordings (up to 5)
  const recentRecordings = meetings?.slice(0, 5) || [];

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">대시보드</h1>
          <p className="text-neutral-500 mt-1">
            환영합니다. 총 {meetings?.length || 0}개의 회의 기록이 있습니다.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link href="/record" className="bg-primary text-white px-4 py-2 rounded-md flex items-center shadow-sm hover:bg-primary/90 transition-colors">
            <i className="ri-mic-line mr-2"></i>
            <span>새 녹음</span>
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
              <p className="text-neutral-500 text-sm">총 녹음 시간</p>
              <p className="text-xl font-semibold text-neutral-800">{stats.totalTime}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mr-3">
              <i className="ri-file-text-line text-secondary text-xl"></i>
            </div>
            <div>
              <p className="text-neutral-500 text-sm">총 회의 수</p>
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
              <p className="text-neutral-500 text-sm">총 단어 수</p>
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
          <h2 className="text-lg font-semibold text-neutral-800">최근 회의</h2>
          <Link href="/meetings" className="text-primary text-sm flex items-center hover:underline">
            전체 보기
            <i className="ri-arrow-right-line ml-1"></i>
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
            회의를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.
          </div>
        ) : recentMeetings.length === 0 ? (
          <div className="p-4 bg-neutral-50 text-neutral-600 rounded-md">
            아직 회의가 없습니다. "새 녹음" 버튼을 클릭하여 시작하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentMeetings.map(meeting => (
              <div key={meeting.id} onClick={() => handleMeetingClick(meeting)} className="cursor-pointer">
                <MeetingCard meeting={meeting} onDeleteSuccess={handleDeleteSuccess} />
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Recent Recordings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-800">최근 녹음</h2>
        </div>
        
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">제목</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">날짜</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">시간</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">태그</th>
                  <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      녹음을 불러오는 중...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-red-500">
                      녹음을 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.
                    </td>
                  </tr>
                ) : recentRecordings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      녹음을 찾을 수 없습니다.
                    </td>
                  </tr>
                ) : (
                  recentRecordings.map(recording => (
                    <RecordingRow 
                      key={recording.id} 
                      recording={recording} 
                      onDeleteSuccess={() => {}}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Meeting Detail Modal */}
      <MeetingDetailModal
        meeting={selectedMeeting}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}