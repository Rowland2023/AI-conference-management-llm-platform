/**
 * JWT authentication middleware.
 *
 * Responsibilities:
 * - Read the Authorization header.
 * - Verify the JWT.
 * - Populate req.user.
 */
export function authenticate({
    tokenVerifier,
    logger,
}) {

    return async function authenticateMiddleware(
        req,
        res,
        next,
    ) {

        try {

            const authorization =
                req.headers.authorization;

            if (
                !authorization ||
                !authorization.startsWith("Bearer ")
            ) {
                return res.status(401).json({
                    message: "Authentication required.",
                });
            }

            const token =
                authorization.slice(7);

            const payload = await tokenVerifier.verify(token);

req.user = {
    ...payload,
    id: payload.sub,
};
            return next();

        } catch (error) {

            logger?.warn(
                {
                    error,
                },
                "JWT authentication failed."
            );

            return res.status(401).json({
                message: "Invalid or expired access token.",
            });
        }

    };

}