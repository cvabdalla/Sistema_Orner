
import React, { useState } from 'react';
import Logo from '../components/Logo';
import { authService } from '../services/authService';
import { LockClosedIcon, EyeIcon, EyeOffIcon, ExclamationTriangleIcon } from '../assets/icons';
import type { User } from '../types';

interface LoginPageProps {
    onLoginSuccess: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const user = await authService.login(email, password);
            if (user) {
                onLoginSuccess(user);
            } else {
                setError('E-mail ou senha incorretos.');
            }
        } catch (err: any) {
            const message = err?.message || 'Erro inesperado ao realizar login.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-indigo-100">
            {/* Decoração de fundo */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md animate-fade-in relative z-10">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="p-8 pb-2 flex flex-col items-center">
                        <Logo variant="dark" className="scale-110 mb-6" />
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Bem-vindo</h2>
                        <p className="text-sm text-gray-500 font-medium mt-1 text-center">Acesse a plataforma orner energia solar</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-5">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-4 rounded-xl flex items-start gap-3 animate-shake">
                                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">E-mail corporativo</label>
                                <div className="relative">
                                    <input 
                                        required
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-300"
                                        placeholder="Digite seu e-mail"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5 ml-1">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Senha de acesso</label>
                                    <a href="#" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">Esqueceu a senha?</a>
                                </div>
                                <div className="relative group">
                                    <input 
                                        required
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Digite sua senha"
                                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors p-1"
                                    >
                                        {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 font-bold text-sm shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <LockClosedIcon className="w-4 h-4" />
                                    Entrar no sistema
                                </>
                            )}
                        </button>
                    </form>

                    <div className="p-6 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 text-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                            Orner tecnologia solar &copy; {new Date().getFullYear()}
                        </p>
                    </div>
                </div>
                
                <p className="text-center mt-8 text-xs text-gray-400 font-medium">
                    Problemas com o acesso? <a href="#" className="text-indigo-600 font-bold hover:underline">Fale com o suporte técnico</a>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
