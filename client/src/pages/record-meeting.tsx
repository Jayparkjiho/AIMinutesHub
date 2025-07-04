import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAudioRecorder, formatTime } from "@/hooks/use-audio-recorder";
import { indexedDBStorage } from "@/lib/indexeddb";
import { queryClient } from "@/lib/queryClient";
import { EmailService, EmailTemplate } from "@/lib/email-service";
import { useLocation } from "wouter";

const Waveform = ({ isAnimating }: { isAnimating: boolean }) => (
  <div className="flex items-center justify-center space-x-1 h-12">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className={`bg-blue-500 rounded-full transition-all duration-200 ${
          isAnimating ? 'animate-pulse' : ''
        }`}
        style={{
          width: '3px',
          height: isAnimating ? `${Math.random() * 40 + 10}px` : '4px',
        }}
      />
    ))}
  </div>
);

export default function RecordMeeting() {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState("record");
  const [manualText, setManualText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const [pendingSource, setPendingSource] = useState<'record' | 'upload' | 'text' | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    audioBlob,
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();

  // 컴포넌트 마운트 시 이메일 템플릿 로드
  useEffect(() => {
    const loadTemplates = async () => {
      await indexedDBStorage.init();
      const templates = await indexedDBStorage.getEmailTemplates();
      if (templates.length === 0) {
        // 기본 템플릿이 없으면 생성
        const defaultTemplates = EmailService.getDefaultTemplates();
        for (const template of defaultTemplates) {
          await indexedDBStorage.saveEmailTemplate(template);
        }
        setEmailTemplates(defaultTemplates);
      } else {
        setEmailTemplates(templates);
      }
    };
    loadTemplates();
  }, []);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  // 템플릿 선택 팝업 표시
  const showTemplateSelection = () => {
    console.log('Showing template selection...');
    console.log('Available templates:', emailTemplates.length);
    setShowTemplateModal(true);
  };

  // 통합된 AI 처리 함수 - 선택된 템플릿과 함께 처리
  const processWithAI = async (transcript: string, source: 'record' | 'upload' | 'text', template: EmailTemplate) => {
    try {
      setIsProcessing(true);
      setProcessingProgress(10);

      // 1. IndexedDB에 기본 회의 정보 저장
      await indexedDBStorage.init();
      const meetingData = {
        title: title || "Untitled Meeting",
        date: new Date().toISOString(),
        duration: source === 'record' ? recordingTime : 0,
        tags: tags,
        userId: 1,
        notes: notes || "",
        transcript: transcript
      };

      const savedMeeting = await indexedDBStorage.saveMeeting(meetingData);
      console.log('회의 생성됨:', savedMeeting);

      setProcessingProgress(30);

      // 2. OpenAI로 제목 생성 (템플릿 정보 포함)
      const titleResponse = await fetch('/api/meetings/generate-title-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript,
          templateType: template.type,
          templateName: template.name
        })
      });
      
      let generatedTitle = title || "Untitled Meeting";
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        generatedTitle = titleData.title;
      }

      setProcessingProgress(50);

      // 3. OpenAI로 요약 생성 (템플릿 맞춤형)
      const summaryResponse = await fetch('/api/meetings/generate-summary-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript
        })
      });
      
      let summary = "";
      if (summaryResponse.ok) {
        const summaryResult = await summaryResponse.json();
        summary = summaryResult.summary || "";
      }

      setProcessingProgress(70);

      // 4. OpenAI로 액션 아이템 생성 (템플릿 맞춤형)
      const actionsResponse = await fetch('/api/meetings/generate-actions-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript,
          focusOnActions: template.type === 'action_items'
        })
      });
      
      let actionItems: any[] = [];
      if (actionsResponse.ok) {
        const actionsData = await actionsResponse.json();
        actionItems = actionsData.actionItems || [];
      }

      setProcessingProgress(85);

      // 5. OpenAI로 화자 분리
      const separateResponse = await fetch('/api/meetings/separate-speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      
      let separatedTranscript = transcript;
      if (separateResponse.ok) {
        const separateData = await separateResponse.json();
        separatedTranscript = separateData.separatedTranscript || transcript;
      }

      setProcessingProgress(95);

      // 6. 모든 AI 분석 결과를 IndexedDB에 업데이트
      const finalActionItems = actionItems.map((aiItem: any) => ({
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: aiItem.text,
        completed: false,
        assignee: aiItem.assignee || undefined,
        dueDate: aiItem.dueDate || undefined,
      }));

      const updatedMeetingData = {
        title: generatedTitle,
        summary: summary,
        actionItems: finalActionItems,
        transcript: separatedTranscript
      };

      console.log('AI 분석 결과를 IndexedDB에 저장:', updatedMeetingData);
      await indexedDBStorage.updateMeeting(savedMeeting.id, updatedMeetingData);

      setProcessingProgress(100);

      toast({
        title: "회의 분석 완료!",
        description: `AI가 선택한 템플릿에 맞춰 회의를 분석하여 요약과 ${finalActionItems.length}개의 액션 아이템을 생성했습니다.`
      });

      // 선택된 템플릿과 회의 데이터로 이메일 작성 페이지로 이동
      const templateWithData = {
        ...template,
        subject: EmailService.replaceTemplateVariables(template.subject, {
          ...savedMeeting,
          title: generatedTitle,
          summary: summary,
          actionItems: finalActionItems,
          transcript: separatedTranscript
        }),
        body: EmailService.replaceTemplateVariables(template.body, {
          ...savedMeeting,
          title: generatedTitle,
          summary: summary,
          actionItems: finalActionItems,
          transcript: separatedTranscript
        })
      };

      // 이메일 작성 페이지로 이동
      setLocation(`/email-compose?meetingId=${savedMeeting.id}&templateId=${template.id}`);

      // 폼 초기화
      if (source === 'record') {
        resetRecording();
      } else if (source === 'text') {
        setManualText("");
      } else if (source === 'upload') {
        setUploadedFile(null);
      }
      
      setTitle("");
      setTags([]);
      setNotes("");

      // 회의 목록 새로고침
      await queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });

    } catch (error: any) {
      console.error(`${source} 처리 오류:`, error);
      toast({
        title: "처리 오류",
        description: error.message || "처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // 녹음 처리
  const handleSaveRecording = async () => {
    if (!audioBlob) {
      toast({
        title: "녹음을 찾을 수 없습니다",
        description: "먼저 음성을 녹음해주세요",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(20);

      // Whisper API로 음성을 텍스트로 변환
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      const transcribeResponse = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData
      });

      if (!transcribeResponse.ok) {
        throw new Error('음성 인식에 실패했습니다');
      }

      const transcribeResult = await transcribeResponse.json();
      setProcessingProgress(40);

      // 변환된 텍스트를 상태에 저장하고 수동 입력 탭으로 전환
      setManualText(transcribeResult.text);
      setActiveTab("text");
      
      toast({
        title: "음성 변환 완료",
        description: "텍스트로 변환이 완료되었습니다. 내용을 확인하고 분석을 진행해주세요.",
      });

      setIsProcessing(false);
      setProcessingProgress(0);

    } catch (error: any) {
      console.error("녹음 처리 오류:", error);
      toast({
        title: "녹음 처리 오류",
        description: error.message || "녹음 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // 파일 업로드 처리
  const handleUploadProcess = async () => {
    if (!uploadedFile) {
      toast({
        title: "파일이 선택되지 않았습니다",
        description: "먼저 오디오 파일을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(20);

      // 오디오 파일을 텍스트로 변환
      const formData = new FormData();
      formData.append("audio", uploadedFile);

      const transcribeResponse = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData
      });

      if (!transcribeResponse.ok) {
        throw new Error('음성 인식에 실패했습니다');
      }

      const transcribeResult = await transcribeResponse.json();
      setProcessingProgress(40);

      // 변환된 텍스트를 상태에 저장하고 수동 입력 탭으로 전환
      setManualText(transcribeResult.text);
      setActiveTab("text");
      
      toast({
        title: "음성 변환 완료",
        description: "텍스트로 변환이 완료되었습니다. 내용을 확인하고 분석을 진행해주세요.",
      });

      setIsProcessing(false);
      setProcessingProgress(0);
      setUploadedFile(null); // 파일 상태 초기화

    } catch (error: any) {
      console.error("파일 처리 오류:", error);
      toast({
        title: "파일 처리 오류",
        description: error.message || "파일 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // 텍스트 분석 처리
  const handleTextAnalysis = async (template: EmailTemplate) => {
    if (!manualText.trim()) {
      toast({
        title: "텍스트가 입력되지 않았습니다",
        description: "회의 내용을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(20);

      // 텍스트와 템플릿 정보를 API로 전송
      const response = await fetch('/api/analyze-text-with-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: manualText,
          templateType: template.type,
          templateName: template.name,
          templateBody: template.body
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '텍스트 분석에 실패했습니다');
      }

      const analysisResult = await response.json();
      setProcessingProgress(80);

      // IndexedDB에 완성된 분석 결과 저장
      await indexedDBStorage.init();
      const meetingData = {
        title: analysisResult.title || "Untitled Meeting",
        date: new Date().toISOString(),
        duration: 0,
        tags: tags,
        userId: 1,
        notes: notes || "",
        transcript: analysisResult.separatedTranscript || analysisResult.transcript,
        summary: analysisResult.summary,
        emailTemplate: template.name,
        actionItems: analysisResult.actionItems || []
      };

      const savedMeeting = await indexedDBStorage.saveMeeting(meetingData);
      console.log('AI 분석 결과를 IndexedDB에 저장:', savedMeeting);

      setProcessingProgress(100);
      
      toast({
        title: "회의 분석 완료!",
        description: `템플릿 "${template.name}"에 맞춰 회의가 성공적으로 분석되었습니다.`,
      });

      // Gmail Sender 페이지로 이동
      const meetingDataParam = encodeURIComponent(JSON.stringify(savedMeeting));
      setLocation(`/gmail-sender?meetingData=${meetingDataParam}`);

    } catch (error: any) {
      console.error("텍스트 분석 오류:", error);
      toast({
        title: "텍스트 분석 오류",
        description: error.message || "텍스트 분석 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    resetRecording();
    setLocation("/");
  };

  const downloadTranscript = () => {
    const content = manualText;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'meeting'}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 이메일 템플릿 선택 처리
  const handleTemplateSelect = async (template: EmailTemplate) => {
    console.log('Template selected:', template.name);
    setShowTemplateModal(false);
    
    // 업로드된 파일이 있다면 처리
    if (uploadedFile && activeTab === "upload") {
      await handleUploadProcess();
    }
    // 텍스트 입력이 있다면 처리
    else if (manualText.trim() && activeTab === "text") {
      await handleTextAnalysis(template);
    }
    // 녹음 데이터가 있다면 처리 (기존 방식 유지)
    else if (pendingTranscript && pendingSource) {
      await processWithAI(pendingTranscript, pendingSource, template);
    }
    else {
      toast({
        title: "처리할 데이터가 없습니다",
        description: "녹음, 파일 업로드, 또는 텍스트 입력을 먼저 해주세요.",
        variant: "destructive"
      });
    }
    
    // 상태 초기화
    setPendingTranscript("");
    setPendingSource(null);
  };

  // 템플릿 선택 없이 닫기
  const handleTemplateModalClose = () => {
    setShowTemplateModal(false);
    setPendingTranscript("");
    setPendingSource(null);
    setIsProcessing(false);
    setProcessingProgress(0);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">회의 녹음</h1>

      {/* 회의 정보 카드 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>회의 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="meetingTitle" className="block text-sm font-medium text-neutral-700 mb-2">
                회의 제목
              </label>
              <Input
                id="meetingTitle"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="회의 제목을 입력하세요"
              />
            </div>
            <div>
              <label htmlFor="meetingNotes" className="block text-sm font-medium text-neutral-700 mb-2">
                회의 노트 (선택사항)
              </label>
              <Input
                id="meetingNotes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="회의 노트를 입력하세요 (선택사항)"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center">
                  {tag}
                  <button
                    className="ml-1 text-primary/70 hover:text-primary"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove ${tag} tag`}
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex">
              <Input
                id="meetingTags"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyPress={handleTagKeyPress}
                placeholder="태그 추가"
                className="rounded-r-none"
              />
              <Button 
                onClick={handleAddTag}
                className="rounded-l-none"
              >
                추가
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 콘텐츠 입력 탭 */}
      <Card>
        <CardHeader>
          <CardTitle>회의 내용</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="record">
                <i className="ri-mic-line mr-2"></i>
                음성 녹음
              </TabsTrigger>
              <TabsTrigger value="upload">
                <i className="ri-upload-line mr-2"></i>
                파일 업로드
              </TabsTrigger>
              <TabsTrigger value="text">
                <i className="ri-edit-line mr-2"></i>
                텍스트 입력
              </TabsTrigger>
            </TabsList>

            {/* 음성 녹음 탭 */}
            <TabsContent value="record" className="mt-6">
              <div className="bg-neutral-50 rounded-lg p-6 text-center">
                <div className="mb-6">
                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={handleToggleRecording}
                      disabled={isProcessing}
                      className={`rounded-full w-16 h-16 flex items-center justify-center shadow-lg ${
                        isRecording ? "bg-neutral-600 hover:bg-neutral-700" : "bg-red-500 hover:bg-red-600"
                      }`}
                    >
                      <i className={`${isRecording ? "ri-stop-line" : "ri-mic-line"} text-2xl`}></i>
                    </Button>
                    
                    {isRecording && (
                      <div className="flex items-center justify-center">
                        <div className="recording-indicator mr-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-500 font-medium">{formatTime(recordingTime)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-neutral-500 mt-3">
                    {isRecording ? "녹음을 중지하려면 클릭하세요" : "녹음을 시작하려면 클릭하세요"}
                  </p>
                </div>
                
                {(isRecording || audioBlob) && (
                  <div className="mb-6">
                    <Waveform isAnimating={isRecording} />
                  </div>
                )}
                
                {audioBlob && !isRecording && (
                  <div className="mt-4">
                    <Button onClick={handleSaveRecording} disabled={isProcessing} className="w-full">
                      <i className="ri-save-line mr-2"></i>
                      녹음 처리하기
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                      <span className="text-neutral-600">오디오 처리 중...</span>
                    </div>
                    <Progress value={processingProgress} className="mb-4 h-2" />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 파일 업로드 탭 */}
            <TabsContent value="upload" className="mt-6">
              <div className="bg-neutral-50 rounded-lg p-6 text-center">
                <div className="mb-6">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".mp3,.wav,.m4a,audio/*"
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full max-w-md"
                  >
                    <i className="ri-upload-cloud-line mr-2"></i>
                    오디오 파일 선택
                  </Button>
                  <p className="text-sm text-neutral-500 mt-2">
                    지원 형식: MP3, WAV, M4A
                  </p>
                </div>

                {uploadedFile && (
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center mb-2">
                      <i className="ri-file-music-line text-2xl text-primary mr-2"></i>
                      <span className="font-medium">{uploadedFile.name}</span>
                    </div>
                    <p className="text-sm text-neutral-500">
                      크기: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button 
                      onClick={handleUploadProcess} 
                      disabled={isProcessing}
                      className="w-full mt-4"
                    >
                      <i className="ri-play-line mr-2"></i>
                      텍스트로 변환하기
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                      <span className="text-neutral-600">파일 처리 중...</span>
                    </div>
                    <Progress value={processingProgress} className="mb-4 h-2" />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 텍스트 입력 탭 */}
            <TabsContent value="text" className="mt-6">
              <div className="bg-neutral-50 rounded-lg p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    회의 내용
                  </label>
                  <Textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="회의 내용을 입력하거나, 오디오 파일을 업로드하여 자동으로 변환된 텍스트를 확인하세요."
                    className="min-h-[200px] mb-2"
                  />
                  <p className="text-sm text-neutral-500">
                    {manualText ? `${manualText.split(/\s+/).filter(Boolean).length}개의 단어` : ''}
                  </p>
                </div>

                {manualText.trim() && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => showTemplateSelection()}
                      disabled={isProcessing}
                      className="w-full md:w-auto"
                    >
                      <i className="ri-robot-line mr-2"></i>
                      AI 분석 시작하기
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={handleCancel}>
          취소
        </Button>
      </div>

      {/* 이메일 템플릿 선택 팝업 */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 분석 템플릿 선택</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              AI가 어떤 방식으로 회의를 분석할지 템플릿을 선택해주세요. 선택한 템플릿에 맞춰 맞춤형 요약과 액션 아이템을 생성합니다.
            </p>
            
            <div className="grid gap-4">
              {emailTemplates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20">
                  <CardContent className="p-4" onClick={() => handleTemplateSelect(template)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-2">{template.name}</h3>
                        <p className="text-sm text-neutral-600 mb-3">{template.subject}</p>
                        <div className="text-xs text-neutral-500">
                          유형: {template.type === 'summary' ? '요약' : 
                                template.type === 'action_items' ? '액션 아이템' : '전체 보고서'}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Button size="sm" className="ml-4">
                          <i className="ri-mail-line mr-2"></i>
                          선택
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={handleTemplateModalClose}>
                취소
              </Button>
              <div className="text-sm text-neutral-500">
                템플릿을 선택하면 AI 분석을 시작합니다
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}