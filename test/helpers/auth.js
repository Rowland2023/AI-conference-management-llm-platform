
import jwt from "jsonwebtoken";
import { config } from "../../src/config/index.js";

export function createTestAuthHeaders({
    id = "22222222-2222-2222-2222-222222222222",
    email = "test@example.com",
    roles = ["USER"],
} = {}) {
    const token = jwt.sign(
        {
            sub: id,
            email,
            roles,
        },
        config.security.jwt.secret,
        {
            issuer: config.security.jwt.issuer,
            audience: config.security.jwt.audience,
            expiresIn: "5m",
        },
    );

    return {
        Authorization: `Bearer ${token}`,
    };
}
