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
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #FF1493 0%, #FF69B4 100%); padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <span style="font-size: 48px; margin-right: 10px;">✉️</span>
            <h1 style="color: white; margin: 10px 0; font-size: 28px;">Verifikasi Email Anda</h1>
          </div>

          <!-- Main Content -->
          <div style="background: #f8f9fa; padding: 30px 20px; text-align: center;">
            <p style="color: #666; margin: 0 0 10px 0; font-size: 16px;">Halo! 👋</p>
            <p style="color: #333; margin: 0 0 30px 0; font-size: 16px;">Terima kasih telah mendaftarkan email Anda untuk <strong>Card Game Couple</strong> ❤️</p>

            <!-- Verification Code Box -->
            <div style="background: white; border-left: 5px solid #FF1493; border-radius: 8px; padding: 25px; margin: 25px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <p style="color: #999; margin: 0 0 15px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Kode Verifikasi Anda</p>
              <p style="font-size: 36px; font-weight: bold; color: #FF1493; margin: 0; letter-spacing: 6px;">
                ${verificationCode}
              </p>
              <p style="color: #999; margin: 15px 0 0 0; font-size: 13px;">Masukkan kode ini di aplikasi</p>
            </div>

            <!-- Instructions -->
            <div style="background: linear-gradient(135deg, rgba(255, 20, 147, 0.05) 0%, rgba(255, 105, 180, 0.05) 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: left;">
              <p style="color: #333; margin: 0 0 10px 0; font-size: 14px;"><strong>Langkah-langkah:</strong></p>
              <ol style="color: #666; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                <li>Buka aplikasi Card Game Couple</li>
                <li>Masukkan kode verifikasi di atas</li>
                <li>Nikmati pengalaman bermain bersama pasanganmu!</li>
              </ol>
            </div>

            <!-- CTA Button -->
            <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #FF1493 0%, #FF69B4 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; margin: 20px 0; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 20, 147, 0.3);">
              Verifikasi Sekarang →
            </a>

            <!-- Additional Info -->
            <p style="color: #999; font-size: 12px; margin-top: 25px;">Link dan kode ini berlaku selama <strong>24 jam</strong>.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">Jika Anda tidak membuat akun ini, abaikan email ini.</p>
          </div>

          <!-- Footer -->
          <div style="background: #2d2d2d; color: #fff; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">Card Game Couple Team ❤️</p>
            <p style="margin: 0; color: #999;">Nikmati momen spesial bersama pasanganmu</p>
          </div>
        </div>
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
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%); padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <span style="font-size: 48px; margin-right: 10px;">⏰</span>
            <h1 style="color: white; margin: 10px 0; font-size: 28px;">Kartu Kadaluarsa</h1>
          </div>

          <!-- Main Content -->
          <div style="background: #f8f9fa; padding: 30px 20px; text-align: center;">
            <p style="color: #666; margin: 0 0 20px 0; font-size: 16px;">Halo, Sayang! 💕</p>
            
            <p style="color: #333; margin: 0 0 25px 0; font-size: 18px;">
              Durasi kartu yang digunakan partnermu telah <strong>habis</strong>.
            </p>

            <!-- Information Box -->
            <div style="background: white; border-left: 5px solid #FFA500; border-radius: 8px; padding: 20px; margin: 25px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: left;">
              <p style="color: #666; margin: 0; font-size: 15px; line-height: 1.6;">
                Efek kartu spesial dari partnermu sudah berakhir. Manisnya momen hanya akan tinggal kenangan manis dalam hatimu ✨
              </p>
            </div>

            <!-- What's Next -->
            <div style="background: linear-gradient(135deg, rgba(255, 165, 0, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%); border-radius: 8px; padding: 20px; margin: 25px 0;">
              <p style="color: #333; margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">✨ Apa Selanjutnya?</p>
              <p style="color: #666; margin: 0; font-size: 14px; line-height: 1.6;">
                Buka aplikasi untuk melihat kartu aktif terbaru atau menunggu partnermu menggunakan kartu lagi!
              </p>
            </div>

            <!-- CTA Button -->
            <a href="${VERIFICATION_URL}/active" style="display: inline-block; background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; margin: 20px 0; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);">
              Buka Aplikasi →
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

      // Color for tier
      const tierColors: Record<string, string> = {
        'SSR': '#FFD700',
        'Rare': '#FF69B4',
        'Common': '#87CEEB'
      };
      const tierColor = tierColors[cardTier] || '#87CEEB';

      // Tier emoji
      const tierEmojis: Record<string, string> = {
        'SSR': '👑',
        'Rare': '💎',
        'Common': '✨'
      };
      const tierEmoji = tierEmojis[cardTier] || '✨';

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%); padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <span style="font-size: 48px; margin-right: 10px;">🎁</span>
            <h1 style="color: white; margin: 10px 0; font-size: 28px;">Kartu Baru!</h1>
          </div>

          <!-- Main Content -->
          <div style="background: #f8f9fa; padding: 30px 20px; text-align: center;">
            <p style="color: #666; margin: 0 0 10px 0; font-size: 16px;">Hebat! 🎉</p>
            
            <p style="color: #333; margin: 0 0 25px 0; font-size: 18px;">
              <strong>${partnerName}</strong> baru saja mendapatkan kartu spesial!
            </p>

            <!-- Card Tier Box -->
            <div style="background: white; border-left: 5px solid ${tierColor}; border-radius: 8px; padding: 25px; margin: 25px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <p style="color: #999; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Rarity</p>
              <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 15px;">
                <span style="font-size: 32px;">${tierEmoji}</span>
                <span style="display: inline-block; background-color: ${tierColor}; color: ${tierColor === '#FFD700' ? '#333' : 'white'}; padding: 8px 20px; border-radius: 20px; font-size: 16px; font-weight: bold;">
                  ${cardTier}
                </span>
              </div>
              <p style="color: #666; margin: 0; font-size: 14px; line-height: 1.6;">
                Selamat untuk partnermu! Ini adalah pencapaian spesial dalam hubungan kalian ❤️
              </p>
            </div>

            <!-- Motivation -->
            <div style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.1) 0%, rgba(142, 68, 173, 0.1) 100%); border-radius: 8px; padding: 20px; margin: 25px 0;">
              <p style="color: #333; margin: 0; font-size: 15px; line-height: 1.6;">
                💕 Semakin banyak interaksi dan momen bermain bersama, semakin besar kesempatan mendapat kartu yang lebih langka!
              </p>
            </div>

            <!-- CTA Button -->
            <a href="${VERIFICATION_URL}/cards" style="display: inline-block; background: linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; margin: 20px 0; font-size: 16px; box-shadow: 0 4px 12px rgba(155, 89, 182, 0.3);">
              Lihat Koleksi Kartu →
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
        subject: `🎁 ${partnerName} mendapat kartu ${cardTier}! ${tierEmoji}`,
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
