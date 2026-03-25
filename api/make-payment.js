import https from 'https';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const TOSS_PAY_BASE = 'https://pay-apps-in-toss-api.toss.im';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
    const { payToken, orderNo, userKey } = await req.json();

    if (!payToken || !orderNo || !userKey) {
      return new Response(
        JSON.stringify({ error: 'payToken, orderNo, userKey가 모두 필요합니다' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    const execRes = await mtlsFetch(
      `${TOSS_PAY_BASE}/api-partner/v1/apps-in-toss/pay/execute-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-toss-user-key': String(userKey),
        },
        body: JSON.stringify({
          payToken,
          orderNo,
          isTestPayment: false,
        }),
      }
    );
    const execData = await execRes.json();

    if (execData.resultType !== 'SUCCESS') {
      return new Response(
        JSON.stringify({ error: '결제 승인 실패', detail: execData }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: execData.success }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'execute-payment 오류', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
}
