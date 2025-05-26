import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Meeting } from "@/lib/types";
import { EmailService, EmailTemplate } from "@/lib/email-service";
import { useIndexedDBTemplates, useIndexedDBPreferences } from "@/hooks/use-indexeddb";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function EmailSender() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // URL에서 회의 데이터 추출
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const meetingDataParam = urlParams.get('meetingData');
  const passedMeeting = meetingDataParam ? JSON.parse(decodeURIComponent(meetingDataParam)) : null;
  
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [newCcRecipient, setNewCcRecipient] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { templates, isLoading: templatesLoading } = useIndexedDBTemplates();
  const { preferences, savePreference } = useIndexedDBPreferences();

  // Use passed meeting data or fetch from API
  const { data: apiMeeting, isLoading: meetingLoading } = useQuery<Meeting>({
    queryKey: [`/api/meetings/${id}`],
    enabled: !passedMeeting && !!id, // Only fetch if no passed data and ID exists
  });
  
  const meeting = passedMeeting || apiMeeting;

  // Load default templates if none exist
  useEffect(() => {
    if (!templatesLoading && templates.length === 0) {
      const defaultTemplates = EmailService.getDefaultTemplates();
      // Save default templates to IndexedDB
      defaultTemplates.forEach(template => {
        // This would be handled by the save template mutation
      });
    }
  }, [templates, templatesLoading]);

  // Set default recipients from preferences
  useEffect(() => {
    if (preferences.defaultEmailRecipients?.length > 0) {
      setRecipients(preferences.defaultEmailRecipients);
    }
  }, [preferences]);

  // Set default template
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemplate = templates.find(t => t.type === preferences.preferredTemplate) || templates[0];
      setSelectedTemplate(defaultTemplate);
    }
  }, [templates, preferences, selectedTemplate]);

  if (meetingLoading || !meeting) {
    return (
      <div className="px-4 py-6 md:px-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Generate email content based on template
  const generateEmailContent = () => {
    if (!selectedTemplate) return { subject: "", body: "" };
    
    const subject = EmailService.replaceTemplateVariables(selectedTemplate.subject, meeting);
    const body = EmailService.replaceTemplateVariables(selectedTemplate.body, meeting);
    
    return { subject, body };
  };

  const { subject: generatedSubject, body: generatedBody } = generateEmailContent();

  // Handle adding recipients
  const addRecipient = () => {
    if (newRecipient.trim() && !recipients.includes(newRecipient.trim())) {
      setRecipients([...recipients, newRecipient.trim()]);
      setNewRecipient("");
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const addCcRecipient = () => {
    if (newCcRecipient.trim() && !ccRecipients.includes(newCcRecipient.trim())) {
      setCcRecipients([...ccRecipients, newCcRecipient.trim()]);
      setNewCcRecipient("");
    }
  };

  const removeCcRecipient = (email: string) => {
    setCcRecipients(ccRecipients.filter(r => r !== email));
  };

  // Handle template selection
  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setCustomSubject("");
    setCustomBody("");
  };

  // Handle sending email
  const handleSendEmail = async () => {
    if (recipients.length === 0) {
      toast({
        title: "수신자가 없습니다",
        description: "최소 한 명의 수신자를 추가해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);

    try {
      const emailData = {
        to: recipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: customSubject || generatedSubject,
        body: customBody || generatedBody,
        attachments: meeting.transcript ? [{
          filename: `${meeting.title}_transcript.txt`,
          content: meeting.transcript,
          type: 'text/plain'
        }] : undefined
      };

      await EmailService.sendEmail(emailData);

      // Save recipients as default
      await savePreference('defaultEmailRecipients', recipients);

      toast({
        title: "이메일 발송 완료",
        description: "회의록이 성공적으로 발송되었습니다."
      });

      navigate(`/meeting/${id}`);
    } catch (error: any) {
      toast({
        title: "이메일 발송 실패",
        description: error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const finalSubject = customSubject || generatedSubject;
  const finalBody = customBody || generatedBody;

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex items-center mb-6">
        <button 
          className="mr-2 text-neutral-500 hover:text-neutral-700"
          onClick={() => navigate(`/meeting/${id}`)}
          aria-label="뒤로 가기"
        >
          <i className="ri-arrow-left-line"></i>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">이메일 발송</h1>
          <p className="text-neutral-500 mt-1">{meeting.title} 회의록을 이메일로 공유</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <i className="ri-mail-line mr-2"></i>
                수신자 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">받는 사람 (TO)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {recipients.map(email => (
                    <Badge key={email} variant="secondary" className="bg-primary/10 text-primary">
                      {email}
                      <button 
                        className="ml-1 text-primary/70 hover:text-primary"
                        onClick={() => removeRecipient(email)}
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex">
                  <Input
                    type="email"
                    value={newRecipient}
                    onChange={e => setNewRecipient(e.target.value)}
                    placeholder="이메일 주소 입력"
                    className="rounded-r-none"
                    onKeyPress={e => e.key === 'Enter' && addRecipient()}
                  />
                  <Button onClick={addRecipient} className="rounded-l-none">추가</Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">참조 (CC)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ccRecipients.map(email => (
                    <Badge key={email} variant="outline">
                      {email}
                      <button 
                        className="ml-1 text-neutral-500 hover:text-neutral-700"
                        onClick={() => removeCcRecipient(email)}
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex">
                  <Input
                    type="email"
                    value={newCcRecipient}
                    onChange={e => setNewCcRecipient(e.target.value)}
                    placeholder="참조 이메일 주소 입력"
                    className="rounded-r-none"
                    onKeyPress={e => e.key === 'Enter' && addCcRecipient()}
                  />
                  <Button variant="outline" onClick={addCcRecipient} className="rounded-l-none">추가</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <i className="ri-file-text-line mr-2"></i>
                이메일 템플릿
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {EmailService.getDefaultTemplates().map(template => (
                  <div
                    key={template.name}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate?.name === template.name 
                        ? 'border-primary bg-primary/5' 
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <h4 className="font-medium text-neutral-800">{template.name}</h4>
                    <p className="text-sm text-neutral-500 mt-1">
                      {template.type === 'summary' && '회의 요약과 주요 내용'}
                      {template.type === 'action_items' && '액션 아이템 중심'}
                      {template.type === 'full_report' && '전체 회의록 포함'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <i className="ri-edit-line mr-2"></i>
                  이메일 내용
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? '편집' : '미리보기'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">제목</label>
                    <div className="p-3 bg-neutral-50 rounded border">{finalSubject}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">내용</label>
                    <div className="p-3 bg-neutral-50 rounded border whitespace-pre-wrap">{finalBody}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">제목</label>
                    <Input
                      value={customSubject}
                      onChange={e => setCustomSubject(e.target.value)}
                      placeholder={generatedSubject}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">내용</label>
                    <Textarea
                      value={customBody}
                      onChange={e => setCustomBody(e.target.value)}
                      placeholder={generatedBody}
                      rows={12}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Meeting Info & Actions */}
        <div className="space-y-6">
          {/* Meeting Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <i className="ri-information-line mr-2"></i>
                회의 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm text-neutral-500">제목</span>
                <p className="font-medium">{meeting.title}</p>
              </div>
              <div>
                <span className="text-sm text-neutral-500">날짜</span>
                <p>{new Date(meeting.date).toLocaleDateString('ko-KR')}</p>
              </div>
              <div>
                <span className="text-sm text-neutral-500">참석자</span>
                <p>{meeting.participants?.length || 0}명</p>
              </div>
              <div>
                <span className="text-sm text-neutral-500">액션 아이템</span>
                <p>{meeting.actionItems?.length || 0}개</p>
              </div>
              {meeting.tags && meeting.tags.length > 0 && (
                <div>
                  <span className="text-sm text-neutral-500">태그</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {meeting.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Button
                  onClick={handleSendEmail}
                  disabled={isSending || recipients.length === 0}
                  className="w-full"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      발송 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line mr-2"></i>
                      이메일 발송
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => navigate(`/meeting/${id}`)}
                  className="w-full"
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Attachments Info */}
          {meeting.transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <i className="ri-attachment-line mr-2"></i>
                  첨부파일
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-neutral-600">
                  <i className="ri-file-text-line mr-2"></i>
                  {meeting.title}_transcript.txt
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}