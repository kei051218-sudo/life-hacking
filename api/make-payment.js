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
    const { userKey } = await req.json();

    if (!userKey) {
      return new Response(
        JSON.stringify({ error: 'userKey가 필요합니다' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // 유니크 주문번호 생성
    const orderNo = `umh-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;

    const payRes = await mtlsFetch(
      `${TOSS_PAY_BASE}/api-partner/v1/apps-in-toss/pay/make-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-toss-user-key': String(userKey),
        },
        body: JSON.stringify({
          orderNo,
          productDesc: '운명해킹 9파트 심층 분석',
          amount: 2900,
          amountTaxFree: 0,
          isTestPayment: false,
        }),
      }
    );
    const payData = await payRes.json();

    if (payData.resultType !== 'SUCCESS') {
      return new Response(
        JSON.stringify({ error: '결제 생성 실패', detail: payData }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({ payToken: payData.success.payToken, orderNo }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'make-payment 오류', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
}
