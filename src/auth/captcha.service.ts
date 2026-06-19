export class CaptchaService {
  static async verify(token: string): Promise<boolean> {
    const secret = process.env.CAPTCHA_SECRET_KEY;

    if (!secret) {
      console.warn('CAPTCHA_SECRET_KEY is not set. Skipping captcha validation.');
      return true;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secret}&response=${token}`,
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Captcha validation error:', error);
      return false;
    }
  }
}
