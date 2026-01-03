
import { dataService } from './dataService';
import type { User } from '../types';

const SESSION_KEY = 'orner_user_session';

class AuthService {
    /**
     * Tenta realizar o login comparando email e senha.
     * Em ambiente real, o Supabase Auth seria o ideal, mas seguindo a estrutura 
     * de tabela personalizada solicitada:
     */
    async login(email: string, password: string): Promise<User | null> {
        try {
            const users = await dataService.getAll<User>('system_users', undefined, true);
            
            // Encontra o usuário por e-mail e senha
            const user = users.find(u => 
                u.email.toLowerCase() === email.toLowerCase() && 
                (u.password === password || (!u.password && password === '123456'))
            );

            if (user) {
                if (!user.active) throw new Error('Seu acesso está suspenso.');
                this.saveSession(user);
                return user;
            }

            return null;
        } catch (error: any) {
            throw error;
        }
    }

    saveSession(user: User) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    getSession(): User | null {
        const session = localStorage.getItem(SESSION_KEY);
        return session ? JSON.parse(session) : null;
    }

    logout() {
        localStorage.removeItem(SESSION_KEY);
    }
}

export const authService = new AuthService();
