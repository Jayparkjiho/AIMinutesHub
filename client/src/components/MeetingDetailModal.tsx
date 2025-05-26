import { Meeting } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/hooks/use-audio-recorder";
import { useLocation } from "wouter";
import { useIndexedDBMeetings } from "@/hooks/use-indexeddb";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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
    // 회의 데이터를 이메일 페이지로 전달
    const meetingData = encodeURIComponent(JSON.stringify(meeting));
    navigate(`/email-sender?meetingData=${meetingData}`);
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
        title: "회의 삭제 완료",
        description: `"${meeting.title}" 회의가 삭제되었습니다.`,
      });
      
      onClose();
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {meeting.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            회의 상세 정보를 확인할 수 있습니다.
          </DialogDescription>
          
          {/* Meeting Info */}
          <div className="grid grid-cols-3 gap-6 text-sm mt-4">
            <div className="flex items-center text-gray-600">
              <i className="ri-calendar-line mr-2"></i>
              <span className="font-medium">날짜:</span>
              <span className="ml-1">{new Date(meeting.date).toLocaleDateString('ko-KR')}</span>
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

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 pb-6">
            {/* Summary Section */}
            {meeting.summary && (
              <div>
                <h3 className="text-lg font-semibold mb-3">회의 요약</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {meeting.summary}
                  </p>
                </div>
              </div>
            )}

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
            {meeting.actionItems && meeting.actionItems.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">액션 아이템 논의사항</h3>
                <div className="space-y-3">
                  {meeting.actionItems.map((item, index) => (
                    <div key={item.id} className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r-lg">
                      <h4 className="font-medium text-blue-900 mb-2">
                        AI 추천 알고리즘 도입
                      </h4>
                      <p className="text-sm text-blue-800 mb-3">
                        {item.text}
                      </p>
                      
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-blue-900">결정사항:</span>
                          <ul className="list-disc list-inside ml-4 text-sm text-blue-800">
                            <li>초기에는 간단한 룰 기반으로 시작</li>
                            <li>추후 강화학습 접대로 발전</li>
                          </ul>
                        </div>
                        
                        <div className="flex items-center">
                          <span className="font-medium text-blue-900 mr-2">액션 아이템:</span>
                          <div className="flex items-center space-x-4">
                            <Badge variant="outline" className="bg-white">
                              {item.assignee || '박개발'} - 추천 시스템 초기 구현 작업
                            </Badge>
                            <span className="text-sm text-blue-700">
                              {item.dueDate || '이번 주'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 요약 Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">AI 요약</h3>
              <div className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r-lg">
                <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                  {meeting.summary || "AI 요약이 아직 생성되지 않았습니다. 회의록 페이지에서 'AI 분석 다시 실행' 버튼을 클릭하여 요약을 생성해보세요."}
                </p>
              </div>
            </div>

            {/* Next Meeting Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">다음 회의</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center text-sm">
                  <span className="font-medium text-gray-700 w-12">일시:</span>
                  <span className="text-gray-600">미정</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="font-medium text-gray-700 w-12">안건:</span>
                  <span className="text-gray-600">미정</span>
                </div>
              </div>
            </div>

            {/* Transcript Section */}
            {meeting.transcript && (
              <div>
                <h3 className="text-lg font-semibold mb-3">원본 내용</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {meeting.transcript}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-6 pt-4 border-t">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <i className="ri-delete-bin-line mr-2"></i>
            {isDeleting ? "삭제 중..." : "삭제"}
          </Button>
          
          <Button onClick={handleEmailSend}>
            <i className="ri-mail-send-line mr-2"></i>
            이메일 발송
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}