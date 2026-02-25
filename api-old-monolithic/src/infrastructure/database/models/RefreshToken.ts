import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { User } from "./User";
export class RefreshToken extends Model {
    public id!: string;
    public token_hash!: string;
    public user_id!: string;
    public expires_at!: Date;
    public revoked_at!: Date | null;
    public family_id!: string;
    public created_ip!: string;
}
RefreshToken.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        token_hash: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: User, key: 'id' }
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        revoked_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        family_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        created_ip: {
            type: DataTypes.STRING,
            allowNull: true,
        }
    },
    {
        sequelize,
        tableName: "refresh_tokens",
        timestamps: true,
        updatedAt: false,
        indexes: [
            { fields: ['token_hash'] },
            { fields: ['user_id'] }
        ]
    }
);
