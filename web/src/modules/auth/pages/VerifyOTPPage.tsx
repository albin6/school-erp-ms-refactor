import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Statistic, App } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Countdown } = Statistic;

interface LocationState {
    email: string;
    expiresAt: string;
}

export const VerifyOTPPage: React.FC = () => {
    const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [canResend, setCanResend] = useState(false);
    const [expiresAt, setExpiresAt] = useState<number>(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const navigate = useNavigate();
    const location = useLocation();
    const { message: messageApi } = App.useApp();

    const state = location.state as LocationState;
    const email = state?.email;

    useEffect(() => {
        if (!email) {
            navigate('/forgot-password');
            return;
        }

        if (state?.expiresAt) {
            setExpiresAt(new Date(state.expiresAt).getTime());
        }

        
        inputRefs.current[0]?.focus();

        
        const timer = setTimeout(() => setCanResend(true), 60000);
        return () => clearTimeout(timer);
    }, [email, navigate, state]);

    const handleChange = (index: number, value: string) => {
        
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];

        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i];
        }

        setOtp(newOtp);

        
        const nextIndex = Math.min(pastedData.length, 5);
        inputRefs.current[nextIndex]?.focus();
    };

    const handleVerify = async () => {
        const otpString = otp.join('');

        if (otpString.length !== 6) {
            messageApi.error('Please enter complete OTP');
            return;
        }

        try {
            setLoading(true);

            const response = await api.post('/auth/verify-otp', {
                email,
                otp: otpString
            });

            if (response.data.status === 'success') {
                messageApi.success('OTP verified successfully');

                
                navigate('/reset-password', {
                    state: {
                        email,
                        resetToken: response.data.data.resetToken
                    }
                });
            }
        } catch (error: any) {
            messageApi.error(
                error.response?.data?.message || 'Invalid OTP. Please try again.'
            );
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            setResendLoading(true);

            const response = await api.post('/auth/resend-otp', { email });

            if (response.data.status === 'success') {
                messageApi.success('New OTP sent to your email');
                setExpiresAt(new Date(response.data.data.expiresAt).getTime());
                setOtp(['', '', '', '', '', '']);
                setCanResend(false);
                inputRefs.current[0]?.focus();

                
                setTimeout(() => setCanResend(true), 60000);
            }
        } catch (error: any) {
            messageApi.error(
                error.response?.data?.message || 'Failed to resend OTP'
            );
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                maxWidth: '500px',
                width: '100%'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <Title level={2} style={{ marginBottom: '8px' }}>
                        Verify OTP
                    </Title>
                    <Text type="secondary">
                        Enter the 6-digit code sent to
                    </Text>
                    <br />
                    <Text strong>{email}</Text>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                    marginBottom: '24px'
                }}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => {
                                inputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onPaste={handlePaste}
                            style={{
                                width: '50px',
                                height: '60px',
                                fontSize: '24px',
                                textAlign: 'center',
                                border: '2px solid #d9d9d9',
                                borderRadius: '8px',
                                outline: 'none',
                                transition: 'all 0.3s',
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#1890ff';
                                e.target.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#d9d9d9';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    ))}
                </div>

                {expiresAt > 0 && (
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <Text type="secondary">OTP expires in: </Text>
                        <Countdown
                            value={expiresAt}
                            format="mm:ss"
                            valueStyle={{ fontSize: '16px', color: '#ff4d4f' }}
                            onFinish={() => messageApi.warning('OTP expired. Please request a new one.')}
                        />
                    </div>
                )}

                <Button
                    type="primary"
                    size="large"
                    loading={loading}
                    onClick={handleVerify}
                    block
                    style={{ marginBottom: '16px' }}
                >
                    Verify OTP
                </Button>

                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">Didn't receive the code? </Text>
                    <Button
                        type="link"
                        onClick={handleResend}
                        loading={resendLoading}
                        disabled={!canResend}
                        style={{ padding: 0 }}
                    >
                        Resend OTP
                    </Button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <Button
                        type="link"
                        onClick={() => navigate('/forgot-password')}
                    >
                        ← Change Email
                    </Button>
                </div>
            </div>
        </div>
    );
};
