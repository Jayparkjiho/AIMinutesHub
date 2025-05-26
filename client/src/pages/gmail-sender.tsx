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
  
  // Gmail 계정 설정
  const [gmailConfig, setGmailConfig] = useState({
    email: '',
    password: ''
  });
  
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
  
  // URL에서 회의 데이터 추출
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const meetingDataParam = urlParams.get('meetingData');
    
    if (meetingDataParam) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(meetingDataParam));
        setMeetingData(decodedData);
        setEmailForm(prev => ({
          ...prev,
          subject: `[회의록] ${decodedData.title}`
        }));
      } catch (error) {
        console.error('회의 데이터 파싱 오류:', error);
      }
    }
  }, [location]);
  
  // 저장된 Gmail 설정 불러오기
  useEffect(() => {
    const loadGmailConfig = async () => {
      const savedConfig = await getPreference('gmail_config');
      if (savedConfig) {
        setGmailConfig(savedConfig);
      }
    };
    loadGmailConfig();
  }, []);
  
  // Gmail SMTP 연결 테스트
  const testGmailConnection = async () => {
    if (!gmailConfig.email || !gmailConfig.password) {
      toast({
        title: "설정 필요",
        description: "Gmail 이메일과 앱 비밀번호를 입력해주세요.",
        variant: "destructive"
      });
      return;
    }
    
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
        await savePreference('gmail_config', gmailConfig);
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
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Gmail 주소
                </label>
                <Input
                  type="email"
                  placeholder="your.email@gmail.com"
                  value={gmailConfig.email}
                  onChange={(e) => setGmailConfig(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  앱 비밀번호
                </label>
                <Input
                  type="password"
                  placeholder="Gmail 앱 비밀번호"
                  value={gmailConfig.password}
                  onChange={(e) => setGmailConfig(prev => ({
                    ...prev,
                    password: e.target.value
                  }))}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Gmail 2단계 인증 후 앱 비밀번호를 사용하세요
                </p>
              </div>
              
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
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  내용 *
                </label>
                <Textarea
                  placeholder="메일 내용을 입력하세요"
                  value={emailForm.text}
                  onChange={(e) => setEmailForm(prev => ({
                    ...prev,
                    text: e.target.value
                  }))}
                  rows={12}
                />
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

      {/* 회의 정보 (있는 경우) */}
      {meetingData && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <i className="ri-information-line mr-2"></i>
              회의 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-500">제목</p>
                <p className="font-medium">{meetingData.title}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">날짜</p>
                <p className="font-medium">
                  {new Date(meetingData.date).toLocaleDateString('ko-KR')}
                </p>
              </div>
              {meetingData.tags && meetingData.tags.length > 0 && (
                <div>
                  <p className="text-sm text-neutral-500 mb-2">태그</p>
                  <div className="flex flex-wrap gap-2">
                    {meetingData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {meetingData.summary && (
                <div className="md:col-span-2">
                  <p className="text-sm text-neutral-500 mb-2">요약</p>
                  <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-md">
                    {meetingData.summary.substring(0, 200)}...
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}