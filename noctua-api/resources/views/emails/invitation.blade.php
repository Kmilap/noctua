@php
$teamName = $invitation->team->name;
$inviterName = $invitation->inviter->name;
$role = ucfirst($invitation->role);
@endphp
<html>
<head>
<meta charset="utf-8">
<style>
  body { background: #0f0e17; color: #fff; font-family: "Helvetica Neue", sans-serif; margin: 0; padding: 40px 20px; }
  .container { max-width: 480px; margin: 0 auto; }
  .logo { font-size: 28px; font-weight: 800; margin-bottom: 32px; }
  .logo span { color: #ef9f27; }
  .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; }
  h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
  p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
  .badge { display: inline-block; background: rgba(239,159,39,0.15); border: 1px solid rgba(239,159,39,0.3); color: #ef9f27; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
  .btn { display: block; background: #ef9f27; color: #000; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 24px 0 0; }
  .footer { color: #4b5563; font-size: 12px; text-align: center; margin-top: 24px; }
</style>
</head>
<body>
<div class="container">
  <div class="logo">n<span>o</span>ctua</div>
  <div class="card">
    <h2>Te invitaron a unirte</h2>
    <p><strong style="color:#fff">{{ $inviterName }}</strong> te invitó a colaborar en <strong style="color:#fff">{{ $teamName }}</strong> en Noctua.</p>
    <div class="badge">Rol: {{ $role }}</div>
    <p style="margin:0">Este enlace expira en <strong style="color:#fff">48 horas</strong>. Si no esperabas esta invitación, podés ignorar este correo.</p>
    <a href="{{ $acceptUrl }}" class="btn">Aceptar invitación</a>
  </div>
  <div class="footer">Noctua — Vigila mientras dormís · Bucaramanga, Colombia</div>
</div>
</body>
</html>