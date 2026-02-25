import React, { useState } from 'react';
import { Form, Input, Button, Typography, App } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

const { Title, Text } = Typography;

interface ForgotPasswordFormData {
    email: string;
}

export const ForgotPasswordPage: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { message: messageApi } = App.useApp();

    const handleSubmit = async (values: ForgotPasswordFormData) => {
        try {
            setLoading(true);

            const response = await api.post('/auth/forgot-password', {
                email: values.email
            });

            if (response.data.status === 'success') {
                messageApi.success('OTP sent to your email');

                
                navigate('/verify-otp', {
                    state: {
                        email: values.email,
                        expiresAt: response.data.data.expiresAt
                    }
                });
            }
        } catch (error: any) {
            messageApi.error(
                error.response?.data?.message || 'Failed to send OTP. Please try again.'
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
                        Forgot Password?
                    </Title>
                    <Text type="secondary">
                        Enter your email address and we'll send you an OTP to reset your password
                    </Text>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    requiredMark={false}
                >
                    <Form.Item
                        name="email"
                        label="Email Address"
                        rules={[
                            { required: true, message: 'Please enter your email' },
                            { type: 'email', message: 'Please enter a valid email' }
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            placeholder="your.email@example.com"
                            size="large"
                            autoFocus
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: '16px' }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={loading}
                            block
                        >
                            Send OTP
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center' }}>
                        <Button
                            type="link"
                            onClick={() => navigate(-1)}
                        >
                            ← Back to Login
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
};
