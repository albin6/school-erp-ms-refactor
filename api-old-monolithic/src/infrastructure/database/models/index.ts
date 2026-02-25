import { sequelize } from "../sequelize";
import { User } from "./User";
import { Tenant } from "./Tenant";
import { TenantUser } from "./TenantUser";
import { RefreshToken } from "./RefreshToken";
import { AuditLog } from "./AuditLog";
import PasswordResetToken from "./PasswordResetToken";
import { Branch } from "./Branch";
const defineAssociations = () => {
    User.belongsToMany(Tenant, { through: TenantUser, foreignKey: 'user_id' });
    Tenant.belongsToMany(User, { through: TenantUser, foreignKey: 'tenant_id' });
    TenantUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    TenantUser.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
    User.hasMany(TenantUser, { foreignKey: 'user_id', as: 'tenantUsers' });
    Tenant.hasMany(TenantUser, { foreignKey: 'tenant_id', as: 'tenantUsers' });
    User.hasMany(RefreshToken, { foreignKey: 'user_id' });
    RefreshToken.belongsTo(User, { foreignKey: 'user_id' });
    AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
    Tenant.hasMany(Branch, { foreignKey: 'tenant_id', as: 'branches' });
    Branch.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
    Branch.hasMany(TenantUser, { foreignKey: 'branch_id', as: 'users' });
    TenantUser.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
};
const initModels = async () => {
    defineAssociations();
    await sequelize.sync({ alter: true });
    console.log(" Database Models Synced");
};
export {
    User,
    Tenant,
    TenantUser,
    RefreshToken,
    AuditLog,
    PasswordResetToken,
    Branch,
    initModels
};
module.exports = {
    User,
    Tenant,
    TenantUser,
    RefreshToken,
    AuditLog,
    PasswordResetToken,
    Branch,
    initModels
};
