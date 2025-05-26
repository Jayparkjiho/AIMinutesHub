export interface EmailTemplate {
  id?: number;
  name: string;
  type: 'summary' | 'action_items' | 'full_report';
  subject: string;
  body: string;
  variables: string[];
}

export interface EmailData {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: {
    filename: string;
    content: string;
    type: string;
  }[];
}

export class EmailService {
  // 템플릿 변수를 실제 데이터로 치환하는 함수
  static replaceTemplateVariables(template: string, meeting: any): string {
    const variables: Record<string, string> = {
      '{{meeting_title}}': meeting.title || '제목 없음',
      '{{meeting_date}}': meeting.date ? new Date(meeting.date).toLocaleDateString('ko-KR') : '',
      '{{meeting_duration}}': this.formatDuration(meeting.duration || 0),
      '{{meeting_participants}}': this.formatParticipants(meeting.participants || []),
      '{{meeting_summary}}': meeting.summary || '요약이 생성되지 않았습니다.',
      '{{action_items}}': this.formatActionItems(meeting.actionItems || []),
      '{{completed_action_items}}': this.formatCompletedActionItems(meeting.actionItems || []),
      '{{pending_action_items}}': this.formatPendingActionItems(meeting.actionItems || []),
      '{{meeting_transcript}}': this.getTranscriptPreview(meeting.transcript),
      '{{meeting_notes}}': meeting.notes || '추가 메모가 없습니다.'
    };

    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value);
    });

    return result;
  }

  // 10개의 다양한 이메일 템플릿
  static getDefaultTemplates(): EmailTemplate[] {
    return [
      // 1. AI 분석 회의록 (OpenAI 요약 포함)
      {
        name: 'AI 분석 회의록',
        type: 'summary',
        subject: '[AI 분석] {{meeting_title}} - 스마트 회의록',
        body: `안녕하세요,

{{meeting_title}} 회의를 AI가 분석한 결과를 공유드립니다.

📅 회의 정보
• 날짜: {{meeting_date}}
• 소요시간: {{meeting_duration}}
• 참석자: {{meeting_participants}}

🤖 AI 요약
{{meeting_summary}}

✅ AI 추출 액션 아이템
{{action_items}}

📝 전체 대화 내용 (화자 분리)
{{meeting_transcript}}

AI가 분석한 내용이므로 중요한 사항은 다시 한번 확인해주세요.

감사합니다.`,
        variables: ['meeting_title', 'meeting_date', 'meeting_duration', 'meeting_participants', 'meeting_summary', 'action_items', 'meeting_transcript']
      },

      // 2. 기본 회의록 요약
      {
        name: '회의록 요약',
        type: 'summary',
        subject: '[회의록] {{meeting_title}} - {{meeting_date}}',
        body: `안녕하세요,

{{meeting_title}} 회의록을 공유드립니다.

📅 회의 정보
• 날짜: {{meeting_date}}
• 소요시간: {{meeting_duration}}
• 참석자: {{meeting_participants}}

📝 회의 요약
{{meeting_summary}}

✅ 주요 액션 아이템
{{action_items}}

회의록 전문이 필요하시면 언제든 요청해주세요.

감사합니다.`,
        variables: ['meeting_title', 'meeting_date', 'meeting_duration', 'meeting_participants', 'meeting_summary', 'action_items']
      },

      // 2. 액션 아이템 중심
      {
        name: '액션 아이템 리스트',
        type: 'action_items',
        subject: '[액션아이템] {{meeting_title}} - 할 일 목록',
        body: `안녕하세요,

{{meeting_title}} 회의에서 논의된 액션 아이템들을 정리하여 공유드립니다.

📌 완료된 작업
{{completed_action_items}}

🔄 진행 중인 작업
{{pending_action_items}}

각자 담당하신 업무를 확인해주시고, 진행 상황을 공유해주세요.

감사합니다.`,
        variables: ['meeting_title', 'completed_action_items', 'pending_action_items']
      },

      // 3. 전체 상세 회의록
      {
        name: '전체 회의록',
        type: 'full_report',
        subject: '[상세회의록] {{meeting_title}} - 전체 내용',
        body: `{{meeting_title}} 상세 회의록

📅 회의 정보
• 일시: {{meeting_date}}
• 참석자: {{meeting_participants}}
• 소요시간: {{meeting_duration}}

📋 회의 내용
{{meeting_transcript}}

📝 요약
{{meeting_summary}}

✅ 액션 아이템
{{action_items}}

📎 첨부 자료
{{meeting_notes}}

문의사항이 있으시면 언제든 연락해주세요.`,
        variables: ['meeting_title', 'meeting_date', 'meeting_participants', 'meeting_duration', 'meeting_transcript', 'meeting_summary', 'action_items', 'meeting_notes']
      },

      // 4. 경영진 보고용
      {
        name: '경영진 보고서',
        type: 'summary',
        subject: '[경영진 보고] {{meeting_title}} - 핵심 내용',
        body: `경영진 귀하,

{{meeting_title}} 회의 결과를 보고드립니다.

🎯 핵심 결과
{{meeting_summary}}

📊 주요 결정사항
• 참석자: {{meeting_participants}}
• 회의 일시: {{meeting_date}}
• 소요시간: {{meeting_duration}}

🚀 후속 조치
{{action_items}}

추가 논의가 필요한 사항이 있으시면 연락 주시기 바랍니다.

감사합니다.`,
        variables: ['meeting_title', 'meeting_summary', 'meeting_participants', 'meeting_date', 'meeting_duration', 'action_items']
      },

      // 5. 프로젝트 킥오프 회의
      {
        name: '프로젝트 킥오프',
        type: 'full_report',
        subject: '[프로젝트 시작] {{meeting_title}} - 킥오프 회의록',
        body: `프로젝트 팀 여러분,

{{meeting_title}} 킥오프 회의가 성공적으로 진행되었습니다.

🚀 프로젝트 개요
{{meeting_summary}}

👥 팀 구성
{{meeting_participants}}

📅 일정
• 킥오프: {{meeting_date}}
• 회의 시간: {{meeting_duration}}

✅ 다음 단계
{{action_items}}

📝 상세 내용
{{meeting_transcript}}

모든 팀원이 역할을 명확히 이해하고 진행해주시기 바랍니다.

함께 성공적인 프로젝트를 만들어갑시다!`,
        variables: ['meeting_title', 'meeting_summary', 'meeting_participants', 'meeting_date', 'meeting_duration', 'action_items', 'meeting_transcript']
      },

      // 6. 주간 팀 미팅
      {
        name: '주간 팀 미팅',
        type: 'summary',
        subject: '[주간미팅] {{meeting_title}} - 이번 주 진행상황',
        body: `팀 여러분,

이번 주 {{meeting_title}} 내용을 공유드립니다.

📊 이번 주 요약
{{meeting_summary}}

👥 참석자: {{meeting_participants}}
⏰ 회의 시간: {{meeting_duration}}

📋 이번 주 할 일
{{action_items}}

다음 주에도 좋은 성과로 만나요!

수고하셨습니다.`,
        variables: ['meeting_title', 'meeting_summary', 'meeting_participants', 'meeting_duration', 'action_items']
      },

      // 7. 고객 미팅 보고
      {
        name: '고객 미팅 보고',
        type: 'summary',
        subject: '[고객미팅] {{meeting_title}} - 미팅 결과 보고',
        body: `관련 부서 담당자님,

{{meeting_title}} 고객 미팅 결과를 보고드립니다.

🤝 미팅 정보
• 날짜: {{meeting_date}}
• 참석자: {{meeting_participants}}
• 소요시간: {{meeting_duration}}

💼 미팅 결과
{{meeting_summary}}

📋 후속 조치 사항
{{action_items}}

고객과의 지속적인 관계 유지를 위해 신속한 후속 조치 부탁드립니다.

감사합니다.`,
        variables: ['meeting_title', 'meeting_date', 'meeting_participants', 'meeting_duration', 'meeting_summary', 'action_items']
      },

      // 8. 브레인스토밍 세션
      {
        name: '브레인스토밍 세션',
        type: 'summary',
        subject: '[브레인스토밍] {{meeting_title}} - 아이디어 정리',
        body: `창의적인 팀원들께,

{{meeting_title}} 브레인스토밍 세션에서 나온 훌륭한 아이디어들을 정리했습니다.

💡 주요 아이디어
{{meeting_summary}}

👥 참여자: {{meeting_participants}}
⏱️ 세션 시간: {{meeting_duration}}

🎯 다음 단계
{{action_items}}

모든 아이디어가 소중합니다. 추가 의견이 있으시면 언제든 공유해주세요.

창의적인 세션에 참여해주셔서 감사합니다!`,
        variables: ['meeting_title', 'meeting_summary', 'meeting_participants', 'meeting_duration', 'action_items']
      },

      // 9. 문제 해결 회의
      {
        name: '문제 해결 회의',
        type: 'full_report',
        subject: '[문제해결] {{meeting_title}} - 해결방안 논의',
        body: `관련 팀 여러분,

{{meeting_title}} 문제 해결 회의 결과를 공유드립니다.

🔍 문제 분석
{{meeting_summary}}

👥 참석자: {{meeting_participants}}
📅 회의 일시: {{meeting_date}}

⚡ 즉시 조치사항
{{action_items}}

📋 상세 논의 내용
{{meeting_transcript}}

빠른 문제 해결을 위해 모든 팀원의 적극적인 협조 부탁드립니다.

감사합니다.`,
        variables: ['meeting_title', 'meeting_summary', 'meeting_participants', 'meeting_date', 'action_items', 'meeting_transcript']
      },

      // 10. 월간 검토 회의
      {
        name: '월간 검토 회의',
        type: 'summary',
        subject: '[월간검토] {{meeting_title}} - 이달의 성과와 계획',
        body: `팀 여러분,

{{meeting_title}} 월간 검토 회의 내용을 공유드립니다.

📈 이달의 성과
{{meeting_summary}}

📊 회의 정보
• 참석자: {{meeting_participants}}
• 검토 기간: {{meeting_date}}
• 회의 시간: {{meeting_duration}}

🎯 다음 달 목표
{{action_items}}

이달 수고 많으셨고, 다음 달도 좋은 성과 함께 만들어가요!

감사합니다.`,
        variables: ['meeting_title', 'meeting_summary', 'meeting_participants', 'meeting_date', 'meeting_duration', 'action_items']
      }
    ];
  }

  // 이메일 전송 API (실제 구현 시 이메일 서비스 연동 필요)
  static async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // 실제 이메일 전송 로직 구현 필요
      console.log('이메일 전송:', emailData);
      return true;
    } catch (error) {
      console.error('이메일 전송 실패:', error);
      return false;
    }
  }

  // 유틸리티 함수들
  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  }

  private static formatParticipants(participants: any[]): string {
    if (!participants || participants.length === 0) {
      return '참석자 정보 없음';
    }
    
    return participants.map(p => p.name).join(', ');
  }

  private static formatActionItems(actionItems: any[]): string {
    if (!actionItems || actionItems.length === 0) {
      return '액션 아이템이 없습니다.';
    }
    
    return actionItems.map((item, index) => 
      `${index + 1}. ${item.text}${item.assignee ? ` (담당자: ${item.assignee})` : ''}${item.dueDate ? ` (마감: ${item.dueDate})` : ''}`
    ).join('\n');
  }

  private static formatCompletedActionItems(actionItems: any[]): string {
    const completed = actionItems.filter(item => item.completed);
    if (completed.length === 0) {
      return '완료된 작업이 없습니다.';
    }
    
    return completed.map((item, index) => 
      `${index + 1}. ✅ ${item.text}${item.assignee ? ` (담당자: ${item.assignee})` : ''}`
    ).join('\n');
  }

  private static formatPendingActionItems(actionItems: any[]): string {
    const pending = actionItems.filter(item => !item.completed);
    if (pending.length === 0) {
      return '진행 중인 작업이 없습니다.';
    }
    
    return pending.map((item, index) => 
      `${index + 1}. 🔄 ${item.text}${item.assignee ? ` (담당자: ${item.assignee})` : ''}${item.dueDate ? ` (마감: ${item.dueDate})` : ''}`
    ).join('\n');
  }

  private static getTranscriptPreview(transcript?: string): string {
    if (!transcript) {
      return '전사 내용이 없습니다.';
    }
    
    return transcript.length > 500 ? transcript.substring(0, 500) + '...' : transcript;
  }
}