import fetch from 'node-fetch';
import https from 'https';

const TOSS_LOGIN_BASE = 'https://apps-in-toss-api.toss.im';

function getMtlsAgent() {
  const cert = process.env.TOSS_CERT?.replace(/\\n/g, '\n');
  const key = process.env.TOSS_KEY?.replace(/\\n/g, '\n');
  return new https.Agent({ cert, key, rejectUnauthorized: true });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { authorizationCode, referrer } = req.body;

    if (!authorizationCode || !referrer) {
      return res.status(400).json({ error: 'authorizationCode와 referrer가 필요합니다' });
    }

    const agent = getMtlsAgent();

    // Step 1: authorizationCode → accessToken
    const tokenRes = await fetch(
      `${TOSS_LOGIN_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode, referrer }),
        agent,
      }
    );
    const tokenData = await tokenRes.json();
    console.log('[step1] resultType:', tokenData.resultType, JSON.stringify(tokenData).slice(0, 300));

    if (tokenData.resultType !== 'SUCCESS') {
      return res.status(500).json({ error: 'AccessToken 발급 실패', detail: tokenData });
    }

    const accessToken = tokenData.success.accessToken;

    // Step 2: accessToken → userKey
    const meRes = await fetch(
      `${TOSS_LOGIN_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        agent,
      }
    );
    const meData = await meRes.json();
    console.log('[step2] resultType:', meData.resultType);

    if (meData.resultType !== 'SUCCESS') {
      return res.status(500).json({ error: 'userKey 조회 실패', detail: meData });
    }

    return res.status(200).json({ userKey: meData.success.userKey });

  } catch (error) {
    console.error('[get-user-key] 오류:', error.message);
    return res.status(500).json({ error: 'get-user-key 오류', detail: error.message });
  }
}
