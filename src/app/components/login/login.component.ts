import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent {
    private auth = inject(Auth);
    private router = inject(Router);
    user$ = user(this.auth);

    async loginWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/calendar');
            const result = await signInWithPopup(this.auth, provider);

            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem('google_access_token', credential.accessToken);
            }

            this.router.navigate(['/dashboard']);
        } catch (error) {
            console.error('Error al iniciar sesión con Google:', error);
        }
    }

    async logout() {
        await signOut(this.auth);
        this.router.navigate(['/login']);
    }
}
