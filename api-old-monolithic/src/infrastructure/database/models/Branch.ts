import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { Tenant } from "./Tenant";
export class Branch extends Model {
    public id!: string;
    public tenant_id!: string;
    public name!: string;
    public slug!: string;
    public address!: string | null;
    public phone!: string | null;
    public email!: string | null;
    public status!: 'ACTIVE' | 'BLOCKED';
    public created_at!: Date;
    public updated_at!: Date;
}
Branch.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        tenant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: Tenant, key: 'id' }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
                is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
            }
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: { isEmail: true }
        },
        status: {
            type: DataTypes.ENUM('ACTIVE', 'BLOCKED'),
            defaultValue: 'ACTIVE',
        }
    },
    {
        sequelize,
        tableName: "branches",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['tenant_id', 'name']
            },
            {
                unique: true,
                fields: ['tenant_id', 'slug']
            },
            {
                fields: ['tenant_id', 'status']
            }
        ]
    }
);
