import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
export class User extends Model {
    public id!: string;
    public email!: string;
    public password_hash!: string;
    public name!: string;
    public is_super_admin!: boolean;
    public failed_login_attempts!: number;
    public lockout_until!: Date | null;
    public last_login_at!: Date | null;
    public is_active!: boolean;
    public must_reset_password!: boolean;
    public password_reset_token!: string | null;
    public password_reset_expires!: Date | null;
}
User.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: { isEmail: true }
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        is_super_admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        failed_login_attempts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        lockout_until: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        last_login_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        must_reset_password: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        password_reset_token: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        password_reset_expires: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    },
    {
        sequelize,
        tableName: "users",
        timestamps: true,
    }
);
