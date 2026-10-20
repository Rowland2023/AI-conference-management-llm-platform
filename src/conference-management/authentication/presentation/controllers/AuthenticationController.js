export class AuthenticationController {
    constructor({
        registerUser,
        loginUser,
    }) {
        this.registerUser = registerUser;
        this.loginUser = loginUser;
    }

    async register(req, res) {
        const result = await this.registerUser.execute({
            email: req.body?.email,
            password: req.body?.password,
        });

        return res.status(201).json(result);
    }

    async login(req, res) {
        const result = await this.loginUser.execute({
            email: req.body?.email,
            password: req.body?.password,
        });

        return res.status(200).json(result);
    }

    refreshToken(_req, res) {
        return this.notImplemented(res, "Refresh token");
    }

    forgotPassword(_req, res) {
        return this.notImplemented(res, "Forgot password");
    }

    resetPassword(_req, res) {
        return this.notImplemented(res, "Reset password");
    }

    verifyEmail(_req, res) {
        return this.notImplemented(res, "Email verification");
    }

    logout(_req, res) {
        return this.notImplemented(res, "Logout");
    }

    changePassword(_req, res) {
        return this.notImplemented(res, "Change password");
    }

    me(_req, res) {
        return this.notImplemented(res, "Current-user profile");
    }

    notImplemented(res, feature) {
        return res.status(501).json({
            error: {
                code: "NOT_IMPLEMENTED",
                message: `${feature} is not implemented yet.`,
            },
        });
    }
}
