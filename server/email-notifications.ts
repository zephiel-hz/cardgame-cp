import nodemailer from 'nodemailer';
import { storage } from './storage';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@cardgame.local';
const VERIFICATION_URL = process.env.VERIFICATION_URL || 'http://localhost:5173';

let transporter: nodemailer.Transporter | null = null;

// Initialize email transporter
function getTransporter() {
  if (!transporter && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export interface EmailNotificationPayload {
  recipientEmail: string;
  subject: string;
  htmlBody: string;
}

export class EmailNotificationService {
  /**
   * Send verification email
   */
  async sendVerificationEmail(userId: number, email: string, verificationToken: string): Promise<boolean> {
    try {
      const transporter = getTransporter();
      if (!transporter || !SMTP_USER) {
        console.log('[Email] Email service not configured');
        return false;
      }

      const verificationLink = `${VERIFICATION_URL}/verify-email?token=${verificationToken}&userId=${userId}`;
      
      const htmlBody = `
        <h2>Verifikasi Email Card Game Couple</h2>
        <p>Halo!</p>
        <p>Terima kasih telah mendaftarkan email Anda untuk Card Game Couple ❤️</p>
        <p>Klik tombol di bawah ini untuk memverifikasi email Anda:</p>
        <a href="${verificationLink}" style="
          display: inline-block;
          padding: 10px 20px;
          background-color: #0066cc;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        ">Verifikasi Email</a>
        <p>Atau kunjungi link ini: <a href="${verificationLink}">${verificationLink}</a></p>
        <p>Link ini berlaku selama 24 jam.</p>
        <p>Jika Anda tidak membuat akun ini, abaikan email ini.</p>
      `;

      const result = await transporter.sendMail({
        from: FROM_EMAIL,
        to: email,
        subject: 'Verifikasi Email Card Game Couple',
        html: htmlBody,
      });

      console.log('[Email] Verification email sent to', email);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send verification email:', error);
      return false;
    }
  }

  /**
   * Send card used notification email
   */
  async notifyCardUsedEmail(
    recipientEmail: string,
    partnerName: string,
    cardTier: string,
    durationText: string
  ): Promise<boolean> {
    try {
      const transporter = getTransporter();
      if (!transporter || !SMTP_USER) return false;

      const htmlBody = `
        <h2>🎴 Partnermu Menggunakan Kartu!</h2>
        <p>Halo!</p>
        <p><strong>${partnerName}</strong> baru saja menggunakan kartu <strong>#${cardTier}</strong></p>
        <p><strong>Durasi kartu:</strong> ${durationText}</p>
        <p>Buka aplikasi untuk melihat detail lebih lengkap!</p>
        <p>Card Game Couple Team ❤️</p>
      `;

      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `🎴 ${partnerName} menggunakan kartu #${cardTier}`,
        html: htmlBody,
      });

      console.log('[Email] Card used notification sent to', recipientEmail);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send card used notification:', error);
      return false;
    }
  }

  /**
   * Send card expired notification email
   */
  async notifyCardExpiredEmail(recipientEmail: string): Promise<boolean> {
    try {
      const transporter = getTransporter();
      if (!transporter || !SMTP_USER) return false;

      const htmlBody = `
        <h2>⏰ Kartu Partnermu Kadaluarsa</h2>
        <p>Halo!</p>
        <p>Durasi kartu yang digunakan partnermu telah habis.</p>
        <p>Buka aplikasi untuk melihat kartu aktif terbaru!</p>
        <p>Card Game Couple Team ❤️</p>
      `;

      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: '⏰ Kartu Partnermu Kadaluarsa',
        html: htmlBody,
      });

      console.log('[Email] Card expired notification sent to', recipientEmail);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send card expired notification:', error);
      return false;
    }
  }

  /**
   * Send new card notification email
   */
  async notifyNewCardEmail(recipientEmail: string, partnerName: string, cardTier: string): Promise<boolean> {
    try {
      const transporter = getTransporter();
      if (!transporter || !SMTP_USER) return false;

      const htmlBody = `
        <h2>🎁 Partnermu Mendapat Kartu Baru!</h2>
        <p>Halo!</p>
        <p><strong>${partnerName}</strong> baru saja mendapatkan kartu <strong>${cardTier}</strong>!</p>
        <p>Selamat untuk partnermu! ✨</p>
        <p>Buka aplikasi untuk melihat kartu spesial ini!</p>
        <p>Card Game Couple Team ❤️</p>
      `;

      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `🎁 ${partnerName} mendapat kartu ${cardTier}!`,
        html: htmlBody,
      });

      console.log('[Email] New card notification sent to', recipientEmail);
      return true;
    } catch (error) {
      console.error('[Email] Failed to send new card notification:', error);
      return false;
    }
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return !!(SMTP_USER && SMTP_PASS);
  }
}

export const emailNotificationService = new EmailNotificationService();
