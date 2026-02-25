import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { User } from "./User";
export class AuditLog extends Model {
    public id!: string;
    public user_id!: string | null;
    public tenant_id!: string | null;
    public action!: string;
    public resource!: string;
    public resource_id!: string | null;
    public ip_address!: string | null;
    public user_agent!: string | null;
    public details!: any;
}
AuditLog.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        tenant_id: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        resource: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        resource_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        user_agent: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        details: {
            type: DataTypes.JSONB,
            allowNull: true,
        }
    },
    {
        sequelize,
        tableName: "audit_logs",
        timestamps: true,
        updatedAt: false,
        indexes: [
        ]
    }
);
