<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{background:#0f0e17;color:#fff;font-family:"Helvetica Neue",sans-serif;margin:0;padding:40px 20px;}
  .container{max-width:480px;margin:0 auto;}
  .logo{font-size:28px;font-weight:800;margin-bottom:32px;}
  .logo span{color:#ef9f27;}
  .card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;}
  h2{font-size:20px;font-weight:700;margin:0 0 8px;}
  p{color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px;}
  .btn{display:block;background:#ef9f27;color:#000;text-decoration:none;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;margin:24px 0 0;}
  .footer{color:#4b5563;font-size:12px;text-align:center;margin-top:24px;}
</style>
</head>
<body>
<div class="container">
  <div class="logo">n<span>o</span>ctua</div>
  <div class="card">
    <h2>Bienvenido, {{ $user->name }}!</h2>
    <p>Tu cuenta en <strong style="color:#fff">Noctua</strong> fue creada exitosamente.</p>
    <a href="http://localhost:5173/dashboard" class="btn">Ir al Dashboard</a>
  </div>
  <div class="footer">Noctua - Vigila mientras dormis - Bucaramanga, Colombia</div>
</div>
</body>
</html>