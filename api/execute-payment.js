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
    const { payToken, orderNo, userKey } = req.body;

    if (!payToken || !orderNo || !userKey) {
      return res.status(400).json({ error: 'payToken, orderNo, userKey가 모두 필요합니다' });
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
      return res.status(500).json({ error: '결제 승인 실패', detail: execData });
    }

    return res.status(200).json({ success: true, data: execData.success });

  } catch (error) {
    return res.status(500).json({ error: 'execute-payment 오류', detail: error.message });
  }
}
