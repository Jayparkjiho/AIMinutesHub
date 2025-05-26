import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Meeting } from "@/lib/types";

export default function EmailCompose() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fromEmail: '',
    fromPassword: '',
    toEmails: '',
    ccEmails: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    // Get meeting data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const meetingData = urlParams.get('meetingData');
    if (meetingData) {
      try {
        const parsedMeeting = JSON.parse(decodeURIComponent(meetingData));
        setMeeting(parsedMeeting);
        
        // Auto-generate email content based on meeting data
        generateEmailContent(parsedMeeting);
      } catch (error) {
        console.error('Error parsing meeting data:', error);
      }
    }
  }, []);

  const generateEmailContent = (meetingData: Meeting) => {
    const subject = `[회의록] ${meetingData.title}`;
    
    let body = `안녕하세요,

다음 회의의 결과를 공유드립니다.

📅 회의 정보
• 제목: ${meetingData.title}
• 일시: ${new Date(meetingData.date).toLocaleDateString('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})}
• 소요시간: ${Math.floor(meetingData.duration / 60)}분 ${meetingData.duration % 60}초

`;

    // Add summary if available
    if (meetingData.summary) {
      body += `📝 회의 요약
${meetingData.summary}

`;
    }

    // Add action items if available
    if (meetingData.actionItems && meetingData.actionItems.length > 0) {
      body += `✅ 액션 아이템
`;
      meetingData.actionItems.forEach((item, index) => {
        body += `${index + 1}. ${item.text}`;
        if (item.assignee) body += ` (담당자: ${item.assignee})`;
        if (item.dueDate) body += ` (마감일: ${item.dueDate})`;
        body += '\n';
      });
      body += '\n';
    }

    // Add participants if available
    if (meetingData.participants && meetingData.participants.length > 0) {
      body += `👥 참석자
${meetingData.participants.map(p => `• ${p.name}${p.isHost ? ' (진행자)' : ''}`).join('\n')}

`;
    }

    body += `감사합니다.

---
Smart Minutes Maker로 생성된 회의록입니다.`;

    setFormData(prev => ({
      ...prev,
      subject,
      body
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendEmail = async () => {
    // Validation
    if (!formData.fromEmail || !formData.fromPassword || !formData.toEmails || !formData.subject || !formData.body) {
      toast({
        title: "입력 오류",
        description: "모든 필수 항목을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            email: formData.fromEmail,
            password: formData.fromPassword
          },
          emailOptions: {
            to: formData.toEmails.split(',').map(email => email.trim()),
            cc: formData.ccEmails ? formData.ccEmails.split(',').map(email => email.trim()) : undefined,
            subject: formData.subject,
            html: formData.body.replace(/\n/g, '<br>')
          }
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "이메일 전송 완료",
          description: "회의록이 성공적으로 전송되었습니다.",
        });
        
        // Clear sensitive data
        setFormData(prev => ({
          ...prev,
          fromPassword: ''
        }));
        
        // Navigate back after delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        throw new Error(result.error || '이메일 전송에 실패했습니다.');
      }
    } catch (error: any) {
      toast({
        title: "전송 실패",
        description: error.message || "이메일 전송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigate('/dashboard')}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="ri-arrow-left-line text-xl"></i>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">이메일 작성</h1>
            </div>
            <div className="text-sm text-gray-500">
              {meeting ? `회의: ${meeting.title}` : '새 이메일'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 space-y-6">
            {/* Gmail SMTP 설정 */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Gmail SMTP 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gmail 주소 *
                  </label>
                  <Input
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={formData.fromEmail}
                    onChange={(e) => handleInputChange('fromEmail', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    앱 비밀번호 *
                    <span className="text-xs text-gray-500 ml-1">(Gmail 2단계 인증 필요)</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="앱 비밀번호 입력"
                    value={formData.fromPassword}
                    onChange={(e) => handleInputChange('fromPassword', e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Gmail 2단계 인증을 활성화하고 앱 비밀번호를 생성해주세요.
              </p>
            </div>

            {/* 이메일 설정 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">이메일 설정</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  받는 사람 * <span className="text-xs text-gray-500">(쉼표로 구분)</span>
                </label>
                <Input
                  type="email"
                  placeholder="recipient1@example.com, recipient2@example.com"
                  value={formData.toEmails}
                  onChange={(e) => handleInputChange('toEmails', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  참조 (CC) <span className="text-xs text-gray-500">(선택사항, 쉼표로 구분)</span>
                </label>
                <Input
                  type="email"
                  placeholder="cc1@example.com, cc2@example.com"
                  value={formData.ccEmails}
                  onChange={(e) => handleInputChange('ccEmails', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 *
                </label>
                <Input
                  type="text"
                  placeholder="이메일 제목"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용 *
                </label>
                <Textarea
                  placeholder="이메일 내용을 입력하세요..."
                  value={formData.body}
                  onChange={(e) => handleInputChange('body', e.target.value)}
                  className="w-full min-h-[300px] font-mono text-sm"
                />
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={isSending}
              >
                취소
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={isSending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSending ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    전송 중...
                  </>
                ) : (
                  <>
                    <i className="ri-mail-send-line mr-2"></i>
                    이메일 전송
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}