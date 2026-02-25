export const StudentDashboard = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Student Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="My Courses" value="6" />
                <StatCard title="Attendance" value="92%" />
                <StatCard title="Assignments Due" value="3" />
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
