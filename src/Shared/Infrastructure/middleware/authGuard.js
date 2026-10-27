/**
 * Authentication / Authorization middleware factory
 *
 * Usage:
 *
 * router.use(authGuard());
 *
 * router.post(
 *   "/admin",
 *   authGuard("admin"),
 *   controller.action
 * );
 */

export function authGuard(requiredRole = null) {

    return (req, res, next) => {

        const authHeader =
            req.headers?.authorization;


        if (!authHeader) {

            return res.status(401).json({

                success: false,

                error:
                    "Unauthorized: No token provided",

            });

        }


        /**
         * TODO:
         * Replace with JWT verification.
         *
         * Example:
         *
         * req.actor = {
         *    id,
         *    tenantId,
         *    roles
         * }
         */


        req.actor = {

            id:
                "system-user",

            tenantId:
                "system-tenant",

            roles:
                ["admin"],

        };



        if (
            requiredRole &&
            !req.actor.roles.includes(requiredRole)
        ) {

            return res.status(403).json({

                success:false,

                error:
                    "Forbidden: insufficient permissions",

            });

        }


        next();

    };

}