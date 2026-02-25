import { Modal, Form, Input, message } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { tenantService } from '../services/tenant.service';
import type { Tenant, UpdateTenantDTO } from '../types/tenant.types';

interface EditTenantModalProps {
    open: boolean;
    tenant: Tenant | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const EditTenantModal = ({ open, tenant, onClose, onSuccess }: EditTenantModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<any>(null);

    useEffect(() => {
        if (open && tenant) {
            form.setFieldsValue({
                name: tenant.name,
                subdomain: tenant.subdomain,
                domain: tenant.domain,
            });
        }
    }, [open, tenant, form]);

    const handleSubmit = async (values: UpdateTenantDTO) => {
        if (!tenant) return;

        setLoading(true);
        try {
            await tenantService.updateTenant(tenant.id, values);
            message.success('Tenant updated successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to update tenant');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    const checkSubdomain = async (_: any, value: string) => {
        if (!value || value.length < 3) return Promise.resolve();

        
        if (tenant && value === tenant.subdomain) return Promise.resolve();

        return new Promise((resolve, reject) => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(async () => {
                try {
                    
                    const response = await tenantService.checkAvailability(value, tenant?.id);
                    if (response.data.available) {
                        resolve(null);
                    } else {
                        reject(new Error('Subdomain is already taken'));
                    }
                } catch (error) {
                    console.error('Check failed', error);
                    resolve(null);
                }
            }, 500);
        });
    };

    return (
        <Modal
            title="Edit Tenant"
            open={open}
            onCancel={handleCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
            >
                <Form.Item
                    label="School Name"
                    name="name"
                    rules={[
                        { required: true, message: 'Please enter school name' },
                        { min: 3, message: 'Name must be at least 3 characters' },
                    ]}
                >
                    <Input placeholder="e.g., Greenwood High School" />
                </Form.Item>

                <Form.Item
                    label="Subdomain"
                    name="subdomain"
                    tooltip="Changing subdomain may affect existing login URLs"
                    hasFeedback
                    rules={[
                        { required: true, message: 'Please enter subdomain' },
                        { min: 3, message: 'Subdomain must be at least 3 characters' },
                        { max: 63, message: 'Subdomain must be less than 63 characters' },
                        {
                            pattern: /^[a-z0-9-]+$/,
                            message: 'Subdomain must contain only lowercase letters, numbers, and hyphens',
                        },
                        { validator: checkSubdomain }
                    ]}
                >
                    <Input placeholder="e.g., greenwood" />
                </Form.Item>

                <Form.Item
                    label="Custom Domain (Optional)"
                    name="domain"
                >
                    <Input placeholder="e.g., greenwood.edu" />
                </Form.Item>
            </Form>
        </Modal>
    );
};
