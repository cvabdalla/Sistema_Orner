import { dataService } from './dataService';
import { supabase } from '../supabaseClient';
import type { User } from '../types';

const SESSION_KEY = 'orner_user_session';

class AuthService {
    /**
     * Tenta realizar o login comparando email e senha no Supabase.
     */
    async login(email: string, password: string): Promise<User | null> {
        try {
            // Buscamos o usuário na tabela system_users do Supabase
            const { data, error } = await supabase
                .from('system_users')
                .select('*')
                .eq('email', email.toLowerCase())
                .single();

            if (error || !data) {
                return null;
            }

            const user = data as User;

            // Validação simples de senha (melhorar com hash em produção se necessário)
            if (user.password === password || (!user.password && password === '1234')) {
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
        if (!session) return null;
        try {
            return JSON.parse(session);
        } catch (e) {
            return null;
        }
    }

    logout() {
        localStorage.removeItem(SESSION_KEY);
    }
}

export const authService = new AuthService();