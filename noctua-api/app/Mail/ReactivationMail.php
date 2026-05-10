<?php
namespace App\Mail;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
class ReactivationMail extends Mailable {
    use Queueable, SerializesModels;
    public function __construct(public readonly User $user, public readonly string $reactivateUrl) {}
    public function envelope(): Envelope {
        return new Envelope(subject: "Reactivar tu cuenta en Noctua");
    }
    public function content(): Content {
        return new Content(view: "emails.reactivation");
    }
}