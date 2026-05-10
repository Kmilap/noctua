<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { background: #0f0e17; color: #fff; font-family: 'Helvetica Neue', sans-serif; margin: 0; padding: 40px 20px; }
  .container { max-width: 480px; margin: 0 auto; }
  .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 32px; }
  .logo span { color: #ef9f27; }
  .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; }
  h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
  p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
  .otp { display: flex; gap: 8px; justify-content: center; margin: 24px 0; }
  .digit { width: 52px; height: 64px; background: rgba(239,159,39,0.1); border: 2px solid rgba(239,159,39,0.4); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #ef9f27; }
  .footer { color: #4b5563; font-size: 12px; text-align: center; margin-top: 24px; }
</style>
</head>
<body>
<div class="container">
  <div class="logo">n<span>o</span>ctua</div>
  <div class="card">
    <h2>Tu código de verificación</h2>
    <p>Usá este código para restablecer tu contraseña en Noctua. Expira en <strong style="color:#fff">10 minutos</strong>.</p>
    <div class="otp">
      @foreach(str_split($otp) as $digit)
        <div class="digit">{{ $digit }}</div>
      @endforeach
    </div>
    <p style="margin:0">Si no solicitaste este código, ignorá este correo.</p>
  </div>
  <div class="footer">Noctua — Vigila mientras dormís · Bucaramanga, Colombia</div>
</div>
</body>
</html>
