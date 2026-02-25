import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { User } from "./User";
import { Tenant } from "./Tenant";
export class TenantUser extends Model {
    public id!: string;
    public user_id!: string;
    public tenant_id!: string;
    public role!: 'ADMIN' | 'STAFF' | 'STUDENT';
    public sub_role!: string | null;
    public branch_id!: string | null;
}
TenantUser.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' }
        },
        tenant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' }
        },
        branch_id: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        role: {
            type: DataTypes.ENUM('ADMIN', 'STAFF', 'STUDENT'),
            allowNull: false,
        },
        sub_role: {
            type: DataTypes.ENUM('PRINCIPAL', 'TEACHER', 'OFFICE_STAFF', 'OFFICE_ASSISTANT'),
            allowNull: true,
        }
    },
    {
        sequelize,
        tableName: "tenant_users",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'tenant_id']
            },
            {
                fields: ['tenant_id', 'branch_id']
            },
            {
                fields: ['tenant_id', 'role', 'sub_role']
            }
        ]
    }
);
