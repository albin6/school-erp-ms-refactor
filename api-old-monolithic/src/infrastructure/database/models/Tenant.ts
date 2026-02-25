import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
export class Tenant extends Model {
    public id!: string;
    public name!: string;
    public subdomain!: string;
    public domain!: string | null;
    public status!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    public settings!: Record<string, any>;
    public is_active!: boolean;
    public created_by!: string | null;
}
Tenant.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        subdomain: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        domain: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'),
            defaultValue: 'ACTIVE',
        },
        settings: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'Tenant',
        tableName: "tenants",
        timestamps: true,
        underscored: true,
    }
);
