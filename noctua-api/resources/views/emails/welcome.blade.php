<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Bienvenido a Noctua</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0e17; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
Bienvenido a Noctua, {{ $user->name }}. Tu cuenta ya está activa.
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0f0e17;">
  <tr>
    <td align="center" style="padding: 56px 20px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px;">

        <tr>
          <td style="padding: 0 0 48px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 40px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; line-height: 1;">
            n<span style="color: #ef9f27;">o</span>ctua
          </td>
        </tr>

        <tr>
          <td style="background-color: #1a1925; border: 1px solid #2a2935; border-radius: 20px; padding: 56px 48px;">

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

              <tr>
                <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 32px; font-weight: 700; color: #ffffff; padding: 0 0 16px 0; line-height: 1.15; letter-spacing: -0.02em;">
                  Bienvenido, {{ $user->name }}
                </td>
              </tr>

              <tr>
                <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #9ca3af; padding: 0 0 28px 0;">
                  Tu cuenta en <span style="color: #ffffff; font-weight: 700;">Noctua</span> ya está activa. Desde ahora podés monitorear tus servicios, configurar reglas de alerta y recibir notificaciones cuando algo necesite tu atención.
                </td>
              </tr>

              @php
                $roleName = $user->getRoleNames()->first() ?? 'Member';
                $roleName = ucfirst($roleName);
              @endphp
              <tr>
                <td style="padding: 0 0 32px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #2a1f10; border: 1px solid #5c4220; border-radius: 8px; padding: 7px 14px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; color: #ef9f27; letter-spacing: 0.02em;">
                        Rol: {{ $roleName }}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #9ca3af; padding: 0 0 40px 0;">
                  Empezá creando tu primer servicio o explorando el dashboard. Si necesitás ayuda, podés escribirnos respondiendo este correo.
                </td>
              </tr>

              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" bgcolor="#ef9f27" style="background-color: #ef9f27; border-radius: 12px;">
                        <a href="{{ config('app.frontend_url') }}/dashboard" target="_blank" style="display: block; padding: 18px 32px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0f0e17; text-decoration: none; border-radius: 12px; letter-spacing: -0.01em;">
                          Ir al dashboard
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>

          </td>
        </tr>

        <tr>
          <td align="center" style="padding: 32px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #4b5563; letter-spacing: 0.01em;">
            Noctua &mdash; Vigila mientras dormís &middot; Bucaramanga, Colombia
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
