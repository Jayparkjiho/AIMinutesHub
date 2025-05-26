import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

export interface SMTPConfig {
  email: string;
  password: string;
}

export class GmailSMTPService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: SMTPConfig) {
    this.createTransporter();
  }

  private createTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.config.email,
          pass: this.config.password // Gmail 앱 비밀번호 사용
        }
      });
    } catch (error) {
      console.error('SMTP 연결 설정 실패:', error);
      throw new Error('Gmail SMTP 설정을 확인해주세요.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP 연결이 설정되지 않았습니다.' };
    }

    try {
      const mailOptions = {
        from: `"MeetScribe" <${this.config.email}>`,
        to: options.to.join(', '),
        cc: options.cc?.join(', '),
        bcc: options.bcc?.join(', '),
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType || 'text/plain'
        }))
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error: any) {
      console.error('메일 전송 실패:', error);
      return {
        success: false,
        error: error.message || '메일 전송 중 오류가 발생했습니다.'
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP 연결이 설정되지 않았습니다.' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'SMTP 연결 테스트 실패'
      };
    }
  }
}