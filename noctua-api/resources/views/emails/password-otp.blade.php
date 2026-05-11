<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Tu código de verificación</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0e17; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
Tu código de verificación es {{ $otp }}. Expira en 10 minutos.
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
                  Tu código de verificación
                </td>
              </tr>

              <tr>
                <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #9ca3af; padding: 0 0 36px 0;">
                  Usá este código para restablecer tu contraseña en Noctua. Expira en <span style="color: #ffffff; font-weight: 700;">10 minutos</span>.
                </td>
              </tr>

              <tr>
                <td align="center" style="padding: 0 0 36px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      @php $digits = str_split((string) $otp); @endphp
                      @foreach($digits as $digit)
                      <td style="padding: 0 4px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td width="56" height="64" align="center" valign="middle" style="background-color: #2a1f10; border: 1px solid #5c4220; border-radius: 10px; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-size: 28px; font-weight: 700; color: #ef9f27;">
                              {{ $digit }}
                            </td>
                          </tr>
                        </table>
                      </td>
                      @endforeach
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #6b7280; padding: 28px 0 28px 0; border-top: 1px solid #2a2935;">
                  Si no solicitaste este código, podés ignorar este correo. Tu cuenta sigue segura.
                </td>
              </tr>

              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-size: 12px; color: #4b5563;">
                    <tr>
                      <td style="padding: 4px 0; width: 110px;">requested_at</td>
                      <td style="padding: 4px 0; color: #6b7280;">{{ now()->format('Y-m-d H:i:s') }} UTC</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0;">email</td>
                      <td style="padding: 4px 0; color: #6b7280;">{{ $email }}</td>
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
