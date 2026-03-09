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

      const verificationCode = verificationToken; // This is now a 6-digit code
      const verificationLink = `${VERIFICATION_URL}/verify-email?token=${verificationCode}&userId=${userId}`;
      
      const htmlBody = `
        <h2>Verifikasi Email Card Game Couple</h2>
        <p>Halo!</p>
        <p>Terima kasih telah mendaftarkan email Anda untuk Card Game Couple ❤️</p>
        
        <p><strong>Kode Verifikasi Anda:</strong></p>
        <div style="
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          text-align: center;
          margin: 20px 0;
        ">
          <p style="font-size: 32px; font-weight: bold; color: #0066cc; margin: 0; letter-spacing: 5px;">
            ${verificationCode}
          </p>
        </div>
        
        <p>Masukkan kode di atas di aplikasi untuk memverifikasi email Anda.</p>
        <p style="color: #666; font-size: 12px;">Atau klik link ini jika lebih mudah: <a href="${verificationLink}">${verificationLink}</a></p>
        
        <p style="color: #999; font-size: 12px;">Link dan kode ini berlaku selama 24 jam.</p>
        <p style="color: #999; font-size: 12px;">Jika Anda tidak membuat akun ini, abaikan email ini.</p>
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
    cardName: string,
    cardDescription: string,
    cardTier: string,
    durationMinutes: number
  ): Promise<boolean> {
    try {
      const transporter = getTransporter();
      if (!transporter || !SMTP_USER) return false;

      // Format duration
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      let durationText = '';
      if (hours > 0) {
        durationText = minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`;
      } else {
        durationText = `${durationMinutes} menit`;
      }

      // Color for tier
      const tierColors: Record<string, string> = {
        'SSR': '#FFD700',
        'Rare': '#FF69B4',
        'Common': '#87CEEB'
      };
      const tierColor = tierColors[cardTier] || '#87CEEB';

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #FF1493 0%, #FF69B4 100%); padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <span style="font-size: 48px; margin-right: 10px;">🎴</span>
            <h1 style="color: white; margin: 10px 0; font-size: 28px;">Partnermu Menggunakan Kartu!</h1>
          </div>

          <!-- Main Content -->
          <div style="background: #f8f9fa; padding: 30px 20px; text-align: center;">
            <p style="color: #666; margin: 0 0 20px 0; font-size: 16px;">Halo, Sayang! 💕</p>
            
            <p style="color: #333; margin: 0 0 25px 0; font-size: 18px;">
              <strong>${partnerName}</strong> baru saja menggunakan kartu spesial untuk kamu!
            </p>

            <!-- Card Details Box -->
            <div style="background: white; border-left: 5px solid ${tierColor}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                <div>
                  <h3 style="color: #333; margin: 0 0 5px 0; font-size: 20px;">${cardName}</h3>
                  <span style="display: inline-block; background-color: ${tierColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 10px;">${cardTier}</span>
                </div>
              </div>
              
              <p style="color: #666; margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">${cardDescription}</p>
              
              <div style="border-top: 1px solid #e0e0e0; padding-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #999; font-size: 14px;">⏱️ Durasi Aktif:</span>
                  <strong style="color: #FF1493; font-size: 16px;">${durationText}</strong>
                </div>
              </div>
            </div>

            <!-- Call to Action -->
            <div style="margin: 30px 0; padding: 20px; background: linear-gradient(135deg, rgba(255, 20, 147, 0.1) 0%, rgba(255, 105, 180, 0.1) 100%); border-radius: 8px;">
              <p style="color: #333; margin: 0; font-size: 15px;">
                ❤️ Kartu ini menunjukkan perhatian spesial partnermu untukmu!
              </p>
            </div>

            <!-- CTA Button -->
            <a href="${VERIFICATION_URL}/active" style="display: inline-block; background: linear-gradient(135deg, #FF1493 0%, #FF69B4 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; margin: 20px 0; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 20, 147, 0.3); transition: transform 0.2s;">
              Lihat di Aplikasi →
            </a>
          </div>

          <!-- Footer -->
          <div style="background: #2d2d2d; color: #fff; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">Card Game Couple Team ❤️</p>
            <p style="margin: 0; color: #999;">Nikmati momen spesial bersama pasanganmu</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `🎴 ${partnerName} menggunakan kartu: ${cardName}`,
        html: htmlBody,
      });

      console.log('[Email] Card used notification sent to', recipientEmail, 'for card:', cardName);
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
