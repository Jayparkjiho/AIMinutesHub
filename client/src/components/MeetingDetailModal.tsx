import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meeting } from "@/lib/types";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";
import { useToast } from "@/hooks/use-toast";

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess?: () => void;
}

export function MeetingDetailModal({ meeting, isOpen, onClose, onDeleteSuccess }: MeetingDetailModalProps) {
  const [, navigate] = useLocation();
  const { deleteMeeting } = useIndexedDBMeetings();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!meeting) return null;

  const handleEmailSend = () => {
    // 회의 데이터를 새로운 이메일 작성 페이지로 전달
    const meetingData = encodeURIComponent(JSON.stringify(meeting));
    navigate(`/email-compose?meetingData=${meetingData}`);
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm(`정말로 "${meeting.title}" 회의를 삭제하시겠습니까?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      toast({
        title: "삭제 완료",
        description: "회의가 성공적으로 삭제되었습니다.",
      });
      onDeleteSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "회의 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-white">
          <DialogTitle className="text-xl font-bold">{meeting.title}</DialogTitle>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <div className="flex items-center text-gray-600">
              <i className="ri-calendar-line mr-2"></i>
              <span>{new Date(meeting.date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <i className="ri-time-line mr-2"></i>
              <span>{Math.floor(meeting.duration / 60)}분 {meeting.duration % 60}초</span>
            </div>
            <div className="flex items-center text-gray-600">
              <i className="ri-user-line mr-2"></i>
              <span className="font-medium">진행자:</span>
              <span className="ml-1">{meeting.participants?.find(p => p.isHost)?.name || '김PM'}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <i className="ri-group-line mr-2"></i>
              <span className="font-medium">참석자:</span>
              <span className="ml-1">{meeting.participants?.length || 0}명</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 space-y-6 py-6">
            {/* Summary Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">회의 요약</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {meeting.summary && meeting.summary.trim() ? (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {meeting.summary}
                  </p>
                ) : (
                  <p className="text-gray-500 italic">
                    AI 요약이 생성되지 않았습니다. 녹음 페이지에서 "AI 분석" 버튼을 클릭하여 요약을 생성하세요.
                  </p>
                )}
              </div>
            </div>

            {/* Participants Section */}
            {meeting.participants && meeting.participants.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">참석자</h3>
                <div className="flex flex-wrap gap-2">
                  {meeting.participants.map((participant, index) => (
                    <Badge 
                      key={index} 
                      variant={participant.isHost ? "default" : "outline"}
                      className="px-3 py-1"
                    >
                      {participant.name}
                      {participant.isHost && <span className="ml-1 text-xs">(진행자)</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">액션 아이템</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {meeting.actionItems && meeting.actionItems.length > 0 ? (
                  <div className="space-y-3">
                    {meeting.actionItems.map((item) => (
                      <div key={item.id} className="flex items-start space-x-3 bg-white border rounded-lg p-3">
                        <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                          item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`} />
                        <div className="flex-1">
                          <p className={`${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {item.text}
                          </p>
                          {item.assignee && (
                            <p className="text-sm text-gray-500 mt-1">담당자: {item.assignee}</p>
                          )}
                          {item.dueDate && (
                            <p className="text-sm text-gray-500 mt-1">마감일: {item.dueDate}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">
                    액션 아이템이 생성되지 않았습니다. 녹음 페이지에서 "AI 분석" 버튼을 클릭하여 액션 아이템을 생성하세요.
                  </p>
                )}
              </div>
            </div>

            {/* Transcript Section */}
            {meeting.transcript && (
              <div>
                <h3 className="text-lg font-semibold mb-3">회의 전문</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                    {meeting.transcript}
                  </p>
                </div>
              </div>
            )}

            {/* Tags Section */}
            {meeting.tags && meeting.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">태그</h3>
                <div className="flex flex-wrap gap-2">
                  {meeting.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {meeting.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-3">노트</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {meeting.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-white flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button variant="outline" onClick={handleEmailSend}>
            <i className="ri-mail-line mr-2"></i>
            이메일 작성
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            <i className="ri-delete-bin-line mr-2"></i>
            삭제
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}