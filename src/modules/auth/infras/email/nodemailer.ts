import nodemailer from "nodemailer";
import { config } from "@share/component/config";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailProvider {
  sendEmail(options: EmailOptions): Promise<void>;
}

let transporterInstance: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass,
      },
    });
  }
  return transporterInstance;
}

class NodemailerProvider implements IEmailProvider {
  async sendEmail(options: EmailOptions): Promise<void> {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }
}

let providerInstance: IEmailProvider | null = null;

export function getEmailProvider(): IEmailProvider {
  if (!providerInstance) {
    providerInstance = new NodemailerProvider();
  }
  return providerInstance;
}

export const emailProvider = getEmailProvider();
