import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';
interface PasswordResetTokenAttributes {
    id: string;
    email: string;
    otp_hash: string;
    expires_at: Date;
    attempts: number;
    max_attempts: number;
    created_at: Date;
    used_at: Date | null;
    ip_address: string | null;
}
interface PasswordResetTokenCreationAttributes extends Optional<PasswordResetTokenAttributes, 'id' | 'attempts' | 'max_attempts' | 'created_at' | 'used_at' | 'ip_address'> { }
class PasswordResetToken extends Model<PasswordResetTokenAttributes, PasswordResetTokenCreationAttributes> implements PasswordResetTokenAttributes {
    public id!: string;
    public email!: string;
    public otp_hash!: string;
    public expires_at!: Date;
    public attempts!: number;
    public max_attempts!: number;
    public created_at!: Date;
    public used_at!: Date | null;
    public ip_address!: string | null;
}
PasswordResetToken.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        otp_hash: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        attempts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        max_attempts: {
            type: DataTypes.INTEGER,
            defaultValue: 5,
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        used_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'password_reset_tokens',
        timestamps: false,
        indexes: [
            {
                name: 'idx_email',
                fields: ['email'],
            },
            {
                name: 'idx_expires_at',
                fields: ['expires_at'],
            },
        ],
    }
);
export default PasswordResetToken;
