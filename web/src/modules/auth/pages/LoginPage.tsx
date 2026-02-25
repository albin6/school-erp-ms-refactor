import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, message } from 'antd';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

export const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const login = useAuthStore((state) => state.login);
    const navigate = useNavigate();

    const onFinish = async (values: any) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/auth/login', values);
            const { user, accessToken } = response.data.data;

            login(user, accessToken);
            message.success('Login Successful');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || 'Login failed';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-md shadow-lg">
                <div className="text-center mb-6">
                    <Title level={3}>School Management</Title>
                    <Typography.Text type="secondary">Sign in to your account</Typography.Text>
                </div>

                {error && <Alert message={error} type="error" showIcon className="mb-4" />}

                <Form
                    name="login"
                    layout="vertical"
                    onFinish={onFinish}
                    autoComplete="off"
                >
                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[{ required: true, message: 'Please input your email!' }, { type: 'email', message: 'Invalid email' }]}
                    >
                        <Input size="large" placeholder="admin@school.com" />
                    </Form.Item>

                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                    >
                        <Input.Password size="large" placeholder="Password@123" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Log in
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center' }}>
                        <Button
                            type="link"
                            onClick={() => navigate('/forgot-password')}
                            style={{ padding: 0 }}
                        >
                            Forgot Password?
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};
