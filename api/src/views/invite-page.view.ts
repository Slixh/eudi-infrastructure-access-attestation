interface Grant {
  label: string;
  resourceId: string;
  status: string;
}

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  PENDING: { color: '#888',    label: 'Ausstehend' },
  ACTIVE:  { color: '#22c55e', label: 'Aktiv'      },
  REVOKED: { color: '#ef4444', label: 'Widerrufen'  },
};

export function renderInvitePage(grant: Grant, deepLink: string): string {
  const badge = STATUS_BADGE[grant.status] ?? { color: '#888', label: grant.status };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(deepLink)}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zugangseinladung — ${escHtml(grant.label)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    }
    .card {
      background: #fff; border-radius: 16px; padding: 2.5rem 2rem;
      max-width: 480px; width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      text-align: center;
    }
    .badge {
      display: inline-block; font-size: .75rem; font-weight: 600;
      padding: .25rem .75rem; border-radius: 999px; color: #fff;
      background: ${badge.color}; margin-bottom: 1rem;
    }
    h1 { font-size: 1.4rem; color: #1a1a2e; margin-bottom: .4rem; }
    .resource { font-size: .9rem; color: #666; margin-bottom: 2rem; }
    .qr { display: block; margin: 0 auto 1.5rem; border-radius: 12px;
          border: 1px solid #e5e7eb; }
    .btn {
      display: inline-block; background: #0066cc; color: #fff;
      padding: .85rem 2rem; border-radius: 10px;
      text-decoration: none; font-weight: 600; font-size: 1rem;
      margin-bottom: 1.5rem;
    }
    .btn:hover { background: #0052a3; }
    .hint { font-size: .82rem; color: #999; line-height: 1.6; }
    .token-box {
      background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: .6rem .8rem; margin-top: 1.5rem;
      font-family: monospace; font-size: .72rem; color: #555;
      word-break: break-all; text-align: left;
    }
    .token-label { font-size: .75rem; color: #999; margin-bottom: .3rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${escHtml(badge.label)}</div>
    <h1>${escHtml(grant.label)}</h1>
    <p class="resource">Ressource: <strong>${escHtml(grant.resourceId)}</strong></p>

    <img class="qr" src="${qrUrl}" width="240" height="240" alt="Einladungs-QR-Code">

    <a class="btn" href="${escAttr(deepLink)}">In EUDI Wallet öffnen</a>

    <p class="hint">
      Gleiche Geräte? Button tippen.<br>
      Anderes Gerät? QR-Code mit der EUDI Wallet scannen.
    </p>

    <div class="token-box">
      <div class="token-label">Deep-Link</div>
      ${escHtml(deepLink)}
    </div>
  </div>
</body>
</html>`;
}

// Minimal HTML escaping to prevent XSS from grant labels / resource IDs
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
