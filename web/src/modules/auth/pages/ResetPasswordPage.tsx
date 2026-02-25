import React, { useState } from 'react';
import { Form, Input, Button, Typography, Progress, App } from 'antd';
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '@/services/api';
import { isSuperAdminDomain, getTenantSubdomain } from '@/utils/subdomain';

const { Title, Text } = Typography;

interface LocationState {
    email: string;
    resetToken: string;
}

interface ResetPasswordFormData {
    newPassword: string;
    confirmPassword: string;
}

export const ResetPasswordPage: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { message: messageApi } = App.useApp();

    const state = location.state as LocationState;
    const email = state?.email;
    const resetToken = state?.resetToken;

    React.useEffect(() => {
        if (!email || !resetToken) {
            navigate('/forgot-password');
        }
    }, [email, resetToken, navigate]);

    const calculatePasswordStrength = (password: string): number => {
        let strength = 0;

        if (password.length >= 8) strength += 20;
        if (password.length >= 12) strength += 10;
        if (/[a-z]/.test(password)) strength += 20;
        if (/[A-Z]/.test(password)) strength += 20;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

        return Math.min(strength, 100);
    };

    const getStrengthColor = (strength: number): string => {
        if (strength < 40) return '#ff4d4f';
        if (strength < 70) return '#faad14';
        return '#52c41a';
    };

    const getStrengthText = (strength: number): string => {
        if (strength < 40) return 'Weak';
        if (strength < 70) return 'Medium';
        return 'Strong';
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        setPasswordStrength(calculatePasswordStrength(password));
    };

    const handleSubmit = async (values: ResetPasswordFormData) => {
        try {
            setLoading(true);

            const response = await api.post('/auth/reset-password', {
                email,
                resetToken,
                newPassword: values.newPassword
            });

            if (response.data.status === 'success') {
                messageApi.success('Password reset successfully! Redirecting...');

                const { role, branch_slug } = response.data.data || {};
                const tenantSubdomain = getTenantSubdomain();

                setTimeout(() => {
                    if (isSuperAdminDomain()) {
                        navigate('/login');
                    } else if (tenantSubdomain) {
                        const targetSlug = branch_slug || tenantSubdomain;

                        if (role === 'STUDENT') {
                            navigate(`/${targetSlug}`); // Student portal entry
                        } else if (role === 'STAFF') {
                            navigate(`/${targetSlug}/staff`); // Staff portal entry
                        } else {
                            navigate('/admin'); // Fallback to admin/default
                        }
                    } else {
                        navigate('/login');
                    }
                }, 2000);
            }
        } catch (error: any) {
            messageApi.error(
                error.response?.data?.message || 'Failed to reset password. Please try again.'
            );
        } finally {
            setLoading(false);
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
                maxWidth: '450px',
                width: '100%'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <Title level={2} style={{ marginBottom: '8px' }}>
                        Reset Password
                    </Title>
                    <Text type="secondary">
                        Create a new strong password for your account
                    </Text>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    requiredMark={false}
                >
                    <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                            { required: true, message: 'Please enter your new password' },
                            { min: 8, message: 'Password must be at least 8 characters' },
                            {
                                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                                message: 'Password must contain uppercase, lowercase, number, and special character'
                            }
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Enter new password"
                            size="large"
                            onChange={handlePasswordChange}
                            autoFocus
                        />
                    </Form.Item>

                    {passwordStrength > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <Progress
                                percent={passwordStrength}
                                strokeColor={getStrengthColor(passwordStrength)}
                                showInfo={false}
                                size="small"
                            />
                            <Text
                                type="secondary"
                                style={{ fontSize: '12px', color: getStrengthColor(passwordStrength) }}
                            >
                                Password Strength: {getStrengthText(passwordStrength)}
                            </Text>
                        </div>
                    )}

                    <Form.Item
                        name="confirmPassword"
                        label="Confirm Password"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Please confirm your password' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Passwords do not match'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Confirm new password"
                            size="large"
                        />
                    </Form.Item>

                    <div style={{
                        background: '#f0f2f5',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '24px'
                    }}>
                        <Text strong style={{ fontSize: '12px' }}>Password Requirements:</Text>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '12px' }}>
                            <li>At least 8 characters long</li>
                            <li>Contains uppercase and lowercase letters</li>
                            <li>Contains at least one number</li>
                            <li>Contains at least one special character (@$!%*?&)</li>
                        </ul>
                    </div>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={loading}
                            icon={<CheckCircleOutlined />}
                            block
                        >
                            Reset Password
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};
