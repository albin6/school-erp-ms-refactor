import { useTenantAuthStore } from '@/store/tenantAuthStore';

export const StaffDashboard = () => {
    const { user } = useTenantAuthStore();

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
                Staff Dashboard
                {user?.subRole && <span className="text-xl text-gray-600 ml-3">({user.subRole})</span>}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="My Classes" value="5" />
                <StatCard title="Students" value="120" />
                <StatCard title="Pending Tasks" value="8" />
            </div>
        </div>
    );
};

const StatCard = ({ title, value }: { title: string; value: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-600 mb-2">{title}</div>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
    </div>
);
