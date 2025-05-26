import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EmailService, EmailTemplate } from "@/lib/email-service";
import { useIndexedDBTemplates, useIndexedDBPreferences } from "@/hooks/use-indexeddb";
import { Meeting } from "@/lib/types";

export default function GmailSender() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // 메일 내용
  const [emailForm, setEmailForm] = useState({
    to: [''],
    cc: [''],
    bcc: [''],
    subject: '',
    text: '',
    html: ''
  });
  
  // UI 상태
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 회의 데이터 및 템플릿
  const [meetingData, setMeetingData] = useState<Meeting | null>(null);
  const { templates } = useIndexedDBTemplates();
  const { getPreference, savePreference } = useIndexedDBPreferences();
  
  // URL에서 회의 데이터 추출 및 기본 이메일 내용 생성
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const meetingDataParam = urlParams.get('meetingData');
    
    if (meetingDataParam) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(meetingDataParam));
        setMeetingData(decodedData);
        
        // 기본 이메일 제목 설정
        setEmailForm(prev => ({
          ...prev,
          subject: `[회의록] ${decodedData.title}`,
          text: generateDefaultEmailContent(decodedData)
        }));
      } catch (error) {
        console.error('회의 데이터 파싱 오류:', error);
      }
    }
  }, [location]);

  // 기본 이메일 내용 생성
  const generateDefaultEmailContent = (meeting: Meeting) => {
    const date = new Date(meeting.date).toLocaleDateString('ko-KR');
    const duration = Math.floor(meeting.duration / 60);
    
    let content = `안녕하세요,

${meeting.title} 회의록을 공유드립니다.

📅 회의 일시: ${date}
⏰ 소요 시간: ${duration}분
🏷️ 태그: ${meeting.tags?.join(', ') || '없음'}

`;

    // 참석자 정보
    if (meeting.participants && meeting.participants.length > 0) {
      content += `👥 참석자:
${meeting.participants.map(p => `- ${p.name}${p.isHost ? ' (진행자)' : ''}`).join('\n')}

`;
    }

    // 요약
    if (meeting.summary) {
      content += `📝 회의 요약:
${meeting.summary}

`;
    }

    // 액션 아이템
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      content += `✅ 액션 아이템:
${meeting.actionItems.map((item, index) => 
        `${index + 1}. ${item.text}${item.assignee ? ` (담당: ${item.assignee})` : ''}${item.dueDate ? ` (마감: ${item.dueDate})` : ''}`
      ).join('\n')}

`;
    }

    // 노트
    if (meeting.notes) {
      content += `📋 추가 노트:
${meeting.notes}

`;
    }

    content += `감사합니다.`;
    
    return content;
  };
  
  // 기본 Gmail 설정
  const gmailConfig = {
    email: 'your.email@gmail.com', // 기본 이메일 주소
    password: 'your_app_password' // 기본 앱 비밀번호
  };
  
  // Gmail SMTP 연결 테스트
  const testGmailConnection = async () => {
    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gmailConfig }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsConnected(true);
        toast({
          title: "연결 성공",
          description: "Gmail SMTP 연결이 성공했습니다!",
        });
      } else {
        setIsConnected(false);
        toast({
          title: "연결 실패",
          description: result.error || "Gmail 연결에 실패했습니다.",
          variant: "destructive"
        });
      }
    } catch (error) {
      setIsConnected(false);
      toast({
        title: "연결 오류",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  // 템플릿 적용
  const applyTemplate = (template: EmailTemplate) => {
    if (!meetingData) {
      toast({
        title: "회의 데이터 없음",
        description: "템플릿을 적용할 회의 데이터가 없습니다.",
        variant: "destructive"
      });
      return;
    }
    
    const processedSubject = EmailService.replaceTemplateVariables(template.subject, meetingData);
    const processedBody = EmailService.replaceTemplateVariables(template.body, meetingData);
    
    setEmailForm(prev => ({
      ...prev,
      subject: processedSubject,
      text: processedBody,
      html: processedBody.replace(/\n/g, '<br>')
    }));
    
    setSelectedTemplate(template);
    
    toast({
      title: "템플릿 적용",
      description: `${template.name} 템플릿이 적용되었습니다.`,
    });
  };
  
  // 받는 사람 추가/제거
  const addRecipient = (field: 'to' | 'cc' | 'bcc') => {
    setEmailForm(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };
  
  const removeRecipient = (field: 'to' | 'cc' | 'bcc', index: number) => {
    setEmailForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };
  
  const updateRecipient = (field: 'to' | 'cc' | 'bcc', index: number, value: string) => {
    setEmailForm(prev => ({
      ...prev,
      [field]: prev[field].map((email, i) => i === index ? value : email)
    }));
  };
  
  // 메일 전송
  const sendEmail = async () => {
    if (!isConnected) {
      toast({
        title: "연결 필요",
        description: "먼저 Gmail SMTP 연결을 테스트해주세요.",
        variant: "destructive"
      });
      return;
    }
    
    const toEmails = emailForm.to.filter(email => email.trim() !== '');
    const ccEmails = emailForm.cc.filter(email => email.trim() !== '');
    const bccEmails = emailForm.bcc.filter(email => email.trim() !== '');
    
    if (toEmails.length === 0) {
      toast({
        title: "받는 사람 필요",
        description: "최소 한 명의 받는 사람을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }
    
    if (!emailForm.subject.trim()) {
      toast({
        title: "제목 필요",
        description: "메일 제목을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }
    
    if (!emailForm.text.trim() && !emailForm.html.trim()) {
      toast({
        title: "내용 필요",
        description: "메일 내용을 입력해주세요.",
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
          to: toEmails,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          bcc: bccEmails.length > 0 ? bccEmails : undefined,
          subject: emailForm.subject,
          text: emailForm.text,
          html: emailForm.html || emailForm.text.replace(/\n/g, '<br>'),
          gmailConfig
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "전송 성공",
          description: "메일이 성공적으로 전송되었습니다!",
        });
        
        // 폼 초기화
        setEmailForm({
          to: [''],
          cc: [''],
          bcc: [''],
          subject: '',
          text: '',
          html: ''
        });
      } else {
        toast({
          title: "전송 실패",
          description: result.error || "메일 전송에 실패했습니다.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "전송 오류",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">Gmail SMTP 메일 전송</h1>
            <p className="text-neutral-500 mt-1">
              Gmail 계정을 통해 회의록을 안전하게 전송하세요
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            <i className="ri-arrow-left-line mr-2"></i>
            뒤로가기
          </Button>
        </div>
      </div>

      {/* 회의 데이터 표시 */}
      {meetingData && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <i className="ri-file-text-line mr-2 text-blue-600"></i>
              회의 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-neutral-700">제목</span>
                <p className="text-neutral-900">{meetingData.title}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-neutral-700">일시</span>
                <p className="text-neutral-900">
                  {new Date(meetingData.date).toLocaleDateString('ko-KR')}
                </p>
              </div>
              {meetingData.participants && meetingData.participants.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-neutral-700">참석자</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {meetingData.participants.map((participant, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {participant.name}
                        {participant.isHost ? ' (진행자)' : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {meetingData.actionItems && meetingData.actionItems.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-neutral-700">액션 아이템</span>
                  <p className="text-neutral-900">{meetingData.actionItems.length}개</p>
                </div>
              )}
            </div>
            
            {/* AI 요약 내용 표시 */}
            {meetingData.summary && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                  <i className="ri-brain-line mr-2"></i>
                  AI 요약
                </h4>
                <p className="text-blue-800 text-sm leading-relaxed">
                  {meetingData.summary}
                </p>
              </div>
            )}
            
            {/* 액션 아이템 상세 표시 */}
            {meetingData.actionItems && meetingData.actionItems.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center">
                  <i className="ri-task-line mr-2"></i>
                  액션 아이템 ({meetingData.actionItems.length}개)
                </h4>
                <div className="space-y-2">
                  {meetingData.actionItems.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-green-700 font-medium text-sm">•</span>
                      <div className="flex-1">
                        <p className="text-green-800 text-sm">{item.text}</p>
                        {item.assignee && (
                          <p className="text-green-600 text-xs mt-1">담당: {item.assignee}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {meetingData.actionItems.length > 3 && (
                    <p className="text-green-600 text-xs">+ {meetingData.actionItems.length - 3}개 더...</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gmail 설정 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <i className="ri-mail-settings-line mr-2"></i>
                Gmail 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testGmailConnection}
                disabled={isConnecting}
                className="w-full"
                variant={isConnected ? "default" : "outline"}
              >
                {isConnecting ? (
                  <>
                    <i className="ri-loader-4-line mr-2 animate-spin"></i>
                    연결 테스트 중...
                  </>
                ) : isConnected ? (
                  <>
                    <i className="ri-check-line mr-2"></i>
                    연결됨
                  </>
                ) : (
                  <>
                    <i className="ri-wifi-line mr-2"></i>
                    연결 테스트
                  </>
                )}
              </Button>
              
              {isConnected && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    ✅ Gmail SMTP 연결이 성공했습니다!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* 템플릿 선택 */}
          {meetingData && templates && templates.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="ri-file-text-line mr-2"></i>
                  이메일 템플릿
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {templates.slice(0, 5).map((template) => (
                    <Button
                      key={template.id}
                      variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => applyTemplate(template)}
                    >
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {template.type === 'summary' && '요약형'}
                          {template.type === 'action_items' && '액션 아이템'}
                          {template.type === 'full_report' && '상세형'}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 메일 작성 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <i className="ri-mail-send-line mr-2"></i>
                메일 작성
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 템플릿 선택 */}
              {templates && templates.length > 0 && meetingData && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    이메일 템플릿 선택
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Button
                      variant={!selectedTemplate ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(null);
                        setEmailForm(prev => ({
                          ...prev,
                          subject: `[회의록] ${meetingData.title}`,
                          text: generateDefaultEmailContent(meetingData)
                        }));
                      }}
                    >
                      기본 형식
                    </Button>
                    {templates.slice(0, 5).map((template) => (
                      <Button
                        key={template.id}
                        variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => applyTemplate(template)}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                  
                  {/* 템플릿 관리 링크 */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/templates')}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <i className="ri-settings-3-line mr-2"></i>
                      템플릿 관리
                    </Button>
                    <span className="text-xs text-gray-500">
                      {templates.length}개 템플릿 사용 가능
                    </span>
                  </div>
                  {selectedTemplate && (
                    <p className="text-xs text-blue-600 mt-1">
                      ✓ {selectedTemplate.name} 템플릿이 적용됨
                    </p>
                  )}
                </div>
              )}

              {/* 받는 사람 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  받는 사람 *
                </label>
                {emailForm.to.map((email, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={email}
                      onChange={(e) => updateRecipient('to', index, e.target.value)}
                    />
                    {emailForm.to.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeRecipient('to', index)}
                      >
                        <i className="ri-delete-bin-line"></i>
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addRecipient('to')}
                  className="text-neutral-600"
                >
                  <i className="ri-add-line mr-2"></i>
                  받는 사람 추가
                </Button>
              </div>

              {/* 고급 옵션 */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-neutral-600"
                >
                  <i className={`ri-arrow-${showAdvanced ? 'up' : 'down'}-s-line mr-2`}></i>
                  고급 옵션
                </Button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    {/* 참조 */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        참조 (CC)
                      </label>
                      {emailForm.cc.map((email, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            type="email"
                            placeholder="cc@example.com"
                            value={email}
                            onChange={(e) => updateRecipient('cc', index, e.target.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeRecipient('cc', index)}
                          >
                            <i className="ri-delete-bin-line"></i>
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addRecipient('cc')}
                        className="text-neutral-600"
                      >
                        <i className="ri-add-line mr-2"></i>
                        참조 추가
                      </Button>
                    </div>

                    {/* 숨은 참조 */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        숨은 참조 (BCC)
                      </label>
                      {emailForm.bcc.map((email, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            type="email"
                            placeholder="bcc@example.com"
                            value={email}
                            onChange={(e) => updateRecipient('bcc', index, e.target.value)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeRecipient('bcc', index)}
                          >
                            <i className="ri-delete-bin-line"></i>
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addRecipient('bcc')}
                        className="text-neutral-600"
                      >
                        <i className="ri-add-line mr-2"></i>
                        숨은 참조 추가
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  제목 *
                </label>
                <Input
                  placeholder="메일 제목을 입력하세요"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({
                    ...prev,
                    subject: e.target.value
                  }))}
                />
              </div>

              {/* 내용 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    내용 *
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (meetingData) {
                          setEmailForm(prev => ({
                            ...prev,
                            text: generateDefaultEmailContent(meetingData)
                          }));
                          toast({
                            title: "내용 복원됨",
                            description: "기본 회의록 내용으로 복원했습니다."
                          });
                        }
                      }}
                    >
                      <i className="ri-refresh-line mr-1"></i>
                      기본 내용으로 복원
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="메일 내용을 입력하세요"
                  value={emailForm.text}
                  onChange={(e) => setEmailForm(prev => ({
                    ...prev,
                    text: e.target.value
                  }))}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>이모지와 포맷이 자동으로 적용됩니다</span>
                  <span>{emailForm.text.length} 글자</span>
                </div>
              </div>

              {/* 전송 버튼 */}
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={sendEmail}
                  disabled={isSending || !isConnected}
                  className="flex-1"
                >
                  {isSending ? (
                    <>
                      <i className="ri-loader-4-line mr-2 animate-spin"></i>
                      전송 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line mr-2"></i>
                      메일 전송
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailForm({
                      to: [''],
                      cc: [''],
                      bcc: [''],
                      subject: '',
                      text: '',
                      html: ''
                    });
                    setSelectedTemplate(null);
                  }}
                >
                  <i className="ri-refresh-line mr-2"></i>
                  초기화
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}