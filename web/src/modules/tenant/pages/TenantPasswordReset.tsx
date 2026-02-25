import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Progress } from 'antd';
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTenantAuthStore } from '@/store/tenantAuthStore';
import { getTenantSubdomain } from '@/utils/subdomain';
import api from '@/services/api';

const { Title, Text } = Typography;

export const TenantPasswordReset = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const navigate = useNavigate();
    const { user, tenant } = useTenantAuthStore();
    const subdomain = getTenantSubdomain();

    const calculatePasswordStrength = (password: string): number => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password)) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 12.5;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;
        return Math.min(strength, 100);
    };

    const getStrengthColor = (strength: number): string => {
        if (strength < 50) return '#ff4d4f';
        if (strength < 75) return '#faad14';
        return '#52c41a';
    };

    const getStrengthText = (strength: number): string => {
        if (strength < 50) return 'Weak';
        if (strength < 75) return 'Medium';
        return 'Strong';
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const password = e.target.value;
        setPasswordStrength(calculatePasswordStrength(password));
    };

    const onFinish = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
        if (!user || !tenant || !subdomain) {
            message.error('Session expired. Please login again.');
            navigate('/admin');
            return;
        }

        setLoading(true);
        try {
            await api.post(`/auth/tenant/${subdomain}/reset-password`, {
                email: user.email,
                oldPassword: values.oldPassword,
                newPassword: values.newPassword,
            });

            message.success('Password reset successfully!');
            navigate('/admin/dashboard');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
            <Card className="w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <div className="mb-4">
                        <CheckCircleOutlined className="text-6xl text-yellow-500" />
                    </div>
                    <Title level={2} className="mb-2">Reset Your Password</Title>
                    <Text type="secondary">
                        For security reasons, you must change your temporary password
                    </Text>
                </div>

                <Form
                    form={form}
                    name="password-reset"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="oldPassword"
                        label="Temporary Password"
                        rules={[{ required: true, message: 'Please enter your temporary password!' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Enter temporary password"
                        />
                    </Form.Item>

                    <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                            { required: true, message: 'Please enter your new password!' },
                            { min: 8, message: 'Password must be at least 8 characters!' },
                            {
                                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                                message: 'Password must contain uppercase, lowercase, number, and symbol!'
                            }
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Enter new password"
                            onChange={handlePasswordChange}
                        />
                    </Form.Item>

                    {passwordStrength > 0 && (
                        <div className="mb-4">
                            <Progress
                                percent={passwordStrength}
                                strokeColor={getStrengthColor(passwordStrength)}
                                showInfo={false}
                                size="small"
                            />
                            <Text type="secondary" className="text-sm">
                                Password Strength: <span style={{ color: getStrengthColor(passwordStrength) }}>
                                    {getStrengthText(passwordStrength)}
                                </span>
                            </Text>
                        </div>
                    )}

                    <Form.Item
                        name="confirmPassword"
                        label="Confirm New Password"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Please confirm your password!' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Passwords do not match!'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Confirm new password"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            Reset Password
                        </Button>
                    </Form.Item>
                </Form>

                <div className="mt-4 p-4 bg-blue-50 rounded">
                    <Text type="secondary" className="text-sm">
                        <strong>Password Requirements:</strong>
                        <ul className="mt-2 ml-4">
                            <li>At least 8 characters long</li>
                            <li>Contains uppercase and lowercase letters</li>
                            <li>Contains at least one number</li>
                            <li>Contains at least one special character (@$!%*?&)</li>
                        </ul>
                    </Text>
                </div>
            </Card>
        </div>
    );
};
