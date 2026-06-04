/**
 * Render the credential-offer completion page shown to the user after their
 * PID has been verified and the EAA credential offer is ready.
 */
export function renderCompletePage(offerUri: string): string {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(offerUri)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Collect your Access Credential</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 520px; margin: 3rem auto; padding: 0 1.5rem; text-align: center;
    }
    h1   { font-size: 1.4rem; color: #1a1a2e; }
    p    { color: #555; line-height: 1.6; }
    .card { background: #f8f9fa; border-radius: 12px; padding: 2rem; margin: 1.5rem 0; }
    .qr  { display: block; margin: 0 auto 1.5rem; border-radius: 8px; }
    .btn {
      display: inline-block; background: #0066cc; color: #fff;
      padding: .9rem 2rem; border-radius: 8px;
      text-decoration: none; font-weight: 600; font-size: 1rem;
    }
    .btn:hover { background: #0052a3; }
    .hint { font-size: .85rem; color: #888; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>✅ Identity Verified</h1>
  <p>Your identity was successfully verified.<br>
     Open the link below in your EUDI Wallet to collect your <strong>Access Attestation</strong>.</p>

  <div class="card">
    <img class="qr" src="${qrUrl}" width="240" height="240" alt="Credential offer QR code">
    <a class="btn" href="${escAttr(offerUri)}">Open in EUDI Wallet</a>
  </div>

  <p class="hint">
    Same device? Tap the button above.<br>
    Different device? Scan the QR code with your EUDI Wallet.
  </p>
</body>
</html>`;
}

export function renderCompleteNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>EUDI Access Management</title>
</head>
<body style="font-family:sans-serif;max-width:600px;margin:4rem auto;padding:0 1rem">
  <h2>⚠️ Session not found</h2>
  <p>The credential offer has expired or was already collected.</p>
</body>
</html>`;
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
