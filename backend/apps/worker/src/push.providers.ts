import apn from 'apn';
import admin from 'firebase-admin';

export interface PushDispatch {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  send(message: PushDispatch): Promise<void>;
  close?(): Promise<void> | void;
}

type ApnProvider = InstanceType<typeof apn.Provider>;

function normalizePrivateKey(value?: string): string | undefined {
  return value?.replace(/\\n/g, '\n');
}

function maskPushToken(token: string): string {
  if (token.length <= 8) {
    return '[redacted]';
  }

  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function serializePushLog(message: PushDispatch): string {
  return JSON.stringify({
    ...message,
    token: maskPushToken(message.token),
  });
}

export class FakePushProvider implements PushProvider {
  async send(message: PushDispatch): Promise<void> {
    console.log('[fake-push]', serializePushLog(message));
  }
}

export class FcmPushProvider implements PushProvider {
  private app: admin.app.App | null = null;

  constructor() {
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    const privateKey = normalizePrivateKey(process.env.FCM_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
      return;
    }

    const appName = 'big-break-worker-fcm';
    const existingApp = admin.apps.find((app) => app?.name === appName);
    if (existingApp) {
      this.app = existingApp;
      return;
    }

    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      },
      appName,
    );
  }

  async send(message: PushDispatch): Promise<void> {
    if (!this.app) {
      console.log('[fcm-push-skipped]', serializePushLog(message));
      return;
    }

    await this.app.messaging().send({
      token: message.token,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data,
    });
  }

  async close(): Promise<void> {
    if (!this.app) {
      return;
    }

    await this.app.delete();
    this.app = null;
  }
}

export class ApnsPushProvider implements PushProvider {
  private provider: ApnProvider | null = null;
  private readonly topic: string | undefined;

  constructor() {
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    const key = normalizePrivateKey(process.env.APNS_PRIVATE_KEY);
    this.topic = process.env.APNS_BUNDLE_ID;

    if (!keyId || !teamId || !key || !this.topic) {
      return;
    }

    this.provider = new apn.Provider({
      token: {
        key,
        keyId,
        teamId,
      },
      production: process.env.APNS_PRODUCTION === 'true',
    });
  }

  async send(message: PushDispatch): Promise<void> {
    if (!this.provider || !this.topic) {
      console.log('[apns-push-skipped]', serializePushLog(message));
      return;
    }

    const note = new apn.Notification({
      topic: this.topic,
      alert: {
        title: message.title,
        body: message.body,
      },
      payload: message.data,
    });

    await this.provider.send(note, message.token);
  }

  close(): void {
    this.provider?.shutdown();
    this.provider = null;
  }
}
