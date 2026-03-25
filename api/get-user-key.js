import https from 'https';

const TOSS_LOGIN_BASE = 'https://apps-in-toss-api.toss.im';

function mtlsFetch(url, options = {}) {
  const cert = process.env.TOSS_CERT?.replace(/\\n/g, '\n');
  const key = process.env.TOSS_KEY?.replace(/\\n/g, '\n');

  console.log('[mtls] cert 앞 50자:', cert?.slice(0, 50));
  console.log('[mtls] key 앞 50자:', key?.slice(0, 50));

  const agent = new https.Agent({ cert, key, rejectUnauthorized: true });
  return fetch(url, { ...options, agent });
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
    console.log('[get-user-key] authorizationCode:', authorizationCode?.slice(0, 20), 'referrer:', referrer);

    if (!authorizationCode || !referrer) {
      return res.status(400).json({ error: 'authorizationCode와 referrer가 필요합니다' });
    }

    // Step 1: authorizationCode → accessToken
    console.log('[step1] generate-token 호출 시작');
    const tokenRes = await mtlsFetch(
      `${TOSS_LOGIN_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode, referrer }),
      }
    );
    const tokenData = await tokenRes.json();
    console.log('[step1] 응답 resultType:', tokenData.resultType, '상세:', JSON.stringify(tokenData).slice(0, 200));

    if (tokenData.resultType !== 'SUCCESS') {
      return res.status(500).json({ error: 'AccessToken 발급 실패', detail: tokenData });
    }

    const accessToken = tokenData.success.accessToken;

    // Step 2: accessToken → userKey
    console.log('[step2] login-me 호출 시작');
    const meRes = await mtlsFetch(
      `${TOSS_LOGIN_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const meData = await meRes.json();
    console.log('[step2] 응답 resultType:', meData.resultType);

    if (meData.resultType !== 'SUCCESS') {
      return res.status(500).json({ error: 'userKey 조회 실패', detail: meData });
    }

    return res.status(200).json({ userKey: meData.success.userKey });

  } catch (error) {
    console.error('[get-user-key] catch 오류:', error.message, error.stack);
    return res.status(500).json({ error: 'get-user-key 오류', detail: error.message });
  }
}
