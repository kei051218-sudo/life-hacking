import https from 'https';

const TOSS_PAY_BASE = 'https://pay-apps-in-toss-api.toss.im';

function mtlsFetch(url, options = {}) {
  const cert = process.env.TOSS_CERT?.replace(/\\n/g, '\n');
  const key = process.env.TOSS_KEY?.replace(/\\n/g, '\n');
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
    const { userKey } = req.body;

    if (!userKey) {
      return res.status(400).json({ error: 'userKey가 필요합니다' });
    }

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
      return res.status(500).json({ error: '결제 생성 실패', detail: payData });
    }

    return res.status(200).json({ payToken: payData.success.payToken, orderNo });

  } catch (error) {
    return res.status(500).json({ error: 'make-payment 오류', detail: error.message });
  }
}
