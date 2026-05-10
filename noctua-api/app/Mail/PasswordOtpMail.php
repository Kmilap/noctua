<?php
namespace App\Mail;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
class PasswordOtpMail extends Mailable {
    use Queueable, SerializesModels;
    public function __construct(public readonly string $otp, public readonly string $email) {}
    public function envelope(): Envelope { return new Envelope(subject: "Tu código de verificación — Noctua"); }
    public function content(): Content { return new Content(view: "emails.password-otp"); }
}