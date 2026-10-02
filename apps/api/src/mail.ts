import { InternalServerErrorException } from "@nestjs/common";

export async function sendOrPrepareDemoMail(input: { to: string; subject: string; url: string; intro: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { delivery: "Demo mode: no email was sent.", url: input.url };
  await sendTransactionalEmail(input.to, input.subject, `<p>${input.intro}</p><p><a href="${input.url}">Continue to MarketFlow360</a></p><p>If you did not request this, ignore this message.</p>`);
  return { delivery: "Email sent.", url: undefined };
}

export async function sendTransactionalEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new InternalServerErrorException("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "MarketFlow360 <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!response.ok) throw new InternalServerErrorException("Email delivery failed. Check the configured email provider.");
}
