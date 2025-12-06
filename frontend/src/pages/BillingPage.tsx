import React, { useState } from 'react';
import { CreditCard, Lock, CheckCircle, Printer, Crown, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../api';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

export const BillingPage: React.FC = () => {
    const { currentUser, showToast, fetchCurrentUser } = useAppContext();
    const [loading, setLoading] = useState(false);
    const [invoice, setInvoice] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        cardNumber: '',
        cardHolder: '',
        expiryDate: '',
        cvv: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let formattedValue = value;

        // Auto format Card Number (adding spaces)
        if (name === 'cardNumber') {
            formattedValue = value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
        }
        // Auto format Expiry (MM/YY)
        if (name === 'expiryDate') {
            formattedValue = value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2');
        }

        setFormData(prev => ({ ...prev, [name]: formattedValue }));
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/billing/upgrade', {
                cardNumber: formData.cardNumber,
                cardHolder: formData.cardHolder,
                expiryDate: formData.expiryDate,
                cvv: formData.cvv
            });

            if (res.success) {
                setInvoice(res.invoice);
                showToast('Thanh toán thành công! Bạn đã là thành viên Premium.', 'success');
                await fetchCurrentUser(); // Refresh user state to update UI
            }
        } catch (error: any) {
            showToast(error.message || 'Thanh toán thất bại.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (invoice) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-2xl w-full shadow-2xl rounded-2xl overflow-hidden animate-fade-in print:shadow-none">
                    <div className="bg-emerald-600 p-8 text-center print:hidden">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Thanh toán thành công!</h2>
                        <p className="text-emerald-100">Cảm ơn bạn đã nâng cấp lên gói Premium.</p>
                    </div>

                    <div className="p-8 print:p-0">
                        <div className="border border-slate-200 rounded-xl p-8 bg-slate-50/50 print:border-none print:bg-white">
                            {/* Invoice Header */}
                            <div className="flex justify-between items-start mb-8 border-b border-slate-200 pb-6">
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-800">HÓA ĐƠN</h1>
                                    <p className="text-sm text-slate-500 mt-1">Mã HĐ: <span className="font-mono text-slate-900">{invoice.id}</span></p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-indigo-600">ML Judge Corp.</div>
                                    <p className="text-sm text-slate-500">Hanoi, Vietnam</p>
                                    <p className="text-sm text-slate-500">{new Date(invoice.date).toLocaleDateString('vi-VN')}</p>
                                </div>
                            </div>

                            {/* Invoice Details */}
                            <div className="space-y-4 mb-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Khách hàng</p>
                                        <p className="font-semibold text-slate-800">{invoice.customer}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Phương thức</p>
                                        <p className="font-semibold text-slate-800">{invoice.method}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <table className="w-full mb-8">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="text-left py-2 font-bold text-slate-600">Mô tả</th>
                                        <th className="text-right py-2 font-bold text-slate-600">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-4 text-slate-800">{invoice.description}</td>
                                        <td className="py-4 text-right font-mono font-bold">{invoice.amount.toLocaleString()} {invoice.currency}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-300">
                                        <td className="pt-4 font-bold text-xl text-slate-900">Tổng cộng</td>
                                        <td className="pt-4 text-right font-bold text-xl text-indigo-600">{invoice.amount.toLocaleString()} {invoice.currency}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Footer */}
                            <div className="text-center text-xs text-slate-400 italic mt-12 print:mt-4">
                                Đây là hóa đơn điện tử có giá trị pháp lý. Cảm ơn quý khách.
                            </div>
                        </div>

                        {/* Print Button */}
                        <div className="mt-8 flex justify-center print:hidden">
                            <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                                <Printer className="w-5 h-5" /> In Hóa Đơn
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side: Benefits */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900">Nâng cấp <span className="text-amber-500">Premium</span></h1>
                        <p className="mt-2 text-lg text-slate-600">Mở khóa toàn bộ sức mạnh của ML Judge.</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Crown className="w-6 h-6"/></div>
                            <div>
                                <h3 className="font-bold text-slate-800">Gợi ý AI thông minh</h3>
                                <p className="text-sm text-slate-500">Nhận gợi ý từ AI cho các bài toán khó mà không cần nhìn lời giải.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><CheckCircle className="w-6 h-6"/></div>
                            <div>
                                <h3 className="font-bold text-slate-800">Không giới hạn bài nộp</h3>
                                <p className="text-sm text-slate-500">Nộp bài thoải mái để tối ưu hóa mô hình của bạn.</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-4">
                            <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><ShieldCheck className="w-6 h-6"/></div>
                            <div>
                                <h3 className="font-bold text-slate-800">Huy hiệu độc quyền</h3>
                                <p className="text-sm text-slate-500">Nổi bật trên bảng xếp hạng với huy hiệu Premium.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Payment Form */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                    <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                        <div className="font-bold text-lg">Thanh toán an toàn</div>
                        <Lock className="w-5 h-5 text-slate-400" />
                    </div>
                    
                    <form onSubmit={handlePayment} className="p-6 space-y-5">
                        <div className="relative p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg mb-6 card-preview">
                            <div className="flex justify-between items-start mb-8">
                                <CreditCard className="w-8 h-8 opacity-80" />
                                <span className="font-mono text-sm opacity-80">VISA</span>
                            </div>
                            <div className="font-mono text-xl tracking-widest mb-4">
                                {formData.cardNumber || '•••• •••• •••• ••••'}
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-[10px] uppercase opacity-70 mb-1">Card Holder</div>
                                    <div className="font-medium text-sm tracking-wide">{formData.cardHolder.toUpperCase() || 'YOUR NAME'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase opacity-70 mb-1">Expires</div>
                                    <div className="font-medium text-sm tracking-wide">{formData.expiryDate || 'MM/YY'}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số thẻ</label>
                            <input 
                                name="cardNumber" 
                                type="text" 
                                value={formData.cardNumber}
                                onChange={handleInputChange}
                                maxLength={19}
                                placeholder="0000 0000 0000 0000" 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên chủ thẻ</label>
                            <input 
                                name="cardHolder" 
                                type="text" 
                                value={formData.cardHolder}
                                onChange={handleInputChange}
                                placeholder="NGUYEN VAN A" 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ngày hết hạn</label>
                                <input 
                                    name="expiryDate" 
                                    type="text" 
                                    value={formData.expiryDate}
                                    onChange={handleInputChange}
                                    maxLength={5}
                                    placeholder="MM/YY" 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CVV</label>
                                <input 
                                    name="cvv" 
                                    type="password" 
                                    value={formData.cvv}
                                    onChange={handleInputChange}
                                    maxLength={3}
                                    placeholder="123" 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loading ? <LoadingSpinner size="sm" color="white"/> : 'Thanh toán 99.000đ'}
                            </button>
                            <p className="text-center text-xs text-slate-400 mt-3 flex items-center justify-center gap-1">
                                <Lock className="w-3 h-3" /> Thông tin được mã hóa 256-bit SSL
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};