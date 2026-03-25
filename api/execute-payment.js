import fetch from 'node-fetch';
import https from 'https';

const TOSS_PAY_BASE = 'https://pay-apps-in-toss-api.toss.im';

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
    const { payToken, orderNo, userKey } = req.body;

    if (!payToken || !orderNo || !userKey) {
      return res.status(400).json({ error: 'payToken, orderNo, userKey가 모두 필요합니다' });
    }

    const agent = getMtlsAgent();

    const execRes = await fetch(
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
        agent,
      }
    );
    const execData = await execRes.json();
    console.log('[execute-payment] resultType:', execData.resultType, JSON.stringify(execData).slice(0, 300));

    if (execData.resultType !== 'SUCCESS') {
      return res.status(500).json({ error: '결제 승인 실패', detail: execData });
    }

    return res.status(200).json({ success: true, data: execData.success });

  } catch (error) {
    console.error('[execute-payment] 오류:', error.message);
    return res.status(500).json({ error: 'execute-payment 오류', detail: error.message });
  }
}
