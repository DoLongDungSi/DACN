import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../api';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { AuthMode } from '../types';

export const AuthPage: React.FC = () => {
    const { setCurrentUser, fetchAllData, setCurrentView, error, setError, loading, setLoading } = useAppContext();
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [signupUsername, setSignupUsername] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [loginCredential, setLoginCredential] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    const handleAuthSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); // Clear previous errors
        if (authMode === "login") {
            handleLogin();
        } else {
            handleSignup();
        }
    };

    const handleSignup = async () => {
        if (!signupUsername || !signupEmail || !signupPassword) {
            setError("Vui lòng điền đầy đủ thông tin đăng ký.");
            return;
        }
        if (signupPassword.length < 6) {
             setError("Mật khẩu phải có ít nhất 6 ký tự.");
             return;
        }
        setLoading(true);
        try {
            const data = await api.post<{ user: typeof currentUser }>("/auth/signup", {
                username: signupUsername,
                email: signupEmail,
                password: signupPassword,
            });
            if (data?.user) {
                setCurrentUser(data.user);
                await fetchAllData();
                setCurrentView("main");
            } else {
                 throw new Error("Dữ liệu người dùng không hợp lệ sau khi đăng ký.");
            }
        } catch (err: any) {
            setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
         if (!loginCredential || !loginPassword) {
            setError("Vui lòng điền tên đăng nhập/email và mật khẩu.");
            return;
        }
        setLoading(true);
        try {
            const data = await api.post<{ user: typeof currentUser }>("/auth/login", {
                credential: loginCredential,
                password: loginPassword,
            });
             if (data?.user) {
                setCurrentUser(data.user);
                await fetchAllData();
                setCurrentView("main");
            } else {
                 throw new Error("Dữ liệu người dùng không hợp lệ sau khi đăng nhập.");
            }
        } catch (err: any) {
             setError(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
        } finally {
             setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-indigo-600 flex items-center justify-center space-x-3"> {/* Tăng space-x-3 lên một chút nếu cần */}
                    <img src="/mljudge-logo.svg" alt="MLJudge Logo" className="h-10 w-10" />
                    <span>ML Judge</span>
                </h1>
                    <p className="text-slate-500 mt-2">Nền tảng đánh giá mô hình của bạn!</p>
                </div>

                <form onSubmit={handleAuthSubmit}>
                    {authMode === "signup" ? (
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Tên người dùng"
                                value={signupUsername}
                                onChange={(e) => setSignupUsername(e.target.value)}
                                required
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                required
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                            <input
                                type="password"
                                placeholder="Mật khẩu (ít nhất 6 ký tự)"
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 flex justify-center items-center"
                            >
                                {loading ? <LoadingSpinner /> : 'Đăng ký'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Tên người dùng hoặc Email"
                                value={loginCredential}
                                onChange={(e) => setLoginCredential(e.target.value)}
                                required
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                            <input
                                type="password"
                                placeholder="Mật khẩu"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                required
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 flex justify-center items-center"
                            >
                               {loading ? <LoadingSpinner /> : 'Đăng nhập'}
                            </button>
                        </div>
                    )}
                </form>

                {error && <p className="text-red-600 text-sm text-center mt-4">{error}</p>}

                <button
                    onClick={() => {
                        setAuthMode(authMode === "login" ? "signup" : "login");
                        setError(""); // Clear error on mode switch
                    }}
                    disabled={loading}
                    className="w-full mt-6 text-indigo-600 font-semibold hover:underline disabled:text-slate-400"
                >
                    Chuyển sang {authMode === "login" ? "Đăng ký" : "Đăng nhập"}
                </button>
            </div>
        </div>
    );
};
