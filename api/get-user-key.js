import https from 'https';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const TOSS_LOGIN_BASE = 'https://apps-in-toss-api.toss.im';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// mTLS fetch — 환경변수에서 인증서/키 로드
function mtlsFetch(url, options = {}) {
  const cert = process.env.TOSS_CERT?.replace(/\\n/g, '\n');
  const key = process.env.TOSS_KEY?.replace(/\\n/g, '\n');

  const agent = new https.Agent({ cert, key, rejectUnauthorized: true });

  return fetch(url, { ...options, agent });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const { authorizationCode, referrer } = await req.json();

    if (!authorizationCode || !referrer) {
      return new Response(
        JSON.stringify({ error: 'authorizationCode와 referrer가 필요합니다' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // Step 1: authorizationCode → accessToken
    const tokenRes = await mtlsFetch(
      `${TOSS_LOGIN_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode, referrer }),
      }
    );
    const tokenData = await tokenRes.json();

    if (tokenData.resultType !== 'SUCCESS') {
      return new Response(
        JSON.stringify({ error: 'AccessToken 발급 실패', detail: tokenData }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const accessToken = tokenData.success.accessToken;

    // Step 2: accessToken → userKey
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

    if (meData.resultType !== 'SUCCESS') {
      return new Response(
        JSON.stringify({ error: 'userKey 조회 실패', detail: meData }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({ userKey: meData.success.userKey }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'get-user-key 오류', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
}
