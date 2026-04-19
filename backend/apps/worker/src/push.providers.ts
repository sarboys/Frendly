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
}

type ApnProvider = InstanceType<typeof apn.Provider>;

function normalizePrivateKey(value?: string): string | undefined {
  return value?.replace(/\\n/g, '\n');
}

export class FakePushProvider implements PushProvider {
  async send(message: PushDispatch): Promise<void> {
    console.log('[fake-push]', JSON.stringify(message));
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

    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      },
      'big-break-worker-fcm',
    );
  }

  async send(message: PushDispatch): Promise<void> {
    if (!this.app) {
      console.log('[fcm-push-skipped]', JSON.stringify(message));
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
      production: false,
    });
  }

  async send(message: PushDispatch): Promise<void> {
    if (!this.provider || !this.topic) {
      console.log('[apns-push-skipped]', JSON.stringify(message));
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
}
