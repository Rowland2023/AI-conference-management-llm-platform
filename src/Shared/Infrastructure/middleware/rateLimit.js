import expressRateLimit, {
    ipKeyGenerator,
} from "express-rate-limit";


function createSafeLimiter(options = {}) {

    return expressRateLimit({

        standardHeaders: true,

        legacyHeaders: false,


        ...options,


        keyGenerator(req) {

            return (
                req.user?.id ||
                ipKeyGenerator(req.ip)
            );

        },

    });

}



export function rateLimit(options = {}) {

    return createSafeLimiter(options);

}



export const standardRateLimiter =
    createSafeLimiter({

        windowMs:
            15 * 60 * 1000,

        max:
            100,

    });



export const strictRateLimiter =
    createSafeLimiter({

        windowMs:
            60 * 60 * 1000,

        max:
            10,

    });