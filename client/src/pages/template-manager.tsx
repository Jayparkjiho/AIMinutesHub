import { useState } from "react";
import { useIndexedDBTemplates } from "@/hooks/use-indexeddb";
import { EmailService, EmailTemplate } from "@/lib/email-service";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

export default function TemplateManager() {
  const { toast } = useToast();
  const { templates, saveTemplate, isSaving } = useIndexedDBTemplates();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "summary" as "summary" | "action_items" | "full_report",
    subject: "",
    body: "",
    variables: [] as string[]
  });

  // 기본 템플릿들을 가져와서 IndexedDB에 저장
  const initializeDefaultTemplates = async () => {
    const defaultTemplates = EmailService.getDefaultTemplates();
    const advancedTemplates = getAdvancedTemplates();
    const allTemplates = [...defaultTemplates, ...advancedTemplates];
    
    try {
      for (const template of allTemplates) {
        await new Promise(resolve => {
          saveTemplate(template);
          setTimeout(resolve, 100); // 각 템플릿 저장 사이에 약간의 지연
        });
      }
      
      toast({
        title: "템플릿 초기화 완료",
        description: `${allTemplates.length}개의 기본 템플릿이 추가되었습니다.`
      });
    } catch (error) {
      toast({
        title: "템플릿 초기화 실패",
        description: "일부 템플릿 저장에 실패했습니다.",
        variant: "destructive"
      });
    }
  };

  // 고급 템플릿들
  const getAdvancedTemplates = (): EmailTemplate[] => {
    return [
      {
        name: "주간 회의 요약",
        type: "summary",
        subject: "[주간회의] {{meeting_title}} - {{meeting_date}}",
        body: `팀 여러분 안녕하세요,

{{meeting_date}}에 진행된 주간 회의 내용을 공유드립니다.

📅 회의 정보
• 일시: {{meeting_date}}
• 소요시간: {{meeting_duration}}
• 참석자: {{meeting_participants}}

📋 주요 논의사항
{{meeting_summary}}

✅ 이번 주 완료 사항
{{completed_action_items}}

🎯 다음 주 진행 사항
{{pending_action_items}}

다음 주간 회의는 동일한 시간에 진행됩니다.

감사합니다.`,
        variables: ["meeting_title", "meeting_date", "meeting_duration", "meeting_participants", "meeting_summary", "completed_action_items", "pending_action_items"]
      },
      {
        name: "프로젝트 킥오프 회의록",
        type: "full_report",
        subject: "[프로젝트 킥오프] {{meeting_title}} 회의록",
        body: `프로젝트 팀원 여러분께,

{{meeting_title}} 프로젝트 킥오프 회의가 성공적으로 진행되었습니다.

🚀 프로젝트 개요
• 프로젝트명: {{meeting_title}}
• 킥오프 일시: {{meeting_date}}
• 참여 인원: {{meeting_participants}}

📝 회의 요약
{{meeting_summary}}

🎯 주요 액션 아이템
{{action_items}}

📊 다음 단계
각자 맡은 업무를 확인하시고, 진행상황을 주기적으로 공유해주세요.

전체 회의록은 첨부파일을 참고해주세요.

프로젝트 성공을 위해 함께 노력해주세요!`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_summary", "action_items"]
      },
      {
        name: "고객 미팅 후속조치",
        type: "action_items",
        subject: "[고객미팅] {{meeting_title}} - 후속조치 사항",
        body: `고객 미팅 참석자 여러분께,

{{meeting_date}}에 진행된 고객 미팅의 후속조치 사항을 안내드립니다.

🤝 미팅 정보
• 고객사: {{meeting_title}}
• 미팅 일시: {{meeting_date}}
• 참석자: {{meeting_participants}}

📋 미팅 요약
{{meeting_summary}}

📌 즉시 처리 필요
{{pending_action_items}}

✅ 완료된 사항
{{completed_action_items}}

고객과의 약속을 지키기 위해 각자 담당 업무를 꼼꼼히 확인해주세요.

감사합니다.`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_summary", "pending_action_items", "completed_action_items"]
      },
      {
        name: "월간 리뷰 회의",
        type: "summary",
        subject: "[월간리뷰] {{meeting_date}} 성과 및 계획",
        body: `팀 여러분 수고하셨습니다,

이번 달 성과 리뷰 회의 결과를 공유드립니다.

📈 이번 달 성과
{{meeting_summary}}

🏆 완료된 주요 과제
{{completed_action_items}}

🎯 다음 달 목표
{{pending_action_items}}

📊 참고사항
• 회의 일시: {{meeting_date}}
• 참석자: {{meeting_participants}}
• 소요시간: {{meeting_duration}}

모두 수고 많으셨고, 다음 달도 좋은 성과 기대하겠습니다!`,
        variables: ["meeting_date", "meeting_summary", "completed_action_items", "pending_action_items", "meeting_participants", "meeting_duration"]
      },
      {
        name: "기술 스펙 리뷰",
        type: "full_report",
        subject: "[기술리뷰] {{meeting_title}} 스펙 검토 결과",
        body: `개발팀 여러분께,

{{meeting_title}} 기술 스펙 리뷰 회의가 완료되었습니다.

⚙️ 기술 검토 개요
• 리뷰 대상: {{meeting_title}}
• 검토 일시: {{meeting_date}}
• 참여자: {{meeting_participants}}

🔍 검토 결과
{{meeting_summary}}

📋 기술적 액션 아이템
{{action_items}}

💡 주요 결정사항
상세한 기술 스펙은 첨부된 회의록을 참고해주세요.

구현 단계에서 질문이나 이슈가 있으면 언제든 공유해주세요.

화이팅!`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_summary", "action_items"]
      },
      {
        name: "예산 승인 회의",
        type: "summary",
        subject: "[예산승인] {{meeting_title}} 회의 결과",
        body: `관련 부서 담당자분들께,

{{meeting_date}} 예산 승인 회의 결과를 안내드립니다.

💰 예산 검토 내용
{{meeting_summary}}

✅ 승인된 항목
{{completed_action_items}}

⏳ 추가 검토 필요
{{pending_action_items}}

📋 회의 정보
• 일시: {{meeting_date}}
• 참석자: {{meeting_participants}}
• 소요시간: {{meeting_duration}}

승인된 예산은 지정된 절차에 따라 집행해주시기 바랍니다.

감사합니다.`,
        variables: ["meeting_date", "meeting_summary", "completed_action_items", "pending_action_items", "meeting_participants", "meeting_duration"]
      },
      {
        name: "채용 면접 후기",
        type: "summary",
        subject: "[채용면접] {{meeting_title}} 면접 후기",
        body: `채용 담당자분들께,

{{meeting_date}} 채용 면접이 완료되었습니다.

👥 면접 정보
• 포지션: {{meeting_title}}
• 면접 일시: {{meeting_date}}
• 면접관: {{meeting_participants}}

📝 면접 평가
{{meeting_summary}}

📋 후속 조치
{{action_items}}

최종 결정은 모든 면접관의 의견을 종합하여 진행하겠습니다.

감사합니다.`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_summary", "action_items"]
      },
      {
        name: "분기별 전략 회의",
        type: "full_report",
        subject: "[전략회의] Q{{quarter}} 사업 계획 및 전략",
        body: `경영진 및 팀장분들께,

분기별 전략 회의 결과를 공유드립니다.

🎯 전략 회의 개요
• 회의: {{meeting_title}}
• 일시: {{meeting_date}}
• 참석자: {{meeting_participants}}

📊 주요 논의사항
{{meeting_summary}}

🚀 전략적 액션 플랜
{{action_items}}

💼 실행 지침
각 팀은 할당된 목표를 달성하기 위해 세부 실행 계획을 수립해주세요.

전체 회의록과 자료는 첨부파일을 참고하시기 바랍니다.

성공적인 분기를 만들어갑시다!`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_summary", "action_items"]
      },
      {
        name: "제품 런칭 준비 회의",
        type: "action_items",
        subject: "[제품런칭] {{meeting_title}} 준비사항 점검",
        body: `제품 출시 팀 여러분께,

{{meeting_title}} 제품 런칭 준비 회의 결과를 안내드립니다.

🚀 런칭 정보
• 제품명: {{meeting_title}}
• 회의 일시: {{meeting_date}}
• 참석 팀: {{meeting_participants}}

📋 런칭 준비 현황
{{meeting_summary}}

🔥 긴급 처리 사항
{{pending_action_items}}

✅ 완료된 준비사항
{{completed_action_items}}

성공적인 제품 출시를 위해 모든 팀이 협력해주시기 바랍니다.

런칭까지 화이팅!`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_summary", "pending_action_items", "completed_action_items"]
      },
      {
        name: "교육 및 훈련 결과",
        type: "summary",
        subject: "[교육결과] {{meeting_title}} 교육 후기",
        body: `교육 참석자 여러분께,

{{meeting_date}}에 진행된 교육 프로그램이 완료되었습니다.

📚 교육 개요
• 교육명: {{meeting_title}}
• 교육 일시: {{meeting_date}}
• 참석자: {{meeting_participants}}
• 교육 시간: {{meeting_duration}}

📝 교육 내용 요약
{{meeting_summary}}

📋 후속 액션
{{action_items}}

오늘 배운 내용을 실무에 적극 활용해주시기 바랍니다.

추가 질문이나 도움이 필요하시면 언제든 연락주세요.

수고하셨습니다!`,
        variables: ["meeting_title", "meeting_date", "meeting_participants", "meeting_duration", "meeting_summary", "action_items"]
      }
    ];
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: "",
      type: "summary",
      subject: "",
      body: "",
      variables: []
    });
    setEditingTemplate(null);
  };

  // 템플릿 저장
  const handleSaveTemplate = () => {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast({
        title: "필수 필드 누락",
        description: "템플릿 이름, 제목, 내용을 모두 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    const template = {
      ...formData,
      variables: extractVariables(formData.subject + formData.body)
    };

    saveTemplate(template);
    
    toast({
      title: "템플릿 저장 완료",
      description: `"${template.name}" 템플릿이 저장되었습니다.`
    });

    setIsDialogOpen(false);
    resetForm();
  };

  // 변수 추출
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    
    const uniqueVariables = new Set(matches.map(match => match.replace(/\{\{|\}\}/g, '')));
    return Array.from(uniqueVariables);
  };

  // 템플릿 편집
  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
      variables: template.variables || []
    });
    setIsDialogOpen(true);
  };

  // 템플릿 타입별 색상
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'summary': return 'bg-blue-100 text-blue-800';
      case 'action_items': return 'bg-green-100 text-green-800';
      case 'full_report': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 템플릿 타입별 한글명
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'summary': return '요약';
      case 'action_items': return '액션아이템';
      case 'full_report': return '전체보고서';
      default: return type;
    }
  };

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">템플릿 관리</h1>
          <p className="text-neutral-500 mt-1">이메일 템플릿을 생성하고 관리합니다</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button 
            variant="outline"
            onClick={initializeDefaultTemplates}
            disabled={isSaving}
          >
            <i className="ri-download-line mr-2"></i>
            기본 템플릿 추가
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <i className="ri-add-line mr-2"></i>
                새 템플릿
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* 템플릿 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template, index) => (
          <Card key={template.id || index} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <Badge className={getTypeColor(template.type)}>
                  {getTypeLabel(template.type)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-neutral-500">제목</span>
                  <p className="text-sm truncate">{template.subject}</p>
                </div>
                <div>
                  <span className="text-sm text-neutral-500">내용 미리보기</span>
                  <p className="text-sm text-neutral-600 line-clamp-3">
                    {template.body.substring(0, 100)}...
                  </p>
                </div>
                {template.variables && template.variables.length > 0 && (
                  <div>
                    <span className="text-sm text-neutral-500">변수 ({template.variables.length}개)</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.variables.slice(0, 3).map(variable => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <i className="ri-edit-line mr-1"></i>
                    편집
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <i className="ri-delete-bin-line mr-1"></i>
                    삭제
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <i className="ri-file-text-line text-4xl text-neutral-300 mb-4"></i>
          <h3 className="text-lg font-medium text-neutral-600 mb-2">템플릿이 없습니다</h3>
          <p className="text-neutral-500 mb-4">새 템플릿을 만들거나 기본 템플릿을 추가해보세요.</p>
          <Button onClick={initializeDefaultTemplates}>
            기본 템플릿 추가하기
          </Button>
        </div>
      )}

      {/* 템플릿 생성/편집 다이얼로그 */}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTemplate ? '템플릿 편집' : '새 템플릿 만들기'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                템플릿 이름
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="템플릿 이름을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                템플릿 타입
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                className="w-full border border-neutral-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="summary">요약</option>
                <option value="action_items">액션아이템</option>
                <option value="full_report">전체보고서</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              이메일 제목
            </label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="{{meeting_title}} - {{meeting_date}} 형식으로 변수 사용 가능"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              이메일 내용
            </label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({...formData, body: e.target.value})}
              placeholder="{{meeting_summary}}, {{action_items}} 등의 변수를 사용하여 템플릿을 작성하세요"
              rows={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              사용 가능한 변수들
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                'meeting_title', 'meeting_date', 'meeting_duration', 
                'meeting_participants', 'meeting_summary', 'action_items',
                'completed_action_items', 'pending_action_items', 'meeting_tags'
              ].map((variable: string) => (
                <Badge key={variable} variant="outline" className="text-xs">
                  {`{{${variable}}}`}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              취소
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </div>
  );
}