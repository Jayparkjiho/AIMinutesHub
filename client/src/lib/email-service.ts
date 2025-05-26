import { Meeting, ActionItem } from './types';

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
  // 템플릿 변수를 실제 데이터로 치환
  static replaceTemplateVariables(template: string, meeting: Meeting): string {
    const variables = {
      '{{meeting_title}}': meeting.title,
      '{{meeting_date}}': new Date(meeting.date).toLocaleDateString('ko-KR'),
      '{{meeting_duration}}': this.formatDuration(meeting.duration),
      '{{meeting_summary}}': meeting.summary || '요약이 아직 생성되지 않았습니다.',
      '{{meeting_participants}}': this.formatParticipants(meeting.participants || []),
      '{{action_items}}': this.formatActionItems(meeting.actionItems || []),
      '{{meeting_tags}}': meeting.tags?.join(', ') || '태그 없음',
      '{{transcript_preview}}': this.getTranscriptPreview(meeting.transcript),
      '{{completed_action_items}}': this.formatCompletedActionItems(meeting.actionItems || []),
      '{{pending_action_items}}': this.formatPendingActionItems(meeting.actionItems || []),
    };

    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value);
    });

    return result;
  }

  // 기본 이메일 템플릿들
  static getDefaultTemplates(): EmailTemplate[] {
    return [
      {
        name: '회의 요약 보고서',
        type: 'summary',
        subject: '[회의록] {{meeting_title}} - {{meeting_date}}',
        body: `안녕하세요,

{{meeting_date}}에 진행된 "{{meeting_title}}" 회의의 요약 보고서를 공유드립니다.

📋 회의 개요
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
      {
        name: '전체 회의록',
        type: 'full_report',
        subject: '[전체 회의록] {{meeting_title}} - {{meeting_date}}',
        body: `안녕하세요,

{{meeting_date}}에 진행된 "{{meeting_title}}" 회의의 전체 회의록을 공유드립니다.

📋 회의 정보
• 제목: {{meeting_title}}
• 날짜: {{meeting_date}}
• 소요시간: {{meeting_duration}}
• 참석자: {{meeting_participants}}
• 태그: {{meeting_tags}}

📝 회의 요약
{{meeting_summary}}

✅ 액션 아이템
{{action_items}}

📄 회의 내용 미리보기
{{transcript_preview}}

전체 회의록이 필요하시면 첨부파일을 확인해주세요.

감사합니다.`,
        variables: ['meeting_title', 'meeting_date', 'meeting_duration', 'meeting_participants', 'meeting_tags', 'meeting_summary', 'action_items', 'transcript_preview']
      }
    ];
  }

  // 이메일 발송 (실제 구현에서는 서버 API 호출)
  static async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // 실제 이메일 발송 API 호출
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error('이메일 발송에 실패했습니다.');
      }

      return true;
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  // 도우미 함수들
  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  }

  private static formatParticipants(participants: any[]): string {
    if (participants.length === 0) return '참석자 정보 없음';
    
    return participants.map(p => {
      const hostLabel = p.isHost ? ' (진행자)' : '';
      return `${p.name}${hostLabel}`;
    }).join(', ');
  }

  private static formatActionItems(actionItems: ActionItem[]): string {
    if (actionItems.length === 0) return '액션 아이템이 없습니다.';
    
    return actionItems.map((item, index) => {
      const status = item.completed ? '✅' : '⏳';
      const assignee = item.assignee ? ` (담당: ${item.assignee})` : '';
      const dueDate = item.dueDate ? ` [마감: ${new Date(item.dueDate).toLocaleDateString('ko-KR')}]` : '';
      return `${index + 1}. ${status} ${item.text}${assignee}${dueDate}`;
    }).join('\n');
  }

  private static formatCompletedActionItems(actionItems: ActionItem[]): string {
    const completed = actionItems.filter(item => item.completed);
    if (completed.length === 0) return '완료된 작업이 없습니다.';
    
    return completed.map((item, index) => {
      const assignee = item.assignee ? ` (담당: ${item.assignee})` : '';
      return `${index + 1}. ✅ ${item.text}${assignee}`;
    }).join('\n');
  }

  private static formatPendingActionItems(actionItems: ActionItem[]): string {
    const pending = actionItems.filter(item => !item.completed);
    if (pending.length === 0) return '진행 중인 작업이 없습니다.';
    
    return pending.map((item, index) => {
      const assignee = item.assignee ? ` (담당: ${item.assignee})` : '';
      const dueDate = item.dueDate ? ` [마감: ${new Date(item.dueDate).toLocaleDateString('ko-KR')}]` : '';
      return `${index + 1}. ⏳ ${item.text}${assignee}${dueDate}`;
    }).join('\n');
  }

  private static getTranscriptPreview(transcript?: string): string {
    if (!transcript) return '회의록이 없습니다.';
    
    const words = transcript.split(' ');
    if (words.length <= 50) return transcript;
    
    return words.slice(0, 50).join(' ') + '... (더 보기)';
  }
}